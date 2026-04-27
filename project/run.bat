@echo off
title Supply Chain Dashboard Runner
echo ========================================================
echo Starting Smart Supply Chain Optimization System
echo ========================================================

echo.
echo Starting Backend Server (FastAPI)...
start "Backend - FastAPI" cmd /k "cd backend && call venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

echo.
echo Starting Frontend Server (Vite React)...
start "Frontend - Vite React" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are launching in separate windows!
echo You can now close this window, or press any key to exit it.
pause >nul
