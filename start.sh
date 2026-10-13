#!/bin/bash
# LLM StressBench Pro - Linux Launcher Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo " 🚀 LLM StressBench Pro - vLLM & LiteLLM Benchmark Suite"
echo "========================================================"

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo "Hata: python3 bulunamadı. Lütfen Python kurun."
    exit 1
fi

# Run Web UI or pass arguments
python3 main.py "$@"
