/* =====================================================================
 *  TIKTOK BRIDGE — penyambung event TikTok -> Game (via WebSocket)
 *
 *  Bagian ini OPSIONAL. Untuk testing manual di laptop/HP, biarkan
 *  CONFIG.tiktok.enabled = false (di config.js).
 *
 *  Saat siap live, nyalakan dan jalankan relay yang mengirim pesan JSON
 *  ke WebSocket ini. Format pesan yang diharapkan:
 *
 *    { "type": "gift",   "name": "Rose", "coins": 1, "repeat": 1, "user": "andi" }
 *    { "type": "like",   "count": 50 }
 *    { "type": "follow", "user": "andi" }
 *    { "type": "share",  "user": "andi" }
 *
 *  Relay gratis yang direkomendasikan: TikTok-Live-Connector (Node.js).
 *  Lihat README untuk contoh server relay.
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
    switch (data.type) {
      case "gift":   Game.onGift(data.name, data.coins || 1, data.repeat || 1, data.user); break;
      case "like":   Game.onLike(data.count || 1); break;
      case "follow": Game.onFollow(data.user); break;
      case "share":  Game.onShare(data.user); break;
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
