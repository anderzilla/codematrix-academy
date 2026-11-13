# Cria as tarefas no Agendador do Windows (usuário atual, só quando logado). Horários fora da janela 00:00–06:00.
$raiz = Split-Path $PSScriptRoot -Parent
$ps = "powershell.exe"
$diaria = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\scripts\rotina-diaria.ps1`""
$semanal = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$raiz\scripts\rotina-semanal.ps1`""
Register-ScheduledTask -TaskName "RendaExtra-Sync-Manha" -Action $diaria -Trigger (New-ScheduledTaskTrigger -Daily -At 08:40) -Force | Out-Null
Register-ScheduledTask -TaskName "RendaExtra-Sync-Tarde" -Action $diaria -Trigger (New-ScheduledTaskTrigger -Daily -At 18:40) -Force | Out-Null
Register-ScheduledTask -TaskName "RendaExtra-Analise-Semanal" -Action $semanal -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 07:50) -Force | Out-Null
Write-Host "Tarefas criadas: RendaExtra-Sync-Manha, RendaExtra-Sync-Tarde, RendaExtra-Analise-Semanal"
Write-Host "Para remover: Unregister-ScheduledTask -TaskName RendaExtra-* -Confirm:`$false"
