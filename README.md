# 🎰 Marble Run Live

Game **live interaktif** berbasis gravitasi (Plinko / Marble Run) bertema **dark-mode neon**, dirancang khusus untuk **TikTok Live**. Penonton memicu efek lewat **gift, like (tap-tap), follow, dan share**. Tetap menarik & "satisfying" walau sepi donasi (idle mode otomatis).

Repo: **https://github.com/fhebriantz/marble-run.git**

100% web (HTML5 Canvas + Matter.js), zero aset (suara & visual di-generate), jalan native di Linux/Mac/Windows, dan siap dipasang sebagai **OBS Browser Source**.

---

## ✨ Fitur

- **Idle mode** — kelereng keluar otomatis dari **pipa berayun** di atas (menyapu kiri↔kanan), jatuh lewat paku neon ke slot.
- **Slot −10x s/d +10x** — tepi = hadiah besar, tengah = hukuman.
- **SCORE kumulatif** + **LEVEL** (tiap 10.000 score) + **progress bar** di bawah judul.
- **Rank/gelar** mengikuti level: minus = `Bokek → Penderitaan Abadi`, plus = `Anak Kos → Sultan Surgawi` (20 tingkat tiap arah). Background ikut berubah: makin tinggi makin **kaya**, minus makin **melarat**.
- **Leaderboard TOP DONATUR** — peringkat berdasarkan **nama donatur** (gift saja), tiap gifter dapat **warna unik** + bola bernama.
- **Ekonomi gift (1 koin = Rp40):**
  - Score **plus** → 🧸 dana **beli mainan anak** = total koin × Rp40.
  - Score **minus** → 💪 **push-up** = total koin ÷ 100.
- **Battle Plus vs Minus** — gift "Tutup Score Minus" (bantu, belokkan bola ke plus) vs "Tutup Score Plus" (sabotase, ke minus). Durasi **skala koin** (100 koin = 10 dtk → maks 60 dtk). Donatur dapat **bola bernama selama durasi cover**.
- **10 gift event** terurut koin kecil→besar di tombol **1-0** (keyboard & on-screen).
- **Engagement (non-donasi, tidak masuk leaderboard, hanya muncul di feed):** tap-tap → bola putih, follow → hujan bola, share → black hole.
- **Feed Aktivitas** — shoutout gift/follow/share (muncul lalu memudar).
- **Ticker berjalan** — legenda gift→efek + durasi, di atas leaderboard.
- **Gempa otomatis** tiap 60 dtk (0,5 dtk) → bola yang nyangkut lepas.
- **Suara synth** ("ting", fanfare, buzz, dll) + tombol **mute**.
- **Anti-hang:** watchdog auto-reload kalau frame macet >3 dtk.
- **Resume sesi:** SCORE, level, koin, leaderboard, **dan efek yang masih aktif** otomatis lanjut setelah reload (localStorage).
- **Responsive** (desktop & HP/iPhone) + **OBS friendly**.

---

## 🚀 Menjalankan (lokal)

Butuh server statis (biar audio/WebSocket normal). Dari folder proyek:

```bash
python3 -m http.server 5500
```

Buka browser ke **http://localhost:5500** lalu **klik sekali** (buka audio). Idle mode langsung jalan.

### Clone dari GitHub
```bash
git clone https://github.com/fhebriantz/marble-run.git
cd marble-run
python3 -m http.server 5500
```

### Coba di HP (WiFi sama)
1. Cari IP laptop: `hostname -I` (ambil `192.168.x.x`).
2. Di HP buka **http://192.168.x.x:5500**.

> Setelah update file, **hard-refresh** (Ctrl+Shift+R) atau "Refresh cache" di OBS bila tampilan tidak berubah (cache).

---

## 🎮 Kontrol & Testing

Klik ikon **⚙** (kanan-bawah) untuk buka panel host (default tersembunyi agar siaran bersih). Ikon **🔊** = mute/unmute.

### Tombol 1-0 = 10 gift event (koin kecil → besar)
| Key | Gift | Koin | Efek |
|---|---|---|---|
| 1 | Rose | 1 | 5 dtk bola bernama |
| 2 | TikTok | 1 | Flip papan |
| 3 | Perfume | 20 | Black Hole |
| 4 | Doughnut | 30 | Hujan bola |
| 5 | Confetti | 100 | 🟢 Tutup Score Minus |
| 6 | Hand Hearts | 100 | 🔴 Tutup Score Plus |
| 7 | Galaxy | 1.000 | 🟢 Tutup Score Minus |
| 8 | Dragon | 1.000 | 🔴 Tutup Score Plus |
| 9 | Universe | 34.999 | 🟢 Tutup Score Minus |
| 0 | TikTok Universe | 44.999 | 🔴 Tutup Score Plus |

Tekan keyboard 1-0 atau klik tombol = simulasi gift (efek + bola bernama + koin). Saat test, **nama akun gifter di-random** biar beda jelas dari nama efek.

### Panel lain
- **ENGAGEMENT + RESET:** 👆 Tap-tap, 💜 Follow, 🔁 Share, ♻️ Reset Arena, **Antrian: ON/OFF**.
- **SETTING SESI:** isi Level / Total Koin / Koin Plus / Koin Minus → *Simpan & Terapkan* (untuk lanjut sesi lama).

---

## ⚙️ Pengaturan (`js/config.js`)

Semua angka utama bisa diutak-atik di `js/config.js`:

- **`mapping`** — gift → efek:
  - `giftsByName` — gift spesifik by nama (penentu sisi battle: Galaxy=bantu, Dragon=sabotase, dll).
  - `giftTiers` — jaring pengaman berdasarkan nilai koin.
  - `like` / `follow` / `share` — efek engagement.
- **`keyGifts`** — pemetaan tombol 1-0 ke gift (nama + koin).
- **`gameplay`** (sebagian):
  - `scorePerLevel` (10.000) — score per naik level.
  - `rupiahPerCoin` (40), `coinsPerPushup` (100) — ekonomi mainan & push-up.
  - `effectDurRefCoins` (100), `effectDurMaxMs` (60.000) — skala durasi efek by koin.
  - `streamMsPerCoin`, `streamIntervalMs` — durasi & laju stream bola gift.
  - `namedSlowMs` (5.000) — durasi gift Rose.
  - `shootCount` (1) — bola per tap-tap; `like.every` (5) — tiap N tap.
  - `shakeIntervalMs` (60.000), `shakeStrength` — gempa anti-nyangkut.
  - `maxMarbles` (170) + `queueEnabled` (false) — batas/antrian bola.
  - `hangWatchdog` / `hangTimeoutMs` (3.000) — auto-reload anti-hang.
  - `pipeSweepMs`, `pipeMaxAngle` — ayunan pipa.
- **`slots`** — nilai slot (boleh negatif).
- **`audio`** — `enabled`, `masterVolume`.
- **`tiktok`** — koneksi live (lihat bawah).

---

## 📡 Hubungkan ke TikTok Live (WebSocket)

Game menerima event TikTok lewat **WebSocket** dari sebuah "relay" (pembaca event live). Disediakan relay gratis pakai **TikTok-Live-Connector** (Node.js) — **tanpa API key**, native Linux.

### 1) Jalankan relay
```bash
cd server
npm install
node relay.js USERNAME_TIKTOK_KAMU
```
Relay akan:
- Connect ke live TikTok `@USERNAME` (read-only, tidak login akun).
- Buka WebSocket di **ws://localhost:8080**.
- Meneruskan event ke game.

### 2) Nyalakan koneksi di game
Di `js/config.js`:
```js
tiktok: {
  enabled: true,
  websocketUrl: "ws://localhost:8080",
}
```
Reload game → otomatis connect & reconnect bila putus.

### Format pesan WebSocket
Relay mengirim JSON; game memetakannya ke efek lewat `mapping`:
```json
{ "type": "gift",   "name": "Galaxy", "coins": 1000, "repeat": 1, "user": "andi" }
{ "type": "like",   "count": 50 }
{ "type": "follow", "user": "andi" }
{ "type": "share",  "user": "andi" }
```
> Catatan: nama class paket `tiktok-live-connector` bisa beda antar versi
> (`TikTokLiveConnection` di v2+, `WebcastPushConnection` di v1). Sesuaikan baris
> import di `server/relay.js` bila perlu. Kamu juga bisa pakai sumber event lain
> (mis. Tikfinity / cloud) selama mengirim format JSON di atas ke `ws://localhost:8080`.

### Host di cloud (opsional, untuk HP-only)
Relay bisa dijalankan di free tier (Railway/Render/Fly) lalu set `websocketUrl` ke URL `wss://...` publiknya.

---

## 🎥 Pakai di OBS

1. **Browser Source** baru.
2. URL: `http://localhost:5500` (resolusi 1920×1080).
3. Tap **⚙** untuk sembunyikan panel host agar siaran bersih.
4. Bila visual tak update setelah edit: properti source → **Refresh cache of current page**.

---

## 📁 Struktur

```
marble-run/
├── index.html            # layout, overlay, panel kontrol, ticker
├── css/style.css         # tema neon dark mode + responsive
├── js/
│   ├── config.js         # ⭐ SEMUA pengaturan (mapping, keyGifts, gameplay, tiktok)
│   ├── audio.js          # synth Web Audio
│   ├── ui.js             # leaderboard, level/rank, feed, ticker, animasi angka
│   ├── game.js           # engine: physics, efek, ekonomi, persistensi, watchdog
│   └── tiktok-bridge.js  # penerima event WebSocket
├── vendor/matter.min.js  # physics engine (offline)
└── server/
    ├── relay.js          # relay TikTok Live -> WebSocket (untuk live)
    └── package.json
```

---

## 📝 Catatan
- Semua progres (score/level/koin/leaderboard/efek aktif) **tersimpan otomatis** di browser yang sama (localStorage). Mulai babak baru: tombol **♻️ Reset Arena**.
- Game **read-only** terhadap akun TikTok — relay cuma "menonton" event live, tidak login/posting.
