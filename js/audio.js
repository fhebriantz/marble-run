/* =====================================================================
 *  AUDIO ENGINE — Web Audio API (synth, tanpa file aset)
 *  - chime "ting" saat kelereng memantul di paku
 *  - suara khusus: skor masuk, ledakan, bar penuh
 * ===================================================================== */

const AudioFX = (() => {
  let ctx = null;
  let master = null;
  let chimesThisFrame = 0;

  // skala pentatonik (C major pentatonic) -> selalu enak didengar walau acak
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = CONFIG.audio.masterVolume;
    master.connect(ctx.destination);
  }

  // Browser butuh interaksi user sebelum audio jalan. Panggil ini saat klik/tap/tekan.
  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }

  function resetFrame() {
    chimesThisFrame = 0;
  }

  function tone(freq, dur, type, gain, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // chime saat memantul; pitch dipilih dari skala berdasarkan posisi x (0..1)
  function chime(xNorm = 0.5, velocity = 1) {
    if (!CONFIG.audio.enabled || !ctx) return;
    if (chimesThisFrame >= CONFIG.audio.maxChimesPerFrame) return;
    chimesThisFrame++;
    const idx = Math.min(SCALE.length - 1, Math.floor(xNorm * SCALE.length));
    const freq = SCALE[idx] * (1 + (Math.random() * 0.02 - 0.01));
    const gain = Math.min(0.5, 0.12 + velocity * 0.05);
    tone(freq, 0.18, "triangle", gain);
  }

  function score(multiplier = 1) {
    if (!CONFIG.audio.enabled || !ctx) return;
    const base = multiplier >= 10 ? 880 : 659.25;
    tone(base, 0.12, "square", 0.18);
    tone(base * 1.5, 0.18, "triangle", 0.14, 0.06);
  }

  // arpeggio naik untuk momen besar (bar penuh / nuke)
  function fanfare() {
    if (!CONFIG.audio.enabled || !ctx) return;
    SCALE.forEach((f, i) => tone(f, 0.35, "triangle", 0.18, i * 0.06));
  }

  function explosion() {
    if (!CONFIG.audio.enabled || !ctx) return;
    // noise burst sederhana via banyak osilator rendah
    for (let i = 0; i < 6; i++) {
      tone(80 + Math.random() * 120, 0.4, "sawtooth", 0.08, Math.random() * 0.05);
    }
    tone(1200, 0.25, "triangle", 0.12, 0.02);
  }

  function whoosh() {
    if (!CONFIG.audio.enabled || !ctx) return;
    tone(220, 0.5, "sine", 0.1);
    tone(330, 0.5, "sine", 0.08, 0.05);
  }

  // suara "gagal/minus" — turun & berdengung
  function buzz() {
    if (!CONFIG.audio.enabled || !ctx) return;
    tone(196, 0.18, "sawtooth", 0.16);
    tone(146.83, 0.28, "sawtooth", 0.16, 0.12);
  }

  // suara "tembak" — pew cepat
  function shoot() {
    if (!CONFIG.audio.enabled || !ctx) return;
    tone(1046.5, 0.05, "square", 0.16);
    tone(523.25, 0.12, "square", 0.12, 0.04);
  }

  return { init, resume, resetFrame, chime, score, fanfare, explosion, whoosh, buzz, shoot };
})();
