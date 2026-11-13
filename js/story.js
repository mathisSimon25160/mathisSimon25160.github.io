/* Maquette 3D du coffre : le dessus se soulève au fil du défilement et montre la mécanique.
   Chargée seulement quand la section approche de l'écran. */
(function () {
  "use strict";
  var boite = document.getElementById("scene"), toile = document.getElementById("toile"), histoire = document.getElementById("histoire");
  if (!boite || !toile || !window.Trois) return;
  var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var etapes = Array.prototype.slice.call(document.querySelectorAll(".etape"));
  var prog = 0, libre = false, visible = true, vueLibre = "ouvert";

  function progression() {
    var vh = window.innerHeight, etroit = window.matchMedia("(max-width: 1020px)").matches;
    var c = etroit ? (boite.getBoundingClientRect().bottom + vh) / 2 : vh / 2, f = 0;
    for (var k = 0; k < etapes.length; k++) { var r = etapes[k].getBoundingClientRect(); if (c >= r.bottom) f = k + 1; else if (c > r.top) f = k + (c - r.top) / r.height; }
    prog = Math.max(0, Math.min(1, f / etapes.length));
    var i = Math.min(etapes.length - 1, Math.floor(prog * etapes.length + 0.0001));
    etapes.forEach(function (e, k) { e.classList.toggle("on", k === i); });
  }
  window.addEventListener("scroll", progression, { passive: true }); window.addEventListener("resize", progression); progression();

  window.Trois.quand(histoire, "900px 0px", function () { window.Trois.charger().then(demarrer).catch(function () {}); });

  function demarrer() {
    if (!window.THREE || !THREE.GLTFLoader) return;
    var rendu;
    try { rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true }); } catch (e) { return; }
    rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    rendu.outputEncoding = THREE.sRGBEncoding; rendu.toneMapping = THREE.LinearToneMapping; rendu.toneMappingExposure = 0.95;
    var scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1.5, 0.05, 20);
    try { var pm = new THREE.PMREMGenerator(rendu); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; } catch (e) {}
    var cle = new THREE.DirectionalLight(0xffe7c4, 0.85); cle.position.set(-0.9, 1.4, 0.9); scene.add(cle);
    scene.add(new THREE.HemisphereLight(0xfff0d8, 0x120a04, 0.35));
    var CIBLE = new THREE.Vector3(0.16, 0.03, 0.183), orbite = null;
    if (THREE.OrbitControls) { orbite = new THREE.OrbitControls(cam, toile); orbite.target.copy(CIBLE); orbite.enabled = false; orbite.enablePan = false; orbite.minDistance = 0.45; orbite.maxDistance = 2.6; orbite.maxPolarAngle = Math.PI * 0.495; }

    var couvercle = null, portique = null, chariot = null, matsCouv = [], pion = null, rubans = {}, donnees = null, pret = 0, meca = null, MM = 0.001;
    function versScene(xm, ym, z) { return [ym * MM, (z + 6) * MM, (xm + 51) * MM]; }
    function lier() {
      if (!couvercle || !meca) return;
      ["fixe_nappe", "fixe_puce"].forEach(function (n) { var o = meca.getObjectByName(n); if (o && o.parent !== couvercle) { couvercle.attach(o); o.material = o.material.clone(); matsCouv.push(o.material); } });
    }
    function fini() { pret++; lier(); if (pret >= 3) { boite.classList.add("pret"); taille(); } }
    var chargeur = new THREE.GLTFLoader();
    chargeur.load("assets/coffre_v3.json", function (g) {
      scene.add(g.scene); couvercle = g.scene.getObjectByName("couvercle");
      if (couvercle) couvercle.traverse(function (o) { if (o.isMesh) { o.material = o.material.clone(); matsCouv.push(o.material); } });
      var prof = [[0, 0], [9.2, 0], [9.2, 2.2], [7.2, 3.6], [4.2, 6], [3.2, 13], [4.6, 15], [4.6, 16.4], [2.6, 17.4], [4.9, 20], [5.6, 23], [4.9, 26], [2.6, 28.2], [0, 28.8]];
      var pg = new THREE.LatheGeometry(prof.map(function (p) { return new THREE.Vector2(p[0] * MM, p[1] * MM); }), 40);
      pion = new THREE.Mesh(pg, new THREE.MeshPhysicalMaterial({ color: 0xf1e9d2, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }));
      scene.add(pion); fini();
    }, undefined, function () {});
    chargeur.load("assets/mecanique.json", function (g) {
      scene.add(g.scene); meca = g.scene; portique = g.scene.getObjectByName("portique"); chariot = g.scene.getObjectByName("chariot");
      g.scene.traverse(function (o) {
        if (o.isMesh) { o.material.flatShading = true; if (o.material.name === "petg_orange") { o.material.color.set(0xc8902c); o.material.roughness = 0.55; o.material.envMapIntensity = 0.5; } o.material.needsUpdate = true; }
      });
      fini();
    }, undefined, function () {});
    fetch("assets/courroies.json").then(function (r) { return r.json(); }).then(function (d) {
      donnees = d;
      ["A", "B"].forEach(function (b) {
        var n = 6 * 2 + 5 * 9, pos = new Float32Array(n * 2 * 3), idx = [];
        for (var i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
        var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
        var mat = new THREE.MeshBasicMaterial({ color: b === "A" ? 0xf0bd4f : 0xf2e9d8, side: THREE.DoubleSide });
        var m = new THREE.Mesh(geo, mat); m.frustumCulled = false; scene.add(m); rubans[b] = m;
      });
      fini();
    }).catch(function () {});

    function tangente(c1, R1, s1, c2, R2, s2) {
      var dx = c2[0] - c1[0], dy = c2[1] - c1[1], l = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), de = s2 * R2 - s1 * R1;
      var th = phi - Math.asin(de / l), nx = -Math.sin(th), ny = Math.cos(th);
      return { p1: [c1[0] - s1 * R1 * nx, c1[1] - s1 * R1 * ny], p2: [c2[0] - s2 * R2 * nx, c2[1] - s2 * R2 * ny], th: th };
    }
    function majCourroie(b, gx, gy) {
      var el = donnees.belts[b].el, z = donnees.belts[b].z, C = el.map(function (e) { return [e.c[0] + e.gx[0] * gx + e.gy[0] * gy, e.c[1] + e.gx[1] * gx + e.gy[1] * gy]; });
      var segs = [], pts = [], k, j;
      for (k = 0; k < el.length - 1; k++) segs.push(tangente(C[k], el[k].R, el[k].s, C[k + 1], el[k + 1].R, el[k + 1].s));
      for (k = 0; k < segs.length; k++) {
        pts.push(segs[k].p1, segs[k].p2);
        if (k < segs.length - 1) {
          var w = el[k + 1], c = C[k + 1], ang = (w.s * (segs[k + 1].th - segs[k].th)) % (2 * Math.PI); if (ang < 0) ang += 2 * Math.PI;
          var a0 = Math.atan2(segs[k].p2[1] - c[1], segs[k].p2[0] - c[0]);
          for (j = 1; j < 10; j++) { var t = a0 + w.s * ang * j / 10; pts.push([c[0] + w.R * Math.cos(t), c[1] + w.R * Math.sin(t)]); }
        }
      }
      var at = rubans[b].geometry.attributes.position, a = at.array;
      for (k = 0; k < pts.length; k++) {
        var p0 = versScene(pts[k][0], pts[k][1], z[0]), p1 = versScene(pts[k][0], pts[k][1], z[1]);
        a[6 * k] = p0[0]; a[6 * k + 1] = p0[1]; a[6 * k + 2] = p0[2]; a[6 * k + 3] = p1[0]; a[6 * k + 4] = p1[1]; a[6 * k + 5] = p1[2];
      }
      at.needsUpdate = true;
    }

    function caseXY(col, rang) { return [10 + 37.5 * (col + 0.5), 311 - 37.5 * (rang + 0.5)]; }
    var e2 = caseXY(4, 1), e4 = caseXY(4, 3);
    var TRAJET = [e2, e2, e4, e4, [e4[0] + 18.75, e4[1]], [e4[0] + 18.75, 292.25 - 18.75], [352.5, 292.25 - 18.75], [371.25, 292.25], [371.25, 292.25], [352.5, 292.25 - 18.75], [e2[0] + 18.75, 292.25 - 18.75], [e2[0] + 18.75, e2[1]], e2];
    var cumul = [0]; for (var q = 1; q < TRAJET.length; q++) { var d = Math.hypot(TRAJET[q][0] - TRAJET[q - 1][0], TRAJET[q][1] - TRAJET[q - 1][1]); cumul.push(cumul[q - 1] + (d < 0.01 ? 110 : d)); }
    function pointTrajet(t) {
      var s = (t * 150) % cumul[cumul.length - 1], i = 1; while (cumul[i] < s) i++;
      var u = (s - cumul[i - 1]) / (cumul[i] - cumul[i - 1]); u = u * u * (3 - 2 * u);
      return [TRAJET[i - 1][0] + (TRAJET[i][0] - TRAJET[i - 1][0]) * u, TRAJET[i - 1][1] + (TRAJET[i][1] - TRAJET[i - 1][1]) * u];
    }

    var CLES = [[0.00, -26, 34, 1.42, 0.00, 1, 0], [0.13, -30, 30, 1.42, 0.00, 1, 0], [0.24, -16, 17, 1.62, 0.0, 1, 64], [0.38, -22, 19, 1.62, 0.0, 1, 64],
      [0.47, -8, 56, 1.42, 0.30, 0.10, 0], [0.58, 6, 58, 1.38, 0.30, 0.10, 0], [0.67, -18, 44, 1.22, 0.0, 0.34, 0], [0.78, -14, 42, 1.22, 0.0, 0.34, 0], [0.90, -26, 34, 1.42, 0.0, 1, 0], [1.0, -26, 34, 1.42, 0.0, 1, 0]];
    var etat = { az: -26, el: 34, r: 1.42, lev: 0, op: 1, ch: 0 }, cibleEtat = { az: -26, el: 34, r: 1.42, lev: 0, op: 1, ch: 0 };
    function cles(p) {
      var i = 1; while (i < CLES.length - 1 && CLES[i][0] < p) i++;
      var a = CLES[i - 1], b = CLES[i], u = (p - a[0]) / Math.max(1e-6, b[0] - a[0]); u = Math.max(0, Math.min(1, u)); u = u * u * (3 - 2 * u);
      return { az: a[1] + (b[1] - a[1]) * u, el: a[2] + (b[2] - a[2]) * u, r: a[3] + (b[3] - a[3]) * u, lev: a[4] + (b[4] - a[4]) * u, op: a[5] + (b[5] - a[5]) * u, ch: a[6] + (b[6] - a[6]) * u };
    }
    var VUES = { ferme: { lev: 0, op: 1, ch: 0 }, ouvert: { lev: 0.21, op: 1, ch: 0 }, capteurs: { lev: 0, op: 1, ch: 64 }, x: { lev: 0, op: 0.28, ch: 0 } };
    function appliquerVue() { var v = VUES[vueLibre]; cibleEtat.lev = v.lev; cibleEtat.op = v.op; cibleEtat.ch = v.ch; majBoutons(); }

    function taille() {
      var w = boite.clientWidth, h = boite.clientHeight; if (!w || !h) return;
      rendu.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 1 ? 44 : (w / h < 1.3 ? 36 : 30); cam.updateProjectionMatrix();
    }
    window.addEventListener("resize", taille); taille();
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(boite);

    document.getElementById("b-libre").addEventListener("click", function () {
      libre = !libre; this.setAttribute("aria-pressed", libre ? "true" : "false"); this.textContent = libre ? "Revenir à la visite" : "Explorer librement";
      boite.classList.toggle("libre", libre); if (orbite) orbite.enabled = libre;
      if (libre) appliquerVue();
    });
    function majBoutons() { Array.prototype.forEach.call(document.querySelectorAll("[data-vue]"), function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-vue") === vueLibre ? "true" : "false"); }); }
    Array.prototype.forEach.call(document.querySelectorAll("[data-vue]"), function (b) { b.addEventListener("click", function () { vueLibre = b.getAttribute("data-vue"); appliquerVue(); }); });

    var t0 = performance.now(), dernier = t0;
    function image(maintenant) {
      requestAnimationFrame(image);
      if (!visible || document.hidden || pret < 3) return;
      var dt = Math.min(0.05, (maintenant - dernier) / 1000); dernier = maintenant;
      var t = calme ? 2.2 : (maintenant - t0) / 1000;
      if (!libre) cibleEtat = cles(prog);
      var k = 1 - Math.pow(0.0015, dt);
      ["az", "el", "r", "lev", "op", "ch"].forEach(function (n) { etat[n] += (cibleEtat[n] - etat[n]) * k; });
      if (!libre) {
        var az = etat.az * Math.PI / 180, el = etat.el * Math.PI / 180, r = etat.r * (cam.aspect < 1.3 ? 0.84 : 0.74);
        cam.position.set(CIBLE.x + r * Math.sin(az) * Math.cos(el), CIBLE.y + etat.lev * 0.4 + r * Math.sin(el), CIBLE.z + r * Math.cos(az) * Math.cos(el));
        cam.lookAt(CIBLE.x, CIBLE.y + etat.lev * 0.4, CIBLE.z);
        if (orbite) orbite.target.set(CIBLE.x, CIBLE.y + etat.lev * 0.4, CIBLE.z);
      } else if (orbite) orbite.update();
      if (couvercle) {
        var phi = -etat.ch * Math.PI / 180, hy = 0.042, hz = -0.071;
        couvercle.rotation.x = phi;
        couvercle.position.set(0, etat.lev + hy - (hy * Math.cos(phi) - hz * Math.sin(phi)), hz - (hy * Math.sin(phi) + hz * Math.cos(phi)));
      }
      matsCouv.forEach(function (m) { var o = etat.op; m.transparent = o < 0.995; m.opacity = o; m.depthWrite = o > 0.6; });
      var p = pointTrajet(t), gx = p[1] - 51, gy = p[0];
      if (portique) portique.position.z = gx * MM;
      if (chariot) { chariot.position.z = gx * MM; chariot.position.x = gy * MM; }
      if (pion) { pion.position.set(p[0] * MM, 0.048 + etat.lev, p[1] * MM); pion.visible = etat.ch < 1.5; }
      if (donnees) { majCourroie("A", gx, gy); majCourroie("B", gx, gy); }
      rendu.render(scene, cam);
    }
    requestAnimationFrame(image);
  }
})();
