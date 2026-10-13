"""
LLM StressBench Pro - Command Line Interface (CLI)
Allows headless terminal execution on Linux/Windows with rich formatting, tables, and live logs.
"""

import sys
import asyncio
import argparse
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn

from engine import BenchmarkRunner, BenchmarkConfig, LLMBenchmarkClient

console = Console()

async def run_cli(args):
    console.print(Panel.fit(
        "[bold cyan]LLM StressBench[/bold cyan] - [bold green]by Orçun YILMAZ[/bold green] ([underline blue]https://orcunyilmaz.com.tr[/underline blue])\n"
        f"Hedef: [green]{args.url}[/green] | Model: [bold white]{args.model}[/bold white] | Mod: [magenta]{args.mode}[/magenta]",
        border_style="cyan"
    ))

    # Test connectivity first
    console.print("[dim]Sunucu bağlantısı ve modeller sorgulanıyor...[/dim]")
    client = LLMBenchmarkClient(base_url=args.url, api_key=args.api_key)
    try:
        session = await client.get_session()
        models_url = args.url.rstrip("/")
        if not models_url.endswith("/models"):
            if not models_url.endswith("/v1"):
                models_url += "/v1"
            models_url += "/models"
        
        headers = {}
        if args.api_key:
            headers["Authorization"] = f"Bearer {args.api_key}"

        async with session.get(models_url, headers=headers, timeout=5) as r:
            if r.status == 200:
                data = await r.json()
                models = [m.get("id") for m in data.get("data", []) if "id" in m]
                console.print(f"[bold green]✔ Bağlantı kuruldu![/bold green] Sunucudaki modeller: {', '.join(models[:4])}")
                if args.model == "auto" and models:
                    args.model = models[0]
                    console.print(f"[yellow]Otomatik model seçildi:[/yellow] [bold]{args.model}[/bold]")
            else:
                console.print(f"[yellow]Uyarı: /models uç noktası HTTP {r.status} döndürdü. Belirtilen model adı kullanılacak.[/yellow]")
    except Exception as e:
        console.print(f"[bold red]Hata: Sunucuya erişilemedi ({e}). Devam ediliyor...[/bold red]")
    finally:
        await client.close()

    # Parse concurrency list
    concurrency_list = [int(x.strip()) for x in args.concurrency.split(",") if x.strip()]
    context_lengths = [int(x.strip()) for x in args.contexts.split(",") if x.strip()]

    config = BenchmarkConfig(
        target_type=args.target_type,
        base_url=args.url,
        api_key=args.api_key,
        model=args.model,
        mode=args.mode,
        concurrency_list=concurrency_list,
        requests_per_step=args.requests,
        context_lengths=context_lengths,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
        token_length=args.token_length,
        prefix_caching=args.prefix_cache,
        sla_max_ttft_ms=args.max_ttft,
        sla_min_user_tps=args.min_tps
    )

    runner = BenchmarkRunner(config)

    # Listen to events and display rich progress
    async def event_consumer():
        while True:
            event = await runner.event_queue.get()
            e_type = event.get("type")
            data = event.get("data", {})

            if e_type == "step_started":
                console.print(f"\n[bold yellow]▶ Adım Başlatıldı:[/bold yellow] [bold]{data.get('step_label')}[/bold] (Eşzamanlılık: {data.get('concurrency')}, İstek: {data.get('total_requests')})")
            elif e_type == "request_completed":
                r = data.get("request", {})
                prog = data.get("progress", {})
                if r.get("success"):
                    console.print(
                        f"  [green]✔[/green] {r.get('request_id')} | "
                        f"TTFT: [cyan]{r.get('ttft_ms')}ms[/cyan] | "
                        f"Kullanıcı TPS: [bold]{r.get('generation_tps')}[/bold] tok/s | "
                        f"Token: {r.get('completion_tokens')} | "
                        f"Gecikme: {r.get('latency_ms')}ms "
                        f"([dim]{prog.get('completed')}/{prog.get('total')}[/dim])"
                    )
                else:
                    console.print(f"  [bold red]✘[/bold red] {r.get('request_id')} | HATA: {r.get('error')}")
            elif e_type == "step_completed":
                s = data.get("summary", {})
                console.print(
                    f"  [bold cyan]Adım Özeti:[/bold cyan] Toplam TPS: [bold green]{s.get('aggregate_generation_tps')}[/bold green] tok/s | "
                    f"Medyan TTFT: [yellow]{s.get('ttft_stats',{}).get('p50')}ms[/yellow] | "
                    f"p95 Gecikme: [yellow]{s.get('latency_stats',{}).get('p95')}ms[/yellow] | "
                    f"Hata Oranı: %{s.get('error_rate_pct')} | "
                    f"SLA: {'[green]GEÇTİ[/green]' if s.get('sla_passed') else '[red]BAŞARISIZ[/red]'}"
                )
            elif e_type in ("benchmark_completed", "error"):
                break

    consumer_task = asyncio.create_task(event_consumer())
    report = await runner.execute()
    await consumer_task

    # Print Final Summary Table
    console.print("\n")
    table = Table(title="[bold green]LLM StressBench Pro - Sonuç Tablosu[/bold green]", show_header=True, header_style="bold magenta")
    table.add_column("Eşzamanlılık", justify="center")
    table.add_column("İstek (Başarılı/Hata)", justify="center")
    table.add_column("Toplam TPS (Verim)", justify="right")
    table.add_column("Kullanıcı TPS", justify="right")
    table.add_column("TTFT p50 (ms)", justify="right")
    table.add_column("TTFT p95 (ms)", justify="right")
    table.add_column("Gecikme p95 (ms)", justify="right")
    table.add_column("SLA Durumu", justify="center")

    for s in report.get("step_summaries", []):
        sla_badge = "[green]✔ UYGUN[/green]" if s.get("sla_passed") else "[red]✘ AŞILDI[/red]"
        table.add_row(
            str(s.get("concurrency")),
            f"{s.get('successful_requests')}/{s.get('failed_requests')}",
            f"{s.get('aggregate_generation_tps'):.1f} tok/s",
            f"{s.get('user_tps_stats',{}).get('p50',0):.1f} tok/s",
            f"{s.get('ttft_stats',{}).get('p50',0):.1f}",
            f"{s.get('ttft_stats',{}).get('p95',0):.1f}",
            f"{s.get('latency_stats',{}).get('p95',0):.1f}",
            sla_badge
        )

    console.print(table)

    # Print Knee-Point Analysis
    analysis = report.get("analysis", {})
    console.print("\n" + Panel.fit(
        f"[bold white]{analysis.get('executive_summary', '')}[/bold white]\n\n"
        f"• Darboğaz Tipi: [bold yellow]{analysis.get('bottleneck_diagnosis')}[/bold yellow]\n"
        f"• Sıfır Gecikmeli Kapasite: [bold green]{analysis.get('optimal_zero_latency_concurrency')} Eşzamanlı Kullanıcı[/bold green]\n"
        f"• Zirve GPU Verimi (Peak TPS): [bold cyan]{analysis.get('peak_generation_tps')} tok/s ({analysis.get('peak_throughput_concurrency')} kullanıcıda)[/bold cyan]",
        title="[bold yellow]🎯 Kapasite & Doygunluk Analizi[/bold yellow]",
        border_style="yellow"
    ))

def main():
    parser = argparse.ArgumentParser(description="LLM StressBench Pro CLI")
    parser.add_argument("--url", default="http://localhost:8000/v1", help="OpenAI Base URL (Default: http://localhost:8000/v1)")
    parser.add_argument("--api-key", default="", help="API Key (optional)")
    parser.add_argument("--model", default="auto", help="Model name (Default: auto-detected)")
    parser.add_argument("--target-type", default="vllm", choices=["vllm", "litellm", "custom"])
    parser.add_argument("--mode", default="concurrency_sweep", choices=["quick", "concurrency_sweep", "kv_cache_stress", "prefix_cache_test"])
    parser.add_argument("--concurrency", default="1,2,4,8,16,32", help="Comma-separated concurrency steps")
    parser.add_argument("--requests", type=int, default=10, help="Requests per step")
    parser.add_argument("--contexts", default="512,1024,2048,4096,8192", help="Context lengths for KV test")
    parser.add_argument("--max-tokens", type=int, default=256, help="Max output tokens to generate")
    parser.add_argument("--temperature", type=float, default=0.7)
    parser.add_argument("--token-length", type=int, default=256)
    parser.add_argument("--prefix-cache", action="store_true", help="Enable shared prefix caching test")
    parser.add_argument("--max-ttft", type=float, default=800.0, help="SLA Max acceptable TTFT (ms)")
    parser.add_argument("--min-tps", type=float, default=15.0, help="SLA Min acceptable user TPS")
    
    args = parser.parse_args()
    asyncio.run(run_cli(args))

if __name__ == "__main__":
    main()
