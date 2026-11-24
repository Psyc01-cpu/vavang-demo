/* Candidatures et offres : dépôt des plis, pièces, contrôle de complétude, lecture, recherche, demandes aux candidats. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  E.devinerType = function (nom) {
    const n = norm(nom);
    if (/dc1|lettre.de.candidature/.test(n)) return 'DC1 — Lettre de candidature';
    if (/dc2|declaration/.test(n)) return 'DC2 — Déclaration du candidat';
    if (/acte|engagement|(^|[^a-z])ae([^a-z]|$)/.test(n)) return 'Acte d\'engagement';
    if (/assurance/.test(n)) return 'Attestation d\'assurance';
    if (/fiche/.test(n)) return 'Fiches techniques';
    if (/memoire|methodolog/.test(n)) return 'Mémoire technique';
    if (/dqe|quantitatif/.test(n)) return 'Détail quantitatif estimatif';
    if (/dpgf|bpu|bordereau|prix/.test(n)) return 'Bordereau de prix / DPGF';
    if (/certificat|qualif|attestation/.test(n)) return 'Certificats et qualifications';
    if (/(^|[^a-z])cv([^a-z]|$)|reference/.test(n)) return 'CV et références';
    return 'Autre pièce';
  };

  // Dépose des fichiers : conserve le fichier source, extrait le texte, crée la fiche de la pièce.
  E.deposerPieces = async function (fichiers, cible, libelleDossier) {
    const resultats = [];
    // En ligne : une pièce de marché est rangée sous la consultation d'origine (cloisonnement du stockage et des lignes), sinon sous marches/<id>.
    let consultationId = cible.consultation_id || null, dossier = cible.consultation_id || cible.marche_id || 'divers';
    if (D.mode === 'supabase' && !cible.consultation_id && cible.marche_id) { const m = await D.lire('marches', cible.marche_id); consultationId = (m && m.consultation_id) || null; dossier = consultationId || ('marches/' + cible.marche_id); }
    for (const f of fichiers) {
      const x = await Docs.extraire(f);
      const chemin = await D.deposer(f, dossier);
      let p;
      try {
        const existantes = cible.offre_id ? await D.lister('pieces', { offre_id: cible.offre_id, nom_fichier: f.name }) : [];
        p = await D.creer('pieces', Object.assign({ type_piece: cible.type_piece || E.devinerType(f.name), nom_fichier: f.name, chemin, taille: f.size, mime: f.type || '', pages: x.pages, nb_pages: x.nb_pages,
          lisible: !!x.lisible, controle: 'non_controlee', version: existantes.length + 1, depose_par_nom: D.utilisateur.nom, depose_le: D.maintenant() },
          { consultation_id: consultationId, lot_id: cible.lot_id || null, offre_id: cible.offre_id || null, marche_id: cible.marche_id || null, reprise_id: cible.reprise_id || null }),
          { action: 'Import d\'une pièce', libelle: f.name + (libelleDossier ? ' — ' + libelleDossier : ''), consultation_id: consultationId, detail: { taille: f.size, pages: x.nb_pages, texte_lisible: !!x.lisible } });
      } catch (e) {
        // La fiche n'a pas pu être créée : on retire le fichier déposé pour ne pas laisser d'orphelin dans le stockage.
        try { await D.supprimerFichier(chemin); } catch (e2) { console.warn('nettoyage du fichier', e2); }
        throw e;
      }
      resultats.push(p);
    }
    return resultats;
  };

  // Alertes de complétude et de cohérence : constats automatiques, toujours « à vérifier » par l'agent.
  // ctx (facultatif) = { consultation, offres, lignes } : date limite, lignes de prix de l'offre et des autres offres du même lot.
  E.alertesOffre = function (offre, pieces, attendues, ctx) {
    const mes = pieces.filter(p => p.offre_id === offre.id); const a = []; ctx = ctx || {};
    if (offre.montant_ht == null || offre.montant_ht === '') a.push({ ton: 'alerte', texte: 'Montant de l\'offre non renseigné : offre financière incomplète ou montant à saisir.' });
    const limite = ctx.consultation && ctx.consultation.date_limite_offres;
    if (limite && offre.date_depot && String(offre.date_depot).slice(0, 10) > String(limite).slice(0, 10)) a.push({ ton: 'danger', texte: 'Pli enregistré comme déposé le ' + U.date(offre.date_depot) + ', après la date limite du ' + U.date(limite) + ' : à vérifier.' });
    if (ctx.lignes) {
      const lignesDe = id => ctx.lignes.filter(l => l.offre_id === id);
      const autres = (ctx.offres || []).filter(o => o.id !== offre.id && o.lot_id === offre.lot_id && !o.ecartee && (o.type_offre || 'base') === (offre.type_offre || 'base')).map(o => ({ candidat: o.candidat, lignes: lignesDe(o.id) }));
      for (const s of Calcul.controleBordereau(lignesDe(offre.id), autres, offre.bordereau_controle)) a.push({ ton: s.type === 'incoherence' ? 'danger' : 'alerte', texte: 'Bordereau — ' + s.texte });
    }
    for (const att of attendues) if (!mes.some(p => p.type_piece === att.type_piece)) a.push({ ton: att.obligatoire ? 'alerte' : 'neutre', texte: 'Pièce ' + (att.obligatoire ? 'obligatoire' : 'facultative') + ' absente : ' + att.type_piece });
    for (const p of mes) {
      if (!p.lisible) a.push({ ton: 'alerte', texte: 'Texte non lisible automatiquement (document scanné ou format non pris en charge) : ' + p.nom_fichier });
      if (p.taille === 0) a.push({ ton: 'danger', texte: 'Fichier vide : ' + p.nom_fichier });
      if (['incomplete', 'illisible', 'incoherente'].includes(p.controle)) a.push({ ton: 'danger', texte: 'Pièce jugée ' + E.L.piece[p.controle][0].toLowerCase() + ' par l\'agent : ' + p.nom_fichier });
    }
    // Contenu des déclarations : signalements à vérifier, jamais une décision.
    const texteDe = re => mes.filter(p => re.test(p.type_piece)).map(p => (p.pages || []).join('\n')).join('\n');
    const decl = texteDe(/Acte d'engagement|DC1|DC2/);
    if (decl.trim()) {
      const norm = x => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nomSansExemple = norm(offre.candidat).replace(/^exemple\s+/, '');
      if (!norm(decl).includes(nomSansExemple)) a.push({ ton: 'alerte', texte: 'Le nom du candidat (« ' + offre.candidat + ' ») ne figure pas dans les déclarations : vérifier l\'identité du signataire.' });
      const sirets = (decl.match(/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/g) || []);
      for (const x of sirets) if (!Calcul.siretValide(x)) a.push({ ton: 'alerte', texte: 'SIRET « ' + x + ' » : clé de contrôle incorrecte, à vérifier.' });
      // le même candidat doit déclarer le même SIREN d'une pièce à l'autre
      const sirens = Array.from(new Set(sirets.filter(x => Calcul.siretValide(x)).map(x => x.replace(/\s/g, '').slice(0, 9))));
      if (sirens.length > 1) a.push({ ton: 'danger', texte: 'Les déclarations citent ' + sirens.length + ' entreprises différentes (SIREN ' + sirens.join(', ') + ') : vérifier l\'identité du candidat et la forme de la candidature (groupement, sous-traitance).' });
      const lotNum = offre.lot_numero; if (lotNum && !new RegExp('lot\\s*(n\\s*[°o]\\s*)?' + lotNum + '\\b', 'i').test(decl)) a.push({ ton: 'neutre', texte: 'Le lot ' + lotNum + ' n\'est pas cité dans les déclarations : à vérifier.' });
      const ae = texteDe(/Acte d'engagement/);
      if (ae.trim() && offre.montant_ht != null) { const montants = (ae.match(/\d{1,3}(?:[\s\u202f.]\d{3})*(?:,\d{2})?(?=\s*(?:€|euros))/g) || []).map(x => Number(x.replace(/[\s\u202f.]/g, '').replace(',', '.'))); if (montants.length && !montants.some(x => Math.abs(x - offre.montant_ht) < 0.01)) a.push({ ton: 'danger', texte: 'Le montant de l\'acte d\'engagement (' + montants.map(x => Calcul.euros(x)).join(', ') + ') diffère du montant saisi (' + Calcul.euros(offre.montant_ht) + ').' }); }
    }
    const doublons = mes.filter(p => p.version > 1); if (doublons.length) a.push({ ton: 'neutre', texte: doublons.length + ' pièce(s) déposée(s) en plusieurs versions' });
    return a;
  };

  E.rechercher = function (pieces, terme) {
    const t = norm(terme).trim(); const r = [];
    if (t.length < 2) return r;
    for (const p of pieces) (p.pages || []).forEach((txt, i) => {
      const n = norm(txt); let pos = n.indexOf(t), nb = 0;
      while (pos >= 0 && nb < 3) { r.push({ piece: p, page: i + 1, extrait: txt.slice(Math.max(0, pos - 90), pos + t.length + 110).replace(/\s+/g, ' ') }); nb++; pos = n.indexOf(t, pos + t.length); }
    });
    return r;
  };

  /* ---------- Lecteur de pièce : navigation par page, recherche, annotation, signet, extrait ---------- */
  E.lirePiece = async function (piece, options) {
    options = options || {};
    await D.journal('Consultation d\'une pièce', 'pieces', piece.id, piece.nom_fichier, null, piece.consultation_id);
    let annotations = await D.lister('annotations', { piece_id: piece.id }, { ordre: 'page' });
    const pagesZone = h('div.pages', { tabindex: 0 }); const cote = h('div');
    let terme = options.recherche || '';
    const surligner = txt => {
      if (!terme || terme.length < 2) return [txt];
      const re = new RegExp('(' + terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      return txt.split(re).map((m, i) => i % 2 ? h('mark', m) : m);
    };
    const dessinerPages = () => {
      pagesZone.replaceChildren(...(piece.pages && piece.pages.length ? piece.pages.flatMap((t, i) => [h('h4', { id: 'page-' + (i + 1) }, (piece.mime === 'application/pdf' || /\.pdf$/i.test(piece.nom_fichier) ? 'Page ' : 'Section ') + (i + 1)), h('div', { 'data-page': i + 1 }, surligner(t))])
        : [U.vide('Le texte de ce document n\'a pas pu être lu automatiquement. Téléchargez le fichier source pour le consulter.')]));
      const cible = pagesZone.querySelector(options.page ? '#page-' + options.page : 'mark'); if (cible) setTimeout(() => cible.scrollIntoView({ block: 'start' }), 30);
    };
    const selection = () => {
      const s = window.getSelection(); const txt = s ? s.toString().trim() : '';
      if (!txt || !s.anchorNode || !pagesZone.contains(s.anchorNode)) throw new Error('Sélectionnez d\'abord un passage du document avec la souris.');
      const el = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement).closest('[data-page]');
      return { extrait: txt.replace(/\s+/g, ' ').slice(0, 1500), page: el ? Number(el.dataset.page) : null };
    };
    const dessinerCote = () => cote.replaceChildren(
      U.definition([['Pièce', piece.type_piece], ['Fichier', piece.nom_fichier], ['Version', piece.version], ['Déposée', U.dateHeure(piece.depose_le)], ['Par', piece.depose_par_nom], ['Contrôle', E.badge('piece', piece.controle)]]),
      h('div.champ', { style: { margin: '12px 0' } }, h('label', { for: 'rech-piece' }, 'Rechercher dans la pièce'),
        h('input.saisie', { id: 'rech-piece', type: 'search', value: terme, oninput: e => { terme = e.target.value; options.page = null; dessinerPages(); } })),
      h('div.actions', { style: { flexDirection: 'column', alignItems: 'stretch' } },
        options.surExtrait ? U.bouton('Utiliser la sélection comme extrait justificatif', async () => { const s = selection(); options.surExtrait(Object.assign({ piece }, s)); m.fermer(); }, 'accent') : null,
        U.bouton('Annoter la sélection', async () => { const s = selection(); let ma;
          const fa = U.formulaire([{ nom: 'commentaire', libelle: 'Commentaire interne', type: 'long', requis: true }, { nom: 'signet', libelle: 'Marquer comme signet', type: 'case' }], {}, async v => {
            await D.creer('annotations', Object.assign({ piece_id: piece.id, consultation_id: piece.consultation_id, page: s.page, extrait: s.extrait, auteur_id: D.utilisateur.id, auteur_nom: D.utilisateur.nom, date: D.maintenant() }, v), { action: 'Annotation d\'une pièce', libelle: piece.nom_fichier + ' — page ' + s.page, consultation_id: piece.consultation_id });
            annotations = await D.lister('annotations', { piece_id: piece.id }, { ordre: 'page' }); dessinerCote(); ma.fermer(); U.message('Annotation enregistrée.'); }, { surAnnulation: () => ma.fermer() });
          ma = U.modale('Annotation — page ' + s.page, [h('div.extrait', '« ' + s.extrait.slice(0, 300) + ' »'), fa]); }, 'secondaire'),
        /\.pdf$/i.test(piece.nom_fichier) && E.visionneusePdf ? U.bouton('Voir la mise en page d\'origine', () => E.visionneusePdf(piece, options.page), 'secondaire') : null,
        U.bouton('Télécharger le fichier source', async () => { const b = await D.telecharger(piece.chemin); if (!b) throw new Error('Fichier source introuvable.'); U.telechargerBlob(b, piece.nom_fichier); await D.journal('Téléchargement d\'une pièce', 'pieces', piece.id, piece.nom_fichier, null, piece.consultation_id); }, 'secondaire')),
      h('h3', { style: { margin: '16px 0 6px' } }, 'Annotations et signets (' + annotations.length + ')'),
      annotations.length ? annotations.map(a => h('div.extrait', { style: { cursor: 'pointer' }, onclick: () => { options.page = a.page; dessinerPages(); } }, (a.signet ? '🔖 ' : '') + a.commentaire, h('small', 'Page ' + a.page + ' · « ' + (a.extrait || '').slice(0, 80) + '… » · ' + a.auteur_nom + ', ' + U.date(a.date)))) : U.vide('Aucune annotation.'));
    dessinerCote(); dessinerPages();
    const m = U.modale(piece.nom_fichier, h('div.lecteur', cote, pagesZone), { large: true, surFermeture: options.surFermeture });
    return m;
  };

  /* ---------- Onglet « Candidatures et offres » ---------- */
  E.ongletOffres = async function (id) {
    const c = await E.chargerConsultation(id);
    const [lots, offres, pieces, attendues, demandes, fournisseurs] = await Promise.all([D.lister('lots', { consultation_id: id }, { ordre: 'numero' }), D.lister('offres', { consultation_id: id }, { ordre: 'date_depot' }).then(async l => { const lt = await D.lister('lots', { consultation_id: id }); return l.filter(o => D.lotAutorise(id, o.lot_id)).map(o => Object.assign(o, { lot_numero: (lt.find(x => x.id === o.lot_id) || {}).numero })); }),
      D.lister('pieces', { consultation_id: id }).then(l => l.filter(p => !p.marche_id)), D.lister('pieces_attendues', { consultation_id: id }), D.lister('demandes', { consultation_id: id }, { ordre: 'date_envoi' }), D.lister('fournisseurs', {}, { ordre: 'raison_sociale' })]);
    const lignesPrix = offres.length ? await D.lister('lignes_prix', { offre_id: offres.map(o => o.id) }) : [];
    const ctx = { consultation: c, offres, lignes: lignesPrix };
    const peut = D.peut('analyse.saisir');
    const lotDe = o => lots.find(l => l.id === o.lot_id) || {};
    const deposer = () => {
      let m; const f = U.formulaire([
        { nom: 'lot_id', libelle: 'Lot', type: 'choix', requis: true, vide: lots.length > 1, options: lots.map(l => [l.id, 'Lot ' + l.numero + ' — ' + l.intitule]), defaut: lots.length === 1 ? lots[0].id : '' },
        { nom: 'type_offre', libelle: 'Type d\'offre', type: 'choix', vide: false, options: [['base', 'Offre de base'], ['variante', 'Variante'], ['pse', 'Prestation supplémentaire éventuelle'], ['negociee', 'Offre négociée']] },
        { nom: 'fournisseur_id', libelle: 'Candidat (fiche fournisseur existante)', type: 'choix', options: fournisseurs.map(x => [x.id, x.raison_sociale]) },
        { nom: 'candidat', libelle: 'ou nom d\'un nouveau candidat', aide: 'Une fiche fournisseur sera créée.' },
        { nom: 'date_depot', libelle: 'Date de dépôt du pli', type: 'date', defaut: D.aujourdhui(), requis: true },
        { nom: 'montant_ht', libelle: 'Montant de l\'offre (€ HT), s\'il est connu', type: 'nombre' },
        { nom: 'fichiers', libelle: 'Pièces du pli (PDF, DOCX, ODT, XLSX, ODS, CSV)', type: 'fichier', multiple: true, large: true, aide: 'Le type de chaque pièce est proposé d\'après le nom du fichier ; vous pourrez le corriger.' }], {}, async v => {
        let nom = v.candidat, fid = v.fournisseur_id;
        if (fid) nom = fournisseurs.find(x => x.id === fid).raison_sociale;
        else if (nom) { if (D.peut('fournisseurs.ecrire')) fid = (await D.creer('fournisseurs', { raison_sociale: nom, source: 'Candidature à la consultation ' + c.reference, actif: true }, { action: 'Création d\'une fiche fournisseur', libelle: nom })).id; }
        else throw new Error('Indiquez le candidat.');
        const o = await D.creer('offres', { consultation_id: id, lot_id: v.lot_id, fournisseur_id: fid || null, candidat: nom, type_offre: v.type_offre, date_depot: v.date_depot, montant_ht: v.montant_ht, montant_valide: false, candidature_statut: 'a_examiner', ecartee: false },
          { action: 'Enregistrement d\'une offre', libelle: nom + ' — ' + c.reference, consultation_id: id });
        await E.deposerPieces(v.fichiers, { consultation_id: id, lot_id: v.lot_id, offre_id: o.id }, nom);
        m.fermer(); U.message('Offre enregistrée : ' + v.fichiers.length + ' pièce(s) importée(s).'); U.aller('/consultation/' + id + '/offre/' + o.id);
      }, { libelle: 'Importer le pli', surAnnulation: () => m.fermer() });
      m = U.modale('Déposer une candidature ou une offre', f);
    };
    // recherche plein texte
    const resultats = h('div');
    const recherche = h('input.saisie', { type: 'search', placeholder: 'Rechercher dans toutes les pièces du dossier…', 'aria-label': 'Recherche plein texte', style: { maxWidth: '420px' }, oninput: e => {
      const r = E.rechercher(pieces, e.target.value);
      resultats.replaceChildren(e.target.value.trim().length < 2 ? '' : r.length ? U.tableau([
        { titre: 'Candidat', valeur: x => (offres.find(o => o.id === x.piece.offre_id) || {}).candidat || 'Dossier de consultation' }, { titre: 'Pièce', valeur: x => x.piece.nom_fichier }, { titre: 'Page', classe: 'etroit', valeur: x => x.page },
        { titre: 'Passage', valeur: x => '… ' + x.extrait + ' …' }], r.slice(0, 40), { surClic: x => E.lirePiece(x.piece, { page: x.page, recherche: e.target.value.trim() }), legende: r.length + ' passage(s) trouvé(s)' }) : U.vide('Aucun passage trouvé.'));
    } });
    return h('div', E.enteteConsultation(c, 'offres'),
      U.carte('Tableau comparatif des candidatures', [
        h('p.aide', 'Colonnes « pièces » et « alertes » : constats et signalements automatiques, à vérifier. Colonne « décision » : uniquement ce qu\'un agent habilité a décidé.'),
        U.tableau([{ titre: 'Candidat', valeur: o => [h('b', o.candidat), h('div.aide', 'Lot ' + lotDe(o).numero + ' · ' + ({ base: 'offre de base', variante: 'variante', pse: 'PSE', negociee: 'offre négociée' }[o.type_offre] || '') + ' · déposée le ' + U.date(o.date_depot))] }]
          .concat(attendues.map(a => ({ titre: a.type_piece.replace(/ —.*/, ''), valeur: o => pieces.some(p => p.offre_id === o.id && p.type_piece === a.type_piece) ? U.badge('Présente', 'ok') : U.badge('Absente', a.obligatoire ? 'danger' : 'neutre') })))
          .concat([{ titre: 'Alertes à vérifier', valeur: o => { const a = E.alertesOffre(o, pieces, attendues, ctx).filter(x => x.ton !== 'neutre'); return a.length ? U.badge(a.length + ' alerte(s)', 'alerte') : U.badge('Aucune', 'ok'); } },
            { titre: 'Constat / décision', valeur: o => [E.badge('candidature', o.candidature_statut), o.ecartee ? [' ', U.badge('Offre écartée par décision', 'danger')] : null] },
            { titre: 'Montant HT', num: true, valeur: o => U.euros(o.montant_ht) }]), offres, { surClic: o => U.aller('/consultation/' + id + '/offre/' + o.id), vide: 'Aucune offre enregistrée pour cette consultation.' })],
        [peut ? U.bouton('Déposer une offre', deposer, 'accent') : null]),
      U.carte('Recherche dans les pièces', [recherche, resultats]),
      U.carte('Demandes aux candidats', E.tableauDemandes(demandes, offres, c)),
      Calcul.negociationAutorisee(c.procedure).autorisee !== false || demandes.some(d => d.type === 'negociation') ? E.carteNegociations(demandes, offres, c) : null);
  };
  U.route('/consultation/:id/offres', E.ongletOffres);

  E.tableauDemandes = function (demandes, offres, c) {
    const peut = D.peut('analyse.saisir') || D.peut('analyse.valider');
    return U.tableau([
      { titre: 'Candidat', valeur: d => (offres.find(o => o.id === d.offre_id) || {}).candidat }, { titre: 'Nature', valeur: d => [E.L.demande[d.type], d.type === 'negociation' && d.tour ? h('div.aide', 'Tour n° ' + d.tour) : null] }, { titre: 'Objet', valeur: d => d.objet },
      { titre: 'Envoyée le', valeur: d => U.date(d.date_envoi) }, { titre: 'Échéance', valeur: d => [U.date(d.echeance), d.statut === 'envoyee' && d.echeance && Calcul.joursAvant(d.echeance, D.aujourdhui()) < 0 ? [' ', U.badge('Dépassée', 'danger')] : null] },
      { titre: 'Réponse', valeur: d => d.a_repondu === 'non' ? [U.badge('Pas de réponse', 'danger'), h('div.aide', 'Constaté le ' + U.date(d.date_reponse))]
          : d.reponse ? [U.badge('Répondu', 'ok'), h('div', d.reponse), d.type === 'negociation' && d.montant_propose != null && d.montant_propose !== '' ? h('div', h('b', 'Montant proposé : ' + U.euros(d.montant_propose) + ' HT')) : null, h('div.aide', 'Reçue le ' + U.date(d.date_reponse))] : U.badge('En attente', 'alerte') },
      { titre: 'Décision de l\'agent', valeur: d => d.decision ? [d.decision, h('div.aide', d.decision_par_nom + ', ' + U.dateHeure(d.decision_le))] : '—' },
      { titre: '', classe: 'etroit', valeur: d => peut && !d.decision ? U.bouton(d.reponse || d.a_repondu ? 'Décider' : 'Saisir la réponse', () => U.editer('Suivi de la demande', [
        { nom: 'a_repondu', libelle: 'Le candidat a-t-il répondu ?', type: 'choix', options: [['oui', 'Oui, réponse reçue'], ['non', 'Non, aucune réponse']], requis: true,
          aide: 'Sans réponse à l\'échéance, la décision (offre irrégulière, non-admission…) revient à l\'agent habilité et doit être motivée.' },
        { nom: 'reponse', libelle: 'Réponse reçue (résumé)', type: 'long', aide: 'À remplir si le candidat a répondu.' },
        d.type === 'negociation' ? { nom: 'montant_propose', libelle: 'Montant proposé à l\'issue de ce tour (€ HT)', type: 'nombre', aide: 'Montant remis par le candidat dans sa réponse. Il ne remplace pas le montant de l\'offre : l\'offre négociée est enregistrée et validée à part.' } : null,
        { nom: 'date_reponse', libelle: 'Date de réception ou du constat', type: 'date', defaut: D.aujourdhui() },
        { nom: 'decision', libelle: 'Décision prise par l\'agent habilité', type: 'long', aide: 'Laissez vide tant qu\'aucune décision n\'est prise.' }].filter(Boolean), Object.assign({}, d, { a_repondu: d.a_repondu || (d.reponse ? 'oui' : '') }), async v => {
        if (v.a_repondu === 'oui' && !v.reponse) throw new Error('Résumez la réponse du candidat, ou indiquez qu\'il n\'a pas répondu.');
        if (v.a_repondu === 'non') { v.reponse = ''; if ('montant_propose' in v) v.montant_propose = null; }
        const patch = Object.assign({}, v, { statut: v.decision ? 'close' : v.a_repondu === 'non' ? 'sans_reponse' : 'reponse_recue' });
        if (v.decision) { D.exiger('analyse.valider'); patch.decision_par_nom = D.utilisateur.nom; patch.decision_le = D.maintenant(); }
        await D.modifier('demandes', d.id, patch, { action: v.decision ? 'Décision sur une demande au candidat' : v.a_repondu === 'non' ? 'Absence de réponse du candidat constatée' : 'Réponse du candidat enregistrée', libelle: E.L.demande[d.type] + ' — ' + ((offres.find(o => o.id === d.offre_id) || {}).candidat || ''), consultation_id: c.id }); }), 'secondaire.petit') : null }],
      demandes, { vide: 'Aucune demande de complément, de précision ou de justification.' });
  };

  // Suivi des négociations : tours, montants avant et après chaque tour, décisions. Rien n'est appliqué automatiquement à l'offre.
  E.carteNegociations = function (demandes, offres, c) {
    const regle = Calcul.negociationAutorisee(c.procedure);
    const neg = demandes.filter(d => d.type === 'negociation').sort((a, b) => ((a.offre_id || '') + String(a.tour || 0).padStart(3, '0')).localeCompare((b.offre_id || '') + String(b.tour || 0).padStart(3, '0')));
    const cand = d => offres.find(o => o.id === d.offre_id) || {};
    const ecart = d => { const i = Number(d.montant_initial), p = Number(d.montant_propose); return d.montant_propose == null || d.montant_propose === '' || !(i > 0) ? '—' : (p - i > 0 ? '+' : '') + U.nombre((p - i) / i * 100, 1) + ' %'; };
    return U.carte('Négociations', [
      h('div.note-info' + (regle.autorisee === false ? '.alerte' : regle.autorisee ? '.ok' : '.alerte'), h('b', 'Procédure : ' + (c.procedure || 'non renseignée') + '. '), regle.motif,
        regle.autorisee === false ? ' Une demande de négociation est refusée par l\'application.' : ''),
      U.tableau([{ titre: 'Candidat', valeur: d => cand(d).candidat }, { titre: 'Tour', classe: 'etroit', valeur: d => d.tour || '—' }, { titre: 'Points négociés', valeur: d => d.objet },
        { titre: 'Envoyée le', valeur: d => U.date(d.date_envoi) }, { titre: 'Montant avant ce tour', num: true, valeur: d => U.euros(d.montant_initial) },
        { titre: 'Montant proposé', num: true, valeur: d => d.a_repondu === 'non' ? 'Pas de réponse' : U.euros(d.montant_propose) }, { titre: 'Écart', num: true, valeur: ecart },
        { titre: 'Décision de l\'agent', valeur: d => d.decision ? [d.decision, h('div.aide', d.decision_par_nom + ', ' + U.dateHeure(d.decision_le))] : '—' }], neg,
        { vide: 'Aucune négociation engagée. Pour négocier, ouvrez l\'offre du candidat puis « Nouvelle demande », nature « Négociation ».' }),
      h('p.aide', 'Chaque tour est une demande tracée au journal (envoi, réponse, montant proposé, décision). L\'offre finale remise après négociation est enregistrée comme « Offre négociée » ; son montant est validé par un agent habilité avant toute notation.')]);
  };

  /* ---------- Fiche d'une offre ---------- */
  E.offre = async function (id, oid) {
    const c = await E.chargerConsultation(id);
    const o = await D.lire('offres', oid); if (!o) throw new Error('Offre introuvable.');
    const [lot, pieces, attendues, lignes, demandes] = await Promise.all([D.lire('lots', o.lot_id), D.lister('pieces', { offre_id: oid }, { ordre: 'type_piece' }), D.lister('pieces_attendues', { consultation_id: id }),
      D.lister('lignes_prix', { offre_id: oid }, { ordre: 'ordre' }), D.lister('demandes', { offre_id: oid }, { ordre: 'date_envoi' })]);
    const peut = D.peut('analyse.saisir'), valide = D.peut('analyse.valider');
    const tr = (action, detail) => ({ action, libelle: o.candidat + ' — ' + c.reference, consultation_id: id, detail });
    o.lot_numero = lot.numero;
    const offresLot = (await D.lister('offres', { lot_id: o.lot_id })).filter(x => D.lotAutorise(id, x.lot_id));
    const lignesLot = await D.lister('lignes_prix', { offre_id: offresLot.map(x => x.id) });
    const alertes = E.alertesOffre(o, pieces, attendues, { consultation: c, offres: offresLot, lignes: lignesLot });
    const totalLignes = lignes.length ? Calcul.arrondir(Calcul.somme(lignes.map(l => l.quantite * l.prix_unitaire)), { decimales: 2 }) : null;
    const ecartTotal = totalLignes != null && o.montant_ht != null && Math.abs(totalLignes - o.montant_ht) > 0.01;
    const decider = (titre, champs, construire, action) => U.editer(titre, champs, o, async v => D.modifier('offres', oid, construire(v), tr(action)));
    const lireBordereau = async () => {
      const cand = pieces.filter(p => /xlsx|xls|ods|csv/i.test(p.nom_fichier.split('.').pop()));
      if (!cand.length) throw new Error('Aucune pièce de type tableur (XLSX, ODS, CSV) dans ce pli.');
      const p = cand.find(x => /Bordereau|quantitatif/.test(x.type_piece)) || cand[0];
      const blob = await D.telecharger(p.chemin); const feuilles = await Docs.lireTableur(new File([blob], p.nom_fichier));
      const b = Docs.lireBordereau(feuilles);
      if (!b || !b.lignes.length) throw new Error('Les colonnes « désignation », « quantité » et « prix unitaire » n\'ont pas été reconnues dans ' + p.nom_fichier + '. Saisissez les lignes à la main.');
      const nbInc = (b.incompletes || []).length;
      if (!(await U.confirmer('Import du bordereau', b.lignes.length + ' ligne(s) de prix lue(s) dans « ' + p.nom_fichier + ' » (feuille ' + b.feuille + ')' + (nbInc ? ' ; ' + nbInc + ' ligne(s) sans quantité ou sans prix, non importées et signalées' : '') + '. Remplacer les lignes actuelles ? Le montant déclaré n\'est pas modifié.', 'Importer'))) return;
      for (const l of lignes) await D.supprimer('lignes_prix', l.id, false);
      let i = 0; for (const l of b.lignes) await D.creer('lignes_prix', Object.assign({ offre_id: oid, consultation_id: o.consultation_id || id, lot_id: o.lot_id || null, ordre: ++i }, l), false);
      await D.modifier('offres', oid, { bordereau_controle: { fichier: p.nom_fichier, lu_le: D.maintenant(), lignes: b.lignes.length, incompletes: b.incompletes || [] } }, false);
      await D.journal('Import des lignes de prix', 'offres', oid, o.candidat + ' — ' + c.reference, { fichier: p.nom_fichier, lignes: b.lignes.length, lignes_incompletes: nbInc }, id); U.recharger();
    };
    const champsLigne = [{ nom: 'designation', libelle: 'Désignation', requis: true, large: true }, { nom: 'unite', libelle: 'Unité' }, { nom: 'quantite', libelle: 'Quantité', type: 'nombre', requis: true }, { nom: 'prix_unitaire', libelle: 'Prix unitaire (€ HT)', type: 'nombre', requis: true }];
    return h('div', U.fil([['Consultations', '/consultations'], [c.reference, '/consultation/' + id], ['Candidatures et offres', '/consultation/' + id + '/offres'], [o.candidat]]),
      U.titrePage(o.candidat, 'Lot ' + lot.numero + ' — ' + lot.intitule + ' · déposée le ' + U.date(o.date_depot), [E.badge('candidature', o.candidature_statut), o.ecartee ? U.badge('Offre écartée par décision', 'danger') : null]),
      alertes.length ? h('div.note-info.alerte', h('b', 'Signalements automatiques — à vérifier par l\'agent :'), h('ul', { style: { margin: '4px 0 0 18px', padding: 0 } }, alertes.map(a => h('li', a.texte)))) : h('div.note-info.ok', 'Aucun signalement automatique sur ce pli.'),
      h('div.grille2',
        U.carte('Candidature', [U.definition([['Constat de l\'analyste', E.badge('candidature', ['admise', 'non_admise'].includes(o.candidature_statut) ? (o.candidature_constat || 'a_examiner') : o.candidature_statut)],
          ['Décision', ['admise', 'non_admise'].includes(o.candidature_statut) ? [E.badge('candidature', o.candidature_statut), h('div.aide', 'par ' + o.candidature_decision_par_nom + ', ' + U.dateHeure(o.candidature_decision_le))] : 'Aucune décision enregistrée'],
          o.candidature_motif ? ['Motif', o.candidature_motif] : null]),
          h('p.aide', 'La solution ne prononce aucune admission ni aucun rejet : elle signale, l\'agent constate, le valideur décide.')],
          [peut && !['admise', 'non_admise'].includes(o.candidature_statut) ? U.bouton('Enregistrer un constat', () => decider('Constat sur la candidature', [{ nom: 'candidature_statut', libelle: 'Constat', type: 'choix', requis: true, options: [['complete', 'Candidature complète'], ['a_completer', 'Candidature à compléter'], ['a_examiner', 'À examiner']] }, { nom: 'candidature_motif', libelle: 'Observations', type: 'long' }],
            v => Object.assign(v, { candidature_constat: v.candidature_statut }), 'Constat sur la candidature'), 'secondaire') : null,
          valide ? U.bouton('Décider de l\'admission', () => decider('Décision sur la candidature', [{ nom: 'candidature_statut', libelle: 'Décision', type: 'choix', requis: true, options: [['admise', 'Candidature admise'], ['non_admise', 'Candidature non admise']] }, { nom: 'candidature_motif', libelle: 'Motif (obligatoire en cas de non-admission)', type: 'long' }],
            v => Object.assign(v, { candidature_constat: ['admise', 'non_admise'].includes(o.candidature_statut) ? o.candidature_constat : o.candidature_statut, candidature_decision_par_nom: D.utilisateur.nom, candidature_decision_le: D.maintenant() }), 'Décision sur la candidature'), 'secondaire') : null,
          valide ? U.bouton(o.ecartee ? 'Réintégrer l\'offre' : 'Écarter l\'offre (décision motivée)', () => o.ecartee ? D.modifier('offres', oid, { ecartee: false, ecartee_motif: null }, tr('Réintégration de l\'offre')).then(U.recharger)
            : decider('Écarter l\'offre', [{ nom: 'ecartee_motif', libelle: 'Motif de la décision (irrégulière, inacceptable, inappropriée, anormalement basse non justifiée…)', type: 'long', requis: true }], v => Object.assign(v, { ecartee: true, ecartee_par_nom: D.utilisateur.nom, ecartee_le: D.maintenant() }), 'Décision d\'écarter l\'offre'), 'danger') : null]),
        U.carte('Offre financière', [U.definition([['Montant déclaré', h('b', U.euros(o.montant_ht) + ' HT')], ['Total recalculé des lignes', totalLignes == null ? 'Aucune ligne saisie' : [U.euros(totalLignes), ' ', ecartTotal ? U.badge('Écart de ' + U.euros(totalLignes - o.montant_ht) + ' — à vérifier', 'danger') : U.badge('Concordant', 'ok')]],
          ['Validation du montant', o.montant_valide ? [U.badge('Validé', 'ok'), h('div.aide', 'par ' + o.montant_valide_par_nom + ', ' + U.dateHeure(o.montant_valide_le))] : U.badge('Non validé', 'alerte')]]),
          h('p.aide', 'La note de prix n\'est calculée qu\'à partir des montants validés par un agent habilité.')],
          [peut && !o.montant_valide ? U.bouton('Corriger le montant', () => decider('Montant de l\'offre', [{ nom: 'montant_ht', libelle: 'Montant (€ HT)', type: 'nombre', requis: true }], v => v, 'Saisie du montant de l\'offre'), 'secondaire') : null,
          valide ? U.bouton(o.montant_valide ? 'Rouvrir le montant' : 'Valider le montant', async () => { if (!o.montant_valide && o.montant_ht == null) throw new Error('Saisissez d\'abord le montant.'); if (!o.montant_valide && ecartTotal && !(await U.confirmer('Écart constaté', 'Le total recalculé diffère du montant déclaré. Valider tout de même le montant déclaré de ' + U.euros(o.montant_ht) + ' ?'))) return;
            await D.modifier('offres', oid, o.montant_valide ? { montant_valide: false } : { montant_valide: true, montant_valide_par_nom: D.utilisateur.nom, montant_valide_le: D.maintenant() }, tr(o.montant_valide ? 'Réouverture du montant' : 'Validation du montant de l\'offre', { montant: o.montant_ht })); U.recharger(); }, o.montant_valide ? 'secondaire' : 'accent') : null])),
      U.carte('Pièces du pli (' + pieces.length + ')', U.tableau([
        { titre: 'Type de pièce', valeur: p => peut ? h('select.saisie', { 'aria-label': 'Type de pièce', onchange: U.agir(async e => { await D.modifier('pieces', p.id, { type_piece: e.target.value }, { action: 'Classement d\'une pièce', libelle: p.nom_fichier + ' → ' + e.target.value, consultation_id: id }); U.recharger(); }) }, E.TYPES_PIECE.map(t => h('option', { selected: t === p.type_piece }, t))) : p.type_piece },
        { titre: 'Fichier', valeur: p => [h('button.lien', { type: 'button', onclick: () => E.lirePiece(p, { surFermeture: U.recharger }) }, p.nom_fichier), h('div.aide', U.taille(p.taille) + ' · ' + (p.nb_pages || 0) + ' page(s) ou section(s) · version ' + p.version)] },
        { titre: 'Lecture automatique', valeur: p => p.lisible ? U.badge('Texte lu', 'ok') : U.badge('Texte non lisible', 'alerte') },
        { titre: 'Contrôle de l\'agent', valeur: p => [E.badge('piece', p.controle), p.controle_commentaire ? h('div.aide', p.controle_commentaire) : null] },
        { titre: '', classe: 'etroit', valeur: p => peut ? U.bouton('Contrôler', () => U.editer('Contrôle de la pièce', [{ nom: 'controle', libelle: 'Résultat du contrôle', type: 'choix', requis: true, options: Object.entries(E.L.piece).map(x => [x[0], x[1][0]]) }, { nom: 'controle_commentaire', libelle: 'Commentaire', type: 'long' }], p,
          v => D.modifier('pieces', p.id, Object.assign(v, { controle_par_nom: D.utilisateur.nom, controle_le: D.maintenant() }), { action: 'Contrôle d\'une pièce : ' + E.L.piece[v.controle][0], libelle: p.nom_fichier, consultation_id: id })), 'secondaire.petit') : null }], pieces, { vide: 'Aucune pièce dans ce pli.' }),
        [peut ? h('label.bouton.secondaire', 'Ajouter des pièces', h('input', { type: 'file', multiple: true, hidden: true, onchange: U.agir(async e => { await E.deposerPieces(Array.from(e.target.files), { consultation_id: id, lot_id: o.lot_id, offre_id: oid }, o.candidat); U.message('Pièce(s) importée(s).'); U.recharger(); }) })) : null]),
      U.carte('Lignes de prix', [U.tableau([{ titre: 'Désignation', valeur: l => l.designation }, { titre: 'Unité', valeur: l => l.unite }, { titre: 'Quantité', num: true, valeur: l => U.nombre(l.quantite) }, { titre: 'Prix unitaire HT', num: true, valeur: l => U.euros(l.prix_unitaire) },
        { titre: 'Montant HT', num: true, valeur: l => U.euros(l.quantite * l.prix_unitaire) },
        { titre: '', classe: 'etroit', valeur: l => peut && !o.montant_valide ? U.bouton('Supprimer', async () => { await D.supprimer('lignes_prix', l.id, tr('Suppression d\'une ligne de prix')); U.recharger(); }, 'danger.petit') : null }], lignes, { vide: 'Aucune ligne de prix. Importez le bordereau ou saisissez les lignes.' }),
        lignes.length ? h('p', { style: { textAlign: 'right', fontWeight: 700, marginTop: '8px' } }, 'Total recalculé : ' + U.euros(totalLignes) + ' HT') : null],
        peut && !o.montant_valide ? [U.bouton('Lire le bordereau déposé', lireBordereau, 'secondaire'), U.bouton('Ajouter une ligne', () => U.editer('Ligne de prix', champsLigne, {}, v => D.creer('lignes_prix', Object.assign({ offre_id: oid, consultation_id: o.consultation_id || id, lot_id: o.lot_id || null, ordre: lignes.length + 1 }, v), tr('Saisie d\'une ligne de prix'))), 'secondaire')] : null),
      U.carte('Demandes adressées à ce candidat', E.tableauDemandes(demandes, [o], c),
        peut ? [U.bouton('Nouvelle demande', () => U.editer('Demande au candidat', [{ nom: 'type', libelle: 'Nature', type: 'choix', requis: true, options: Object.entries(E.L.demande) }, { nom: 'objet', libelle: 'Objet de la demande', type: 'long', requis: true },
          { nom: 'tour', libelle: 'Tour de négociation (nature « Négociation » seulement)', type: 'nombre', aide: 'Proposé : tour suivant pour ce candidat. ' + Calcul.negociationAutorisee(c.procedure).motif,
            defaut: demandes.filter(x => x.type === 'negociation').reduce((m, x) => Math.max(m, Number(x.tour) || 0), 0) + 1 },
          { nom: 'date_envoi', libelle: 'Date d\'envoi', type: 'date', defaut: D.aujourdhui() }, { nom: 'echeance', libelle: 'Réponse attendue pour le', type: 'date' }], {},
          v => { const neg = v.type === 'negociation';
            if (!neg) delete v.tour; else if (!(Number(v.tour) >= 1)) throw new Error('Indiquez le numéro du tour de négociation.');
            // montant de départ du tour : le dernier montant proposé lors d'un tour précédent, sinon le montant de l'offre
            const prec = demandes.filter(x => x.type === 'negociation' && x.montant_propose != null && x.montant_propose !== '' && Number(x.tour) < Number(v.tour)).sort((a, b) => b.tour - a.tour)[0];
            return D.creer('demandes', Object.assign({ consultation_id: id, lot_id: o.lot_id, offre_id: oid, statut: 'envoyee' }, v, neg ? { tour: Number(v.tour), montant_initial: prec ? Number(prec.montant_propose) : o.montant_ht } : {}), tr('Demande au candidat : ' + E.L.demande[v.type] + (neg ? ' (tour ' + v.tour + ')' : ''))); }), 'secondaire')] : null),
      Calcul.negociationAutorisee(c.procedure).autorisee !== false || demandes.some(d => d.type === 'negociation') ? E.carteNegociations(demandes, [o], c) : null);
  };
  U.route('/consultation/:id/offre/:oid', E.offre);
})();
