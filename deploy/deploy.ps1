# Deploy logistic_OS (React 2.0) to DigitalOcean via SSH (PowerShell)
# Usage: $env:DEPLOY_HOST="1.2.3.4"; $env:DEPLOY_USER="root"; .\deploy.ps1
# Or create deploy.config.ps1 in this folder with: $env:DEPLOY_HOST="..."; $env:DEPLOY_USER="root"

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

# Load config
if (Test-Path "$ScriptDir\deploy.config.ps1") {
    . "$ScriptDir\deploy.config.ps1"
}

$DeployHost = $env:DEPLOY_HOST
$DeployUser = $env:DEPLOY_USER
if (-not $DeployUser) { $DeployUser = "root" }
$DeployPath = $env:DEPLOY_PATH
if (-not $DeployPath) { $DeployPath = "/opt/logistic_OS_v2" }

if (-not $DeployHost) {
    Write-Error "Set DEPLOY_HOST (e.g. your droplet IP): `$env:DEPLOY_HOST='1.2.3.4'"
}

$Remote = "${DeployUser}@${DeployHost}"
Write-Host "Deploying React 2.0 to ${Remote}:${DeployPath}"

# Build React app before deploy
Write-Host "Building React app (Vite)..."
Push-Location $ProjectDir
try {
    npm run build
    if (-not (Test-Path "$ProjectDir\dist\index.html")) {
        Write-Error "Build failed or dist/index.html missing. Run 'npm run build' manually."
    }
} finally {
    Pop-Location
}

# Ensure database dump is in database/ for deploy (copy from root if needed)
$dbDump = "$ProjectDir\database\bread_logistics_v2.sql"
if (-not (Test-Path $dbDump)) {
    $rootDump = Get-ChildItem -Path $ProjectDir -Filter "bread_logistics_v2*.sql" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($rootDump) {
        Copy-Item $rootDump.FullName $dbDump -Force
        Write-Host "Copied $($rootDump.Name) to database/bread_logistics_v2.sql for deploy."
    }
}

# Create remote dir structure
Write-Host "Creating remote directories..."
ssh $Remote "mkdir -p $DeployPath/server $DeployPath/dist $DeployPath/database $DeployPath/deploy"

# Copy files
Write-Host "Copying files to server..."

# Server (Express API + legacy route-radar)
scp -r "$ProjectDir\server\*" "${Remote}:${DeployPath}/server/"

# Built frontend
scp -r "$ProjectDir\dist\*" "${Remote}:${DeployPath}/dist/"

# Database folder (SQL + README)
if (Test-Path "$ProjectDir\database") {
    scp -r "$ProjectDir\database\*" "${Remote}:${DeployPath}/database/"
}

# Root package files
scp "$ProjectDir\package.json" "$ProjectDir\package-lock.json" "${Remote}:${DeployPath}/"

# Deploy scripts (for server-side setup)
scp "$ScriptDir\server-setup.sh" "${Remote}:${DeployPath}/deploy/"

# .env (optional)
if (Test-Path "$ProjectDir\.env") {
    scp "$ProjectDir\.env" "${Remote}:${DeployPath}/"
    Write-Host ".env copied."
} else {
    Write-Warning "No .env found. Create one on server or copy .env.example and fill in DB_HOST, DB_USER, DB_PASSWORD, DB_NAME_V2."
}

# Run setup on server
Write-Host "Running server setup..."
ssh $Remote @"
export DEPLOY_PATH='$DeployPath'
chmod +x $DeployPath/deploy/server-setup.sh
$DeployPath/deploy/server-setup.sh
"@

Write-Host ""
Write-Host "Deploy done! Next steps on server:"
Write-Host "  1. ssh $Remote"
Write-Host "  2. cd $DeployPath && npm install --omit=dev"
Write-Host "  3. Create/edit .env: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME_V2=bread_logistics_v2, PORT=3001"
Write-Host "  4. Import DB: mysql -u root -p bread_logistics_v2 < database/bread_logistics_v2.sql  (see database/README.md)"
Write-Host "  5. Start: node server/index.js   (or use pm2: pm2 start server/index.js --name logistic-os)"
Write-Host "  6. Web: http://SERVER_IP:3001"
