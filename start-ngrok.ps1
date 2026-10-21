# ─── QR Origin Tracker — ngrok Static Tunnel Launcher ───────────────────────
# Uses ngrok's FREE static domain so QR codes always point to the same HTTPS URL.
#
# FIRST-TIME SETUP (do this once):
#   1. Sign up free at https://dashboard.ngrok.com
#   2. Copy your authtoken from the dashboard
#   3. Run: ngrok config add-authtoken <YOUR_TOKEN>
#   4. Go to Domains → "New Domain" → copy the free static domain you get
#   5. Set $FrontendDomain below to your static domain (no https://)
#
# USAGE (every session):
#   .\start-ngrok.ps1
#
# Requirements: ngrok (winget install ngrok.ngrok)
# ─────────────────────────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════════
#  CONFIGURE THIS — paste your ngrok free static domain below
#  Example: "cute-fox-abc123.ngrok-free.app"
# ══════════════════════════════════════════════════════════════
$FrontendDomain = "scrutiny-engaging-water.ngrok-free.app"
# ══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"
$h2Props    = Join-Path $backendDir "src\main\resources\application-h2.properties"

# ── Validate configuration ────────────────────────────────────────────────────
if ($FrontendDomain -eq "YOUR-STATIC-DOMAIN.ngrok-free.app") {
    Write-Host ""
    Write-Host "  ERROR: You haven't set your ngrok static domain yet!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  SETUP (one time):" -ForegroundColor Yellow
    Write-Host "  1. Sign up free at https://dashboard.ngrok.com" -ForegroundColor White
    Write-Host "  2. Copy your authtoken and run:" -ForegroundColor White
    Write-Host "       ngrok config add-authtoken <YOUR_TOKEN>" -ForegroundColor Cyan
    Write-Host "  3. Go to Domains -> New Domain -> copy the free static domain" -ForegroundColor White
    Write-Host "  4. Open start-ngrok.ps1 and set `$FrontendDomain to that domain" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Ensure the domain doesn't have a trailing slash or https://
$FrontendDomain = $FrontendDomain.TrimEnd('/') -replace '^https?://', ''
$FrontendUrl    = "https://$FrontendDomain"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  QR Origin Tracker - ngrok Static Tunnel" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Static frontend URL: $FrontendUrl" -ForegroundColor Green
Write-Host ""

# ── Helper: wait for ngrok API to confirm the tunnel is up ───────────────────
function Wait-NgrokReady {
    param([int]$TimeoutSec = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction SilentlyContinue
            if ($tunnels.tunnels.Count -gt 0) {
                return $true
            }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# ── 1. Start Angular frontend (port 4200) ────────────────────────────────────
Write-Host "[1/5] Starting Angular dev server (port 4200)..." -ForegroundColor Yellow

$frontendDir = Join-Path $scriptDir "frontend"

# Check if already running
$port4200 = netstat -ano | Select-String ":4200 " | Select-String "LISTENING"
if ($port4200) {
    Write-Host "      Angular already running on port 4200." -ForegroundColor DarkGray
} else {
    $ngFrontend = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm start" `
        -WorkingDirectory $frontendDir `
        -PassThru -WindowStyle Normal
    Write-Host "      Angular starting (PID $($ngFrontend.Id))..." -ForegroundColor DarkGray
    Write-Host "      Waiting 20s for Angular to compile..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 20
    Write-Host "      Angular should be ready on port 4200." -ForegroundColor Green
}

# ── 2. Start ngrok for frontend (port 4200, static domain) ───────────────────
Write-Host ""
Write-Host "[2/5] Starting ngrok tunnel for frontend (port 4200)..." -ForegroundColor Yellow

# Kill any existing ngrok
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

$ngrokProcess = Start-Process -FilePath "ngrok" `
    -ArgumentList "http", "--domain=$FrontendDomain", "4200" `
    -PassThru -WindowStyle Hidden

Write-Host "      Waiting for ngrok to connect..." -ForegroundColor DarkGray
$ready = Wait-NgrokReady -TimeoutSec 30
if (-not $ready) {
    Write-Host "ERROR: ngrok didn't start." -ForegroundColor Red
    Write-Host "  - Make sure your authtoken is set: ngrok config add-authtoken <TOKEN>" -ForegroundColor Yellow
    Write-Host "  - Check ngrok dashboard: http://localhost:4040" -ForegroundColor Yellow
    Stop-Process -Id $ngrokProcess.Id -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "      Frontend tunnel: $FrontendUrl" -ForegroundColor Green

# ── 3. Patch application-h2.properties ───────────────────────────────────────
Write-Host ""
Write-Host "[3/5] Patching Spring Boot config with permanent URL..." -ForegroundColor Yellow

$props = Get-Content $h2Props -Raw

# app.frontend-base-url (used to build the tracking URL baked into QR codes)
if ($props -match 'app\.frontend-base-url=.*') {
    $props = $props -replace 'app\.frontend-base-url=.*', "app.frontend-base-url=$FrontendUrl"
} else {
    $props = $props.TrimEnd() + "`napp.frontend-base-url=$FrontendUrl`n"
}

# app.cors.allowed-origins (keep localhost for local browser dev + add tunnel)
$corsValue = "http://localhost:4200,$FrontendUrl"
if ($props -match 'app\.cors\.allowed-origins=.*') {
    $props = $props -replace 'app\.cors\.allowed-origins=.*', "app.cors.allowed-origins=$corsValue"
} else {
    $props = $props.TrimEnd() + "`napp.cors.allowed-origins=$corsValue`n"
}

Set-Content $h2Props $props -NoNewline
Write-Host "      frontend-base-url  = $FrontendUrl" -ForegroundColor DarkGray
Write-Host "      cors.allowed-origins = $corsValue" -ForegroundColor DarkGray
Write-Host "      Config updated." -ForegroundColor Green

# ── 4. Kill old backend and restart it with the new config ────────────────────
Write-Host ""
Write-Host "[4/5] Restarting Spring Boot backend..." -ForegroundColor Yellow

# Gracefully kill whatever is running on port 8080
$port8080 = netstat -ano | Select-String ":8080 " | Select-String "LISTENING"
if ($port8080) {
    $pid8080 = ($port8080 -split '\s+')[-1]
    Stop-Process -Id $pid8080 -Force -ErrorAction SilentlyContinue
    Write-Host "      Stopped old backend (PID $pid8080)." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
}

# Set JAVA_HOME if not already valid
$javaBin = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME "bin\java.exe" } else { "" }
if (-not $env:JAVA_HOME -or -not (Test-Path $javaBin)) {
    $ideJbr = "C:\Program Files\JetBrains\IntelliJ IDEA 2025.3.2\jbr"
    if (Test-Path $ideJbr) { $env:JAVA_HOME = $ideJbr }
}

$mvnw = Join-Path $backendDir "mvnw.cmd"
$backendProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c `"$mvnw`" spring-boot:run `"-Dspring-boot.run.profiles=h2`"" `
    -WorkingDirectory $backendDir `
    -PassThru -WindowStyle Normal

Write-Host "      Backend starting (PID $($backendProcess.Id))..." -ForegroundColor DarkGray
Write-Host "      Waiting 20s for Spring Boot to be ready..." -ForegroundColor DarkGray
Start-Sleep -Seconds 20
Write-Host "      Backend ready." -ForegroundColor Green

# ── 5. Summary ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  TUNNEL IS LIVE" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App URL (permanent): $FrontendUrl" -ForegroundColor White
Write-Host "  ngrok dashboard    : http://localhost:4040" -ForegroundColor White
Write-Host ""
Write-Host "  STEPS:" -ForegroundColor Yellow
Write-Host "  1. Open $FrontendUrl" -ForegroundColor White
Write-Host "  2. Log in and go to Batches" -ForegroundColor White
Write-Host "  3. Generate QR codes" -ForegroundColor White
Write-Host "     -> They will ALWAYS point to $FrontendUrl" -ForegroundColor Green
Write-Host "     -> Same URL every time you restart! No need to reprint." -ForegroundColor Green
Write-Host ""
Write-Host "  IMPORTANT: Keep this window open to keep the tunnel alive." -ForegroundColor DarkYellow
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# ── Keep alive ────────────────────────────────────────────────────────────────
try {
    Wait-Process -Id $ngrokProcess.Id
} catch {
    Stop-Process -Id $ngrokProcess.Id -ErrorAction SilentlyContinue
    Write-Host "`nTunnel stopped." -ForegroundColor DarkGray
}
