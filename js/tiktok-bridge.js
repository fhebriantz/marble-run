/* =====================================================================
 *  TIKTOK BRIDGE — penyambung event TikTok -> Game (via WebSocket)
 *
 *  Bagian ini OPSIONAL. Untuk testing manual di laptop/HP, biarkan
 *  CONFIG.tiktok.enabled = false (di config.js).
 *
 *  Bridge ini MENGERTI 2 FORMAT sekaligus (auto-detect):
 *
 *  (A) Format RELAY bawaan (server/relay.js):
 *    { "type": "gift",   "name": "Rose", "coins": 1, "repeat": 1, "user": "andi" }
 *    { "type": "like",   "count": 50 }
 *    { "type": "follow", "user": "andi" }
 *    { "type": "share",  "user": "andi" }
 *
 *  (B) Format TIKFINITY (WebSocket server lokal, default ws://localhost:21213/):
 *    { "event": "gift",   "data": { "giftName":"Rose", "diamondCount":1,
 *                                   "repeatCount":1, "repeatEnd":true,
 *                                   "giftType":1, "nickname":"Andi",
 *                                   "uniqueId":"andi_xyz" } }
 *    { "event": "like",   "data": { "likeCount":15, "nickname":"Andi" } }
 *    { "event": "social", "data": { "displayType":"...follow...",
 *                                   "nickname":"Andi" } }
 *    -> nama gifter diambil dari nickname (fallback uniqueId) lalu
 *       diteruskan ke Game agar NEMPEL ke marble & leaderboard.
 *
 *  Relay gratis yang direkomendasikan: TikTok-Live-Connector (Node.js)
 *  ATAU Tikfinity (Windows). Lihat README untuk setup keduanya.
 * ===================================================================== */

const TikTokBridge = (() => {
  let ws = null;
  let retry = 0;

  function connect() {
    const url = CONFIG.tiktok.websocketUrl;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      console.warn("Gagal membuat WebSocket:", e);
      return scheduleReconnect();
    }

    ws.onopen = () => { retry = 0; console.log("[TikTok] terhubung:", url); };
    ws.onclose = () => scheduleReconnect();
    ws.onerror = () => { /* ditangani oleh onclose */ };
    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch { return; }
      route(data);
    };
  }

  function route(data) {
    // Format TIKFINITY: ada field "event" + "data"
    if (data && data.event && data.data && typeof data.data === "object") {
      return routeTikfinity(data.event, data.data);
    }
    // Format RELAY bawaan: ada field "type"
    switch (data.type) {
      case "gift":   Game.onGift(data.name, data.coins || 1, data.repeat || 1, data.user); break;
      case "like":   Game.onLike(data.count || 1); break;
      case "follow": Game.onFollow(data.user); break;
      case "share":  Game.onShare(data.user); break;
      default: break;
    }
  }

  // ---- parser format Tikfinity (TikTok-Live-Connector di balik layar) ----
  function routeTikfinity(event, d) {
    // nama gifter: nickname (nama tampil) -> fallback uniqueId (@handle)
    const user = d.nickname || d.uniqueId || null;

    switch (event) {
      case "gift": {
        // Gift "streakable" (giftType 1) mengirim banyak event saat ditahan;
        // hanya hitung saat streak SELESAI (repeatEnd) biar tidak dobel.
        if (d.giftType === 1 && d.repeatEnd === false) return;
        const name   = d.giftName || "Gift";
        const coins  = d.diamondCount || 1;   // koin per 1 gift
        const repeat = d.repeatCount  || 1;   // berapa kali (onGift mengalikan)
        Game.onGift(name, coins, repeat, user);
        break;
      }
      case "like":
        Game.onLike(d.likeCount || d.count || 1);
        break;
      case "follow":
        Game.onFollow(user);
        break;
      case "share":
        Game.onShare(user);
        break;
      case "social": {
        // follow & share kadang dikirim sebagai "social" + displayType
        const dt = String(d.displayType || d.label || "").toLowerCase();
        if (dt.includes("follow"))     Game.onFollow(user);
        else if (dt.includes("share")) Game.onShare(user);
        break;
      }
      default: break;
    }
  }

  function scheduleReconnect() {
    retry = Math.min(retry + 1, 6);
    const delay = retry * 1500;
    setTimeout(connect, delay);
  }

  return { connect };
})();

window.TikTokBridge = TikTokBridge;
