/* Плов Каса — касса → кухня → видача, звіт під кодом власника.
   Дані: Firebase Firestore. Налаштування підключення — у config.js. */
(function () {
  "use strict";

  // ---------- small helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var money = function (n) { return Math.round(n || 0).toLocaleString("uk-UA") + " ₴"; };
  function dayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
  }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function hhmm(ms) { return new Date(ms).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var toastT = null;
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2800); }
  async function sha(text) {
    var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  // ---------- state ----------
  var fs = null, menu = null, security = null, orders = [], today = dayKey(), unsubOrders = null;
  var cart = {}, pay = "card", where = "here", busy = false;
  var soundOn = store("plov-sound") === "1", autoPrint = store("plov-print") === "1";
  var knownNew = {}, knownReady = {}, firstLoad = true;
  var unlocked = { zvit: false, nalasht: false };
  var LATE_MIN = 15;

  // ---------- tabs ----------
  var TABS = ["kasa", "kuhnya", "vydacha", "tablo", "stop", "zvit", "nalasht"];
  var tab = (location.hash || "").replace("#", "");
  if (TABS.indexOf(tab) < 0) tab = store("plov-tab") || "kasa";
  if (TABS.indexOf(tab) < 0 || tab === "zvit" || tab === "nalasht") tab = "kasa";

  function showTab(t) {
    if (tab !== t) { unlocked.zvit = false; unlocked.nalasht = false; } // leaving a locked screen locks it again
    tab = t;
    document.querySelectorAll("nav.tabs button").forEach(function (b) { b.setAttribute("aria-current", b.dataset.tab === t ? "page" : "false"); });
    TABS.forEach(function (x) { $("s-" + x).classList.toggle("on", x === t); });
    if (t !== "zvit" && t !== "nalasht") store("plov-tab", t);
    if (t === "zvit" || t === "nalasht") { pinState = { val: "", step: 0, first: "" }; }
    render();
    if (t === "zvit" && unlocked.zvit) loadReport();
  }
  document.querySelectorAll("nav.tabs button").forEach(function (b) { b.addEventListener("click", function () { showTab(b.dataset.tab); }); });

  // ---------- menu helpers ----------
  function items() { return (menu && menu.items) || []; }
  function byId(id) { return items().find(function (i) { return i.id === id; }); }
  function active() { return orders.filter(function (o) { return o.status !== "cancelled"; }); }
  function localNext() { var m = 0; orders.forEach(function (o) { if (o.num > m) m = o.num; }); return m + 1; }
  // weighed dishes (price per 100 g): cart key is "id@grams", e.g. "shashlik@350"
  function gramsOf(l) { return l.grams || (l.per100 ? 100 : 0); }
  function qtyLabel(l) {
    if (l.per100) { var g = gramsOf(l); return (l.grams ? (l.qty > 1 ? l.qty + "×" : "") + g : l.qty * 100) + " г"; }
    return l.qty + "×";
  }
  function keyInfo(key) { var p = key.split("@"); var it = byId(p[0]); return it ? { it: it, grams: p[1] ? Number(p[1]) : 0 } : null; }
  function unitPrice(it, grams) { return it.per100 ? Math.round(it.price * grams / 100) : it.price; }
  function ageMin(o) { return Math.floor((Date.now() - o.createdAt) / 60000); }
  function hasKitchen(o) { return o.items.some(function (l) { return l.kitchen; }); }

  // =========================================================
  // КАСА
  // =========================================================
  function renderMenuGrid() {
    var box = $("menuGrid");
    if (!menu) { box.innerHTML = '<p class="empty">Меню ще не завантажене. Відкрийте «Налаштування» і додайте страви.</p>'; return; }
    box.innerHTML = (menu.cats || []).map(function (c) {
      var list = items().filter(function (i) { return i.cat === c; });
      if (!list.length) return "";
      return '<div class="cat"><h3 class="sec">' + esc(c) + '</h3><div class="grid">' + list.map(function (i) {
        var q = 0, off = i.available === false;
        Object.keys(cart).forEach(function (k) { var ki = keyInfo(k); if (ki && ki.it.id === i.id) q += i.per100 ? ki.grams * cart[k] : cart[k]; });
        return '<button type="button" class="item' + (off ? " off" : "") + '" data-add="' + esc(i.id) + '">' +
          (q ? '<span class="q">' + (i.per100 ? q + " г" : "×" + q) + "</span>" : "") +
          '<span class="nm">' + esc(i.name) + "</span>" +
          '<span class="pr">' + money(i.price) + (i.per100 ? " /100 г" : "") + "</span></button>";
      }).join("") + "</div></div>";
    }).join("");
  }
  $("menuGrid").addEventListener("click", function (e) {
    var b = e.target.closest("[data-add]"); if (!b) return;
    var it = byId(b.dataset.add); if (!it) return;
    if (it.available === false) { toast(it.name + " — у стоп-листі"); return; }
    $("sent").hidden = true;
    if (it.per100) { openWeight(it); return; }
    cart[it.id] = (cart[it.id] || 0) + 1; render();
  });

  // weight entry for dishes sold by weight
  var weighing = null;
  function openWeight(it) {
    weighing = it;
    $("wName").textContent = it.name + " · " + money(it.price) + " за 100 г";
    $("wGrams").value = "";
    $("wQuick").innerHTML = [200, 250, 300, 350, 400, 500].map(function (g) { return '<button type="button" data-g="' + g + '">' + g + " г</button>"; }).join("");
    $("weightBox").hidden = false; updateWeight();
    setTimeout(function () { $("wGrams").focus(); }, 30);
  }
  function updateWeight() {
    var g = Math.round(Number($("wGrams").value) || 0);
    $("wPrice").textContent = g > 0 && weighing ? money(unitPrice(weighing, g)) : "—";
    $("wAdd").disabled = !(g >= 10 && g <= 5000);
  }
  function addWeighed() {
    var g = Math.round(Number($("wGrams").value) || 0);
    if (!weighing || !(g >= 10 && g <= 5000)) return;
    var key = weighing.id + "@" + g;
    cart[key] = (cart[key] || 0) + 1;
    weighing = null; $("weightBox").hidden = true; render();
  }
  $("wGrams").addEventListener("input", updateWeight);
  $("wGrams").addEventListener("keydown", function (e) { if (e.key === "Enter") addWeighed(); });
  $("wQuick").addEventListener("click", function (e) { var b = e.target.closest("[data-g]"); if (b) { $("wGrams").value = b.dataset.g; updateWeight(); } });
  $("wAdd").onclick = addWeighed;
  $("wCancel").onclick = function () { weighing = null; $("weightBox").hidden = true; };
  function cartIds() { return Object.keys(cart).filter(function (k) { return cart[k] > 0 && keyInfo(k); }); }
  function cartTotal() { return cartIds().reduce(function (s, k) { var ki = keyInfo(k); return s + unitPrice(ki.it, ki.grams) * cart[k]; }, 0); }
  function renderCart() {
    var ids = cartIds();
    $("lines").innerHTML = ids.length ? ids.map(function (id) {
      var ki = keyInfo(id), it = ki.it, q = cart[id];
      return '<div class="line"><span class="nm">' + esc(it.name) + (it.per100 ? "<small>" + ki.grams + " г" + (q > 1 ? " × " + q : "") + "</small>" : "") + "</span>" +
        '<span class="step"><button type="button" data-dec="' + esc(id) + '" aria-label="Менше">−</button><span>' + q + '</span><button type="button" data-inc="' + esc(id) + '" aria-label="Більше">+</button></span>' +
        '<span class="sum">' + money(unitPrice(it, ki.grams) * q) + "</span></div>";
    }).join("") : '<p class="empty">Натисніть на страви</p>';
    var total = cartTotal();
    $("total").textContent = money(total);
    $("send").disabled = !ids.length || busy || !fs;
    $("nextNum").textContent = "№ " + localNext();
    // cash change
    $("changeBox").hidden = pay !== "cash";
    if (pay === "cash") {
      var opts = [];
      [total, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100, 200, 500, 1000].forEach(function (v) { if (v >= total && v > 0 && opts.indexOf(v) < 0) opts.push(v); });
      $("quick").innerHTML = opts.slice(0, 5).map(function (v) { return '<button type="button" data-given="' + v + '">' + v + "</button>"; }).join("");
      updateChange();
    }
  }
  function updateChange() {
    var g = Number($("given").value), total = cartTotal(), box = $("changeRes");
    if (!g) { box.className = "res"; box.innerHTML = "<span>Решта</span><b>—</b>"; return; }
    var diff = g - total;
    box.className = "res" + (diff < 0 ? " short" : "");
    box.innerHTML = diff < 0 ? "<span>Не вистачає</span><b>" + money(-diff) + "</b>" : "<span>Решта</span><b>" + money(diff) + "</b>";
  }
  $("given").addEventListener("input", updateChange);
  $("quick").addEventListener("click", function (e) { var b = e.target.closest("[data-given]"); if (b) { $("given").value = b.dataset.given; updateChange(); } });
  $("lines").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.inc) cart[b.dataset.inc]++;
    if (b.dataset.dec) { cart[b.dataset.dec]--; if (cart[b.dataset.dec] <= 0) delete cart[b.dataset.dec]; }
    render();
  });
  function setPay(p) { pay = p; $("payCard").setAttribute("aria-pressed", p === "card"); $("payCash").setAttribute("aria-pressed", p === "cash"); render(); }
  function setWhere(w) { where = w; $("tHere").setAttribute("aria-pressed", w === "here"); $("tAway").setAttribute("aria-pressed", w === "away"); }
  $("payCard").onclick = function () { setPay("card"); };
  $("payCash").onclick = function () { setPay("cash"); };
  $("tHere").onclick = function () { setWhere("here"); };
  $("tAway").onclick = function () { setWhere("away"); };
  function resetCart() { cart = {}; weighing = null; $("weightBox").hidden = true; $("note").value = ""; $("table").value = ""; $("given").value = ""; setWhere("here"); pay = "card"; setPay("card"); }
  $("clear").onclick = function () { resetCart(); $("sent").hidden = true; };

  $("send").onclick = async function () {
    if (!fs || busy) return;
    var ids = cartIds(); if (!ids.length) return;
    busy = true; render();
    var lines = ids.map(function (k) {
      var ki = keyInfo(k), it = ki.it, l = { id: it.id, name: it.name, qty: cart[k], price: unitPrice(it, ki.grams), per100: !!it.per100, kitchen: it.kitchen !== false };
      if (it.per100) l.grams = ki.grams;
      return l;
    });
    var total = cartTotal();
    var base = {
      day: today, items: lines, total: total, pay: pay, where: where,
      note: $("note").value.trim().slice(0, 200), table: $("table").value.trim().slice(0, 40),
      status: lines.some(function (l) { return l.kitchen; }) ? "new" : "ready",
      createdAt: Date.now()
    };
    if (base.status === "ready") base.readyAt = Date.now();
    if (pay === "cash" && Number($("given").value) >= total) base.given = Number($("given").value);
    var num;
    function saveOffline() {
      num = localNext();
      return fs.collection("orders").doc(today + "_" + num + "_" + Math.random().toString(36).slice(2, 6)).set(Object.assign({ num: num, offline: true }, base));
    }
    try {
      if (navigator.onLine === false) {
        // no internet: Firestore keeps the write and sends it when the connection is back
        saveOffline();
      } else {
        var tx = fs.runTransaction(async function (t) {
          var cRef = fs.collection("counters").doc(today);
          var snap = await t.get(cRef);
          var n = Math.max((snap.exists ? snap.data().last : 0) + 1, localNext());
          t.set(cRef, { last: n });
          t.set(fs.collection("orders").doc(today + "_" + n), Object.assign({ num: n }, base));
          return n;
        });
        var timedOut = false;
        num = await Promise.race([tx, new Promise(function (_, rej) { setTimeout(function () { timedOut = true; rej(new Error("timeout")); }, 12000); })]);
      }
    } catch (err) {
      if (timedOut) {
        busy = false; render();
        toast("Інтернет повільний. Перевірте «Кухню»: якщо замовлення там є, не пробивайте його вдруге.");
        return;
      }
      try { saveOffline(); } catch (e2) { busy = false; render(); toast("Не вдалося зберегти замовлення. Спробуйте ще раз."); return; }
    }
    resetCart();
    var s = $("sent"); s.innerHTML = "Відправлено на кухню<b>№ " + num + "</b>Скажіть гостю номер"; s.hidden = false;
    busy = false; render();
  };

  // =========================================================
  // КУХНЯ / ВИДАЧА / ТАБЛО
  // =========================================================
  function ticket(o, mode) {
    var age = ageMin(o), late = (o.status === "new" || o.status === "cooking") && age >= LATE_MIN;
    var main = o.items.filter(function (l) { return l.kitchen; }), side = o.items.filter(function (l) { return !l.kitchen; });
    var id = esc(o._id), act = "";
    if (mode === "kitchen") {
      act = (o.status === "new"
        ? '<button type="button" class="go" data-act="cooking" data-id="' + id + '">Готую</button>'
        : '<button type="button" class="back" data-act="new" data-id="' + id + '" aria-label="Назад у нові">↩</button><button type="button" class="done" data-act="ready" data-id="' + id + '">Готово ✓</button>') +
        '<button type="button" class="prn" data-print="' + id + '" aria-label="Друк чека">🖨</button>';
    } else if (mode === "ready") {
      act = '<button type="button" class="back" data-act="cooking" data-id="' + id + '" aria-label="Повернути на кухню">↩</button><button type="button" class="give" data-act="done" data-id="' + id + '">Видано</button>';
    }
    return '<article class="ticket ' + o.status + (late ? " late" : "") + '">' +
      '<div class="t-head"><span class="t-num">№' + o.num + (o.where === "away" ? '<span class="t-tag">З СОБОЮ</span>' : "") + "</span>" +
      '<span class="t-meta">' + (o.table ? esc(o.table) + "<br>" : "") + '<span class="t-age">' + (mode === "ready" ? "готово " + hhmm(o.readyAt || o.createdAt) : age + " хв") + "</span></span></div>" +
      '<ul class="t-items">' + main.map(function (l) { return "<li><b>" + qtyLabel(l) + "</b>" + esc(l.name) + "</li>"; }).join("") +
      side.map(function (l) { return '<li class="side"><b>' + qtyLabel(l) + "</b>" + esc(l.name) + "</li>"; }).join("") + "</ul>" +
      (o.note ? '<p class="t-note">' + esc(o.note) + "</p>" : "") +
      (act ? '<div class="t-act">' + act + "</div>" : "") + "</article>";
  }
  function kitchenList() { return active().filter(function (o) { return (o.status === "new" || o.status === "cooking") && hasKitchen(o); }).sort(function (a, b) { return a.createdAt - b.createdAt; }); }
  function renderKitchen() {
    var list = kitchenList();
    $("kitchenBoard").innerHTML = list.length ? list.map(function (o) { return ticket(o, "kitchen"); }).join("") : '<p class="empty">Немає замовлень. Нові з\'являться тут самі.</p>';
  }
  function renderPickup() {
    var ready = active().filter(function (o) { return o.status === "ready"; }).sort(function (a, b) { return (a.readyAt || 0) - (b.readyAt || 0); });
    var wait = active().filter(function (o) { return o.status === "new" || o.status === "cooking"; }).sort(function (a, b) { return a.createdAt - b.createdAt; });
    $("readyBoard").innerHTML = ready.length ? ready.map(function (o) { return ticket(o, "ready"); }).join("") : '<p class="empty">Поки нічого не готово</p>';
    $("waitBoard").innerHTML = wait.length ? wait.map(function (o) { return ticket(o, "wait"); }).join("") : '<p class="empty">Кухня вільна</p>';
  }
  function renderTv() {
    var c = active().filter(function (o) { return o.status === "new" || o.status === "cooking"; }).sort(function (a, b) { return a.num - b.num; });
    var r = active().filter(function (o) { return o.status === "ready"; }).sort(function (a, b) { return a.num - b.num; });
    $("tvCook").innerHTML = c.map(function (o) { return "<span>" + o.num + "</span>"; }).join("");
    $("tvReady").innerHTML = r.map(function (o) { return "<span>" + o.num + "</span>"; }).join("");
  }
  async function setStatus(id, status) {
    if (!fs) return;
    var patch = { status: status };
    if (status === "cooking") patch.cookingAt = Date.now();
    if (status === "ready") patch.readyAt = Date.now();
    if (status === "done") patch.doneAt = Date.now();
    if (status === "cancelled") patch.cancelledAt = Date.now();
    try { await fs.collection("orders").doc(id).update(patch); } catch (e) { toast("Не вдалося змінити статус. Спробуйте ще раз."); }
  }
  ["kitchenBoard", "readyBoard"].forEach(function (bid) {
    $(bid).addEventListener("click", function (e) {
      var p = e.target.closest("[data-print]");
      if (p) { var o = orders.find(function (x) { return x._id === p.dataset.print; }); if (o) printOrder(o); return; }
      var b = e.target.closest("[data-act]"); if (b) setStatus(b.dataset.id, b.dataset.act);
    });
  });

  // print one kitchen ticket (80 mm)
  function printOrder(o) {
    var main = o.items.filter(function (l) { return l.kitchen; }), side = o.items.filter(function (l) { return !l.kitchen; });
    $("printArea").innerHTML =
      '<div class="pn">№' + o.num + "</div>" +
      '<div class="pm">' + hhmm(o.createdAt) + (o.table ? " · " + esc(o.table) : "") + "</div>" +
      (o.where === "away" ? '<div class="pt">З СОБОЮ</div>' : "") +
      "<ul>" + main.map(function (l) { return "<li><span>" + qtyLabel(l) + "</span><span>" + esc(l.name) + "</span></li>"; }).join("") +
      side.map(function (l) { return '<li class="side"><span>' + qtyLabel(l) + "</span><span>" + esc(l.name) + "</span></li>"; }).join("") + "</ul>" +
      (o.note ? '<div class="pc">' + esc(o.note) + "</div>" : "");
    setTimeout(function () { window.print(); }, 50);
  }
  function setAutoPrint(v) { autoPrint = v; store("plov-print", v ? "1" : "0"); var b = $("autoPrint"); b.setAttribute("aria-pressed", v); b.textContent = v ? "🖨 Автодрук: увімк" : "🖨 Автодрук: вимк"; }
  function setSound(v) { soundOn = v; store("plov-sound", v ? "1" : "0"); var b = $("sound"); b.setAttribute("aria-pressed", v); b.textContent = v ? "🔔 Звук: увімк" : "🔕 Звук: вимк"; }
  $("autoPrint").onclick = function () { setAutoPrint(!autoPrint); };
  $("sound").onclick = function () { setSound(!soundOn); if (soundOn) tune("new"); };
  setAutoPrint(autoPrint); setSound(soundOn);

  // ---------- sounds: a short Samarkand-style tune (plucked dutar + doira drum) ----------
  var actx = null;
  function ac() { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); return actx; }
  function pluck(ctx, freq, t, len, vol) {
    var out = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(freq * 8, t); lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t + len);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(vol, t + 0.008); out.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(out); out.connect(ctx.destination);
    [["sawtooth", 0], ["triangle", 4], ["triangle", -5]].forEach(function (v) {
      var o = ctx.createOscillator(); o.type = v[0]; o.frequency.value = freq; o.detune.value = v[1];
      o.connect(lp); o.start(t); o.stop(t + len + 0.05);
    });
  }
  function doira(ctx, t, deep) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(deep ? 140 : 260, t); o.frequency.exponentialRampToValueAtTime(deep ? 60 : 180, t + 0.15);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(deep ? 0.5 : 0.18, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.25);
  }
  // notes of the Hijaz mode (D, E-flat, F-sharp, G, A, B-flat, C, D)
  var N = { D4: 293.66, Eb4: 311.13, Fs4: 369.99, G4: 392.0, A4: 440.0, Bb4: 466.16, C5: 523.25, D5: 587.33 };
  function tune(kind) {
    if (!soundOn) return;
    try {
      var ctx = ac(), t = ctx.currentTime + 0.05, step = 0.14;
      var mel = kind === "ready"
        ? [["A4", 1], ["D5", 1], ["C5", 1], ["Bb4", 1], ["A4", 2], ["D5", 3]]
        : [["D4", 1], ["Eb4", 1], ["Fs4", 1], ["G4", 1], ["A4", 2], ["G4", 1], ["Fs4", 1], ["D4", 3]];
      var beats = 0;
      mel.forEach(function (n) {
        pluck(ctx, N[n[0]], t + beats * step, Math.max(0.35, n[1] * step * 1.6), 0.22);
        beats += n[1];
      });
      for (var b = 0; b <= beats; b += 2) doira(ctx, t + b * step, b % 4 === 0);
    } catch (e) { /* no audio on this device */ }
  }
  function beep() { tune("new"); }
  // =========================================================
  // СТОП-ЛИСТ (для всіх)
  // =========================================================
  function renderStop() {
    if (!menu) { $("stopRows").innerHTML = '<p class="empty">Меню ще не завантажене.</p>'; return; }
    $("stopRows").innerHTML = items().map(function (i, ix) {
      var on = i.available !== false;
      return '<div class="mrow"><span class="nm">' + esc(i.name) + "<small>" + esc(i.cat) + "</small></span>" +
        '<button type="button" class="tog" data-tog="' + ix + '" aria-pressed="' + on + '">' + (on ? "Є" : "Стоп") + "</button></div>";
    }).join("");
  }
  $("stopRows").addEventListener("click", async function (e) {
    var b = e.target.closest("[data-tog]"); if (!b || !menu || !fs) return;
    var next = JSON.parse(JSON.stringify(menu)), it = next.items[+b.dataset.tog];
    it.available = it.available === false;
    try { await fs.collection("settings").doc("menu").set(next); toast(it.name + (it.available ? " — знову є" : " — у стоп-листі")); }
    catch (err) { toast("Не вдалося зберегти. Перевірте інтернет."); }
  });

  // =========================================================
  // КОД ВЛАСНИКА
  // =========================================================
  var pinState = { val: "", step: 0, first: "" };
  function renderPin(which) {
    var box = $("pin-" + which), body = $(which + "Body");
    if (unlocked[which]) { box.hidden = true; body.hidden = false; return; }
    box.hidden = false; body.hidden = true;
    var creating = !(security && security.ownerHash);
    var title = creating ? (pinState.step === 0 ? "Придумайте код власника" : "Повторіть код") : "Код власника";
    var hint = creating ? "4–8 цифр. Його знатимете тільки ви. Він відкриває Звіт і Налаштування." : "Звіт і Налаштування бачить тільки власник.";
    box.innerHTML = "<h2>" + title + "</h2><p>" + hint + "</p>" +
      '<div class="dots">' + Array.from({ length: Math.max(4, pinState.val.length) }).map(function (_, i) { return "<i" + (i < pinState.val.length ? ' class="f"' : "") + "></i>"; }).join("") + "</div>" +
      '<div class="err" id="pinErr-' + which + '"></div>' +
      '<div class="keys">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, "⌫", 0, "OK"].map(function (k) { return '<button type="button" data-k="' + k + '">' + k + "</button>"; }).join("") + "</div>";
  }
  ["zvit", "nalasht"].forEach(function (which) {
    $("pin-" + which).addEventListener("click", async function (e) {
      var b = e.target.closest("[data-k]"); if (!b) return;
      var k = b.dataset.k;
      if (k === "⌫") { pinState.val = pinState.val.slice(0, -1); renderPin(which); return; }
      if (k !== "OK") { if (pinState.val.length < 8) pinState.val += k; renderPin(which); return; }
      if (pinState.val.length < 4) { $("pinErr-" + which).textContent = "Мінімум 4 цифри"; return; }
      await submitPin(which);
    });
  });
  async function submitPin(which) {
    var creating = !(security && security.ownerHash);
    if (creating) {
      if (pinState.step === 0) { pinState.first = pinState.val; pinState.val = ""; pinState.step = 1; renderPin(which); return; }
      if (pinState.val !== pinState.first) { pinState = { val: "", step: 0, first: "" }; renderPin(which); $("pinErr-" + which).textContent = "Коди не збіглися, спробуйте ще раз"; return; }
      var salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { await fs.collection("settings").doc("security").set({ salt: salt, ownerHash: await sha(salt + ":" + pinState.val) }); }
      catch (err) { toast("Не вдалося зберегти код. Перевірте інтернет."); return; }
      security = { salt: salt, ownerHash: await sha(salt + ":" + pinState.val) };
      toast("Код власника створено");
      unlock(which); return;
    }
    var h = await sha(security.salt + ":" + pinState.val);
    if (h === security.ownerHash) { unlock(which); }
    else { pinState.val = ""; renderPin(which); $("pinErr-" + which).textContent = "Невірний код"; }
  }
  function unlock(which) {
    unlocked[which] = true; pinState = { val: "", step: 0, first: "" };
    render();
    if (which === "zvit") loadReport();
    if (which === "nalasht") renderEdit();
  }
  $("lockZvit").onclick = function () { unlocked.zvit = false; render(); };
  $("lockSet").onclick = function () { unlocked.nalasht = false; render(); };

  // =========================================================
  // ЗВІТ
  // =========================================================
  var period = "today", repOrders = [];
  $("period").addEventListener("click", function (e) {
    var b = e.target.closest("[data-p]"); if (!b) return;
    period = b.dataset.p;
    $("period").querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
    loadReport();
  });
  function range() {
    var now = new Date();
    if (period === "yesterday") { var y = dayKey(addDays(now, -1)); return [y, y]; }
    if (period === "week") return [dayKey(addDays(now, -6)), dayKey(now)];
    if (period === "month") return [dayKey(addDays(now, -29)), dayKey(now)];
    return [dayKey(now), dayKey(now)];
  }
  async function loadReport() {
    if (!fs || !unlocked.zvit) return;
    var r = range();
    if (period === "today") { repOrders = orders.slice(); renderReport(); return; }
    $("kpis").innerHTML = '<p class="empty">Завантаження…</p>';
    try {
      var snap = await fs.collection("orders").where("day", ">=", r[0]).where("day", "<=", r[1]).get();
      repOrders = snap.docs.map(function (d) { var o = Object.assign({}, d.data()); o._id = d.id; return o; });
    } catch (e) { repOrders = []; toast("Не вдалося завантажити звіт"); }
    renderReport();
  }
  function renderReport() {
    var ok = repOrders.filter(function (o) { return o.status !== "cancelled"; });
    var cancelled = repOrders.filter(function (o) { return o.status === "cancelled"; });
    var sum = 0, card = 0, cash = 0, per = {}, hrs = {}, prep = [], away = 0;
    ok.forEach(function (o) {
      sum += o.total; if (o.pay === "cash") cash += o.total; else card += o.total;
      if (o.where === "away") away++;
      var h = new Date(o.createdAt).getHours(); hrs[h] = (hrs[h] || 0) + o.total;
      if (o.readyAt && hasKitchen(o)) prep.push((o.readyAt - o.createdAt) / 60000);
      o.items.forEach(function (l) { var k = l.name; per[k] = per[k] || { q: 0, s: 0, per100: l.per100 }; per[k].q += l.per100 ? l.qty * gramsOf(l) : l.qty; per[k].s += l.qty * l.price; });
    });
    var avgPrep = prep.length ? Math.round(prep.reduce(function (a, b) { return a + b; }, 0) / prep.length) : null;
    var days = {}; ok.forEach(function (o) { days[o.day] = 1; });
    var nDays = Object.keys(days).length || 1;
    var k = [["Виручка", money(sum), "main"], ["Замовлень", ok.length], ["Середній чек", money(ok.length ? sum / ok.length : 0)],
      ["Картка", money(card)], ["Готівка", money(cash)], ["З собою", away],
      ["Сер. час кухні", avgPrep == null ? "—" : avgPrep + " хв"], ["Скасовано", cancelled.length + (cancelled.length ? " · " + money(cancelled.reduce(function (a, o) { return a + o.total; }, 0)) : "")]];
    if (period === "week" || period === "month") k.splice(1, 0, ["Середня за день", money(sum / nDays)]);
    $("kpis").innerHTML = k.map(function (x) { return '<div class="kpi' + (x[2] ? " " + x[2] : "") + '"><span>' + x[0] + "</span><b>" + x[1] + "</b></div>"; }).join("");

    var rows = Object.keys(per).map(function (n) { return [n, per[n]]; }).sort(function (a, b) { return b[1].s - a[1].s; });
    var max = rows.length ? rows[0][1].s : 1;
    $("repRows").innerHTML = rows.length ? rows.map(function (r) {
      return "<tr><td>" + esc(r[0]) + '</td><td class="r">' + (r[1].per100 ? r[1].q + " г" : r[1].q) + '</td><td class="r">' + money(r[1].s) + '</td><td><div class="bar" style="width:' + Math.max(4, r[1].s / max * 100) + '%"></div></td></tr>';
    }).join("") : '<tr><td colspan="4" class="empty">Продажів за цей період немає</td></tr>';

    var hs = Object.keys(hrs).map(Number), from = hs.length ? Math.min.apply(null, hs.concat([10])) : 10, to = hs.length ? Math.max.apply(null, hs.concat([18])) : 18;
    var hmax = Math.max.apply(null, [1].concat(hs.map(function (h) { return hrs[h]; })));
    var bars = [];
    for (var h = from; h <= to; h++) {
      var v = hrs[h] || 0;
      bars.push('<div class="' + (v === hmax && v > 0 ? "peak" : "") + '" title="' + h + ':00 — ' + money(v) + '"><em>' + (v ? Math.round(v / 100) / 10 + "k" : "") + '</em><i style="height:' + (v / hmax * 100) + '%"></i><small>' + h + "</small></div>");
    }
    $("hours").innerHTML = bars.join("");

    var st = { "new": "нове", cooking: "готується", ready: "готово", done: "видано", cancelled: "скасовано" };
    function row(o, allowCancel) {
      var x = o.status === "cancelled";
      return '<div class="row' + (x ? " x" : "") + '"><b>№' + o.num + '</b><span class="what">' + (period !== "today" ? o.day.slice(5) + " " : "") + hhmm(o.createdAt) + " · " +
        esc(o.items.map(function (l) { return qtyLabel(l) + " " + l.name; }).join(", ")) + "</span>" +
        "<b>" + money(o.total) + ' <span class="pill">' + (o.pay === "cash" ? "готівка" : "картка") + '</span> <span class="pill' + (x ? " bad" : "") + '">' + st[o.status] + "</span></b>" +
        (allowCancel && !x ? '<span class="confirm"><button type="button" class="btn sm danger" data-cancel="' + esc(o._id) + '">Скасувати</button></span>' : "<span></span>") + "</div>";
    }
    $("cancelled").innerHTML = cancelled.length ? cancelled.map(function (o) { return row(o, false); }).join("") : '<p class="empty">Немає</p>';
    var all = repOrders.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    $("hist").innerHTML = all.length ? all.map(function (o) { return row(o, period === "today"); }).join("") : '<p class="empty">Замовлень немає</p>';
  }
  $("hist").addEventListener("click", function (e) {
    var c = e.target.closest("[data-cancel]");
    if (c) { c.parentNode.innerHTML = '<button type="button" class="btn sm danger" data-yes="' + esc(c.dataset.cancel) + '">Так, скасувати</button><button type="button" class="btn sm" data-no="1">Ні</button>'; return; }
    var y = e.target.closest("[data-yes]"); if (y) { setStatus(y.dataset.yes, "cancelled"); return; }
    if (e.target.closest("[data-no]")) renderReport();
  });
  $("csv").onclick = function () {
    var head = ["Дата", "Час", "Номер", "Статус", "Оплата", "Тут/з собою", "Страви", "Сума"];
    var lines = [head].concat(repOrders.slice().sort(function (a, b) { return a.createdAt - b.createdAt; }).map(function (o) {
      return [o.day, hhmm(o.createdAt), o.num, o.status, o.pay === "cash" ? "готівка" : "картка", o.where === "away" ? "з собою" : "тут",
        o.items.map(function (l) { return qtyLabel(l) + " " + l.name; }).join("; "), o.total];
    }));
    var csv = "﻿" + lines.map(function (r) { return r.map(function (v) { v = String(v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(";"); }).join("\r\n");
    var r = range();
    var fname = "plov-zvit-" + r[0] + (r[0] !== r[1] ? "_" + r[1] : "") + ".csv";
    if (window.PLOV_IN_CLAUDE) {
      window.claude.use("downloads").then(function (dl) {
        if (!dl) { toast("Завантаження файлів тут недоступне"); return; }
        return dl.save({ filename: fname, data: new Blob([csv], { type: "text/csv;charset=utf-8" }) });
      }).catch(function () { toast("Файл не збережено"); });
      return;
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = fname;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // =========================================================
  // НАЛАШТУВАННЯ: меню і ціни
  // =========================================================
  var draft = null;
  function renderEdit() {
    if (!draft) draft = JSON.parse(JSON.stringify(menu || { cats: [], items: [] }));
    var cats = draft.cats || [];
    $("editRows").innerHTML = draft.items.map(function (i, ix) {
      return '<div class="edit">' +
        '<input type="text" id="en-' + ix + '" data-f="name" data-ix="' + ix + '" value="' + esc(i.name) + '" aria-label="Назва">' +
        '<select id="ec-' + ix + '" data-f="cat" data-ix="' + ix + '" aria-label="Категорія">' + cats.map(function (c) { return "<option" + (c === i.cat ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
        '<input type="number" id="ep-' + ix + '" data-f="price" data-ix="' + ix + '" value="' + Number(i.price) + '" min="0" step="5" inputmode="numeric" aria-label="Ціна">' +
        '<label class="chk"><input type="checkbox" data-f="kitchen" data-ix="' + ix + '"' + (i.kitchen !== false ? " checked" : "") + "> кухня</label>" +
        '<label class="chk"><input type="checkbox" data-f="per100" data-ix="' + ix + '"' + (i.per100 ? " checked" : "") + "> за 100 г</label>" +
        '<button type="button" class="btn sm danger" data-del="' + ix + '" aria-label="Видалити">✕</button></div>';
    }).join("") || '<p class="empty">Страв ще немає. Натисніть «+ Додати страву».</p>';
  }
  $("editRows").addEventListener("input", function (e) {
    var el = e.target, ix = el.dataset.ix, f = el.dataset.f; if (ix == null || !f) return;
    var it = draft.items[+ix];
    if (f === "price") it.price = Math.max(0, Math.round(Number(el.value) || 0));
    else if (f === "kitchen") it.kitchen = el.checked;
    else if (f === "per100") it.per100 = el.checked;
    else it[f] = el.value;
  });
  $("editRows").addEventListener("click", function (e) {
    var d = e.target.closest("[data-del]"); if (!d) return;
    if (d.dataset.sure) { draft.items.splice(+d.dataset.del, 1); renderEdit(); return; }
    d.dataset.sure = "1"; d.textContent = "Точно?";
  });
  $("addItem").onclick = function () {
    if (!draft) renderEdit();
    if (!draft.cats.length) draft.cats.push("Страви");
    draft.items.push({ id: "i" + Date.now().toString(36), name: "Нова страва", cat: draft.cats[0], price: 0, kitchen: true });
    renderEdit();
    var last = $("en-" + (draft.items.length - 1)); if (last) { last.focus(); last.select(); }
  };
  $("saveMenu").onclick = async function () {
    if (!fs || !draft) return;
    var clean = JSON.parse(JSON.stringify(draft));
    clean.items = clean.items.filter(function (i) { return String(i.name).trim(); }).map(function (i) { i.name = String(i.name).trim().slice(0, 60); return i; });
    try { await fs.collection("settings").doc("menu").set(clean); draft = null; toast("Меню збережено"); renderEdit(); }
    catch (e) { toast("Не вдалося зберегти меню"); }
  };
  $("saveOwner").onclick = async function () {
    var v = $("newOwner").value.trim();
    if (!/^\d{4,8}$/.test(v)) { toast("Код — від 4 до 8 цифр"); return; }
    var salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { await fs.collection("settings").doc("security").set({ salt: salt, ownerHash: await sha(salt + ":" + v) }); $("newOwner").value = ""; toast("Код власника змінено"); }
    catch (e) { toast("Не вдалося змінити код"); }
  };

  // =========================================================
  // RENDER
  // =========================================================
  function render() {
    $("dayLabel").textContent = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
    var kc = kitchenList().length, rc = active().filter(function (o) { return o.status === "ready"; }).length;
    $("cKitchen").textContent = kc; $("cKitchen").hidden = !kc;
    $("cReady").textContent = rc; $("cReady").hidden = !rc;
    if (tab === "kasa") { renderMenuGrid(); renderCart(); }
    if (tab === "kuhnya") renderKitchen();
    if (tab === "vydacha") renderPickup();
    if (tab === "tablo") renderTv();
    if (tab === "stop") renderStop();
    if (tab === "zvit") { renderPin("zvit"); }
    if (tab === "nalasht") { renderPin("nalasht"); if (unlocked.nalasht && !draft) renderEdit(); }
  }

  // =========================================================
  // DATA
  // =========================================================
  function setConn(ok, text) { $("conn").textContent = text; $("conn").classList.toggle("bad", !ok); }
  function subscribeOrders() {
    if (unsubOrders) unsubOrders();
    firstLoad = true; knownNew = {}; knownReady = {};
    unsubOrders = fs.collection("orders").where("day", "==", today).onSnapshot({ includeMetadataChanges: true }, function (snap) {
      orders = snap.docs.map(function (d) { var o = Object.assign({}, d.data()); o._id = d.id; return o; });
      var fresh = [], readyNow = false;
      orders.forEach(function (o) {
        if (o.status === "new" && !knownNew[o._id]) { if (!firstLoad) fresh.push(o); knownNew[o._id] = 1; }
        if (o.status === "ready" && !knownReady[o._id]) { if (!firstLoad) readyNow = true; knownReady[o._id] = 1; }
      });
      if (readyNow && (tab === "vydacha" || tab === "tablo")) tune("ready");
      firstLoad = false;
      if (fresh.length && tab === "kuhnya") { beep(); if (autoPrint) printOrder(fresh[0]); }
      setConn(!snap.metadata.fromCache, snap.metadata.fromCache ? "● Офлайн — замовлення збережуться" : "● Онлайн");
      if (tab === "zvit" && unlocked.zvit && period === "today") { repOrders = orders.slice(); renderReport(); }
      render();
    }, function () { setConn(false, "● Немає доступу до бази"); });
  }
  function showSetup(html) { var b = $("setupBanner"); b.innerHTML = html; b.hidden = false; }

  async function init() {
    showTab(tab);
    var cfg = window.PLOV_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || !window.firebase) {
      showSetup("<b>Касу ще не підключено до бази.</b> Потрібно вставити налаштування Firebase у файл config.js.");
      setConn(false, "● Не підключено"); render(); return;
    }
    try {
      firebase.initializeApp(cfg);
      fs = firebase.firestore();
      try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* another tab or unsupported: works online */ }
      await firebase.auth().signInAnonymously();
    } catch (e) {
      showSetup(window.PLOV_IN_CLAUDE ? "<b>Немає з'єднання з базою замовлень.</b> Відкрийте касу в Claude під акаунтом власника і оновіть сторінку." : "<b>Не вдалося підключитися до бази.</b> Перевірте інтернет і що в Firebase увімкнено вхід «Anonymous».");
      setConn(false, "● Помилка підключення"); fs = null; render(); return;
    }
    var seeded = false;
    fs.collection("settings").doc("menu").onSnapshot(function (s) {
      menu = s.exists ? s.data() : null;
      if (!s.exists && !seeded && !(s.metadata && s.metadata.fromCache) && window.PLOV_DEFAULT_MENU) { seeded = true; fs.collection("settings").doc("menu").set(window.PLOV_DEFAULT_MENU).catch(function () {}); }
      render();
    }, function () {
      showSetup("<b>База не дає доступу.</b> У Firebase → Firestore → Rules потрібно вставити правила з інструкції.");
    });
    fs.collection("settings").doc("security").onSnapshot(function (s) { security = s.exists ? s.data() : null; if (tab === "zvit" || tab === "nalasht") render(); }, function () {});
    subscribeOrders();
    setInterval(function () {
      var d = dayKey();
      if (d !== today) { today = d; orders = []; subscribeOrders(); }
      if (tab === "kuhnya" || tab === "vydacha") render();
    }, 30000);
  }
  init();
})();
