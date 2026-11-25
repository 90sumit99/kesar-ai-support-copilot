$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $projectDirectory
$env:N8N_USER_FOLDER = Join-Path $projectDirectory '.local'
$env:N8N_LISTEN_ADDRESS = '127.0.0.1'
$env:N8N_PORT = '5678'
$env:N8N_DIAGNOSTICS_ENABLED = 'false'
$env:N8N_PERSONALIZATION_ENABLED = 'false'
$env:N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS = 'false'
$env:GENERIC_TIMEZONE = 'Asia/Kolkata'
$env:N8N_CONCURRENCY_PRODUCTION_LIMIT = '1'
& node (Join-Path $projectDirectory '.runtime\node_modules\n8n\bin\n8n') start
