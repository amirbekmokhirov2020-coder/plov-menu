/* Тиха фонова музика (дутар). Починає грати після першого дотику до меню.
   Гучність задана в самому файлі, бо iPhone не дозволяє сайтам змінювати гучність. */
(function () {
  "use strict";
  var started = false, audio = null;
  function start() {
    if (started) return; started = true;
    ["pointerdown", "touchend", "keydown"].forEach(function (n) { window.removeEventListener(n, start, true); });
    audio = new Audio("music.mp3"); audio.loop = true; audio.setAttribute("playsinline", "");
    audio.volume = 0.4;
    audio.play().then(function () {
      // gentle fade-in where the browser allows it (Android, computers); iPhone plays at the file's own quiet level
      var v = 0.4, t = setInterval(function () { v = Math.min(1, v + 0.1); audio.volume = v; if (v >= 1) clearInterval(t); }, 400);
    }).catch(function () { started = false; listen(); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) audio.pause(); else audio.play().catch(function () {}); });
  }
  function listen() { ["pointerdown", "touchend", "keydown"].forEach(function (n) { window.addEventListener(n, start, true); }); }
  listen();
})();
