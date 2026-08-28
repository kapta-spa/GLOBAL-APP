# Deploy script for Hostinger (Pushes dist content to main branch)
$ErrorActionPreference = "Stop"

Write-Host "1. Compilando la aplicación inbox-app..." -ForegroundColor Green
Set-Location "$PSScriptRoot\inbox-app"
npm run build

Write-Host "2. Preparando despliegue de la carpeta dist..." -ForegroundColor Green
Set-Location "$PSScriptRoot\inbox-app\dist"

if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
}

git init
git branch -M main
git config user.name "kapta-spa"
git config user.email "info@globaltranslations.co.nz"
git add .
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Deploy dist to Hostinger - $dateStr"

Write-Host "3. Enviando contenido de dist a la rama main de GitHub..." -ForegroundColor Green
git push origin main --force

Set-Location "$PSScriptRoot"
Write-Host "¡Despliegue a Hostinger completado con éxito!" -ForegroundColor Cyan
