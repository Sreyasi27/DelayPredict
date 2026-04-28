@echo off
title Supply Chain Dashboard -- Launcher
setlocal

:: ── Resolve the project root (the folder this .bat lives in) ─────────────
set ROOT=%~dp0
set BACKEND=%ROOT%project\backend
set FRONTEND=%ROOT%project\frontend

echo ============================================================
echo   Smart Supply Chain Optimization System
echo ============================================================
echo   Root    : %ROOT%
echo   Backend : %BACKEND%
echo   Frontend: %FRONTEND%
echo ============================================================

:: ── Step 1: Initialise SQLite database ───────────────────────────────────
echo.
echo [1/3] Initialising SQLite database...
python "%ROOT%init_database.py"
if %errorlevel% neq 0 (
    echo [WARN] DB init returned non-zero -- may already be initialised. Continuing.
)
echo       Database ready.

:: ── Step 2: Start FastAPI backend (UTF-8 console to avoid Unicode errors) ─
echo.
echo [2/3] Starting Backend Server (FastAPI on port 8000)...
start "Backend - FastAPI" cmd /k ^
    "chcp 65001 >nul && cd /d "%BACKEND%" && call venv\Scripts\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

:: Give the backend a few seconds to bind its port
timeout /t 4 /nobreak >nul

:: ── Step 3: Start Vite React frontend ─────────────────────────────────────
echo.
echo [3/3] Starting Frontend Server (Vite React on port 5173)...
start "Frontend - Vite React" cmd /k ^
    "cd /d "%FRONTEND%" && npm run dev"

echo.
echo ============================================================
echo   All services launched in separate windows!
echo.
echo   Backend  --^> http://localhost:8000
echo   Frontend --^> http://localhost:5173
echo   API Docs --^> http://localhost:8000/docs
echo ============================================================
echo.
echo   You can close this window. Servers will keep running.
pause >nul
endlocal
