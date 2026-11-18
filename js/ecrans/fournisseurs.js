/* Fournisseurs (identification, qualification, historique, suivi) et évaluation des titulaires. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  let POIDS = {};
  let CRITERES_EVAL = ['Qualité des prestations', 'Respect des délais', 'Respect des obligations administratives', 'Relation et réactivité', 'Respect des engagements environnementaux et sociaux'];
  const champs = [
    { nom: 'raison_sociale', libelle: 'Raison sociale', requis: true }, { nom: 'siret', libelle: 'SIRET' },
    { nom: 'adresse', libelle: 'Adresse', large: true }, { nom: 'commune', libelle: 'Commune' }, { nom: 'taille', libelle: 'Catégorie', type: 'choix', options: [['TPE', 'Très petite entreprise'], ['PME', 'PME'], ['ETI', 'ETI'], ['GE', 'Grande entreprise'], ['ESS', 'Structure de l\'économie sociale et solidaire']] },
    { nom: 'contact', libelle: 'Interlocuteur' }, { nom: 'email', libelle: 'Adresse électronique' }, { nom: 'telephone', libelle: 'Téléphone' },
    { nom: 'source', libelle: 'Source de l\'identification', aide: 'Candidature, salon, sourcing, recommandation d\'un service, annuaire…' },
    { nom: 'domaines', libelle: 'Domaines d\'activité (séparés par des virgules)', large: true },
    { nom: 'qualification', libelle: 'Qualifications, certifications, capacités déclarées', type: 'long' }, { nom: 'commentaire', libelle: 'Observations factuelles', type: 'long' }];

  E.fournisseurs = async function () {
    const [f, offres, marches] = await Promise.all([D.lister('fournisseurs', {}, { ordre: 'raison_sociale' }), D.lister('offres'), D.lister('marches')]);
    const peut = D.peut('fournisseurs.ecrire'); const zone = h('div'); let q = '';
    const dessiner = () => { const n = q.toLowerCase(); zone.replaceChildren(U.tableau([{ titre: 'Raison sociale', valeur: x => h('b', x.raison_sociale) }, { titre: 'Commune', valeur: x => x.commune }, { titre: 'Domaines', valeur: x => x.domaines }, { titre: 'Catégorie', valeur: x => x.taille },
      { titre: 'Source', valeur: x => x.source }, { titre: 'Offres', num: true, valeur: x => offres.filter(o => o.fournisseur_id === x.id).length }, { titre: 'Marchés', num: true, valeur: x => marches.filter(m => m.fournisseur_id === x.id).length }],
      f.filter(x => !n || (x.raison_sociale + ' ' + (x.domaines || '') + ' ' + (x.commune || '') + ' ' + (x.siret || '')).toLowerCase().includes(n)), { surClic: x => U.aller('/fournisseur/' + x.id), vide: 'Aucun fournisseur.' })); };
    dessiner();
    return h('div', U.titrePage('Fournisseurs', 'Identification, qualification et suivi des opérateurs économiques, en amont des procédures.',
      [U.bouton('Exporter (XLSX)', async () => { U.telechargerBlob(await Docs.xlsx([{ nom: 'Fournisseurs', lignes: [['Raison sociale', 'SIRET', 'Adresse', 'Commune', 'Catégorie', 'Interlocuteur', 'Courriel', 'Téléphone', 'Domaines', 'Source', 'Qualifications', 'Offres déposées', 'Marchés']].concat(f.map(x => [x.raison_sociale, x.siret, x.adresse, x.commune, x.taille, x.contact, x.email, x.telephone, x.domaines, x.source, x.qualification, offres.filter(o => o.fournisseur_id === x.id).length, marches.filter(m => m.fournisseur_id === x.id).length])) }]), 'fournisseurs-' + D.aujourdhui() + '.xlsx'); await D.journal('Export des fournisseurs (XLSX)', 'fournisseurs', null, f.length + ' fiches'); }, 'secondaire'),
        peut ? U.bouton('Nouveau fournisseur', () => U.editer('Nouveau fournisseur', champs, {}, v => D.creer('fournisseurs', Object.assign({ actif: true }, v), { action: 'Création d\'une fiche fournisseur', libelle: v.raison_sociale }), { large: true }), 'accent') : null]),
      U.carte(null, [h('input.saisie', { type: 'search', placeholder: 'Rechercher par nom, domaine, commune, SIRET…', 'aria-label': 'Rechercher un fournisseur', style: { maxWidth: '420px', marginBottom: '12px' }, oninput: e => { q = e.target.value; dessiner(); } }), zone]));
  };
  U.route('/fournisseurs', E.fournisseurs);

  E.fournisseur = async function (id) {
    const f = await D.lire('fournisseurs', id); if (!f) throw new Error('Fournisseur introuvable.');
    const [offres, marches, suivi, evals, consultations] = await Promise.all([D.lister('offres', { fournisseur_id: id }, { ordre: 'date_depot' }), D.lister('marches', { fournisseur_id: id }), D.lister('fournisseur_suivi', { fournisseur_id: id }, { ordre: 'date', desc: true }), D.lister('evaluations', { fournisseur_id: id }, { ordre: 'date' }), D.lister('consultations')]);
    const peut = D.peut('fournisseurs.ecrire');
    return h('div', U.fil([['Fournisseurs', '/fournisseurs'], [f.raison_sociale]]), U.titrePage(f.raison_sociale, [f.commune, f.domaines].filter(Boolean).join(' · ')),
      h('div.note-info', 'Fiche de suivi : elle ne sert jamais à exclure automatiquement un opérateur ni à constituer une liste noire. Toute appréciation est humaine, datée et rattachée à des faits.'),
      h('div.grille2',
        U.carte('Identification et qualification', U.definition([['SIRET', f.siret], ['Adresse', [f.adresse, f.commune].filter(Boolean).join(', ')], ['Catégorie', f.taille], ['Interlocuteur', f.contact], ['Courriel', f.email], ['Téléphone', f.telephone], ['Source', f.source], ['Domaines', f.domaines], ['Qualifications', f.qualification], ['Observations', f.commentaire]]),
          peut ? [U.bouton('Modifier', () => U.editer('Modifier la fiche', champs, f, v => D.modifier('fournisseurs', id, v, { action: 'Modification d\'une fiche fournisseur', libelle: v.raison_sociale }), { large: true }), 'secondaire')] : null),
        U.carte('Suivi et échanges', U.tableau([{ titre: 'Date', classe: 'etroit', valeur: s => U.date(s.date) }, { titre: 'Nature', valeur: s => s.type }, { titre: 'Compte rendu', valeur: s => s.compte_rendu }, { titre: 'Par', valeur: s => s.auteur_nom }], suivi, { vide: 'Aucun échange enregistré.' }),
          peut ? [U.bouton('Ajouter un échange', () => U.editer('Échange avec le fournisseur', [{ nom: 'date', libelle: 'Date', type: 'date', defaut: D.aujourdhui(), requis: true }, { nom: 'type', libelle: 'Nature', type: 'choix', requis: true, options: ['Rencontre de sourcing', 'Salon ou réunion d\'information', 'Demande d\'information', 'Échange en cours de marché', 'Autre'].map(x => [x, x]) }, { nom: 'compte_rendu', libelle: 'Compte rendu factuel', type: 'long', requis: true }], {},
            v => D.creer('fournisseur_suivi', Object.assign({ fournisseur_id: id, auteur_nom: D.utilisateur.nom }, v), { action: 'Échange enregistré avec un fournisseur', libelle: f.raison_sociale })), 'secondaire')] : null)),
      U.carte('Historique des candidatures', U.tableau([{ titre: 'Consultation', valeur: o => { const c = consultations.find(x => x.id === o.consultation_id); return c ? (D.voitConsultation(c) ? h('a', { href: '#/consultation/' + c.id }, c.reference + ' — ' + c.objet) : c.reference + ' — ' + c.objet) : '—'; } }, { titre: 'Déposée le', valeur: o => U.date(o.date_depot) }, { titre: 'Montant HT', num: true, valeur: o => U.euros(o.montant_ht) }, { titre: 'Suite', valeur: o => marches.some(m => m.consultation_id === o.consultation_id) ? U.badge('Titulaire', 'ok') : E.badge('candidature', o.candidature_statut) }], offres, { vide: 'Aucune candidature enregistrée.' })),
      h('div.grille2',
        U.carte('Marchés', U.tableau([{ titre: 'Numéro', valeur: m => h('a', { href: '#/marche/' + m.id }, m.numero) }, { titre: 'Objet', valeur: m => m.objet }, { titre: 'Montant HT', num: true, valeur: m => U.euros(m.montant_notifie) }, { titre: 'État', valeur: m => E.badge('marche', m.statut) }], marches, { vide: 'Aucun marché.' })),
        U.carte('Évaluations', U.tableau([{ titre: 'Date', valeur: e => U.date(e.date) }, { titre: 'Marché', valeur: e => (marches.find(m => m.id === e.marche_id) || {}).numero }, { titre: 'Note globale', num: true, valeur: e => U.nombre(e.note_globale, 1) + ' / 5' }, { titre: 'État', valeur: e => e.statut === 'validee' ? U.badge('Validée', 'ok') : U.badge('Brouillon', 'neutre') }], evals, { vide: 'Aucune évaluation.' }))));
  };
  U.route('/fournisseur/:id', E.fournisseur);

  /* ---------- Évaluation des titulaires ---------- */
  E.evaluations = async function () {
    const cfgCrit = await E.criteresEvaluation(); CRITERES_EVAL = cfgCrit.map(c => c.libelle); POIDS = Object.fromEntries(cfgCrit.map(c => [c.libelle, Number(c.poids) || 1]));
    const [evals, marches] = await Promise.all([D.lister('evaluations', {}, { ordre: 'date', desc: true }), D.lister('marches', {}, { ordre: 'numero' })]);
    const filtre = U.param('marche'); const peut = D.peut('evaluations.ecrire'), valider = D.peut('evaluations.valider');
    const liste = filtre ? evals.filter(e => e.marche_id === filtre) : evals;
    const marcheDe = e => marches.find(m => m.id === e.marche_id) || {};
    const formulaire = e => {
      const etat = e ? JSON.parse(JSON.stringify(e)) : { marche_id: filtre || '', date: D.aujourdhui(), periode: '', criteres: CRITERES_EVAL.map(l => ({ libelle: l, poids: POIDS[l] || 1, note: null, commentaire: '' })), faits: '', appreciation: '' };
      let m;
      const moyenne = () => { const n = etat.criteres.filter(c => c.note != null && c.note !== ''); return n.length ? Calcul.arrondir(Calcul.somme(n.map(c => c.note * (c.poids || 1))) / Calcul.somme(n.map(c => c.poids || 1)), { decimales: 1 }) : null; };
      const f = h('form.formulaire', { onsubmit: U.agir(async ev => { ev.preventDefault();
        if (!etat.marche_id) throw new Error('Choisissez le marché évalué.');
        const mm = marches.find(x => x.id === etat.marche_id);
        const v = { marche_id: etat.marche_id, fournisseur_id: mm.fournisseur_id, date: etat.date, periode: etat.periode, criteres: etat.criteres, note_globale: moyenne(), faits: etat.faits, appreciation: etat.appreciation, statut: 'brouillon', auteur_nom: D.utilisateur.nom };
        if (e) await D.modifier('evaluations', e.id, v, { action: 'Modification d\'une évaluation', libelle: mm.titulaire + ' — marché ' + mm.numero }); else await D.creer('evaluations', v, { action: 'Évaluation d\'un titulaire', libelle: mm.titulaire + ' — marché ' + mm.numero });
        m.fermer(); U.message('Évaluation enregistrée.'); U.aller('/evaluations' + (filtre ? '?marche=' + filtre : '')); }) },
        h('div.champ', h('label', 'Marché évalué *'), h('select', { onchange: ev => { etat.marche_id = ev.target.value; } }, h('option', { value: '' }, '— choisir —'), marches.map(x => h('option', { value: x.id, selected: x.id === etat.marche_id }, x.numero + ' — ' + x.titulaire)))),
        h('div.champ', h('label', 'Date de l\'évaluation'), h('input', { type: 'date', value: etat.date, onchange: ev => { etat.date = ev.target.value; } })),
        h('div.champ.plein', h('label', 'Période évaluée'), h('input', { type: 'text', value: etat.periode, placeholder: 'Par exemple : 1er semestre 2026', oninput: ev => { etat.periode = ev.target.value; } })),
        h('h3.plein', 'Critères (note de 1 à 5)'),
        etat.criteres.map(c => [h('div.champ', h('label', c.libelle + (c.poids && c.poids !== 1 ? ' (coefficient ' + U.nombre(c.poids) + ')' : '')), h('select', { onchange: ev => { c.note = ev.target.value === '' ? null : Number(ev.target.value); } }, h('option', { value: '' }, 'Non évalué'), [1, 2, 3, 4, 5].map(n => h('option', { value: n, selected: c.note === n }, n + ' — ' + ['Très insuffisant', 'Insuffisant', 'Conforme', 'Bon', 'Très bon'][n - 1])))),
          h('div.champ', h('label', 'Constat'), h('input', { type: 'text', value: c.commentaire, oninput: ev => { c.commentaire = ev.target.value; } }))]),
        h('div.champ.plein', h('label', 'Faits vérifiables à l\'appui (obligatoire pour valider)'), h('textarea', { rows: 3, value: etat.faits, placeholder: 'Dates, ordres de service, procès-verbaux, pénalités appliquées, courriers…', oninput: ev => { etat.faits = ev.target.value; } })),
        h('div.champ.plein', h('label', 'Appréciation générale'), h('textarea', { rows: 3, value: etat.appreciation, oninput: ev => { etat.appreciation = ev.target.value; } })),
        h('div.actions.plein', h('button.bouton', { type: 'submit' }, 'Enregistrer')));
      m = U.modale(e ? 'Modifier l\'évaluation' : 'Évaluer un titulaire', f, { large: true });
    };
    if (U.param('nouveau') && peut) setTimeout(() => formulaire(null), 50);
    const detail = e => U.modale('Évaluation — ' + marcheDe(e).titulaire, [U.definition([['Marché', marcheDe(e).numero + ' — ' + marcheDe(e).objet], ['Date', U.date(e.date)], ['Période', e.periode], ['Évaluateur', e.auteur_nom], ['Note globale', U.nombre(e.note_globale, 1) + ' / 5'], ['Faits à l\'appui', e.faits], ['Appréciation', e.appreciation], e.statut === 'validee' ? ['Validation', e.validee_par_nom + ', ' + U.dateHeure(e.validee_le)] : null]),
      U.tableau([{ titre: 'Critère', valeur: c => c.libelle }, { titre: 'Note', num: true, valeur: c => c.note == null ? 'Non évalué' : c.note + ' / 5' }, { titre: 'Constat', valeur: c => c.commentaire }], e.criteres)], { large: true });
    return h('div', U.titrePage('Évaluations des titulaires', filtre ? 'Marché ' + (marches.find(m => m.id === filtre) || {}).numero : 'Critères, historique et export.',
      [U.bouton('Exporter (XLSX)', async () => { U.telechargerBlob(await Docs.xlsx([{ nom: 'Évaluations', lignes: [['Date', 'Marché', 'Titulaire', 'Période', 'Note globale /5'].concat(CRITERES_EVAL).concat(['Faits à l\'appui', 'Appréciation', 'Évaluateur', 'État', 'Validée par'])].concat(liste.map(e => [e.date, marcheDe(e).numero, marcheDe(e).titulaire, e.periode, e.note_globale].concat(CRITERES_EVAL.map(l => (e.criteres.find(c => c.libelle === l) || {}).note)).concat([e.faits, e.appreciation, e.auteur_nom, e.statut, e.validee_par_nom || '']))) }]), 'evaluations-' + D.aujourdhui() + '.xlsx'); await D.journal('Export des évaluations (XLSX)', 'evaluations', null, liste.length + ' évaluations'); }, 'secondaire'),
        peut ? U.bouton('Nouvelle évaluation', () => formulaire(null), 'accent') : null]),
      h('div.note-info', 'L\'évaluation est un outil de pilotage : elle n\'entraîne aucune exclusion automatique et ne peut fonder à elle seule une décision. Elle doit être rattachée à des faits vérifiables.'),
      U.carte(null, U.tableau([{ titre: 'Date', valeur: e => U.date(e.date) }, { titre: 'Titulaire', valeur: e => h('b', marcheDe(e).titulaire) }, { titre: 'Marché', valeur: e => marcheDe(e).numero }, { titre: 'Période', valeur: e => e.periode },
        { titre: 'Note globale', num: true, valeur: e => U.nombre(e.note_globale, 1) + ' / 5' }, { titre: 'Évaluateur', valeur: e => e.auteur_nom }, { titre: 'État', valeur: e => e.statut === 'validee' ? U.badge('Validée', 'ok') : U.badge('Brouillon', 'neutre') },
        { titre: '', classe: 'etroit', valeur: e => [U.bouton('Voir', () => detail(e), 'secondaire.petit'), ' ', peut && e.statut !== 'validee' ? U.bouton('Modifier', () => formulaire(e), 'secondaire.petit') : null, ' ',
          valider && e.statut !== 'validee' ? U.bouton('Valider', async () => { await D.modifier('evaluations', e.id, { statut: 'validee', validee_par_nom: D.utilisateur.nom, validee_le: D.maintenant() }, { action: 'Validation d\'une évaluation', libelle: marcheDe(e).titulaire + ' — marché ' + marcheDe(e).numero }); U.recharger(); }, 'accent.petit') : null] }], liste, { vide: 'Aucune évaluation.' })));
  };
  U.route('/evaluations', E.evaluations);
})();
