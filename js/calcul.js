/* Règles de calcul — fonctions pures, sans accès aux données ni à l'écran.
   Utilisées par le navigateur (window.Calcul) et par les tests Node (module.exports). */
(function (racine) {
  'use strict';

  /* ---------- Arrondi ---------- */
  // regle = { decimales: 0..4, mode: 'proche' | 'inferieur' | 'superieur' }
  function arrondir(valeur, regle) {
    if (valeur === null || valeur === undefined || isNaN(valeur)) return null;
    const d = regle && regle.decimales != null ? Number(regle.decimales) : 2;
    const mode = (regle && regle.mode) || 'proche';
    const f = Math.pow(10, d);
    const v = Number(valeur) * f;
    const eps = 1e-9;
    let r;
    if (mode === 'inferieur') r = Math.floor(v + eps);
    else if (mode === 'superieur') r = Math.ceil(v - eps);
    else r = Math.round(v + (v >= 0 ? eps : -eps));
    return r / f;
  }

  /* ---------- Grille : structure et contrôle de cohérence ---------- */
  // criteres : [{id, parent_id, code, libelle, ponderation, type:'prix'|'qualitatif', bareme}]
  function enfants(criteres, id) {
    return criteres.filter(c => (c.parent_id || null) === (id || null))
      .sort((a, b) => String(a.code).localeCompare(String(b.code), 'fr', { numeric: true }));
  }
  function feuilles(criteres) {
    return criteres.filter(c => !criteres.some(x => x.parent_id === c.id));
  }
  function controleGrille(criteres) {
    const erreurs = [];
    const racines = enfants(criteres, null);
    const total = somme(racines.map(c => c.ponderation));
    if (!racines.length) erreurs.push('La grille ne contient aucun critère.');
    if (Math.abs(total - 100) > 1e-6) erreurs.push('Le total des pondérations des critères fait ' + nombre(total) + ' au lieu de 100.');
    for (const c of criteres) {
      const fils = enfants(criteres, c.id);
      if (fils.length) {
        const s = somme(fils.map(f => f.ponderation));
        if (Math.abs(s - Number(c.ponderation)) > 1e-6)
          erreurs.push('Critère ' + c.code + ' : la somme des sous-critères fait ' + nombre(s) + ' pour une pondération de ' + nombre(c.ponderation) + '.');
        if (c.type === 'prix') erreurs.push('Critère ' + c.code + ' : un critère de prix ne peut pas avoir de sous-critères.');
      } else if (c.type !== 'prix' && !(Number(c.bareme) > 0)) {
        erreurs.push('Critère ' + c.code + ' : le barème de notation doit être supérieur à 0.');
      }
      if (!(Number(c.ponderation) > 0)) erreurs.push('Critère ' + c.code + ' : la pondération doit être supérieure à 0.');
      if (!String(c.libelle || '').trim()) erreurs.push('Critère ' + c.code + ' : le libellé est vide.');
    }
    if (criteres.filter(c => c.type === 'prix').length > 1) erreurs.push('La grille contient plusieurs critères de prix.');
    return { total, erreurs, coherent: erreurs.length === 0 };
  }

  /* ---------- Note de prix ---------- */
  const FORMULES = {
    proportionnelle: { libelle: 'Proportionnelle inverse', expression: 'Note = pondération × (prix le plus bas ÷ prix de l\'offre)' },
    lineaire: { libelle: 'Linéaire par rapport au prix le plus bas', expression: 'Note = pondération × (1 − (prix de l\'offre − prix le plus bas) ÷ prix le plus bas), avec un minimum de 0' },
    moyenne: { libelle: 'Écart à la moyenne', expression: 'Note = pondération × (1 − (prix de l\'offre − prix moyen) ÷ prix moyen), bornée entre 0 et la pondération' }
  };
  // prix : tableau des montants validés de toutes les offres comparées ; p : montant de l'offre notée
  function notePrix(formule, p, prix, ponderation) {
    let liste = prix.map(Number).filter(x => !isNaN(x));
    p = Number(p);
    if (!liste.length || isNaN(p)) return null;
    // Règle usuelle : si une offre est à 0 €, on ajoute 1 € à toutes les offres comparées
    if (liste.some(x => x === 0)) { liste = liste.map(x => x + 1); p = p + 1; }
    const pmin = Math.min.apply(null, liste);
    const pmoy = somme(liste) / liste.length;
    let n;
    if (formule === 'lineaire') n = ponderation * (1 - (p - pmin) / pmin);
    else if (formule === 'moyenne') n = ponderation * (1 - (p - pmoy) / pmoy);
    else n = ponderation * (pmin / p);
    return Math.max(0, Math.min(ponderation, n));
  }

  /* ---------- Calcul d'un lot ---------- */
  // offres : [{id, candidat, montant_ht, montant_valide:boolean, ecartee:boolean}]
  // notes  : [{offre_id, critere_id, note, statut}] — seules les notes au statut 'validee' sont prises en compte
  // grille : {formule_prix, arrondi_decimales, arrondi_mode}
  function calculLot(criteres, offres, notes, grille) {
    const regle = { decimales: grille.arrondi_decimales, mode: grille.arrondi_mode };
    const fs = feuilles(criteres);
    const retenues = offres.filter(o => !o.ecartee);
    const prixValides = retenues.filter(o => o.montant_valide && o.montant_ht != null && o.montant_ht !== '').map(o => Number(o.montant_ht));
    const tousPrixValides = retenues.length > 0 && retenues.every(o => o.montant_valide && o.montant_ht != null && o.montant_ht !== '');
    const lignes = offres.map(o => {
      const detail = {}; const manquants = [];
      let total = 0;
      for (const c of fs) {
        let points = null, brute = null, motif = null;
        if (c.type === 'prix') {
          if (o.ecartee) motif = 'Offre écartée par décision';
          else if (!o.montant_valide) motif = 'Montant non validé';
          else if (!tousPrixValides) motif = 'Montants des autres offres non validés';
          else { brute = Number(o.montant_ht); points = arrondir(notePrix(grille.formule_prix, o.montant_ht, prixValides, Number(c.ponderation)), regle); }
        } else {
          const valides = notes.filter(x => x.offre_id === o.id && x.critere_id === c.id && x.statut === 'validee');
          if (!valides.length) motif = 'Note non validée';
          else {
            // Consolidation : une contribution retenue par le valideur, ou moyenne des contributions validées (option de la grille)
            brute = grille.consolidation === 'moyenne' ? somme(valides.map(x => x.note)) / valides.length : Number(valides[0].note);
            points = arrondir(brute / Number(c.bareme) * Number(c.ponderation), regle);
          }
        }
        detail[c.id] = { points, brute, motif };
        if (points === null) manquants.push(c.code); else total += points;
      }
      // sous-totaux des critères parents
      const sousTotaux = {};
      for (const c of criteres) {
        const desc = descendantsFeuilles(criteres, c.id);
        if (desc.length && desc.every(f => detail[f.id].points !== null))
          sousTotaux[c.id] = arrondir(somme(desc.map(f => detail[f.id].points)), regle);
      }
      const complet = manquants.length === 0 && !o.ecartee;
      return { offre_id: o.id, candidat: o.candidat, detail, sousTotaux, manquants, complet, ecartee: !!o.ecartee,
        total: complet ? arrondir(total, regle) : null, rang: null };
    });
    // Classement provisoire : uniquement les offres dont toutes les notes sont validées ; ex æquo au même rang
    const classables = lignes.filter(l => l.complet).sort((a, b) => b.total - a.total);
    classables.forEach((l, i) => { l.rang = (i > 0 && classables[i - 1].total === l.total) ? classables[i - 1].rang : i + 1; });
    return { lignes, classementComplet: lignes.filter(l => !l.ecartee).every(l => l.complet) && classables.length > 0, nbClassees: classables.length };
  }
  function descendantsFeuilles(criteres, id) {
    const fils = criteres.filter(c => c.parent_id === id);
    if (!fils.length) return [];
    let r = [];
    for (const f of fils) { const d = descendantsFeuilles(criteres, f.id); r = r.concat(d.length ? d : [f]); }
    return r;
  }

  /* ---------- Indices d'offre potentiellement anormalement basse ---------- */
  // Ne produit que des signalements à vérifier : aucune qualification, aucun rejet.
  function indicesPrix(offres, seuilPct, estimation) {
    const avec = offres.filter(o => !o.ecartee && o.montant_ht != null && o.montant_ht !== '' && !isNaN(Number(o.montant_ht)));
    const moyenne = avec.length ? somme(avec.map(o => o.montant_ht)) / avec.length : null;
    return offres.map(o => {
      const r = { offre_id: o.id, candidat: o.candidat, montant: o.montant_ht, signalements: [] };
      if (o.montant_ht == null || o.montant_ht === '' || isNaN(Number(o.montant_ht))) { r.signalements.push({ type: 'manquant', texte: 'Montant de l\'offre non renseigné.' }); return r; }
      const p = Number(o.montant_ht);
      const autres = avec.filter(x => x.id !== o.id);
      if (autres.length >= 1) {
        const moyAutres = somme(autres.map(x => x.montant_ht)) / autres.length;
        r.ecartMoyenneAutres = (p - moyAutres) / moyAutres * 100;
        if (r.ecartMoyenneAutres <= -Math.abs(seuilPct))
          r.signalements.push({ type: 'ecart', texte: 'Prix inférieur de ' + nombre(-r.ecartMoyenneAutres, 1) + ' % à la moyenne des autres offres (seuil d\'alerte paramétré : ' + nombre(seuilPct, 0) + ' %). À vérifier au titre des offres potentiellement anormalement basses.' });
      }
      if (estimation > 0) {
        r.ecartEstimation = (p - estimation) / estimation * 100;
        if (r.ecartEstimation <= -Math.abs(seuilPct))
          r.signalements.push({ type: 'ecart', texte: 'Prix inférieur de ' + nombre(-r.ecartEstimation, 1) + ' % à l\'estimation de l\'acheteur. À vérifier.' });
      }
      if (o.total_lignes != null && Math.abs(Number(o.total_lignes) - p) > 0.01)
        r.signalements.push({ type: 'incoherence', texte: 'Le total recalculé des lignes de prix (' + euros(o.total_lignes) + ') diffère du montant déclaré (' + euros(p) + ').' });
      return r;
    }).map(r => Object.assign(r, { moyenne }));
  }

  /* ---------- Computation des seuils et aide au choix de procédure ---------- */
  // besoins : [{annee, nature, famille, montant_estime}] ; seuils : paramètres modifiables par l'administrateur
  const SEUILS_DEFAUT = {
    date_effet: '2026-01-01',
    dispense_fournitures_services: 60000, dispense_travaux: 100000,
    publicite_obligatoire: 90000,
    formalise_fournitures_services: 216000, formalise_travaux: 5404000
  };
  function computation(besoins, seuils) {
    const groupes = {};
    for (const b of besoins) {
      if (b.statut === 'abandonne') continue;
      const cle = [b.annee, b.nature, (b.famille || 'Non classé').trim()].join('|');
      const g = groupes[cle] || (groupes[cle] = { annee: b.annee, nature: b.nature, famille: (b.famille || 'Non classé').trim(), total: 0, besoins: [] });
      g.total += Number(b.montant_estime) || 0; g.besoins.push(b);
    }
    return Object.values(groupes).map(g => Object.assign(g, aideProcedure(g.nature, g.total, seuils)))
      .sort((a, b) => b.annee - a.annee || b.total - a.total);
  }
  function aideProcedure(nature, montant, seuils) {
    const s = Object.assign({}, SEUILS_DEFAUT, seuils || {});
    const travaux = nature === 'travaux';
    const dispense = travaux ? s.dispense_travaux : s.dispense_fournitures_services;
    const formalise = travaux ? s.formalise_travaux : s.formalise_fournitures_services;
    let niveau, procedure, explication;
    if (montant < dispense) { niveau = 1; procedure = 'Marché sans publicité ni mise en concurrence préalables';
      explication = 'Le montant cumulé (' + euros(montant) + ' HT) est inférieur au seuil de ' + euros(dispense) + ' HT. L\'acheteur veille à choisir une offre pertinente, à bien utiliser les deniers publics et à ne pas contracter systématiquement avec le même opérateur.'; }
    else if (montant < s.publicite_obligatoire) { niveau = 2; procedure = 'Procédure adaptée (MAPA), publicité adaptée';
      explication = 'Le montant cumulé (' + euros(montant) + ' HT) est compris entre ' + euros(dispense) + ' et ' + euros(s.publicite_obligatoire) + ' HT : procédure adaptée avec une publicité librement choisie et proportionnée.'; }
    else if (montant < formalise) { niveau = 3; procedure = 'Procédure adaptée (MAPA), publicité au BOAMP ou dans un journal d\'annonces légales';
      explication = 'Le montant cumulé (' + euros(montant) + ' HT) atteint ' + euros(s.publicite_obligatoire) + ' HT sans atteindre le seuil européen de ' + euros(formalise) + ' HT : procédure adaptée avec avis publié au BOAMP ou dans un JAL.'; }
    else { niveau = 4; procedure = 'Procédure formalisée (appel d\'offres)';
      explication = 'Le montant cumulé (' + euros(montant) + ' HT) atteint le seuil européen de ' + euros(formalise) + ' HT : procédure formalisée avec avis au BOAMP et au JOUE.'; }
    return { niveau, procedure_suggeree: procedure, explication, seuils_appliques: s };
  }

  /* ---------- Échéances d'un marché ---------- */
  function ajouterMois(dateIso, mois) {
    const d = new Date(dateIso + 'T00:00:00Z'); const j = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + Number(mois));
    const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(j, dernier));
    return d.toISOString().slice(0, 10);
  }
  // marche : {date_debut, duree_mois, reconductible, nb_reconductions_max, duree_reconduction_mois, preavis_mois}
  // reconductions : nombre de reconductions déjà décidées
  function echeancesMarche(marche, nbReconduites) {
    if (!marche.date_debut || !marche.duree_mois) return { fin: null, echeances: [] };
    const n = Number(nbReconduites) || 0;
    const duree = Number(marche.duree_mois) + n * (Number(marche.duree_reconduction_mois) || 0);
    const fin = ajouterMois(marche.date_debut, duree);
    const echeances = [{ type: 'fin', date: fin, libelle: 'Fin de la période en cours' }];
    if (marche.reconductible && n < (Number(marche.nb_reconductions_max) || 0))
      echeances.push({ type: 'reconduction', date: ajouterMois(fin, -(Number(marche.preavis_mois) || 3)), libelle: 'Décision de reconduction à prendre (reconduction ' + (n + 1) + ' sur ' + marche.nb_reconductions_max + ')' });
    const finMax = ajouterMois(marche.date_debut, Number(marche.duree_mois) + (marche.reconductible ? (Number(marche.nb_reconductions_max) || 0) * (Number(marche.duree_reconduction_mois) || 0) : 0));
    return { fin, finMax, echeances };
  }
  function joursAvant(dateIso, aujourdhui) {
    const a = new Date((aujourdhui || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    return Math.round((new Date(dateIso + 'T00:00:00Z') - a) / 86400000);
  }

  /* ---------- Révision des prix : P = P0 × (a + (1 − a) × I / I0) ---------- */
  function revisionPrix(partFixe, indice, indiceBase, regle) {
    const a = Number(partFixe), I = Number(indice), I0 = Number(indiceBase);
    if (!(I0 > 0) || !(I > 0) || isNaN(a) || a < 0 || a >= 1) return null;
    return arrondir(a + (1 - a) * I / I0, regle || { decimales: 3, mode: 'superieur' });
  }

  /* ---------- Délais de support : heures continues ou heures ouvrées ---------- */
  // Plage ouvrée : du lundi au vendredi, de 8 h à 17 h (heure locale, ici celle de La Réunion). Jours fériés non déduits.
  const PLAGE = { debut: 8, fin: 17, jours: [1, 2, 3, 4, 5] };
  function ajouterHeuresOuvrees(depart, heures, plage) {
    plage = plage || PLAGE; let t = new Date(depart); let reste = Math.round(heures * 60);
    const ouvert = d => plage.jours.includes(d.getDay());
    const caler = d => { d.setSeconds(0, 0); if (!ouvert(d) || d.getHours() >= plage.fin) { do { d.setDate(d.getDate() + 1); } while (!ouvert(d)); d.setHours(plage.debut, 0, 0, 0); } else if (d.getHours() < plage.debut) d.setHours(plage.debut, 0, 0, 0); return d; };
    t = caler(t);
    for (let garde = 0; garde < 400; garde++) {
      const fin = new Date(t); fin.setHours(plage.fin, 0, 0, 0);
      const dispo = Math.round((fin - t) / 60000);
      if (reste <= dispo) return new Date(t.getTime() + reste * 60000);
      reste -= dispo; t = new Date(fin); t = caler(t);
    }
    return t;
  }
  // Délais contractuels du CCTP (article 3.3.3). h = heures continues, ho = heures ouvrées, jo = jours ouvrés (9 heures ouvrées).
  const DELAIS_SUPPORT = {
    P1: { libelle: 'P1 — Critique', prise_en_charge: [1, 'h'], diagnostic: [2, 'h'], contournement: [4, 'h'], retablissement: [8, 'h'] },
    P2: { libelle: 'P2 — Majeur', prise_en_charge: [4, 'ho'], diagnostic: [1, 'jo'], contournement: [1, 'jo'], retablissement: [2, 'jo'] },
    P3: { libelle: 'P3 — Mineur', prise_en_charge: [1, 'jo'], diagnostic: [3, 'jo'], contournement: null, retablissement: [5, 'jo'] },
    P4: { libelle: 'P4 — Demande', prise_en_charge: [1, 'jo'], diagnostic: null, contournement: null, retablissement: null }
  };
  function echeancesSupport(criticite, depart) {
    const d = DELAIS_SUPPORT[criticite]; if (!d) return {};
    const r = {};
    for (const k of ['prise_en_charge', 'diagnostic', 'contournement', 'retablissement']) {
      const v = d[k]; if (!v) { r[k] = null; continue; }
      r[k] = (v[1] === 'min' ? new Date(new Date(depart).getTime() + v[0] * 60000) : v[1] === 'h' ? new Date(new Date(depart).getTime() + v[0] * 3600000) : ajouterHeuresOuvrees(depart, v[1] === 'jo' ? v[0] * 9 : v[0])).toISOString();
    }
    return r;
  }

  /* ---------- Lecture des critères dans le texte d'un règlement de consultation ---------- */
  // Repère les lignes « Critère n° 1 : Prix — 40 points », « 2.1 Moyens humains : 20 points », « Valeur technique (60 %) ».
  function lireCriteres(texte) {
    const lignes = String(texte || '').replace(/\u00a0/g, ' ').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const vus = new Set(); const r = [];
    const re = /^(?:[-•*]\s*)?(?:(?:sous-)?crit[eè]re\s*(?:n\s*[°ºo]\s*)?)?(\d{1,2}(?:\.\d{1,2})?)\s*[-–—.:)]*\s*(.{3,110}?)\s*(?:[-–—:(,]|\bsur\b)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:points?|pts?|%)\b/i;
    for (const l of lignes) {
      const m = l.match(re); if (!m) continue;
      const code = m[1]; if (vus.has(code)) continue;
      const libelle = m[2].replace(/\s*[-–—:(]+\s*$/, '').replace(/^[:\-–—\s]+/, '').trim();
      if (libelle.length < 3) continue;
      vus.add(code);
      r.push({ code, parent: code.includes('.') ? code.split('.')[0] : null, libelle: libelle.charAt(0).toUpperCase() + libelle.slice(1), ponderation: Number(m[3].replace(',', '.')), type: /prix|co[uû]t|financ/i.test(libelle) && !code.includes('.') ? 'prix' : 'qualitatif' });
    }
    // un critère principal sans ligne propre mais avec des sous-critères reçoit la somme de ses sous-critères
    for (const sc of r.filter(x => x.parent)) if (!r.some(x => x.code === sc.parent)) r.push({ code: sc.parent, parent: null, libelle: 'Critère ' + sc.parent, ponderation: somme(r.filter(y => y.parent === sc.parent).map(y => y.ponderation)), type: 'qualitatif' });
    return r.sort((a, b) => a.code.localeCompare(b.code, 'fr', { numeric: true }));
  }
  // SIRET : 14 chiffres, clé de Luhn (exception connue : établissements de La Poste).
  function siretValide(s) {
    const c = String(s || '').replace(/\s/g, ''); if (!/^\d{14}$/.test(c)) return false;
    if (c.startsWith('356000000')) return c.split('').reduce((a, x) => a + Number(x), 0) % 5 === 0;
    let t = 0; for (let i = 0; i < 14; i++) { let d = Number(c[13 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } t += d; }
    return t % 10 === 0;
  }

  /* ---------- Contrôle de cohérence des bordereaux de prix ---------- */
  // Signalements à vérifier, jamais une décision. lignes : lignes de l'offre contrôlée ;
  // autres : [{ candidat, lignes }] des autres offres du même lot ; lu : résultat de la lecture du fichier (lignes incomplètes, montants déclarés).
  const cle = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  function controleBordereau(lignes, autres, lu) {
    const r = []; lignes = lignes || []; autres = (autres || []).filter(a => a.lignes && a.lignes.length);
    for (const l of lignes) {
      if (!(Number(l.quantite) > 0)) r.push({ type: 'incomplet', texte: 'Ligne « ' + l.designation + ' » : quantité nulle ou absente.' });
      if (l.prix_unitaire === null || l.prix_unitaire === '' || isNaN(Number(l.prix_unitaire))) r.push({ type: 'incomplet', texte: 'Ligne « ' + l.designation + ' » : prix unitaire absent.' });
      if (l.montant_declare != null && l.montant_declare !== '' && Math.abs(Number(l.quantite) * Number(l.prix_unitaire) - Number(l.montant_declare)) > 0.01)
        r.push({ type: 'incoherence', texte: 'Ligne « ' + l.designation + ' » : montant inscrit au bordereau (' + euros(l.montant_declare) + ') différent de quantité × prix unitaire (' + euros(Number(l.quantite) * Number(l.prix_unitaire)) + ').' });
    }
    for (const x of (lu && lu.incompletes) || []) r.push({ type: 'incomplet', texte: 'Ligne « ' + x + ' » du bordereau déposé : quantité ou prix unitaire non renseigné (ligne non importée).' });
    if (lignes.length && autres.length) {
      const miennes = new Map(lignes.map(l => [cle(l.designation), l]));
      const vues = new Map();
      for (const a of autres) for (const l of a.lignes) { const k = cle(l.designation); if (!vues.has(k)) vues.set(k, { designation: l.designation, quantites: [], candidats: 0 }); const v = vues.get(k); v.candidats++; v.quantites.push(Number(l.quantite)); }
      for (const [k, v] of vues) {
        // ligne présente dans au moins la moitié des autres offres, absente de celle-ci
        if (!miennes.has(k) && v.candidats * 2 >= autres.length) r.push({ type: 'incomplet', texte: 'Ligne « ' + v.designation + ' » présente dans ' + v.candidats + ' autre(s) offre(s), absente de ce bordereau.' });
        // quantité différente de celle, identique, de toutes les autres offres (cadre de bordereau modifié ?)
        const m = miennes.get(k);
        if (m && v.candidats === autres.length && v.quantites.every(q => q === v.quantites[0]) && Number(m.quantite) !== v.quantites[0])
          r.push({ type: 'incoherence', texte: 'Ligne « ' + m.designation + ' » : quantité ' + nombre(m.quantite) + ' au lieu de ' + nombre(v.quantites[0]) + ' dans toutes les autres offres (cadre de bordereau modifié ?).' });
      }
    }
    return r;
  }

  /* ---------- Négociation : la procédure la permet-elle ? ---------- */
  // Repère indicatif d'après le libellé de la procédure ; l'acheteur reste seul juge (documents de la consultation).
  function negociationAutorisee(procedure) {
    const p = cle(procedure);
    if (/appel d offres/.test(p)) return { autorisee: false, motif: 'Appel d\'offres : aucune négociation avec les soumissionnaires ; seules des précisions sur la teneur de l\'offre peuvent être demandées.' };
    if (/negociation/.test(p)) return { autorisee: true, motif: 'Procédure avec négociation.' };
    if (/adaptee|mapa/.test(p)) return { autorisee: true, motif: 'Procédure adaptée : négociation possible si les documents de la consultation la prévoient (à vérifier).' };
    if (/sans publicite|devis/.test(p)) return { autorisee: true, motif: 'Achat sans mise en concurrence formalisée : négociation possible.' };
    return { autorisee: null, motif: 'Procédure non reconnue : vérifier que la négociation est permise.' };
  }

  /* ---------- Utilitaires ---------- */
  function somme(t) { return t.reduce((a, b) => a + (Number(b) || 0), 0); }
  function nombre(v, d) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '—';
    return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 2 : d }).replace(/ /g, ' ');
  }
  function euros(v) { return (v === null || v === undefined || v === '' || isNaN(v)) ? '—' : nombre(v, 2) + ' €'; }

  const api = { arrondir, enfants, feuilles, controleGrille, FORMULES, notePrix, calculLot, indicesPrix, SEUILS_DEFAUT, computation,
    aideProcedure, ajouterMois, echeancesMarche, joursAvant, somme, nombre, euros, revisionPrix, ajouterHeuresOuvrees, DELAIS_SUPPORT, echeancesSupport, lireCriteres, siretValide, controleBordereau, negociationAutorisee };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.Calcul = api;
})(typeof window !== 'undefined' ? window : globalThis);
