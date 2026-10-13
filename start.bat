@echo off
setlocal enabledelayedexpansion
title LLM StressBench - by Orcun YILMAZ

echo ========================================================
echo    LLM StressBench - by Orcun YILMAZ
echo    orcunyilmaz.com.tr
echo ========================================================
echo.

cd /d "%~dp0"

:: 1. Python Bulucu (Miniconda / Standart Python)
set "PY_CMD="

if exist "%USERPROFILE%\miniconda3\python.exe" (
    set "PY_CMD=%USERPROFILE%\miniconda3\python.exe"
) else if exist "%USERPROFILE%\Anaconda3\python.exe" (
    set "PY_CMD=%USERPROFILE%\Anaconda3\python.exe"
) else if exist "C:\ProgramData\miniconda3\python.exe" (
    set "PY_CMD=C:\ProgramData\miniconda3\python.exe"
) else (
    where python.exe >nul 2>nul
    if !errorlevel! equ 0 (
        set "PY_CMD=python"
    )
)

if "%PY_CMD%"=="" (
    echo [HATA] Sistemde calisabilir bir Python bulunamadi!
    echo Lutfen Python veya Miniconda kurun.
    pause
    exit /b 1
)

echo Python: %PY_CMD%

:: 2. Bagimlilik Kontrolu
echo Paketler kontrol ediliyor...
"%PY_CMD%" -c "import aiohttp, fastapi, uvicorn, numpy, rich" >nul 2>nul
if %errorlevel% neq 0 (
    echo Eksik paketler tespit edildi, yukleniyor...
    "%PY_CMD%" -m pip install aiohttp fastapi uvicorn numpy rich
)

echo.
echo LLM StressBench Pro baslatiliyor...
echo Tarayici acilacaktir: http://localhost:8765
echo.

"%PY_CMD%" main.py --port 8765
if %errorlevel% neq 0 (
    echo.
    echo [BILGI] Program sonlandi.
    pause
)
