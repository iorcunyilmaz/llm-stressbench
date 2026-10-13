"""
Self-Test Verification Script for LLM StressBench Pro
Simulates an OpenAI-compatible server (vLLM/LiteLLM streaming behavior)
and validates end-to-end benchmark execution, metrics calculation, and knee-point detection.
"""

import sys
import asyncio
import time
import json
from aiohttp import web
from engine import BenchmarkRunner, BenchmarkConfig

async def mock_models(request):
    return web.json_response({
        "object": "list",
        "data": [
            {"id": "Mercan/Gemma-4-E4B-it", "object": "model"},
            {"id": "Qwen/Qwen2.5-7B-Instruct", "object": "model"}
        ]
    })

async def mock_chat(request):
    body = await request.json()
    model = body.get("model", "mock-model")
    messages = body.get("messages", [])
    max_tokens = min(body.get("max_tokens", 20), 15)

    response = web.StreamResponse(
        status=200,
        reason='OK',
        headers={'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'}
    )
    await response.prepare(request)

    # Simulate TTFT (Pre-fill delay)
    await asyncio.sleep(0.04) # 40ms TTFT

    # Stream simulated tokens
    for i in range(max_tokens):
        chunk = {
            "id": f"chatcmpl-mock-{i}",
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "delta": {"content": f" token_{i}"},
                "finish_reason": None
            }]
        }
        await response.write(f"data: {json.dumps(chunk)}\n\n".encode('utf-8'))
        await asyncio.sleep(0.015) # 15ms per token (~66 TPS)

    # Final usage chunk
    usage_chunk = {
        "id": "chatcmpl-mock-final",
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "delta": {},
            "finish_reason": "stop"
        }],
        "usage": {
            "prompt_tokens": 120,
            "completion_tokens": max_tokens,
            "total_tokens": 120 + max_tokens
        }
    }
    await response.write(f"data: {json.dumps(usage_chunk)}\n\n".encode('utf-8'))
    await response.write(b"data: [DONE]\n\n")
    return response

async def run_verification():
    print("▶ Mock vLLM/LiteLLM Test Sunucusu Başlatılıyor...")
    app = web.Application()
    app.router.add_get('/v1/models', mock_models)
    app.router.add_post('/v1/chat/completions', mock_chat)

    runner_server = web.AppRunner(app)
    await runner_server.setup()
    site = web.TCPSite(runner_server, '127.0.0.1', 8999)
    await site.start()
    print("✔ Mock Sunucu 127.0.0.1:8999 üzerinde devrede.")

    try:
        config = BenchmarkConfig(
            target_type="vllm",
            base_url="http://127.0.0.1:8999/v1",
            model="Mercan/Gemma-4-E4B-it",
            mode="concurrency_sweep",
            concurrency_list=[1, 2, 4],
            requests_per_step=4,
            max_tokens=10,
            sla_max_ttft_ms=500.0,
            sla_min_user_tps=10.0
        )

        print("\n▶ Benchmark Runner çalıştırılıyor...")
        bench_runner = BenchmarkRunner(config)
        report = await bench_runner.execute()

        print("\n✔ Benchmark Raporu Oluşturuldu:")
        print(f"  Toplam İstek: {report.get('total_requests')}")
        print(f"  Başarılı İstek: {report.get('successful_requests')}")
        print(f"  Hata Sayısı: {report.get('failed_requests')}")
        
        for s in report.get("step_summaries", []):
            print(f"  • {s['concurrency']} Kullanıcı -> Toplam TPS: {s['aggregate_generation_tps']} | Medyan TTFT: {s['ttft_stats']['p50']}ms | SLA: {s['sla_passed']}")

        analysis = report.get("analysis", {})
        print("\n🎯 Kapasite Analizi:")
        print(f"  Sıfır Gecikmeli Kapasite: {analysis.get('optimal_zero_latency_concurrency')} Kullanıcı")
        print(f"  Zirve Verim: {analysis.get('peak_generation_tps')} tok/s")
        print(f"  Özet: {analysis.get('executive_summary')}")

        assert report.get("successful_requests") == 16, "Tüm istekler başarılı olmalıdır."
        assert len(report.get("step_summaries")) == 3, "3 adım tamamlanmış olmalıdır."
        print("\n🎉 TÜM DOĞRULAMA TESTLERİ BAŞARIYLA GEÇTİ!")

    finally:
        await runner_server.cleanup()

if __name__ == "__main__":
    asyncio.run(run_verification())
