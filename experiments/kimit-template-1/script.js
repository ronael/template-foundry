/* ============================================================
   LUMEN — interactions (JS minimal, le CSS fait le reste)
   ============================================================ */
(function () {
  "use strict";

  var doc = document;
  var body = doc.body;

  /* ---------- Année courante ---------- */
  var yearEl = doc.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header au scroll ---------- */
  var header = doc.querySelector(".site-header");
  var onScroll = function () {
    header.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Menu mobile ---------- */
  var toggle = doc.querySelector(".nav__toggle");
  var closeNav = function () {
    body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Ouvrir le menu");
  };

  toggle.addEventListener("click", function () {
    var open = body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
  });

  doc.querySelectorAll(".nav__links a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && body.classList.contains("nav-open")) closeNav();
  });

  /* ---------- Reveal au scroll ---------- */
  var revealEls = doc.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Curseur custom (pointeur fin uniquement) ---------- */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Vidéo du hero : figée si l'utilisateur limite les animations */
  var heroVideo = doc.querySelector(".hero__video");
  if (heroVideo && reduced) {
    heroVideo.removeAttribute("autoplay");
    heroVideo.pause();
  }

  if (fine && !reduced) {
    var cursor = doc.querySelector(".cursor");
    var dot = cursor.querySelector(".cursor__dot");
    var ring = cursor.querySelector(".cursor__ring");

    var mx = -100, my = -100, rx = -100, ry = -100;

    doc.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + (mx - 4) + "px," + (my - 4) + "px)";
    }, { passive: true });

    (function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = "translate(" + rx + "px," + ry + "px) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();

    var hoverSel = "a, button, summary, input, [data-cursor]";
    doc.addEventListener("mouseover", function (e) {
      var t = e.target.closest(hoverSel);
      cursor.classList.toggle("is-hover", !!t);
      cursor.classList.toggle("is-label", !!(t && t.hasAttribute("data-cursor")));
    });
    doc.addEventListener("mousedown", function () { cursor.classList.add("is-down"); });
    doc.addEventListener("mouseup", function () { cursor.classList.remove("is-down"); });
  }

  /* ---------- Boutons magnétiques ---------- */
  if (fine && !reduced) {
    doc.querySelectorAll("[data-magnetic]").forEach(function (el) {
      var strength = 0.25;

      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = "translate(" + dx * strength + "px," + dy * strength + "px)";
      });

      el.addEventListener("mouseleave", function () {
        el.style.transition = "transform .5s cubic-bezier(.22,1,.36,1)";
        el.style.transform = "translate(0,0)";
        setTimeout(function () { el.style.transition = ""; }, 500);
      });
    });
  }

  /* ---------- Compteurs du manifeste ---------- */
  var counters = doc.querySelectorAll("[data-count]");

  if ("IntersectionObserver" in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        cio.unobserve(el);
        var target = parseInt(el.getAttribute("data-count"), 10);
        var start = null;
        var dur = 1400;

        var step = function (ts) {
          if (!start) start = ts;
          var p = Math.min((ts - start) / dur, 1);
          var eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(target * eased)).padStart(2, "0");
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 });

    counters.forEach(function (el) { cio.observe(el); });
  }
})();
