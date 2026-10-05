/* Тиха узбецька музика: починає звучати після першого дотику гостя до меню і плавно стає голоснішою.
   Браузери не дозволяють музику без дотику, тому чекаємо перший дотик або клік. */
(function () {
  "use strict";
  var SRC = "music.mp3", TARGET = 0.32, FADE_MS = 9000;
  var btn = document.getElementById("music"); if (!btn) return;
  var audio = null, started = false, fadeT = null;
  var off = false; try { off = localStorage.getItem("plov-music") === "off"; } catch (e) {}

  function fadeTo(v, ms, done) {
    clearInterval(fadeT);
    var from = audio.volume, t0 = Date.now();
    fadeT = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (v - from) * k * k));
      if (k >= 1) { clearInterval(fadeT); if (done) done(); }
    }, 80);
  }
  function play() {
    if (!audio) { audio = new Audio(SRC); audio.loop = true; audio.preload = "auto"; audio.volume = 0; }
    var p = audio.play();
    if (p && p.then) p.then(function () { btn.setAttribute("aria-pressed", "true"); fadeTo(TARGET, FADE_MS); }).catch(function () {});
    else { btn.setAttribute("aria-pressed", "true"); fadeTo(TARGET, FADE_MS); }
  }
  function pause() { btn.setAttribute("aria-pressed", "false"); if (audio) fadeTo(0, 700, function () { audio.pause(); }); }

  // show the button only if the music file exists
  fetch(SRC, { method: "HEAD" }).then(function (r) {
    if (!r.ok) return;
    btn.hidden = false;
    function firstTouch(e) {
      if (started) return; started = true;
      ["pointerdown", "keydown", "touchend"].forEach(function (n) { window.removeEventListener(n, firstTouch, true); });
      if (!off && !(e && e.target && e.target.closest && e.target.closest("#music"))) play();
    }
    if (!off) ["pointerdown", "keydown", "touchend"].forEach(function (n) { window.addEventListener(n, firstTouch, true); });
  }).catch(function () {});

  btn.addEventListener("click", function () {
    started = true;
    if (btn.getAttribute("aria-pressed") === "true") { pause(); try { localStorage.setItem("plov-music", "off"); } catch (e) {} }
    else { play(); try { localStorage.removeItem("plov-music"); } catch (e) {} }
  });
  document.addEventListener("visibilitychange", function () { if (document.hidden && audio && !audio.paused) audio.pause(); else if (!document.hidden && audio && btn.getAttribute("aria-pressed") === "true") audio.play().catch(function () {}); });
})();
