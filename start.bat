@echo off
echo ============================================================
echo   PS-248 Tactical Telemetry and Decision-Training System
echo ============================================================
echo Starting unified Python Backend + Frontend on http://127.0.0.1:8000...
echo.

:: Open default browser after a brief 1.5s delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000"

:: Start the Python backend server
python backend/run.py

pause
