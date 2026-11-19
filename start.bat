@echo off
title OpenLabel AI

cd /d "%~dp0backend"
call .venv\Scripts\activate.bat
start "Backend" cmd /c "python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8011 & pause"

cd /d "%~dp0frontend"
start "Frontend" cmd /c "npm run dev & pause"

timeout /t 3 /nobreak >nul
start http://localhost:5173

echo Backend: http://localhost:8011
echo API Docs: http://localhost:8011/docs
echo Frontend: http://localhost:5173
echo.
pause
