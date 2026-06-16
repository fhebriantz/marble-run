#!/usr/bin/env bash
# =====================================================================
#  Marble Run Live - run.sh (Linux / Mac)
#  Jalanin game + relay TikTok. Username diminta lewat input.
# =====================================================================
cd "$(dirname "$0")"

echo "==============================="
echo "   MARBLE RUN LIVE"
echo "==============================="
read -r -p "Username TikTok (tanpa @): " TT_USER
if [ -z "$TT_USER" ]; then
  echo "[BATAL] Username kosong."
  exit 1
fi

PORT=5500

# aktifkan koneksi TikTok di config (sekali set, idempotent)
node -e "const fs=require('fs');const f='js/config.js';let s=fs.readFileSync(f,'utf8');s=s.replace(/(tiktok:\s*\{\s*enabled:\s*)false/,'\$1true');fs.writeFileSync(f,s)" 2>/dev/null

# server game (background)
python3 -m http.server "$PORT" >/tmp/marble-http.log 2>&1 &
HTTP_PID=$!
trap 'echo; echo "[STOP] berhenti."; kill $HTTP_PID 2>/dev/null; exit 0' INT TERM

echo "[OK] Game: http://localhost:$PORT  (buka di browser / OBS Browser Source)"

# dependency relay (sekali aja)
cd server
if [ ! -d node_modules ]; then
  echo "[..] Install dependency relay (sekali saja)..."
  npm install || { echo "[ERROR] npm install gagal"; kill "$HTTP_PID" 2>/dev/null; exit 1; }
fi

echo "[..] Menyambung ke live @$TT_USER (pastikan kamu SUDAH LIVE di TikTok)..."
echo "     Tekan Ctrl+C untuk berhenti."
node relay.js "$TT_USER"

# kalau relay berhenti, matikan server juga
kill "$HTTP_PID" 2>/dev/null
