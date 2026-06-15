/* =====================================================================
 *  MARBLE RUN LIVE — ENGINE UTAMA
 *  Physics: Matter.js | Render: Canvas 2D (neon glow) | Audio: Web Audio
 * ===================================================================== */

const { Engine, World, Bodies, Body, Composite, Events, Vector } = Matter;

const Game = (() => {
  // ---- elemen & konteks ----
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");

  // ---- state dunia ----
  let engine, world;
  let W = 0, H = 0, dpr = 1;
  let pegs = [];
  let bars = [];
  let slotSensors = [];
  let marbles = [];
  let particles = [];
  let floatTexts = [];
  let streams = [];        // stream bola milik gifter

  // ---- skor & sesi ----
  let donors = {};         // nama -> { coins, color }
  // sesi yang bisa di-save/resume (localStorage)
  let session = { totalCoins: 0, plusCoins: 0, minusCoins: 0, levelBase: 0, likes: 0, totalScore: 0 };

  // ---- efek aktif (stacking durasi) ----
  let lowGravityUntil = 0;
  let flipUntil = 0;
  let blackHole = null;
  let wind = null;
  let coverState = { minus: { until: 0, bodies: [] }, plus: { until: 0, bodies: [] } };

  // ---- timing ----
  let lastIdleDrop = 0;
  let lastTime = 0;
  let lastUiAt = 0;
  let uiDirty = true;
  let lastShake = 0;       // waktu getar terakhir
  let shakeUntil = 0;      // getar aktif sampai waktu ini
  let lastFrameAt = 0;     // watchdog anti-hang: waktu frame terakhir
  let pendingFx = null;    // efek aktif tersimpan, dilanjut setelah reload

  // =====================================================================
  //  HELPER EKONOMI / WARNA / LEVEL
  // =====================================================================
  // warna unik & konsisten per nama (hash -> HSL)
  function colorFor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return `hsl(${h}, 85%, 62%)`;
  }
  // nama akun acak untuk TEST (biar beda jelas dari nama efek/gift)
  const FAKE_NAMES = ["andi", "budi", "citra", "dewi", "eka", "fajar", "gita", "hadi",
    "indra", "joko", "kiki", "lina", "maya", "nanda", "putri", "rama", "sari", "tono",
    "wati", "yuni", "zaki", "rizki", "bagus", "intan", "dimas", "agus", "lala", "vino"];
  function randomGifter() {
    return FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)] + Math.floor(Math.random() * 100);
  }
  // kualitas bola berdasarkan koin (makin besar koin makin "wah")
  function ballQuality(coins) {
    // ukuran maksimal = bola named (radius 12); gift besar beda di glow/trail, bukan ukuran
    if (coins >= 10000) return { radius: 12, glow: 38, trail: 18 };
    if (coins >= 1000)  return { radius: 12, glow: 30, trail: 14 };
    if (coins >= 100)   return { radius: 12, glow: 24, trail: 10 };
    if (coins >= 10)    return { radius: 10, glow: 18, trail: 7 };
    return { radius: 9, glow: 14, trail: 5 };
  }
  function levelNow() {
    // level dari TOTAL SCORE, dimulai dari LV 1 (score minus -> level turun/melarat)
    return 1 + session.levelBase + Math.trunc(session.totalScore / CONFIG.gameplay.scorePerLevel);
  }
  // background makin kaya seiring level; minus -> melarat
  function bgForLevel(level) {
    if (level < 0)   return ["#1a1410", "#080503"];   // melarat (coklat gelap)
    if (level === 0) return ["#0a0a1a", "#05050d"];
    if (level < 3)   return ["#0a1422", "#05050d"];
    if (level < 6)   return ["#101a30", "#070512"];
    if (level < 10)  return ["#1a1140", "#0a0518"];   // ungu kaya
    return ["#2a1a4a", "#160b2a"];                    // mewah
  }

  // snapshot efek aktif sebagai SISA durasi (ms) -> bisa dilanjut setelah reload
  function effectsSnapshot() {
    const now = performance.now();
    const rem = (u) => (u > now ? u - now : 0);
    return {
      lowGravity: rem(lowGravityUntil),
      flip: rem(flipUntil),
      coverMinus: rem(coverState.minus.until),
      coverPlus: rem(coverState.plus.until),
      wind: (wind && wind.until > now) ? { fx: wind.fx, ms: wind.until - now } : null,
      blackHole: (blackHole && blackHole.until > now) ? { x: blackHole.x, y: blackHole.y, ms: blackHole.until - now } : null,
      streams: streams.map((s) => ({ owner: s.owner, color: s.color, ballsLeft: s.ballsLeft, interval: s.interval, coinShare: s.coinShare, quality: s.quality })),
    };
  }
  // lanjutkan efek aktif setelah reload (dipanggil SETELAH buildBoard)
  function restoreEffects(fx) {
    if (!fx) return;
    const now = performance.now();
    if (fx.lowGravity > 0) { engine.gravity.y = 0.15; lowGravityUntil = now + fx.lowGravity; }
    if (fx.flip > 0) { Effects.flipObstacles(); flipUntil = now + fx.flip; }
    if (fx.wind) { wind = { fx: fx.wind.fx, until: now + fx.wind.ms }; }
    if (fx.blackHole) { blackHole = { x: fx.blackHole.x, y: fx.blackHole.y, until: now + fx.blackHole.ms, launched: false }; }
    if (fx.coverMinus > 0) { addCover("minus"); coverState.minus.until = now + fx.coverMinus; }
    if (fx.coverPlus > 0) { addCover("plus"); coverState.plus.until = now + fx.coverPlus; }
    if (fx.streams) for (const s of fx.streams) streams.push({
      owner: s.owner, color: s.color, ballsLeft: s.ballsLeft,
      interval: s.interval || CONFIG.gameplay.streamIntervalMs, coinShare: s.coinShare || 0,
      nextAt: now, quality: s.quality || { radius: 9, glow: 14, trail: 5 },
    });
  }

  // simpan SELURUH state penting (anti-hang): session + leaderboard + efek aktif
  function persist() {
    try { localStorage.setItem("mr_state", JSON.stringify({ session, donors, fx: effectsSnapshot() })); } catch (e) {}
  }
  const saveSession = debounce(persist, 600); // dipanggil di banyak tempat (debounced)
  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem("mr_state"));
      if (!s) return;
      if (s.session) Object.assign(session, s.session);
      if (s.donors && typeof s.donors === "object") donors = s.donors;
      for (const k in donors) {
        if (!donors[k] || typeof donors[k] !== "object") donors[k] = { coins: +donors[k] || 0, color: colorFor(k) };
        if (!donors[k].color) donors[k].color = colorFor(k);
      }
      pendingFx = s.fx || null; // dilanjut setelah board dibangun
    } catch (e) {}
  }

  // =====================================================================
  //  INISIALISASI
  // =====================================================================
  function init() {
    engine = Engine.create();
    world = engine.world;
    engine.gravity.y = 1;

    loadSession();
    resize();
    window.addEventListener("resize", debounce(resize, 200));
    // flush simpan segera sebelum reload/tutup/tab disembunyikan
    window.addEventListener("pagehide", persist);
    window.addEventListener("beforeunload", persist);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) persist();
      else lastFrameAt = performance.now(); // cegah watchdog salah picu saat tab balik aktif
    });
    Events.on(engine, "collisionStart", onCollision);

    AudioFX.init();
    bindInput();
    if (CONFIG.tiktok.enabled) TikTokBridge.connect();

    lastTime = performance.now();
    lastFrameAt = lastTime;
    restoreEffects(pendingFx); pendingFx = null; // lanjutkan efek aktif (kalau habis reload)
    requestAnimationFrame(loop);

    // WATCHDOG anti-hang: kalau frame tak bergerak > batas & tab aktif -> simpan & reload
    if (CONFIG.gameplay.hangWatchdog) {
      setInterval(() => {
        if (document.hidden) return;
        if (lastFrameAt && performance.now() - lastFrameAt > CONFIG.gameplay.hangTimeoutMs) {
          try { persist(); } catch (e) {}
          location.reload();
        }
      }, 1000);
    }

    runDemo();
  }

  // =====================================================================
  //  BANGUN PAPAN
  // =====================================================================
  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildBoard();
  }

  function buildBoard() {
    Composite.clear(world, false);
    pegs = []; bars = []; slotSensors = [];
    coverState = { minus: { until: 0, bodies: [] }, plus: { until: 0, bodies: [] } };

    const wallOpts = { isStatic: true, restitution: 0.4, label: "wall" };
    Composite.add(world, [
      Bodies.rectangle(-10, H / 2, 20, H * 2, wallOpts),
      Bodies.rectangle(W + 10, H / 2, 20, H * 2, wallOpts),
    ]);

    const top = 150, slotZone = 150, bottom = H - slotZone;
    const rowGap = 62, colGap = 64;
    const rows = Math.max(4, Math.floor((bottom - top) / rowGap));
    for (let r = 0; r < rows; r++) {
      const y = top + r * rowGap;
      const offset = (r % 2 === 0) ? 0 : colGap / 2;
      const cols = Math.ceil(W / colGap) + 1;
      for (let c = 0; c < cols; c++) {
        const x = c * colGap + offset;
        if (x < 24 || x > W - 24) continue;
        const peg = Bodies.circle(x, y, 6, { isStatic: true, restitution: 0.6, friction: 0, label: "peg" });
        pegs.push(peg); Composite.add(world, peg);
      }
    }

    const slots = CONFIG.slots, bins = slots.length, binW = W / bins;
    for (let i = 0; i <= bins; i++) {
      Composite.add(world, Bodies.rectangle(i * binW, H - slotZone / 2 + 20, 6, slotZone, {
        isStatic: true, restitution: 0.3, label: "divider",
      }));
    }
    for (let i = 0; i < bins; i++) {
      const cx = i * binW + binW / 2;
      const sensor = Bodies.rectangle(cx, H - 8, binW - 8, 14, { isStatic: true, isSensor: true, label: "slot" });
      sensor.slotValue = slots[i]; sensor.slotX = cx;
      slotSensors.push(sensor); Composite.add(world, sensor);
    }
  }

  // =====================================================================
  //  KELERENG
  // =====================================================================
  function pipeAim(now) {
    const g = CONFIG.gameplay;
    const phase = (now / g.pipeSweepMs) * Math.PI * 2;
    const ang = Math.sin(phase) * (g.pipeMaxAngle * Math.PI / 180);
    const dx = Math.sin(ang), dy = Math.cos(ang);
    // pivot pipa responsif: di HP (layar sempit) rank lebih atas -> pipa naik biar dekat rank
    const len = 18, pivotY = (W < 700 ? 92 : 122), speed = g.pipeLaunchSpeed;
    return { angle: ang, pivotX: W / 2, pivotY, x: W / 2 + dx * len, y: pivotY + dy * len,
      vx: dx * speed, vy: Math.max(2, dy * speed) };
  }

  function makeMarble(opts = {}) {
    // antrian/cap: kalau enabled & arena penuh -> bola di-drop. Kalau disabled -> selalu muncul.
    if (CONFIG.gameplay.queueEnabled && marbles.length >= CONFIG.gameplay.maxMarbles && !opts.force) return null;
    const radius = opts.radius || 9;
    let x, y, vx, vy;
    if (opts.x != null) {
      x = opts.x; y = opts.y != null ? opts.y : 14;
      vx = (Math.random() * 2 - 1); vy = 0;
    } else {
      const aim = pipeAim(performance.now());
      x = aim.x; y = aim.y; vx = aim.vx; vy = aim.vy;
    }
    const body = Bodies.circle(x, y, radius, {
      restitution: 0.55, friction: 0.002, frictionAir: 0.004,
      density: opts.density || 0.001, label: "marble",
    });
    Body.setVelocity(body, { x: vx, y: vy });
    const marble = {
      body, radius,
      color: opts.color || "#e5e7eb",
      name: opts.name || null,
      isNamed: !!opts.isNamed,
      owner: opts.owner || null,        // nama gifter pemilik bola (null = idle/tap-tap)
      coinShare: opts.coinShare || 0,   // jatah koin bola ini utk klasifikasi plus/minus
      mult: opts.mult || 1,
      value: opts.value != null ? opts.value : 10,  // poin per bola (engagement 10, gifter 100)
      trail: [], trailMax: opts.trailMax || (opts.isNamed ? 14 : 6),
      glow: opts.glow || 12,
    };
    body.marbleRef = marble;
    marbles.push(marble); Composite.add(world, body);
    return marble;
  }

  function removeMarble(marble) {
    const i = marbles.indexOf(marble);
    if (i >= 0) marbles.splice(i, 1);
    Composite.remove(world, marble.body);
  }

  // =====================================================================
  //  TUMBUKAN & SKOR
  // =====================================================================
  function onCollision(evt) {
    for (const pair of evt.pairs) {
      const { bodyA, bodyB } = pair;
      const marble = bodyA.marbleRef || bodyB.marbleRef;
      const other = bodyA.marbleRef ? bodyB : bodyA;
      if (!marble) continue;
      if (other.label === "peg" || other.label === "bar" || other.label === "divider") {
        const speed = Vector.magnitude(marble.body.velocity);
        AudioFX.chime(marble.body.position.x / W, Math.min(1, speed / 10));
        spawnSparkle(marble.body.position.x, marble.body.position.y, marble.color, 2);
      } else if (other.label === "slot") {
        scoreMarble(marble, other);
      }
    }
  }

  function scoreMarble(marble, sensor) {
    const val = sensor.slotValue;
    if (typeof val === "number" && val !== 0) {
      const pts = Math.round(marble.value * val * marble.mult);  // nilai bola × multiplier slot
      addScore(pts);
      const positive = pts > 0;
      // (koin plus/minus sudah diklasifikasi INSTAN saat gift, bukan di sini)
      floatTexts.push({
        x: sensor.slotX, y: H - 40, text: (positive ? "+" : "") + pts,
        color: val >= 10 ? "#fde047" : (positive ? marble.color : "#ef4444"), life: 1,
      });
      if (positive) { AudioFX.score(val); if (val >= 10) spawnConfetti(sensor.slotX, H - 60, 24); }
      else { AudioFX.buzz(); }
    } else {
      floatTexts.push({ x: sensor.slotX, y: H - 40, text: "ZONK", color: "#64748b", life: 1 });
    }
    removeMarble(marble);
  }

  // Global Bar + WIN/MINUS (kolektif, semua bola)
  function addScore(pts) {
    if (!pts) return;
    const per = CONFIG.gameplay.scorePerLevel;
    const prev = Math.trunc(session.totalScore / per);
    session.totalScore += pts;                 // total score kumulatif
    const now = Math.trunc(session.totalScore / per);
    if (now > prev) {                          // lewat kelipatan 1000 -> LEVEL UP
      AudioFX.fanfare();
      for (let i = 0; i < 4; i++) spawnConfetti(Math.random() * W, H * 0.4, 24);
      UI.flashBanner("LEVEL UP!  LV " + (1 + session.levelBase + now), "#4ade80");
    } else if (now < prev) {                   // turun lewat kelipatan -> LEVEL DOWN
      AudioFX.buzz();
      UI.flashBanner("LEVEL DOWN  LV " + (1 + session.levelBase + now), "#ef4444");
    }
    uiDirty = true;
    saveSession();
  }

  // =====================================================================
  //  STREAM BOLA GIFTER (koin -> jumlah & durasi)
  // =====================================================================
  function startStream(owner, color, coins, minMs = 0) {
    const g = CONFIG.gameplay;
    let dur = Math.min(g.streamMaxMs, Math.max(g.streamIntervalMs, coins * g.streamMsPerCoin));
    if (minMs > dur) dur = Math.min(g.streamMaxMs, minMs); // samakan durasi stream dgn cover
    const planned = Math.max(1, Math.round(dur / g.streamIntervalMs));
    streams.push({
      owner, color, coinShare: coins / planned, ballsLeft: planned,
      interval: g.streamIntervalMs, nextAt: performance.now(), quality: ballQuality(coins),
    });
  }
  function processStreams(now) {
    for (let i = streams.length - 1; i >= 0; i--) {
      const s = streams[i];
      if (s.ballsLeft <= 0) { streams.splice(i, 1); continue; }
      // maksimal 1 bola/stream/frame -> tak ada "catch-up burst" saat lag (anti death-spiral)
      if (now >= s.nextAt) {
        s.nextAt = now + s.interval;
        s.ballsLeft--;
        makeMarble({
          owner: s.owner, name: s.owner, isNamed: true, color: s.color,
          glow: s.quality.glow, radius: s.quality.radius, trailMax: s.quality.trail,
          coinShare: s.coinShare, value: 100,   // bola gifter = 100/bola
        });
      }
    }
  }

  // =====================================================================
  //  EFEK (stacking durasi)
  // =====================================================================
  function extend(until, dur) { return Math.max(performance.now(), until) + dur; }
  // durasi efek diskala ke koin: di bawah acuan = dasar, di atasnya makin lama (capped)
  function scaledDur(base, coins) {
    const g = CONFIG.gameplay;
    if (!coins || coins <= g.effectDurRefCoins) return base;
    return Math.min(g.effectDurMaxMs, Math.round(base * (coins / g.effectDurRefCoins)));
  }

  const Effects = {
    spawnNamedMarble(p = {}) {
      makeMarble({ radius: 12, color: "#fbbf24", name: p.name || null, isNamed: true, glow: 26, force: true,
        value: p.gifter ? 100 : 10 });
    },
    marbleRain(p = {}) {
      // gifter (mis. Doughnut) -> bola NAMED warna donatur, nilai 100
      // engagement (follow) -> bola PUTIH, nilai 10
      const gifter = !!p.gifter, owner = p.name;
      const color = (gifter && owner) ? ((donors[owner] && donors[owner].color) || colorFor(owner)) : "#ffffff";
      let n = 0;
      const id = setInterval(() => {
        makeMarble({
          color,
          glow: gifter ? 20 : 12,            // donut sama spt Rose
          radius: gifter ? 12 : 8,           // donut 12 (=Rose), follow 8 (lebih kecil)
          trailMax: gifter ? 10 : 5,
          isNamed: gifter, name: gifter ? owner : null, owner: gifter ? owner : null,
          value: gifter ? 100 : 10, x: Math.random() * (W - 60) + 30,
        });
        if (++n >= 30) clearInterval(id);
      }, 33);
    },
    megaBoulder() {
      makeMarble({ radius: 20, color: "#ef4444", glow: 30, density: 0.02, mult: 3, force: true, x: W / 2 });
      AudioFX.whoosh();
    },
    lowGravity(p = {}) {
      engine.gravity.y = 0.15;
      lowGravityUntil = extend(lowGravityUntil, scaledDur(CONFIG.gameplay.lowGravityDuration, p.coins));
      UI.flashBanner("LOW GRAVITY", "#22d3ee");
    },
    flipObstacles(p = {}) {
      bars.forEach((b) => Composite.remove(world, b));
      bars = [];
      const top = 150, bottom = H - 200;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const len = 70 + Math.random() * 70;
        const bar = Bodies.rectangle(50 + Math.random() * (W - 100), top + Math.random() * Math.max(40, bottom - top),
          len, 12, { isStatic: true, restitution: 0.5, label: "bar", angle: (Math.random() * 2 - 1) * (Math.PI / 2) });
        bar.half = len / 2; bars.push(bar); Composite.add(world, bar);
      }
      flipUntil = extend(flipUntil, scaledDur(CONFIG.gameplay.flipDuration, p.coins));
      AudioFX.whoosh(); UI.flashBanner("FLIP!", "#a78bfa");
    },
    shoot() {
      const n = CONFIG.gameplay.shootCount || 1;
      const aim = pipeAim(performance.now());
      const sp = CONFIG.gameplay.shootSpeed;
      const baseVx = (aim.vx / CONFIG.gameplay.pipeLaunchSpeed) * sp;
      let any = false;
      for (let i = 0; i < n; i++) {
        const m = makeMarble({ color: "#ffffff", glow: 20 });
        if (!m) continue;
        any = true;
        Body.setVelocity(m.body, { x: baseVx + (Math.random() * 2 - 1) * 3, y: sp + (Math.random() * 2 - 1) }); // sebar sedikit
      }
      if (any) { spawnSparkle(aim.x, aim.y, "#ffffff", 12); AudioFX.shoot(); }
    },
    namedSlow(p = {}) {
      // stream bola bernama: laju = streamIntervalMs (sama spt Universe), durasi namedSlowMs (5 dtk)
      const owner = p.name || "Anonim";
      const color = (donors[owner] && donors[owner].color) || colorFor(owner);
      const interval = CONFIG.gameplay.streamIntervalMs;
      const balls = Math.max(1, Math.round(CONFIG.gameplay.namedSlowMs / interval));
      streams.push({
        owner, color, coinShare: 0,
        ballsLeft: balls, interval, nextAt: performance.now(),
        quality: { radius: 12, glow: 20, trail: 10 },
      });
    },
    coverMinus(p = {}) { addCover("minus", p.coins); UI.flashBanner("TUTUP SCORE MINUS", "#4ade80"); AudioFX.whoosh(); },
    coverPlus(p = {}) { addCover("plus", p.coins); UI.flashBanner("TUTUP SCORE PLUS", "#ef4444"); AudioFX.whoosh(); },
    blackHole(p = {}) {
      const until = extend(blackHole ? blackHole.until : 0, scaledDur(CONFIG.gameplay.blackHoleDuration, p.coins));
      blackHole = { x: W / 2, y: H * 0.45, until, launched: false };
      AudioFX.whoosh(); UI.flashBanner("BLACK HOLE", "#a78bfa");
    },
    multiplierBoost() {
      // "x5" = pengali DURASI: perpanjang semua efek aktif berdurasi ×5 dari sisa waktunya
      const now = performance.now();
      const mul = CONFIG.gameplay.multiplierBoostFactor;
      const stretch = (until) => (until > now ? now + (until - now) * mul : until);
      lowGravityUntil = stretch(lowGravityUntil);
      flipUntil = stretch(flipUntil);
      if (wind) wind.until = stretch(wind.until);
      if (blackHole) blackHole.until = stretch(blackHole.until);
      coverState.minus.until = stretch(coverState.minus.until);
      coverState.plus.until = stretch(coverState.plus.until);
      AudioFX.whoosh();
      UI.flashBanner("DURASI x" + mul, "#fde047");
    },
    chaosWind(p = {}) {
      const dir = wind ? Math.sign(wind.fx) : (Math.random() < 0.5 ? -1 : 1);
      wind = { fx: dir * 0.0006, until: extend(wind ? wind.until : 0, scaledDur(CONFIG.gameplay.chaosWindDuration, p.coins)) };
      AudioFX.whoosh(); UI.flashBanner("CHAOS WIND", "#4ade80");
    },
    nuke() {
      const count = marbles.length;
      const instant = count * CONFIG.gameplay.basePoints * 2;
      marbles.slice().forEach((m) => { spawnConfetti(m.body.position.x, m.body.position.y, 14); removeMarble(m); });
      addScore(instant); AudioFX.explosion(); AudioFX.fanfare(); UI.flashBanner("NUKE!", "#fb923c");
    },
    resetArena() {
      marbles.slice().forEach(removeMarble);
      particles = []; floatTexts = []; streams = [];
      donors = {};
      session.totalCoins = 0; session.plusCoins = 0; session.minusCoins = 0; session.likes = 0; session.totalScore = 0;
      engine.gravity.y = 1; lowGravityUntil = 0; flipUntil = 0;
      blackHole = null; wind = null;
      document.body.classList.remove("boost");
      buildBoard(); persist(); uiDirty = true;
      UI.flashBanner("RESET ARENA", "#e5e7eb");
    },
  };

  // buat satu garis penutup (rectangle menerus) dari (x1,y1) ke (x2,y2)
  function coverLine(kind, x1, y1, x2, y2) {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const body = Bodies.rectangle(cx, cy, len, 11, {
      isStatic: true, restitution: 0.4, label: "cover", angle: Math.atan2(y2 - y1, x2 - x1),
    });
    body.half = len / 2;
    Composite.add(world, body);
    coverState[kind].bodies.push(body);
  }

  function addCover(kind, coins) {
    const cs = coverState[kind];
    cs.until = extend(cs.until, scaledDur(CONFIG.gameplay.coverDuration, coins)); // STACKING + skala koin
    if (cs.bodies.length) return; // sudah ada, cukup perpanjang durasi
    const slots = CONFIG.slots, bins = slots.length, binW = W / bins;
    const topY = H - 150;            // mulut slot
    const baseY = topY + 6;          // ujung bawah garis (dekat mulut)
    const peakY = topY - 26;         // puncak garis (lebih tinggi)
    const over = binW * 0.3;         // overhang sedikit ke slot tetangga
    const clamp = (x) => Math.max(0, Math.min(W, x));

    if (kind === "minus") {
      // TENDA SEGITIGA di atas zona minus -> luncurkan ke kiri & kanan (ke plus)
      const idx = slots.map((v, i) => (typeof v === "number" && v < 0) ? i : -1).filter((i) => i >= 0);
      if (!idx.length) return;
      const xL = clamp(Math.min(...idx) * binW - over);
      const xR = clamp((Math.max(...idx) + 1) * binW + over);
      const xC = (xL + xR) / 2;
      coverLine("minus", xC, peakY, xL, baseY); // sisi kiri (luncur ke kiri)
      coverLine("minus", xC, peakY, xR, baseY); // sisi kanan (luncur ke kanan)
    } else {
      // 2 GARIS di tepi plus -> luncurkan ke tengah (ke minus)
      let l = 0; while (l < bins && typeof slots[l] === "number" && slots[l] > 0) l++;
      let r = bins - 1; while (r >= 0 && typeof slots[r] === "number" && slots[r] > 0) r--;
      if (l > 0) coverLine("plus", 0, peakY, clamp(l * binW + over), baseY);              // kiri: tinggi di tepi, turun ke tengah
      if (r < bins - 1) coverLine("plus", W, peakY, clamp((r + 1) * binW - over), baseY);  // kanan: tinggi di tepi, turun ke tengah
    }
  }

  function trigger(effectName, payload) {
    const fn = Effects[effectName];
    if (fn) fn(payload || {});
    else console.warn("Efek tidak dikenal:", effectName);
  }

  // =====================================================================
  //  EVENT TIKTOK / SIMULASI
  // =====================================================================
  function resolveGift(name, coins) {
    const m = CONFIG.mapping;
    if (name && m.giftsByName[name]) return m.giftsByName[name];
    let chosen = null;
    for (const tier of m.giftTiers) if (coins >= tier.minCoins) chosen = tier.effect;
    return chosen;
  }

  function onGift(name, coins = 1, repeat = 1, username = null) {
    coins = (coins || 1) * (repeat || 1);
    const effect = resolveGift(name, coins);
    const user = username || "Anonim";
    // (1) catat koin -> leaderboard (berbasis koin, positif) + total koin
    if (!donors[user]) donors[user] = { coins: 0, color: colorFor(user) };
    donors[user].coins += coins;
    session.totalCoins += coins;
    // klasifikasi koin INSTAN berdasarkan kondisi SCORE (WIN) saat gift masuk:
    //   WIN minus -> koin jadi push-up (koin ÷ 10) | WIN plus -> koin jadi rupiah mainan (koin × 40)
    if (session.totalScore < 0) session.minusCoins += coins;
    else session.plusCoins += coins;
    UI.feed("🎁 " + user + " • " + coins + " koin", donors[user].color);
    // (2) efek mapping (durasi diskala ke koin)
    if (effect) trigger(effect, { name: user, coins, gifter: true });
    // (3) stream bola bernama milik gifter. "namedSlow" sudah nyetel stream sendiri -> skip.
    if (effect !== "namedSlow") {
      // kalau efeknya COVER, stream berlangsung selama durasi cover.
      const coverMs = (effect === "coverMinus" || effect === "coverPlus")
        ? scaledDur(CONFIG.gameplay.coverDuration, coins) : 0;
      startStream(user, donors[user].color, coins, coverMs);
    }
    persist(); uiDirty = true;   // simpan SEGERA (gift penting)
  }

  function onLike(count = 1) {
    session.likes += count;
    const step = CONFIG.mapping.like.every;
    let acc = (onLike._acc || 0) + count;
    while (acc >= step) { acc -= step; trigger(CONFIG.mapping.like.effect, {}); }
    onLike._acc = acc;
    // tap-tap TIDAK masuk feed (terlalu sering -> bakal nelan notif gift). Cukup bola putih.
    saveSession(); uiDirty = true;
  }
  function onFollow(username) {
    if (username) UI.feed("💜 " + username + " follow!", "#a78bfa");
    trigger(CONFIG.mapping.follow, { name: username });
  }
  function onShare(username) {
    if (username) UI.feed("🔁 " + username + " share!", "#22d3ee");
    trigger(CONFIG.mapping.share, { name: username });
  }

  // =====================================================================
  //  PARTIKEL
  // =====================================================================
  const MAX_PARTICLES = 500; // batas keras partikel (anti-lag)
  function spawnSparkle(x, y, color, n) {
    if (particles.length > MAX_PARTICLES) return;
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() * 2 - 1) * 1.5, vy: (Math.random() * 2 - 1) * 1.5, life: 0.4, color, size: 2, gravity: 0 });
  }
  function spawnConfetti(x, y, n) {
    if (particles.length > MAX_PARTICLES) return;
    for (let i = 0; i < n; i++) {
      const c = colorFor("c" + Math.floor(Math.random() * 6));
      particles.push({ x, y, vx: (Math.random() * 2 - 1) * 6, vy: (Math.random() * -1) * 7 - 2, life: 1.2, color: c, size: 3 + Math.random() * 3, gravity: 0.25 });
    }
  }

  // =====================================================================
  //  LOOP
  // =====================================================================
  function loop(now) {
    lastFrameAt = now;            // tandai frame hidup (untuk watchdog)
    const dt = Math.min(33, now - lastTime);
    lastTime = now;
    AudioFX.resetFrame();

    // expire efek (stacking-aware)
    if (lowGravityUntil && now > lowGravityUntil) { engine.gravity.y = 1; lowGravityUntil = 0; }
    if (wind && now > wind.until) wind = null;
    if (flipUntil && now > flipUntil) { bars.forEach((b) => Composite.remove(world, b)); bars = []; flipUntil = 0; }
    for (const kind of ["minus", "plus"]) {
      const cs = coverState[kind];
      if (cs.until && now > cs.until) { cs.bodies.forEach((b) => Composite.remove(world, b)); cs.bodies = []; cs.until = 0; }
    }

    processStreams(now);

    // getar otomatis tiap 1 menit (anti bola nyangkut)
    if (now - lastShake >= CONFIG.gameplay.shakeIntervalMs) {
      lastShake = now;
      shakeUntil = now + CONFIG.gameplay.shakeDurationMs;
    }

    if (now - lastIdleDrop > CONFIG.gameplay.idleDropInterval) {
      lastIdleDrop = now;
      makeMarble({ color: "#e5e7eb", glow: 10 });
    }

    applyForces(now);
    Engine.update(engine, dt);
    cleanup();
    render();
    uiTick(now);
    requestAnimationFrame(loop);
  }

  function applyForces(now) {
    // getar: kasih kick acak kecil ke semua bola biar yang nyangkut lepas
    if (now < shakeUntil) {
      const s = CONFIG.gameplay.shakeStrength;
      for (const m of marbles) Body.setVelocity(m.body, {
        x: m.body.velocity.x + (Math.random() * 2 - 1) * s,
        y: m.body.velocity.y + (Math.random() * 2 - 1) * s,
      });
    }
    if (wind) for (const m of marbles) Body.applyForce(m.body, m.body.position, { x: wind.fx * m.body.mass, y: 0 });
    if (blackHole) {
      if (now < blackHole.until) {
        for (const m of marbles) {
          const d = Vector.sub(blackHole, m.body.position);
          const dist = Math.max(20, Vector.magnitude(d));
          if (dist < 320) Body.applyForce(m.body, m.body.position, Vector.mult(Vector.normalise(d), 0.0009 * m.body.mass));
        }
      } else if (!blackHole.launched) {
        for (const m of marbles) {
          const d = Vector.sub(m.body.position, blackHole);
          const dir = Vector.normalise({ x: d.x || Math.random() - 0.5, y: d.y || -1 });
          Body.setVelocity(m.body, Vector.mult(dir, 22));
        }
        AudioFX.explosion(); blackHole = null;
      }
    }
  }

  function cleanup() {
    for (const m of marbles.slice()) {
      const p = m.body.position;
      if (p.y > H + 80 || p.x < -80 || p.x > W + 80) removeMarble(m);
    }
    for (const pt of particles) { pt.vx *= 0.98; pt.vy += pt.gravity; pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.02; }
    particles = particles.filter((p) => p.life > 0);
    for (const ft of floatTexts) { ft.y -= 0.6; ft.life -= 0.02; }
    floatTexts = floatTexts.filter((f) => f.life > 0);
    for (const m of marbles) {
      m.trail.push({ x: m.body.position.x, y: m.body.position.y });
      if (m.trail.length > m.trailMax) m.trail.shift();
    }
  }

  // throttle update UI numerik (~10x/dtk)
  function uiTick(now) {
    if (now - lastUiAt < 100) return;
    lastUiAt = now;
    if (uiDirty) {
      UI.update({ donors, likes: session.likes }, session.totalScore);
      UI.session({
        level: levelNow(),
        // mainan & push-up sama-sama dari TOTAL koin; tanda SCORE nentuin yang ditampilkan
        toy: Math.round(session.totalCoins * CONFIG.gameplay.rupiahPerCoin),
        pushup: Math.floor(session.totalCoins / CONFIG.gameplay.coinsPerPushup),
        coins: Math.round(session.totalCoins),
        minus: session.totalScore < 0,   // score minus -> tampil push-up; plus -> mainan
        score: Math.round(session.totalScore),
      });
      uiDirty = false;
    }
    UI.effects(activeEffects(now)); // countdown -> update tiap tick
    // countdown gempa
    const remain = Math.ceil((lastShake + CONFIG.gameplay.shakeIntervalMs - now) / 1000);
    UI.gempa(now < shakeUntil ? -1 : Math.max(0, remain));
  }

  // daftar efek aktif + sisa waktu (termasuk durasi stream gift)
  function activeEffects(now) {
    const list = [];
    if (lowGravityUntil > now) list.push({ n: "Low Gravity", ms: lowGravityUntil - now, c: "#22d3ee" });
    if (flipUntil > now) list.push({ n: "Flip", ms: flipUntil - now, c: "#a78bfa" });
    if (wind && wind.until > now) list.push({ n: "Chaos Wind", ms: wind.until - now, c: "#4ade80" });
    if (blackHole && blackHole.until > now) list.push({ n: "Black Hole", ms: blackHole.until - now, c: "#a78bfa" });
    if (coverState.minus.until > now) list.push({ n: "Tutup Minus", ms: coverState.minus.until - now, c: "#4ade80" });
    if (coverState.plus.until > now) list.push({ n: "Tutup Plus", ms: coverState.plus.until - now, c: "#ef4444" });
    // durasi stream gift (berapa lama tembakan bola gifter berlangsung)
    for (const s of streams) list.push({ n: "🌊 " + s.owner, ms: s.ballsLeft * s.interval, c: s.color });
    return list;
  }

  // =====================================================================
  //  RENDER
  // =====================================================================
  function render() {
    ctx.clearRect(0, 0, W, H);
    const stops = bgForLevel(levelNow());
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, stops[0]); bg.addColorStop(1, stops[1]);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    drawSlots(); drawPegsAndBars(); drawCovers(); drawPipe();
    drawParticles(); drawMarbles(); drawBlackHole(); drawFloatTexts();
  }

  function drawPipe() {
    const a = pipeAim(performance.now());
    ctx.save();
    ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 13; ctx.lineCap = "round";
    ctx.shadowBlur = 16; ctx.shadowColor = "#22d3ee";
    ctx.beginPath(); ctx.moveTo(a.pivotX, a.pivotY); ctx.lineTo(a.x, a.y); ctx.stroke();
    ctx.fillStyle = "#0ea5e9"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(a.pivotX, a.pivotY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCovers() {
    const all = coverState.minus.bodies.map((b) => ["minus", b]).concat(coverState.plus.bodies.map((b) => ["plus", b]));
    for (const [kind, b] of all) {
      const a = b.angle, col = kind === "minus" ? "#4ade80" : "#ef4444";
      ctx.save();
      ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineCap = "round";
      ctx.shadowBlur = 16; ctx.shadowColor = col;
      ctx.beginPath();
      ctx.moveTo(b.position.x - Math.cos(a) * b.half, b.position.y - Math.sin(a) * b.half);
      ctx.lineTo(b.position.x + Math.cos(a) * b.half, b.position.y + Math.sin(a) * b.half);
      ctx.stroke(); ctx.restore();
    }
  }

  function drawSlots() {
    const slots = CONFIG.slots, bins = slots.length, binW = W / bins, slotZone = 150;
    ctx.textAlign = "center"; ctx.font = "bold 18px system-ui, sans-serif";
    for (let i = 0; i < bins; i++) {
      const cx = i * binW + binW / 2, val = slots[i];
      let col = "#334155", label = "ZONK";
      if (typeof val === "number" && val !== 0) {
        label = (val > 0 ? "x" : "") + val;
        if (val >= 10) col = "#fde047"; else if (val >= 5) col = "#fb923c";
        else if (val >= 2) col = "#22d3ee"; else if (val > 0) col = "#475569";
        else if (val <= -10) col = "#ef4444"; else if (val <= -5) col = "#f87171"; else col = "#fca5a5";
      } else col = "#1e293b";
      ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = col; ctx.fillStyle = col + "22";
      ctx.fillRect(i * binW + 4, H - slotZone, binW - 8, slotZone); ctx.restore();
      ctx.fillStyle = col; ctx.fillText(label, cx, H - slotZone / 2);
    }
    ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = "#22d3ee"; ctx.strokeStyle = "#22d3ee55"; ctx.lineWidth = 2;
    for (let i = 0; i <= bins; i++) { ctx.beginPath(); ctx.moveTo(i * binW, H - slotZone); ctx.lineTo(i * binW, H); ctx.stroke(); }
    ctx.restore();
  }

  function drawPegsAndBars() {
    // getar: geser gambar paku sedikit acak saat shake aktif
    const shaking = performance.now() < shakeUntil;
    const amp = CONFIG.gameplay.shakeStrength * 1.4;
    const ox = shaking ? (Math.random() * 2 - 1) * amp : 0;
    const oy = shaking ? (Math.random() * 2 - 1) * amp : 0;
    ctx.save(); ctx.shadowBlur = shaking ? 16 : 10; ctx.shadowColor = "#38bdf8"; ctx.fillStyle = "#7dd3fc";
    for (const p of pegs) { ctx.beginPath(); ctx.arc(p.position.x + ox, p.position.y + oy, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = "#a78bfa"; ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 10; ctx.lineCap = "round";
    for (const b of bars) {
      const a = b.angle, len = b.half || 45;
      ctx.beginPath();
      ctx.moveTo(b.position.x - Math.cos(a) * len, b.position.y - Math.sin(a) * len);
      ctx.lineTo(b.position.x + Math.cos(a) * len, b.position.y + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarbles() {
    // mode hemat saat bola banyak: matikan glow & trail biar tetap mulus
    const heavy = marbles.length > 90;
    // saat ramai, nama hanya tampil di bola bernama TERBARU (8 terakhir)
    let nameSet = null;
    if (heavy) {
      nameSet = new Set();
      let c = 0;
      for (let i = marbles.length - 1; i >= 0 && c < 8; i--) {
        const mm = marbles[i];
        if (mm.isNamed && mm.name) { nameSet.add(mm); c++; }
      }
    }
    for (const m of marbles) {
      if (!heavy && m.trail.length > 1) {
        ctx.save(); ctx.strokeStyle = m.color; ctx.lineWidth = m.radius * 0.8; ctx.lineCap = "round"; ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.moveTo(m.trail[0].x, m.trail[0].y);
        for (const t of m.trail) ctx.lineTo(t.x, t.y);
        ctx.stroke(); ctx.restore();
      }
      const p = m.body.position;
      ctx.save();
      if (!heavy) { ctx.shadowBlur = m.glow; ctx.shadowColor = m.color; } // shadowBlur mahal -> skip saat ramai
      ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, m.radius, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath(); ctx.arc(p.x - m.radius * 0.3, p.y - m.radius * 0.3, m.radius * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (m.isNamed && m.name && (!heavy || nameSet.has(m))) {
        ctx.save(); ctx.font = "bold 12px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillStyle = "#fff"; ctx.shadowBlur = 4; ctx.shadowColor = "#000";
        ctx.fillText(m.name, p.x, p.y - m.radius - 6); ctx.restore();
      }
    }
  }

  function drawParticles() {
    // tanpa shadowBlur (mahal) -> ratusan partikel tetap ringan
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawBlackHole() {
    if (!blackHole) return;
    const g = ctx.createRadialGradient(blackHole.x, blackHole.y, 4, blackHole.x, blackHole.y, 70);
    g.addColorStop(0, "#000"); g.addColorStop(0.6, "#1e1b4b"); g.addColorStop(1, "rgba(167,139,250,0)");
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(blackHole.x, blackHole.y, 70, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2; ctx.shadowBlur = 20; ctx.shadowColor = "#a78bfa";
    ctx.beginPath(); ctx.arc(blackHole.x, blackHole.y, 30, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  function drawFloatTexts() {
    ctx.textAlign = "center"; ctx.font = "bold 16px system-ui, sans-serif";
    for (const ft of floatTexts) {
      ctx.save(); ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color;
      ctx.shadowBlur = 6; ctx.shadowColor = ft.color; ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
    }
  }

  // =====================================================================
  //  INPUT & SETTING
  // =====================================================================
  function bindInput() {
    window.addEventListener("keydown", (e) => {
      AudioFX.resume();
      const kg = CONFIG.keyGifts[e.key];
      if (kg) { e.preventDefault(); onGift(kg.g, kg.c, 1, randomGifter()); }
    });
    const unlock = () => AudioFX.resume();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
  }

  function applySettings(vals) {
    if (vals.totalCoins != null) session.totalCoins = +vals.totalCoins || 0;
    if (vals.plusCoins != null) session.plusCoins = +vals.plusCoins || 0;
    if (vals.minusCoins != null) session.minusCoins = +vals.minusCoins || 0;
    if (vals.levelBase != null) session.levelBase = +vals.levelBase || 0;
    if (vals.likes != null) session.likes = +vals.likes || 0;
    persist(); uiDirty = true;   // simpan segera saat host atur manual
  }
  function getSession() { return Object.assign({ level: levelNow() }, session); }

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  // =====================================================================
  //  DEMO / DEV
  // =====================================================================
  function runDemo() {
    if (!/[?&]demo/.test(location.search)) return;
    for (let i = 0; i < 20; i++) makeMarble({ color: colorFor("d" + i), glow: 16, x: Math.random() * (W - 60) + 30, y: Math.random() * (H * 0.5) });
    if (/cover/.test(location.search)) { Effects.coverMinus(); Effects.coverPlus(); }
    if (/flip/.test(location.search)) Effects.flipObstacles();
    if (/boulder/.test(location.search)) Effects.megaBoulder();
    if (/gift/.test(location.search)) {
      onGift("Galaxy", 1000, 1, "Andi");
      onGift("Rose", 50, 1, "Budi");
      onGift("Universe", 10000, 1, "Citra");
      onFollow("Sinta"); onShare("Rudi"); onLike(250);
    }
    if (/winminus/.test(location.search)) { session.totalScore = -1500; uiDirty = true; }
    if (/stress/.test(location.search)) {
      for (let i = 0; i < 4; i++) onGift("Universe", 10000, 1, "Tester" + i);
      shakeUntil = performance.now() + 600;
    }
    if (/shake/.test(location.search)) shakeUntil = performance.now() + 5000;
  }

  // test donasi: tambah koin + stream bola bernama (tanpa efek mapping), buat tombol test
  function testGift(coins, user) {
    if (!donors[user]) donors[user] = { coins: 0, color: colorFor(user) };
    donors[user].coins += coins;
    session.totalCoins += coins;
    UI.feed("🎁 " + user + " • " + coins + " koin", donors[user].color);
    startStream(user, donors[user].color, coins);
    persist(); uiDirty = true;
  }

  return {
    init, trigger, onGift, onLike, onFollow, onShare, applySettings, getSession, testGift, randomGifter,
    simulateGift: (name, coins, repeat) => onGift(name, coins || 1, repeat || 1, randomGifter()),
    simulateLike: (n) => onLike(n || 100),
    simulateFollow: () => onFollow(randomGifter()),
    simulateShare: () => onShare(randomGifter()),
  };
})();

window.Game = Game;
window.addEventListener("DOMContentLoaded", Game.init);
