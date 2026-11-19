/* Frise du parcours d'une consultation : où en est chaque dossier, du besoin à la clôture.
   - E.etapeConsultation(c, donnees) : calcule l'étape en cours et le détail de chaque étape (fonction pure, sans accès aux données).
   - E.chargerDonneesFrise(cid)    : lit les données utiles (D.lister uniquement : fonctionne en mode local et en mode hébergé).
   - E.friseConsultation(c)        : grande frise cliquable affichée en tête de chaque page de consultation.
   - E.miniFrise(etat)             : petite frise des cartes « Mes dossiers ».
   - E.compteurEtapes(...)         : grosses pastilles « Où en sont mes dossiers » (tableau de bord et liste), qui filtrent la liste. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  /* Pictogrammes dessinés au trait (24 × 24), couleur héritée du texte. Aucun fichier externe. */
  const TRAITS = {
    besoin: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v3H9z"/><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
    dce: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6M9 19h3"/>',
    publication: '<path d="M4 10v4h3l8 4V6l-8 4H4z"/><path d="M18.5 9.5a3.5 3.5 0 0 1 0 5"/><path d="M7.5 14.5L9 19.5h2.5L10 15"/>',
    reception: '<path d="M12 3v9"/><path d="M8.5 8.5L12 12l3.5-3.5"/><path d="M4 14h4.5l1.5 2.5h4l1.5-2.5H20v6H4z"/>',
    analyse: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 13v-2M10.5 13V8.5M13 13v-3"/>',
    attribution: '<circle cx="12" cy="9" r="5.5"/><path d="M9 14l-1.5 7 4.5-2.5 4.5 2.5L15 14"/><path d="M10 9l1.5 1.5L14.5 7.5"/>',
    notification: '<path d="M6.5 3h11M6.5 21h11"/><path d="M8 3v3.5L12 12l4-5.5V3M8 21v-3.5L12 12l4 5.5V21"/>',
    execution: '<path d="M14.5 4.5a4.5 4.5 0 0 0-5.3 5.9L3.5 16.1l4.4 4.4 5.7-5.7a4.5 4.5 0 0 0 5.9-5.3l-2.8 2.8-3-.5-.5-3z"/>',
    cloture: '<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5V20h14V8.5"/><path d="M10 12.5h4"/>',
    coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  E.pictogramme = (cle, taille) => h('span.picto', { 'aria-hidden': 'true',
    html: '<svg viewBox="0 0 24 24" width="' + (taille || 30) + '" height="' + (taille || 30) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + TRAITS[cle] + '</svg>' });

  /* Les neuf étapes du cycle de vie. « onglet » : écran ouvert par un clic sur la pastille. */
  E.ETAPES_PARCOURS = [
    { cle: 'besoin', libelle: 'Besoin', court: 'Besoin' },
    { cle: 'dce', libelle: 'Préparation du DCE', court: 'DCE' },
    { cle: 'publication', libelle: 'Publication', court: 'Publication' },
    { cle: 'reception', libelle: 'Questions et réception des offres', court: 'Réception' },
    { cle: 'analyse', libelle: 'Ouverture et analyse', court: 'Analyse' },
    { cle: 'attribution', libelle: 'Attribution', court: 'Attribution' },
    { cle: 'notification', libelle: 'Notification et délai de suspension', court: 'Notification' },
    { cle: 'execution', libelle: 'Exécution du marché', court: 'Exécution' },
    { cle: 'cloture', libelle: 'Clôture', court: 'Clôture' }
  ];
  const IDX = Object.fromEntries(E.ETAPES_PARCOURS.map((e, i) => [e.cle, i]));
  // Délai de suspension (« standstill ») : 11 jours en procédure formalisée (envoi électronique des lettres de rejet).
  const FORMALISEE = p => /appel d'offres|négociation|dialogue/i.test(p || '');
  const JOURS_SUSPENSION = 11;
  const plus = (dateIso, j) => { const d = new Date(String(dateIso).slice(0, 10) + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + j); return d.toISOString().slice(0, 10); };
  E.compteARebours = j => j == null ? null : j > 0 ? 'J-' + j : j === 0 ? 'aujourd\'hui' : 'dépassé de ' + (-j) + ' j';
  const tonJours = j => j < 0 ? 'danger' : j <= 7 ? 'alerte' : 'info';
  const pl = (n, mot, mots) => n + ' ' + (n > 1 ? (mots || mot + 's') : mot);

  /**
   * Détermine l'étape en cours d'une consultation à partir des données déjà enregistrées.
   * Règles, dans l'ordre (la première qui s'applique l'emporte) :
   *  1. statut « close »                                   → Clôture
   *  2. marché lié (marches.consultation_id) terminé ou résilié → Clôture ; en cours → Exécution
   *  3. statut « attribuee »                               → Notification et délai de suspension
   *  4. statut « analyse » : toutes les analyses de lots validées, ou un rapport validé → Attribution ; sinon → Ouverture et analyse
   *  5. statut « publiee » : date limite de remise des offres dépassée → Ouverture et analyse ; sinon → Questions et réception des offres
   *  6. statut « preparation » : au moins un document du DCE et tous validés ou publiés → Publication ; sinon → Préparation du DCE
   * L'étape « Besoin » est toujours franchie : la consultation existe.
   * donnees : { lots, documents_dce, offres, pieces, analyses, rapports, demandes, marches, evenements, evaluations, besoins } ;
   * les tableaux peuvent contenir d'autres consultations, ils sont filtrés ici. aujourdhui : 'AAAA-MM-JJ' (facultatif).
   * Retour : { index, cle, courante, etapes[9], prochaineEcheance, alertes[] }.
   */
  E.etapeConsultation = function (c, donnees, aujourdhui) {
    const d = donnees || {}; const auj = aujourdhui || D.aujourdhui();
    const de = t => (d[t] || []).filter(x => x.consultation_id === c.id);
    const lots = de('lots'), docs = de('documents_dce'), offres = de('offres'), pieces = de('pieces'), rapports = de('rapports'), demandes = de('demandes');
    const idsLots = lots.map(l => l.id);
    const analyses = (d.analyses || []).filter(a => a.consultation_id === c.id || idsLots.includes(a.lot_id));
    const marche = (d.marches || []).find(m => m.consultation_id === c.id) || null;
    const evenements = marche ? (d.evenements || []).filter(e => e.marche_id === marche.id) : [];
    const evaluations = marche ? (d.evaluations || []).filter(e => e.marche_id === marche.id) : [];
    const besoin = c.besoin_id ? (d.besoins || []).find(b => b.id === c.besoin_id) : null;
    const jours = x => x ? Calcul.joursAvant(String(x).slice(0, 10), auj) : null;

    const docsPrets = docs.length > 0 && docs.every(x => ['valide', 'publie'].includes(x.statut));
    const analysesValidees = lots.length > 0 && lots.every(l => analyses.some(a => a.lot_id === l.id && a.statut === 'validee'));
    const rapportsValides = rapports.filter(r => r.statut === 'valide').sort((a, b) => String(b.valide_le || '').localeCompare(String(a.valide_le || '')));
    const jLimite = jours(c.date_limite_offres);

    let cle;
    if (c.statut === 'close') cle = 'cloture';
    else if (marche && ['termine', 'resilie'].includes(marche.statut)) cle = 'cloture';
    else if (marche) cle = 'execution';
    else if (c.statut === 'attribuee') cle = 'notification';
    else if (c.statut === 'analyse') cle = (analysesValidees || rapportsValides.length) ? 'attribution' : 'analyse';
    else if (c.statut === 'publiee') cle = (jLimite != null && jLimite < 0) ? 'analyse' : 'reception';
    else cle = docsPrets ? 'publication' : 'dce';
    const index = IDX[cle];

    // Échéances
    const demandesOuvertes = demandes.filter(x => x.statut === 'envoyee' && x.echeance).sort((a, b) => String(a.echeance).localeCompare(String(b.echeance)));
    const reco = marche ? evenements.filter(e => e.type === 'reconduction' && e.statut === 'decidee').length : 0;
    const ech = marche ? Calcul.echeancesMarche(marche, reco) : null;
    const baseSuspension = rapportsValides[0] ? rapportsValides[0].valide_le : null;
    const finSuspension = FORMALISEE(c.procedure) && baseSuspension ? plus(baseSuspension, JOURS_SUSPENSION) : null;
    const nonRetenues = Math.max(0, offres.filter(o => !o.ecartee).length - lots.length);

    const detail = {
      besoin: { date: c.cree_le, dateLibelle: 'Dossier créé le', compte: besoin ? 'Fiche besoin ' + (besoin.reference || '') : 'Aucun besoin rattaché', lien: '/besoins' },
      dce: { date: docs.map(x => x.modifie_le).filter(Boolean).sort().pop(), dateLibelle: 'Dernière modification', compte: pl(docs.length, 'document') + ' du DCE', lien: '/dce' },
      publication: { date: c.date_publication || null, dateLibelle: 'Publiée le', vide: c.date_publication ? null : 'Date de publication non saisie', compte: pl(docs.filter(x => x.statut === 'publie').length, 'pièce publiée', 'pièces publiées'), lien: '/ged' },
      reception: { date: c.date_limite_offres, dateLibelle: 'Remise des offres', jours: jLimite, compte: pl(offres.length, 'pli') + ', ' + pl(pieces.filter(p => p.offre_id).length, 'pièce'), lien: '/offres' },
      analyse: { date: demandesOuvertes[0] ? demandesOuvertes[0].echeance : null, dateLibelle: 'Réponse attendue d\'un candidat', jours: demandesOuvertes[0] ? jours(demandesOuvertes[0].echeance) : null,
        vide: demandesOuvertes.length ? null : 'Aucune demande en attente', compte: pl(demandes.length, 'demande') + ' aux candidats', lien: '/analyse' },
      attribution: { date: baseSuspension, dateLibelle: 'Rapport validé le', vide: baseSuspension ? null : 'Rapport non validé', compte: pl(rapports.length, 'rapport') + ' d\'analyse', lien: '/rapport' },
      notification: { date: finSuspension, dateLibelle: 'Fin du délai de suspension (estimée, non vérifiée)', jours: finSuspension ? jours(finSuspension) : null,
        vide: finSuspension ? null : FORMALISEE(c.procedure) ? 'Délai calculé après validation du rapport' : 'Pas de délai de suspension obligatoire en procédure adaptée (à confirmer)',
        compte: pl(nonRetenues, 'candidat') + ' à informer', lien: '/rapport' },
      execution: { date: ech ? ech.fin : null, dateLibelle: 'Fin de la période en cours', jours: ech && ech.fin ? jours(ech.fin) : null, vide: marche ? null : 'Aucun marché rattaché',
        compte: marche ? pl(evenements.length, 'acte') + ' d\'exécution' : 'Marché à enregistrer', lien: marche ? '#/marche/' + marche.id : '#/marches' },
      cloture: { date: ech ? ech.finMax : null, dateLibelle: 'Fin du marché', jours: ech && ech.finMax ? jours(ech.finMax) : null, vide: ech ? null : '—', compte: pl(evaluations.length, 'évaluation') + ' du titulaire', lien: '/audit' }
    };
    const etapes = E.ETAPES_PARCOURS.map((e, i) => {
      const x = detail[e.cle]; const etat = i < index ? 'fait' : i === index ? 'courant' : 'avenir';
      const lien = x.lien.startsWith('#') ? x.lien.slice(1) : x.lien === '/besoins' ? '/besoins' : '/consultation/' + c.id + (x.lien === '/fiche' ? '' : x.lien);
      // Le compte à rebours ne s'affiche que pour l'étape en cours ou à venir.
      const jr = etat !== 'fait' && x.jours != null ? x.jours : null;
      return Object.assign({}, e, x, { etat, lien, rebours: E.compteARebours(jr), ton: jr == null ? null : tonJours(jr), joursRestants: jr });
    });

    // Prochaine échéance et alertes
    const candidats = [];
    if (['preparation', 'publiee'].includes(c.statut) && c.date_limite_offres) candidats.push({ libelle: 'Remise des offres', date: c.date_limite_offres });
    for (const x of demandesOuvertes) candidats.push({ libelle: 'Réponse d\'un candidat (' + ((E.L.demande[x.type] || 'demande').toLowerCase()) + ')', date: x.echeance });
    if (cle === 'notification' && finSuspension) candidats.push({ libelle: 'Fin du délai de suspension (estimée)', date: finSuspension });
    if (ech && cle === 'execution') for (const e of ech.echeances) candidats.push({ libelle: e.libelle, date: e.date });
    candidats.forEach(x => { x.jours = jours(x.date); });
    candidats.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const prochaineEcheance = candidats.find(x => x.jours >= 0) || candidats[candidats.length - 1] || null;

    const alertes = [];
    for (const x of demandesOuvertes) { const j = jours(x.echeance); if (j < 0) alertes.push({ ton: 'danger', texte: 'Réponse d\'un candidat attendue, ' + E.compteARebours(j) }); }
    if (cle === 'reception' && jLimite != null && jLimite <= 7) alertes.push({ ton: 'alerte', texte: 'Remise des offres ' + (jLimite === 0 ? 'aujourd\'hui' : 'dans ' + jLimite + ' j') });
    if (cle === 'dce' && docs.some(x => !['redaction', 'valide', 'publie'].includes(x.statut))) alertes.push({ ton: 'alerte', texte: 'Document du DCE en attente de validation' });
    if (c.statut === 'analyse' && analyses.some(a => a.statut === 'en_relecture')) alertes.push({ ton: 'alerte', texte: 'Analyse à valider' });
    if (cle === 'notification' && finSuspension && jours(finSuspension) >= 0) alertes.push({ ton: 'info', texte: 'Délai de suspension en cours : ne pas signer avant le ' + U.date(finSuspension) });
    if (cle === 'execution' && ech && ech.fin && jours(ech.fin) <= 30) alertes.push({ ton: jours(ech.fin) < 0 ? 'danger' : 'alerte', texte: 'Fin de période du marché : ' + E.compteARebours(jours(ech.fin)) });

    return { index, cle, courante: etapes[index], etapes, prochaineEcheance, alertes, marche };
  };

  /* Lecture des données utiles à la frise. cid : une seule consultation (lecture filtrée) ou toutes. Une table illisible pour ce profil compte pour vide. */
  E.chargerDonneesFrise = async function (cid) {
    const f = cid ? { consultation_id: cid } : {};
    const lire = (t, filtre, options) => D.lister(t, filtre, options).catch(() => []);
    const [lots, documents_dce, offres, pieces, analyses, rapports, demandes, marches, evenements, evaluations, besoins] = await Promise.all([
      lire('lots', f), lire('documents_dce', f, { colonnes: ['consultation_id', 'statut', 'modifie_le', 'type_piece'] }), lire('offres', f, { colonnes: ['consultation_id', 'lot_id', 'ecartee'] }),
      lire('pieces', f, { colonnes: ['consultation_id', 'offre_id', 'marche_id', 'type_piece'] }), lire('analyses'), lire('rapports', f, { colonnes: ['consultation_id', 'lot_id', 'statut', 'valide_le'] }), lire('demandes', f),
      lire('marches'), lire('evenements', {}, { colonnes: ['marche_id', 'type', 'statut'] }), lire('evaluations', {}, { colonnes: ['marche_id', 'statut'] }), lire('besoins', {}, { colonnes: ['reference', 'objet'] })]);
    return { lots, documents_dce, offres, pieces, analyses, rapports, demandes, marches, evenements, evaluations, besoins };
  };

  /* ---------- Grande frise ---------- */
  function dessinerFrise(etat) {
    return h('ol.frise-etapes', { 'aria-label': 'Étapes de la consultation' }, etat.etapes.map((e, i) => {
      const courant = e.etat === 'courant';
      const statutTexte = e.etat === 'fait' ? 'étape franchie' : courant ? 'étape en cours' : 'étape à venir';
      return h('li.frise-etape.' + e.etat, { 'data-etape': e.cle },
        h('a.frise-lien', { href: '#' + e.lien, 'data-etape': e.cle, 'aria-current': courant ? 'step' : null, title: 'Ouvrir : ' + e.libelle },
          h('span.frise-pastille', E.pictogramme(e.cle, 32), e.etat === 'fait' ? h('span.frise-coche', E.pictogramme('coche', 14)) : null),
          h('span.frise-num', 'Étape ' + (i + 1)),
          h('span.frise-libelle', e.libelle),
          h('span.lecteur-seul', ' — ' + statutTexte)),
        h('div.frise-detail',
          e.date ? h('span.frise-date', e.dateLibelle + ' : ' + U.date(e.date)) : (e.vide ? h('span.frise-date', e.vide) : null),
          e.rebours ? U.badge(e.rebours, e.ton) : null,
          h('span.frise-compte', e.compte)));
    }));
  }

  /* Frise affichée en tête de la consultation : rendue tout de suite, remplie dès que les données sont lues. */
  E.friseConsultation = function (c, donnees) {
    const corps = h('div.frise-defile', h('p.aide', 'Lecture du parcours du dossier…'));
    const resume = h('p.frise-resume');
    const zone = h('section.carte.frise-carte', { 'aria-labelledby': 'titre-parcours' },
      h('div.frise-bord', { 'aria-hidden': 'true' }),
      h('div.carte-tete', h('h2', { id: 'titre-parcours' }, 'Parcours du dossier'), resume), corps,
      h('p.aide.frise-note', 'Chaque pastille ouvre l\'écran de l\'étape. L\'étape est déduite des données du dossier (statut, DCE, offres, analyses, rapports, marché rattaché).'));
    const remplir = d => {
      const etat = E.etapeConsultation(c, d);
      resume.replaceChildren(h('span', 'Étape en cours : '), h('b', etat.courante.libelle), h('span', ' — ' + (etat.index + 1) + ' sur ' + etat.etapes.length),
        etat.prochaineEcheance ? h('span.frise-echeance', ' · Prochaine échéance : ' + etat.prochaineEcheance.libelle + ', ' + U.date(etat.prochaineEcheance.date) + (etat.prochaineEcheance.jours != null ? ' (' + E.compteARebours(etat.prochaineEcheance.jours) + ')' : '')) : null);
      corps.replaceChildren(dessinerFrise(etat));
      zone.dataset.etape = etat.cle;
    };
    if (donnees) remplir(donnees);
    else E.chargerDonneesFrise(c.id).then(remplir).catch(e => { console.warn('frise', e); corps.replaceChildren(h('p.aide', 'Parcours indisponible pour le moment.')); });
    return zone;
  };

  /* ---------- Mini-frise des cartes ---------- */
  E.miniFrise = etat => h('div.mini-frise', { role: 'img', 'aria-label': 'Parcours : étape ' + (etat.index + 1) + ' sur ' + etat.etapes.length + ', ' + etat.courante.libelle },
    etat.etapes.map(e => h('span.mini-point.' + e.etat, { title: e.libelle })));

  /* ---------- Compteur par étape (grosses pastilles qui filtrent) ---------- */
  E.compteurEtapes = function (etats, actif) {
    const compte = Object.fromEntries(E.ETAPES_PARCOURS.map(e => [e.cle, 0]));
    for (const x of etats) compte[x.cle]++;
    return h('ol.compteur-etapes', { 'aria-label': 'Nombre de dossiers par étape' }, E.ETAPES_PARCOURS.map(e =>
      h('li' + (compte[e.cle] ? '.occupe' : '') + (actif === e.cle ? '.actif' : ''),
        h('a', { href: '#/consultations' + (actif === e.cle ? '' : '?etape=' + e.cle), 'data-etape': e.cle, 'aria-current': actif === e.cle ? 'true' : null },
          h('span.frise-pastille', E.pictogramme(e.cle, 28), h('b.compteur-nb', String(compte[e.cle]))),
          h('span.compteur-libelle', e.court),
          h('span.lecteur-seul', ' : ' + pl(compte[e.cle], 'dossier') + (actif === e.cle ? ' (filtre actif, cliquer pour le retirer)' : ''))))));
  };

  /* ---------- Vue « Mes dossiers » (cartes) ---------- */
  E.carteDossier = function (c, etat) {
    const pe = etat.prochaineEcheance;
    return h('article.dossier-carte.' + etat.cle, { 'data-etape': etat.cle },
      h('div.dossier-tete', h('span.dossier-ref', c.reference), E.badge('consultation', c.statut)),
      h('h3', h('a', { href: '#/consultation/' + c.id }, c.objet)),
      E.miniFrise(etat),
      h('p.dossier-etape', E.pictogramme(etat.cle, 22), h('span', h('b', etat.courante.libelle), h('span.aide', ' — étape ' + (etat.index + 1) + ' sur ' + etat.etapes.length))),
      h('p.dossier-echeance', pe ? ['Prochaine échéance : ', h('b', U.date(pe.date)), ' — ' + pe.libelle + ' ', pe.jours != null ? U.badge(E.compteARebours(pe.jours), tonJours(pe.jours)) : null] : h('span.aide', 'Aucune échéance enregistrée')),
      etat.alertes.length ? h('ul.dossier-alertes', etat.alertes.slice(0, 3).map(a => h('li', U.badge(a.texte, a.ton)))) : null,
      h('a.bouton.secondaire.petit.dossier-ouvrir', { href: '#' + etat.courante.lien }, 'Ouvrir l\'étape en cours'));
  };
})();
