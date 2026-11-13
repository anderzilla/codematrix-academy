# Instala a Fábrica de Ofertas no Windows. Rode na pasta Ferramentas:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python 3.11+ não encontrado no PATH." }
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install --upgrade pip | Out-Null
.\.venv\Scripts\python.exe -m pip install -e ".[mcp,dev,video]"

New-Item -ItemType Directory -Force -Path saidas, data\referencias, logs | Out-Null

Write-Host "`nVídeo (Playwright + Chromium):" -ForegroundColor Cyan
.\.venv\Scripts\python.exe -m pip install playwright pillow
.\.venv\Scripts\python.exe -m playwright install chromium
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host "Instale o FFmpeg: winget install Gyan.FFmpeg" -ForegroundColor Yellow }

$voz = Read-Host "Instalar narração local Kokoro (Apache-2.0, ~1 GB com PyTorch)? [s/N]"
if ($voz -eq "s") { .\.venv\Scripts\python.exe -m pip install "kokoro>=0.9" soundfile; Write-Host "Kokoro baixa o modelo de voz no primeiro uso." }

Write-Host "`nTestes:" -ForegroundColor Cyan
$env:REX_LLM_FAKE = "1"; $env:REX_DB_PATH = "$env:TEMP\rex_teste.db"
.\.venv\Scripts\python.exe -m pytest -q
Remove-Item Env:REX_LLM_FAKE, Env:REX_DB_PATH

Write-Host "`nOllama:" -ForegroundColor Cyan
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  foreach ($m in @("qwen2.5:14b", "llama3.1:8b", "nomic-embed-text")) { ollama pull $m }
} else {
  Write-Host "Ollama não está neste PC. Se ele roda no servidor (anderzilla-rog), ajuste ia_local.host em config\settings.yaml"
  Write-Host "e veja scripts\servidor-ollama.md."
}

.\.venv\Scripts\rex.exe importar data\oportunidades_iniciais.csv
.\.venv\Scripts\rex.exe rag indexar
.\.venv\Scripts\rex.exe sincronizar --modelo setup
Write-Host "`nPróximo passo: .\.venv\Scripts\rex.exe credenciais   e depois   .\.venv\Scripts\rex.exe status" -ForegroundColor Green
