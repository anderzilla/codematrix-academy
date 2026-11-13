# Sync de vendas + decisões. Agendado pelo agendar-tarefas.ps1 (08:40 e 18:40).
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force -Path logs | Out-Null
$log = "logs\rotina-$(Get-Date -Format yyyy-MM-dd).log"
.\.venv\Scripts\rex.exe sync --dias 30 *>> $log
.\.venv\Scripts\rex.exe decidir *>> $log
