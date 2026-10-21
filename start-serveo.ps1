# --- QR Origin Tracker — Serveo Permanent Tunnel Launcher -------------------
# Serveo gives you a FREE, PERMANENT HTTPS URL — no account, no signup needed.
# Your app will always be at: https://<SubdomainName>.serveo.net
#
# USAGE (every session):
#   .\start-serveo.ps1
#
# Requirements: SSH (built into Windows 10/11)
# -----------------------------------------------------------------------------

# --------------------------------------------------------------
#  CONFIGURE THIS — choose a unique subdomain (lowercase)
#  Your app will always be at: https://<SubdomainName>.serveo.net
# --------------------------------------------------------------
$SubdomainName = "qr-origin-tracker"
# --------------------------------------------------------------

$ErrorActionPreference = "Stop"
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir  = Join-Path $scriptDir "backend"
$frontendDir = Join-Path $scriptDir "frontend"
$h2Props     = Join-Path $backendDir "src\main\resources\application-h2.properties"
$FrontendUrl = "https://$SubdomainName.serveousercontent.com"
$BackendTunnelUrl = "https://${SubdomainName}-api.serveousercontent.com"

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  QR Origin Tracker - Serveo Permanent Tunnel" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Permanent frontend URL: $FrontendUrl" -ForegroundColor Green
Write-Host ""

# -- 1. Start Angular frontend (port 4200) -------------------------------------
Write-Host "[1/5] Starting Angular dev server (port 4200)..." -ForegroundColor Yellow

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
    Write-Host "      Angular ready on port 4200." -ForegroundColor Green
}

# -- 2. Patch application-h2.properties ----------------------------------------
Write-Host ""
Write-Host "[2/5] Patching Spring Boot config with permanent URL..." -ForegroundColor Yellow

$props = Get-Content $h2Props -Raw

if ($props -match 'app\.frontend-base-url=.*') {
    $props = $props -replace 'app\.frontend-base-url=.*', "app.frontend-base-url=$FrontendUrl"
} else {
    $props = $props.TrimEnd() + "`napp.frontend-base-url=$FrontendUrl`n"
}

$corsValue = "http://localhost:4200,$FrontendUrl"
if ($props -match 'app\.cors\.allowed-origins=.*') {
    $props = $props -replace 'app\.cors\.allowed-origins=.*', "app.cors.allowed-origins=$corsValue"
} else {
    $props = $props.TrimEnd() + "`napp.cors.allowed-origins=$corsValue`n"
}

Set-Content $h2Props $props -NoNewline
Write-Host "      frontend-base-url    = $FrontendUrl" -ForegroundColor DarkGray
Write-Host "      cors.allowed-origins = $corsValue" -ForegroundColor DarkGray
Write-Host "      Config updated." -ForegroundColor Green

# -- 3. Kill old backend and restart with new config ----------------------------
Write-Host ""
Write-Host "[3/5] Restarting Spring Boot backend..." -ForegroundColor Yellow

$port8080 = netstat -ano | Select-String ":8080 " | Select-String "LISTENING"
if ($port8080) {
    $pid8080 = ($port8080 -split '\s+')[-1]
    Stop-Process -Id $pid8080 -Force -ErrorAction SilentlyContinue
    Write-Host "      Stopped old backend (PID $pid8080)." -ForegroundColor DarkGray
    Start-Sleep -Seconds 3
}

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

# -- 4. Start Serveo SSH tunnel -------------------------------------------------
Write-Host ""
Write-Host "[6/6] Opening Serveo frontend tunnel -> $FrontendUrl ..." -ForegroundColor Yellow
Write-Host "      (If subdomain is taken, change SubdomainName in this script)" -ForegroundColor DarkGray

$sshOutFile = Join-Path $env:TEMP "serveo-stdout.log"
$sshErrFile = Join-Path $env:TEMP "serveo-stderr.log"
Remove-Item $sshOutFile, $sshErrFile -ErrorAction SilentlyContinue

$sshProcess = Start-Process -FilePath "ssh" `
    -ArgumentList @(
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=60",
        "-o", "ExitOnForwardFailure=yes",
        "-i", "$env:USERPROFILE\.ssh\id_rsa",
        "-R", "${SubdomainName}:80:localhost:4200",
        "serveo.net"
    ) `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput $sshOutFile `
    -RedirectStandardError $sshErrFile

Write-Host "      Waiting for Serveo to confirm tunnel..." -ForegroundColor DarkGray

$deadline = (Get-Date).AddSeconds(20)
$confirmed = $false
while ((Get-Date) -lt $deadline) {
    $outContent = if (Test-Path $sshOutFile) { Get-Content $sshOutFile -Raw -ErrorAction SilentlyContinue } else { "" }
    $errContent = if (Test-Path $sshErrFile) { Get-Content $sshErrFile -Raw -ErrorAction SilentlyContinue } else { "" }
    $combined = "$outContent $errContent"
    if ($combined -match "Forwarding HTTP traffic") {
        $confirmed = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if (-not $confirmed) {
    Write-Host "      NOTE: Could not confirm from log — tunnel may still be running." -ForegroundColor DarkYellow
    Write-Host "      Try opening $FrontendUrl in your browser." -ForegroundColor DarkYellow
} else {
    Write-Host "      Tunnel confirmed!" -ForegroundColor Green
}

# -- 5. Summary ----------------------------------------------------------------
Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  TUNNEL IS LIVE" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  App URL (permanent): $FrontendUrl" -ForegroundColor White
Write-Host ""
Write-Host "  STEPS:" -ForegroundColor Yellow
Write-Host "  1. Open $FrontendUrl in your browser" -ForegroundColor White
Write-Host "  2. Log in and go to Batches" -ForegroundColor White
Write-Host "  3. Generate QR codes" -ForegroundColor White
Write-Host "     -> They will ALWAYS point to $FrontendUrl" -ForegroundColor Green
Write-Host "     -> Same URL every restart! No need to reprint." -ForegroundColor Green
Write-Host ""
Write-Host "  NOTE: If '$SubdomainName' is taken, change SubdomainName in this script." -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  IMPORTANT: Keep this window open to keep the tunnel alive." -ForegroundColor DarkYellow
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

# -- Keep alive ----------------------------------------------------------------
try {
    Wait-Process -Id $sshProcess.Id, $sshApiProcess.Id
} catch {
    Stop-Process -Id $sshProcess.Id -ErrorAction SilentlyContinue
    Write-Host "`nTunnel stopped." -ForegroundColor DarkGray
}




