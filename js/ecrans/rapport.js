/* Rapport d'analyse (projet modifiable, versions, validation, export PDF et Word), courriers types, dossier d'audit. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const org = () => window.CONFIG.organisme || '';

  async function contexte(id) {
    const c = await E.chargerConsultation(id);
    const lots = await D.lister('lots', { consultation_id: id }, { ordre: 'numero' });
    const lot = lots.find(l => l.id === U.param('lot')) || lots[0];
    return { c, lots, lot, d: lot ? await E.donneesLot(lot) : null };
  }
  const choixLot = (x, onglet) => x.lots.length > 1 ? h('div.actions', { style: { marginBottom: '12px' } }, h('b', 'Lot :'), x.lots.map(l => h('button.bouton' + (l.id === x.lot.id ? '' : '.secondaire') + '.petit', { type: 'button', onclick: () => U.aller('/consultation/' + x.c.id + '/' + onglet + '?lot=' + l.id) }, 'Lot ' + l.numero + ' — ' + l.intitule))) : null;

  // Construit le projet de rapport à partir des seules données validées.
  async function projetRapport(c, d) {
    const [pieces, attendues, demandes] = await Promise.all([D.lister('pieces', { lot_id: d.lot.id }), D.lister('pieces_attendues', { consultation_id: c.id }), D.lister('demandes', { lot_id: d.lot.id })]);
    const t = E.tableauAnalyse(d), det = E.detailCalculs(d);
    const feuilles = t.feuilles.filter(x => x.type !== 'prix');
    const candidatures = { entetes: ['Candidat', 'Date de dépôt', 'Pièces obligatoires absentes', 'Constat / décision', 'Motif'], lignes: d.offres.map(o => [o.candidat, U.date(o.date_depot),
      attendues.filter(a => a.obligatoire && !pieces.some(p => p.offre_id === o.id && p.type_piece === a.type_piece)).map(a => a.type_piece).join(', ') || 'Aucune', E.L.candidature[o.candidature_statut][0] + (o.candidature_decision_par_nom ? ' (' + o.candidature_decision_par_nom + ')' : ''), o.candidature_motif || '']) };
    const grille = { entetes: ['N°', 'Critère', 'Pondération', 'Notation'], lignes: E.ordonnerCriteres(d.criteres).map(x => [x.code, x.libelle, U.nombre(x.ponderation) + ' pts', x.type === 'prix' ? 'Formule de prix' : d.criteres.some(y => y.parent_id === x.id) ? 'Somme des sous-critères' : 'Note sur ' + U.nombre(x.bareme)]) };
    const prix = { entetes: ['Candidat', 'Montant HT', 'Écart / moyenne des autres', 'Écart / estimation', 'Montant validé par'], lignes: d.indices.map(i => { const o = d.offres.find(x => x.id === i.offre_id); return [i.candidat, U.euros(i.montant), i.ecartMoyenneAutres == null ? '—' : (i.ecartMoyenneAutres > 0 ? '+' : '') + U.nombre(i.ecartMoyenneAutres, 1) + ' %', i.ecartEstimation == null ? '—' : (i.ecartEstimation > 0 ? '+' : '') + U.nombre(i.ecartEstimation, 1) + ' %', o.montant_valide ? o.montant_valide_par_nom : 'Non validé']; }) };
    const parOffre = d.offres.map(o => {
      const lignes = feuilles.map(cr => { const n = d.notes.find(x => x.offre_id === o.id && x.critere_id === cr.id && x.statut === 'validee'); if (!n) return cr.code + ' ' + cr.libelle + ' : note non validée à ce jour.';
        const p = n.piece_id ? pieces.find(x => x.id === n.piece_id) : null;
        return cr.code + ' ' + cr.libelle + ' — ' + U.nombre(n.note) + ' / ' + U.nombre(cr.bareme) + '. ' + (n.appreciation || '') + (n.points_forts ? ' Points forts : ' + n.points_forts : '') + (n.points_faibles ? ' Points faibles : ' + n.points_faibles : '') + (n.reserves ? ' Réserves : ' + n.reserves : '')
          + (n.extrait ? ' Extrait cité : « ' + n.extrait + ' » (' + (p ? p.nom_fichier : 'pièce') + (n.page ? ', page ' + n.page : '') + ').' : ''); });
      return o.candidat + (o.ecartee ? ' — offre écartée par décision : ' + (o.ecartee_motif || '') : '') + '\n' + lignes.join('\n');
    }).join('\n\n');
    const signal = d.indices.filter(i => i.signalements.length).map(i => i.candidat + ' : ' + i.signalements.map(s => s.texte).join(' ')).join('\n') || 'Aucun signalement au-delà du seuil paramétré.';
    const dem = demandes.map(x => (d.offres.find(o => o.id === x.offre_id) || {}).candidat + ' — ' + E.L.demande[x.type] + ' du ' + U.date(x.date_envoi) + ' : ' + x.objet + (x.reponse ? ' Réponse du ' + U.date(x.date_reponse) + ' : ' + x.reponse : ' Sans réponse à ce jour.') + (x.decision ? ' Décision : ' + x.decision + ' (' + x.decision_par_nom + ').' : '')).join('\n') || 'Aucune demande adressée aux candidats.';
    const premier = d.calcul.lignes.find(l => l.rang === 1);
    return {
      sections: [
        { titre: '1. Objet de la consultation', texte: 'Consultation ' + c.reference + ' — ' + c.objet + '.\nProcédure : ' + c.procedure + '. Nature : ' + (E.L.nature[c.nature] || '') + '.\nLot ' + d.lot.numero + ' — ' + d.lot.intitule + '. Estimation de l\'acheteur : ' + U.euros(d.lot.montant_estime) + ' HT.\nDate limite de remise des offres : ' + U.date(c.date_limite_offres) + '.' },
        { titre: '2. Plis reçus et analyse des candidatures', texte: d.offres.length + ' pli(s) reçu(s) pour ce lot. Le tableau ci-dessous distingue les constats de complétude et les décisions prises par les agents habilités.\n\nDemandes adressées aux candidats :\n' + dem, tableau: 'candidatures' },
        { titre: '3. Critères de jugement et méthode de notation', texte: 'Grille verrouillée en version ' + d.grille.version + ' par ' + (d.grille.verrouillee_par_nom || '—') + ' le ' + U.dateHeure(d.grille.verrouillee_le) + '.\nFormule de prix : ' + Calcul.FORMULES[d.grille.formule_prix].expression + '.\nArrondi : ' + d.grille.arrondi_decimales + ' décimale(s). Notes qualitatives : note validée ÷ barème × pondération.', tableau: 'grille' },
        { titre: '4. Analyse technique des offres', texte: parOffre },
        { titre: '5. Analyse financière', texte: 'Signalements sur les prix (indices à vérifier, sans qualification automatique) :\n' + signal, tableau: 'prix' },
        { titre: '6. Tableau d\'analyse et classement provisoire', texte: d.calcul.classementComplet ? 'Le classement ci-dessous résulte des seules notes et montants validés par les agents habilités.' : 'ATTENTION : classement partiel. Certaines notes ou certains montants ne sont pas encore validés.', tableau: 'analyse' },
        { titre: '7. Proposition', texte: (premier && d.calcul.classementComplet ? 'Au vu de l\'analyse, l\'offre classée première est celle de ' + premier.candidat + ' avec ' + U.nombre(premier.total, d.grille.arrondi_decimales) + ' points sur 100.\n' : '') + '[À compléter par l\'acheteur : proposition soumise à l\'autorité compétente. La décision d\'attribution n\'appartient pas à l\'outil.]' }],
      tableaux: { candidatures, grille, prix, analyse: { entetes: t.entetes, lignes: t.lignes }, calculs: det },
      analyse_validee: d.analyse.statut === 'validee'
    };
  }
  function documentRapport(c, lot, r) {
    const blocs = [];
    for (const s of r.sections) { blocs.push({ type: 'titre', niveau: 1, texte: s.titre }); blocs.push({ type: 'p', texte: s.texte }); if (s.tableau && r.tableaux[s.tableau]) blocs.push(Object.assign({ type: 'tableau' }, r.tableaux[s.tableau])); }
    blocs.push({ type: 'titre', niveau: 1, texte: 'Annexe — Contrôle des calculs et interventions humaines' }); blocs.push(Object.assign({ type: 'tableau' }, r.tableaux.calculs));
    return { titre: 'Rapport d\'analyse des candidatures et des offres', sousTitre: org() + ' — ' + c.reference + ' — ' + c.objet + ' — Lot ' + lot.numero + ' : ' + lot.intitule, paysage: true,
      pied: 'Rapport version ' + r.version + ' — ' + (r.statut === 'valide' ? 'validé par ' + r.valide_par_nom + ' le ' + U.dateHeure(r.valide_le) : 'PROJET non validé') + ' — document confidentiel', blocs };
  }

  E.ongletRapport = async function (id) {
    const x = await contexte(id); const c = x.c, d = x.d;
    if (!d) return h('div', E.enteteConsultation(c, 'rapport'), U.carte(null, U.vide('Aucun lot.')));
    const rapports = await D.lister('rapports', { lot_id: d.lot.id }, { ordre: 'version', desc: true });
    const r = rapports.find(y => y.id === U.param('version')) || rapports[0];
    const rediger = D.peut('rapport.rediger'), valider = D.peut('rapport.valider');
    const tr = (action, detail) => ({ action, libelle: c.reference + ' — lot ' + d.lot.numero, consultation_id: id, detail });
    const generer = async () => {
      if (!d.verrouillee) throw new Error('La grille doit être verrouillée avant de générer un rapport.');
      const p = await projetRapport(c, d); const v = (rapports[0] ? rapports[0].version : 0) + 1;
      const n = await D.creer('rapports', Object.assign({ lot_id: d.lot.id, consultation_id: id, version: v, statut: 'brouillon', auteur_nom: D.utilisateur.nom, date: D.maintenant() }, p), tr('Génération du projet de rapport (version ' + v + ')'));
      U.message('Projet de rapport généré : relisez-le et modifiez-le avant validation.'); U.aller('/consultation/' + id + '/rapport?lot=' + d.lot.id + '&version=' + n.id);
    };
    const exporter = async format => {
      const doc = documentRapport(c, d.lot, r); const blob = format === 'pdf' ? await Docs.pdf(doc) : await Docs.word(doc);
      U.telechargerBlob(blob, 'rapport-analyse-' + c.reference + '-lot' + d.lot.numero + '-v' + r.version + (format === 'pdf' ? '.pdf' : '.docx'));
      await D.journal('Export du rapport d\'analyse (' + (format === 'pdf' ? 'PDF' : 'Word') + ')', 'rapports', r.id, c.reference + ' — lot ' + d.lot.numero + ' — version ' + r.version, null, id);
    };
    let editeur = null;
    if (r) {
      const modifiable = rediger && r.statut === 'brouillon';
      const zones = r.sections.map(s => ({ titre: h('input.saisie', { value: s.titre, disabled: !modifiable, 'aria-label': 'Titre de la section' }), texte: h('textarea.saisie', { rows: Math.min(18, Math.max(3, Math.ceil(s.texte.length / 110) + s.texte.split('\n').length)), value: s.texte, disabled: !modifiable, 'aria-label': s.titre }), tableau: s.tableau }));
      const lire = () => zones.map(z => ({ titre: z.titre.value, texte: z.texte.value, tableau: z.tableau || null }));
      editeur = U.carte('Rapport — version ' + r.version, [
        h('p', r.statut === 'valide' ? U.badge('Validé par ' + r.valide_par_nom + ' le ' + U.dateHeure(r.valide_le), 'ok') : U.badge('Projet modifiable', 'alerte'), ' ', h('span.aide', 'Généré par ' + r.auteur_nom + ' le ' + U.dateHeure(r.date) + (r.analyse_validee ? '' : ' — à partir d\'une analyse non encore validée'))),
        zones.map(z => h('div.rapport-section', z.titre, z.texte, z.tableau ? h('details', h('summary.aide', 'Tableau inséré après cette section (' + r.tableaux[z.tableau].lignes.length + ' ligne(s))'), U.tableau(r.tableaux[z.tableau].entetes.map((e, i) => ({ titre: e, valeur: l => l[i] })), r.tableaux[z.tableau].lignes)) : null))],
        [modifiable ? U.bouton('Enregistrer les modifications', async () => { await D.modifier('rapports', r.id, { sections: lire(), modifie_par_nom: D.utilisateur.nom, modifie_le: D.maintenant() }, tr('Modification du projet de rapport (version ' + r.version + ')')); U.message('Rapport enregistré.'); U.recharger(); }, 'accent') : null,
          valider && r.statut === 'brouillon' ? U.bouton('Valider le rapport', async () => { if (d.analyse.statut !== 'validee') throw new Error('L\'analyse du lot doit être validée avant de valider le rapport.'); if (!r.analyse_validee) throw new Error('Ce projet a été généré avant la validation de l\'analyse : générez une nouvelle version.'); if (await U.confirmer('Valider le rapport', 'La version ' + r.version + ' sera figée. Confirmer ?', 'Valider')) { await D.modifier('rapports', r.id, { statut: 'valide', valide_par_nom: D.utilisateur.nom, valide_le: D.maintenant() }, tr('Validation du rapport d\'analyse (version ' + r.version + ')')); U.recharger(); } }, 'accent') : null,
          U.bouton('Exporter en PDF', () => exporter('pdf'), 'secondaire'), U.bouton('Exporter en Word', () => exporter('word'), 'secondaire')]);
    }
    // Courriers types
    const modeles = (await D.lister('modeles_document', { type: 'courrier' }, { ordre: 'nom' })).filter(m => m.actif !== false);
    const courrier = () => U.editer('Préparer un courrier', [{ nom: 'modele', libelle: 'Modèle', type: 'choix', requis: true, options: modeles.map(m => [m.id, m.nom]) }, { nom: 'offre', libelle: 'Candidat', type: 'choix', requis: true, options: d.offres.map(o => [o.id, o.candidat]) }], {}, async v => {
      const m = modeles.find(y => y.id === v.modele), o = d.offres.find(y => y.id === v.offre), l = d.calcul.lignes.find(y => y.offre_id === o.id), premier = d.calcul.lignes.find(y => y.rang === 1);
      const vars = { organisme: org(), reference: c.reference, objet: c.objet, lot: 'Lot ' + d.lot.numero + ' — ' + d.lot.intitule, candidat: o.candidat, date: U.date(D.aujourdhui()), montant: U.euros(o.montant_ht), note_totale: l && l.total != null ? U.nombre(l.total, 2) : '[note non arrêtée]', rang: l && l.rang ? String(l.rang) : '[rang non arrêté]',
        attributaire: premier && d.analyse.statut === 'validee' ? premier.candidat : '[à compléter après décision]', note_attributaire: premier && d.analyse.statut === 'validee' ? U.nombre(premier.total, 2) : '[à compléter]', agent: D.utilisateur.nom };
      const texte = m.contenu.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] != null ? vars[k] : '[' + k + ']');
      setTimeout(() => { const zone = h('textarea.saisie', { rows: 20, value: texte, 'aria-label': 'Texte du courrier' });
        const exp = async f => { const doc = { titre: m.nom, sousTitre: org() + ' — ' + c.reference, blocs: [{ type: 'p', texte: zone.value }], pied: 'Projet de courrier — à signer par la personne habilitée' }; U.telechargerBlob(f === 'pdf' ? await Docs.pdf(doc) : await Docs.word(doc), 'courrier-' + c.reference + '-' + o.candidat.replace(/\W+/g, '_') + (f === 'pdf' ? '.pdf' : '.docx')); await D.journal('Génération d\'un courrier : ' + m.nom, 'offres', o.id, o.candidat + ' — ' + c.reference, { format: f }, id); };
        U.modale(m.nom + ' — ' + o.candidat, [h('p.aide', 'Projet établi à partir du modèle : relisez et complétez avant envoi. Aucun courrier n\'est envoyé par l\'outil.'), zone, h('div.actions', { style: { marginTop: '10px' } }, U.bouton('Exporter en Word', () => exp('word'), 'accent'), U.bouton('Exporter en PDF', () => exp('pdf'), 'secondaire'))], { large: true }); }, 50);
    }, { libelle: 'Préparer' });
    return h('div', E.enteteConsultation(c, 'rapport'), choixLot(x, 'rapport'),
      d.analyse.statut !== 'validee' ? h('div.note-info.alerte', 'L\'analyse de ce lot n\'est pas encore validée : un projet de rapport peut être préparé, mais il ne pourra être validé qu\'après la validation de l\'analyse.') : null,
      U.carte('Versions du rapport', U.tableau([{ titre: 'Version', classe: 'etroit', valeur: y => y.version }, { titre: 'Générée le', valeur: y => U.dateHeure(y.date) }, { titre: 'Par', valeur: y => y.auteur_nom },
        { titre: 'État', valeur: y => y.statut === 'valide' ? U.badge('Validé — ' + y.valide_par_nom, 'ok') : U.badge('Projet', 'alerte') }], rapports, { surClic: y => U.aller('/consultation/' + id + '/rapport?lot=' + d.lot.id + '&version=' + y.id), vide: 'Aucun rapport généré.' }),
        rediger ? [U.bouton(rapports.length ? 'Générer une nouvelle version' : 'Générer le projet de rapport', generer, 'accent')] : null),
      editeur,
      U.carte('Courriers et demandes types', h('p.aide', 'Demandes de précisions, lettres aux candidats non retenus, notification : générés depuis les modèles paramétrables (menu « Modèles »), modifiables, exportables en Word et en PDF.'), modeles.length && d.offres.length ? [U.bouton('Préparer un courrier', courrier, 'secondaire')] : null));
  };
  U.route('/consultation/:id/rapport', E.ongletRapport);

  /* ---------- Dossier d'audit ---------- */
  E.ongletAudit = async function (id) {
    const x = await contexte(id); const c = x.c;
    if (!D.peut('journal.lire')) return h('div', E.enteteConsultation(c, 'audit'), U.carte(null, h('div.note-info.alerte', 'Le dossier d\'audit est réservé aux profils habilités à consulter le journal.')));
    const [pieces, offres, versions, notes, hist, validations, rapports, journal, criteres] = await Promise.all([D.lister('pieces', { consultation_id: id }, { ordre: 'depose_le' }), D.lister('offres', { consultation_id: id }), D.lister('grille_versions', { consultation_id: id }, { ordre: 'date' }),
      D.lister('notes', { consultation_id: id }), D.lister('notes_historique', { consultation_id: id }), D.lister('validations', { consultation_id: id }, { ordre: 'date' }), D.lister('rapports', { consultation_id: id }, { ordre: 'version' }), D.lister('journal', { consultation_id: id }, { ordre: 'date' }), D.lister('criteres', { consultation_id: id })]);
    const cand = oid => (offres.find(o => o.id === oid) || {}).candidat || 'Dossier de consultation';
    const lotNum = lid => (x.lots.find(l => l.id === lid) || {}).numero;
    const T = {
      sources: { entetes: ['Pièce', 'Fichier', 'Candidat', 'Version', 'Taille', 'Déposée le', 'Par', 'Contrôle'], lignes: pieces.map(p => [p.type_piece, p.nom_fichier, cand(p.offre_id), p.version, U.taille(p.taille), U.dateHeure(p.depose_le), p.depose_par_nom, E.L.piece[p.controle][0]]) },
      grilles: { entetes: ['Lot', 'Version', 'Date et heure', 'Auteur', 'Événement', 'Nombre de critères'], lignes: versions.map(v => [lotNum(v.lot_id), v.version, U.dateHeure(v.date), v.auteur_nom, v.motif, v.contenu.criteres.length]) },
      notes: { entetes: ['Lot', 'Candidat', 'Critère', 'Analyste', 'Note', 'État', 'Validée par', 'Validée le', 'Justification', 'Source citée', 'Enregistrements'], lignes: notes.map(n => { const cr = criteres.find(y => y.id === n.critere_id) || {}; const p = pieces.find(y => y.id === n.piece_id);
        return [lotNum(n.lot_id), cand(n.offre_id), (cr.code || '') + ' ' + (cr.libelle || ''), n.analyste_nom, n.note == null ? '—' : U.nombre(n.note) + ' / ' + U.nombre(cr.bareme), E.L.note[n.statut][0], n.validee_par_nom || '—', n.validee_le ? U.dateHeure(n.validee_le) : '—', (n.appreciation || '').slice(0, 160), p ? p.nom_fichier + (n.page ? ', p. ' + n.page : '') : '—', hist.filter(y => y.note_id === n.id).length]; }) },
      validations: { entetes: ['Date et heure', 'Objet', 'Étape', 'Décision', 'Par', 'Commentaire'], lignes: validations.map(v => [U.dateHeure(v.date), v.objet_type === 'analyses' ? 'Analyse — lot ' + lotNum(v.objet_id) : 'Document du DCE', v.etape, v.decision, v.auteur_nom, v.commentaire || '']) },
      rapports: { entetes: ['Lot', 'Version', 'Générée le', 'Par', 'État', 'Validée par', 'Validée le'], lignes: rapports.map(r => [lotNum(r.lot_id), r.version, U.dateHeure(r.date), r.auteur_nom, r.statut === 'valide' ? 'Validé' : 'Projet', r.valide_par_nom || '—', r.valide_le ? U.dateHeure(r.valide_le) : '—']) },
      journal: { entetes: ['Date et heure', 'Auteur', 'Profil', 'Action', 'Objet', 'Résultat'], lignes: journal.map(l => [U.dateHeure(l.date), l.auteur_nom, D.ROLES[l.auteur_role] || '', l.action, l.objet_libelle || '', l.resultat]) }
    };
    const calculs = []; for (const l of x.lots) { const d = await E.donneesLot(l); if (d.verrouillee) calculs.push({ lot: l, det: E.detailCalculs(d), tab: E.tableauAnalyse(d) }); }
    const docAudit = () => {
      const blocs = [{ type: 'p', texte: 'Dossier établi le ' + U.dateHeure(D.maintenant()) + ' par ' + D.utilisateur.nom + ' (' + D.ROLES[D.utilisateur.role] + '). Il rassemble les sources utilisées, les versions de la grille, les interventions humaines, les calculs et les versions validées.' }];
      const sec = (titre, t) => { blocs.push({ type: 'titre', niveau: 1, texte: titre }); if (t.lignes.length) blocs.push(Object.assign({ type: 'tableau' }, t)); else blocs.push({ type: 'p', texte: 'Néant.', italique: true }); };
      sec('1. Sources utilisées', T.sources); sec('2. Versions de la grille d\'analyse', T.grilles); sec('3. Notes, appréciations et validations', T.notes);
      blocs.push({ type: 'titre', niveau: 1, texte: '4. Calculs' });
      for (const k of calculs) { blocs.push({ type: 'titre', niveau: 2, texte: 'Lot ' + k.lot.numero + ' — ' + k.lot.intitule }); blocs.push(Object.assign({ type: 'tableau' }, { entetes: k.tab.entetes, lignes: k.tab.lignes })); blocs.push(Object.assign({ type: 'tableau' }, k.det)); }
      sec('5. Circuit de relecture et de validation', T.validations); sec('6. Versions du rapport', T.rapports); sec('7. Journal des actions du dossier', T.journal);
      return { titre: 'Dossier d\'audit de l\'analyse', sousTitre: org() + ' — ' + c.reference + ' — ' + c.objet, paysage: true, pied: 'Dossier d\'audit — ' + c.reference + ' — confidentiel', blocs };
    };
    const pdf = async () => { U.telechargerBlob(await Docs.pdf(docAudit()), 'dossier-audit-' + c.reference + '.pdf'); await D.journal('Export du dossier d\'audit (PDF)', 'consultations', id, c.reference, null, id); };
    const archive = async () => {
      await Docs.charger('jszip'); const zip = new JSZip(); zip.file('dossier-audit-' + c.reference + '.pdf', await Docs.pdf(docAudit()));
      zip.file('journal.csv', Docs.csv(journal.map(E.ligneJournalPlate))); zip.file('notes.json', JSON.stringify(notes, null, 1)); zip.file('historique-des-notes.json', JSON.stringify(hist, null, 1));
      zip.file('versions-de-grille.json', JSON.stringify(versions, null, 1)); zip.file('rapports.json', JSON.stringify(rapports, null, 1)); zip.file('validations.csv', Docs.csv(validations)); zip.file('journal-des-calculs.json', JSON.stringify(await D.lister('calculs', { consultation_id: id }, { ordre: 'date' }), null, 1));
      for (const p of pieces) { const b = await D.telecharger(p.chemin); if (b) zip.file('sources/' + cand(p.offre_id).replace(/[^\w\- ]+/g, '_') + '/' + p.nom_fichier, b); }
      U.telechargerBlob(await zip.generateAsync({ type: 'blob' }), 'dossier-audit-' + c.reference + '.zip'); await D.journal('Export de l\'archive d\'audit (ZIP)', 'consultations', id, c.reference, { pieces: pieces.length }, id);
    };
    const carte = (titre, t) => U.carte(titre + ' (' + t.lignes.length + ')', U.tableau(t.entetes.map((e, i) => ({ titre: e, valeur: l => l[i] })), t.lignes, { vide: 'Néant.' }));
    return h('div', E.enteteConsultation(c, 'audit'),
      U.carte('Restitution du dossier d\'audit', h('p', 'Sources utilisées, versions de la grille, interventions humaines, calculs, validations et journal du dossier, restitués en un seul document.'), [U.bouton('Dossier d\'audit (PDF)', pdf, 'accent'), U.bouton('Archive complète avec les pièces sources (ZIP)', archive, 'secondaire')]),
      carte('Sources utilisées', T.sources), carte('Versions de la grille', T.grilles), carte('Notes, appréciations et validations', T.notes), carte('Circuit de validation', T.validations), carte('Versions du rapport', T.rapports), carte('Journal du dossier', T.journal));
  };
  U.route('/consultation/:id/audit', E.ongletAudit);
})();
