/* Analyse des offres : grille (critères, pondérations, formule, arrondi, verrouillage), notation, contrôle des prix, synthèse et classement. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  // Rassemble toutes les données d'un lot et lance les calculs.
  E.donneesLot = async function (lot) {
    const [grilles, criteres, offres, notes, analyses] = await Promise.all([D.lister('grilles', { lot_id: lot.id }), D.lister('criteres', { lot_id: lot.id }, { ordre: 'code' }),
      D.lister('offres', { lot_id: lot.id }, { ordre: 'candidat' }), D.lister('notes', { lot_id: lot.id }), D.lister('analyses', { lot_id: lot.id })]);
    // Lignes de prix limitées aux offres du lot (et non toute la table).
    const lignes = offres.length ? await D.lister('lignes_prix', { offre_id: offres.map(o => o.id) }) : [];
    const grille = grilles[0] || { statut: 'brouillon', formule_prix: 'proportionnelle', arrondi_decimales: 2, arrondi_mode: 'proche', seuil_alerte_prix: 25, version: 0, absente: true };
    const verrouillee = grille.statut === 'verrouillee';
    const analyse = analyses[0] || { statut: verrouillee ? 'en_cours' : 'preparation', absente: true };
    if (!verrouillee) analyse.statut = 'preparation';
    for (const o of offres) { const l = lignes.filter(x => x.offre_id === o.id); o.total_lignes = l.length ? Calcul.arrondir(Calcul.somme(l.map(x => x.quantite * x.prix_unitaire)), { decimales: 2 }) : null; }
    const controle = Calcul.controleGrille(criteres);
    const calcul = Calcul.calculLot(criteres, offres, notes, grille);
    const indices = Calcul.indicesPrix(offres, Number(grille.seuil_alerte_prix) || 25, Number(lot.montant_estime) || 0);
    return { lot, grille, verrouillee, criteres, offres, notes, analyse, controle, calcul, indices };
  };
  const ordonner = criteres => { const r = []; const rec = (pid, niv) => Calcul.enfants(criteres, pid).forEach(c => { r.push(Object.assign({ niveau: niv }, c)); rec(c.id, niv + 1); }); rec(null, 1); return r; };
  E.ordonnerCriteres = ordonner;

  E.ongletAnalyse = async function (id) {
    const c = await E.chargerConsultation(id);
    const lots = await D.lister('lots', { consultation_id: id }, { ordre: 'numero' });
    if (!lots.length) return h('div', E.enteteConsultation(c, 'analyse'), U.carte(null, U.vide('Créez d\'abord un lot dans la fiche de la consultation.')));
    const tousLots = lots.length; lots.splice(0, lots.length, ...lots.filter(l => D.lotAutorise(id, l.id)));
    if (!lots.length) return h('div', E.enteteConsultation(c, 'analyse'), U.carte(null, h('div.note-info.alerte', 'Votre habilitation sur ce dossier ne couvre aucun des ' + tousLots + ' lots.')));
    const lot = lots.find(l => l.id === U.param('lot')) || lots[0];
    const vue = U.param('vue') || 'grille';
    const d = await E.donneesLot(lot);
    const lien = (v, extra) => '/consultation/' + id + '/analyse?lot=' + lot.id + '&vue=' + v + (extra || '');
    const etapes = [['preparation', 'Grille en préparation'], ['en_cours', 'Grille verrouillée — analyse en cours'], ['en_relecture', 'Relecture et validation'], ['validee', 'Analyse validée']];
    const rang = etapes.findIndex(e => e[0] === d.analyse.statut);
    const corps = await ({ grille: vueGrille, notation: vueNotation, prix: vuePrix, synthese: vueSynthese }[vue] || vueGrille)(c, d, lien);
    return h('div', E.enteteConsultation(c, 'analyse'),
      (lots.length > 1 || lots.length < tousLots) ? h('div.actions', { style: { marginBottom: '12px' } }, h('b', 'Lot analysé :'), lots.length < tousLots ? U.badge('Habilitation limitée : ' + lots.length + ' lot(s) sur ' + tousLots, 'info') : null, lots.map(l => h('button.bouton' + (l.id === lot.id ? '' : '.secondaire') + '.petit', { type: 'button', onclick: () => U.aller('/consultation/' + id + '/analyse?lot=' + l.id + '&vue=' + vue) }, 'Lot ' + l.numero + ' — ' + l.intitule))) : null,
      h('div.etapes', etapes.map((e, i) => h('span' + (i === rang ? '.courant' : i < rang ? '.fait' : ''), e[1]))),
      h('div.note-info', 'Outil d\'aide à l\'analyse : aucune admission, élimination, note ni classement n\'est produit sans la validation d\'un agent habilité.'),
      U.onglets([['grille', '1. Grille d\'analyse'], ['notation', '2. Analyse par critère'], ['prix', '3. Analyse financière'], ['synthese', '4. Synthèse et classement']], vue, v => U.aller(lien(v))), corps);
  };
  U.route('/consultation/:id/analyse', E.ongletAnalyse);

  /* ================= 1. GRILLE ================= */
  async function assurerGrille(d) {
    if (!d.grille.absente) return d.grille;
    D.exiger('analyse.parametrer');
    const g = await D.creer('grilles', { lot_id: d.lot.id, consultation_id: d.lot.consultation_id, statut: 'brouillon', formule_prix: 'proportionnelle', arrondi_decimales: 2, arrondi_mode: 'proche', seuil_alerte_prix: 25, version: 0 }, false);
    d.grille = g; return g;
  }
  async function vueGrille(c, d, lien) {
    const peut = D.peut('analyse.parametrer') && !d.verrouillee, verrou = D.peut('analyse.verrouiller');
    const tr = (action, detail) => ({ action, libelle: c.reference + ' — lot ' + d.lot.numero, consultation_id: c.id, detail });
    const [versions, modeles] = await Promise.all([D.lister('grille_versions', { lot_id: d.lot.id }, { ordre: 'version', desc: true }), D.lister('modeles_grille', {}, { ordre: 'nom' })]);
    const liste = ordonner(d.criteres);
    const champsCritere = cr => [
      { nom: 'parent_id', libelle: 'Rattaché à', type: 'choix', options: d.criteres.filter(x => !x.parent_id && x.type !== 'prix' && (!cr || x.id !== cr.id)).map(x => [x.id, x.code + ' — ' + x.libelle]), aide: 'Laissez vide pour un critère principal ; choisissez un critère pour créer un sous-critère.' },
      { nom: 'code', libelle: 'Numéro', requis: true, aide: 'Par exemple 1, 2, 2.1, 2.2' },
      { nom: 'libelle', libelle: 'Libellé', requis: true, large: true },
      { nom: 'type', libelle: 'Nature', type: 'choix', vide: false, options: [['qualitatif', 'Critère noté par les analystes'], ['prix', 'Critère de prix (note calculée par la formule)']] },
      { nom: 'ponderation', libelle: 'Pondération (points)', type: 'nombre', requis: true },
      { nom: 'bareme', libelle: 'Barème de notation (note maximale saisie)', type: 'nombre', defaut: 10, aide: 'Sans objet pour le critère de prix et pour un critère découpé en sous-critères.' },
      { nom: 'description', libelle: 'Éléments d\'appréciation prévus au règlement de la consultation', type: 'long' }];
    const snapshot = () => ({ formule_prix: d.grille.formule_prix, arrondi_decimales: d.grille.arrondi_decimales, arrondi_mode: d.grille.arrondi_mode, seuil_alerte_prix: d.grille.seuil_alerte_prix,
      criteres: d.criteres.map(x => ({ id: x.id, parent_id: x.parent_id || null, code: x.code, libelle: x.libelle, type: x.type, ponderation: x.ponderation, bareme: x.bareme, description: x.description || '' })) });
    const verrouiller = async () => {
      if (!d.controle.coherent) throw new Error('La grille n\'est pas cohérente : ' + d.controle.erreurs[0]);
      if (!(await U.confirmer('Verrouiller la grille', 'Après verrouillage, les critères, les pondérations, la formule de prix et la règle d\'arrondi ne pourront plus être modifiés. La saisie des notes devient possible. Confirmer ?', 'Verrouiller'))) return;
      const v = (d.grille.version || 0) + 1;
      // Écriture métier d'abord, historique ensuite : un échec ne laisse pas de version orpheline.
      await D.modifier('grilles', d.grille.id, { statut: 'verrouillee', version: v, verrouillee_par_nom: D.utilisateur.nom, verrouillee_le: D.maintenant() }, tr('Verrouillage de la grille (version ' + v + ')'));
      await D.creer('grille_versions', { lot_id: d.lot.id, consultation_id: c.id, version: v, date: D.maintenant(), auteur_nom: D.utilisateur.nom, motif: 'Verrouillage après validation', contenu: snapshot() }, false);
      U.message('Grille verrouillée.'); U.recharger();
    };
    const deverrouiller = () => {
      if (d.analyse.statut === 'validee') throw new Error('L\'analyse est validée : la grille ne peut plus être déverrouillée.');
      U.editer('Déverrouiller la grille', [{ nom: 'motif', libelle: 'Motif du déverrouillage (obligatoire, conservé dans l\'historique)', type: 'long', requis: true }], {}, async v => {
        await D.modifier('grilles', d.grille.id, { statut: 'brouillon' }, tr('Déverrouillage de la grille', { motif: v.motif }));
        await D.creer('grille_versions', { lot_id: d.lot.id, consultation_id: c.id, version: d.grille.version, date: D.maintenant(), auteur_nom: D.utilisateur.nom, motif: 'Déverrouillage : ' + v.motif, contenu: snapshot() }, false);
      }, { libelle: 'Déverrouiller' });
    };
    const appliquerModele = () => U.editer('Appliquer un modèle de grille', [{ nom: 'modele', libelle: 'Modèle', type: 'choix', requis: true, options: modeles.filter(m => m.actif !== false).map(m => [m.id, m.nom + ' (version ' + m.version + ', en vigueur depuis le ' + U.date(m.date_effet) + ')']) }], {}, async v => {
      const m = modeles.find(x => x.id === v.modele); const g = await assurerGrille(d);
      for (const x of d.criteres.filter(x => x.parent_id)) await D.supprimer('criteres', x.id, false);
      for (const x of d.criteres.filter(x => !x.parent_id)) await D.supprimer('criteres', x.id, false);
      const corr = {};
      for (const x of m.contenu.criteres.filter(x => !x.parent_id).concat(m.contenu.criteres.filter(x => x.parent_id))) { const n = await D.creer('criteres', { lot_id: d.lot.id, consultation_id: c.id, parent_id: x.parent_id ? corr[x.parent_id] : null, code: x.code, libelle: x.libelle, type: x.type, ponderation: x.ponderation, bareme: x.bareme, description: x.description || '' }, false); corr[x.id] = n.id; }
      await D.modifier('grilles', g.id, { formule_prix: m.contenu.formule_prix, arrondi_decimales: m.contenu.arrondi_decimales, arrondi_mode: m.contenu.arrondi_mode, seuil_alerte_prix: m.contenu.seuil_alerte_prix, modele_id: m.id }, tr('Application du modèle de grille « ' + m.nom + ' » (version ' + m.version + ')'));
    }, { libelle: 'Appliquer' });
    const enregistrerModele = () => U.editer('Enregistrer comme modèle réutilisable', [{ nom: 'nom', libelle: 'Nom du modèle', requis: true, large: true }, { nom: 'date_effet', libelle: 'Date d\'effet', type: 'date', defaut: D.aujourdhui(), requis: true }], {}, async v => {
      D.exiger('modeles.ecrire'); const prec = modeles.filter(m => m.nom === v.nom);
      for (const p of prec) await D.modifier('modeles_grille', p.id, { actif: false }, false);
      await D.creer('modeles_grille', { nom: v.nom, version: prec.length + 1, date_effet: v.date_effet, auteur_nom: D.utilisateur.nom, actif: true, contenu: snapshot() }, { action: 'Enregistrement d\'un modèle de grille', libelle: v.nom + ' — version ' + (prec.length + 1) });
    });
    return h('div',
      d.verrouillee ? h('div.note-info.ok', h('b', '🔒 Grille verrouillée'), ' — version ' + d.grille.version + ', par ' + d.grille.verrouillee_par_nom + ' le ' + U.dateHeure(d.grille.verrouillee_le) + '. Critères, pondérations et méthode de notation ne peuvent plus être modifiés.')
        : h('div.note-info' + (d.controle.coherent ? '.ok' : '.alerte'), h('b', 'Contrôle de cohérence : '), d.controle.coherent ? 'la grille est cohérente (total des pondérations : 100). Elle peut être verrouillée par un utilisateur habilité.' : h('ul', { style: { margin: '4px 0 0 18px', padding: 0 } }, d.controle.erreurs.map(e => h('li', e)))),
      U.carte('Critères, sous-critères et pondérations', [U.tableau([
        { titre: 'N°', classe: 'etroit', valeur: x => x.code }, { titre: 'Libellé', valeur: x => [x.libelle, x.description ? h('div.aide', x.description) : null] },
        { titre: 'Nature', valeur: x => x.type === 'prix' ? U.badge('Prix — calculé', 'info') : d.criteres.some(y => y.parent_id === x.id) ? 'Somme des sous-critères' : 'Noté sur ' + U.nombre(x.bareme) },
        { titre: 'Pondération', num: true, valeur: x => U.nombre(x.ponderation) + ' pts' },
        { titre: '', classe: 'etroit', valeur: x => peut ? [U.bouton('Modifier', () => U.editer('Modifier le critère', champsCritere(x), x, v => D.modifier('criteres', x.id, v, tr('Modification d\'un critère', { critere: v.code + ' ' + v.libelle }))), 'secondaire.petit'), ' ',
          U.bouton('Supprimer', async () => { if (d.criteres.some(y => y.parent_id === x.id)) throw new Error('Supprimez d\'abord les sous-critères.'); await D.supprimer('criteres', x.id, tr('Suppression d\'un critère', { critere: x.code + ' ' + x.libelle })); U.recharger(); }, 'danger.petit')] : null }],
        liste, { classeLigne: x => x.niveau === 1 ? 'critere-n1' : 'critere-n2', vide: 'Aucun critère. Ajoutez les critères du règlement de la consultation ou appliquez un modèle.' }),
        h('p', { style: { textAlign: 'right', fontWeight: 700, marginTop: '8px' } }, 'Total des pondérations : ' + U.nombre(d.controle.total) + ' / 100 ', U.badge(d.controle.coherent ? 'Cohérent' : 'À corriger', d.controle.coherent ? 'ok' : 'danger'))],
        [peut ? h('label.bouton.secondaire', 'Lire les critères d\'un règlement', h('input', { type: 'file', hidden: true, id: 'fichier-rc', accept: '.pdf,.docx,.odt,.txt', onchange: U.agir(async e => E.importerCriteresRc(e.target.files[0], d, c)) })) : null,
         peut ? U.bouton('Ajouter un critère', async () => { await assurerGrille(d); U.editer('Nouveau critère', champsCritere(), { type: 'qualitatif', bareme: 10 }, v => D.creer('criteres', Object.assign({ lot_id: d.lot.id, consultation_id: c.id }, v), tr('Ajout d\'un critère', { critere: v.code + ' ' + v.libelle }))); }, 'accent') : null,
          peut && modeles.length ? U.bouton('Appliquer un modèle', appliquerModele, 'secondaire') : null,
          D.peut('modeles.ecrire') && d.criteres.length ? U.bouton('Enregistrer comme modèle', enregistrerModele, 'secondaire') : null]),
      h('div.grille2',
        U.carte('Méthode de notation', [U.definition([['Formule de prix', [h('b', Calcul.FORMULES[d.grille.formule_prix].libelle), h('div.aide', Calcul.FORMULES[d.grille.formule_prix].expression)]],
          ['Règle d\'arrondi', d.grille.arrondi_decimales + ' décimale(s), ' + { proche: 'au plus proche', inferieur: 'à l\'inférieur', superieur: 'au supérieur' }[d.grille.arrondi_mode]],
          ['Seuil d\'alerte sur les prix', 'Signalement si une offre est inférieure de ' + U.nombre(d.grille.seuil_alerte_prix) + ' % à la moyenne des autres offres ou à l\'estimation'],
          ['Notes qualitatives', 'Points = note validée ÷ barème × pondération du critère'], ['Plusieurs analystes', d.grille.consolidation === 'moyenne' ? 'Moyenne automatique des contributions validées' : 'Le valideur retient une contribution par critère']]),
          h('p.aide', 'La formule n\'est jamais modifiée automatiquement. Le seuil déclenche un simple signalement, sans qualification ni rejet.')],
          peut ? [U.bouton('Modifier la méthode', async () => { const g = await assurerGrille(d); U.editer('Méthode de notation', [
            { nom: 'formule_prix', libelle: 'Formule de notation du prix', type: 'choix', vide: false, large: true, options: Object.entries(Calcul.FORMULES).map(x => [x[0], x[1].libelle + ' — ' + x[1].expression]) },
            { nom: 'arrondi_decimales', libelle: 'Nombre de décimales', type: 'choix', vide: false, options: [[0, '0'], [1, '1'], [2, '2'], [3, '3']] },
            { nom: 'arrondi_mode', libelle: 'Sens de l\'arrondi', type: 'choix', vide: false, options: [['proche', 'Au plus proche'], ['inferieur', 'À l\'inférieur'], ['superieur', 'Au supérieur']] },
            { nom: 'seuil_alerte_prix', libelle: 'Seuil d\'alerte sur les prix (%)', type: 'nombre', requis: true }, { nom: 'consolidation', libelle: 'Plusieurs analystes sur un même critère', type: 'choix', vide: false, options: [['retenue', 'Le valideur retient une contribution'], ['moyenne', 'Moyenne automatique des contributions validées']] }], g, v => D.modifier('grilles', g.id, Object.assign(v, { arrondi_decimales: Number(v.arrondi_decimales) }), tr('Modification de la méthode de notation', v))); }, 'secondaire')] : null),
        U.carte('Verrouillage et historique des versions', [
          U.tableau([{ titre: 'Version', classe: 'etroit', valeur: v => v.version }, { titre: 'Date et heure', valeur: v => U.dateHeure(v.date) }, { titre: 'Auteur', valeur: v => v.auteur_nom }, { titre: 'Événement', valeur: v => v.motif },
            { titre: '', classe: 'etroit', valeur: v => U.bouton('Voir', () => U.modale('Grille — version ' + v.version + ' (' + U.dateHeure(v.date) + ')', [U.definition([['Formule de prix', Calcul.FORMULES[v.contenu.formule_prix].libelle], ['Arrondi', v.contenu.arrondi_decimales + ' décimale(s), ' + v.contenu.arrondi_mode]]),
              U.tableau([{ titre: 'N°', valeur: x => x.code }, { titre: 'Libellé', valeur: x => x.libelle }, { titre: 'Pondération', num: true, valeur: x => U.nombre(x.ponderation) }, { titre: 'Barème', num: true, valeur: x => x.type === 'prix' ? 'prix' : U.nombre(x.bareme) }], ordonner(v.contenu.criteres))], { large: true }), 'secondaire.petit') }],
            versions, { vide: 'La grille n\'a pas encore été verrouillée.' })],
          verrou ? [d.verrouillee ? U.bouton('Déverrouiller (motif obligatoire)', deverrouiller, 'danger') : U.bouton('🔒 Verrouiller la grille', verrouiller, 'accent', { disabled: d.grille.absente || !d.criteres.length })] : [h('span.aide', 'Le verrouillage revient à un utilisateur habilité (valideur).')])));
  }

  /* ================= 2. NOTATION ================= */
  async function vueNotation(c, d, lien) {
    if (!d.verrouillee) return U.carte(null, h('div.note-info.alerte', 'La grille doit être verrouillée par un utilisateur habilité avant toute saisie d\'appréciation ou de note.'));
    if (!d.offres.length) return U.carte(null, U.vide('Aucune offre déposée pour ce lot. Importez les plis dans l\'onglet « Candidatures et offres ».'));
    const mode = U.param('mode') || 'offre';
    const feuilles = ordonner(d.criteres).filter(x => x.type !== 'prix' && !d.criteres.some(y => y.parent_id === x.id));
    const pieces = await D.lister('pieces', { lot_id: d.lot.id });
    const fige = d.analyse.statut === 'validee';
    const saisir = D.peut('analyse.saisir') && !fige, valider = D.peut('analyse.valider') && !fige;
    const tr = (action, o, cr, detail) => ({ action, libelle: o.candidat + ' — critère ' + cr.code + ' (' + c.reference + ', lot ' + d.lot.numero + ')', consultation_id: c.id, detail });

    const blocContribution = (n, o, cr) => {
      const p = n.piece_id ? pieces.find(x => x.id === n.piece_id) : null;
      return h('div.contribution', h('header', h('span', h('b', n.analyste_nom), ' — note proposée : ', h('b', n.note == null ? '—' : U.nombre(n.note) + ' / ' + U.nombre(cr.bareme))), E.badge('note', n.statut)),
        n.appreciation ? h('p', h('b', 'Appréciation : '), n.appreciation) : null, n.points_forts ? h('p', h('b', 'Points forts : '), n.points_forts) : null, n.points_faibles ? h('p', h('b', 'Points faibles : '), n.points_faibles) : null,
        n.reserves ? h('p', h('b', 'Réserves et points de vigilance : '), n.reserves) : null,
        n.extrait ? h('div.extrait', '« ' + n.extrait + ' »', h('small', 'Source : ', p ? h('button.lien', { type: 'button', onclick: () => E.lirePiece(p, { page: n.page, recherche: n.extrait.slice(0, 40) }) }, p.nom_fichier + (n.page ? ', page ' + n.page : '')) : 'pièce introuvable')) : null,
        n.statut === 'validee' ? h('p.aide', 'Validée par ' + n.validee_par_nom + ' le ' + U.dateHeure(n.validee_le)) : null,
        n.commentaire_valideur ? h('p.aide', 'Commentaire du valideur : ' + n.commentaire_valideur) : null,
        valider && n.analyste_id !== D.utilisateur.id ? h('div.actions', { style: { marginTop: '6px' } },
          n.statut === 'proposee' ? U.bouton('Valider cette note', async () => { await D.modifier('notes', n.id, { statut: 'validee', validee_par_nom: D.utilisateur.nom, validee_par: D.utilisateur.id, validee_le: D.maintenant() }, tr('Validation d\'une note', o, cr, { note: n.note, analyste: n.analyste_nom })); U.message('Note validée.'); U.recharger(); }, 'accent.petit') : null,
          n.statut === 'proposee' || n.statut === 'validee' ? U.bouton(n.statut === 'validee' ? 'Rouvrir' : 'Renvoyer à l\'analyste', () => U.editer('Renvoyer la contribution', [{ nom: 'commentaire_valideur', libelle: 'Commentaire pour l\'analyste', type: 'long', requis: true }], {}, v => D.modifier('notes', n.id, Object.assign(v, { statut: 'a_revoir', validee_par_nom: null, validee_par: null, validee_le: null }), tr(n.statut === 'validee' ? 'Réouverture d\'une note validée' : 'Renvoi d\'une note à l\'analyste', o, cr, v))), 'secondaire.petit') : null) : null);
    };
    const formulaireNote = (o, cr, mienne) => {
      const etat = Object.assign({ note: '', appreciation: '', points_forts: '', points_faibles: '', reserves: '', piece_id: null, page: null, extrait: '' }, mienne || {});
      const zoneExtrait = h('div');
      const dessinerExtrait = () => { const p = pieces.find(x => x.id === etat.piece_id); zoneExtrait.replaceChildren(etat.extrait ? h('div.extrait', '« ' + etat.extrait + ' »', h('small', 'Source : ' + (p ? p.nom_fichier : '') + (etat.page ? ', page ' + etat.page : ''), ' — ', h('button.lien', { type: 'button', onclick: () => { etat.extrait = ''; etat.piece_id = null; etat.page = null; dessinerExtrait(); } }, 'retirer'))) : h('p.aide', 'Aucun extrait associé. La justification peut aussi être saisie dans l\'appréciation.')); };
      dessinerExtrait();
      const champ = (cle, libelle, lignes, idc = 'n-' + cle + '-' + Math.random().toString(36).slice(2, 8)) => h('div.champ' + (lignes ? '.plein' : ''), h('label', { for: idc }, libelle), lignes ? h('textarea', { id: idc, rows: lignes, value: etat[cle] || '', 'data-champ': cle, oninput: e => { etat[cle] = e.target.value; } }) : h('input', { id: idc, type: 'number', step: 'any', min: 0, max: cr.bareme, value: etat[cle] == null ? '' : etat[cle], 'data-champ': cle, oninput: e => { etat[cle] = e.target.value === '' ? null : Number(e.target.value); } }));
      const mesPieces = pieces.filter(p => p.offre_id === o.id);
      const choisirExtrait = () => {
        if (!mesPieces.length) throw new Error('Aucune pièce déposée pour cette offre.');
        const ouvrir = p => E.lirePiece(p, { recherche: (cr.libelle.split(/[ ,']/).filter(m => m.length > 5)[0] || ''), surExtrait: x => { etat.piece_id = x.piece.id; etat.page = x.page; etat.extrait = x.extrait; dessinerExtrait(); } });
        if (mesPieces.length === 1) return ouvrir(mesPieces[0]);
        const m = U.modale('Choisir la pièce source', h('div', mesPieces.map(p => h('p', h('button.lien', { type: 'button', onclick: () => { m.fermer(); ouvrir(p); } }, p.type_piece + ' — ' + p.nom_fichier)))));
      };
      const enregistrer = async statut => {
        if (statut === 'proposee') { if (etat.note === null || etat.note === '' || isNaN(Number(etat.note))) throw new Error('Saisissez une note avant de la proposer à la validation.'); if (Number(etat.note) < 0 || Number(etat.note) > Number(cr.bareme)) throw new Error('La note doit être comprise entre 0 et ' + cr.bareme + '.'); if (!String(etat.appreciation).trim() && !etat.extrait) throw new Error('Justifiez la note : saisissez une appréciation ou associez un extrait de document.'); }
        const v = { note: etat.note === '' ? null : etat.note, appreciation: etat.appreciation, points_forts: etat.points_forts, points_faibles: etat.points_faibles, reserves: etat.reserves, piece_id: etat.piece_id, page: etat.page, extrait: etat.extrait, statut, modifie_le: D.maintenant() };
        let n;
        if (mienne) n = await D.modifier('notes', mienne.id, v, tr(statut === 'proposee' ? 'Note proposée à la validation' : 'Enregistrement d\'une appréciation (brouillon)', o, cr, { note: v.note }));
        else n = await D.creer('notes', Object.assign({ lot_id: d.lot.id, consultation_id: c.id, offre_id: o.id, critere_id: cr.id, analyste_id: D.utilisateur.id, analyste_nom: D.utilisateur.nom }, v), tr(statut === 'proposee' ? 'Note proposée à la validation' : 'Enregistrement d\'une appréciation (brouillon)', o, cr, { note: v.note }));
        await D.creer('notes_historique', { note_id: n.id, consultation_id: c.id, date: D.maintenant(), auteur_nom: D.utilisateur.nom, contenu: v }, false);
        U.message(statut === 'proposee' ? 'Note proposée à la validation.' : 'Brouillon enregistré.'); U.recharger();
      };
      return h('div.saisie-note', { 'data-critere': cr.code },
        champ('note', 'Note sur ' + U.nombre(cr.bareme)), h('div.champ', h('label', 'Extrait justificatif'), U.bouton('Associer un extrait d\'un document', choisirExtrait, 'secondaire.petit'), zoneExtrait),
        champ('appreciation', 'Appréciation', 3), champ('points_forts', 'Points forts', 2), champ('points_faibles', 'Points faibles', 2), champ('reserves', 'Réserves et points de vigilance', 2),
        h('div.actions.plein', U.bouton('Enregistrer le brouillon', () => enregistrer('brouillon'), 'secondaire'), U.bouton('Proposer à la validation', () => enregistrer('proposee'), 'accent')));
    };
    const blocCritere = (o, cr) => {
      const contributions = d.notes.filter(n => n.offre_id === o.id && n.critere_id === cr.id);
      const mienne = contributions.find(n => n.analyste_id === D.utilisateur.id);
      const validee = contributions.find(n => n.statut === 'validee');
      const parent = cr.parent_id ? d.criteres.find(x => x.id === cr.parent_id) : null;
      return h('div.bloc-critere', h('header', h('h3', (parent ? parent.code + ' ' + parent.libelle + ' › ' : '') + cr.code + ' — ' + cr.libelle), h('span', U.badge(U.nombre(cr.ponderation) + ' pts', 'neutre'), ' ', validee ? U.badge('Note validée : ' + U.nombre(validee.note) + ' / ' + U.nombre(cr.bareme), 'ok') : U.badge('Aucune note validée', 'alerte'))),
        cr.description ? h('p.aide', 'Éléments d\'appréciation prévus : ' + cr.description) : null,
        contributions.filter(n => !(saisir && n === mienne && ['brouillon', 'a_revoir'].includes(n.statut))).map(n => blocContribution(n, o, cr)),
        saisir && (!mienne || ['brouillon', 'a_revoir'].includes(mienne.statut)) ? [mienne && mienne.commentaire_valideur ? h('div.note-info.alerte', 'À revoir — commentaire du valideur : ' + mienne.commentaire_valideur) : null, formulaireNote(o, cr, mienne)] : null,
        saisir && mienne && mienne.statut === 'proposee' ? h('div.actions', { style: { marginTop: '6px' } }, U.bouton('Reprendre ma contribution', async () => { await D.modifier('notes', mienne.id, { statut: 'brouillon' }, tr('Reprise d\'une contribution par son auteur', o, cr)); U.recharger(); }, 'secondaire.petit')) : null,
        !contributions.length && !saisir ? U.vide('Aucune contribution saisie.') : null);
    };
    let contenu;
    if (mode === 'critere') {
      const cr = feuilles.find(x => x.id === U.param('critere')) || feuilles[0];
      contenu = [h('div.actions', { style: { marginBottom: '12px' } }, h('label', { for: 'choix-critere' }, h('b', 'Critère comparé : ')), h('select.saisie', { id: 'choix-critere', style: { maxWidth: '520px' }, onchange: e => U.aller(lien('notation', '&mode=critere&critere=' + e.target.value)) }, feuilles.map(x => h('option', { value: x.id, selected: x.id === cr.id }, x.code + ' — ' + x.libelle)))),
        h('p.aide', 'Comparaison transversale des réponses de tous les candidats sur le même critère, sans ajout de critère non prévu à la consultation.'),
        d.offres.map(o => h('div', h('h3', { style: { margin: '14px 0 6px' } }, o.candidat, o.ecartee ? [' ', U.badge('Offre écartée par décision', 'danger')] : null), blocCritere(o, cr)))];
    } else {
      const o = d.offres.find(x => x.id === U.param('offre')) || d.offres[0];
      const fait = d.offres.map(x => feuilles.filter(cr => d.notes.some(n => n.offre_id === x.id && n.critere_id === cr.id && n.statut === 'validee')).length);
      contenu = [h('div.actions', { style: { marginBottom: '12px' } }, h('b', 'Offre analysée :'), d.offres.map((x, i) => h('button.bouton' + (x.id === o.id ? '' : '.secondaire') + '.petit', { type: 'button', onclick: () => U.aller(lien('notation', '&offre=' + x.id)) }, x.candidat + ' (' + fait[i] + '/' + feuilles.length + ' validées)'))),
        feuilles.map(cr => blocCritere(o, cr))];
    }
    return h('div', U.onglets([['offre', 'Par offre'], ['critere', 'Par critère (comparaison)']], mode, m => U.aller(lien('notation', '&mode=' + m))), contenu);
  }

  /* ================= 3. PRIX ================= */
  async function vuePrix(c, d) {
    const crPrix = d.criteres.find(x => x.type === 'prix');
    return h('div',
      U.carte('Comparaison des offres financières', [
        h('p.aide', 'Estimation de l\'acheteur pour ce lot : ' + U.euros(d.lot.montant_estime) + ' HT. Moyenne des offres : ' + U.euros(d.indices[0] && d.indices[0].moyenne) + ' HT.'),
        U.tableau([{ titre: 'Candidat', valeur: i => { const o = d.offres.find(x => x.id === i.offre_id); return [h('a', { href: '#/consultation/' + c.id + '/offre/' + o.id }, o.candidat), o.ecartee ? [' ', U.badge('Écartée par décision', 'danger')] : null]; } },
          { titre: 'Montant déclaré HT', num: true, valeur: i => U.euros(i.montant) },
          { titre: 'Total des lignes', num: true, valeur: i => U.euros((d.offres.find(x => x.id === i.offre_id) || {}).total_lignes) },
          { titre: 'Écart / moyenne des autres', num: true, valeur: i => i.ecartMoyenneAutres == null ? '—' : (i.ecartMoyenneAutres > 0 ? '+' : '') + U.nombre(i.ecartMoyenneAutres, 1) + ' %' },
          { titre: 'Écart / estimation', num: true, valeur: i => i.ecartEstimation == null ? '—' : (i.ecartEstimation > 0 ? '+' : '') + U.nombre(i.ecartEstimation, 1) + ' %' },
          { titre: 'Montant validé', valeur: i => (d.offres.find(x => x.id === i.offre_id) || {}).montant_valide ? U.badge('Validé', 'ok') : U.badge('À valider', 'alerte') },
          { titre: crPrix ? 'Note de prix / ' + U.nombre(crPrix.ponderation) : 'Note de prix', num: true, valeur: i => { if (!crPrix) return '—'; const l = d.calcul.lignes.find(x => x.offre_id === i.offre_id).detail[crPrix.id]; return l.points == null ? h('span.aide', l.motif) : h('b', U.nombre(l.points, d.grille.arrondi_decimales)); } }], d.indices, { vide: 'Aucune offre.' })]),
      U.carte('Signalements sur les prix — à vérifier', [h('div.note-info.alerte', 'Ces signalements sont des indices. Ils ne qualifient pas une offre d\'anormalement basse et n\'entraînent aucun rejet : la demande de justification et la décision reviennent à l\'acheteur.'),
        d.indices.some(i => i.signalements.length) ? d.indices.filter(i => i.signalements.length).map(i => h('div.bloc-critere', h('header', h('h3', i.candidat), h('a.bouton.secondaire.petit', { href: '#/consultation/' + c.id + '/offre/' + i.offre_id }, 'Ouvrir l\'offre — demander une justification')), h('ul', { style: { margin: '0 0 0 18px', padding: 0 } }, i.signalements.map(s => h('li', s.texte))))) : U.vide('Aucun écart au-delà du seuil paramétré, aucune incohérence de total, aucun montant manquant.')]),
      crPrix ? U.carte('Formule appliquée', U.definition([['Critère', crPrix.code + ' — ' + crPrix.libelle + ' (' + U.nombre(crPrix.ponderation) + ' points)'], ['Formule', Calcul.FORMULES[d.grille.formule_prix].expression],
        ['Arrondi', d.grille.arrondi_decimales + ' décimale(s), ' + { proche: 'au plus proche', inferieur: 'à l\'inférieur', superieur: 'au supérieur' }[d.grille.arrondi_mode]], ['Offres prises en compte', 'Uniquement les offres non écartées dont le montant a été validé par un agent habilité']])) : h('div.note-info.alerte', 'La grille ne comporte pas de critère de prix.'));
  }

  /* ================= 4. SYNTHÈSE ================= */
  E.tableauAnalyse = function (d) { // {entetes, lignes} — sert à l'écran, au rapport et aux exports
    const fs = ordonner(d.criteres).filter(x => !d.criteres.some(y => y.parent_id === x.id));
    const dec = d.grille.arrondi_decimales;
    return { feuilles: fs, entetes: ['Candidat'].concat(fs.map(x => x.code + ' ' + x.libelle + ' (/' + U.nombre(x.ponderation) + ')')).concat(['Total /100', 'Rang provisoire']),
      lignes: d.calcul.lignes.slice().sort((a, b) => (a.rang || 99) - (b.rang || 99)).map(l => [l.candidat + (l.ecartee ? ' (offre écartée par décision)' : '')].concat(fs.map(x => l.detail[x.id].points == null ? '—' : U.nombre(l.detail[x.id].points, dec))).concat([l.total == null ? 'Incomplet' : U.nombre(l.total, dec), l.rang || '—'])) };
  };
  E.detailCalculs = function (d) {
    const fs = ordonner(d.criteres).filter(x => !d.criteres.some(y => y.parent_id === x.id)); const r = [];
    const prixValides = d.offres.filter(o => !o.ecartee && o.montant_valide).map(o => Number(o.montant_ht));
    for (const l of d.calcul.lignes) for (const x of fs) { const det = l.detail[x.id]; const n = d.notes.find(n => n.offre_id === l.offre_id && n.critere_id === x.id && n.statut === 'validee');
      r.push([l.candidat, x.code + ' ' + x.libelle, x.type === 'prix' ? 'Montant validé : ' + U.euros(det.brute) : (det.brute == null ? '—' : U.nombre(det.brute) + ' / ' + U.nombre(x.bareme)),
        x.type === 'prix' ? (det.points == null ? det.motif : Calcul.FORMULES[d.grille.formule_prix].libelle + ' ; prix le plus bas validé : ' + U.euros(Math.min.apply(null, prixValides))) : (det.points == null ? det.motif : U.nombre(det.brute) + ' ÷ ' + U.nombre(x.bareme) + ' × ' + U.nombre(x.ponderation)),
        det.points == null ? '—' : U.nombre(det.points, d.grille.arrondi_decimales), x.type === 'prix' ? 'Montant validé par ' + ((d.offres.find(o => o.id === l.offre_id) || {}).montant_valide_par_nom || '—') : (n ? 'Saisie : ' + n.analyste_nom + ' · validée : ' + n.validee_par_nom + ', ' + U.dateHeure(n.validee_le) : '—')]); }
    return { entetes: ['Candidat', 'Critère', 'Valeur validée', 'Calcul', 'Points', 'Intervention humaine'], lignes: r };
  };
  E.importerCriteresRc = async function (fichier, d, c) {
    const x = await Docs.extraire(fichier); const lus = Calcul.lireCriteres((x.pages || []).join('\n'));
    if (!lus.length) throw new Error('Aucun critère pondéré reconnu dans « ' + fichier.name + ' ». Saisissez-les à la main.');
    const ctl = Calcul.controleGrille(lus.map(k => ({ id: k.code, parent_id: k.parent, code: k.code, libelle: k.libelle, type: k.type, ponderation: k.ponderation, bareme: 10 })));
    const m = U.modale('Critères lus dans « ' + fichier.name + ' »', [h('p.aide', 'Relisez avant de reprendre : la lecture repère les lignes « critère — points ». Rien n\'est enregistré tant que vous ne confirmez pas.'),
      U.tableau([{ titre: 'N°', valeur: k => k.code }, { titre: 'Libellé', valeur: k => k.libelle }, { titre: 'Nature', valeur: k => k.type === 'prix' ? 'Prix' : 'Noté' }, { titre: 'Pondération', num: true, valeur: k => U.nombre(k.ponderation) }], lus),
      h('div.note-info' + (ctl.coherent ? '.ok' : '.alerte'), ctl.coherent ? 'Total de 100 points, sous-critères cohérents.' : 'À corriger après reprise : ' + ctl.erreurs.join(' ')),
      h('div.actions', U.bouton(d.criteres.length ? 'Remplacer les ' + d.criteres.length + ' critère(s) actuels' : 'Reprendre ces critères', async () => {
        if (d.grille.absente) d.grille = await D.creer('grilles', { lot_id: d.lot.id, consultation_id: c.id, statut: 'brouillon', formule_prix: 'proportionnelle', arrondi_decimales: 2, arrondi_mode: 'proche', seuil_alerte_prix: 25, version: 0 }, false);
        for (const k of d.criteres.filter(k => k.parent_id)) await D.supprimer('criteres', k.id, false); for (const k of d.criteres.filter(k => !k.parent_id)) await D.supprimer('criteres', k.id, false);
        const ids = {};
        for (const k of lus.filter(k => !k.parent).concat(lus.filter(k => k.parent))) { const n = await D.creer('criteres', { lot_id: d.lot.id, consultation_id: c.id, parent_id: k.parent ? ids[k.parent] : null, code: k.code, libelle: k.libelle, type: k.type, ponderation: k.ponderation, bareme: k.type === 'prix' ? null : 10, description: 'Repris du règlement « ' + fichier.name + ' »' }, false); ids[k.code] = n.id; }
        await D.journal('Reprise des critères depuis un règlement de consultation', 'grilles', d.grille.id, c.reference + ' — lot ' + d.lot.numero, { fichier: fichier.name, criteres: lus.length }, c.id);
        m.fermer(); U.message(lus.length + ' critère(s) repris. Vérifiez les barèmes, puis faites verrouiller la grille.'); U.recharger();
      }, 'accent'), U.bouton('Annuler', () => m.fermer(), 'secondaire'))], { large: true });
  };
  async function vueSynthese(c, d) {
    // Périmètre du classement : toutes les offres (classement unique), ou offres de base, variantes, PSE analysées à part
    const perimetre = U.param('perimetre') || 'toutes';
    const types = Array.from(new Set(d.offres.map(o => o.type_offre || 'base')));
    if (perimetre !== 'toutes') { const offres = d.offres.filter(o => (o.type_offre || 'base') === perimetre); d = Object.assign({}, d, { offres, calcul: Calcul.calculLot(d.criteres, offres, d.notes, d.grille), indices: Calcul.indicesPrix(offres, Number(d.grille.seuil_alerte_prix) || 25, Number(d.lot.montant_estime) || 0) }); }
    const choixPerimetre = types.length > 1 || perimetre !== 'toutes' ? h('div.actions', { style: { marginBottom: '12px' } }, h('b', 'Périmètre du classement :'),
      [['toutes', 'Toutes les offres'], ['base', 'Offres de base'], ['variante', 'Variantes'], ['pse', 'Prestations supplémentaires'], ['negociee', 'Offres négociées']].filter(x => x[0] === 'toutes' || types.includes(x[0]))
        .map(x => h('a.bouton' + (x[0] === perimetre ? '' : '.secondaire') + '.petit', { href: '#/consultation/' + c.id + '/analyse?lot=' + d.lot.id + '&vue=synthese&perimetre=' + x[0] }, x[1]))) : null;
    const t = E.tableauAnalyse(d), det = E.detailCalculs(d);
    const tr = (action, detail) => ({ action, libelle: c.reference + ' — lot ' + d.lot.numero, consultation_id: c.id, detail });
    const validations = (await D.lister('validations', { objet_type: 'analyses', objet_id: d.lot.id }, { ordre: 'date' }));
    const etape = async (statut, action, decision, commentaire) => {
      let a = d.analyse;
      const patch = { statut };
      if (statut === 'en_relecture') Object.assign(patch, { soumise_par_nom: D.utilisateur.nom, soumise_le: D.maintenant() });
      if (statut === 'validee') Object.assign(patch, { validee_par_nom: D.utilisateur.nom, validee_le: D.maintenant() });
      if (a.absente) a = await D.creer('analyses', { lot_id: d.lot.id, consultation_id: c.id, statut: 'en_cours' }, false);
      await D.modifier('analyses', a.id, patch, tr(action, { commentaire }));
      await D.creer('validations', { objet_type: 'analyses', objet_id: d.lot.id, consultation_id: c.id, etape: action, decision, commentaire: commentaire || '', auteur_id: D.utilisateur.id, auteur_nom: D.utilisateur.nom, date: D.maintenant() }, false);
      U.message(action + '.'); U.recharger();
    };
    const incomplets = d.calcul.lignes.filter(l => !l.complet && !l.ecartee);
    const actions = [];
    if (d.analyse.statut === 'en_cours' && D.peut('analyse.saisir')) actions.push(U.bouton('Soumettre l\'analyse à la relecture', async () => { if (await U.confirmer('Soumettre à la relecture', 'L\'analyse sera transmise au valideur. ' + (incomplets.length ? incomplets.length + ' offre(s) ont encore des notes non validées : le valideur devra les valider pour établir le classement.' : ''), 'Soumettre')) await etape('en_relecture', 'Analyse soumise à la relecture', 'soumis'); }, 'accent'));
    if (d.analyse.statut === 'en_relecture' && D.peut('analyse.valider')) {
      actions.push(U.bouton('Valider l\'analyse', async () => { if (!d.calcul.classementComplet) throw new Error('Toutes les notes et tous les montants des offres non écartées doivent être validés avant de valider l\'analyse.'); if (await U.confirmer('Valider l\'analyse', 'Les notes seront figées et le classement provisoire arrêté pour la rédaction du rapport. Cette validation est nominative et tracée. Confirmer ?', 'Valider')) await etape('validee', 'Analyse validée', 'approuve'); }, 'accent'));
      actions.push(U.bouton('Renvoyer en analyse', () => U.editer('Renvoyer en analyse', [{ nom: 'commentaire', libelle: 'Motif du renvoi', type: 'long', requis: true }], {}, v => etape('en_cours', 'Analyse renvoyée à l\'analyste', 'refuse', v.commentaire)), 'secondaire'));
    }
    if (d.analyse.statut === 'validee' && D.peut('analyse.valider')) actions.push(U.bouton('Rouvrir l\'analyse', () => U.editer('Rouvrir l\'analyse validée', [{ nom: 'commentaire', libelle: 'Motif de la réouverture', type: 'long', requis: true }], {}, v => etape('en_relecture', 'Réouverture de l\'analyse validée', 'refuse', v.commentaire)), 'danger'));
    actions.push(U.bouton('Exporter le tableau (XLSX)', async () => { U.telechargerBlob(await Docs.xlsx([{ nom: 'Tableau d\'analyse', lignes: [t.entetes].concat(t.lignes) }, { nom: 'Détail des calculs', lignes: [det.entetes].concat(det.lignes) }]), 'analyse-' + c.reference + '-lot' + d.lot.numero + '.xlsx'); await D.journal('Export du tableau d\'analyse (XLSX)', 'analyses', d.lot.id, c.reference + ' — lot ' + d.lot.numero, null, c.id); }, 'secondaire'));
    return h('div',
      !d.verrouillee ? h('div.note-info.alerte', 'La grille n\'est pas verrouillée : aucun calcul ne peut être établi.') : null, choixPerimetre,
      U.carte('Tableau d\'analyse et classement provisoire', [
        d.calcul.classementComplet ? h('div.note-info.ok', 'Toutes les notes et tous les montants sont validés : le classement ci-dessous est complet. Il reste provisoire jusqu\'à la décision de l\'acheteur.')
          : h('div.note-info.alerte', 'Classement partiel : seules les offres dont toutes les notes et le montant sont validés sont classées. ', incomplets.length ? 'Restent à valider — ' + incomplets.map(l => l.candidat + ' : critère(s) ' + l.manquants.join(', ')).join(' ; ') + '.' : ''),
        U.tableau(t.entetes.map((e, i) => ({ titre: e, num: i > 0, valeur: l => i === t.entetes.length - 1 && l[i] !== '—' ? h('b', l[i] + (l[i] === 1 ? 'er' : 'e')) : i === t.entetes.length - 2 ? h('b', l[i]) : l[i] })), t.lignes, { vide: 'Aucune offre.' })], actions),
      E.carteSyntheses ? await E.carteSyntheses(c, d) : null,
      E.carteJournalCalculs ? await E.carteJournalCalculs(c, d) : null,
      U.carte('Contrôle des calculs', [h('p.aide', 'Chaque point attribué est recalculable : valeur validée, règle appliquée, auteur de la saisie et de la validation.'),
        U.tableau(det.entetes.map((e, i) => ({ titre: e, num: i === 4, valeur: l => l[i] })), det.lignes, { vide: 'Aucun calcul.' })]),
      U.carte('Circuit de relecture et de validation', U.tableau([{ titre: 'Date et heure', valeur: v => U.dateHeure(v.date) }, { titre: 'Étape', valeur: v => v.etape }, { titre: 'Par', valeur: v => v.auteur_nom }, { titre: 'Commentaire', valeur: v => v.commentaire || '—' }], validations, { vide: 'L\'analyse n\'a pas encore été soumise à la relecture.' })));
  }
})();
