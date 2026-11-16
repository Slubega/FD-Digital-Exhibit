/* The Price of a Free Man — navigation and page turn.
   Every link is still a plain #hash link, so deep links and back/forward keep working.
   The page turn runs on hashchange: forward turns the current page away around its
   left edge, backward swings the previous page back in. Reduced motion gets a crossfade. */
(function () {
  var VIEWS = ["home", "about", "item-1", "heroic-slave", "item-2", "reflection", "sources"];
  var DURATION = 650;
  var EASE = "cubic-bezier(.45,.05,.3,1)";
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var current = null;
  var running = null;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function viewFromHash() {
    var v = (location.hash || "#home").slice(1);
    return VIEWS.indexOf(v) === -1 ? "home" : v;
  }
  function section(v) { return document.getElementById("v-" + v); }

  function markNav(root, v) {
    root.querySelectorAll("nav.links a").forEach(function (a) {
      var on = a.getAttribute("data-v") === v;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  function setActive(v) {
    VIEWS.forEach(function (x) { section(x).classList.toggle("on", x === v); });
    markNav(document, v);
    current = v;
    if (v === "home") fadePortrait();
  }

  function focusHeading(v) {
    var h = section(v).querySelector("h1, h2");
    if (!h) return;
    if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
    try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); }
  }

  /* A copy of one section + footer (never the header, which stays put), shifted by `offset`
     so it lines up with what is on screen below the header. */
  function snapshot(v, offset, scrollY) {
    var wrap = document.createElement("div");
    wrap.className = "turn-content";
    var sec = section(v).cloneNode(true);
    sec.classList.add("on");
    var m = sec.querySelector(".hero-media");   // match the portrait fade to this scroll position
    if (m) {
      m.style.opacity = Math.max(0, 1 - scrollY / ((window.innerHeight || 800) * 0.75)).toFixed(3);
      m.style.transform = scrollY ? "translateY(" + (scrollY * 0.18).toFixed(1) + "px)" : "";
    }
    var footer = document.querySelector(".site-footer").cloneNode(true);
    [sec, footer].forEach(function (n) {
      n.removeAttribute("id");
      n.querySelectorAll("[id]").forEach(function (e) { e.removeAttribute("id"); });
      wrap.appendChild(n);
    });
    wrap.style.transform = "translateY(" + offset + "px)";
    return wrap;
  }

  function headerBottom() {
    var h = document.querySelector(".site-header");
    return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0;
  }

  function makeStage(top) {
    var w = document.documentElement.clientWidth;   // excludes the scrollbar, so layout matches
    var stage = document.createElement("div");
    stage.style.top = top + "px";                    // the turn happens below the sticky header
    stage.className = "turn-stage";
    stage.setAttribute("aria-hidden", "true");
    stage.inert = true;
    stage.style.width = w + "px";
    stage.style.perspective = Math.max(2400, w * 2.2) + "px";
    return stage;
  }

  function go(v, animate) {
    if (running) running.finish();
    if (!animate || current === null || v === current) {
      setActive(v);
      window.scrollTo(0, 0);
      return;
    }

    var from = current;
    var forward = VIEWS.indexOf(v) > VIEWS.indexOf(from);
    var reduce = reduceMQ && reduceMQ.matches;
    var y = window.scrollY || window.pageYOffset || 0;

    var top = headerBottom();
    var stage = makeStage(top);
    var fromOffset = section(from).getBoundingClientRect().top - top;
    var page = document.createElement("div");
    page.className = "turn-page";
    var shade = document.createElement("div");
    shade.className = "turn-shade";
    var under = document.createElement("div");
    under.className = "turn-under";
    var anims = [];
    var done = false;

    function finish() {
      if (done) return;
      done = true;
      anims.forEach(function (a) { try { a.cancel(); } catch (e) {} });
      if (!forward && !reduce) {           // backward: swap only once the page has landed
        setActive(v);
        window.scrollTo(0, 0);
        focusHeading(v);
      }
      stage.remove();
      running = null;
    }
    running = { finish: finish };

    if (reduce) {
      // Quick crossfade: old page fades out over the new one.
      page.style.boxShadow = "none";
      page.appendChild(snapshot(from, fromOffset, y));
      stage.appendChild(page);
      document.body.appendChild(stage);
      setActive(v);
      window.scrollTo(0, 0);
      focusHeading(v);
      anims.push(page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" }));
    } else if (forward) {
      // The current page turns away to the left, revealing the next page underneath.
      page.appendChild(snapshot(from, fromOffset, y));
      page.appendChild(shade);
      stage.appendChild(under);
      stage.appendChild(page);
      document.body.appendChild(stage);
      setActive(v);
      window.scrollTo(0, 0);
      focusHeading(v);
      anims.push(page.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(-92deg)" }], { duration: DURATION, easing: EASE, fill: "forwards" }));
      anims.push(shade.animate([{ opacity: 0 }, { opacity: 0.6 }], { duration: DURATION, easing: EASE, fill: "forwards" }));
      anims.push(under.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION, easing: EASE, fill: "forwards" }));
    } else {
      // The previous page swings back in from the left over the current one.
      page.appendChild(snapshot(v, 0, 0));
      page.appendChild(shade);
      page.style.transform = "rotateY(-92deg)";
      stage.appendChild(under);
      stage.appendChild(page);
      document.body.appendChild(stage);
      anims.push(page.animate([{ transform: "rotateY(-92deg)" }, { transform: "rotateY(0deg)" }], { duration: DURATION, easing: EASE, fill: "forwards" }));
      anims.push(shade.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: DURATION, easing: EASE, fill: "forwards" }));
      anims.push(under.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: EASE, fill: "forwards" }));
    }
    anims[0].onfinish = finish;
  }

  // Portrait backdrop: show the photo once it loads, otherwise keep the labeled placeholder.
  var portrait = document.querySelector(".hero-media img");
  if (portrait) {
    var ok = function () { portrait.parentNode.classList.add("has-img"); };
    if (portrait.complete && portrait.naturalWidth) ok();
    else portrait.addEventListener("load", ok);
  }

  // Home: the portrait fades (and drifts slightly) as you scroll down. One rAF per frame, no layout reads in the loop.
  var media = document.querySelector(".hero-media");
  var ticking = false;
  function fadePortrait() {
    ticking = false;
    if (!media || current !== "home") return;
    var y = window.scrollY || window.pageYOffset || 0;
    var h = window.innerHeight || 800;
    var o = Math.max(0, 1 - y / (h * 0.75));
    media.style.opacity = o.toFixed(3);
    media.style.transform = (reduceMQ && reduceMQ.matches) ? "" : "translateY(" + (y * 0.18).toFixed(1) + "px)";
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(fadePortrait); }
  }, { passive: true });
  window.addEventListener("hashchange", fadePortrait);

  // Text size control on Reflection and Sources (shared setting, remembered in this browser when allowed).
  var SCALES = [0.9, 1, 1.15, 1.3, 1.5];
  var scaleIdx = 1;
  try { var saved = parseInt(localStorage.getItem("pofm-text-size"), 10); if (saved >= 0 && saved < SCALES.length) scaleIdx = saved; } catch (e) {}
  function applyScale() {
    document.querySelectorAll(".resizable").forEach(function (el) { el.style.setProperty("--text-scale", SCALES[scaleIdx]); });
    document.querySelectorAll(".textsize").forEach(function (g) {
      g.querySelector('[data-step="-1"]').disabled = scaleIdx === 0;
      g.querySelector('[data-step="1"]').disabled = scaleIdx === SCALES.length - 1;
      g.querySelector('[data-step="0"]').setAttribute("aria-pressed", String(scaleIdx === 1));
    });
    try { localStorage.setItem("pofm-text-size", String(scaleIdx)); } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".textsize button");
    if (!b) return;
    var step = parseInt(b.getAttribute("data-step"), 10);
    scaleIdx = step === 0 ? 1 : Math.min(SCALES.length - 1, Math.max(0, scaleIdx + step));
    applyScale();
  });
  applyScale();

  // Hover cards: keep each card inside the screen, flip above the word if there is no room below.
  function placeCard(el) {
    var card = el.querySelector(".card");
    if (!card) return;
    card.style.left = "0px";
    card.classList.remove("above");
    var vw = document.documentElement.clientWidth, r = card.getBoundingClientRect(), pad = 12;
    if (r.right > vw - pad) card.style.left = (vw - pad - r.right) + "px";
    else if (r.left < pad) card.style.left = (pad - r.left) + "px";
    var w = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8 && w.top - headerBottom() > r.height + 16) card.classList.add("above");
  }
  document.addEventListener("mouseover", function (e) { var el = e.target.closest && e.target.closest(".has-card"); if (el && !el.contains(e.relatedTarget)) placeCard(el); });
  document.addEventListener("focusin", function (e) { var el = e.target.closest && e.target.closest(".has-card"); if (el) placeCard(el); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.activeElement && document.activeElement.classList.contains("has-card")) document.activeElement.blur();
  });

  var canAnimate = typeof Element !== "undefined" && "animate" in Element.prototype;
  window.addEventListener("hashchange", function () { go(viewFromHash(), canAnimate); });
  go(viewFromHash(), false);   // deep link: no animation on first load
})();
