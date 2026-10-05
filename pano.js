/* Самарканд 360° — панорама площі Регістан на заході сонця.
   Малюється програмно (без чужих фото), повертається пальцем або нахилом телефона. */
(function () {
  "use strict";

  // ---------------------------------------------------------------
  // 1. Paint an equirectangular panorama (x: 0..360°, y: +90..-90°)
  // ---------------------------------------------------------------
  function paintPanorama(W) {
    var H = W / 2, c = document.createElement("canvas");
    c.width = W; c.height = H;
    var g = c.getContext("2d");
    var HZ = H / 2;                 // horizon
    var PX = W / 360;               // pixels per degree
    var rnd = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(7);

    // --- sky: golden hour, warm at the horizon, deep lapis above
    var sky = g.createLinearGradient(0, 0, 0, HZ);
    sky.addColorStop(0, "#0b1a3d");
    sky.addColorStop(0.45, "#27407a");
    sky.addColorStop(0.75, "#c9786a");
    sky.addColorStop(0.92, "#f2b36a");
    sky.addColorStop(1, "#f7d79a");
    g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    // stars high up
    for (var i = 0; i < 260; i++) {
      var sy = rnd() * HZ * 0.35, a = 0.25 + rnd() * 0.6 * (1 - sy / (HZ * 0.35));
      g.fillStyle = "rgba(255,248,230," + a + ")";
      g.fillRect(rnd() * W, sy, rnd() < 0.1 ? 2.2 : 1.3, rnd() < 0.1 ? 2.2 : 1.3);
    }
    // sun low in the west (behind the viewer's left), with glow
    var sunX = 40 * PX, sunY = HZ - 6 * PX;
    var glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60 * PX);
    glow.addColorStop(0, "rgba(255,236,190,0.95)");
    glow.addColorStop(0.08, "rgba(255,214,150,0.7)");
    glow.addColorStop(0.4, "rgba(255,170,110,0.18)");
    glow.addColorStop(1, "rgba(255,170,110,0)");
    g.fillStyle = glow; g.fillRect(0, 0, W, HZ);
    g.fillStyle = glow; g.fillRect(W - 30 * PX, 0, 30 * PX, HZ); // wrap the glow at the seam
    g.fillStyle = "#fff4d8"; g.beginPath(); g.arc(sunX, sunY, 2.2 * PX, 0, Math.PI * 2); g.fill();
    // thin clouds
    g.globalAlpha = 0.35;
    for (i = 0; i < 14; i++) {
      var cx = rnd() * W, cy = HZ - (12 + rnd() * 22) * PX, cw = (20 + rnd() * 40) * PX;
      var cg = g.createLinearGradient(cx, cy, cx + cw, cy);
      cg.addColorStop(0, "rgba(255,200,170,0)"); cg.addColorStop(0.5, "rgba(255,210,180,0.8)"); cg.addColorStop(1, "rgba(255,200,170,0)");
      g.fillStyle = cg; g.fillRect(cx, cy, cw, 0.5 * PX);
    }
    g.globalAlpha = 1;

    // --- distant city silhouette all around
    g.fillStyle = "#4a3a52";
    for (var x = 0; x < W; x += 6) {
      var h = (1.2 + Math.abs(Math.sin(x * 0.013)) * 1.3 + (rnd() < 0.03 ? 3 : 0)) * PX;
      g.fillRect(x, HZ - h, 6, h);
    }
    // a few far domes and poplars behind the viewer
    [[10, 4], [24, 3], [335, 5], [350, 3.5]].forEach(function (d) {
      var dx = d[0] * PX, r = d[1] * PX * 0.5;
      g.fillStyle = "#3d6d8a"; g.beginPath(); g.ellipse(dx, HZ - d[1] * PX * 0.9, r, r * 1.15, 0, Math.PI, 0); g.fill();
      g.fillStyle = "#4a3a52"; g.fillRect(dx - r, HZ - d[1] * PX * 0.9, r * 2, d[1] * PX * 0.9);
    });
    for (i = 0; i < 40; i++) {
      var tx = (300 + rnd() * 120) % 360 * PX, th = (3 + rnd() * 4) * PX;
      g.fillStyle = "#2f3b2e"; g.beginPath(); g.ellipse(tx, HZ - th / 2, 0.7 * PX, th / 2, 0, 0, Math.PI * 2); g.fill();
    }

    // --- tile patterns
    function tilePattern(size, bg, star, accent) {
      var t = document.createElement("canvas"); t.width = t.height = size;
      var q = t.getContext("2d"), m = size / 2;
      q.fillStyle = bg; q.fillRect(0, 0, size, size);
      q.strokeStyle = star; q.lineWidth = size * 0.06;
      q.beginPath();
      for (var k = 0; k < 8; k++) {
        var ang = k * Math.PI / 4, r1 = size * 0.42, r2 = size * 0.2;
        var a1 = ang, a2 = ang + Math.PI / 8;
        q.lineTo(m + Math.cos(a1) * r1, m + Math.sin(a1) * r1);
        q.lineTo(m + Math.cos(a2) * r2, m + Math.sin(a2) * r2);
      }
      q.closePath(); q.stroke();
      q.fillStyle = accent; q.beginPath(); q.arc(m, m, size * 0.09, 0, Math.PI * 2); q.fill();
      [[0, 0], [size, 0], [0, size], [size, size]].forEach(function (p) { q.beginPath(); q.arc(p[0], p[1], size * 0.12, 0, Math.PI * 2); q.fill(); });
      return g.createPattern(t, "repeat");
    }
    var tileBlue = tilePattern(Math.round(2.2 * PX), "#1d4f9c", "#e9dcc0", "#3fc4c0");
    var tileTurq = tilePattern(Math.round(1.6 * PX), "#2a9ca5", "#f2ead8", "#1d4f9c");
    var tileGold = tilePattern(Math.round(2.2 * PX), "#b4842c", "#f6e6b8", "#1d4f9c");

    // brick colour in warm light
    function brick(light) { return light ? "#d8a874" : "#b98a5e"; }

    // pointed arch path (niche)
    function arch(cx, base, w, h) {
      g.beginPath();
      g.moveTo(cx - w / 2, base);
      g.lineTo(cx - w / 2, base - h + w * 0.55);
      g.quadraticCurveTo(cx - w / 2, base - h + w * 0.05, cx, base - h);
      g.quadraticCurveTo(cx + w / 2, base - h + w * 0.05, cx + w / 2, base - h + w * 0.55);
      g.lineTo(cx + w / 2, base);
      g.closePath();
    }
    function minaret(x, w, h, light) {
      var top = HZ - h;
      var mg = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      mg.addColorStop(0, "#9b6f4a"); mg.addColorStop(0.45, brick(light)); mg.addColorStop(1, "#8a6040");
      g.fillStyle = mg;
      g.beginPath(); g.moveTo(x - w / 2, HZ); g.lineTo(x - w * 0.4, top); g.lineTo(x + w * 0.4, top); g.lineTo(x + w / 2, HZ); g.fill();
      // tile bands
      for (var b = 0; b < 5; b++) {
        var by = HZ - h * (0.18 + b * 0.17);
        g.fillStyle = b % 2 ? tileTurq : tileBlue; g.fillRect(x - w * 0.46, by, w * 0.92, 0.9 * PX);
      }
      // balcony and cap
      g.fillStyle = "#e9dcc0"; g.fillRect(x - w * 0.62, top - 0.6 * PX, w * 1.24, 0.9 * PX);
      g.fillStyle = "#2a9ca5"; g.beginPath(); g.ellipse(x, top - 0.6 * PX, w * 0.45, w * 0.55, 0, Math.PI, 0); g.fill();
    }
    function dome(cx, base, r, h, roof) {
      // drum (reaches down to the roof it stands on)
      g.fillStyle = tileBlue; g.fillRect(cx - r * 0.86, base - h * 0.42, r * 1.72, (roof || base) - (base - h * 0.42));
      g.fillStyle = "#e9dcc0"; g.fillRect(cx - r * 0.9, base - h * 0.44, r * 1.8, 0.4 * PX);
      // ribbed turquoise dome
      var top = base - h * 0.42;
      var dg = g.createLinearGradient(cx - r, 0, cx + r, 0);
      dg.addColorStop(0, "#14707a"); dg.addColorStop(0.4, "#3fc4c0"); dg.addColorStop(0.7, "#2aa3a8"); dg.addColorStop(1, "#0f5c66");
      g.fillStyle = dg;
      g.beginPath(); g.moveTo(cx - r, top);
      g.bezierCurveTo(cx - r * 1.05, top - h * 0.55, cx - r * 0.25, top - h * 0.8, cx, top - h * 0.86);
      g.bezierCurveTo(cx + r * 0.25, top - h * 0.8, cx + r * 1.05, top - h * 0.55, cx + r, top);
      g.fill();
      g.strokeStyle = "rgba(10,60,70,0.55)"; g.lineWidth = 0.18 * PX;
      for (var k = -4; k <= 4; k++) {
        g.beginPath(); g.moveTo(cx + k * r * 0.22, top);
        g.quadraticCurveTo(cx + k * r * 0.18, top - h * 0.6, cx, top - h * 0.86); g.stroke();
      }
      g.fillStyle = "#e6b34a"; g.fillRect(cx - 0.12 * PX, top - h * 0.86 - 1.6 * PX, 0.24 * PX, 1.6 * PX);
    }

    // one madrasa facade centred at azimuth `az`
    function madrasa(az, opt) {
      var cx = az * PX, w = opt.width * PX, h = opt.height * PX, light = opt.light;
      var left = cx - w / 2, right = cx + w / 2;
      // domes behind
      var wingH = h * 0.42;
      (opt.domes || []).forEach(function (d) { dome(cx + d[0] * PX, HZ - h * 0.55, d[1] * PX, d[2] * PX, HZ - wingH); });
      // side wings: two tiers of niches
      g.fillStyle = brick(light); g.fillRect(left, HZ - wingH, w, wingH);
      g.fillStyle = tileBlue; g.fillRect(left, HZ - wingH, w, 0.9 * PX);
      var portalW = w * 0.34, nW = 2.2 * PX;
      [[left + 1.5 * PX, cx - portalW / 2 - 0.5 * PX], [cx + portalW / 2 + 0.5 * PX, right - 1.5 * PX]].forEach(function (seg) {
        for (var nx = seg[0] + nW / 2; nx < seg[1] - nW / 2; nx += nW * 1.45) {
          [0, 1].forEach(function (tier) {
            var base = HZ - 0.8 * PX - tier * wingH * 0.46;
            arch(nx, base, nW, wingH * 0.38); g.fillStyle = "#2b1c22"; g.fill();
            arch(nx, base, nW * 0.78, wingH * 0.34); g.fillStyle = tier ? "#3a2830" : "#33232a"; g.fill();
            g.strokeStyle = "#2a9ca5"; g.lineWidth = 0.22 * PX; arch(nx, base, nW, wingH * 0.38); g.stroke();
          });
        }
      });
      // portal (pishtaq)
      var pl = cx - portalW / 2;
      g.fillStyle = opt.gold ? tileGold : tileBlue; g.fillRect(pl, HZ - h, portalW, h);
      g.strokeStyle = "#f2ead8"; g.lineWidth = 0.45 * PX; g.strokeRect(pl + 0.7 * PX, HZ - h + 0.7 * PX, portalW - 1.4 * PX, h - 0.7 * PX);
      // calligraphy band
      g.fillStyle = "#123a7a"; g.fillRect(pl + 1.2 * PX, HZ - h + 1.3 * PX, portalW - 2.4 * PX, 1.6 * PX);
      g.fillStyle = "#f2ead8";
      for (var cxx = pl + 1.8 * PX; cxx < pl + portalW - 2 * PX; cxx += 0.9 * PX) {
        g.fillRect(cxx, HZ - h + 1.6 * PX + (Math.sin(cxx) * 0.3 + 0.3) * PX, 0.18 * PX, (0.5 + Math.abs(Math.sin(cxx * 1.7)) * 0.6) * PX);
      }
      // great arch
      var aw = portalW * 0.62, ah = h * 0.74;
      arch(cx, HZ, aw + 1.2 * PX, ah + 0.8 * PX); g.fillStyle = "#e9dcc0"; g.fill();
      arch(cx, HZ, aw, ah); g.fillStyle = tileTurq; g.fill();
      arch(cx, HZ, aw * 0.72, ah * 0.84);
      var inner = g.createLinearGradient(0, HZ - ah, 0, HZ);
      inner.addColorStop(0, "#1e3f6e"); inner.addColorStop(1, "#2a1a22");
      g.fillStyle = inner; g.fill();
      // muqarnas hint
      g.fillStyle = "rgba(242,234,216,0.35)";
      for (var r = 0; r < 4; r++) for (var k = -r; k <= r; k++) {
        g.beginPath(); g.arc(cx + k * 0.9 * PX, HZ - ah * 0.8 + r * 0.9 * PX, 0.35 * PX, 0, Math.PI); g.fill();
      }
      // door
      arch(cx, HZ, aw * 0.26, ah * 0.32); g.fillStyle = "#5a3520"; g.fill();
      // special emblem (Sher-Dor tigers & sun) as a gold disc
      if (opt.emblem) {
        [-1, 1].forEach(function (s) {
          var ex = cx + s * aw * 0.36, ey = HZ - ah * 0.78;
          g.fillStyle = "#e6b34a"; g.beginPath(); g.arc(ex, ey, 1.1 * PX, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#f6e6b8"; g.beginPath(); g.arc(ex, ey, 0.7 * PX, 0, Math.PI * 2); g.fill();
        });
      }
      // minarets at the corners
      minaret(left + 0.2 * PX, 2.3 * PX, h * 1.12, light);
      minaret(right - 0.2 * PX, 2.3 * PX, h * 1.12, light);
      // warm sunlight wash from the west
      var sh = g.createLinearGradient(left, 0, right, 0);
      sh.addColorStop(0, light ? "rgba(255,190,120,0.18)" : "rgba(30,20,50,0.18)");
      sh.addColorStop(1, light ? "rgba(255,190,120,0.02)" : "rgba(30,20,50,0.32)");
      g.fillStyle = sh; g.fillRect(left, HZ - wingH, w, wingH); g.fillRect(pl, HZ - h, portalW, h - wingH);
    }

    // Ulugbek (west), Tilya-Kori (north, gilded, big dome), Sher-Dor (east, emblem)
    madrasa(90, { width: 62, height: 30, light: true, domes: [[-18, 4.5, 9], [18, 4.5, 9]] });
    madrasa(180, { width: 74, height: 26, light: true, gold: true, domes: [[-24, 7, 13]] });
    madrasa(270, { width: 62, height: 30, light: false, emblem: true, domes: [[-18, 4.5, 9], [18, 4.5, 9]] });

    // --- ground: warm paving with perspective rows
    var gr = g.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, "#c9a57a"); gr.addColorStop(0.25, "#a9845e"); gr.addColorStop(1, "#5a4636");
    g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
    g.strokeStyle = "rgba(70,50,35,0.16)"; g.lineWidth = 1;
    for (var row = 1; row < 60; row++) {
      var yy = HZ + Math.pow(row / 60, 1.8) * (H - HZ);
      g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke();
    }
    for (x = 0; x < W; x += 3 * PX) {
      g.beginPath(); g.moveTo(x, HZ); g.lineTo(x, H); g.stroke();
    }
    // a soft circle at the viewer's feet with the logo colours
    g.fillStyle = "rgba(13,31,60,0.55)"; g.fillRect(0, H - 6 * PX, W, 6 * PX);
    g.fillStyle = "rgba(230,179,74,0.9)"; g.fillRect(0, H - 6.2 * PX, W, 0.25 * PX);
    // long evening shadows of the madrasas
    [90, 180, 270].forEach(function (az) {
      var sg = g.createLinearGradient(0, HZ, 0, HZ + 4 * PX);
      sg.addColorStop(0, "rgba(40,25,30,0.32)"); sg.addColorStop(1, "rgba(40,25,30,0)");
      g.fillStyle = sg; g.fillRect((az - 31) * PX, HZ, 62 * PX, 4 * PX);
    });
    // a darker inlaid ring in the paving
    g.fillStyle = "rgba(29,79,156,0.18)"; g.fillRect(0, HZ + 16 * PX, W, 1.2 * PX);
    g.fillStyle = "rgba(230,179,74,0.22)"; g.fillRect(0, HZ + 17.6 * PX, W, 0.4 * PX);
    return c;
  }

  // ---------------------------------------------------------------
  // 2. Viewer: plain WebGL, finger drag, phone tilt, gentle drift
  // ---------------------------------------------------------------
  function start(box) {
    var canvas = box.querySelector("canvas.pano-gl");
    var gl = canvas.getContext("webgl", { antialias: false }) || canvas.getContext("experimental-webgl");
    if (!gl) throw new Error("no webgl");
    function sh(type, src) { var o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, [
      "precision highp float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,fov,aspect;",
      "void main(){float k=tan(fov*.5);vec3 d=normalize(vec3(v.x*k*aspect,v.y*k,-1.));",
      "float cp=cos(pitch),sp=sin(pitch);d=vec3(d.x,d.y*cp+d.z*sp,-d.y*sp+d.z*cp);",
      "float cy=cos(yaw),sy=sin(yaw);d=vec3(d.x*cy-d.z*sy,d.y,d.x*sy+d.z*cy);",
      "float lon=atan(d.x,-d.z);float lat=asin(clamp(d.y,-1.,1.));",
      "gl_FragColor=texture2D(t,vec2(fract(lon/6.2831853+.5),.5-lat/3.1415927));}"
    ].join("")));
    gl.linkProgram(prog); gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var size = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048);
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paintPanorama(size));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var U = {}; ["yaw", "pitch", "fov", "aspect"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    var lon = 0, lat = 9, dragging = false, px = 0, py = 0, plon = 0, plat = 0, lastTouch = 0;
    var tilt = null, tiltBase = null, aspect = 1;
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2), w = box.clientWidth, h = box.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); aspect = w / h;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize); resize();

    canvas.addEventListener("pointerdown", function (e) { dragging = true; px = e.clientX; py = e.clientY; plon = lon; plat = lat; lastTouch = Date.now(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
    canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      lon = plon - (e.clientX - px) * 0.2; lat = Math.max(-55, Math.min(55, plat + (e.clientY - py) * 0.2)); lastTouch = Date.now();
      if (tilt) tiltBase = { a: tilt.a, b: tilt.b, lon: lon, lat: lat };
    });
    ["pointerup", "pointercancel"].forEach(function (n) { canvas.addEventListener(n, function () { dragging = false; }); });

    function onOrient(e) {
      if (e.alpha == null) return;
      var portrait = window.innerHeight >= window.innerWidth;
      tilt = { a: e.alpha, b: portrait ? e.beta - 90 : -Math.abs(e.gamma) + 90 };
      if (!tiltBase) tiltBase = { a: tilt.a, b: tilt.b, lon: lon, lat: lat };
    }
    function enableTilt() {
      var D = window.DeviceOrientationEvent;
      function on() { window.addEventListener("deviceorientation", onOrient); box.classList.add("tilt-on"); }
      if (D && typeof D.requestPermission === "function") D.requestPermission().then(function (st) { if (st === "granted") on(); }).catch(function () {});
      else if (D) on();
    }
    var tiltBtn = box.querySelector("[data-tilt]");
    if (tiltBtn) {
      var needsAsk = window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === "function";
      if (!("ontouchstart" in window)) tiltBtn.hidden = true;
      else if (!needsAsk) { enableTilt(); tiltBtn.hidden = true; }
      tiltBtn.addEventListener("click", function () { enableTilt(); tiltBtn.hidden = true; });
    }

    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var visible = true;
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(box);
    function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      if (tilt && tiltBase && !dragging) {
        var da = tilt.a - tiltBase.a; if (da > 180) da -= 360; if (da < -180) da += 360;
        lon = tiltBase.lon - da; lat = Math.max(-55, Math.min(55, tiltBase.lat + (tilt.b - tiltBase.b)));
      } else if (!dragging && !still && Date.now() - lastTouch > 2500) lon += 0.035;
      gl.uniform1f(U.yaw, lon * Math.PI / 180); gl.uniform1f(U.pitch, -lat * Math.PI / 180);
      gl.uniform1f(U.fov, (aspect < 1.2 ? 78 : 66) * Math.PI / 180); gl.uniform1f(U.aspect, aspect);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    frame();
  }

  // ---------------------------------------------------------------
  // 3. Music (only if a music file is present next to the page)
  // ---------------------------------------------------------------
  function music(box) {
    var btn = box.querySelector("[data-music]"); if (!btn) return;
    var src = btn.getAttribute("data-music"), audio = null;
    fetch(src, { method: "HEAD" }).then(function (r) { if (r.ok) btn.hidden = false; }).catch(function () {});
    btn.addEventListener("click", function () {
      if (!audio) { audio = new Audio(src); audio.loop = true; audio.volume = 0.55; }
      if (audio.paused) { audio.play().then(function () { btn.setAttribute("aria-pressed", "true"); }).catch(function () {}); }
      else { audio.pause(); btn.setAttribute("aria-pressed", "false"); }
    });
  }

  window.PlovPano = { paint: paintPanorama, start: start };
  function boot() {
    var real = document.getElementById("pano360btns"); if (real) music(real);
    var box = document.getElementById("pano"); if (!box) return;
    music(box);
    var go = function () { try { start(box); } catch (e) { box.classList.add("no-gl"); } };
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); go(); } }, { rootMargin: "200px" });
      io.observe(box);
    } else go();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
