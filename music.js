/* Тиха фонова музика (дутар). Починає грати після першого дотику до меню і плавно стає ледь чутною.
   Гучність задана в самому файлі (дуже тихо) і через Web Audio, бо iPhone не дозволяє змінювати гучність інакше. */
(function () {
  "use strict";
  var SRC = "music.mp3", LEVEL = 0.8, FADE_S = 10;
  var started = false;
  function start() {
    if (started) return; started = true;
    ["pointerdown", "touchend", "keydown"].forEach(function (n) { window.removeEventListener(n, start, true); });
    var audio = new Audio(SRC); audio.loop = true; audio.preload = "auto"; audio.setAttribute("playsinline", "");
    var Ctx = window.AudioContext || window.webkitAudioContext, ctx = null, gain = null;
    try {
      ctx = new Ctx(); gain = ctx.createGain(); gain.gain.value = 0.0001;
      ctx.createMediaElementSource(audio).connect(gain); gain.connect(ctx.destination);
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { ctx = null; audio.volume = 0.25; }
    audio.play().then(function () {
      if (ctx) { var t = ctx.currentTime; gain.gain.setValueAtTime(0.0001, t); gain.gain.exponentialRampToValueAtTime(LEVEL, t + FADE_S); }
    }).catch(function () { started = false; listen(); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) audio.pause(); else audio.play().catch(function () {});
    });
  }
  function listen() { ["pointerdown", "touchend", "keydown"].forEach(function (n) { window.addEventListener(n, start, true); }); }
  listen();
})();
