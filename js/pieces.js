/* Catalogue des pièces imprimées + visionneuse 3D (fichiers STL réels, chargés à la demande). */
(function () {
  "use strict";
  var liste = document.getElementById("liste-pieces"), vue = document.getElementById("vue-piece");
  if (!liste || !vue) return;
  var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var PIECES = [
    { f: "chariot_central", n: "Chariot central", q: "1", kb: 297, r: "Porte l'aimant Ø10. 2 × 2 portées lisses sur les tiges, 4 pinces de courroie. Imprimé à plat, rien en porte-à-faux." },
    { f: "bloc_lateral", n: "Bloc de rail", q: "2", kb: 148, r: "Glisse sur le rail, porte la tige du portique. Le bloc avant est le même, tourné de 180°. Posé sur son dessous." },
    { f: "support_moteur_A", n: "Support moteur A", q: "1", kb: 45, r: "Griffe du moteur et poteau du rail, vis de tension. Vu du joueur : à gauche. Imprimé à plat." },
    { f: "support_moteur_B", n: "Support moteur B", q: "1", kb: 45, r: "Miroir du support A, à droite du joueur." },
    { f: "support_angle_arriere", n: "Support d'angle arrière", q: "1", kb: 78, r: "Bout du rail côté fond et deux renvois de coin. Imprimé debout." },
    { f: "support_angle_avant", n: "Support d'angle avant", q: "1", kb: 78, r: "Image miroir du support arrière." },
    { f: "poulie_moteur_A", n: "Poulie moteur A", q: "1", kb: 111, r: "Poulie GT2 de 20 dents, vis pointeau M3." },
    { f: "poulie_moteur_B", n: "Poulie moteur B", q: "1", kb: 129, r: "Poulie GT2 de 20 dents pour le second moteur." },
    { f: "bouchon_pince_A", n: "Bouchon de pince A", q: "2", kb: 1, r: "Ferme la pince à bulbe de la courroie A. Un de rechange conseillé." },
    { f: "bouchon_pince_B", n: "Bouchon de pince B", q: "2", kb: 1, r: "Ferme la pince de la courroie B, collé au cyanoacrylate ou au Kapton." },
    { f: "test_alesage", n: "Coupon d'alésages", q: "1", kb: 197, r: "Quatre alésages Ø6,1 / 6,2 / 6,3 / 6,4 pour choisir le diamètre des portées. À imprimer en premier." },
    { f: "test_pince", n: "Coupon de pince", q: "1", kb: 5, r: "Trois fentes (chambre de 2,3 / 2,5 / 2,7 mm) pour valider la pince de courroie." },
    { f: "test_bouchons", n: "Coupon de bouchons", q: "1", kb: 2, r: "Trois bouchons d'essai." }
  ];

  var courant = null, boutons = [];
  PIECES.forEach(function (p, i) {
    var li = document.createElement("li"), b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-pressed", "false");
    b.innerHTML = '<span class="q">×' + p.q + '</span><span class="nom"></span><span class="ext mesure">' + p.kb + ' Ko</span><span class="role"></span>';
    b.querySelector(".nom").textContent = p.n; b.querySelector(".role").textContent = p.r;
    b.addEventListener("click", function () { choisir(i); });
    li.appendChild(b); liste.appendChild(li); boutons.push(b);
  });

  var info = { nom: document.getElementById("piece-nom"), role: document.getElementById("piece-role"), dl: document.getElementById("piece-dl"), msg: document.getElementById("piece-msg") };
  function choisir(i) {
    courant = i; var p = PIECES[i];
    boutons.forEach(function (b, k) { b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    info.nom.textContent = p.n + " · ×" + p.q; info.role.textContent = p.f + ".stl · " + p.kb + " Ko";
    info.dl.href = "telechargements/stl/" + p.f + ".stl"; info.dl.setAttribute("download", p.f + ".stl");
    charger(p);
  }

  var rendu, scene, cam, orbite, mesh = null, pret = false, visible = false, jeton = 0, tourne = true;
  function demarrer() {
    var toile = document.getElementById("toile-piece");
    try { rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true }); } catch (e) { info.msg.textContent = "La 3D n'est pas disponible sur cet appareil : téléchargez le STL."; return false; }
    rendu.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); rendu.outputEncoding = THREE.sRGBEncoding;
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
    try { var pm = new THREE.PMREMGenerator(rendu); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; } catch (e) {}
    var l = new THREE.DirectionalLight(0xffe7c4, 0.9); l.position.set(-1, 1.6, 1.1); scene.add(l);
    scene.add(new THREE.HemisphereLight(0xfff0d8, 0x120a04, 0.4));
    orbite = new THREE.OrbitControls(cam, toile); orbite.enablePan = false; orbite.enableDamping = true; orbite.dampingFactor = 0.08;
    orbite.addEventListener("start", function () { tourne = false; });
    cam.position.set(120, 90, 140);
    function taille() { var w = vue.clientWidth, h = vue.clientHeight; if (!w || !h) return; rendu.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    window.addEventListener("resize", taille); taille();
    if ("IntersectionObserver" in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(vue); else visible = true;
    (function boucle() { requestAnimationFrame(boucle); if (!visible || document.hidden || !pret) return; if (tourne && !calme && mesh) mesh.rotation.y += 0.006; orbite.update(); rendu.render(scene, cam); })();
    return true;
  }

  function charger(p) {
    if (!pret && !rendu) return;
    var mon = ++jeton; info.msg.textContent = "Chargement du modèle…"; info.msg.hidden = false;
    new THREE.STLLoader().load("telechargements/stl/" + p.f + ".stl", function (geo) {
      if (mon !== jeton) return;
      if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      geo.computeVertexNormals(); geo.computeBoundingBox();
      var c = new THREE.Vector3(); geo.boundingBox.getCenter(c); geo.translate(-c.x, -c.y, -c.z);
      var s = new THREE.Vector3(); geo.boundingBox.getSize(s);
      var m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.55, roughness: 0.38, flatShading: false, envMapIntensity: 0.9 }));
      m.rotation.x = -Math.PI / 2;             // les STL sont en z vers le haut, three.js en y
      mesh = new THREE.Group(); mesh.add(m); scene.add(mesh);
      var rayon = Math.max(s.x, s.y, s.z) * 0.5, d = rayon / Math.tan(cam.fov * Math.PI / 360) * 1.25;
      cam.position.set(d * 0.7, d * 0.55, d * 0.8); orbite.target.set(0, 0, 0); orbite.minDistance = d * 0.4; orbite.maxDistance = d * 3; orbite.update();
      tourne = true; pret = true; info.msg.hidden = true;
      info.role.textContent = p.f + ".stl · " + p.kb + " Ko · " + s.x.toFixed(1).replace(".", ",") + " × " + s.y.toFixed(1).replace(".", ",") + " × " + s.z.toFixed(1).replace(".", ",") + " mm";
    }, undefined, function () { if (mon === jeton) info.msg.textContent = "Le modèle n'a pas pu être chargé : le fichier STL reste téléchargeable."; });
  }

  choisir(0);
  window.Trois.quand(vue, "500px 0px", function () {
    window.Trois.charger().then(function () { if (demarrer()) charger(PIECES[courant]); }).catch(function () { info.msg.textContent = "La visionneuse n'a pas pu se charger : les fichiers STL restent téléchargeables."; });
  });
})();
