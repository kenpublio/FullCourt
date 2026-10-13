param([string]$TaskTime = '02:00')
$projectRoot = Split-Path -Parent $PSScriptRoot
$phpPath = (Get-Command php -ErrorAction Stop).Source
$backupScript = Join-Path $projectRoot 'backend\cli\backup_database.php'
$action = New-ScheduledTaskAction -Execute $phpPath -Argument ('"{0}"' -f $backupScript) -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $TaskTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'FullCourt Daily Verified Backup' -Description 'Creates and verifies a daily FullCourt database snapshot; keeps the latest 30 backups.' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Output "FullCourt daily backup scheduled for $TaskTime."
