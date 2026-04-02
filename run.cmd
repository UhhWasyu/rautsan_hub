@echo off
title Rautsan - Server
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
)

echo.
echo Starting server...
echo Landing: http://localhost:3000
echo Admin:   http://localhost:3000/admin
echo.
echo Membuka browser otomatis...
start http://localhost:3000
node server.js

pause
