/* ラジオ体操 出席カード */
import {
  dateKey,
  monthCells,
  calcStreak,
  pickStamp,
  parseStoredData,
  yearLabel,
  pickPraise,
} from "./src/logic.js";
import { shareFileName, chooseShareMethod, captureCardImage } from "./src/share.js";

(() => {
  "use strict";

  // ---- 期間: その年の 7/1〜8/31(夏休みカード) ----
  const now = new Date();
  const YEAR = now.getFullYear();
  const MONTHS = [7, 8];
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];

  const STORAGE_KEY = `radio-taiso-card-${YEAR}`;

  const $ = (sel) => document.querySelector(sel);
  const monthsEl = $("#months");
  const overlayEl = $("#stamp-overlay");
  const cardEl = $("#card");
  const toastEl = $("#toast");

  const todayKey = dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // ---- 保存データ ----
  function loadData() {
    return parseStoredData(localStorage.getItem(STORAGE_KEY));
  }
  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* プライベートモード等では保存できないが動作は続ける */ }
  }
  let data = loadData();

  // ---- なまえ ----
  const nameInput = $("#name-input");
  nameInput.value = data.name || "";
  nameInput.addEventListener("input", () => {
    data.name = nameInput.value;
    saveData();
  });

  // ---- 年表示(令和つき) ----
  $("#year-label").textContent = yearLabel(YEAR);

  // ---- カレンダー描画 ----
  function buildCalendars() {
    monthsEl.textContent = "";
    for (const month of MONTHS) {
      const section = document.createElement("section");
      section.className = "month";

      const title = document.createElement("h2");
      title.className = "month-title";
      title.innerHTML = `${month}<span class="gatsu">月</span>`;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "grid";

      DOW.forEach((label, i) => {
        const el = document.createElement("div");
        el.className = "dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
        el.textContent = label;
        grid.appendChild(el);
      });

      const { leading, days } = monthCells(YEAR, month);

      for (let i = 0; i < leading; i++) {
        const pad = document.createElement("div");
        pad.className = "day empty";
        grid.appendChild(pad);
      }

      for (const { d, dow, key } of days) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "day" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "");
        cell.dataset.date = key;

        if (key === todayKey) {
          cell.classList.add("today");
          const badge = document.createElement("span");
          badge.className = "today-badge";
          badge.textContent = "きょう";
          cell.appendChild(badge);
          cell.setAttribute("aria-label", `${month}月${d}日(きょう) ハンコをおす`);
        } else {
          cell.disabled = true;
          if (key < todayKey) cell.classList.add("past");
          cell.setAttribute("aria-label", `${month}月${d}日`);
        }

        const num = document.createElement("span");
        num.className = "day-num";
        num.textContent = d;
        cell.appendChild(num);

        if (data.stamps[key]) {
          attachStamp(cell, data.stamps[key], false);
          cell.classList.add("stamped");
        }

        cell.addEventListener("click", () => onDayClick(cell, key));
        grid.appendChild(cell);
      }

      section.appendChild(grid);
      monthsEl.appendChild(section);
    }
  }

  // マスに定着済みハンコを描く
  function attachStamp(cell, stamp, fresh) {
    const holder = document.createElement("span");
    holder.className = "day-stamp" + (fresh ? " fresh" : "");
    holder.innerHTML =
      `<svg viewBox="0 0 100 100" style="transform:rotate(${stamp.rot}deg)"><use href="#${stamp.kind}"/></svg>`;
    cell.appendChild(holder);
  }

  // ---- クリック ----
  let stamping = false;
  function onDayClick(cell, key) {
    if (key !== todayKey) return;
    if (data.stamps[key]) {
      cell.classList.remove("wiggle");
      void cell.offsetWidth;
      cell.classList.add("wiggle");
      showToast("きょうの ぶんは もう おしたよ!");
      return;
    }
    if (stamping) return;
    stamping = true;

    const stamp = pickStamp();
    // 状態の確定は演出より先に、同期的に行う
    // (アニメーションが中断される環境でも保存が欠けないように)
    data.stamps[key] = stamp;
    saveData();
    updateStats();

    // ここから先は演出。done は必ず1回だけ呼ばれる
    playStampAnimation(cell, stamp, () => {
      attachStamp(cell, stamp, true);
      cell.classList.add("stamped");
      showToast(pickPraise());
      stamping = false;
    });
  }

  // ---- スタンプ演出 ----
  function playStampAnimation(cell, stamp, done) {
    const rect = cell.getBoundingClientRect();
    // マス内のハンコ描画領域(inset 12% 4% 2% 4%)に合わせる
    const w = rect.width * 0.92;
    const h = rect.height * 0.86;
    const size = Math.min(w, h);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.12 + h / 2;

    const flying = document.createElement("div");
    flying.className = "stamp-flying";
    flying.style.setProperty("--rot", `${stamp.rot}deg`);
    flying.style.width = `${size}px`;
    flying.style.height = `${size}px`;
    flying.style.left = `${cx - size / 2}px`;
    flying.style.top = `${cy - size / 2}px`;
    flying.innerHTML = `<svg viewBox="0 0 100 100"><use href="#${stamp.kind}"/></svg>`;
    overlayEl.appendChild(flying);

    const ripple = document.createElement("div");
    ripple.className = "stamp-ripple";
    const rs = size * 1.1;
    ripple.style.width = `${rs}px`;
    ripple.style.height = `${rs}px`;
    ripple.style.left = `${cx - rs / 2}px`;
    ripple.style.top = `${cy - rs / 2}px`;
    overlayEl.appendChild(ripple);

    const pon = document.createElement("div");
    pon.className = "stamp-pon";
    pon.textContent = "ポンッ!";
    pon.style.left = `${cx}px`;
    pon.style.top = `${rect.top - 8}px`;
    overlayEl.appendChild(pon);

    // 着弾のタイミングで音とゆれ
    setTimeout(() => {
      playPonSound();
      cardEl.classList.remove("shake");
      void cardEl.offsetWidth;
      cardEl.classList.add("shake");
    }, 380);

    // animationend と時間フォールバックの早い者勝ち(必ず1回だけ発火)
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
      // 定着ハンコに切り替わったら飛んでいた方は消す
      requestAnimationFrame(() => flying.remove());
      setTimeout(() => { ripple.remove(); pon.remove(); }, 900);
    };
    flying.addEventListener("animationend", finish, { once: true });
    setTimeout(finish, 900); // アニメーション時間(620ms)+余裕
  }

  // ---- 効果音(WebAudioで「ポンッ」) ----
  let audioCtx = null;
  function playPonSound() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      const t = audioCtx.currentTime;

      // 低い「ドンッ」
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.2);

      // 紙を打つ「パッ」(短いノイズ)
      const len = Math.floor(audioCtx.sampleRate * 0.06);
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const noise = audioCtx.createBufferSource();
      noise.buffer = buf;
      const nGain = audioCtx.createGain();
      nGain.gain.setValueAtTime(0.22, t);
      nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      const filter = audioCtx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      noise.connect(filter).connect(nGain).connect(audioCtx.destination);
      noise.start(t);
    } catch (_) { /* 音が出なくても遊べる */ }
  }

  // ---- 統計 ----
  function updateStats() {
    const total = Object.keys(data.stamps).length;
    $("#stat-total").textContent = total;
    $("#stat-streak").textContent = calcStreak(data.stamps, {
      y: now.getFullYear(),
      m: now.getMonth() + 1,
      d: now.getDate(),
    });
  }

  // ---- 期間外の案内 ----
  function updateNotice() {
    const noticeEl = $("#notice");
    const inPeriod = now.getFullYear() === YEAR && MONTHS.includes(now.getMonth() + 1);
    if (!inPeriod) {
      noticeEl.textContent = "いまは カードの きかんがい です。なつやすみに また あおうね!";
      noticeEl.classList.add("closed");
    }
  }

  // ---- リセット ----
  $("#reset-btn").addEventListener("click", () => {
    if (!confirm("ハンコを ぜんぶ けして、カードを あたらしく しますか?")) return;
    data = { name: data.name, stamps: {} };
    saveData();
    buildCalendars();
    updateStats();
    showToast("あたらしい カードに なったよ!");
  });

  // ---- 画像シェア ----
  $("#share-btn").addEventListener("click", async () => {
    let canvas;
    try {
      canvas = await captureCardImage(document.getElementById("card"));
    } catch (err) {
      console.error(err);
      showToast("がぞうを つくれなかったよ…");
      return;
    }

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], shareFileName(YEAR), { type: "image/png" });
      const method = chooseShareMethod(navigator, file);

      if (method === "share") {
        try {
          // text は渡さない(iOS/macOS のシェアシートで画像が2枚扱いになる既知問題を避ける)
          await navigator.share({ files: [file] });
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return; // シェアシートを閉じただけ
          // シェアに失敗したらダウンロードに切りかえる
        }
      }

      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = shareFileName(YEAR);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("がぞうを ほぞんしたよ!");
    }, "image/png");
  });

  // ---- トースト ----
  let toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // ---- 起動 ----
  buildCalendars();
  updateStats();
  updateNotice();
})();
