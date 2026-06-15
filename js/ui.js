/* =====================================================================
 *  UI — Leaderboard (TOP DONATUR + TAP TAP), Global Bar, Banner,
 *       Feed aktivitas, Panel Sesi (level/mainan/pushup/koin),
 *       Panel Efek Aktif + timer
 * ===================================================================== */

const UI = (() => {
  const lbEl = document.getElementById("leaderboard-list");
  const barEl = document.getElementById("global-bar-fill");
  const barTxt = document.getElementById("global-bar-text");
  const barWrap = document.getElementById("global-bar");
  const winEl = document.getElementById("win-count");
  const minusEl = document.getElementById("minus-count");
  const feedEl = document.getElementById("feed");
  const effEl = document.getElementById("active-effects");
  const bannerEl = document.getElementById("banner");
  // panel sesi
  const lvlEl = document.getElementById("sess-level");
  const coinEl = document.getElementById("sess-coins");
  const conseqEl = document.getElementById("fw-conseq"); // konsekuensi (mainan/pushup) di box WIN
  const scoreEl = document.getElementById("total-score");
  const gempaEl = document.getElementById("gempa");
  const rankEl = document.getElementById("rank");

  // gelar berdasarkan level: minus = sengsara, plus = tajir (maks 20 tiap arah)
  const RANK_NEG = ["Bokek", "Kere", "Melarat", "Papa Sengsara", "Gembel", "Tunawisma",
    "Pemulung", "Pengemis", "Sengsara", "Menderita Akut", "Nestapa", "Terpuruk",
    "Bangkrut Total", "Jatuh Miskin", "Kutukan Miskin", "Sengsara Abadi", "Jurang Derita",
    "Neraka Dunia", "Tersiksa Abadi", "Penderitaan Abadi"];
  const RANK_POS = ["Anak Kos", "Karyawan", "Mapan", "Borju", "Tajir", "Konglomerat",
    "Crazy Rich", "Miliarder", "Triliuner", "Sultan", "Raja", "Maharaja", "Bangsawan Agung",
    "Penguasa Dunia", "Naga Emas", "Dewa Harta", "Sultan Langit", "Raja Semesta",
    "Dewa Kekayaan", "Sultan Surgawi"];
  function rankName(level) {
    if (level === 0) return "Rakyat Biasa";
    if (level > 0) return RANK_POS[Math.min(level, 20) - 1];
    return RANK_NEG[Math.min(-level, 20) - 1];
  }

  const MEDALS = ["👑", "🥈", "🥉"];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function rupiah(n) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

  let bannerTimer = null;

  // ---- animated counter: pertama kali (reload) langsung snap, berikutnya beranimasi ----
  const ANIM_EASE = 0.05; // kecepatan animasi angka (makin kecil makin pelan/halus)
  const counters = {};
  let conseqMode = null;
  function animNum(key, target, render) {
    const c = counters[key];
    if (!c) { counters[key] = { cur: target, target, render }; render(target); return; } // pertama: snap (reload)
    c.target = target; c.render = render;
  }
  function animLoop() {
    for (const k in counters) {
      const c = counters[k];
      const d = c.target - c.cur;
      if (Math.abs(d) < 0.5) { if (c.cur !== c.target) { c.cur = c.target; c.render(c.cur); } }
      else { c.cur += d * ANIM_EASE; c.render(c.cur); }
    }
    requestAnimationFrame(animLoop);
  }
  requestAnimationFrame(animLoop);

  function update(data, score) {
    const donors = data.donors || {};
    const likes = data.likes || 0;
    const rows = Object.entries(donors).sort((a, b) => b[1].coins - a[1].coins).slice(0, 6);
    const maxC = rows.reduce((m, r) => Math.max(m, r[1].coins), 1);

    // leaderboard: HANYA donatur (gift). Tap-tap/follow/share tidak masuk sini.
    let html = rows.map(([name, d], i) => {
      const w = Math.max(4, (d.coins / maxC) * 100);
      const rank = MEDALS[i] || (i + 1);
      return `
        <div class="lb-row">
          <span class="lb-fill" style="width:${w}%;background:${d.color}22"></span>
          <span class="lb-rank">${rank}</span>
          <span class="lb-dot" style="background:${d.color};box-shadow:0 0 8px ${d.color}"></span>
          <span class="lb-name" title="${esc(name)}">${esc(name)}</span>
          <span class="lb-pts" style="color:${d.color}">${d.coins.toLocaleString("id-ID")}</span>
        </div>`;
    }).join("");
    lbEl.innerHTML = html || `<div class="lb-empty">Menunggu donatur pertama…</div>`;

    // progress bar = posisi SCORE dalam band per-level (penuh tepat di kelipatan; turun saat score turun)
    const per = CONFIG.gameplay.scorePerLevel;
    const inBand = score >= 0 ? (score % per) : ((-score) % per);
    let pct = (score >= 0 && score % per === 0 && score !== 0) ? 100 : (inBand / per) * 100;
    if (barEl) barEl.style.width = pct + "%";
    if (barTxt) barTxt.textContent = Math.round(inBand).toLocaleString("id-ID") + " / " + per.toLocaleString("id-ID");
    if (barWrap) barWrap.classList.toggle("deficit", score < 0);
  }

  // panel sesi: level + total koin; konsekuensi tergantung WIN (plus->mainan, minus->pushup)
  function session(info) {
    if (lvlEl) {
      lvlEl.textContent = "LV " + info.level;
      lvlEl.className = "sess-level " + (info.level < 0 ? "poor" : info.level >= 6 ? "rich" : "");
    }
    if (rankEl) {
      rankEl.textContent = "Rank: " + rankName(info.level);
      rankEl.className = info.level > 0 ? "pos" : info.level < 0 ? "neg" : "neutral";
    }
    if (coinEl) animNum("coins", info.coins, (v) => { coinEl.textContent = Math.round(v).toLocaleString("id-ID"); });
    if (scoreEl) animNum("score", info.score, (v) => { scoreEl.textContent = "SCORE " + Math.round(v).toLocaleString("id-ID"); });
    if (conseqEl) {
      const plus = !info.minus;   // score minus -> push-up; plus -> mainan
      const mode = plus ? "toy" : "pushup";
      if (mode !== conseqMode) {            // ganti mode (mainan<->pushup) -> snap, jangan animasi lintas-tipe
        conseqMode = mode; delete counters["conseq"];
        conseqEl.className = "fw-conseq " + (plus ? "plus" : "minus");
      }
      const target = plus ? info.toy : info.pushup;
      animNum("conseq", target, (v) => {
        conseqEl.innerHTML = plus
          ? ("<span class='conseq-cap'>beli mainan anak</span>🧸 <b>" + rupiah(v) + "</b>")
          : ("<span class='conseq-cap'>jumlah push-up</span>💪 <b>" + Math.round(v) + "x</b>");
      });
    }
  }

  // countdown gempa (getar otomatis). sec < 0 = sedang gempa
  function gempa(sec) {
    if (!gempaEl) return;
    if (sec < 0) { gempaEl.textContent = "GEMPA!"; gempaEl.classList.add("active"); }
    else { gempaEl.textContent = "Gempa : " + sec + "s"; gempaEl.classList.remove("active"); }
  }

  // panel efek aktif + countdown
  function effects(list) {
    if (!effEl) return;
    if (!list.length) { effEl.innerHTML = ""; return; } // kosong saat tak ada efek
    effEl.innerHTML = list.map((e) => `
      <div class="eff-item" style="border-color:${e.c}66">
        <span style="color:${e.c}">${esc(e.n)}</span>
        <b>${(e.ms / 1000).toFixed(1)}s</b>
      </div>`).join("");
  }

  function flashBanner(text, color) {
    bannerEl.textContent = text;
    bannerEl.style.color = color;
    bannerEl.style.textShadow = `0 0 18px ${color}`;
    bannerEl.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.remove("show"), 1400);
  }

  function feed(text, color) {
    if (!feedEl) return;
    const div = document.createElement("div");
    div.className = "feed-item"; div.textContent = text; div.style.color = color;
    feedEl.prepend(div);
    while (feedEl.children.length > 5) feedEl.removeChild(feedEl.lastChild);
    setTimeout(() => { div.classList.add("fade"); setTimeout(() => div.remove(), 600); }, 4500);
  }

  return { update, session, effects, gempa, flashBanner, feed };
})();

window.UI = UI;
