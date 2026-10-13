# LLM StressBench - by Orçun YILMAZ
$Host.UI.RawUI.WindowTitle = "LLM StressBench - by Orçun YILMAZ"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   LLM StressBench - by Orçun YILMAZ" -ForegroundColor Yellow
Write-Host "   https://orcunyilmaz.com.tr" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan

Set-Location $PSScriptRoot

# 1. Find Python
$pythonPath = ""
$miniconda = Join-Path $env:USERPROFILE "miniconda3\python.exe"
$anaconda = Join-Path $env:USERPROFILE "Anaconda3\python.exe"

if (Test-Path $miniconda) {
    $pythonPath = $miniconda
} elseif (Test-Path $anaconda) {
    $pythonPath = $anaconda
} else {
    $cmd = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $pythonPath = $cmd.Source
    }
}

if (-not $pythonPath) {
    Write-Host "[HATA] Sistemde Python bulunamadı!" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Python: $pythonPath" -ForegroundColor Green

# 2. Check dependencies
try {
    & $pythonPath -c "import aiohttp, fastapi, uvicorn, numpy, rich" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Gerekli paketler yükleniyor..." -ForegroundColor Yellow
        & $pythonPath -m pip install aiohttp fastapi uvicorn numpy rich
    }
} catch {
    Write-Host "Paket kontrolü atlandı." -ForegroundColor Gray
}

Write-Host "`nWeb Arayüzü Başlatılıyor: http://localhost:8765" -ForegroundColor Cyan
& $pythonPath main.py --port 8765
