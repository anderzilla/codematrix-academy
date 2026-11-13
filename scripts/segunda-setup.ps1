# Preparação de segunda (16/11): instala, testa e deixa tudo verde. Rode na pasta do repositório.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host "== Git e LFS ==" -ForegroundColor Cyan
git lfs install
git pull
Write-Host "== Instalação ==" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
$rex = ".\.venv\Scripts\rex.exe"
Write-Host "== Status ==" -ForegroundColor Cyan
& $rex status
& $rex video status
Write-Host "== Sprints ==" -ForegroundColor Cyan
& $rex sprint listar
Write-Host "== Teste de vídeo (aula 1 do Pocket, prévia de 3 quadros) ==" -ForegroundColor Cyan
& $rex video previa cursos\financas-familia\pocket\cenas\aula-01.json
Write-Host "Abra cursos\financas-familia\pocket\videos\aula-01-16x9\quadros e confira os quadros." -ForegroundColor Green
Write-Host "== Hoje ==" -ForegroundColor Cyan
& $rex sprint hoje
