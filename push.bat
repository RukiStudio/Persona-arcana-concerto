@echo off
rem One-click push wrapper - double click to run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push.ps1" %*
echo.
pause