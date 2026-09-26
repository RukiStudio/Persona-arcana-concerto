@echo off
cd /d "%~dp0"
title Persona Arcana Concert - Web

echo ==================================================
echo    Persona Arcana Concert - Web Version
echo ==================================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+ and add to PATH.
    echo.
    pause
    exit /b 1
)

echo Starting game server...
echo.
python -u web_server.py

if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start. Check error above.
    pause
)
