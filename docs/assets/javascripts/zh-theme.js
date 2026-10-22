/* ==========================================================================
   Zhe Hu · 页面动效（克制版）
   - 横幅画布：夜 = 紫色星空 + 银河；昼 = 晨空 + 云 + 远山；两者都有少量落花
   - 卡片淡入、昼夜切换圆形转场、东京时间、体素小动画、Giscus 主题同步
   ========================================================================== */
(function () {
  "use strict";

  var html = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var listeners = [];

  function scheme() { return body.getAttribute("data-md-color-scheme") === "slate" ? "night" : "day"; }
  function onScheme(fn) { listeners.push(fn); }
  var current = scheme();
  new MutationObserver(function () {
    var s = scheme();
    if (s !== current) { current = s; listeners.forEach(function (fn) { fn(s); }); }
  }).observe(body, { attributes: true, attributeFilter: ["data-md-color-scheme"] });

  /* ---------- theme-color meta ---------- */
  function syncMeta() {
    var bg = getComputedStyle(body).getPropertyValue("--zh-bg").trim() || (current === "night" ? "#0e0c18" : "#f5f2ec");
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    if (!metas.length) {
      var m = document.createElement("meta");
      m.name = "theme-color";
      document.head.appendChild(m);
      metas = [m];
    }
    Array.prototype.forEach.call(metas, function (m) { m.content = bg; });
  }
  onScheme(function () { setTimeout(syncMeta, 0); });
  setTimeout(syncMeta, 0);
  window.addEventListener("load", syncMeta);

  /* ---------- 昼夜切换：圆形展开 ---------- */
  document.addEventListener("click", function (e) {
    var label = e.target.closest && e.target.closest('form[data-md-component="palette"] label');
    if (!label || reduced || !document.startViewTransition) return;
    var input = document.getElementById(label.htmlFor);
    if (!input) return;
    e.preventDefault();
    var r = label.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    var vt = document.startViewTransition(function () {
      input.click();
      ["scheme", "primary", "accent", "media"].forEach(function (k) {
        var v = input.getAttribute("data-md-color-" + k);
        if (v) body.setAttribute("data-md-color-" + k, v);
      });
    });
    vt.ready.then(function () {
      html.animate(
        { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + end + "px at " + x + "px " + y + "px)"] },
        { duration: 800, easing: "cubic-bezier(.65, 0, .35, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(function () {});
  }, true);

  /* ---------- 卡片淡入 ---------- */
  var reveals = document.querySelectorAll(".zh-reveal");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i, 3) * 70 + "ms";
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- 东京时间 ---------- */
  var timeEls = document.querySelectorAll(".zh-tokyo-time");
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function tick() {
    var d = new Date();
    var t = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
    var s = pad(t.getHours()) + ":" + pad(t.getMinutes());
    timeEls.forEach(function (el) { el.textContent = s; });
  }
  if (timeEls.length) { tick(); setInterval(tick, 15000); }

  /* ---------- 工具 ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return (r() + r() + r() + r() - 2) / 2; }
  function ridge(g, W, H, base, amps, color, seed) {
    var r = rng(seed);
    var ph = amps.map(function () { return r() * 6.28; });
    g.beginPath();
    g.moveTo(0, H);
    for (var x = 0; x <= W + 8; x += 8) {
      var y = base * H;
      for (var i = 0; i < amps.length; i++) y -= amps[i][0] * H * Math.sin((x / W) * amps[i][1] * 6.28 + ph[i]);
      g.lineTo(x, y);
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = color;
    g.fill();
  }

  /* ---------- 横幅画布 ---------- */
  (function banner() {
    var canvas = document.querySelector(".zh-banner__sky");
    if (!canvas || !canvas.getContext) return;
    var bannerEl = canvas.closest(".zh-banner");
    var art = bannerEl.querySelector(".zh-banner__art");
    var inner = bannerEl.querySelector(".zh-banner__inner");
    var ctx = canvas.getContext("2d");
    var bg = document.createElement("canvas");
    var bgx = bg.getContext("2d");
    var W = 0, H = 0, DPR = 1, time = 0, last = 0, raf = 0, visible = true;
    var bright = [], petals = [], shoot = null, nextShoot = 4000;
    var glow = document.createElement("canvas");

    (function makeGlow() {
      glow.width = glow.height = 64;
      var g = glow.getContext("2d");
      var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.15, "rgba(235,225,255,.8)");
      grd.addColorStop(0.45, "rgba(180,150,255,.18)");
      grd.addColorStop(1, "rgba(180,150,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    })();

    function useImage() {
      return canvas.getAttribute(current === "night" ? "data-image-night" : "data-image-day") === "1";
    }

    function paintNight(g) {
      var r = rng(20261023);
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#090817");
      sky.addColorStop(0.35, "#161137");
      sky.addColorStop(0.65, "#2d2160");
      sky.addColorStop(0.86, "#4f3584");
      sky.addColorStop(1, "#6a4594");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      var hz = g.createRadialGradient(W * 0.5, H * 1.08, 0, W * 0.5, H * 1.08, Math.max(W * 0.65, H));
      hz.addColorStop(0, "rgba(240,160,215,.38)");
      hz.addColorStop(0.45, "rgba(170,110,220,.14)");
      hz.addColorStop(1, "rgba(120,80,200,0)");
      g.fillStyle = hz;
      g.fillRect(0, 0, W, H);

      // 银河
      var ax = -0.05 * W, ay = 0.92 * H, bx = 1.05 * W, by = 0.02 * H;
      var len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      var scale = Math.max(W, 900) / 1400;
      function onBand(t, spread) {
        var off = gauss(r) * spread;
        var bend = Math.sin(t * 3.14) * H * 0.06;
        return [ax + (bx - ax) * t + nx * (off + bend), ay + (by - ay) * t + ny * (off + bend)];
      }
      g.globalCompositeOperation = "lighter";
      var cols = [[150, 112, 255], [236, 140, 214], [112, 150, 255], [190, 160, 255]];
      for (var i = 0; i < 70; i++) {
        var p = onBand(r(), H * 0.09);
        var rad = (60 + r() * 170) * scale;
        var c = cols[Math.floor(r() * cols.length)];
        var a = 0.025 + r() * 0.05;
        var grd = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], rad);
        grd.addColorStop(0, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")");
        grd.addColorStop(1, "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)");
        g.fillStyle = grd;
        g.beginPath(); g.arc(p[0], p[1], rad, 0, 6.283); g.fill();
      }
      var nDust = Math.min(2600, Math.round((W * H) / 700));
      for (var j = 0; j < nDust; j++) {
        var q = onBand(r(), H * 0.13);
        var al = 0.12 + r() * 0.55;
        g.fillStyle = r() < 0.2 ? "rgba(255,220,245," + al + ")" : "rgba(235,232,255," + al + ")";
        var s = 0.4 + r() * 0.8;
        g.fillRect(q[0], q[1], s, s);
      }
      g.globalCompositeOperation = "source-over";
      // 暗尘带
      for (var k = 0; k < 16; k++) {
        var d = onBand(0.15 + r() * 0.7, H * 0.025);
        var dr = (40 + r() * 90) * scale;
        var dg = g.createRadialGradient(d[0], d[1], 0, d[0], d[1], dr);
        dg.addColorStop(0, "rgba(14,10,36,.2)");
        dg.addColorStop(1, "rgba(14,10,36,0)");
        g.fillStyle = dg;
        g.beginPath(); g.arc(d[0], d[1], dr, 0, 6.283); g.fill();
      }
      // 全天星点
      var nStars = Math.min(900, Math.round((W * H) / 2600));
      for (var m = 0; m < nStars; m++) {
        var sa = 0.15 + r() * 0.6;
        g.fillStyle = "rgba(240,236,255," + sa + ")";
        var ss = r() < 0.06 ? 1.6 : 0.5 + r() * 0.7;
        g.fillRect(r() * W, r() * H * 0.9, ss, ss);
      }
      // 远山剪影
      ridge(g, W, H, 0.88, [[0.035, 1.3], [0.018, 3.7], [0.006, 9]], "rgba(38,28,72,.9)", 7);
      ridge(g, W, H, 0.94, [[0.03, 0.9], [0.012, 4.4], [0.005, 11]], "#15112a", 11);
    }

    function paintDay(g) {
      var r = rng(19);
      var sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#a7bbe8");
      sky.addColorStop(0.34, "#c6c8ee");
      sky.addColorStop(0.62, "#ead4e6");
      sky.addColorStop(0.82, "#f6e1d9");
      sky.addColorStop(1, "#f5ece2");
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);

      var sx = W * 0.76, sy = H * 0.3;
      var sun = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.42);
      sun.addColorStop(0, "rgba(255,252,244,.95)");
      sun.addColorStop(0.12, "rgba(255,246,236,.65)");
      sun.addColorStop(0.45, "rgba(255,236,230,.18)");
      sun.addColorStop(1, "rgba(255,236,230,0)");
      g.fillStyle = sun;
      g.fillRect(0, 0, W, H);

      var scale = Math.max(W, 900) / 1400;
      // 卷云
      for (var c = 0; c < 7; c++) {
        g.save();
        g.translate(r() * W, H * (0.12 + r() * 0.3));
        g.rotate(-0.08 + r() * 0.16);
        g.scale(1, 0.09 + r() * 0.06);
        var cr = (140 + r() * 220) * scale;
        var cg = g.createRadialGradient(0, 0, 0, 0, 0, cr);
        cg.addColorStop(0, "rgba(255,255,255,.5)");
        cg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = cg;
        g.beginPath(); g.arc(0, 0, cr, 0, 6.283); g.fill();
        g.restore();
      }
      // 积云
      var clusters = [[0.1, 0.66, 1.15], [0.36, 0.72, 0.75], [0.62, 0.64, 1.0], [0.9, 0.7, 1.25], [0.24, 0.36, 0.45], [0.82, 0.48, 0.5]];
      clusters.forEach(function (cl) {
        var cx = cl[0] * W, base = cl[1] * H, s = cl[2] * scale;
        var half = 240 * s;
        var puffs = [];
        for (var i = 0; i < 22; i++) {
          var dx = (r() * 2 - 1) * half;
          var hump = Math.pow(1 - Math.abs(dx) / half, 0.8);
          puffs.push({
            x: cx + dx,
            y: base - hump * 62 * s - r() * 16 * s,
            r: (48 + r() * 52) * s * (0.55 + hump * 0.7)
          });
        }
        // 底部阴影
        puffs.forEach(function (p) {
          var sg = g.createRadialGradient(p.x, p.y + p.r * 0.28, 0, p.x, p.y + p.r * 0.28, p.r * 1.05);
          sg.addColorStop(0, "rgba(196,184,226,.32)");
          sg.addColorStop(1, "rgba(196,184,226,0)");
          g.fillStyle = sg;
          g.beginPath(); g.arc(p.x, p.y + p.r * 0.28, p.r * 1.05, 0, 6.283); g.fill();
        });
        // 受光面
        puffs.forEach(function (p) {
          var pg = g.createRadialGradient(p.x, p.y - p.r * 0.1, 0, p.x, p.y, p.r);
          pg.addColorStop(0, "rgba(255,255,255,.62)");
          pg.addColorStop(0.5, "rgba(255,252,252,.34)");
          pg.addColorStop(1, "rgba(255,250,252,0)");
          g.fillStyle = pg;
          g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
        });
      });
      // 远山与雾
      ridge(g, W, H, 0.8, [[0.05, 1.1], [0.02, 3.1], [0.007, 8]], "rgba(150,156,204,.42)", 3);
      var mist = g.createLinearGradient(0, H * 0.72, 0, H);
      mist.addColorStop(0, "rgba(255,248,244,0)");
      mist.addColorStop(1, "rgba(255,248,244,.55)");
      g.fillStyle = mist;
      g.fillRect(0, H * 0.72, W, H * 0.28);
      ridge(g, W, H, 0.88, [[0.04, 0.8], [0.016, 3.9], [0.006, 10]], "rgba(122,120,172,.4)", 5);
      ridge(g, W, H, 0.95, [[0.03, 1.4], [0.012, 4.7], [0.004, 12]], "rgba(98,92,140,.38)", 9);
      // 飞鸟
      g.strokeStyle = "rgba(70,66,100,.45)";
      g.lineWidth = 1.2;
      g.lineCap = "round";
      [[0.6, 0.22, 1], [0.63, 0.25, 0.75], [0.58, 0.27, 0.6]].forEach(function (b) {
        var x = b[0] * W, y = b[1] * H, s = 7 * b[2] * scale + 2;
        g.beginPath();
        g.moveTo(x - s, y - s * 0.35); g.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
        g.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * 0.35);
        g.stroke();
      });
    }

    function seedDynamic() {
      var r = rng(42);
      bright = [];
      if (current === "night") {
        var n = Math.min(34, Math.round(W / 45));
        for (var i = 0; i < n; i++) bright.push({ x: r() * W, y: r() * H * 0.78, s: 5 + r() * 9, ph: r() * 6.28, sp: 0.6 + r() * 1.4 });
      }
      petals = [];
      var np = Math.max(7, Math.min(18, Math.round(W / 95)));
      for (var p = 0; p < np; p++) petals.push(newPetal(true));
    }
    function newPetal(anywhere) {
      return {
        x: anywhere ? Math.random() * W : -20 - Math.random() * 80,
        y: anywhere ? Math.random() * H : Math.random() * H * 0.6 - 40,
        vx: 0.018 + Math.random() * 0.03,
        vy: 0.012 + Math.random() * 0.022,
        r: 3.2 + Math.random() * 3.6,
        rot: Math.random() * 6.28,
        rs: (Math.random() - 0.5) * 0.002,
        ph: Math.random() * 6.28,
        fs: 0.0015 + Math.random() * 0.002,
        a: 0.45 + Math.random() * 0.4
      };
    }

    function resize() {
      var rect = bannerEl.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(rect.height));
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      [canvas, bg].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      bgx.setTransform(DPR, 0, 0, DPR, 0, 0);
      paintStatic();
      seedDynamic();
      draw();
    }
    function paintStatic() {
      bgx.clearRect(0, 0, W, H);
      if (useImage()) return;
      if (current === "night") paintNight(bgx); else paintDay(bgx);
    }

    function petalPath(p) {
      var r = p.r;
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(r * 0.95, r * 0.35, r * 0.85, -r * 0.55, r * 0.28, -r);
      ctx.lineTo(0, -r * 0.72);
      ctx.lineTo(-r * 0.28, -r);
      ctx.bezierCurveTo(-r * 0.85, -r * 0.55, -r * 0.95, r * 0.35, 0, r);
      ctx.closePath();
    }

    function update(dt) {
      time += dt;
      for (var i = 0; i < petals.length; i++) {
        var p = petals[i];
        p.x += p.vx * dt + Math.sin(time * 0.0009 + p.ph) * 0.12;
        p.y += p.vy * dt;
        p.rot += p.rs * dt;
        if (p.x > W + 30 || p.y > H + 30) petals[i] = newPetal(false);
      }
      if (current === "night" && !useImage()) {
        nextShoot -= dt;
        if (!shoot && nextShoot <= 0) {
          shoot = { x: W * (0.35 + Math.random() * 0.6), y: H * (0.05 + Math.random() * 0.25), vx: -(0.55 + Math.random() * 0.35), vy: 0.22 + Math.random() * 0.15, life: 0, max: 900 + Math.random() * 500 };
          nextShoot = 7000 + Math.random() * 9000;
        }
        if (shoot) {
          shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life += dt;
          if (shoot.life > shoot.max) shoot = null;
        }
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(bg, 0, 0, W, H);
      var night = current === "night";
      if (night && !useImage()) {
        for (var i = 0; i < bright.length; i++) {
          var b = bright[i];
          var tw = 0.55 + 0.45 * Math.sin(time * 0.001 * b.sp + b.ph);
          var s = b.s * (0.75 + tw * 0.35);
          ctx.globalAlpha = 0.35 + tw * 0.65;
          ctx.drawImage(glow, b.x - s, b.y - s, s * 2, s * 2);
        }
        ctx.globalAlpha = 1;
        if (shoot) {
          var k = Math.sin((shoot.life / shoot.max) * Math.PI);
          var tx = shoot.x - shoot.vx * 140, ty = shoot.y - shoot.vy * 140;
          var lg = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
          lg.addColorStop(0, "rgba(255,255,255," + (0.9 * k).toFixed(3) + ")");
          lg.addColorStop(1, "rgba(190,160,255,0)");
          ctx.strokeStyle = lg;
          ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(tx, ty); ctx.stroke();
        }
      }
      for (var j = 0; j < petals.length; j++) {
        var p = petals[j];
        var flip = Math.abs(Math.sin(time * p.fs + p.ph));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(0.35 + flip * 0.65, 1);
        petalPath(p);
        ctx.fillStyle = night ? "rgba(255,206,232," + (p.a * 0.85).toFixed(3) + ")" : "rgba(238,160,170," + p.a.toFixed(3) + ")";
        ctx.fill();
        ctx.restore();
      }
    }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      var dt = last ? Math.min(50, t - last) : 16;
      last = t;
      if (!visible) return;
      update(dt);
      draw();
    }

    resize();
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 180); });
    onScheme(function () { paintStatic(); seedDynamic(); draw(); });
    if (!reduced) {
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(bannerEl);
      }
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
        else if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
      });
      raf = requestAnimationFrame(loop);

      // 轻微视差
      var ticking = false;
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var y = Math.min(scrollY, H);
          art.style.transform = "translate3d(0," + (y * 0.32).toFixed(1) + "px,0)";
          if (inner) {
            inner.style.opacity = Math.max(0, 1 - y / (H * 0.6)).toFixed(3);
            inner.style.transform = "translate3d(0," + (y * 0.18).toFixed(1) + "px,0)";
          }
        });
      }, { passive: true });
    }
  })();

  /* ---------- 体素小动画（示意，非真实数据） ---------- */
  (function voxels() {
    var vox = document.querySelector(".zh-voxels");
    if (!vox || !vox.getContext) return;
    var g = vox.getContext("2d");
    var vw = 0, vh = 0, cells = [], visible = false, t = 0, last = 0;
    var blobs = [
      { ax: 0.32, ay: 0.28, fx: 0.00031, fy: 0.00043, p: 0 },
      { ax: 0.28, ay: 0.34, fx: 0.00047, fy: 0.00029, p: 2.1 },
      { ax: 0.36, ay: 0.22, fx: 0.00023, fy: 0.00051, p: 4.2 }
    ];
    function layout() {
      var r = vox.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      vw = r.width; vh = r.height;
      if (!vw || !vh) return;
      vox.width = Math.round(vw * dpr); vox.height = Math.round(vh * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      cells = [];
      var size = Math.max(6, Math.min(10, Math.round(Math.min(vw, vh) / 18)));
      var cx = vw / 2, cy = vh / 2, a = Math.min(vw * 0.4, vh * 0.33), b = vh * 0.43;
      for (var y = cy - b; y <= cy + b; y += size) {
        for (var x = cx - a; x <= cx + a; x += size) {
          var nx = (x + size / 2 - cx) / a, ny = (y + size / 2 - cy) / b;
          if ((nx * nx) / (1 - 0.14 * ny) + ny * ny > 1) continue;
          if (Math.abs(nx) < 0.06 && (ny < -0.28 || ny > 0.62)) continue; // 纵裂
          var vx2 = (Math.abs(nx) - 0.2) / 0.1, vy2 = (ny - 0.02) / 0.22;
          if (vx2 * vx2 + vy2 * vy2 < 1) continue;
          cells.push({ x: x, y: y, nx: nx, ny: ny, s: size - 2 });
        }
      }
      draw();
    }
    function draw() {
      var night = current === "night";
      g.clearRect(0, 0, vw, vh);
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i], v = 0;
        for (var j = 0; j < blobs.length; j++) {
          var bl = blobs[j];
          var dx = c.nx - Math.sin(t * bl.fx + bl.p) * bl.ax * 2.2;
          var dy = c.ny - Math.cos(t * bl.fy + bl.p * 1.3) * bl.ay * 2.2;
          v += Math.exp(-(dx * dx + dy * dy) / 0.07);
        }
        v = Math.min(1, v);
        var base = 0.1 + 0.06 * (1 - (c.nx * c.nx + c.ny * c.ny));
        g.fillStyle = night
          ? "rgba(" + Math.round(150 + 90 * v) + "," + Math.round(120 + 70 * v) + ",255," + (base + v * 0.8).toFixed(3) + ")"
          : "rgba(" + Math.round(150 + 39 * v) + "," + Math.round(90 - 20 * v) + "," + Math.round(80 - 24 * v) + "," + (base + v * 0.75).toFixed(3) + ")";
        g.beginPath();
        if (g.roundRect) g.roundRect(c.x + 1, c.y + 1, c.s, c.s, 2); else g.rect(c.x + 1, c.y + 1, c.s, c.s);
        g.fill();
      }
    }
    function loop(ts) {
      requestAnimationFrame(loop);
      var dt = last ? Math.min(50, ts - last) : 16;
      last = ts;
      if (!visible) return;
      t += dt;
      draw();
    }
    layout();
    window.addEventListener("resize", function () { setTimeout(layout, 200); });
    onScheme(draw);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.05 }).observe(vox);
    } else { visible = true; }
    if (!reduced) requestAnimationFrame(loop);
  })();

  /* ---------- Giscus 主题同步 ---------- */
  function syncGiscus() {
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ giscus: { setConfig: { theme: current === "night" ? "transparent_dark" : "light" } } }, "https://giscus.app");
  }
  var giscusReady = false;
  window.addEventListener("message", function (e) {
    if (e.origin !== "https://giscus.app" || giscusReady) return;
    giscusReady = true;
    syncGiscus();
  });
  onScheme(syncGiscus);
})();
