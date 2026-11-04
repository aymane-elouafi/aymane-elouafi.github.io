// ============================================================
//  Fluid interactions  (apple-design)
//  - Side-menu drawer: spring-driven, interruptible, drag-to-close
//    with 1:1 tracking, velocity hand-off, momentum projection and
//    rubber-banding at the edge.
//  - Translucent top bar scroll-edge.
//  - Subtle scroll-reveal entrances.
//  Everything degrades gracefully (no-JS / reduced-motion).
// ============================================================

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isDrawer = function () { return window.innerWidth < 1080; };

  // ---------- Top bar scroll-edge ----------
  var topbar = document.querySelector(".topbar");
  if (topbar) {
    var onScroll = function () { topbar.classList.toggle("scrolled", window.scrollY > 4); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------- The drawer ----------
  var toggle = document.querySelector(".menu-toggle");
  var sidebar = document.getElementById("sidebar");
  var backdrop = document.getElementById("backdrop");

  if (sidebar && toggle) {
    sidebar.style.touchAction = "pan-y"; // vertical = native scroll, horizontal = ours

    var W = function () { return sidebar.offsetWidth || 280; };
    var x = -W();            // px: 0 = fully open, -W = closed
    var v = 0;               // px/s
    var target = -W();
    var raf = null, lastT = 0;
    var SCRIM = 0.55;

    function paint() {
      sidebar.style.transform = "translateX(" + x + "px)";
      var open = (x + W()) / W();            // 0 closed … 1 open
      if (backdrop) {
        if (open <= 0.001) { backdrop.style.display = "none"; }
        else { backdrop.style.display = "block"; backdrop.style.opacity = (open * SCRIM).toFixed(3); }
      }
    }

    // critically-damped spring (no overshoot) stepped per frame
    var STIFF = 210, DAMP = 29;
    function step(now) {
      if (!lastT) lastT = now;
      var dt = Math.min((now - lastT) / 1000, 0.032); lastT = now;
      var a = -STIFF * (x - target) - DAMP * v;
      v += a * dt;
      x += v * dt;
      paint();
      if (Math.abs(x - target) < 0.4 && Math.abs(v) < 6) {
        x = target; v = 0; paint();
        raf = null; lastT = 0;
        if (x <= -W() + 0.5) document.body.classList.remove("menu-open");
        return;
      }
      raf = requestAnimationFrame(step);
    }
    function springTo(t, initialV) {
      target = t;
      if (initialV != null) v = initialV;
      if (t > -W() + 0.5) document.body.classList.add("menu-open");
      if (reduceMotion) {                     // no spring — settle immediately
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        x = t; v = 0; lastT = 0; paint();
        if (x <= -W() + 0.5) document.body.classList.remove("menu-open");
        return;
      }
      lastT = 0;
      if (!raf) raf = requestAnimationFrame(step);
    }

    var open = function () { springTo(0); toggle.setAttribute("aria-expanded", "true"); };
    var close = function () { springTo(-W()); toggle.setAttribute("aria-expanded", "false"); };
    var isOpen = function () { return target > -W() + 0.5; };

    toggle.addEventListener("click", function () { isOpen() ? close() : open(); });
    if (backdrop) backdrop.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });

    // ----- drag to close (1:1, with velocity + rubber-band) -----
    var down = false, dragging = false, decided = false, startX = 0, startY = 0, startTx = 0, samples = [];

    function rubber(over) {           // progressive resistance past the open edge
      var c = 0.55, d = W();
      return (over * d * c) / (d + c * Math.abs(over));
    }

    sidebar.addEventListener("pointerdown", function (e) {
      if (!isDrawer() || !isOpen() || (e.pointerType === "mouse" && e.button !== 0)) return;
      down = true; decided = false; dragging = false;
      startX = e.clientX; startY = e.clientY; startTx = x;
      samples = [{ x: e.clientX, t: performance.now() }];
    });

    sidebar.addEventListener("pointermove", function (e) {
      if (!down || !isDrawer()) return;
      var dx = e.clientX - startX, dy = e.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) {        // horizontal → we take over
          decided = true; dragging = true;
          if (raf) { cancelAnimationFrame(raf); raf = null; lastT = 0; }
          try { sidebar.setPointerCapture(e.pointerId); } catch (_) {}
        } else { decided = true; dragging = false; return; } // vertical → let it scroll
      }
      if (!dragging) return;
      e.preventDefault();
      var nx = startTx + dx;
      if (nx > 0) nx = rubber(nx);                // resist pulling past fully-open
      if (nx < -W()) nx = -W();
      x = nx; paint();
      samples.push({ x: e.clientX, t: performance.now() });
      if (samples.length > 6) samples.shift();
    }, { passive: false });

    function endDrag(e) {
      if (!down) return;
      down = false;
      if (!dragging) { decided = false; return; }
      dragging = false; decided = false;
      try { sidebar.releasePointerCapture(e.pointerId); } catch (_) {}
      // velocity from the last samples (px/s)
      var vel = 0;
      if (samples.length >= 2) {
        var a = samples[0], b = samples[samples.length - 1];
        var dt = (b.t - a.t) / 1000;
        if (dt > 0) vel = (b.x - a.x) / dt;
      }
      // project where momentum would carry it, then pick the nearer rest state
      var projected = x + (vel / 1000) * 0.998 / (1 - 0.998);
      var toOpen = projected > -W() / 2;
      springTo(toOpen ? 0 : -W(), vel);
      toggle.setAttribute("aria-expanded", toOpen ? "true" : "false");
    }
    sidebar.addEventListener("pointerup", endDrag);
    sidebar.addEventListener("pointercancel", endDrag);

    // keep things sane across the desktop/mobile boundary
    window.addEventListener("resize", function () {
      if (!isDrawer()) {                 // pinned sidebar on desktop — drop inline styles
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        sidebar.style.transform = "";
        if (backdrop) { backdrop.style.display = ""; backdrop.style.opacity = ""; }
        document.body.classList.remove("menu-open");
      } else if (!isOpen()) {
        x = target = -W(); paint();
      }
    });

    // sync initial state — but only touch the transform in drawer mode,
    // so the pinned desktop sidebar is never pushed off-screen
    if (isDrawer()) paint();
    else sidebar.style.transform = "";
  }

  // ---------- Scroll-reveal entrances ----------
  document.documentElement.classList.add("anim");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var targets = [].slice.call(document.querySelectorAll(".intro, .post-list > li"));
    targets.forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
  }
})();
