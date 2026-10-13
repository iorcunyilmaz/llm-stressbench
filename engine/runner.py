"""
LLM StressBench Pro - Asynchronous Benchmark Runner
Orchestrates concurrency sweeps, KV cache tests, and comparative benchmarks with live event streaming.
"""

import asyncio
import time
import uuid
from typing import List, Dict, Any, Optional, AsyncGenerator
from pydantic import BaseModel, Field

from .client import LLMBenchmarkClient, BenchmarkRequestResult
from .metrics import MetricsCalculator, StepMetricsSummary
from .prompts import PromptGenerator

class BenchmarkConfig(BaseModel):
    name: str = "Test-Run"
    target_type: str = "vllm" # 'vllm', 'litellm', 'custom'
    base_url: str = "http://localhost:8000/v1"
    api_key: str = ""
    model: str = "default-model"
    mode: str = "concurrency_sweep" # 'quick', 'concurrency_sweep', 'kv_cache_stress', 'prefix_cache_test', 'compare'
    
    # Concurrency test parameters
    concurrency_list: List[int] = Field(default_factory=lambda: [1, 2, 4, 8, 16, 32])
    requests_per_step: int = 10
    
    # KV Cache test parameters
    context_lengths: List[int] = Field(default_factory=lambda: [512, 1024, 2048, 4096, 8192])
    kv_fixed_concurrency: int = 4
    
    # Generation parameters
    max_tokens: int = 256
    temperature: float = 0.7
    token_length: int = 256
    prefix_caching: bool = False
    
    # SLA parameters
    sla_max_ttft_ms: float = 800.0
    sla_min_user_tps: float = 15.0
    
    # Custom prompts
    custom_system: str = ""
    custom_prompt: str = ""
    
    # Comparative benchmark secondary target
    compare_target_url: str = "http://localhost:4000/v1"
    compare_target_key: str = ""
    compare_target_model: str = ""

class BenchmarkRunner:
    def __init__(self, config: BenchmarkConfig):
        self.config = config
        self.run_id = str(uuid.uuid4())[:8]
        self.stop_requested = asyncio.Event()
        self.is_running = False
        self.event_queue: asyncio.Queue = asyncio.Queue()
        self.step_summaries: List[StepMetricsSummary] = []
        self.all_request_results: List[BenchmarkRequestResult] = []
        self.comparison_results: Optional[Dict[str, Any]] = None

    def request_stop(self):
        """Signals the runner to stop gracefully."""
        self.stop_requested.set()

    async def emit_event(self, event_type: str, data: Dict[str, Any]):
        """Pushes an event into the SSE queue for the Web UI."""
        payload = {
            "run_id": self.run_id,
            "type": event_type,
            "timestamp": time.time(),
            "data": data
        }
        await self.event_queue.put(payload)

    async def run_single_step(
        self,
        client: LLMBenchmarkClient,
        concurrency: int,
        total_requests: int,
        prompt_len: int,
        prefix_cache: bool,
        step_index: int,
        step_label: str
    ) -> StepMetricsSummary:
        """
        Runs a batch of requests with a controlled concurrency semaphore.
        """
        await self.emit_event("step_started", {
            "step_index": step_index,
            "step_label": step_label,
            "concurrency": concurrency,
            "total_requests": total_requests,
            "prompt_length": prompt_len,
            "prefix_caching": prefix_cache
        })

        semaphore = asyncio.Semaphore(concurrency)
        step_results: List[BenchmarkRequestResult] = []
        t_step_start = time.perf_counter()

        async def worker(req_idx: int):
            if self.stop_requested.is_set():
                return
            async with semaphore:
                if self.stop_requested.is_set():
                    return
                req_id = f"R-{step_index+1}-{req_idx+1}"
                messages = PromptGenerator.get_prompt_for_mode(
                    mode=self.config.mode,
                    token_length=prompt_len,
                    prefix_caching=prefix_cache,
                    custom_system=self.config.custom_system,
                    custom_prompt=self.config.custom_prompt
                )
                res = await client.execute_streaming_request(
                    request_id=req_id,
                    model=self.config.model,
                    messages=messages,
                    max_tokens=self.config.max_tokens,
                    temperature=self.config.temperature
                )
                step_results.append(res)
                self.all_request_results.append(res)

                # Emit individual completed request event
                await self.emit_event("request_completed", {
                    "step_index": step_index,
                    "request": res.to_dict(),
                    "progress": {
                        "completed": len(step_results),
                        "total": total_requests
                    }
                })

        tasks = [asyncio.create_task(worker(i)) for i in range(total_requests)]
        await asyncio.gather(*tasks, return_exceptions=True)

        t_step_end = time.perf_counter()
        step_wall_time = t_step_end - t_step_start

        step_summary = MetricsCalculator.aggregate_step_results(
            concurrency=concurrency,
            results=step_results,
            wall_time_sec=step_wall_time,
            sla_max_ttft_ms=self.config.sla_max_ttft_ms,
            sla_min_user_tps=self.config.sla_min_user_tps
        )

        await self.emit_event("step_completed", {
            "step_index": step_index,
            "step_label": step_label,
            "summary": step_summary.to_dict()
        })

        return step_summary

    async def execute(self) -> Dict[str, Any]:
        """Main execution loop dispatching the selected benchmark mode."""
        self.is_running = True
        t_benchmark_start = time.perf_counter()

        await self.emit_event("benchmark_started", {
            "config": self.config.model_dump(),
            "start_time": t_benchmark_start
        })

        client = LLMBenchmarkClient(
            base_url=self.config.base_url,
            api_key=self.config.api_key
        )

        try:
            if self.config.mode == "quick":
                # Quick test: 3 concurrency, 5 requests
                summary = await self.run_single_step(
                    client=client,
                    concurrency=3,
                    total_requests=6,
                    prompt_len=self.config.token_length,
                    prefix_cache=self.config.prefix_caching,
                    step_index=0,
                    step_label="Hızlı Test (3 Eşzamanlı)"
                )
                self.step_summaries.append(summary)

            elif self.config.mode == "concurrency_sweep":
                # Concurrency sweep: test saturation knee-point
                for idx, c in enumerate(self.config.concurrency_list):
                    if self.stop_requested.is_set():
                        break
                    req_count = max(c * 2, self.config.requests_per_step)
                    summary = await self.run_single_step(
                        client=client,
                        concurrency=c,
                        total_requests=req_count,
                        prompt_len=self.config.token_length,
                        prefix_cache=self.config.prefix_caching,
                        step_index=idx,
                        step_label=f"{c} Eşzamanlı Kullanıcı"
                    )
                    self.step_summaries.append(summary)
                    # Brief cooldown between steps
                    await asyncio.sleep(0.5)

            elif self.config.mode == "kv_cache_stress":
                # Context length sweep to stress KV Cache memory
                for idx, ctx_len in enumerate(self.config.context_lengths):
                    if self.stop_requested.is_set():
                        break
                    summary = await self.run_single_step(
                        client=client,
                        concurrency=self.config.kv_fixed_concurrency,
                        total_requests=self.config.requests_per_step,
                        prompt_len=ctx_len,
                        prefix_cache=False,
                        step_index=idx,
                        step_label=f"Bağlam: {ctx_len} Token"
                    )
                    self.step_summaries.append(summary)
                    await asyncio.sleep(0.5)

            elif self.config.mode == "prefix_cache_test":
                # Test cold prompts vs shared prefix caching
                # Step 1: Cold Prompts (Unique)
                cold_summary = await self.run_single_step(
                    client=client,
                    concurrency=self.config.kv_fixed_concurrency,
                    total_requests=self.config.requests_per_step,
                    prompt_len=self.config.token_length,
                    prefix_cache=False,
                    step_index=0,
                    step_label="Soğuk Önbellek (Cold Prompts / Cache Miss)"
                )
                self.step_summaries.append(cold_summary)
                
                await asyncio.sleep(1.0)
                
                # Step 2: Shared Prefix Caching (Warm / Hit)
                warm_summary = await self.run_single_step(
                    client=client,
                    concurrency=self.config.kv_fixed_concurrency,
                    total_requests=self.config.requests_per_step,
                    prompt_len=self.config.token_length,
                    prefix_cache=True,
                    step_index=1,
                    step_label="PagedAttention / Prefix Cache (Cache Hit)"
                )
                self.step_summaries.append(warm_summary)

            elif self.config.mode == "compare":
                # Compare Target A (vLLM) vs Target B (LiteLLM)
                target_a_name = f"Hedef A (vLLM): {self.config.base_url}"
                target_b_name = f"Hedef B (LiteLLM): {self.config.compare_target_url}"

                # Step 1: Target A
                a_summary = await self.run_single_step(
                    client=client,
                    concurrency=self.config.kv_fixed_concurrency,
                    total_requests=self.config.requests_per_step,
                    prompt_len=self.config.token_length,
                    prefix_cache=self.config.prefix_caching,
                    step_index=0,
                    step_label=target_a_name
                )
                self.step_summaries.append(a_summary)

                # Step 2: Target B
                client_b = LLMBenchmarkClient(
                    base_url=self.config.compare_target_url,
                    api_key=self.config.compare_target_key or self.config.api_key
                )
                try:
                    b_summary = await self.run_single_step(
                        client=client_b,
                        concurrency=self.config.kv_fixed_concurrency,
                        total_requests=self.config.requests_per_step,
                        prompt_len=self.config.token_length,
                        prefix_cache=self.config.prefix_caching,
                        step_index=1,
                        step_label=target_b_name
                    )
                    self.step_summaries.append(b_summary)
                finally:
                    await client_b.close()

        finally:
            await client.close()
            self.is_running = False

        t_benchmark_end = time.perf_counter()
        total_benchmark_time = t_benchmark_end - t_benchmark_start

        # Analyze capacity and saturation
        analysis = MetricsCalculator.analyze_concurrency_knee_point(self.step_summaries)

        final_report = {
            "run_id": self.run_id,
            "status": "stopped" if self.stop_requested.is_set() else "completed",
            "total_duration_sec": round(total_benchmark_time, 2),
            "config": self.config.model_dump(),
            "step_summaries": [s.to_dict() for s in self.step_summaries],
            "analysis": analysis,
            "total_requests": len(self.all_request_results),
            "successful_requests": len([r for r in self.all_request_results if r.success]),
            "failed_requests": len([r for r in self.all_request_results if not r.success])
        }

        await self.emit_event("benchmark_completed", final_report)
        return final_report
