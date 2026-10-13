"""
LLM StressBench Pro - Main Web Server & Application
FastAPI server serving the real-time benchmarking dashboard, SSE streams, and REST APIs.
"""

import os
import sys
import json
import asyncio
import webbrowser
from typing import Dict, Any, Optional, List
from pathlib import Path

import aiohttp
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from engine import BenchmarkRunner, BenchmarkConfig

APP_DIR = Path(__file__).resolve().parent
STATIC_DIR = APP_DIR / "static"
RUNS_DIR = APP_DIR / "runs"
RUNS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="LLM StressBench",
    description="by Orçun YILMAZ (orcunyilmaz.com.tr) - OpenAI Compatible Performance & KV Cache Benchmark Suite",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory runner state
active_runner: Optional[BenchmarkRunner] = None
latest_report: Optional[Dict[str, Any]] = None

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return HTMLResponse(content=index_file.read_text(encoding="utf-8"))
    return HTMLResponse("<h2>LLM StressBench Pro UI loading...</h2>")

@app.post("/api/test-connection")
async def test_connection(payload: Dict[str, Any]):
    """Pings the target LLM server to verify reachability and latency."""
    base_url = payload.get("base_url", "").strip()
    api_key = payload.get("api_key", "").strip()

    if not base_url:
        raise HTTPException(status_code=400, detail="Sunucu adresi (base_url) belirtilmelidir.")

    clean_url = base_url.rstrip("/")
    if not clean_url.endswith("/models"):
        if not clean_url.endswith("/v1"):
            clean_url = clean_url + "/v1"
        clean_url = clean_url + "/models"

    headers = {}
    if api_key:
        auth_val = api_key if api_key.lower().startswith("bearer ") else f"Bearer {api_key}"
        headers["Authorization"] = auth_val

    t0 = asyncio.get_event_loop().time()
    try:
        timeout = aiohttp.ClientTimeout(total=8.0)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(clean_url, headers=headers) as resp:
                t1 = asyncio.get_event_loop().time()
                ping_ms = round((t1 - t0) * 1000.0, 1)
                if resp.status == 200:
                    data = await resp.json()
                    models = [m.get("id") for m in data.get("data", []) if "id" in m]
                    return {
                        "status": "online",
                        "status_code": 200,
                        "ping_ms": ping_ms,
                        "endpoint": clean_url,
                        "models": models,
                        "message": f"Bağlantı başarılı! {len(models)} model algılandı."
                    }
                else:
                    text = await resp.text()
                    return {
                        "status": "warning",
                        "status_code": resp.status,
                        "ping_ms": ping_ms,
                        "endpoint": clean_url,
                        "models": [],
                        "message": f"Sunucu HTTP {resp.status} döndürdü: {text[:200]}"
                    }
    except Exception as e:
        return {
            "status": "error",
            "status_code": 0,
            "ping_ms": 0,
            "endpoint": clean_url,
            "models": [],
            "message": f"Bağlantı kurulamadı: {str(e)}"
        }

@app.post("/api/fetch-models")
async def fetch_models(payload: Dict[str, Any]):
    """Fetches available model names from target OpenAI compatible endpoint."""
    res = await test_connection(payload)
    return res

@app.post("/api/start-benchmark")
async def start_benchmark(config: BenchmarkConfig, background_tasks: BackgroundTasks):
    global active_runner
    if active_runner and active_runner.is_running:
        raise HTTPException(status_code=409, detail="Zaten çalışan aktif bir test var. Önce mevcut testi durdurun.")

    runner = BenchmarkRunner(config)
    active_runner = runner

    async def run_task():
        global latest_report
        try:
            report = await runner.execute()
            latest_report = report
            # Save to disk
            save_path = RUNS_DIR / f"run_{runner.run_id}.json"
            save_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            await runner.emit_event("error", {"message": str(e)})

    background_tasks.add_task(run_task)
    return {"status": "started", "run_id": runner.run_id}

@app.post("/api/stop-benchmark")
async def stop_benchmark():
    global active_runner
    if active_runner and active_runner.is_running:
        active_runner.request_stop()
        return {"status": "stopping", "message": "Test durdurma sinyali gönderildi."}
    return {"status": "idle", "message": "Çalışan aktif test yok."}

@app.get("/api/status")
async def get_status():
    global active_runner, latest_report
    return {
        "is_running": active_runner.is_running if active_runner else False,
        "run_id": active_runner.run_id if active_runner else None,
        "has_report": latest_report is not None
    }

@app.get("/api/stream-events")
async def stream_events(request: Request):
    """Server-Sent Events endpoint streaming real-time benchmark metrics to the UI."""
    global active_runner

    async def event_generator():
        runner = active_runner
        if not runner:
            yield "data: {\"type\": \"idle\"}\n\n"
            return

        while True:
            if await request.is_disconnected():
                break

            try:
                # Wait for next event with a heartbeat timeout
                event = await asyncio.wait_for(runner.event_queue.get(), timeout=2.0)
                json_str = json.dumps(event, ensure_ascii=False)
                yield f"data: {json_str}\n\n"

                if event.get("type") in ("benchmark_completed", "error"):
                    break
            except asyncio.TimeoutError:
                # Send SSE keepalive ping
                yield ": keepalive\n\n"
            except Exception:
                break

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.get("/api/history")
async def get_history():
    """Lists saved past benchmark reports."""
    runs = []
    for f in sorted(RUNS_DIR.glob("run_*.json"), key=os.path.getmtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            runs.append({
                "run_id": data.get("run_id"),
                "status": data.get("status"),
                "duration_sec": data.get("total_duration_sec"),
                "total_requests": data.get("total_requests"),
                "successful_requests": data.get("successful_requests"),
                "target_type": data.get("config", {}).get("target_type"),
                "model": data.get("config", {}).get("model"),
                "base_url": data.get("config", {}).get("base_url"),
                "mode": data.get("config", {}).get("mode"),
                "timestamp": os.path.getmtime(f)
            })
        except Exception:
            continue
    return runs

@app.get("/api/report/{run_id}")
async def get_report(run_id: str):
    file_path = RUNS_DIR / f"run_{run_id}.json"
    if not file_path.exists():
        global latest_report
        if latest_report and latest_report.get("run_id") == run_id:
            return latest_report
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")
    return json.loads(file_path.read_text(encoding="utf-8"))

@app.get("/api/export/{run_id}")
async def export_report(run_id: str, format: str = Query("json", enum=["json", "csv"])):
    file_path = RUNS_DIR / f"run_{run_id}.json"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Rapor bulunamadı.")

    data = json.loads(file_path.read_text(encoding="utf-8"))

    if format == "json":
        return JSONResponse(
            content=data,
            headers={"Content-Disposition": f"attachment; filename=stressbench_{run_id}.json"}
        )

    # Format as CSV
    lines = ["concurrency,total_requests,successful,failed,error_rate_pct,rps,agg_gen_tps,p50_ttft_ms,p95_ttft_ms,p50_latency_ms,p95_latency_ms,p50_tpot_ms,sla_passed"]
    for s in data.get("step_summaries", []):
        lines.append(
            f"{s['concurrency']},{s['total_requests']},{s['successful_requests']},{s['failed_requests']},"
            f"{s['error_rate_pct']},{s['rps']},{s['aggregate_generation_tps']},"
            f"{s['ttft_stats'].get('p50',0)},{s['ttft_stats'].get('p95',0)},"
            f"{s['latency_stats'].get('p50',0)},{s['latency_stats'].get('p95',0)},"
            f"{s['tpot_stats'].get('p50',0)},{s.get('sla_passed', True)}"
        )

    return PlainTextResponse(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=stressbench_{run_id}.csv"}
    )

# Static files mount
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

def start():
    import argparse
    parser = argparse.ArgumentParser(description="LLM StressBench Pro Server")
    parser.add_argument("--host", default="0.0.0.0", help="Host bind address (Default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8765, help="Port to listen on (Default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically launch web browser")
    args = parser.parse_args()

    local_url = f"http://localhost:{args.port}"
    print("=" * 65)
    print(" 🚀 LLM StressBench - by Orçun YILMAZ")
    print(" 🌐 orcunyilmaz.com.tr")
    print(f" 🌐 Dashboard: {local_url}")
    print(f" 📡 Local IP bind: {args.host}:{args.port}")
    print("=" * 65)

    if not args.no_browser:
        def open_browser():
            import time
            time.sleep(1.2)
            webbrowser.open(local_url)
        import threading
        threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")

if __name__ == "__main__":
    start()
