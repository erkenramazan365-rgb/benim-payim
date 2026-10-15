# Benim Payım — Tek Komutla Başlatma Betiği (PowerShell)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   Benim Payım Başlatılıyor...            " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Backend (FastAPI) Başlatılıyor
Write-Host "[1/2] Backend (FastAPI - Port 8000) başlatılıyor..." -ForegroundColor Yellow
$backendCmd = "cd '$rootDir\apps\api'; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# 2. Frontend (Next.js) Başlatılıyor
Write-Host "[2/2] Frontend (Next.js - Port 3000) başlatılıyor..." -ForegroundColor Yellow
$frontendCmd = "cd '$rootDir\apps\web'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Write-Host "`nUygulama başarıyla başlatıldı!" -ForegroundColor Green
Write-Host "Web Arayüzü: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API Sağlık : http://127.0.0.1:8000/api/health" -ForegroundColor Cyan
