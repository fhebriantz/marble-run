@echo off
REM ====================================================================
REM   Marble Run Live - run-tikfinity.bat (Windows + Tikfinity)
REM   Untuk yang pakai TIKFINITY sebagai sumber event (BUKAN relay Node).
REM   - Set config: enabled=true, websocketUrl=ws://localhost:21213/
REM   - Start server statis di port 5500
REM   - TIDAK menjalankan relay (Tikfinity yang menyiarkan event)
REM   (ASCII only - hindari error encoding di cmd.exe)
REM ====================================================================
setlocal
cd /d "%~dp0"
title Marble Run Live (Tikfinity)

echo ==================================
echo    MARBLE RUN LIVE - mode TIKFINITY
echo ==================================
echo.
echo Pastikan TIKFINITY DESKTOP sudah dibuka dan CONNECT ke live kamu.
echo Game akan membaca event dari Tikfinity di ws://localhost:21213/
echo.

set PORT=5500

REM arahkan config ke Tikfinity (enabled=true + port 21213), idempotent
node -e "const fs=require('fs');const f='js/config.js';let s=fs.readFileSync(f,'utf8');s=s.replace(/(tiktok:\s*\{\s*enabled:\s*)false/,'$1true');s=s.replace(/websocketUrl:\s*\"[^\"]*\"/,'websocketUrl: \"ws://localhost:21213/\"');fs.writeFileSync(f,s)" 2>nul
if errorlevel 1 (
  echo [INFO] Node tidak ada - set config manual di js\config.js:
  echo        tiktok: { enabled: true, websocketUrl: "ws://localhost:21213/" }
)

echo [OK] Game: http://localhost:%PORT%   (buka di browser / OBS Browser Source)
echo      Tutup window ini untuk berhenti.
echo.

REM server game (python atau py)
python -m http.server %PORT% || py -m http.server %PORT%

pause
endlocal
