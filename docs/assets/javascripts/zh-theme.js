/* ==========================================================================
   Zhe Hu · 页面动效（克制版）
   - 横幅画布：夜 = 紫色星空 + 银河 + 落羽；昼 = 晨空 + 云 + 远山 + 落花
   - 横幅纹样：夜间时钟按东京时间走；人物与纹样随滚动轻微视差
   - 卡片淡入、昼夜切换圆形转场（人物重新入场）、东京时间
   - 侧栏像素方阵：点击切换头像，像素从点击处波纹式翻转
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

  /* ---------- 东京时间（共用） ---------- */
  function tokyoNow() {
    var d = new Date();
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 9 * 3600000);
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

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

  /* ---------- 侧栏东京时间 ---------- */
  var timeEls = document.querySelectorAll(".zh-tokyo-time");
  function tick() {
    var t = tokyoNow();
    var s = pad(t.getHours()) + ":" + pad(t.getMinutes());
    timeEls.forEach(function (el) { el.textContent = s; });
  }
  if (timeEls.length) { tick(); setInterval(tick, 15000); }

  /* ---------- Research：每个项目包成一张小卡 ---------- */
  (function entries() {
    if (!document.querySelector('.zh-banner[data-page="pubs"]')) return;
    var page = document.querySelector(".zh-page");
    if (!page) return;
    Array.prototype.slice.call(page.querySelectorAll(":scope > h3")).forEach(function (h3) {
      var wrap = document.createElement("div");
      wrap.className = "zh-entry";
      h3.parentNode.insertBefore(wrap, h3);
      var n = h3;
      while (n && (n === h3 || !/^(H1|H2|H3|HR)$/.test(n.tagName))) {
        var next = n.nextElementSibling;
        wrap.appendChild(n);
        n = next;
      }
    });
  })();

  /* ---------- 横幅：昼夜切换时人物与纹样重新入场 ---------- */
  var bannerEl = document.querySelector(".zh-banner");
  (function entrance() {
    if (!bannerEl || reduced) return;
    var layers = bannerEl.querySelectorAll(".zh-banner__cast, .zh-banner__motif");
    onScheme(function () {
      layers.forEach(function (el) {
        el.classList.remove("is-entering");
        void el.offsetWidth;
        el.classList.add("is-entering");
      });
    });
  })();

  /* ---------- 横幅：夜间时钟（东京时间） ---------- */
  (function clock() {
    if (!bannerEl) return;
    var hands = {
      h: bannerEl.querySelector(".zh-clock__hand--h"),
      m: bannerEl.querySelector(".zh-clock__hand--m"),
      s: bannerEl.querySelector(".zh-clock__hand--s")
    };
    if (!hands.h || !hands.m || !hands.s) return;
    var lastS = -1;
    function update() {
      var t = tokyoNow();
      var sec = t.getHours() * 3600 + t.getMinutes() * 60 + t.getSeconds();
      // 角度单调递增，指针不会倒转；过午夜时跳回则临时关闭过渡
      if (sec < lastS) hands.s.style.transition = "none";
      else hands.s.style.transition = "";
      lastS = sec;
      hands.s.style.transform = "rotate(" + sec * 6 + "deg)";
      hands.m.style.transform = "rotate(" + sec * 0.1 + "deg)";
      hands.h.style.transform = "rotate(" + sec / 120 + "deg)";
    }
    update();
    var timer = 0;
    function sync() {
      var run = current === "night" && !document.hidden;
      if (run && !timer) { update(); timer = setInterval(update, reduced ? 15000 : 1000); }
      else if (!run && timer) { clearInterval(timer); timer = 0; }
    }
    onScheme(sync);
    document.addEventListener("visibilitychange", sync);
    sync();
  })();

  /* ---------- 横幅：滚动视差 ---------- */
  (function parallax() {
    if (!bannerEl || reduced) return;
    var layers = Array.prototype.map.call(bannerEl.querySelectorAll("[data-parallax]"), function (el) {
      return { el: el, f: parseFloat(el.getAttribute("data-parallax")) || 0, fade: el.classList.contains("zh-banner__inner") };
    });
    if (!layers.length) return;
    var ticking = false, h = bannerEl.offsetHeight;
    function apply() {
      ticking = false;
      var y = Math.max(0, window.scrollY || window.pageYOffset || 0);
      if (y > h * 1.2) y = h * 1.2;
      layers.forEach(function (l) {
        l.el.style.transform = y ? "translate3d(0," + (y * l.f).toFixed(1) + "px,0)" : "";
        if (l.fade) l.el.style.opacity = y ? Math.max(0, 1 - y / (h * 0.75)).toFixed(3) : "";
      });
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    window.addEventListener("resize", function () { h = bannerEl.offsetHeight; apply(); });
    apply();
  })();

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
    var ctx = canvas.getContext("2d");
    var bg = document.createElement("canvas");
    var bgx = bg.getContext("2d");
    var W = 0, H = 0, DPR = 1, time = 0, last = 0, raf = 0, visible = true;
    var bright = [], drifts = [], shoot = null, nextShoot = 4000;
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

    /* 纹样（日轮 / 时钟）在横幅中的中心，用来对齐画布里的光晕 */
    function motifCenter(sel, fx, fy) {
      // 用 offset 计算（不受视差 transform 与入场动画影响）
      var el = bannerEl.querySelector(sel);
      if (el && el.offsetWidth) {
        var x = el.offsetLeft, y = el.offsetTop, p = el.offsetParent;
        while (p && p !== bannerEl && bannerEl.contains(p)) { x += p.offsetLeft; y += p.offsetTop; p = p.offsetParent; }
        return [x + el.offsetWidth / 2, y + el.offsetHeight / 2, el.offsetWidth / 2];
      }
      return [W * fx, H * fy, Math.min(W, H) * 0.3];
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
      // 时钟身后一圈很淡的光
      var mc = motifCenter(".zh-motif--clock", 0.74, 0.42);
      var cg = g.createRadialGradient(mc[0], mc[1], 0, mc[0], mc[1], mc[2] * 1.25);
      cg.addColorStop(0, "rgba(170,140,255,.16)");
      cg.addColorStop(0.6, "rgba(150,120,240,.06)");
      cg.addColorStop(1, "rgba(150,120,240,0)");
      g.fillStyle = cg;
      g.fillRect(0, 0, W, H);
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

      // 阳光与日轮对齐
      var mc = motifCenter(".zh-motif--sun", 0.76, 0.3);
      var sx = mc[0], sy = mc[1];
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
        puffs.forEach(function (p) {
          var sg = g.createRadialGradient(p.x, p.y + p.r * 0.28, 0, p.x, p.y + p.r * 0.28, p.r * 1.05);
          sg.addColorStop(0, "rgba(196,184,226,.32)");
          sg.addColorStop(1, "rgba(196,184,226,0)");
          g.fillStyle = sg;
          g.beginPath(); g.arc(p.x, p.y + p.r * 0.28, p.r * 1.05, 0, 6.283); g.fill();
        });
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

    /* 飘落物：昼 = 花瓣，夜 = 羽毛（深色羽，带一点紫色描边，少量浅色羽） */
    function seedDynamic() {
      var r = rng(42);
      bright = [];
      if (current === "night") {
        var n = Math.min(34, Math.round(W / 45));
        for (var i = 0; i < n; i++) bright.push({ x: r() * W, y: r() * H * 0.78, s: 5 + r() * 9, ph: r() * 6.28, sp: 0.6 + r() * 1.4 });
      }
      drifts = [];
      var np = current === "night" ? Math.max(5, Math.min(12, Math.round(W / 130))) : Math.max(7, Math.min(18, Math.round(W / 95)));
      for (var p = 0; p < np; p++) drifts.push(newDrift(true));
    }
    function newDrift(anywhere) {
      var night = current === "night";
      return {
        x: anywhere ? Math.random() * W : -20 - Math.random() * 80,
        y: anywhere ? Math.random() * H : Math.random() * H * 0.6 - 40,
        vx: night ? 0.01 + Math.random() * 0.02 : 0.018 + Math.random() * 0.03,
        vy: night ? 0.01 + Math.random() * 0.016 : 0.012 + Math.random() * 0.022,
        r: night ? 5 + Math.random() * 4.5 : 3.2 + Math.random() * 3.6,
        rot: Math.random() * 6.28,
        rs: (Math.random() - 0.5) * 0.002,
        ph: Math.random() * 6.28,
        fs: 0.0015 + Math.random() * 0.002,
        a: 0.45 + Math.random() * 0.4,
        light: Math.random() < 0.4
      };
    }

    function resize() {
      var rect = bannerEl.getBoundingClientRect();
      var nw = Math.max(1, Math.round(rect.width)), nh = Math.max(1, Math.round(rect.height));
      var nd = Math.min(window.devicePixelRatio || 1, 1.5);
      // 手机滚动时地址栏伸缩也会触发 resize；尺寸没变就不重画，避免画布被清空闪一下
      if (nw === W && nh === H && nd === DPR) return;
      W = nw; H = nh; DPR = nd;
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

    function petalPath(r) {
      ctx.beginPath();
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(r * 0.95, r * 0.35, r * 0.85, -r * 0.55, r * 0.28, -r);
      ctx.lineTo(0, -r * 0.72);
      ctx.lineTo(-r * 0.28, -r);
      ctx.bezierCurveTo(-r * 0.85, -r * 0.55, -r * 0.95, r * 0.35, 0, r);
      ctx.closePath();
    }
    function featherPath(r) {
      var L = r * 2.7, w = r * 0.62;
      ctx.beginPath();
      ctx.moveTo(0, -L * 0.5);
      ctx.bezierCurveTo(w * 1.05, -L * 0.3, w * 0.95, L * 0.18, w * 0.12, L * 0.42);
      ctx.lineTo(0, L * 0.36);
      ctx.lineTo(-w * 0.1, L * 0.42);
      ctx.bezierCurveTo(-w * 0.7, L * 0.2, -w * 0.95, -L * 0.12, -w * 0.32, -L * 0.2);
      ctx.lineTo(-w * 0.62, -L * 0.24);
      ctx.bezierCurveTo(-w * 0.5, -L * 0.36, -w * 0.25, -L * 0.46, 0, -L * 0.5);
      ctx.closePath();
    }

    function update(dt) {
      time += dt;
      var night = current === "night";
      for (var i = 0; i < drifts.length; i++) {
        var p = drifts[i];
        p.x += p.vx * dt + Math.sin(time * 0.0009 + p.ph) * (night ? 0.2 : 0.12);
        p.y += p.vy * dt;
        p.rot += p.rs * dt;
        if (p.x > W + 30 || p.y > H + 30) drifts[i] = newDrift(false);
      }
      if (night && !useImage()) {
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
      for (var j = 0; j < drifts.length; j++) {
        var p = drifts[j];
        ctx.save();
        ctx.translate(p.x, p.y);
        if (night) {
          // 羽毛：左右摇摆而不是翻滚
          ctx.rotate(p.rot * 0.25 + 0.6 + Math.sin(time * p.fs * 0.8 + p.ph) * 0.55);
          ctx.scale(0.8 + 0.2 * Math.abs(Math.sin(time * p.fs + p.ph)), 1);
          featherPath(p.r);
          if (p.light) {
            ctx.fillStyle = "rgba(230,220,255," + (p.a * 0.62).toFixed(3) + ")";
            ctx.fill();
          } else {
            ctx.fillStyle = "rgba(20,14,38," + (p.a * 0.95).toFixed(3) + ")";
            ctx.fill();
            ctx.lineWidth = 0.7;
            ctx.strokeStyle = "rgba(206,184,255," + (p.a * 0.8).toFixed(3) + ")";
            ctx.stroke();
          }
          // 羽轴
          ctx.beginPath();
          ctx.moveTo(0, -p.r * 1.2);
          ctx.quadraticCurveTo(p.r * 0.08, 0, 0, p.r * 1.7);
          ctx.lineWidth = 0.6;
          ctx.strokeStyle = p.light ? "rgba(255,255,255," + (p.a * 0.5).toFixed(3) + ")" : "rgba(200,176,255," + (p.a * 0.45).toFixed(3) + ")";
          ctx.stroke();
        } else {
          var flip = Math.abs(Math.sin(time * p.fs + p.ph));
          ctx.rotate(p.rot);
          ctx.scale(0.35 + flip * 0.65, 1);
          petalPath(p.r);
          ctx.fillStyle = "rgba(238,160,170," + p.a.toFixed(3) + ")";
          ctx.fill();
        }
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
    // 字体加载后纹样位置可能变化，重新对齐一次光晕
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { paintStatic(); draw(); });
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
    }
  })();

  /* ---------- 人物方阵：原图采样 + 明暗流动 + 点击换图（装饰，非研究数据） ---------- */
  (function voxels() {
    var vox = document.querySelector(".zh-voxels");
    if (!vox || !vox.getContext) return;
    var g = vox.getContext("2d");
    if (!g) return;
    var cover = vox.closest(".zh-pixel__cover");
    var dotsEl = document.querySelector(".zh-pixel__dots");
    var sample = document.createElement("canvas");
    var sx = sample.getContext("2d", { willReadFrequently: true });
    if (!sx) return;

    var lists = { day: [], night: [] }, index = { day: 0, night: 0 };
    cover.querySelectorAll("img[data-portrait]").forEach(function (img) {
      var k = img.getAttribute("data-portrait");
      if (lists[k]) lists[k].push(img);
    });

    var cols = 0, rows = 0, step = 0, vw = 0, vh = 0, pixelRatio = 0;
    var cache = {}, cells = null, morph = null, hover = null;
    var visible = false, t = 0, last = 0, raf = 0, ready = false;
    var DUR = 520, SPREAD = 620;

    function imgOf(k, i) { return lists[k][i]; }
    function load(img) {
      return new Promise(function (resolve, reject) {
        if (!img) return reject();
        var src = img.getAttribute("data-src");
        if (src) { img.removeAttribute("data-src"); img.src = src; }
        if (img.complete && img.naturalWidth) return resolve(img);
        img.addEventListener("load", function () { resolve(img); }, { once: true });
        img.addEventListener("error", function () { reject(); }, { once: true });
      });
    }

    /* 把头像采样到固定网格：每格存 r,g,b,a（a 为 0–1） */
    function gridOf(img) {
      var key = img.currentSrc || img.src;
      if (cache[key]) return cache[key];
      sample.width = cols; sample.height = rows;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var scale = Math.min(cols / iw, rows / ih);
      var dw = iw * scale, dh = ih * scale;
      sx.clearRect(0, 0, cols, rows);
      sx.imageSmoothingEnabled = true;
      sx.imageSmoothingQuality = "high";
      sx.drawImage(img, 0, 0, iw, ih, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
      var px = sx.getImageData(0, 0, cols, rows).data; // 不可采样时抛错，由调用处兜底
      var out = new Float32Array(cols * rows * 4);
      for (var i = 0; i < cols * rows; i++) {
        var a = px[i * 4 + 3];
        if (a < 24) continue;
        out[i * 4] = px[i * 4]; out[i * 4 + 1] = px[i * 4 + 1]; out[i * 4 + 2] = px[i * 4 + 2];
        out[i * 4 + 3] = a / 255;
      }
      cache[key] = out;
      return out;
    }

    function markCurrent() {
      ["day", "night"].forEach(function (k) {
        lists[k].forEach(function (img, i) { img.classList.toggle("is-current", i === index[k]); });
      });
    }
    function renderDots() {
      if (!dotsEl) return;
      var list = lists[current];
      dotsEl.innerHTML = "";
      if (list.length < 2) return;
      list.forEach(function (_, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.tabIndex = -1;
        b.className = i === index[current] ? "is-on" : "";
        b.addEventListener("click", function () { go(i, 0.5, 0.5); });
        dotsEl.appendChild(b);
      });
    }

    function build() {
      morph = null;
      markCurrent();
      renderDots();
      var img = imgOf(current, index[current]);
      if (!img || !cols) return;
      load(img).then(function (im) {
        if (im !== imgOf(current, index[current])) return;
        try { cells = gridOf(im); } catch (err) { cells = null; ready = false; cover.classList.remove("is-voxel-ready"); return; }
        ready = true;
        draw();
        cover.classList.add("is-voxel-ready");
        preloadNext();
      }, function () { cover.classList.remove("is-voxel-ready"); });
    }
    function preloadNext() {
      var list = lists[current];
      if (list.length < 2) return;
      var next = list[(index[current] + 1) % list.length];
      var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 600); };
      idle(function () { load(next).catch(function () {}); });
    }

    /* 切换到第 i 张：像素从 (ox, oy) 处向外依次翻转 */
    function go(i, ox, oy) {
      var list = lists[current];
      if (!list.length || i === index[current]) return;
      var target = list[i];
      load(target).then(function (im) {
        var to;
        try { to = gridOf(im); } catch (err) {
          index[current] = i; ready = false; markCurrent(); renderDots(); cover.classList.remove("is-voxel-ready");
          return;
        }
        // 连续点击时从当前画面（可能正处在过渡中）继续，不跳帧
        var from = morph ? snapshot() : (cells || new Float32Array(to.length));
        index[current] = i;
        markCurrent();
        renderDots();
        cells = to;
        if (reduced || !ready) { morph = null; ready = true; cover.classList.add("is-voxel-ready"); draw(); }
        else { morph = { from: from, to: to, t0: performance.now(), ox: ox, oy: oy }; kick(); }
        preloadNext();
      }, function () {});
    }

    function layout() {
      var r = vox.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!r.width || !r.height) return;
      if (r.width === vw && r.height === vh && dpr === pixelRatio) return;
      vw = r.width; vh = r.height; pixelRatio = dpr;
      vox.width = Math.round(vw * dpr); vox.height = Math.round(vh * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 64–80 列：保留五官细节，又能看出像素感
      cols = Math.max(64, Math.min(80, Math.round(vw / 3.6)));
      step = (vw - 16) / cols;
      rows = Math.max(1, Math.floor((vh - 16) / step));
      cache = {};
      cells = null;
      build();
    }

    function snapshot() {
      var mo = morph, now = performance.now(), out = new Float32Array(mo.to.length);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var o = (y * cols + x) * 4;
          var p = (now - mo.t0 - Math.hypot(x / cols - mo.ox, y / rows - mo.oy) * SPREAD) / DUR;
          var e = ease(p < 0 ? 0 : p > 1 ? 1 : p);
          var a0 = mo.from[o + 3], a1 = mo.to[o + 3];
          for (var c = 0; c < 3; c++) {
            out[o + c] = !a0 ? mo.to[o + c] : !a1 ? mo.from[o + c] : mo.from[o + c] + (mo.to[o + c] - mo.from[o + c]) * e;
          }
          out[o + 3] = a0 + (a1 - a0) * e;
        }
      }
      return out;
    }

    function ease(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }

    function draw() {
      g.clearRect(0, 0, vw, vh);
      if (!cells) return;
      var now = performance.now();
      var bx, by;
      if (hover) { bx = hover[0]; by = hover[1]; }
      else { bx = .5 + Math.sin(t * .00047) * .38; by = .5 + Math.cos(t * .00035) * .38; }
      var mo = morph, done = true;
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var i = y * cols + x, o = i * 4;
          var nx = x / cols, ny = y / rows;
          var R, G, B, A, shrink = 0;
          if (mo) {
            var dist = Math.hypot(nx - mo.ox, ny - mo.oy);
            var p = (now - mo.t0 - dist * SPREAD) / DUR;
            p = p < 0 ? 0 : p > 1 ? 1 : p;
            if (p < 1) done = false;
            var e = ease(p);
            R = mo.from[o] + (mo.to[o] - mo.from[o]) * e;
            G = mo.from[o + 1] + (mo.to[o + 1] - mo.from[o + 1]) * e;
            B = mo.from[o + 2] + (mo.to[o + 2] - mo.from[o + 2]) * e;
            var a0 = mo.from[o + 3], a1 = mo.to[o + 3];
            // 透明格只淡入淡出颜色，不从黑色过渡
            if (!a0) { R = mo.to[o]; G = mo.to[o + 1]; B = mo.to[o + 2]; }
            if (!a1) { R = mo.from[o]; G = mo.from[o + 1]; B = mo.from[o + 2]; }
            A = a0 + (a1 - a0) * e;
            shrink = Math.sin(Math.PI * p) * 0.55;
          } else {
            R = cells[o]; G = cells[o + 1]; B = cells[o + 2]; A = cells[o + 3];
          }
          if (A <= 0.01) continue;
          var dx = nx - bx, dy = ny - by;
          var light = reduced ? 1 : Math.exp(-(dx * dx + dy * dy) / (hover ? .05 : .1));
          var wave = reduced ? 1 : (1 + Math.sin(t * .0018 + x * .19 + y * .12)) / 2;
          var size = step * (.79 + .08 * wave + .06 * light) * (1 - shrink);
          g.globalAlpha = A * (.7 + .2 * wave + .1 * light);
          g.fillStyle = "rgb(" + (R | 0) + "," + (G | 0) + "," + (B | 0) + ")";
          g.fillRect(8 + x * step + (step - size) / 2, 8 + y * step + (step - size) / 2, size, size);
        }
      }
      g.globalAlpha = 1;
      if (mo && done) morph = null;
    }

    function loop(ts) {
      raf = 0;
      var animating = !!morph;
      if (!visible || document.hidden || (reduced && !animating)) { if (animating) draw(); return; }
      // 30 fps 足够表现轻微流光，同时限制高密度方阵的开销。
      if (!last || ts - last >= 1000 / 30) {
        t += last ? Math.min(80, ts - last) : 0;
        last = ts;
        draw();
      }
      raf = requestAnimationFrame(loop);
    }
    function kick() {
      if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
    }
    function syncAnimation() {
      if (!visible || document.hidden || reduced) {
        cancelAnimationFrame(raf); raf = 0; last = 0;
        if (ready) draw();
      } else kick();
    }

    cover.addEventListener("click", function (e) {
      var list = lists[current];
      if (list.length < 2) return;
      var r = vox.getBoundingClientRect();
      var ox = 0.5, oy = 0.5;
      if (e.detail && e.clientX) { ox = (e.clientX - r.left) / r.width; oy = (e.clientY - r.top) / r.height; }
      go((index[current] + 1) % list.length, ox, oy);
    });
    cover.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var r = vox.getBoundingClientRect();
      hover = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
      if (reduced && ready) draw();
    });
    cover.addEventListener("pointerleave", function () { hover = null; if (reduced && ready) draw(); });

    layout();
    if ("ResizeObserver" in window) new ResizeObserver(layout).observe(cover);
    window.addEventListener("resize", layout);
    onScheme(function () { cells = null; ready = false; cover.classList.remove("is-voxel-ready"); build(); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        syncAnimation();
      }, { threshold: 0.05 }).observe(vox);
    } else { visible = true; syncAnimation(); }
    document.addEventListener("visibilitychange", syncAnimation);
  })();

})();
