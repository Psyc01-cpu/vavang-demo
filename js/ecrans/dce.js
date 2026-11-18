/* Dossier de consultation : génération depuis des modèles, versions, contrôle de complétude, circuit rédaction → relecture → validation → publication. Bibliothèque de modèles. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const TYPES_DCE = ['Règlement de la consultation', 'CCAP', 'CCTP', 'Acte d\'engagement', 'Bordereau des prix / DPGF', 'Avis de publicité', 'Autre document'];
  const REQUIS = p => /sans publicité|devis/i.test(p || '') ? ['CCTP'] : ['Règlement de la consultation', 'CCAP', 'CCTP', 'Acte d\'engagement', 'Bordereau des prix / DPGF'];
  E.libelleDce = (statut, circuit) => { const e = (circuit || []).find(x => x.id === statut); return e ? ['En attente : ' + e.libelle.toLowerCase(), 'alerte'] : (E.L.dce[statut] || [statut, 'neutre']); };
  E.badgeDce = (statut, circuit) => { const x = E.libelleDce(statut, circuit); return U.badge(x[0], x[1]); };

  async function variables(c) {
    const lots = await D.lister('lots', { consultation_id: c.id }, { ordre: 'numero' });
    let criteres = '';
    for (const l of lots) { const cr = E.ordonnerCriteres(await D.lister('criteres', { lot_id: l.id })); if (cr.length) criteres += (lots.length > 1 ? 'Lot ' + l.numero + ' :\n' : '') + cr.map(x => (x.niveau > 1 ? '   ' : '') + x.code + ' — ' + x.libelle + ' : ' + U.nombre(x.ponderation) + ' points').join('\n') + '\n'; }
    return { organisme: window.CONFIG.organisme || '', reference: c.reference, objet: c.objet, procedure: c.procedure, type_marche: c.type_marche || '', nature: E.L.nature[c.nature] || '', service: c.service || '',
      date_limite: c.date_limite_offres ? U.date(c.date_limite_offres) : '', montant_estime: c.montant_estime ? U.euros(c.montant_estime) : '', lots: lots.map(l => 'Lot ' + l.numero + ' — ' + l.intitule).join('\n'), criteres: criteres.trim() };
  }
  // Contenu mis en forme (éditeur riche) → blocs d'export ; sans contenu_html, le texte brut est converti (titres ARTICLE/TITRE/CHAPITRE, puces « - »).
  const htmlDoc = d => d.contenu_html ? Editeur.reconstruire(d.contenu || '', d.contenu_html) : Editeur.htmlDepuisTexte(d.contenu || '');
  E.blocsDocumentDce = d => Editeur.blocsExport(htmlDoc(d));
  const remplir = (texte, v) => texte.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ? v[k] : m);

  // Contrôles automatiques : simples signalements à vérifier.
  async function contexteDce(c) {
    const lots = await D.lister('lots', { consultation_id: c.id }, { ordre: 'numero' }); const criteres = await D.lister('criteres', { consultation_id: c.id });
    const params = (await D.lister('parametres', { id: 'seuils' }))[0];
    return { lots, criteres, seuils: Object.assign({}, Calcul.SEUILS_DEFAUT, params && params.valeur) };
  }
  function controles(doc, c, ctx) {
    const a = []; const t = doc.contenu || '';
    if (ctx && /Règlement/.test(doc.type_piece)) {
      // Critères du règlement comparés à la grille d'analyse paramétrée (lot 1 ou lot unique)
      const lus = Calcul.lireCriteres(t); const lot1 = ctx.lots[0];
      const grille = lot1 ? ctx.criteres.filter(x => x.lot_id === lot1.id) : [];
      if (lus.length && grille.length) for (const k of grille) { const l = lus.find(x => x.code === k.code); if (!l) a.push('Le critère ' + k.code + ' de la grille (« ' + k.libelle + ' ») n\'apparaît pas dans le règlement'); else if (Number(l.ponderation) !== Number(k.ponderation)) a.push('Critère ' + k.code + ' : ' + l.ponderation + ' points dans le règlement, ' + k.ponderation + ' dans la grille'); }
      if (lus.length) { const tot = Calcul.somme(lus.filter(x => !x.parent).map(x => x.ponderation)); if (Math.abs(tot - 100) > 0.01) a.push('Les critères du règlement totalisent ' + tot + ' points au lieu de 100'); }
      for (const l of ctx.lots) if (ctx.lots.length > 1 && !new RegExp('lot\\s*(n\\s*[°o]\\s*)?' + l.numero + '\\b', 'i').test(t)) a.push('Le lot ' + l.numero + ' n\'est pas cité dans le règlement');
    }
    if (ctx && c.montant_estime) { const aide = Calcul.aideProcedure(c.nature, Number(c.montant_estime), ctx.seuils); if (aide.niveau === 4 && /adaptée|MAPA/i.test(c.procedure || '')) a.push('Montant estimé de ' + Calcul.euros(c.montant_estime) + ' HT : il atteint le seuil de la procédure formalisée, alors que la procédure retenue est adaptée'); }
    const restantes = Array.from(new Set((t.match(/\{\{\w+\}\}/g) || []))); if (restantes.length) a.push('Variables non renseignées : ' + restantes.join(', '));
    const trous = (t.match(/\[à compléter[^\]]*\]/gi) || []).length; if (trous) a.push(trous + ' passage(s) « [à compléter] » restant(s)');
    if (!t.includes(c.reference)) a.push('La référence de la consultation (' + c.reference + ') n\'apparaît pas dans le document');
    if (c.date_limite_offres && /Règlement/.test(doc.type_piece) && !t.includes(U.date(c.date_limite_offres))) a.push('La date limite de remise des offres de la fiche (' + U.date(c.date_limite_offres) + ') n\'apparaît pas dans le règlement');
    const dates = Array.from(new Set(t.match(/\b\d{2}\/\d{2}\/\d{4}\b/g) || [])); if (/Règlement/.test(doc.type_piece) && dates.length > 1 && c.date_limite_offres) a.push('Plusieurs dates figurent dans le document (' + dates.join(', ') + ') : vérifier leur cohérence');
    if (t.trim().length < 200) a.push('Document très court : vérifier qu\'il est complet');
    return a;
  }

  E.ongletDce = async function (id) {
    const c = await E.chargerConsultation(id);
    const circuit = await D.circuitDce(); const ctx = await contexteDce(c);
    const [docs, modeles, pieces] = await Promise.all([D.lister('documents_dce', { consultation_id: id }, { ordre: 'type_piece' }), D.lister('modeles_document', { type: 'dce' }, { ordre: 'nom' }), D.lister('pieces', { consultation_id: id })]);
    // Pièces jointes du DCE : ni pièces d'offre, ni pièces de marché (rangées sous la consultation en ligne).
    const jointes = pieces.filter(p => !p.offre_id && !p.marche_id && !p.ged_seule); // ged_seule : déposée dans la GED, hors DCE
    const peut = D.peut('dce.rediger');
    const requis = REQUIS(c.procedure);
    const creer = () => U.editer('Nouveau document du DCE', [
      { nom: 'type_piece', libelle: 'Type de document', type: 'choix', requis: true, options: TYPES_DCE.map(t => [t, t]) },
      { nom: 'modele_id', libelle: 'Modèle', type: 'choix', options: modeles.filter(m => m.actif !== false).map(m => [m.id, m.categorie + ' — ' + m.nom + ' (v' + m.version + ')']), aide: 'Le document est prérempli avec les données de la consultation. Sans modèle, il est créé vide.' },
      { nom: 'titre', libelle: 'Titre', large: true, aide: 'Par défaut : type de document et référence.' }], {}, async v => {
      const m = modeles.find(x => x.id === v.modele_id); const contenu = m ? remplir(m.contenu, await variables(c)) : '';
      const titre = v.titre || v.type_piece + ' — ' + c.reference;
      const d = await D.creer('documents_dce', { consultation_id: id, type_piece: v.type_piece, titre, contenu, version: 1, statut: 'redaction', modele_id: m ? m.id : null, redacteur_nom: D.utilisateur.nom, modifie_le: D.maintenant() }, { action: 'Création d\'un document du DCE' + (m ? ' depuis le modèle « ' + m.nom + ' »' : ''), libelle: titre, consultation_id: id });
      await D.creer('documents_versions', { document_id: d.id, consultation_id: id, version: 1, contenu, auteur_nom: D.utilisateur.nom, date: D.maintenant(), commentaire: m ? 'Création depuis le modèle « ' + m.nom + ' » version ' + m.version : 'Création' }, false);
      setTimeout(() => U.aller('/consultation/' + id + '/dce/' + d.id), 30);
    }, { libelle: 'Créer' });
    return h('div', E.enteteConsultation(c, 'dce'),
      U.carte('Contrôle de complétude du dossier', [h('p.aide', 'Documents attendus pour la procédure « ' + c.procedure + ' ». Signalement à vérifier : la liste dépend du montage retenu. ', h('a', { href: '#/procedure?consultation=' + id }, 'Vérifier la procédure avec les seuils 2026')),
        h('div.actions', requis.map(t => { const d = docs.filter(x => x.type_piece === t); const ok = d.some(x => ['valide', 'publie'].includes(x.statut)); return U.badge(t + ' : ' + (!d.length ? 'absent' : ok ? 'validé' : 'en cours'), !d.length ? 'danger' : ok ? 'ok' : 'alerte'); }))]),
      U.carte('Documents du dossier de consultation', U.tableau([
        { titre: 'Type', valeur: d => d.type_piece }, { titre: 'Titre', valeur: d => h('b', d.titre) }, { titre: 'Version', classe: 'etroit', valeur: d => 'v' + d.version },
        { titre: 'Dernière modification', valeur: d => [U.dateHeure(d.modifie_le), h('div.aide', d.redacteur_nom)] }, { titre: 'État', valeur: d => E.badgeDce(d.statut, circuit) },
        { titre: 'Signalements', valeur: d => { const n = controles(d, c, ctx).length; return n ? U.badge(n + ' à vérifier', 'alerte') : U.badge('Aucun', 'ok'); } }],
        docs, { surClic: d => U.aller('/consultation/' + id + '/dce/' + d.id), vide: 'Aucun document. Créez les pièces du DCE à partir des modèles.' }), [peut ? U.bouton('Nouveau document', creer, 'accent') : null, D.peut('dce.publier') ? U.bouton('Paquet de publication (ZIP)', () => E.paquetPublication(c, docs, jointes, circuit), 'secondaire') : null]),
      U.carte('Pièces jointes du dossier (plans, annexes, études)', U.tableau([{ titre: 'Fichier', valeur: p => h('button.lien', { type: 'button', onclick: () => E.lirePiece(p) }, p.nom_fichier) }, { titre: 'Taille', valeur: p => U.taille(p.taille) }, { titre: 'Déposée', valeur: p => U.dateHeure(p.depose_le) + ' — ' + p.depose_par_nom }], jointes, { vide: 'Aucune pièce jointe.' }),
        peut ? [h('label.bouton.secondaire', 'Joindre des fichiers', h('input', { type: 'file', multiple: true, hidden: true, onchange: U.agir(async e => { await E.deposerPieces(Array.from(e.target.files), { consultation_id: id, type_piece: 'Autre pièce' }, 'DCE ' + c.reference); U.recharger(); }) }))] : null));
  };
  U.route('/consultation/:id/dce', E.ongletDce);

  // Paquet de publication : pièces validées en PDF, pièces jointes, fiche de l'avis en JSON, à charger sur le profil d'acheteur.
  E.paquetPublication = async function (c, docs, jointes, circuit) {
    const prets = docs.filter(d => ['valide', 'publie'].includes(d.statut));
    if (!prets.length) throw new Error('Aucun document validé : le paquet de publication ne contient que des pièces validées.');
    await Docs.charger('jszip'); const zip = new JSZip();
    const lots = await D.lister('lots', { consultation_id: c.id }, { ordre: 'numero' }); const criteres = await D.lister('criteres', { consultation_id: c.id });
    for (const d of prets) zip.file('pieces/' + d.type_piece.replace(/[^\w\- ]+/g, '_') + ' - v' + d.version + '.pdf', await Docs.pdf({ titre: d.titre, sousTitre: (window.CONFIG.organisme || '') + ' — ' + c.reference, pied: d.titre + ' — v' + d.version, blocs: E.blocsDocumentDce(d) }));
    for (const p of jointes) { const b = await D.telecharger(p.chemin); if (b) zip.file('annexes/' + p.nom_fichier, b); }
    const avis = { format: 'vavang-publication/1.0', acheteur: { nom: window.CONFIG.organismeComplet || window.CONFIG.organisme || '' }, reference: c.reference, objet: c.objet, nature: c.nature, procedure: c.procedure, type_marche: c.type_marche || null,
      montant_estime_ht: c.montant_estime || null, date_limite_remise: c.date_limite_offres || null, lots: lots.map(l => ({ numero: l.numero, intitule: l.intitule, montant_estime_ht: l.montant_estime || null,
        criteres: criteres.filter(k => k.lot_id === l.id).map(k => ({ code: k.code, libelle: k.libelle, ponderation: k.ponderation })) })),
      pieces: prets.map(d => ({ type: d.type_piece, titre: d.titre, version: d.version, etat: d.statut })), genere_le: D.maintenant(), genere_par: D.utilisateur.nom };
    zip.file('avis.json', JSON.stringify(avis, null, 2));
    zip.file('LISEZMOI.txt', 'Paquet de publication — ' + c.reference + '\r\nPièces validées du DCE (PDF), annexes, et fiche de l\'avis (avis.json) reprenant l\'acheteur, l\'objet, la procédure, les lots, les critères et la date limite.\r\nÀ charger sur le profil d\'acheteur : vavang ne publie pas directement sur une plateforme de dématérialisation.');
    U.telechargerBlob(await zip.generateAsync({ type: 'blob' }), 'publication-' + c.reference + '.zip');
    await D.journal('Génération du paquet de publication', 'consultations', c.id, c.reference + ' — ' + prets.length + ' pièce(s)', null, c.id);
  };
  E.documentDce = async function (id, did) {
    const c = await E.chargerConsultation(id);
    const d = await D.lire('documents_dce', did); if (!d) throw new Error('Document introuvable.');
    const circuit = await D.circuitDce(); const ctx = await contexteDce(c); const ids = circuit.map(e => e.id); const idx = ids.indexOf(d.statut);
    const ETAPES = ['redaction'].concat(ids, ['valide', 'publie']);
    const [versions, validations, clauses] = await Promise.all([D.lister('documents_versions', { document_id: did }, { ordre: 'version', desc: true }), D.lister('validations', { objet_type: 'documents_dce', objet_id: did }, { ordre: 'date' }), D.lister('modeles_document', { type: 'clause' }, { ordre: 'nom' })]);
    const modifiable = D.peut('dce.rediger') && d.statut === 'redaction';
    // Éditeur riche : le texte brut (contenu) reste la référence des contrôles et du circuit ; la mise en forme est dans contenu_html.
    const ed = Editeur.creer({ html: d.contenu_html, texte: d.contenu || '', lectureSeule: !modifiable }); const htmlInitial = ed.html();
    const tr = (action, detail) => ({ action, libelle: d.titre, consultation_id: id, detail });
    const passer = async (statut, etape, decision, commentaire) => {
      await D.modifier('documents_dce', did, { statut }, tr(etape, { commentaire }));
      await D.creer('validations', { objet_type: 'documents_dce', objet_id: did, consultation_id: id, etape, decision, commentaire: commentaire || '', version: d.version, auteur_id: D.utilisateur.id, auteur_nom: D.utilisateur.nom, date: D.maintenant() }, false);
      U.message(etape + '.'); U.recharger();
    };
    const avecMotif = (titre, statut, etape, decision) => U.editer(titre, [{ nom: 'commentaire', libelle: 'Commentaire (obligatoire)', type: 'long', requis: true }], {}, v => passer(statut, etape, decision, v.commentaire), { libelle: 'Confirmer' });
    const enregistrer = () => U.editer('Enregistrer une nouvelle version', [{ nom: 'commentaire', libelle: 'Nature des modifications', requis: true, large: true }], {}, async v => {
      const n = d.version + 1; const contenu = ed.texte(), contenu_html = ed.html();
      await D.modifier('documents_dce', did, { contenu, contenu_html, version: n, redacteur_nom: D.utilisateur.nom, modifie_le: D.maintenant() }, tr('Nouvelle version du document (v' + n + ')', v));
      await D.creer('documents_versions', { document_id: did, consultation_id: id, version: n, contenu, contenu_html, auteur_nom: D.utilisateur.nom, date: D.maintenant(), commentaire: v.commentaire }, false);
    });
    const actions = [];
    if (modifiable) { actions.push(U.bouton('Enregistrer (nouvelle version)', enregistrer, 'accent'));
      if (clauses.length) actions.push(U.bouton('Insérer une clause', () => { const m = U.modale('Bibliothèque de clauses', h('div', h('p.aide', 'Clauses proposées pour ce type de document en premier. La clause est insérée à l\'emplacement du curseur ; enregistrez ensuite une nouvelle version.'),
        clauses.filter(x => x.actif !== false).sort((a, b) => (b.categorie === d.type_piece) - (a.categorie === d.type_piece)).map(x => h('div.bloc-critere', h('header', h('h3', x.nom), h('span', x.categorie === d.type_piece ? U.badge('Suggérée pour ce document', 'ok') : U.badge(x.categorie, 'neutre'))), h('p', { style: { whiteSpace: 'pre-wrap', fontSize: '.88rem' } }, x.contenu),
          h('button.bouton.secondaire.petit', { type: 'button', onclick: () => { ed.inserer(x.contenu); m.fermer(); U.message('Clause insérée : pensez à enregistrer.', 'info'); } }, 'Insérer')))), { large: true }); }, 'secondaire'));
      actions.push(U.bouton('Soumettre (' + circuit[0].libelle + ')', async () => { if (ed.texte() !== d.contenu || ed.html() !== htmlInitial) throw new Error('Enregistrez d\'abord vos modifications.'); await passer(ids[0], 'Soumis à : ' + circuit[0].libelle, 'soumis'); if (E.notifierDroit) await E.notifierDroit(circuit[0].droit, 'Document à traiter (' + circuit[0].libelle + ') : ' + d.titre, '/consultation/' + id + '/dce/' + did, id); }, 'secondaire')); }
    if (idx >= 0 && D.peut(circuit[idx].droit)) {
      const e = circuit[idx], suivante = circuit[idx + 1];
      actions.push(U.bouton('Approuver (' + e.libelle + ')', async () => { await passer(suivante ? suivante.id : 'valide', e.libelle + ' : approuvé' + (suivante ? '' : ' — document validé'), 'approuve'); if (suivante && E.notifierDroit) await E.notifierDroit(suivante.droit, 'Document à traiter (' + suivante.libelle + ') : ' + d.titre, '/consultation/' + id + '/dce/' + did, id); }, 'accent'));
      actions.push(U.bouton('Renvoyer en rédaction', () => avecMotif('Renvoyer en rédaction', 'redaction', e.libelle + ' : renvoyé en rédaction', 'refuse'), 'secondaire'));
    }
    if (d.statut === 'valide' && D.peut('dce.publier')) actions.push(U.bouton('Marquer comme publié', async () => { if (await U.confirmer('Publication', 'Le document sera marqué comme publié et ne pourra plus être modifié. La mise en ligne sur le profil d\'acheteur reste à faire sur la plateforme de dématérialisation.', 'Marquer publié')) await passer('publie', 'Document publié', 'approuve'); }, 'accent'));
    if (['valide', 'publie'].includes(d.statut) && D.peut('dce.rediger')) actions.push(U.bouton('Rouvrir pour modification', () => avecMotif('Rouvrir le document', 'redaction', 'Réouverture pour modification', 'refuse'), 'secondaire'));
    const exp = async f => { const doc = { titre: d.titre, sousTitre: (window.CONFIG.organisme || '') + ' — ' + c.reference + ' — version ' + d.version + ' — ' + E.libelleDce(d.statut, circuit)[0], pied: d.titre + ' — v' + d.version,
      blocs: E.blocsDocumentDce(d) };
      U.telechargerBlob(f === 'pdf' ? await Docs.pdf(doc) : await Docs.word(doc), d.titre.replace(/[^\w\-]+/g, '_') + '-v' + d.version + (f === 'pdf' ? '.pdf' : '.docx')); await D.journal('Export d\'un document du DCE (' + (f === 'pdf' ? 'PDF' : 'Word') + ')', 'documents_dce', did, d.titre, null, id); };
    actions.push(U.bouton('Word', () => exp('word'), 'secondaire'), U.bouton('PDF', () => exp('pdf'), 'secondaire'));
    const sig = controles(d, c, ctx);
    return h('div', U.fil([['Consultations', '/consultations'], [c.reference, '/consultation/' + id], ['Dossier de consultation', '/consultation/' + id + '/dce'], [d.type_piece]]),
      U.titrePage(d.titre, d.type_piece + ' · version ' + d.version, [E.badgeDce(d.statut, circuit)]),
      h('div.etapes', ETAPES.map((s, i) => { const e = circuit.find(x => x.id === s); return h('span' + (s === d.statut ? '.courant' : i < ETAPES.indexOf(d.statut) ? '.fait' : ''), e ? e.libelle : E.L.dce[s][0]); })),
      sig.length ? h('div.note-info.alerte', h('b', 'Contrôles automatiques — à vérifier :'), h('ul', { style: { margin: '4px 0 0 18px', padding: 0 } }, sig.map(s => h('li', s)))) : h('div.note-info.ok', 'Contrôles automatiques : aucun signalement.'),
      U.carte('Contenu', [modifiable ? null : h('p.aide', d.statut === 'redaction' ? 'Lecture seule : votre profil ne permet pas de rédiger.' : 'Lecture seule : le document est dans le circuit de validation.'), ed.element], actions),
      h('div.grille2',
        U.carte('Versions', U.tableau([{ titre: 'Version', classe: 'etroit', valeur: v => 'v' + v.version }, { titre: 'Date et heure', valeur: v => U.dateHeure(v.date) }, { titre: 'Auteur', valeur: v => v.auteur_nom }, { titre: 'Modifications', valeur: v => v.commentaire },
          { titre: '', classe: 'etroit', valeur: v => U.bouton('Voir', () => U.modale(d.titre + ' — version ' + v.version, v.contenu_html ? h('div.editeur-zone.lecture', { html: Editeur.assainir(v.contenu_html) }) : h('pre', { style: { whiteSpace: 'pre-wrap', fontFamily: 'var(--serif)', margin: 0 } }, v.contenu), { large: true }), 'secondaire.petit') }], versions)),
        U.carte('Circuit de validation', U.tableau([{ titre: 'Date et heure', valeur: v => U.dateHeure(v.date) }, { titre: 'Étape', valeur: v => [v.etape, v.version ? h('div.aide', 'sur la version ' + v.version) : null] }, { titre: 'Par', valeur: v => v.auteur_nom }, { titre: 'Commentaire', valeur: v => v.commentaire || '—' }], validations, { vide: 'Le document n\'a pas encore été soumis.' }))));
  };
  U.route('/consultation/:id/dce/:did', E.documentDce);

  /* ---------- Bibliothèque de modèles ---------- */
  E.modeles = async function () {
    const onglet = U.param('type') || 'dce';
    const peut = D.peut('modeles.ecrire');
    const infos = { dce: ['Documents du DCE', TYPES_DCE, 'Variables disponibles : {{organisme}} {{reference}} {{objet}} {{procedure}} {{type_marche}} {{nature}} {{service}} {{date_limite}} {{montant_estime}} {{lots}} {{criteres}}'],
      clause: ['Clauses', TYPES_DCE, 'Clauses réutilisables, proposées à l\'insertion dans les documents du type indiqué.'],
      courrier: ['Courriers', ['Demande de précisions', 'Demande de justification du prix', 'Demande de complément', 'Lettre de rejet', 'Notification', 'Autre courrier'], 'Variables disponibles : {{organisme}} {{reference}} {{objet}} {{lot}} {{candidat}} {{date}} {{montant}} {{note_totale}} {{rang}} {{attributaire}} {{note_attributaire}} {{agent}}'] };
    let corps;
    if (onglet === 'grille') {
      const m = await D.lister('modeles_grille', {}, { ordre: 'nom' });
      corps = U.carte('Modèles de grilles d\'analyse', [h('p.aide', 'Un modèle se crée depuis une grille paramétrée (onglet « Analyse » d\'une consultation, bouton « Enregistrer comme modèle »). Chaque enregistrement sous le même nom crée une nouvelle version.'),
        U.tableau([{ titre: 'Nom', valeur: x => h('b', x.nom) }, { titre: 'Version', valeur: x => 'v' + x.version }, { titre: 'Date d\'effet', valeur: x => U.date(x.date_effet) }, { titre: 'Auteur', valeur: x => x.auteur_nom },
          { titre: 'Critères', valeur: x => x.contenu.criteres.filter(y => !y.parent_id).map(y => y.libelle + ' (' + y.ponderation + ')').join(' · ') }, { titre: 'État', valeur: x => x.actif !== false ? U.badge('En vigueur', 'ok') : U.badge('Remplacé', 'neutre') }], m, { vide: 'Aucun modèle de grille.' })]);
    } else {
      const m = await D.lister('modeles_document', { type: onglet }, { ordre: 'nom' }); const inf = infos[onglet];
      const champs = [{ nom: 'nom', libelle: 'Nom du modèle', requis: true }, { nom: 'categorie', libelle: 'Catégorie', type: 'choix', requis: true, options: inf[1].map(t => [t, t]) }, { nom: 'contenu', libelle: 'Contenu', type: 'long', lignes: 16, requis: true, aide: inf[2] }];
      corps = U.carte(inf[0], U.tableau([{ titre: 'Nom', valeur: x => h('b', x.nom) }, { titre: 'Catégorie', valeur: x => x.categorie }, { titre: 'Version', valeur: x => 'v' + x.version }, { titre: 'Modifié', valeur: x => U.date(x.modifie_le) + ' — ' + (x.auteur_nom || '') },
        { titre: '', classe: 'etroit', valeur: x => peut ? U.bouton('Modifier', () => U.editer('Modifier le modèle', champs, x, v => D.modifier('modeles_document', x.id, Object.assign(v, { version: x.version + 1, auteur_nom: D.utilisateur.nom, modifie_le: D.maintenant() }), { action: 'Modification d\'un modèle (v' + (x.version + 1) + ')', libelle: v.nom }), { large: true }), 'secondaire.petit') : null }], m, { vide: 'Aucun modèle.' }),
        peut ? [U.bouton('Nouveau modèle', () => U.editer('Nouveau modèle', champs, {}, v => D.creer('modeles_document', Object.assign({ type: onglet, version: 1, actif: true, auteur_nom: D.utilisateur.nom, modifie_le: D.maintenant() }, v), { action: 'Création d\'un modèle', libelle: v.nom }), { large: true }), 'accent')] : null);
    }
    return h('div', U.titrePage('Modèles', 'Documents, clauses, courriers et grilles réutilisables.'),
      U.onglets([['dce', 'Documents du DCE'], ['clause', 'Clauses'], ['courrier', 'Courriers'], ['grille', 'Grilles d\'analyse']], onglet, o => U.aller('/modeles?type=' + o)), corps);
  };
  U.route('/modeles', E.modeles);
})();
