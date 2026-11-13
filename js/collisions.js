/* Page collisions : maquette 3D, curseurs de position, carte des positions. Données : assets/collisions.json */
(function(){
  "use strict";
  var $ = function(i){ return document.getElementById(i); };
  var cx = $("cx"), cy = $("cy"), etat = $("etat"), zone = $("zone"), mini = $("mini"), mctx = mini.getContext("2d");
  var D = null, INFO = null, parId = {}, mats = {}, portique = null, chariot = null, rubans = {}, courroies = null, modeDessus = 1, rendu = null, scene, cam, orbite, sale = true;
  var MM = 0.001, ORANGE = 0xff6a00;
  function fr(v){ return String(Math.round(v * 100) / 100).replace(".", ","); }
  function iPos(){ var gx = (+cy.value) - 51, gy = +cx.value; return [Math.round((gx - D.gx[0]) / D.gx[1]), Math.round((gy - D.gy[0]) / D.gy[1]), gx, gy]; }
  function contacts(){ var p = iPos(); return D.hits[p[0] + "," + p[1]] || []; }

  /* ---------- carte des positions ---------- */
  var X0 = -75, Y0 = -4, K = 1;                             // 1 px par mm
  function dessinerMini(){
    if (!D) return;
    mctx.fillStyle = "#0a0705"; mctx.fillRect(0, 0, 470, 330);
    mctx.fillStyle = "#22140a"; mctx.fillRect(10 - X0, 11 - Y0, 300, 300);
    mctx.fillStyle = "#d9a441";
    Object.keys(D.hits).forEach(function(k){ var ij = k.split(","), gx = D.gx[0] + D.gx[1] * ij[0], gy = D.gy[0] + D.gy[1] * ij[1]; mctx.fillRect(gy - X0 - 2.5, gx + 51 - Y0 - 2.5, 5, 5); });
    mctx.strokeStyle = "rgba(242,233,216,.25)"; mctx.lineWidth = 1;
    for (var i = 0; i <= 8; i++) { mctx.beginPath(); mctx.moveTo(10 + 37.5 * i - X0, 11 - Y0); mctx.lineTo(10 + 37.5 * i - X0, 311 - Y0); mctx.moveTo(10 - X0, 11 + 37.5 * i - Y0); mctx.lineTo(310 - X0, 11 + 37.5 * i - Y0); mctx.stroke(); }
    mctx.strokeStyle = "#f2e9d8"; mctx.lineWidth = 1.2; mctx.strokeRect(D.utile.gy[0] - X0, D.utile.gx[0] + 51 - Y0, D.utile.gy[1] - D.utile.gy[0], D.utile.gx[1] - D.utile.gx[0]);
    mctx.fillStyle = "#f2e9d8"; D.cimetiere.forEach(function(c){ mctx.beginPath(); mctx.arc(c.x - X0, c.y - Y0, 3.2, 0, 6.3); mctx.fill(); });
    var x = +cx.value - X0, y = +cy.value - Y0;
    mctx.strokeStyle = "#f2e9d8"; mctx.lineWidth = 1; mctx.beginPath(); mctx.moveTo(x, 0); mctx.lineTo(x, 330); mctx.moveTo(0, y); mctx.lineTo(470, y); mctx.stroke();
    mctx.fillStyle = contacts().length ? "#d9a441" : "#0a0705"; mctx.strokeStyle = "#f2e9d8"; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(x, y, 7, 0, 6.3); mctx.fill(); mctx.stroke();
  }
  function viser(ev){
    var r = mini.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 470 + X0, y = (ev.clientY - r.top) / r.height * 330 + Y0;
    cx.value = Math.round(x / 5) * 5; cy.value = Math.round((y - 1) / 5) * 5 + 1; maj();
  }
  var tenu = false;
  mini.addEventListener("pointerdown", function(e){ tenu = true; mini.setPointerCapture(e.pointerId); viser(e); });
  mini.addEventListener("pointermove", function(e){ if (tenu) viser(e); });
  mini.addEventListener("pointerup", function(){ tenu = false; });

  /* ---------- état ---------- */
  function maj(){
    if (!D) return;
    $("ox").textContent = cx.value; $("oy").textContent = cy.value;
    var x = +cx.value, y = +cy.value, c = contacts();
    var z = (x >= 10 && x <= 310 && y >= 11 && y <= 311) ? "plateau" : ((y >= 11 && y <= 311 && ((x >= -70 && x <= 5) || (x >= 315 && x <= 390))) ? "cimetière" : "hors des cases");
    var utile = x >= D.utile.gy[0] && x <= D.utile.gy[1] && y >= D.utile.gx[0] + 51 && y <= D.utile.gx[1] + 51;
    zone.innerHTML = "Zone : <b>" + z + "</b> · " + (utile ? "dans la course utile" : "<b>hors de la course utile</b>");
    var touches = {};
    c.forEach(function(p){ touches[D.names[p[0]]] = 1; touches[D.names[p[1]]] = 1; });
    if (c.length) {
      etat.className = "etat-c touche";
      etat.innerHTML = c.length + (c.length > 1 ? " contacts" : " contact") + " à cette position<small>" + c.slice(0, 4).map(function(p){ return D.names[p[0]] + " × " + D.names[p[1]]; }).join(" ; ") + (c.length > 4 ? " ; …" : "") + "</small>";
    } else { etat.className = "etat-c"; etat.textContent = "Aucune collision à cette position"; }
    Object.keys(mats).forEach(function(n){ var m = mats[n], t = !!touches[n]; m.mat.color.setHex(t ? 0xf2b21a : m.base); m.mat.emissive.setHex(t ? 0x4a3200 : 0x000000); appliquerOpacite(n); if (t && m.mat.opacity < 0.42) { m.mat.opacity = 0.42; } });
    var gx = y - 51, gy = x;
    if (portique) portique.position.z = gx * MM;
    if (chariot) { chariot.position.z = gx * MM; chariot.position.x = gy * MM; }
    if (courroies && rubans.A) { majCourroie("A", gx, gy); majCourroie("B", gx, gy); }
    dessinerMini(); sale = true;
  }
  function appliquerOpacite(n){
    var m = mats[n], o = m.op;
    if (/^Dessus|^Feuille/.test(n)) { o = [1, 0.16, 0][modeDessus]; m.mesh.visible = modeDessus !== 2; }
    if (/^Nappe|^Puce/.test(n)) { m.mesh.visible = modeDessus !== 2; }
    m.mat.opacity = o; m.mat.transparent = o < 0.995; m.mat.depthWrite = o > 0.6;
  }
  cx.addEventListener("input", maj); cy.addEventListener("input", maj);
  var RACC = [["Centre", 160, 161], ["Case a1", 28.75, 292.25], ["Case h8", 291.25, 29.75], ["Cimetière gauche, rang 1", -51.25, 292.25], ["Cimetière droit, rang 8", 371.25, 29.75], ["Butée côté joueur", 160, 321], ["Butée côté fond", 160, 1], ["Butée gauche", -75, 161], ["Butée droite", 395, 161]];
  RACC.forEach(function(r){ var b = document.createElement("button"); b.type = "button"; b.textContent = r[0]; b.addEventListener("click", function(){ cx.value = Math.round(r[1] / 5) * 5; cy.value = Math.round((r[2] - 1) / 5) * 5 + 1; maj(); }); $("raccourcis").appendChild(b); });
  Array.prototype.forEach.call(document.querySelectorAll("[data-d]"), function(b){ b.addEventListener("click", function(){ modeDessus = +b.getAttribute("data-d"); Array.prototype.forEach.call(document.querySelectorAll("[data-d]"), function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); }); maj(); }); });

  /* ---------- courroies ---------- */
  function versScene(xm, ym, z){ return [ym * MM, (z + 6) * MM, (xm + 51) * MM]; }
  function tangente(c1, R1, s1, c2, R2, s2){
    var dx = c2[0] - c1[0], dy = c2[1] - c1[1], l = Math.hypot(dx, dy), phi = Math.atan2(dy, dx), de = s2 * R2 - s1 * R1;
    var th = phi - Math.asin(Math.max(-1, Math.min(1, de / l))), nx = -Math.sin(th), ny = Math.cos(th);
    return { p1: [c1[0] - s1 * R1 * nx, c1[1] - s1 * R1 * ny], p2: [c2[0] - s2 * R2 * nx, c2[1] - s2 * R2 * ny], th: th };
  }
  function majCourroie(b, gx, gy){
    var el = courroies.belts[b].el, z = courroies.belts[b].z, C = el.map(function(e){ return [e.c[0] + e.gx[0] * gx + e.gy[0] * gy, e.c[1] + e.gx[1] * gx + e.gy[1] * gy]; });
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
    for (k = 0; k < pts.length; k++) { var p0 = versScene(pts[k][0], pts[k][1], z[0]), p1 = versScene(pts[k][0], pts[k][1], z[1]); a[6 * k] = p0[0]; a[6 * k + 1] = p0[1]; a[6 * k + 2] = p0[2]; a[6 * k + 3] = p1[0]; a[6 * k + 4] = p1[1]; a[6 * k + 5] = p1[2]; }
    at.needsUpdate = true;
  }

  /* ---------- chargement ---------- */
  function json(u){ return fetch(u).then(function(r){ return r.json(); }); }
  Promise.all([json("assets/collisions.json"), json("assets/pieces_info.json"), json("assets/courroies.json")]).then(function(r){
    D = r[0]; INFO = r[1]; courroies = r[2]; $("nlibres").textContent = D.cimetiere.filter(function(c){ return c.libre; }).length + " places sur " + D.cimetiere.length;
    maj(); trois();
  }).catch(function(){ $("charge").textContent = "Les données n'ont pas pu être chargées."; });

  function trois(){
    if (!window.THREE || !THREE.GLTFLoader) { $("charge").textContent = "La 3D n'est pas disponible ici : la carte des positions reste utilisable."; return; }
    var boite = $("vue"), toile = $("toile");
    try { rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true }); } catch (e) { $("charge").textContent = "La 3D n'est pas disponible ici : la carte des positions reste utilisable."; return; }
    rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); rendu.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(32, 1.5, 0.05, 20);
    try { var pm = new THREE.PMREMGenerator(rendu); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; } catch (e) {}
    var l = new THREE.DirectionalLight(0xffffff, 0.45); l.position.set(-0.8, 1.5, 1); scene.add(l);
    cam.position.set(0.16 - 0.55, 0.78, 0.183 + 0.98);
    orbite = new THREE.OrbitControls(cam, toile); orbite.target.set(0.16, 0.02, 0.183); orbite.minDistance = 0.3; orbite.maxDistance = 3; orbite.maxPolarAngle = Math.PI * 0.499; orbite.addEventListener("change", function(){ sale = true; }); orbite.update();
    INFO.forEach(function(p){ parId[p.id] = p; });
    var BASE = { coffre: [0x2a2622, 0.55], plateau: [0xe6dcc6, 0.16], rail: [0xe9e9e9, 1], roulement: [0xe9e9e9, 1], boulon: [0x8a8a8a, 1], aimant: [0xf2e9d8, 1], moteur: [0x4a4a4a, 1], nappe: [0xf2e9d8, 0.2], puce: [0xf2e9d8, 1],
                 support: [0xb9b6ae, 1], griffe: [0xb9b6ae, 1], poulie_m: [0xb9b6ae, 1], bloc: [0xb9b6ae, 1], chariot: [0xb9b6ae, 1], carte: [0xf2e9d8, 1], carte_comp: [0x6a6a6a, 1] };
    new THREE.GLTFLoader().load("assets/pieces_3d.json", function(g){
      scene.add(g.scene); portique = g.scene.getObjectByName("portique"); chariot = g.scene.getObjectByName("chariot");
      g.scene.traverse(function(o){
        if (!o.isMesh) return;
        var p = parId[o.name] || parId[o.parent && o.parent.name]; if (!p) return;
        var b = BASE[p.g] || [0xb9b6ae, 1], estDessus = /^Dessus/.test(p.n);
        var m = new THREE.MeshStandardMaterial({ color: b[0], roughness: 0.6, metalness: (p.g === "rail" || p.g === "roulement" || p.g === "aimant") ? 0.9 : 0.0, flatShading: true, side: THREE.DoubleSide, envMapIntensity: 0.45 });
        o.material = m; mats[p.n] = { mat: m, mesh: o, base: b[0], op: estDessus ? 0.16 : b[1] };
      });
      ["A", "B"].forEach(function(b){
        var n = 6 * 2 + 5 * 9, pos = new Float32Array(n * 2 * 3), idx = [];
        for (var i = 0; i < n - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
        var geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
        var mat = new THREE.MeshBasicMaterial({ color: 0x8c8a84, side: THREE.DoubleSide }); var me = new THREE.Mesh(geo, mat); me.frustumCulled = false; scene.add(me); rubans[b] = me;
        mats["Courroie " + b] = { mat: { color: mat.color, emissive: new THREE.Color(), opacity: 1 }, mesh: me, base: 0x8c8a84, op: 1 };
      });
      $("charge").hidden = true; taille(); maj();
    }, undefined, function(){ $("charge").textContent = "La maquette n'a pas pu être chargée."; });
    function taille(){ var w = boite.clientWidth, h = boite.clientHeight; if (!w || !h) return; rendu.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 1 ? 46 : 32; cam.updateProjectionMatrix(); sale = true; }
    window.addEventListener("resize", taille); taille();
    (function boucle(){ requestAnimationFrame(boucle); if (sale) { sale = false; rendu.render(scene, cam); } })();
  }
})();
