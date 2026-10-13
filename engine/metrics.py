"""
LLM StressBench Pro - Statistical Analysis & Knee-Point Capacity Engine
Calculates percentiles, throughput, error rates, and automated capacity analysis.
"""

from typing import List, Dict, Any, Optional
import numpy as np
from .client import BenchmarkRequestResult

def calculate_percentiles(values: List[float]) -> Dict[str, float]:
    """Calculates min, avg, p50, p75, p90, p95, p99, max, std from a list of floats."""
    if not values:
        return {
            "min": 0.0,
            "avg": 0.0,
            "p50": 0.0,
            "p75": 0.0,
            "p90": 0.0,
            "p95": 0.0,
            "p99": 0.0,
            "max": 0.0,
            "std": 0.0
        }
    arr = np.array(values, dtype=float)
    return {
        "min": round(float(np.min(arr)), 2),
        "avg": round(float(np.mean(arr)), 2),
        "p50": round(float(np.percentile(arr, 50)), 2),
        "p75": round(float(np.percentile(arr, 75)), 2),
        "p90": round(float(np.percentile(arr, 90)), 2),
        "p95": round(float(np.percentile(arr, 95)), 2),
        "p99": round(float(np.percentile(arr, 99)), 2),
        "max": round(float(np.max(arr)), 2),
        "std": round(float(np.std(arr)), 2)
    }

class StepMetricsSummary:
    def __init__(
        self,
        concurrency: int,
        total_requests: int,
        successful_requests: int,
        failed_requests: int,
        error_rate_pct: float,
        wall_time_sec: float,
        rps: float,
        aggregate_generation_tps: float,
        aggregate_total_tps: float,
        total_prompt_tokens: int,
        total_completion_tokens: int,
        ttft_stats: Dict[str, float],
        latency_stats: Dict[str, float],
        tpot_stats: Dict[str, float],
        user_tps_stats: Dict[str, float],
        error_breakdown: Dict[str, int],
        sla_passed: bool = True,
        sla_reason: str = "SLA standartları karşılandı."
    ):
        self.concurrency = concurrency
        self.total_requests = total_requests
        self.successful_requests = successful_requests
        self.failed_requests = failed_requests
        self.error_rate_pct = round(error_rate_pct, 2)
        self.wall_time_sec = round(wall_time_sec, 2)
        self.rps = round(rps, 2)
        self.aggregate_generation_tps = round(aggregate_generation_tps, 2)
        self.aggregate_total_tps = round(aggregate_total_tps, 2)
        self.total_prompt_tokens = total_prompt_tokens
        self.total_completion_tokens = total_completion_tokens
        self.ttft_stats = ttft_stats
        self.latency_stats = latency_stats
        self.tpot_stats = tpot_stats
        self.user_tps_stats = user_tps_stats
        self.error_breakdown = error_breakdown
        self.sla_passed = sla_passed
        self.sla_reason = sla_reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "concurrency": self.concurrency,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "error_rate_pct": self.error_rate_pct,
            "wall_time_sec": self.wall_time_sec,
            "rps": self.rps,
            "aggregate_generation_tps": self.aggregate_generation_tps,
            "aggregate_total_tps": self.aggregate_total_tps,
            "total_prompt_tokens": self.total_prompt_tokens,
            "total_completion_tokens": self.total_completion_tokens,
            "ttft_stats": self.ttft_stats,
            "latency_stats": self.latency_stats,
            "tpot_stats": self.tpot_stats,
            "user_tps_stats": self.user_tps_stats,
            "error_breakdown": self.error_breakdown,
            "sla_passed": self.sla_passed,
            "sla_reason": self.sla_reason
        }

class MetricsCalculator:
    @staticmethod
    def aggregate_step_results(
        concurrency: int,
        results: List[BenchmarkRequestResult],
        wall_time_sec: float,
        sla_max_ttft_ms: float = 800.0,
        sla_min_user_tps: float = 15.0
    ) -> StepMetricsSummary:
        """Aggregates a batch of BenchmarkRequestResult objects into structured statistics."""
        total_reqs = len(results)
        successful = [r for r in results if r.success]
        failed = [r for r in results if not r.success]

        success_count = len(successful)
        failed_count = len(failed)
        error_rate = (failed_count / total_reqs * 100.0) if total_reqs > 0 else 0.0

        # Error breakdown
        error_breakdown: Dict[str, int] = {}
        for f in failed:
            key = f"HTTP {f.status_code}" if f.status_code else "Bilinmeyen Hata"
            error_breakdown[key] = error_breakdown.get(key, 0) + 1

        ttft_values = [r.ttft_ms for r in successful]
        latency_values = [r.latency_ms for r in successful]
        tpot_values = [r.tpot_ms for r in successful if r.tpot_ms > 0]
        user_tps_values = [r.generation_tps for r in successful if r.generation_tps > 0]

        total_prompt_tokens = sum([r.prompt_tokens for r in successful])
        total_completion_tokens = sum([r.completion_tokens for r in successful])

        safe_wall_time = max(wall_time_sec, 0.001)
        rps = success_count / safe_wall_time
        agg_gen_tps = total_completion_tokens / safe_wall_time
        agg_total_tps = (total_prompt_tokens + total_completion_tokens) / safe_wall_time

        ttft_stats = calculate_percentiles(ttft_values)
        latency_stats = calculate_percentiles(latency_values)
        tpot_stats = calculate_percentiles(tpot_values)
        user_tps_stats = calculate_percentiles(user_tps_values)

        # SLA verification:
        sla_passed = True
        reasons = []

        if error_rate > 1.0:
            sla_passed = False
            reasons.append(f"Hata oranı %{error_rate:.1f} (kabul edilebilir sınır %1)")

        if ttft_stats["p90"] > sla_max_ttft_ms:
            sla_passed = False
            reasons.append(f"p90 TTFT ({ttft_stats['p90']} ms) SLA sınırını ({sla_max_ttft_ms} ms) aştı")

        if user_tps_stats["p50"] < sla_min_user_tps and user_tps_stats["p50"] > 0:
            sla_passed = False
            reasons.append(f"Kullanıcı başı akıcılık hızı ({user_tps_stats['p50']} TPS) minimum eşiğin ({sla_min_user_tps} TPS) altına düştü")

        sla_reason = " | ".join(reasons) if reasons else "Tüm SLA parametreleri (Gecikmesiz ve Akıcı) sağlandı."

        return StepMetricsSummary(
            concurrency=concurrency,
            total_requests=total_reqs,
            successful_requests=success_count,
            failed_requests=failed_count,
            error_rate_pct=error_rate,
            wall_time_sec=safe_wall_time,
            rps=rps,
            aggregate_generation_tps=agg_gen_tps,
            aggregate_total_tps=agg_total_tps,
            total_prompt_tokens=total_prompt_tokens,
            total_completion_tokens=total_completion_tokens,
            ttft_stats=ttft_stats,
            latency_stats=latency_stats,
            tpot_stats=tpot_stats,
            user_tps_stats=user_tps_stats,
            error_breakdown=error_breakdown,
            sla_passed=sla_passed,
            sla_reason=sla_reason
        )

    @staticmethod
    def analyze_concurrency_knee_point(steps: List[StepMetricsSummary]) -> Dict[str, Any]:
        """
        Analyzes the capacity curve to answer the user's specific questions:
        - "Aynı anda kaç kişiye gecikmesiz hizmet verebiliyor?" (Optimal Concurrency Capacity)
        - "KV Cache ve GPU ne zaman doyuma ulaşıyor?" (Saturation Knee-Point)
        - "Hangi eşikten sonra kuyruklanma ve gecikme patlaması başlıyor?"
        """
        if not steps:
            return {"status": "Yetersiz veri"}

        sorted_steps = sorted(steps, key=lambda s: s.concurrency)
        
        # 1. Optimal Zero-Latency Capacity (SLA compliant highest concurrency)
        optimal_concurrency = sorted_steps[0].concurrency
        for step in sorted_steps:
            if step.sla_passed and step.error_rate_pct == 0.0:
                optimal_concurrency = step.concurrency
            else:
                break

        # 2. Peak Aggregate Throughput Concurrency
        peak_step = max(sorted_steps, key=lambda s: s.aggregate_generation_tps)
        peak_concurrency = peak_step.concurrency
        peak_tps = peak_step.aggregate_generation_tps

        # 3. Saturation Knee Point (where TTFT increases dramatically)
        baseline_ttft = sorted_steps[0].ttft_stats.get("p50", 100.0)
        knee_point_concurrency = sorted_steps[-1].concurrency
        bottleneck_type = "Normal / Dengeli"

        for i, step in enumerate(sorted_steps):
            p50_ttft = step.ttft_stats.get("p50", 0.0)
            # If TTFT increases more than 3x baseline or error rate > 5%
            if (p50_ttft > max(baseline_ttft * 3.0, 1500.0)) or step.error_rate_pct > 5.0:
                knee_point_concurrency = step.concurrency
                if step.error_rate_pct > 5.0:
                    bottleneck_type = "Sunucu Aşırı Yükü / Bellek Yetersizliği (HTTP 503 / 429 Hataları)"
                else:
                    bottleneck_type = "KV Cache Kuyruklanması (Prefill & Batching Kuyruk Şişmesi)"
                break
        else:
            if peak_concurrency < sorted_steps[-1].concurrency:
                bottleneck_type = "GPU Decode Bellek Bant Genişliği Doyumu"
            else:
                bottleneck_type = "Kapasite Sınırına Ulaşılmadı (Sunucu Daha Fazla Yük Kaldırabilir)"

        # Generate Turkish executive summary
        summary_text = (
            f"🎯 **Gecikmesiz Hizmet Kapasitesi:** Sunucunuz **{optimal_concurrency} eşzamanlı kullanıcıya** "
            f"kadar hiçbir hissedilir gecikme veya kuyruklanma olmadan (SLA sınırları içinde) akıcı hizmet verebilmektedir.\n"
            f"🚀 **Maksimum Sistem Verimi (Peak Throughput):** En yüksek toplam token üretimi "
            f"**{peak_concurrency} eşzamanlı kullanıcıda {peak_tps} tokens/sn** olarak ölçülmüştür.\n"
            f"⚠️ **Doygunluk Kırılım Noktası (Knee-Point):** **{knee_point_concurrency} kullanıcı** "
            f"seviyesinde {bottleneck_type} nedeniyle gecikmeler eksponansiyel olarak artışa geçmektedir."
        )

        return {
            "optimal_zero_latency_concurrency": optimal_concurrency,
            "peak_throughput_concurrency": peak_concurrency,
            "peak_generation_tps": peak_tps,
            "saturation_knee_point": knee_point_concurrency,
            "bottleneck_diagnosis": bottleneck_type,
            "executive_summary": summary_text
        }
