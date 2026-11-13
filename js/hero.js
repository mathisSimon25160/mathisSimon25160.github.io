/* Ouverture : le titre est une fenêtre sur un échiquier vivant (canvas 2D, blanc et or).
   Un chariot à anneau glisse sous une pièce et l'emmène ; les prises sortent du plateau ; chaque arrivée lance une onde de capteurs.
   Au défilement, l'ouverture reste épinglée : une dame traverse l'écran et balaie le texte pour amener le suivant,
   pendant que le plateau défile sous les lettres. */
(function () {
  "use strict";
  var cv = document.getElementById("plateau-hero");
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext("2d");
  var mqCalme = window.matchMedia("(prefers-reduced-motion: reduce)"), mqEtroit = window.matchMedia("(max-width: 620px)");
  var calme = mqCalme.matches;
  var BLANC = "#fcfaf5", OR = "#f2c14e", OR_CLAIR = "#fff0b8", PION_N = "#1c1209", PION_B = "#ffffff", ENCRE = "#1a0f06";
  var EXTRA = 9;                                   // colonnes supplémentaires à droite, qui entrent au défilement
  var W = 0, H = 0, cell = 60, cols = 0, rows = 0, ox = 0, oy = 0, dpr = 1;
  var pieces = [], mag = { x: 0, y: 0 }, coup = null, pause = 0, souris = null, visible = true, ondes = [], trace = [], apparitions = [], progres = 0;

  var sec = document.getElementById("ouverture") || document.getElementById("haut");
  var d1 = document.querySelector(".d1"), d2 = document.querySelector(".d2"), d3 = document.querySelector(".d3"), reine = document.querySelector(".reine");
  var promesses = Array.prototype.slice.call(document.querySelectorAll(".promesse"));
  var titre = document.querySelector(".titre");

  function epingle() { return !mqEtroit.matches && !mqCalme.matches; }

  function taille() {
    var r = cv.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = Math.max(52, Math.round(Math.min(W / 10.5, H / 3.6)));
    cols = Math.ceil(W / cell) + 2; rows = Math.ceil(H / cell) + 2;
    ox = 0; oy = -((rows * cell - H) / 2);
    placer();
    dessiner();
  }

  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function placer() {
    pieces = []; ondes = []; trace = []; apparitions = [];
    var types = ["p", "p", "q", "p", "r", "b", "p", "k", "p", "q", "b", "p", "r", "p", "p", "b", "k", "p"], total = cols + EXTRA;
    var n = Math.min(26, Math.round(total * rows / 4.2)), pris = {};
    for (var i = 0; i < n; i++) {
      var c = Math.floor(rnd(i * 3 + 1) * total), r = Math.floor(rnd(i * 3 + 2) * rows), k = c + "," + r, t = 0;
      while (pris[k] && t++ < 30) { c = (c + 3) % total; r = (r + 1) % rows; k = c + "," + r; }
      pris[k] = 1;
      pieces.push({ c: c, r: r, x: c, y: r, noir: rnd(i * 3 + 3) > .5, t: types[i % types.length], a: 1, sort: 0 });
    }
    mag.x = cols / 2; mag.y = rows / 2; coup = null; pause = 0;
  }

  function occupant(c, r, sauf) {
    for (var i = 0; i < pieces.length; i++) { var p = pieces[i]; if (p !== sauf && !p.sort && p.c === c && p.r === r) return p; }
    return null;
  }
  function nouveauCoup() {
    for (var essai = 0; essai < 40; essai++) {
      var p = pieces[Math.floor(Math.random() * pieces.length)]; if (p.sort) continue;
      var d = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]][Math.floor(Math.random() * 8)];
      var l = p.t === "p" || p.t === "k" ? 1 : 1 + Math.floor(Math.random() * 3);
      if (p.t === "r" && d[0] && d[1]) continue;
      if (p.t === "b" && !(d[0] && d[1])) continue;
      var c = p.c + d[0] * l, r = p.r + d[1] * l;
      if (c < 0 || r < 0 || c >= cols + EXTRA || r >= rows) continue;
      var ok = true; for (var s = 1; s < l; s++) if (occupant(p.c + d[0] * s, p.r + d[1] * s, p)) ok = false;
      if (!ok) continue;
      var cible = occupant(c, r, p);
      if (cible && cible.noir === p.noir) continue;
      return { p: p, a: { x: p.c, y: p.r }, b: { x: c, y: r }, m0: { x: mag.x, y: mag.y }, t: 0, prise: cible, parti: false };
    }
    return null;
  }
  function facile(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function onde(cx, cy) { ondes.push({ x: cx, y: cy, t: 0 }); }

  function avancer(dt) {
    var i;
    for (i = ondes.length - 1; i >= 0; i--) { ondes[i].t += dt / 1.1; if (ondes[i].t >= 1) ondes.splice(i, 1); }
    for (i = trace.length - 1; i >= 0; i--) { trace[i].a -= dt * 1.6; if (trace[i].a <= 0) trace.splice(i, 1); }
    for (i = pieces.length - 1; i >= 0; i--) {                       // pièces prises : elles glissent hors du plateau
      var q = pieces[i];
      if (q.sort) { q.x += q.sort * dt * 7; q.a -= dt * 1.5; if (q.a <= 0) { pieces.splice(i, 1); apparitions.push(.6); } }
      else if (q.a < 1) q.a = Math.min(1, q.a + dt * 2.2);
    }
    for (i = apparitions.length - 1; i >= 0; i--) { apparitions[i] -= dt; if (apparitions[i] <= 0) { apparitions.splice(i, 1); nouvellePiece(); } }
    if (!coup) { pause -= dt; if (pause <= 0) { coup = nouveauCoup(); if (!coup) pause = .4; } return; }
    coup.t += dt / 1.35;
    var t = coup.t, u;
    if (t < .3) { u = facile(t / .3); mag.x = coup.m0.x + (coup.a.x - coup.m0.x) * u; mag.y = coup.m0.y + (coup.a.y - coup.m0.y) * u; }
    else if (t < 1) {
      u = facile((t - .3) / .7);
      mag.x = coup.a.x + (coup.b.x - coup.a.x) * u; mag.y = coup.a.y + (coup.b.y - coup.a.y) * u;
      coup.p.x = mag.x; coup.p.y = mag.y;
      if (coup.prise && !coup.parti && u > .85) { coup.parti = true; coup.prise.sort = (coup.prise.c + .5 > (cols + EXTRA) / 2 ? 1 : -1); }
    } else {
      coup.p.c = coup.b.x; coup.p.r = coup.b.y; coup.p.x = coup.b.x; coup.p.y = coup.b.y;
      onde(coup.b.x + .5, coup.b.y + .5);
      coup = null; pause = .08 + Math.random() * .25;
    }
    if (t > .02 && t < 1) trace.push({ x: mag.x, y: mag.y, a: 1 });
  }
  function nouvellePiece() {
    var types = ["p", "p", "q", "r", "b", "k", "p"];
    for (var essai = 0; essai < 30; essai++) {
      var c = Math.floor(Math.random() * (cols + EXTRA)), r = Math.floor(Math.random() * rows);
      if (!occupant(c, r)) { pieces.push({ c: c, r: r, x: c, y: r, noir: Math.random() > .5, t: types[Math.floor(Math.random() * types.length)], a: 0, sort: 0 }); onde(c + .5, r + .5); return; }
    }
  }

  var dec = 0;                                         // décalage horizontal du plateau, en pixels, lié au défilement
  function px(c) { return ox + c * cell + dec; }
  function py(r) { return oy + r * cell; }

  function trace2(t, s) {                               // silhouettes en unités de case, origine au centre
    ctx.beginPath();
    var base = function () { ctx.rect(-.29 * s, .31 * s, .58 * s, .08 * s); };
    if (t === "p") {
      ctx.arc(0, -.2 * s, .13 * s, 0, 6.2832); ctx.moveTo(-.1 * s, -.08 * s);
      ctx.quadraticCurveTo(-.06 * s, .12 * s, -.23 * s, .31 * s); ctx.lineTo(.23 * s, .31 * s); ctx.quadraticCurveTo(.06 * s, .12 * s, .1 * s, -.08 * s); ctx.closePath(); base();
    } else if (t === "r") {
      ctx.rect(-.25 * s, -.36 * s, .13 * s, .14 * s); ctx.rect(-.065 * s, -.36 * s, .13 * s, .14 * s); ctx.rect(.12 * s, -.36 * s, .13 * s, .14 * s);
      ctx.rect(-.25 * s, -.24 * s, .5 * s, .1 * s); ctx.moveTo(-.18 * s, -.14 * s); ctx.lineTo(.18 * s, -.14 * s); ctx.lineTo(.23 * s, .31 * s); ctx.lineTo(-.23 * s, .31 * s); ctx.closePath(); base();
    } else if (t === "b") {
      ctx.arc(0, -.4 * s, .045 * s, 0, 6.2832); ctx.moveTo(0, -.34 * s); ctx.bezierCurveTo(.2 * s, -.2 * s, .14 * s, -.02 * s, .08 * s, 0);
      ctx.lineTo(.2 * s, .31 * s); ctx.lineTo(-.2 * s, .31 * s); ctx.lineTo(-.08 * s, 0); ctx.bezierCurveTo(-.14 * s, -.02 * s, -.2 * s, -.2 * s, 0, -.34 * s); ctx.closePath(); base();
    } else if (t === "q") {
      ctx.arc(-.2 * s, -.34 * s, .04 * s, 0, 6.2832); ctx.moveTo(-.1 * s, -.34 * s); ctx.arc(-.1 * s, -.4 * s, .04 * s, 0, 6.2832); ctx.moveTo(.04 * s, -.4 * s); ctx.arc(0, -.4 * s, .04 * s, 0, 6.2832);
      ctx.moveTo(.14 * s, -.4 * s); ctx.arc(.1 * s, -.4 * s, .04 * s, 0, 6.2832); ctx.moveTo(.24 * s, -.34 * s); ctx.arc(.2 * s, -.34 * s, .04 * s, 0, 6.2832);
      ctx.moveTo(-.2 * s, -.3 * s); ctx.lineTo(-.1 * s, -.16 * s); ctx.lineTo(0, -.32 * s); ctx.lineTo(.1 * s, -.16 * s); ctx.lineTo(.2 * s, -.3 * s); ctx.lineTo(.17 * s, -.08 * s); ctx.lineTo(.24 * s, .31 * s); ctx.lineTo(-.24 * s, .31 * s); ctx.lineTo(-.17 * s, -.08 * s); ctx.closePath(); base();
    } else {
      ctx.rect(-.028 * s, -.44 * s, .056 * s, .17 * s); ctx.rect(-.085 * s, -.4 * s, .17 * s, .056 * s);
      ctx.moveTo(-.17 * s, -.2 * s); ctx.quadraticCurveTo(0, -.34 * s, .17 * s, -.2 * s); ctx.lineTo(.1 * s, -.06 * s); ctx.lineTo(.24 * s, .31 * s); ctx.lineTo(-.24 * s, .31 * s); ctx.lineTo(-.1 * s, -.06 * s); ctx.closePath(); base();
    }
  }
  function piece(p) {
    var s = cell * .95, x = px(p.x) + cell / 2, y = py(p.y) + cell / 2;
    if (x < -cell || x > W + cell) return;
    ctx.save(); ctx.globalAlpha = Math.max(0, p.a); ctx.translate(x, y);
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2.2, cell * .05);
    trace2(p.t, s);
    ctx.fillStyle = p.noir ? PION_N : PION_B; ctx.strokeStyle = ENCRE; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function dessiner() {
    ctx.fillStyle = BLANC; ctx.fillRect(0, 0, W, H);
    var r, c, i, total = cols + EXTRA;
    for (r = 0; r < rows; r++) for (c = 0; c < total; c++) {
      var x = px(c); if (x > W || x + cell < 0) continue;
      if ((r + c) % 2) { ctx.fillStyle = OR; ctx.fillRect(x, py(r), cell + .5, cell + .5); }
    }
    // ondes de capteurs : un anneau clair s'étend depuis chaque arrivée
    for (i = 0; i < ondes.length; i++) {
      var o = ondes[i], R = o.t * cell * 6, ox0 = px(o.x - .5) + cell / 2 - cell / 2, oy0 = py(o.y - .5) + cell / 2;
      for (r = 0; r < rows; r++) for (c = 0; c < total; c++) {
        var cx = px(c) + cell / 2, cy = py(r) + cell / 2; if (cx < -cell || cx > W + cell) continue;
        var d = Math.abs(Math.hypot(cx - (px(o.x - .5) + cell / 2), cy - oy0) - R);
        if (d < cell * .8) { ctx.globalAlpha = (1 - d / (cell * .8)) * (1 - o.t) * .95; ctx.fillStyle = (r + c) % 2 ? OR_CLAIR : OR; ctx.fillRect(px(c), py(r), cell + .5, cell + .5); }
      }
    }
    ctx.globalAlpha = 1;
    if (souris) {                                       // capteurs : les cases proches du curseur s'allument
      var rayon = cell * 2.2;
      for (r = 0; r < rows; r++) for (c = 0; c < total; c++) {
        var cx2 = px(c) + cell / 2, cy2 = py(r) + cell / 2, d2 = Math.hypot(cx2 - souris.x, cy2 - souris.y);
        if (d2 < rayon) { ctx.globalAlpha = Math.pow(1 - d2 / rayon, 1.4) * .9; ctx.fillStyle = OR_CLAIR; ctx.fillRect(px(c), py(r), cell + .5, cell + .5); }
      }
      ctx.globalAlpha = 1;
    }
    if (coup) { ctx.fillStyle = "rgba(255,240,184,.85)"; ctx.fillRect(px(coup.a.x), py(coup.a.y), cell, cell); ctx.fillRect(px(coup.b.x), py(coup.b.y), cell, cell); }
    // traînée du chariot
    if (trace.length > 1) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = ENCRE;
      for (i = 1; i < trace.length; i++) {
        ctx.globalAlpha = Math.max(0, trace[i].a) * .8; ctx.lineWidth = Math.max(2, cell * .07 * trace[i].a + 1);
        ctx.beginPath(); ctx.moveTo(px(trace[i - 1].x) + cell / 2, py(trace[i - 1].y) + cell / 2); ctx.lineTo(px(trace[i].x) + cell / 2, py(trace[i].y) + cell / 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (i = 0; i < pieces.length; i++) piece(pieces[i]);
    var mx = px(mag.x) + cell / 2, my = py(mag.y) + cell / 2;
    ctx.lineWidth = Math.max(3.5, cell * .08); ctx.strokeStyle = ENCRE;
    ctx.beginPath(); ctx.arc(mx, my, cell * .44, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = BLANC; ctx.lineWidth = Math.max(2, cell * .035); ctx.beginPath(); ctx.arc(mx, my, cell * .44, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = ENCRE; ctx.beginPath(); ctx.arc(mx, my, cell * .1, 0, 6.2832); ctx.fill();
  }

  /* ---------- ouverture épinglée : la dame ---------- */
  function borne(v) { return Math.max(0, Math.min(100, v)); }
  function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  var dernierIdx = -1;
  function majDefilement() {
    if (!sec) return;
    var r = sec.getBoundingClientRect(), span = r.height - window.innerHeight;
    var p = epingle() && span > 0 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
    progres = p;
    dec = -p * cell * EXTRA * .85;
    if (!epingle() || !d2 || !d3) return;
    var X1 = p < .2 ? -22 : p > .4 ? 122 : -22 + 144 * ease((p - .2) / .2);
    var X2 = p < .6 ? 122 : p > .8 ? -22 : 122 - 144 * ease((p - .6) / .2);
    var c1 = borne(X1), c2 = borne(X2);
    d1.style.setProperty("--l", c1 + "%");
    d2.style.setProperty("--r", (100 - Math.min(c1, c2)) + "%");
    d3.style.setProperty("--l", c2 + "%");
    var q = p >= .2 && p <= .4 ? X1 : (p >= .6 && p <= .8 ? X2 : null);
    if (q === null) { reine.style.transform = "translate3d(-200vw,-50%,0)"; }
    else {
      var w = reine.getBoundingClientRect().width || 200, bw = titre.clientWidth, sens = p < .5 ? 1 : -1, t = p < .5 ? (p - .2) / .2 : (p - .6) / .2;
      var x = q / 100 * bw - w / 2, rot = sens * (6 - 12 * Math.abs(t - .5) * 0) + Math.sin(t * 18) * 3, hop = Math.sin(t * Math.PI * 4) * 1.6;
      reine.style.transform = "translate3d(" + x.toFixed(1) + "px," + (-50 + hop).toFixed(2) + "%,0) rotate(" + rot.toFixed(2) + "deg)";
    }
    var idx = p < .3 ? 0 : (p < .7 ? 1 : 2);
    if (idx !== dernierIdx) { dernierIdx = idx; promesses.forEach(function (e, k) { e.classList.toggle("on", k === idx); }); }
  }
  window.addEventListener("scroll", function () { majDefilement(); if (calme || !visible) dessiner(); }, { passive: true });

  var dernier = 0;
  function boucle(t) {
    requestAnimationFrame(boucle);
    if (!visible || document.hidden) { dernier = t; return; }
    var dt = Math.min(.05, (t - dernier) / 1000); dernier = t;
    avancer(dt); dessiner();
  }

  taille(); majDefilement();
  var attente; window.addEventListener("resize", function () { clearTimeout(attente); attente = setTimeout(function () { taille(); majDefilement(); }, 120); });
  if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(cv);
  var zone = cv.parentNode;
  zone.addEventListener("pointermove", function (e) { var r = cv.getBoundingClientRect(); souris = { x: e.clientX - r.left, y: e.clientY - r.top }; if (calme) dessiner(); });
  zone.addEventListener("pointerleave", function () { souris = null; if (calme) dessiner(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { taille(); majDefilement(); });
  if (window.ResizeObserver) { var ro = new ResizeObserver(function () { clearTimeout(attente); attente = setTimeout(function () { taille(); majDefilement(); }, 120); }); ro.observe(cv); }
  if (!calme) requestAnimationFrame(boucle);
})();
