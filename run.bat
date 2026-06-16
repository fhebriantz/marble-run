@echo off
REM ====================================================================
REM   Marble Run Live - run.bat (Windows)
REM   Jalanin game + relay TikTok. Username diminta lewat input.
REM   (ASCII only - hindari error encoding di cmd.exe)
REM ====================================================================
setlocal
cd /d "%~dp0"
title Marble Run Live

echo ===============================
echo    MARBLE RUN LIVE
echo ===============================
set "TT_USER="
set /p "TT_USER=Username TikTok (tanpa @): "
if "%TT_USER%"=="" (
  echo [BATAL] Username kosong.
  pause
  exit /b 1
)

set PORT=5500

REM aktifkan koneksi TikTok di config (sekali set, idempotent)
node -e "const fs=require('fs');const f='js/config.js';let s=fs.readFileSync(f,'utf8');s=s.replace(/(tiktok:\s*\{\s*enabled:\s*)false/,'$1true');fs.writeFileSync(f,s)"

REM server game di window terpisah (python atau py)
start "Marble Game Server" cmd /c "python -m http.server %PORT% || py -m http.server %PORT%"
echo [OK] Game: http://localhost:%PORT%  (buka di browser / OBS Browser Source)

REM dependency relay (sekali aja)
cd server
if not exist node_modules (
  echo [..] Install dependency relay (sekali saja)...
  call npm install
)

echo [..] Menyambung ke live @%TT_USER% (pastikan kamu SUDAH LIVE di TikTok)...
echo      Tutup window ini untuk berhenti.
node relay.js "%TT_USER%"
pause
endlocal
