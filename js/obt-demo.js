/* La Vigneraie : données de démonstration pour le panneau de réservation OBT.
 *
 * Le panneau est le vrai script de l'application (obt-gestion.com/blocks/obt-booking.js), le même que
 * sur le site de T'Nature. La Vigneraie n'a pas encore de compte dans l'application : ce fichier
 * répond à sa place, dans le navigateur, pour une adresse factice (DEMO_API). Rien n'est lu dans
 * l'application et rien n'y est écrit ; la demande finale n'est envoyée nulle part.
 *
 * Prix : ceux du site actuel et de Bourgogne Tourisme 2026 (_recherche/textes/releves.txt), petits déjeuners
 * compris : la chambre Pouilly-Fuissé 110 € la nuit pour 2, la chambre Saint-Véran 98 €, la maison entière
 * 230 € pour 4 à 6. Hypothèse de la démonstration : un seul prix toute l'année, sans durée minimale.
 * Taxe de séjour de Fuissé, chambres d'hôtes : 0,75 € par personne majeure et par nuit.
 * Les séjours déjà pris sont inventés, pour montrer le planning.
 */
(function () {
  "use strict";
  var DEMO_API = "https://demo-la-vigneraie.obt.invalid";
  var DEMO_ENVOI = "https://demo-la-vigneraie.obt.invalid/envoi";

  var JOUR = 86400000;
  var iso = function (d) { return d.toISOString().slice(0, 10); };
  var date = function (s) { return new Date(s + "T00:00:00Z"); };
  var auj = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
  var plus = function (n) { return iso(new Date(auj.getTime() + n * JOUR)); };

  var IMG = "images/";
  // La maison entière contient les deux chambres : la réserver ferme les chambres ; une chambre prise ferme la maison
  var LOGEMENTS = [
    { id: "chambre-pouilly-fuisse", name: "Chambre Pouilly-Fuissé", kind: "chambre", capacity: 2, note: "lit de 160, salle d’eau privative, vue sur les vignes, petit déjeuner compris", image: IMG + "pouilly-fuisse/chambre.jpg", minNights: 1, contains: [], nuit: 11000 },
    { id: "chambre-saint-veran", name: "Chambre Saint-Véran", kind: "chambre", capacity: 2, note: "lit de 160, salle d’eau privative et WC séparé, petit déjeuner compris", image: IMG + "saint-veran/chambre.jpg", minNights: 1, contains: [], nuit: 9800 },
    { id: "la-maison-entiere", name: "La maison entière", kind: "gite", capacity: 6, note: "les 2 chambres, la mezzanine et la pièce de vie, de 4 à 6 personnes, petits déjeuners compris", image: IMG + "vie/piece-escalier.jpg", minNights: 1, contains: ["chambre-pouilly-fuisse", "chambre-saint-veran"], nuit: 23000 },
  ];

  // Quelques séjours inventés autour d'aujourd'hui
  var OCCUPE = { "chambre-pouilly-fuisse": [], "chambre-saint-veran": [], "la-maison-entiere": [] };
  OCCUPE["chambre-pouilly-fuisse"].push({ start: plus(2), end: plus(4) }, { start: plus(11), end: plus(12) }, { start: plus(24), end: plus(26) });
  OCCUPE["chambre-saint-veran"].push({ start: plus(3), end: plus(5) }, { start: plus(16), end: plus(18) });
  OCCUPE["la-maison-entiere"].push({ start: plus(8), end: plus(10) });

  var OPTIONS = [
    { id: "petit-dejeuner", name: "Petit déjeuner, apporté par Sophie le matin", priceCents: 0, unit: "sejour", included: true },
    { id: "linge", name: "Linge de maison, draps et couettes", priceCents: 0, unit: "sejour", included: true },
    { id: "animal", name: "Votre animal de compagnie", priceCents: 500, unit: "sejour" },
  ].map(function (o) {
    return { id: o.id, name: o.name, priceCents: o.priceCents, unit: o.unit, logementIds: o.logementIds || [], appliesTo: "all",
      minGuests: null, minNights: null, included: !!o.included, mandatory: false, maxGuests: null, maxNights: null,
      periodStart: null, periodEnd: null, includedGuests: null, adultsOnly: false };
  });

  var CONDITIONS = [
    { id: "arrivee", title: "Arrivée", body: "Sophie vous accueille à La Vigneraie : indiquez-lui votre heure d’arrivée, même tardive." },
    { id: "maison", title: "La maison", body: "Les deux chambres ont leur accès indépendant et leur salle d’eau privative. La pièce de vie, sa cuisine et la terrasse sont réservées aux hôtes.\nAvec des enfants : la mezzanine sous le toit accueille 2 enfants (20 € la nuit, petit déjeuner compris), avec une chambre." },
    { id: "domaine", title: "Au domaine", body: "Visite du domaine et dégustation des vins de Sophie sur demande. Parking privé et local à vélos." },
  ];
  var QUESTIONS = [
    { id: "heure", label: "À quelle heure pensez-vous arriver ?" },
    { id: "enfants", label: "Venez-vous avec des enfants (mezzanine) ?" },
    { id: "degustation", label: "Une visite du domaine et une dégustation vous feraient plaisir ?" },
  ];

  var nuits = function (a, b) { return Math.round((date(b) - date(a)) / JOUR); };
  var chevauche = function (a, b, r) { return a < r.end && r.start < b; };
  var byId = function (id) { return LOGEMENTS.filter(function (l) { return l.id === id; })[0]; };
  // Occupations vues par un logement : les siennes, celles des chambres qu'il contient et celles de la maison qui le contient
  function occupations(l) {
    var t = OCCUPE[l.id].slice();
    l.contains.forEach(function (c) { t = t.concat(OCCUPE[c]); });
    LOGEMENTS.forEach(function (m) { if (m.contains.indexOf(l.id) >= 0) t = t.concat(OCCUPE[m.id]); });
    return t;
  }
  var libre = function (l, a, b) { return !occupations(l).some(function (r) { return chevauche(a, b, r); }); };

  function prixNuits(l, a, b) {
    var n = nuits(a, b), t = [];
    for (var i = 0; i < n; i++) t.push({ date: iso(new Date(date(a).getTime() + i * JOUR)), priceCents: l.nuit });
    return t;
  }
  var somme = function (t) { return t.reduce(function (s, x) { return s + x.priceCents; }, 0); };

  function planning() {
    return { hidden: false, today: iso(auj), privacyUrl: null, questions: QUESTIONS, conditions: CONDITIONS, options: OPTIONS,
      logements: LOGEMENTS.map(function (l) {
        return { id: l.id, name: l.name, kind: l.kind, capacity: l.capacity, note: l.note, image: new URL(l.image, location.href).href,
          minNights: l.minNights, minStays: [], contains: l.contains, occupied: occupations(l) };
      }) };
  }

  function disponibilites(p) {
    var a = p.get("start"), b = p.get("end"), g = +p.get("guests") || 1, n = nuits(a, b);
    return { hidden: false, nights: n, guests: g, logements: LOGEMENTS.map(function (l) {
      var ok = libre(l, a, b), assez = n >= l.minNights;
      return { id: l.id, name: l.name, kind: l.kind, capacity: l.capacity, note: l.note, image: new URL(l.image, location.href).href,
        fits: g <= l.capacity, minNights: l.minNights, available: ok && assez,
        reason: !ok ? "occupe" : !assez ? "nuits_minimum" : g > l.capacity ? "places" : null,
        accommodationCents: ok && assez ? somme(prixNuits(l, a, b)) : null };
    }) };
  }

  function devis(p) {
    var ids = (p.get("logement") || "").split(",").filter(Boolean), a = p.get("start"), b = p.get("end");
    var g = +p.get("guests") || 1, enfants = +p.get("children") || 0, n = nuits(a, b);
    var choisis = ids.map(byId).filter(Boolean);
    // la maison entière couvre déjà les chambres : on ne les compte pas deux fois
    if (choisis.some(function (l) { return l.id === "la-maison-entiere"; })) choisis = [byId("la-maison-entiere")];
    var dispo = choisis.length > 0 && choisis.every(function (l) { return libre(l, a, b) && n >= l.minNights; });
    var places = choisis.reduce(function (s, l) { return s + l.capacity; }, 0);
    var lignes = [], nuitees = {};
    choisis.forEach(function (l) {
      var t = prixNuits(l, a, b);
      t.forEach(function (x) { nuitees[x.date] = (nuitees[x.date] || 0) + x.priceCents; });
      lignes.push({ id: l.id, name: l.name, accommodationCents: somme(t) });
    });
    var hebergement = lignes.reduce(function (s, x) { return s + x.accommodationCents; }, 0);
    // Taxe de séjour de Fuissé : 0,75 € par personne majeure et par nuit
    var adultes = Math.max(0, Math.min(g, places) - enfants);
    var taxeCents = 75 * adultes * n;
    var voulues = (p.get("options") || "").split(",").filter(Boolean);
    var extras = OPTIONS.filter(function (o) {
      var permise = !o.logementIds.length || choisis.some(function (l) { return o.logementIds.indexOf(l.id) >= 0; });
      return permise && (o.included || voulues.indexOf(o.id) >= 0);
    }).map(function (o) {
      var q = o.unit === "sejour" ? 1 : o.unit === "personne" ? g : o.unit === "personne_nuit" ? g * n : n;
      var e = { id: o.id, name: o.name, unit: o.unit, quantity: q, unitPriceCents: o.priceCents, totalCents: o.priceCents * q };
      if (o.included) e.included = true;
      return e;
    });
    extras.unshift({ id: "taxe", name: "Taxe de séjour", unit: "sejour", quantity: 1, unitPriceCents: taxeCents, totalCents: taxeCents, mandatory: true });
    return { hidden: false, available: dispo && g <= places, nights: n, guests: g, children: enfants,
      minNights: Math.max.apply(null, choisis.map(function (l) { return l.minNights; }).concat(1)), capacity: places,
      nightly: Object.keys(nuitees).sort().map(function (d) { return { date: d, priceCents: nuitees[d] }; }),
      lines: lignes, accommodationCents: hebergement, extras: extras,
      totalCents: hebergement + extras.reduce(function (s, e) { return s + e.totalCents; }, 0) };
  }

  var repondre = function (corps) {
    return Promise.resolve(new Response(JSON.stringify(corps), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
  var vraiFetch = window.fetch.bind(window);
  window.fetch = function (entree, init) {
    var url = typeof entree === "string" ? entree : entree && entree.url;
    if (!url || url.indexOf(DEMO_API) !== 0) return vraiFetch(entree, init);
    var u = new URL(url);
    // Démonstration : la demande et l'e-mail ne partent nulle part, le visiteur voit simplement « Merci »
    if (url.indexOf(DEMO_ENVOI) === 0 || /\/requests$/.test(u.pathname)) return repondre({ success: true, demo: true });
    if (/\/image\//.test(u.pathname)) return vraiFetch(entree, init);
    if (/\/planning$/.test(u.pathname)) return repondre(planning());
    if (/\/availability$/.test(u.pathname)) return repondre(disponibilites(u.searchParams));
    if (/\/quote$/.test(u.pathname)) return repondre(devis(u.searchParams));
    return Promise.resolve(new Response("{}", { status: 404 }));
  };
})();
