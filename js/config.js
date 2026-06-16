/* =====================================================================
 *  MARBLE RUN LIVE — KONFIGURASI
 *  Edit file ini untuk mengatur "gift apa -> efek apa".
 *  Tidak perlu mengubah file lain.
 * =====================================================================
 *
 *  DAFTAR EFEK YANG TERSEDIA (pakai persis teksnya):
 *    "spawnNamedMarble" -> Kelereng emas bernama + ekor cahaya
 *    "marbleRain"       -> Hujan 30 kelereng
 *    "megaBoulder"      -> Kelereng raksasa penabrak
 *    "lowGravity"       -> Anti-gravitasi 10 detik
 *    "flipObstacles"    -> Putar papan paku / pengungkit
 *    "blackHole"        -> Lubang hitam penyedot 5 detik
 *    "multiplierBoost"  -> Semua poin x5 selama 15 detik
 *    "chaosWind"        -> Angin topan dari samping
 *    "nuke"             -> Ledakkan semua kelereng + poin instan
 *    "coverMinus"       -> Tutup slot MINUS (belokkan kelereng ke PLUS) - bantuan
 *    "coverPlus"        -> Tutup slot PLUS (belokkan kelereng ke MINUS) - sabotase
 *    "shoot"            -> Tembak 1 bola putih dengan dorongan kuat (cocok utk love/tap-tap)
 *    "resetArena"       -> Reset total papan & skor
 * ===================================================================== */

const CONFIG = {
  // ---------------------------------------------------------------
  //  MAPPING EVENT -> EFEK
  // ---------------------------------------------------------------
  mapping: {
    // (1) GIFT berdasarkan NAMA — untuk gift spesifik yang mau efek khusus.
    //     Nama harus sama persis dengan nama gift di TikTok.
    giftsByName: {
      // ---- gift kecil: efek seru + 1 bola bernama (dari stream) ----
      "Rose": "namedSlow",                  // ~1 koin: 5 bola bernama (jeda 1 dtk)
      "TikTok": "flipObstacles",            // ~1 koin: flip papan
      "Perfume": "blackHole",               // ~20 koin: black hole
      "Doughnut": "marbleRain",             // ~30 koin: hujan bola
      // ---- BATTLE cover (bola bernama terus selama durasi cover) ----
      "Confetti": "coverMinus",             // 100 🟢 Tutup Minus (bantu)
      "Hand Hearts": "coverPlus",           // 100 🔴 Tutup Plus (sabotase)
      "Galaxy": "coverMinus",               // 1.000 🟢
      "Dragon": "coverPlus",                // 1.000 🔴
      "Universe": "coverMinus",             // ~35rb 🟢
      "TikTok Universe": "coverPlus",       // ~45rb 🔴
    },

    // (2) GIFT berdasarkan NILAI KOIN — jaring pengaman.
    //     Kalau nama gift tidak ada di daftar atas, pakai tier ini.
    //     Diurutkan dari koin terkecil; dipilih tier tertinggi yang cocok.
    giftTiers: [
      { minCoins: 1,    effect: "spawnNamedMarble" }, // 1-9 koin
      { minCoins: 10,   effect: "marbleRain" },       // 10-99 koin
      { minCoins: 100,  effect: "multiplierBoost" },  // 100-999 koin
      { minCoins: 1000, effect: "blackHole" },        // 1000+ koin
    ],

    // (3) EVENT ENGAGEMENT GRATIS (tanpa donasi) -> TIDAK masuk leaderboard,
    //     hanya muncul di feed AKTIVITAS lalu hilang.
    like:   { every: 1, effect: "shoot" },     // tap-tap -> bola PUTIH keluar (1 tap = 1 shoot)
    follow: "marbleRain",                       // follow -> HUJAN bola
    share:  "blackHole",                        // share -> BLACK HOLE
  },

  // ---------------------------------------------------------------
  //  TOMBOL 1-0 = 10 GIFT EVENT (urut koin TERKECIL -> TERBESAR)
  //  Keyboard 1..9,0 & tombol on-screen mensimulasikan gift ini.
  // ---------------------------------------------------------------
  keyGifts: {
    "1": { g: "Rose",           c: 1 },      // anti-gravity + bola bernama
    "2": { g: "TikTok",         c: 1 },      // flip + bola bernama
    "3": { g: "Perfume",        c: 20 },     // black hole + bola bernama
    "4": { g: "Doughnut",       c: 30 },     // hujan bola + bernama
    "5": { g: "Confetti",       c: 100 },    // 🟢 Tutup Minus (battle)
    "6": { g: "Hand Hearts",    c: 100 },    // 🔴 Tutup Plus (battle)
    "7": { g: "Galaxy",         c: 1000 },   // 🟢 Tutup Minus
    "8": { g: "Dragon",         c: 1000 },   // 🔴 Tutup Plus
    "9": { g: "Universe",       c: 34999 },  // 🟢 Tutup Minus
    "0": { g: "TikTok Universe", c: 44999 }, // 🔴 Tutup Plus
  },

  // ---------------------------------------------------------------
  //  PENGATURAN GAMEPLAY (boleh diutak-atik)
  // ---------------------------------------------------------------
  gameplay: {
    idleDropInterval: 2500,   // jeda jatuh kelereng idle (ms)
    basePoints: 10,           // poin dasar per kelereng yang masuk slot
    globalBarTarget: 5000,    // skor untuk mengisi penuh Global Bar
    maxMarbles: 170,          // batas kelereng di layar (berlaku hanya kalau queueEnabled)
    queueEnabled: false,      // sistem antrian/cap: false = bola SELALU muncul (gak di-drop). true = batasi di maxMarbles
    multiplierBoostFactor: 5, // pengali saat multiplierBoost aktif
    multiplierBoostDuration: 15000,
    lowGravityDuration: 10000,
    blackHoleDuration: 5000,
    chaosWindDuration: 6000,
    flipDuration: 8000,    // flipObstacles balik sendiri setelah ini (ms)
    coverDuration: 10000,  // durasi penutup slot (tutup minus/plus) (ms) — DASAR (di 100 koin)
    effectDurRefCoins: 100,// koin acuan: <= ini durasi efek = dasar; di atasnya durasi diskala naik
    effectDurMaxMs: 60000, // batas durasi efek walau gift sultan (60 detik)
    shakeIntervalMs: 60000,// getar paku otomatis tiap ini (anti bola nyangkut) — 1 menit
    shakeDurationMs: 500,  // lama getar (0.5 detik)
    shakeStrength: 7,      // kekuatan guncangan (makin besar makin keras)
    hangWatchdog: true,    // auto-reload kalau frame macet (anti-hang)
    hangTimeoutMs: 3000,   // frame tak bergerak selama ini -> reload (3 detik)
    // ---- PIPA PELUNCUR (kelereng keluar dari pipa yang menyapu kiri<->kanan) ----
    pipeSweepMs: 2800,     // waktu satu ayunan penuh kiri-kanan (ms). makin kecil makin cepat
    pipeMaxAngle: 72,      // sudut maksimum dari tegak lurus (derajat). 90 = nyaris horizontal
    pipeLaunchSpeed: 7,    // kecepatan luncur kelereng dari pipa
    shootSpeed: 18,        // kecepatan tembakan efek "shoot" (love/tap-tap)
    shootCount: 1,         // jumlah bola per sekali shoot (tap-tap: 5 tap -> 1 bola)
    namedSlowMs: 5000,        // gift "namedSlow" (Rose): durasi stream 5 dtk, laju = sama spt gift biasa (streamIntervalMs)
    // window atribusi untuk efek INSTAN (named/rain/boulder/shoot/nuke):
    // selama window ini, skor dikreditkan ke donatur yang baru saja gift.
    // Efek berdurasi (cover/multiplier/dll) pakai durasi efeknya sendiri.
    attribWindow: 5000,

    // ---- EKONOMI GIFT (koin -> bola/durasi/level/pushup/mainan) ----
    coinsPerBall: 10,       // ~1 bola per 10 koin (mengatur jumlah bola stream)
    streamMsPerCoin: 18,    // durasi stream bola = koin x ini (10.000 koin ~ 3 menit)
    streamMaxMs: 300000,    // batas durasi stream (5 menit) — jaga performa
    streamIntervalMs: 250,  // jeda antar bola dalam satu stream
    scorePerLevel: 100000,  // tiap TOTAL SCORE sekian -> naik/turun 1 level (100rb)
    coinsPerPushup: 100,    // 100 koin = 1 push-up (saat WIN minus: total koin ÷ 100)
    rupiahPerCoin: 40,      // 1 koin = Rp40 (koin plus -> dana beli mainan)
  },

  // ---------------------------------------------------------------
  //  AUDIO
  // ---------------------------------------------------------------
  audio: {
    enabled: true,
    masterVolume: 0.35,
    maxChimesPerFrame: 3, // batasi suara biar tidak "berisik" saat ramai
  },

  // ---------------------------------------------------------------
  //  SLOT BAWAH (multiplier). Boleh negatif (-10..10).
  //  Tepi = PLUS besar (hadiah), tengah = MINUS (hukuman).
  //  Bisa juga pakai "ZONK" (0 poin). Jumlah bin = panjang array ini.
  // ---------------------------------------------------------------
  slots: [10, 5, 2, -2, -5, -10, -5, -2, 2, 5, 10],

  // ---------------------------------------------------------------
  //  KONEKSI TIKTOK (opsional, untuk live).
  //  Default mati; run.sh / run.bat otomatis menyalakannya saat live.
  // ---------------------------------------------------------------
  tiktok: {
    enabled: true,
    websocketUrl: "ws://localhost:21213/", // relay TikTok-Live-Connector / cloud
  },
};
