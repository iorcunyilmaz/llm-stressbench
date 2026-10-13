"""
LLM StressBench Pro - Async Benchmark Client
High-concurrency streaming client measuring TTFT, TPOT, TPS, Latency, and Error rates.
"""

import time
import json
import asyncio
from typing import Dict, Any, Optional, Tuple, List
import aiohttp

class BenchmarkRequestResult:
    def __init__(
        self,
        request_id: str,
        success: bool,
        status_code: int = 0,
        ttft_ms: float = 0.0,
        latency_ms: float = 0.0,
        tpot_ms: float = 0.0,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        generation_tps: float = 0.0,
        total_tps: float = 0.0,
        error: Optional[str] = None,
        first_token_text: str = "",
        inter_token_latencies_ms: Optional[List[float]] = None
    ):
        self.request_id = request_id
        self.success = success
        self.status_code = status_code
        self.ttft_ms = round(ttft_ms, 2)
        self.latency_ms = round(latency_ms, 2)
        self.tpot_ms = round(tpot_ms, 2)
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.generation_tps = round(generation_tps, 2)
        self.total_tps = round(total_tps, 2)
        self.error = error
        self.first_token_text = first_token_text[:50] if first_token_text else ""
        self.inter_token_latencies_ms = inter_token_latencies_ms or []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "request_id": self.request_id,
            "success": self.success,
            "status_code": self.status_code,
            "ttft_ms": self.ttft_ms,
            "latency_ms": self.latency_ms,
            "tpot_ms": self.tpot_ms,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "generation_tps": self.generation_tps,
            "total_tps": self.total_tps,
            "error": self.error,
            "first_token_text": self.first_token_text
        }


class LLMBenchmarkClient:
    """Async client using aiohttp for low-overhead, microsecond-accurate benchmarking."""

    def __init__(
        self,
        base_url: str,
        api_key: str = "",
        timeout_seconds: float = 120.0,
        max_connections: int = 1000
    ):
        # Normalize base_url
        clean_url = base_url.rstrip("/")
        if not clean_url.endswith("/chat/completions"):
            if not clean_url.endswith("/v1"):
                clean_url = clean_url + "/v1"
            clean_url = clean_url + "/chat/completions"
        self.endpoint_url = clean_url
        self.api_key = api_key.strip()
        self.timeout = aiohttp.ClientTimeout(
            total=timeout_seconds,
            connect=15.0,
            sock_read=timeout_seconds
        )
        self.max_connections = max_connections
        self._session: Optional[aiohttp.ClientSession] = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            connector = aiohttp.TCPConnector(
                limit=self.max_connections,
                limit_per_host=self.max_connections,
                keepalive_timeout=75.0,
                enable_cleanup_closed=True,
                ssl=False # Local server or http
            )
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=self.timeout
            )
        return self._session

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()

    async def execute_streaming_request(
        self,
        request_id: str,
        model: str,
        messages: List[Dict[str, str]],
        max_tokens: int = 512,
        temperature: float = 0.7,
        stream_options: bool = True
    ) -> BenchmarkRequestResult:
        """
        Executes a single chat completion with streaming enabled and records granular metrics.
        """
        session = await self.get_session()
        
        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            auth_val = self.api_key if self.api_key.lower().startswith("bearer ") else f"Bearer {self.api_key}"
            headers["Authorization"] = auth_val

        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True
        }
        if stream_options:
            # vLLM and LiteLLM support stream_options to send exact usage statistics
            payload["stream_options"] = {"include_usage": True}

        t_start = time.perf_counter()
        t_first_token: Optional[float] = None
        t_last_token: Optional[float] = None
        
        token_count = 0
        reported_prompt_tokens = 0
        reported_completion_tokens = 0
        inter_token_latencies: List[float] = []
        first_token_content = ""

        try:
            async with session.post(self.endpoint_url, json=payload, headers=headers) as response:
                status_code = response.status
                
                if status_code != 200:
                    err_body = await response.text()
                    t_err = time.perf_counter()
                    total_time_ms = (t_err - t_start) * 1000.0
                    return BenchmarkRequestResult(
                        request_id=request_id,
                        success=False,
                        status_code=status_code,
                        latency_ms=total_time_ms,
                        error=f"HTTP {status_code}: {err_body[:300]}"
                    )

                # Process SSE line by line
                buffer = ""
                async for chunk_bytes in response.content.iter_any():
                    now = time.perf_counter()
                    chunk_str = chunk_bytes.decode("utf-8", errors="replace")
                    buffer += chunk_str

                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()

                        if not line or not line.startswith("data:"):
                            continue

                        data_part = line[5:].strip()
                        if data_part == "[DONE]":
                            break

                        try:
                            json_obj = json.loads(data_part)
                        except Exception:
                            continue

                        # Check for usage stats sent by vLLM / LiteLLM
                        if "usage" in json_obj and json_obj["usage"]:
                            usage = json_obj["usage"]
                            reported_prompt_tokens = usage.get("prompt_tokens", reported_prompt_tokens)
                            reported_completion_tokens = usage.get("completion_tokens", reported_completion_tokens)

                        choices = json_obj.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})
                        content = delta.get("content", "")

                        if content:
                            if t_first_token is None:
                                t_first_token = now
                                first_token_content = content
                                t_last_token = now
                            else:
                                if t_last_token is not None:
                                    inter_token_latencies.append((now - t_last_token) * 1000.0)
                                t_last_token = now
                            token_count += 1

                t_end = time.perf_counter()
                total_latency_ms = (t_end - t_start) * 1000.0

                if t_first_token is None:
                    # Stream finished without any content tokens
                    return BenchmarkRequestResult(
                        request_id=request_id,
                        success=False,
                        status_code=status_code,
                        latency_ms=total_latency_ms,
                        error="Stream completed without any text content tokens (empty generation or server filter)."
                    )

                ttft_ms = (t_first_token - t_start) * 1000.0
                gen_duration_sec = max(t_end - t_first_token, 0.0001)
                
                final_completion_tokens = reported_completion_tokens if reported_completion_tokens > 0 else token_count
                
                # Approximate prompt tokens if server didn't report it
                if reported_prompt_tokens <= 0:
                    raw_prompt_text = "".join([m.get("content", "") for m in messages])
                    reported_prompt_tokens = max(int(len(raw_prompt_text) / 3.8), 10)

                # Time Per Output Token (TPOT)
                if final_completion_tokens > 1:
                    tpot_ms = (gen_duration_sec * 1000.0) / (final_completion_tokens - 1)
                else:
                    tpot_ms = gen_duration_sec * 1000.0

                generation_tps = final_completion_tokens / gen_duration_sec
                total_tps = (reported_prompt_tokens + final_completion_tokens) / max((t_end - t_start), 0.0001)

                return BenchmarkRequestResult(
                    request_id=request_id,
                    success=True,
                    status_code=status_code,
                    ttft_ms=ttft_ms,
                    latency_ms=total_latency_ms,
                    tpot_ms=tpot_ms,
                    prompt_tokens=reported_prompt_tokens,
                    completion_tokens=final_completion_tokens,
                    generation_tps=generation_tps,
                    total_tps=total_tps,
                    first_token_text=first_token_content,
                    inter_token_latencies_ms=inter_token_latencies
                )

        except asyncio.TimeoutError:
            t_err = time.perf_counter()
            return BenchmarkRequestResult(
                request_id=request_id,
                success=False,
                status_code=504,
                latency_ms=(t_err - t_start) * 1000.0,
                error=f"İstek zaman aşımına uğradı (Timeout > {self.timeout.total}s). Sunucu aşırı yüklü veya tıkandı."
            )
        except aiohttp.ClientConnectorError as ce:
            t_err = time.perf_counter()
            return BenchmarkRequestResult(
                request_id=request_id,
                success=False,
                status_code=502,
                latency_ms=(t_err - t_start) * 1000.0,
                error=f"Bağlantı hatası: {str(ce)}. Sunucu kapalı veya port erişilemez."
            )
        except Exception as e:
            t_err = time.perf_counter()
            return BenchmarkRequestResult(
                request_id=request_id,
                success=False,
                status_code=500,
                latency_ms=(t_err - t_start) * 1000.0,
                error=f"Beklenmeyen hata: {type(e).__name__} - {str(e)}"
            )
