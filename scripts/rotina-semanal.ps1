# Análise semanal (segunda 07:50). Gera saidas\relatorios\AAAA-MM-DD-semanal.md
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force -Path logs | Out-Null
.\.venv\Scripts\rex.exe sync --dias 60 *>> "logs\semanal.log"
.\.venv\Scripts\rex.exe analise --semanal *>> "logs\semanal.log"
