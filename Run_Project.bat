@echo off
echo ===================================================
echo     Starting NeuroScan AI Clinical Application
echo ===================================================
echo.
echo Launching the backend API server and opening the browser...
start "" "%~dp0app\static\index.html"
cd app
python main.py
echo.
pause
