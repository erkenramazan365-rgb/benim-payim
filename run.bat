@echo off
title Benim Payim Baslatici
echo ==========================================
echo    Benim Payim Baslatiliyor...
echo ==========================================

set ROOT_DIR=%~dp0

echo [1/2] Backend (FastAPI - Port 8000) baslatiliyor...
start "Benim Payim Backend" cmd /k "cd /d %ROOT_DIR%apps\api && .venv\Scripts\activate && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Frontend (Next.js - Port 3000) baslatiliyor...
start "Benim Payim Frontend" cmd /k "cd /d %ROOT_DIR%apps\web && npm run dev"

echo.
echo Uygulama pencereleri acildi!
echo Tarayicinizdan erisebilirsiniz: http://localhost:3000
