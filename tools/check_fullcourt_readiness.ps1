param(
    [string]$FrontendUrl = "http://127.0.0.1:5173",
    [string]$ApiUrl = "http://127.0.0.1:8767/api"
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

if ($failed -gt 0) {
    Write-Host "$failed readiness check(s) failed. Fix these before game day." -ForegroundColor Red
    exit 1
}

Write-Host "FullCourt is reachable on all critical public entry points." -ForegroundColor Green
