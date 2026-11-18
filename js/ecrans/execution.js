/* Suivi d'exécution : marchés, ordres de service, bons de commande, avenants, reconductions, révisions de prix, échéances. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  E.champsMarche = fournisseurs => [
    { nom: 'numero', libelle: 'Numéro du marché', requis: true }, { nom: 'service', libelle: 'Service gestionnaire' },
    { nom: 'objet', libelle: 'Objet', requis: true, large: true },
    { nom: 'fournisseur_id', libelle: 'Titulaire', type: 'choix', requis: true, options: fournisseurs.map(f => [f.id, f.raison_sociale]) },
    { nom: 'forme', libelle: 'Forme', type: 'choix', vide: false, options: [['forfait', 'Prix global et forfaitaire'], ['bons', 'Accord-cadre à bons de commande'], ['mixte', 'Mixte (forfait et bons de commande)'], ['unitaire', 'Prix unitaires']] },
    { nom: 'montant_notifie', libelle: 'Montant notifié (€ HT)', type: 'nombre' }, { nom: 'montant_max', libelle: 'Montant maximum des bons de commande (€ HT)', type: 'nombre' },
    { nom: 'date_notification', libelle: 'Date de notification', type: 'date' }, { nom: 'date_debut', libelle: 'Date de début d\'exécution', type: 'date', requis: true },
    { nom: 'duree_mois', libelle: 'Durée initiale (mois)', type: 'nombre', requis: true }, { nom: 'reconductible', libelle: 'Marché reconductible', type: 'case' },
    { nom: 'nb_reconductions_max', libelle: 'Nombre de reconductions possibles', type: 'nombre' }, { nom: 'duree_reconduction_mois', libelle: 'Durée de chaque reconduction (mois)', type: 'nombre' },
    { nom: 'preavis_mois', libelle: 'Préavis de décision de reconduction (mois)', type: 'nombre', defaut: 3 },
    { nom: 'statut', libelle: 'État', type: 'choix', vide: false, options: Object.entries(E.L.marche).map(x => [x[0], x[1][0]]) }].concat(E.champsRevisionMarche ? E.champsRevisionMarche() : []);

  async function situation(m, evenements) {
    const ev = evenements.filter(e => e.marche_id === m.id);
    const reconduites = ev.filter(e => e.type === 'reconduction' && e.statut === 'decidee').length;
    const ech = Calcul.echeancesMarche(m, reconduites);
    const avenants = Calcul.somme(ev.filter(e => e.type === 'avenant' && e.statut !== 'projet').map(e => e.montant));
    const bons = Calcul.somme(ev.filter(e => e.type === 'bon_commande').map(e => e.montant));
    return { ev, reconduites, ech, avenants, bons, montantActuel: (Number(m.montant_notifie) || 0) + avenants, pctAvenants: m.montant_notifie ? avenants / m.montant_notifie * 100 : null };
  }

  E.marches = async function () {
    const [marches, evenements, fournisseurs] = await Promise.all([D.lister('marches', {}, { ordre: 'numero' }), D.lister('evenements'), D.lister('fournisseurs', {}, { ordre: 'raison_sociale' })]);
    const peut = D.peut('execution.ecrire'); const auj = D.aujourdhui();
    const lignes = []; for (const m of marches) lignes.push(Object.assign({ s: await situation(m, evenements) }, m));
    return h('div', U.titrePage('Marchés en exécution', 'Suivi administratif, financier et technique des marchés notifiés.',
      peut ? [U.bouton('Nouveau marché', () => U.editer('Nouveau marché', E.champsMarche(fournisseurs), { statut: 'en_cours', forme: 'forfait' }, async v => { const f = fournisseurs.find(x => x.id === v.fournisseur_id); await D.creer('marches', Object.assign({ titulaire: f.raison_sociale }, v), { action: 'Création d\'un marché', libelle: v.numero + ' — ' + v.objet }); }, { large: true }), 'accent')] : null),
      U.carte(null, U.tableau([{ titre: 'Numéro', valeur: m => h('b', m.numero) }, { titre: 'Objet', valeur: m => m.objet }, { titre: 'Titulaire', valeur: m => m.titulaire },
        { titre: 'Montant actuel HT', num: true, valeur: m => U.euros(m.s.montantActuel) }, { titre: 'Fin de période', valeur: m => { if (!m.s.ech.fin) return '—'; const j = Calcul.joursAvant(m.s.ech.fin, auj); return [U.date(m.s.ech.fin), m.statut === 'en_cours' && j <= 120 ? [' ', U.badge(j < 0 ? 'Dépassée' : 'Dans ' + j + ' j', j <= 30 ? 'danger' : 'alerte')] : null]; } },
        { titre: 'Événements', num: true, valeur: m => m.s.ev.length }, { titre: 'État', valeur: m => E.badge('marche', m.statut) }], lignes, { surClic: m => U.aller('/marche/' + m.id), vide: 'Aucun marché enregistré.' })));
  };
  U.route('/marches', E.marches);

  E.marche = async function (id) {
    const m = await D.lire('marches', id); if (!m) throw new Error('Marché introuvable.');
    const [evenements, fournisseurs, pieces, evaluations] = await Promise.all([D.lister('evenements', { marche_id: id }, { ordre: 'date' }), D.lister('fournisseurs', {}, { ordre: 'raison_sociale' }), D.lister('pieces', { marche_id: id }), D.lister('evaluations', { marche_id: id }, { ordre: 'date' })]);
    const s = await situation(m, evenements); const peut = D.peut('execution.ecrire'); const auj = D.aujourdhui();
    const tr = action => ({ action, libelle: 'Marché ' + m.numero });
    const champsEv = type => [
      { nom: 'type', libelle: 'Nature', type: 'choix', requis: true, options: Object.entries(E.L.evenement), defaut: type },
      { nom: 'numero', libelle: 'Numéro', requis: true }, { nom: 'date', libelle: 'Date', type: 'date', requis: true, defaut: auj }, { nom: 'montant', libelle: 'Montant ou incidence financière (€ HT)', type: 'nombre' },
      { nom: 'objet', libelle: 'Objet', requis: true, large: true },
      { nom: 'statut', libelle: 'État', type: 'choix', vide: false, options: [['projet', 'En projet'], ['notifie', 'Notifié / émis'], ['decidee', 'Décidé (reconduction)'], ['execute', 'Exécuté / service fait'], ['refuse', 'Non reconduit / refusé']] },
      { nom: 'commentaire', libelle: 'Observations', type: 'long' }, { nom: 'fichiers', libelle: 'Pièce justificative', type: 'fichier', multiple: true, large: true }].concat(E.champsRevision ? E.champsRevision(type, m) : []);
    const enregistrerEv = async (v, existant) => {
      const fichiers = v.fichiers || []; delete v.fichiers;
      if (E.calculerRevision) E.calculerRevision(v, m);
      if (v.type === 'bon_commande' && m.montant_max && !existant && s.bons + (v.montant || 0) > m.montant_max && !(await U.confirmer('Montant maximum dépassé', 'Avec ce bon de commande, le cumul (' + U.euros(s.bons + (v.montant || 0)) + ') dépasserait le montant maximum du marché (' + U.euros(m.montant_max) + '). Enregistrer tout de même ?'))) throw new Error('Enregistrement annulé.');
      const e = existant ? await D.modifier('evenements', existant.id, v, tr('Modification : ' + E.L.evenement[v.type] + ' n° ' + v.numero)) : await D.creer('evenements', Object.assign({ marche_id: id, cree_par_nom: D.utilisateur.nom }, v), tr(E.L.evenement[v.type] + ' n° ' + v.numero));
      if (fichiers.length) await E.deposerPieces(fichiers, { marche_id: id, type_piece: E.L.evenement[v.type] + ' n° ' + v.numero }, 'Marché ' + m.numero);
      return e;
    };
    const parType = t => evenements.filter(e => e.type === t);
    return h('div', U.fil([['Marchés', '/marches'], [m.numero]]), U.titrePage(m.objet, 'Marché ' + m.numero + ' · ' + m.titulaire, [E.badge('marche', m.statut)]),
      h('div.indicateurs',
        h('div.indicateur', h('b', U.nombre(s.montantActuel / 1000, 1) + ' k€'), h('span', 'montant actuel HT (notifié ' + U.euros(m.montant_notifie) + (s.avenants ? ', avenants ' + (s.avenants > 0 ? '+' : '') + U.euros(s.avenants) + ' soit ' + U.nombre(s.pctAvenants, 1) + ' %' : '') + ')')),
        h('div.indicateur' + (m.montant_max && s.bons >= 0.8 * m.montant_max ? '.accent' : ''), h('b', U.nombre(s.bons / 1000, 1) + ' k€'), h('span', 'bons de commande émis' + (m.montant_max ? ' sur un maximum de ' + U.euros(m.montant_max) + ' (' + U.nombre(s.bons / m.montant_max * 100, 0) + ' %)' : ''))),
        h('div.indicateur', h('b', U.date(s.ech.fin)), h('span', 'fin de la période en cours' + (m.reconductible ? ' — ' + s.reconduites + ' reconduction(s) décidée(s) sur ' + (m.nb_reconductions_max || 0) : ' — non reconductible'))),
        h('div.indicateur', h('b', evenements.length), h('span', 'événements d\'exécution enregistrés'))),
      h('div.grille2',
        U.carte('Fiche du marché', U.definition([['Titulaire', h('a', { href: '#/fournisseur/' + m.fournisseur_id }, m.titulaire)], ['Forme', { forfait: 'Prix global et forfaitaire', bons: 'Accord-cadre à bons de commande', mixte: 'Mixte', unitaire: 'Prix unitaires' }[m.forme]], ['Notifié le', U.date(m.date_notification)], ['Début d\'exécution', U.date(m.date_debut)],
          ['Durée initiale', m.duree_mois + ' mois'], ['Révision des prix', E.texteRevision ? E.texteRevision(m) : '—'], ['Reconduction', m.reconductible ? (m.nb_reconductions_max || 0) + ' × ' + (m.duree_reconduction_mois || 0) + ' mois, préavis ' + (m.preavis_mois || 3) + ' mois' : 'Non'], ['Terme maximal', U.date(s.ech.finMax)], ['Service', m.service],
          m.consultation_id ? ['Consultation', h('a', { href: '#/consultation/' + m.consultation_id }, 'Voir le dossier de passation')] : null]),
          peut ? [U.bouton('Modifier', () => U.editer('Modifier le marché', E.champsMarche(fournisseurs), m, v => D.modifier('marches', id, Object.assign(v, { titulaire: (fournisseurs.find(x => x.id === v.fournisseur_id) || {}).raison_sociale || m.titulaire }), tr('Modification du marché')), { large: true }), 'secondaire')] : null),
        U.carte('Échéances', U.tableau([{ titre: 'Échéance', valeur: e => e.libelle }, { titre: 'Date', valeur: e => U.date(e.date) }, { titre: 'Délai', valeur: e => { const j = Calcul.joursAvant(e.date, auj); return U.badge(j < 0 ? 'Dépassée de ' + (-j) + ' j' : 'Dans ' + j + ' j', j < 0 ? 'danger' : j <= 30 ? 'danger' : j <= 120 ? 'alerte' : 'neutre'); } }], s.ech.echeances, { vide: 'Renseignez la date de début et la durée.' }))),
      U.carte('Événements d\'exécution', [U.tableau([{ titre: 'Date', classe: 'etroit', valeur: e => U.date(e.date) }, { titre: 'Nature', valeur: e => U.badge(E.L.evenement[e.type], e.type === 'avenant' ? 'alerte' : e.type === 'bon_commande' ? 'info' : 'neutre') }, { titre: 'N°', valeur: e => e.numero },
        { titre: 'Objet', valeur: e => [e.objet, e.commentaire ? h('div.aide', e.commentaire) : null] }, { titre: 'Montant HT', num: true, valeur: e => e.montant == null ? '—' : U.euros(e.montant) },
        { titre: 'État', valeur: e => ({ projet: 'En projet', notifie: 'Notifié / émis', decidee: 'Décidé', execute: 'Exécuté', refuse: 'Refusé' }[e.statut] || '—') }, { titre: 'Saisi par', valeur: e => e.cree_par_nom },
        { titre: '', classe: 'etroit', valeur: e => peut ? U.bouton('Modifier', () => U.editer('Modifier l\'événement', champsEv(e.type), e, v => enregistrerEv(v, e), { large: true }), 'secondaire.petit') : null }], evenements, { vide: 'Aucun événement.' }),
        h('p.aide', { style: { marginTop: '8px' } }, 'Ordres de service : ' + parType('ordre_service').length + ' · Bons de commande : ' + parType('bon_commande').length + ' · Avenants : ' + parType('avenant').length + ' · Reconductions : ' + parType('reconduction').length + ' · Révisions de prix : ' + parType('revision_prix').length)],
        peut ? [['ordre_service', 'Ordre de service'], ['bon_commande', 'Bon de commande'], ['avenant', 'Avenant'], ['reconduction', 'Reconduction'], ['revision_prix', 'Révision de prix']].map(t => U.bouton('+ ' + t[1], () => U.editer(t[1], champsEv(t[0]), { type: t[0], statut: t[0] === 'reconduction' ? 'decidee' : 'notifie', numero: String(parType(t[0]).length + 1) }, v => enregistrerEv(v), { large: true }), 'secondaire.petit')) : null),
      E.carteFactures ? await E.carteFactures(m) : null,
      h('div.grille2',
        U.carte('Pièces justificatives', U.tableau([{ titre: 'Pièce', valeur: p => p.type_piece }, { titre: 'Fichier', valeur: p => h('button.lien', { type: 'button', onclick: () => E.lirePiece(p) }, p.nom_fichier) }, { titre: 'Déposée', valeur: p => U.date(p.depose_le) + ' — ' + p.depose_par_nom }], pieces, { vide: 'Aucune pièce.' }),
          peut ? [h('label.bouton.secondaire', 'Ajouter des pièces', h('input', { type: 'file', multiple: true, hidden: true, onchange: U.agir(async e => { await E.deposerPieces(Array.from(e.target.files), { marche_id: id, type_piece: 'Pièce du marché' }, 'Marché ' + m.numero); U.recharger(); }) }))] : null),
        U.carte('Évaluations du titulaire', U.tableau([{ titre: 'Date', valeur: e => U.date(e.date) }, { titre: 'Période', valeur: e => e.periode }, { titre: 'Note globale', num: true, valeur: e => U.nombre(e.note_globale, 1) + ' / 5' }, { titre: 'État', valeur: e => e.statut === 'validee' ? U.badge('Validée', 'ok') : U.badge('Brouillon', 'neutre') }], evaluations, { surClic: () => U.aller('/evaluations?marche=' + id), vide: 'Aucune évaluation.' }),
          D.peut('evaluations.ecrire') ? [h('a.bouton.secondaire', { href: '#/evaluations?marche=' + id + '&nouveau=1' }, 'Évaluer le titulaire')] : null)));
  };
  U.route('/marche/:id', E.marche);
})();
