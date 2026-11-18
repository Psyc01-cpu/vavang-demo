/* GED du dossier de consultation : arborescence libre de dossiers, rangement des pièces (glisser-déposer ou sélecteur).
   Stockage, sans nouvelle table :
   - l'arborescence est un tableau « ged_dossiers » [{ id, nom, parent_id }] dans le document de la consultation
     (écriture : habilitation « consultations.ecrire », comme la fiche de la consultation) ;
   - le rangement d'une pièce est le champ « ged_dossier_id » de la pièce (table pieces ; écriture : profils qui déposent des pièces).
   Une pièce sans dossier (ou dont le dossier a disparu) apparaît dans « Non classées ». */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const RACINE = '';
  const TYPE_MIME = 'application/x-vavang-piece';

  // Onglet ajouté après « Dossier de consultation ».
  if (E.ONGLETS && !E.ONGLETS.some(o => o[0] === 'ged')) { const i = E.ONGLETS.findIndex(o => o[0] === 'dce'); E.ONGLETS.splice(i >= 0 ? i + 1 : E.ONGLETS.length, 0, ['ged', 'Documents (GED)']); }

  const peutDossiers = () => D.peut('consultations.ecrire');
  const peutRanger = () => ['analyse.saisir', 'analyse.valider', 'dce.rediger', 'execution.ecrire', 'reprise.importer'].some(D.peut);

  // Chemin lisible d'un dossier : « Administratif › Assurances ».
  function chemin(dossiers, id) {
    const noms = []; let x = dossiers.find(d => d.id === id); const vus = new Set();
    while (x && !vus.has(x.id)) { vus.add(x.id); noms.unshift(x.nom); x = dossiers.find(d => d.id === x.parent_id); }
    return noms.join(' › ');
  }
  const descendants = (dossiers, id) => { const r = []; const pile = [id]; while (pile.length) { const p = pile.pop(); for (const d of dossiers.filter(x => x.parent_id === p)) { r.push(d.id); pile.push(d.id); } } return r; };
  const optionsDossiers = (dossiers, exclure) => [[RACINE, 'Non classées (racine)']].concat(dossiers.filter(d => !(exclure || []).includes(d.id)).map(d => [d.id, chemin(dossiers, d.id)]).sort((a, b) => a[1].localeCompare(b[1], 'fr')));

  async function enregistrerDossiers(c, dossiers, action, libelle) {
    if (!peutDossiers()) throw new Error('Votre profil ne permet pas de modifier l\'arborescence du dossier.');
    await D.modifier('consultations', c.id, { ged_dossiers: dossiers }, { action, libelle: c.reference + ' — ' + libelle, consultation_id: c.id });
  }
  async function ranger(piece, dossierId, dossiers, cid) {
    if (!peutRanger()) throw new Error('Votre profil ne permet pas de ranger les pièces.');
    if ((piece.ged_dossier_id || RACINE) === (dossierId || RACINE)) return false;
    await D.modifier('pieces', piece.id, { ged_dossier_id: dossierId || null }, { action: 'Rangement d\'une pièce (GED)', libelle: piece.nom_fichier + ' → ' + (dossierId ? chemin(dossiers, dossierId) : 'Non classées'), consultation_id: cid });
    return true;
  }
  E.gedChemin = chemin;

  E.ongletGed = async function (id) {
    const c = await E.chargerConsultation(id);
    const dossiers = Array.isArray(c.ged_dossiers) ? c.ged_dossiers.filter(d => d && d.id && d.nom) : [];
    const [pieces, offres] = await Promise.all([D.lister('pieces', { consultation_id: id }, { ordre: 'nom_fichier', colonnes: ['nom_fichier', 'type_piece', 'taille', 'depose_le', 'depose_par_nom', 'offre_id', 'marche_id', 'lot_id', 'consultation_id', 'ged_dossier_id', 'ged_seule', 'chemin', 'mime'] }), D.lister('offres', { consultation_id: id })]);
    const existe = new Set(dossiers.map(d => d.id));
    const dossierDe = p => (p.ged_dossier_id && existe.has(p.ged_dossier_id)) ? p.ged_dossier_id : RACINE;
    let actif = U.param('dossier') || RACINE; if (actif && !existe.has(actif)) actif = RACINE;
    const voir = d => U.aller('/consultation/' + id + '/ged' + (d ? '?dossier=' + encodeURIComponent(d) : ''));
    const origine = p => p.offre_id ? 'Pli — ' + ((offres.find(o => o.id === p.offre_id) || {}).candidat || 'offre') : p.marche_id ? 'Marché' : p.ged_seule ? 'GED' : 'DCE';

    // Glisser-déposer : une ligne de pièce se dépose sur un dossier de l'arborescence.
    const cible = (dossierId, el) => {
      if (!peutRanger()) return el;
      el.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes(TYPE_MIME)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('survol'); } });
      el.addEventListener('dragleave', () => el.classList.remove('survol'));
      el.addEventListener('drop', U.agir(async e => {
        e.preventDefault(); el.classList.remove('survol');
        const pid = e.dataTransfer.getData(TYPE_MIME); const p = pieces.find(x => x.id === pid); if (!p) return;
        if (await ranger(p, dossierId, dossiers, id)) { U.message('« ' + p.nom_fichier + ' » rangée dans ' + (dossierId ? '« ' + chemin(dossiers, dossierId) + ' »' : 'Non classées') + '.'); U.recharger(); }
      }));
      return el;
    };
    const noeud = (d, niveau) => {
      const n = pieces.filter(p => dossierDe(p) === d.id).length; const enfants = dossiers.filter(x => x.parent_id === d.id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      return h('li', { role: 'treeitem', 'aria-level': String(niveau), 'aria-expanded': enfants.length ? 'true' : null, 'aria-selected': d.id === actif ? 'true' : 'false' },
        cible(d.id, h('button.ged-noeud' + (d.id === actif ? '.actif' : ''), { type: 'button', 'data-dossier': d.id, onclick: () => voir(d.id) }, h('span.ged-icone', { 'aria-hidden': 'true' }, '▸'), d.nom, h('span.ged-compte', String(n)))),
        enfants.length ? h('ul', { role: 'group' }, enfants.map(x => noeud(x, niveau + 1))) : null);
    };
    const racines = dossiers.filter(d => !d.parent_id || !existe.has(d.parent_id)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const arbre = h('ul.ged-arbre', { role: 'tree', 'aria-label': 'Dossiers de la consultation' },
      h('li', { role: 'treeitem', 'aria-level': '1', 'aria-selected': actif === RACINE ? 'true' : 'false' },
        cible(RACINE, h('button.ged-noeud' + (actif === RACINE ? '.actif' : ''), { type: 'button', 'data-dossier': '', onclick: () => voir('') }, h('span.ged-icone', { 'aria-hidden': 'true' }, '◇'), 'Non classées', h('span.ged-compte', String(pieces.filter(p => dossierDe(p) === RACINE).length))))),
      racines.map(d => noeud(d, 1)));

    const nouveau = parent => U.editer('Nouveau dossier', [{ nom: 'nom', libelle: 'Nom du dossier', requis: true }, { nom: 'parent_id', libelle: 'Dans le dossier', type: 'choix', vide: false, options: optionsDossiers(dossiers) }],
      { parent_id: parent || RACINE }, async v => {
        const nom = v.nom.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120); if (!nom) throw new Error('Nom vide.');
        if (dossiers.some(d => (d.parent_id || RACINE) === (v.parent_id || RACINE) && d.nom.toLowerCase() === nom.toLowerCase())) throw new Error('Un dossier « ' + nom + ' » existe déjà à cet endroit.');
        const d = { id: D.id(), nom, parent_id: v.parent_id || null, cree_par_nom: D.utilisateur.nom, cree_le: D.maintenant() };
        await enregistrerDossiers(c, dossiers.concat([d]), 'Création d\'un dossier (GED)', chemin(dossiers.concat([d]), d.id));
      }, { libelle: 'Créer' });
    const courant = dossiers.find(d => d.id === actif);
    const renommer = () => U.editer('Renommer le dossier', [{ nom: 'nom', libelle: 'Nouveau nom', requis: true }, { nom: 'parent_id', libelle: 'Déplacer dans', type: 'choix', vide: false, options: optionsDossiers(dossiers, [courant.id].concat(descendants(dossiers, courant.id))) }],
      { nom: courant.nom, parent_id: courant.parent_id || RACINE }, async v => {
        const nom = v.nom.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120); if (!nom) throw new Error('Nom vide.');
        if (dossiers.some(d => d.id !== courant.id && (d.parent_id || RACINE) === (v.parent_id || RACINE) && d.nom.toLowerCase() === nom.toLowerCase())) throw new Error('Un dossier « ' + nom + ' » existe déjà à cet endroit.');
        const avant = chemin(dossiers, courant.id);
        const liste = dossiers.map(d => d.id === courant.id ? Object.assign({}, d, { nom, parent_id: v.parent_id || null }) : d);
        await enregistrerDossiers(c, liste, 'Renommage d\'un dossier (GED)', avant + ' → ' + chemin(liste, courant.id));
      });
    const supprimer = async () => {
      const dedans = pieces.filter(p => dossierDe(p) === courant.id).length, sous = dossiers.filter(d => d.parent_id === courant.id).length;
      const ou = courant.parent_id && existe.has(courant.parent_id) ? '« ' + chemin(dossiers, courant.parent_id) + ' »' : '« Non classées »';
      if (!await U.confirmer('Supprimer le dossier', 'Le dossier « ' + chemin(dossiers, courant.id) + ' » est supprimé. Aucune pièce n\'est supprimée : ' + dedans + ' pièce(s) et ' + sous + ' sous-dossier(s) remontent dans ' + ou + '.', 'Supprimer le dossier')) return;
      const parent = courant.parent_id && existe.has(courant.parent_id) ? courant.parent_id : null;
      const liste = dossiers.filter(d => d.id !== courant.id).map(d => d.parent_id === courant.id ? Object.assign({}, d, { parent_id: parent }) : d);
      // Les pièces remontent d'abord (si l'enregistrement de l'arborescence échoue, rien n'est perdu).
      for (const p of pieces.filter(x => x.ged_dossier_id === courant.id)) await ranger(p, parent, liste, id);
      await enregistrerDossiers(c, liste, 'Suppression d\'un dossier (GED)', chemin(dossiers, courant.id));
      U.message('Dossier supprimé.'); voir(parent || '');
    };
    const deposer = U.agir(async e => {
      const fichiers = Array.from(e.target.files); if (!fichiers.length) return;
      const crees = await E.deposerPieces(fichiers, { consultation_id: id, type_piece: 'Pièce du dossier' }, 'GED ' + c.reference);
      for (const p of crees) await D.modifier('pieces', p.id, { ged_dossier_id: actif || null, ged_seule: true }, false);
      U.message(crees.length + ' fichier(s) déposé(s) dans ' + (courant ? '« ' + chemin(dossiers, courant.id) + ' »' : 'Non classées') + '.'); U.recharger();
    });

    const affichees = pieces.filter(p => dossierDe(p) === actif);
    const lignes = U.tableau([
      { titre: 'Fichier', valeur: p => h('button.lien', { type: 'button', onclick: U.agir(async () => E.lirePiece(await D.lire('pieces', p.id) || p)) }, p.nom_fichier) },
      { titre: 'Type', valeur: p => p.type_piece || '—' }, { titre: 'Origine', valeur: p => origine(p) }, { titre: 'Taille', classe: 'etroit', valeur: p => U.taille(p.taille) },
      { titre: 'Déposée', valeur: p => [U.dateHeure(p.depose_le), h('div.aide', p.depose_par_nom || '')] },
      { titre: 'Ranger dans', valeur: p => peutRanger() ? h('select.saisie.ged-ranger', { 'aria-label': 'Ranger « ' + p.nom_fichier + ' » dans', 'data-piece': p.id, onchange: U.agir(async e => {
        if (await ranger(p, e.target.value || null, dossiers, id)) { U.message('Pièce rangée.'); U.recharger(); } }) },
        optionsDossiers(dossiers).map(o => h('option', { value: o[0], selected: o[0] === dossierDe(p) }, o[1]))) : (dossierDe(p) ? chemin(dossiers, dossierDe(p)) : 'Non classées') }],
      affichees, { vide: actif ? 'Ce dossier ne contient aucune pièce. Glissez une pièce sur son nom, ou utilisez « Ranger dans ».' : 'Toutes les pièces sont rangées.' });
    // Lignes glissables (la pièce se dépose sur un dossier de l'arborescence).
    if (peutRanger()) Array.from(lignes.querySelectorAll('tbody tr')).forEach((tr, i) => {
      const p = affichees[i]; tr.draggable = true; tr.classList.add('ged-glissable'); tr.dataset.piece = p.id; tr.title = 'Glisser sur un dossier pour ranger la pièce';
      tr.addEventListener('dragstart', e => { e.dataTransfer.setData(TYPE_MIME, p.id); e.dataTransfer.setData('text/plain', p.nom_fichier); e.dataTransfer.effectAllowed = 'move'; tr.classList.add('glisse'); });
      tr.addEventListener('dragend', () => tr.classList.remove('glisse'));
    });

    const titreZone = courant ? chemin(dossiers, courant.id) : 'Non classées';
    return h('div', E.enteteConsultation(c, 'ged'),
      h('div.ged',
        U.carte('Arborescence', [arbre, h('p.aide', { style: { marginTop: '10px' } }, dossiers.length + ' dossier(s), ' + pieces.length + ' pièce(s). Glissez une pièce sur un dossier pour l\'y ranger.')],
          peutDossiers() ? [U.bouton('Nouveau dossier', () => nouveau(actif), 'accent.petit')] : null),
        U.carte(titreZone + ' — ' + affichees.length + ' pièce(s)', [
          h('p.aide', 'Toutes les pièces de la consultation : pièces jointes du DCE, pièces des plis, pièces déposées ici. Le rangement ne modifie ni la pièce ni sa place dans l\'analyse des offres.'),
          lignes],
          [courant && peutDossiers() ? U.bouton('Sous-dossier', () => nouveau(courant.id), 'secondaire.petit') : null,
            courant && peutDossiers() ? U.bouton('Renommer ou déplacer', renommer, 'secondaire.petit') : null,
            courant && peutDossiers() ? U.bouton('Supprimer le dossier', supprimer, 'secondaire.petit') : null,
            peutRanger() ? h('label.bouton.secondaire.petit', 'Déposer des fichiers ici', h('input', { type: 'file', multiple: true, hidden: true, id: 'ged-depot', onchange: deposer })) : null])));
  };
  U.route('/consultation/:id/ged', E.ongletGed);
})();
