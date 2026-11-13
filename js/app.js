/* Navigation, révélations, galerie, onglets de plans, chargement paresseux de three.js. */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* three.js n'est chargé que lorsqu'une zone 3D approche de l'écran */
  var promesse = null;
  function script(src) { return new Promise(function (ok, ko) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s); }); }
  window.Trois = {
    charger: function () {
      if (!promesse) promesse = script("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js").then(function () {
        return Promise.all(["loaders/GLTFLoader", "controls/OrbitControls", "environments/RoomEnvironment", "loaders/STLLoader"].map(function (n) { return script("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/" + n + ".js"); }));
      });
      return promesse;
    },
    quand: function (el, marge, fn) {
      if (!el) return;
      if (!("IntersectionObserver" in window)) { fn(); return; }
      var o = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { o.disconnect(); fn(); } }, { rootMargin: marge || "600px 0px" });
      o.observe(el);
    }
  };

  /* barre : fond au défilement, menu mobile, progression, section courante */
  var barre = $(".barre"), prog = $(".progres"), nav = $("#nav"), bouton = $(".menu-b");
  function defile() {
    var y = window.scrollY, h = document.documentElement.scrollHeight - window.innerHeight;
    if (barre) barre.classList.toggle("plein", y > 30);
    if (prog) prog.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
  }
  window.addEventListener("scroll", defile, { passive: true }); window.addEventListener("load", defile); defile();
  if (bouton && nav) {
    bouton.addEventListener("click", function () {
      var o = nav.classList.toggle("ouvert"); bouton.setAttribute("aria-expanded", o ? "true" : "false");
      document.body.style.overflow = o ? "hidden" : "";
    });
    $$("a", nav).forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("ouvert"); bouton.setAttribute("aria-expanded", "false"); document.body.style.overflow = ""; }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("ouvert")) bouton.click(); });
  }
  if ("IntersectionObserver" in window) {
    var liens = {}; $$("a[href^='#']", nav).forEach(function (a) { liens[a.getAttribute("href").slice(1)] = a; });
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var a = liens[e.target.id]; if (a && e.isIntersecting) { Object.keys(liens).forEach(function (k) { liens[k].removeAttribute("aria-current"); }); a.setAttribute("aria-current", "true"); } });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(liens).forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* révélations */
  document.documentElement.classList.add("js");
  var revs = $$(".rev, .ap");
  if ("IntersectionObserver" in window && !calme) {
    var ro = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("vu"); ro.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    revs.forEach(function (el) { ro.observe(el); });
  } else revs.forEach(function (el) { el.classList.add("vu"); });

  /* galerie : agrandissement */
  var gal = $("#galerie");
  if (gal) gal.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    var im = b.querySelector("img"), l = document.createElement("div");
    l.className = "loupe"; l.setAttribute("role", "dialog"); l.setAttribute("aria-label", "Image agrandie");
    l.innerHTML = '<button type="button" class="btn petit">Fermer</button>';
    var big = new Image(); big.src = im.src; big.alt = im.alt; l.appendChild(big);
    function fin() { l.remove(); document.removeEventListener("keydown", touche); b.focus(); }
    function touche(e) { if (e.key === "Escape") fin(); }
    l.addEventListener("click", fin); document.addEventListener("keydown", touche);
    document.body.appendChild(l); l.querySelector("button").focus();
  });

  /* plans : onglets */
  var tabs = $$("[role=tab]");
  function choisir(t, focus) {
    tabs.forEach(function (o) { var on = o === t; o.setAttribute("aria-selected", on ? "true" : "false"); o.tabIndex = on ? 0 : -1; var p = document.getElementById(o.getAttribute("aria-controls")); if (p) p.hidden = !on; });
    if (focus) t.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { choisir(t); });
    t.addEventListener("keydown", function (e) {
      var k = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0; if (!k) return;
      e.preventDefault(); choisir(tabs[(i + k + tabs.length) % tabs.length], true);
    });
  });

  /* plan coté : cases du plateau et des cimetières */
  var g = document.getElementById("cases-plan");
  if (g) {
    var s = "";
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var sombre = (c + (7 - r)) % 2 === 0;
      s += '<rect x="' + (152 + 37.5 * c) + '" y="' + (82 + 37.5 * r) + '" width="37.5" height="37.5" fill="' + (sombre ? "#0a0705" : "#f2e9d8") + '"/>';
    }
    [72, 457].forEach(function (x0) {
      for (var r = 0; r < 8; r++) for (var c = 0; c < 2; c++) {
        s += '<rect x="' + (x0 + 37.5 * c) + '" y="' + (82 + 37.5 * r) + '" width="37.5" height="37.5" fill="none" stroke="#d9a441" stroke-width="0.6" opacity="0.8"/>';
        s += '<circle cx="' + (x0 + 37.5 * c + 18.75) + '" cy="' + (82 + 37.5 * r + 18.75) + '" r="9.4" fill="none" stroke="#f2e9d8" stroke-width="0.5" opacity="0.45"/>';
      }
    });
    s += '<rect x="152" y="82" width="300" height="300" fill="none" stroke="#f2e9d8" stroke-width="1"/>';
    g.innerHTML = s;
  }
})();
