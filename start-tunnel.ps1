# ─── QR Origin Tracker — Cloudflare Tunnel Launcher ─────────────────────────
# This script:
#   1. Starts a Cloudflare Quick Tunnel for the backend  (port 8080) → HTTPS
#   2. Starts a Cloudflare Quick Tunnel for the frontend (port 4200) → HTTPS
#   3. Patches application-h2.properties with the live public URLs
#      (app.frontend-base-url  → used to embed tracking URLs in QR codes)
#      (app.cors.allowed-origins → whitelists the frontend tunnel for CORS)
#   4. Restarts the Spring Boot backend so new QR codes use the HTTPS URL
#
# Usage     : .\start-tunnel.ps1
# Requirement: cloudflared (winget install Cloudflare.cloudflared)
#
# The trycloudflare.com URLs are *temporary* — they change every run.
# For permanent URLs see: https://developers.cloudflare.com/cloudflare-one/
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir  = Join-Path $scriptDir "backend"
$h2Props     = Join-Path $backendDir "src\main\resources\application-h2.properties"
$javaBin     = Join-Path $env:JAVA_HOME "bin\java.exe"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  QR Origin Tracker - Cloudflare Tunnel" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── Helper: wait for a trycloudflare.com URL to appear in a log file ─────────
function Wait-TunnelUrl {
    param([string]$LogFile, [int]$TimeoutSec = 45)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $LogFile) {
            $content = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
            if ($content -match 'https://[a-z0-9\-]+\.trycloudflare\.com') {
                return $Matches[0]
            }
        }
        Start-Sleep -Milliseconds 500
    }
    return $null
}

# ── Temp log files ─────────────────────────────────────────────────────────────
$backendLog  = Join-Path $env:TEMP "cf-backend.log"
$frontendLog = Join-Path $env:TEMP "cf-frontend.log"
Remove-Item $backendLog, $frontendLog -ErrorAction SilentlyContinue

# ── 1. Backend tunnel (port 8080) ─────────────────────────────────────────────
Write-Host "[1/5] Starting Cloudflare tunnel for backend  (port 8080)..." -ForegroundColor Yellow
$backendTunnel = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel --url http://localhost:8080 --logfile `"$backendLog`"" `
    -PassThru -WindowStyle Hidden

Write-Host "      Waiting for backend public URL..." -ForegroundColor DarkGray
$backendUrl = Wait-TunnelUrl -LogFile $backendLog -TimeoutSec 45
if (-not $backendUrl) {
    Write-Host "ERROR: Could not get backend tunnel URL. Is cloudflared installed?" -ForegroundColor Red
    Stop-Process -Id $backendTunnel.Id -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "      Backend  URL: $backendUrl" -ForegroundColor Green

# ── 2. Frontend tunnel (port 4200) ────────────────────────────────────────────
Write-Host ""
Write-Host "[2/5] Starting Cloudflare tunnel for frontend (port 4200)..." -ForegroundColor Yellow
$frontendTunnel = Start-Process -FilePath "cloudflared" `
    -ArgumentList "tunnel --url http://localhost:4200 --logfile `"$frontendLog`"" `
    -PassThru -WindowStyle Hidden

Write-Host "      Waiting for frontend public URL..." -ForegroundColor DarkGray
$frontendUrl = Wait-TunnelUrl -LogFile $frontendLog -TimeoutSec 45
if (-not $frontendUrl) {
    Write-Host "ERROR: Could not get frontend tunnel URL." -ForegroundColor Red
    Stop-Process -Id $backendTunnel.Id, $frontendTunnel.Id -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "      Frontend URL: $frontendUrl" -ForegroundColor Green

# ── 3. Patch application-h2.properties ────────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Patching application-h2.properties with public URLs..." -ForegroundColor Yellow

$props = Get-Content $h2Props -Raw

# Update (or insert) app.frontend-base-url
if ($props -match 'app\.frontend-base-url=.*') {
    $props = $props -replace 'app\.frontend-base-url=.*', "app.frontend-base-url=$frontendUrl"
} else {
    $props = $props.TrimEnd() + "`napp.frontend-base-url=$frontendUrl`n"
}

# Update (or insert) app.cors.allowed-origins
# Include both the tunnel URL AND localhost so the local Angular dev server
# can still reach the backend via the tunnel when testing locally.
$corsValue = "http://localhost:4200,$frontendUrl"
if ($props -match 'app\.cors\.allowed-origins=.*') {
    $props = $props -replace 'app\.cors\.allowed-origins=.*', "app.cors.allowed-origins=$corsValue"
} else {
    $props = $props.TrimEnd() + "`napp.cors.allowed-origins=$corsValue`n"
}

Set-Content $h2Props $props -NoNewline
Write-Host "      Properties updated." -ForegroundColor Green
Write-Host "        frontend-base-url  = $frontendUrl" -ForegroundColor DarkGray
Write-Host "        cors.allowed-origins = $corsValue" -ForegroundColor DarkGray

# ── 4. Kill any running backend and restart it ────────────────────────────────
Write-Host ""
Write-Host "[4/5] Restarting backend so QR codes use the new HTTPS URL..." -ForegroundColor Yellow

# Kill any java process running on port 8080
$port8080 = netstat -ano | Select-String ":8080 " | Select-String "LISTENING"
if ($port8080) {
    $pid8080 = ($port8080 -split '\s+')[-1]
    Stop-Process -Id $pid8080 -Force -ErrorAction SilentlyContinue
    Write-Host "      Stopped previous backend (PID $pid8080)." -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

# Resolve mvnw.cmd
$mvnw = Join-Path $backendDir "mvnw.cmd"

# Set JAVA_HOME if not already set to something valid
if (-not $env:JAVA_HOME -or -not (Test-Path $javaBin)) {
    $ideJbr = "C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.2\jbr"
    if (Test-Path $ideJbr) { $env:JAVA_HOME = $ideJbr }
}

Write-Host "      Launching Spring Boot with h2 profile..." -ForegroundColor DarkGray
$backendProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c `"$mvnw`" spring-boot:run `"-Dspring-boot.run.profiles=h2`"" `
    -WorkingDirectory $backendDir `
    -PassThru -WindowStyle Normal

Write-Host "      Backend PID: $($backendProcess.Id)" -ForegroundColor DarkGray
Write-Host "      Waiting 20 s for Spring Boot to start..." -ForegroundColor DarkGray
Start-Sleep -Seconds 20
Write-Host "      Backend should be ready." -ForegroundColor Green

# ── 5. Summary ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  TUNNELS ARE LIVE  (HTTPS enabled!)" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend (Angular) : $frontendUrl" -ForegroundColor White
Write-Host "  Backend  (API)     : $backendUrl" -ForegroundColor White
Write-Host ""
Write-Host "  HOW TO USE:" -ForegroundColor Yellow
Write-Host "  1. Open $frontendUrl in your browser" -ForegroundColor White
Write-Host "  2. Log in and go to Batches" -ForegroundColor White
Write-Host "  3. Generate a NEW QR code (old ones point to LAN IP)" -ForegroundColor White
Write-Host "  4. Scan from any phone — any network — it uses HTTPS!" -ForegroundColor White
Write-Host ""
Write-Host "  NOTE: trycloudflare.com URLs are TEMPORARY and change on restart." -ForegroundColor DarkYellow
Write-Host "  For permanent HTTPS: https://developers.cloudflare.com/cloudflare-one/" -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  Press Ctrl+C to stop the tunnels." -ForegroundColor DarkGray
Write-Host ""

# ── Keep running so tunnels stay alive ────────────────────────────────────────
try {
    Wait-Process -Id $backendTunnel.Id, $frontendTunnel.Id
} catch {
    Stop-Process -Id $backendTunnel.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendTunnel.Id -ErrorAction SilentlyContinue
    Write-Host "`nTunnels stopped." -ForegroundColor DarkGray
}
