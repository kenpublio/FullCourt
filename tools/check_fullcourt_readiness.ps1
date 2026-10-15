param(
    [string]$FrontendUrl = "http://127.0.0.1:5173",
    [string]$ApiUrl = "http://127.0.0.1:8767/api",
    [int]$MaximumBackupAgeHours = 168
)

$ErrorActionPreference = "Stop"
$checks = @(
    @{ Name = "Public home"; Url = "$FrontendUrl/" },
    @{ Name = "Game center"; Url = "$FrontendUrl/sports" },
    @{ Name = "Public schedule"; Url = "$FrontendUrl/sports/schedule" },
    @{ Name = "Login"; Url = "$FrontendUrl/login" },
    @{ Name = "API"; Url = "$ApiUrl/health" }
)

$failed = 0
foreach ($check in $checks) {
    try {
        $response = Invoke-WebRequest -Uri $check.Url -UseBasicParsing -TimeoutSec 12
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
            Write-Host "[PASS] $($check.Name) - HTTP $($response.StatusCode)" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] $($check.Name) - HTTP $($response.StatusCode)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "[FAIL] $($check.Name) - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

try {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $sessionsJson = & php (Join-Path $repoRoot "tests\BrowserAuditSession.php")
    $sessions = $sessionsJson | ConvertFrom-Json
    $roles = @($sessions | ForEach-Object { $_.user.role })
    foreach ($requiredRole in @("platform_admin", "coach", "statistician")) {
        if ($roles -contains $requiredRole) {
            Write-Host "[PASS] Demo $requiredRole account is available" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] Demo $requiredRole account is missing or inactive" -ForegroundColor Red
            $failed++
        }
    }
} catch {
    Write-Host "[FAIL] Database or demo account check - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

$backupDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) "output\backups"
$latestBackup = Get-ChildItem -LiteralPath $backupDirectory -Filter "fullcourt-backup-*.json.gz" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $latestBackup) {
    Write-Host "[FAIL] Verified database backup - no backup found" -ForegroundColor Red
    $failed++
} else {
    $backupAgeHours = ((Get-Date) - $latestBackup.LastWriteTime).TotalHours
    if ($backupAgeHours -le $MaximumBackupAgeHours) {
        Write-Host "[PASS] Verified database backup - $($latestBackup.Name)" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Verified database backup is older than $MaximumBackupAgeHours hours" -ForegroundColor Red
        $failed++
    }
}

try {
    & php (Join-Path (Split-Path -Parent $PSScriptRoot) "tests\RouteDefinitionTest.php") | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "route verification returned exit code $LASTEXITCODE" }
    Write-Host "[PASS] Critical API route definitions" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Critical API route definitions - $($_.Exception.Message)" -ForegroundColor Red
    $failed++
}

if ($failed -gt 0) {
    Write-Host "$failed readiness check(s) failed. Fix these before game day." -ForegroundColor Red
    exit 1
}

Write-Host "FullCourt game-day readiness passed: public pages, API, database roles, backup, and critical routes are ready." -ForegroundColor Green
