/* =====================================================================
 *  RELAY TIKTOK -> WEBSOCKET  (untuk LIVE, opsional)
 *
 *  Membaca event live TikTok (gift/like/follow/share) lalu meneruskannya
 *  ke game lewat WebSocket. Game cukup connect ke ws://localhost:8080.
 *
 *  Jalankan saat mau live:
 *      cd server
 *      npm install
 *      node relay.js namauser_tiktok
 *
 *  Lalu di js/config.js set:  tiktok: { enabled: true, websocketUrl: "ws://localhost:8080" }
 *
 *  GRATIS, tanpa API key. Berjalan native di Linux.
 * ===================================================================== */

const { WebSocketServer } = require("ws");
// Catatan: nama class bisa beda tergantung versi paket.
//   - tiktok-live-connector v2+ : const { TikTokLiveConnection } = require("tiktok-live-connector");
//   - versi lama (v1)           : const { WebcastPushConnection } = require("tiktok-live-connector");
const { TikTokLiveConnection } = require("tiktok-live-connector");

const username = process.argv[2];
if (!username) {
  console.error("Pakai: node relay.js <username_tiktok>");
  process.exit(1);
}

const PORT = 8080;
const wss = new WebSocketServer({ port: PORT });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log("[ws] game terhubung. Total:", clients.size);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

const tiktok = new TikTokLiveConnection(username);

tiktok.connect()
  .then((state) => console.log(`[tiktok] terhubung ke roomId ${state.roomId}`))
  .catch((err) => console.error("[tiktok] gagal connect:", err));

tiktok.on("gift", (data) => {
  // hindari double-count untuk gift streak yang masih berjalan
  if (data.giftType === 1 && !data.repeatEnd) return;
  broadcast({
    type: "gift",
    name: data.giftName,
    coins: (data.diamondCount || 0) * (data.repeatCount || 1),
    repeat: data.repeatCount || 1,
    user: data.uniqueId || data.nickname,
  });
});

tiktok.on("like", (data) => {
  broadcast({ type: "like", count: data.likeCount || 1 });
});

tiktok.on("follow", (data) => {
  broadcast({ type: "follow", user: data.uniqueId || data.nickname });
});

tiktok.on("share", (data) => {
  broadcast({ type: "share", user: data.uniqueId || data.nickname });
});

console.log(`[relay] WebSocket di ws://localhost:${PORT} — menunggu live @${username}`);
