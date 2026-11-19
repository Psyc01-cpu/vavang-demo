/* Reprise de l'existant (tableurs et documents) et export complet des données (réversibilité). */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const CIBLES = {
    marches: { libelle: 'Marchés', cle: 'numero', champs: [['numero', 'Numéro du marché', true, /num|n°|ref/], ['objet', 'Objet', true, /objet|intitule|libelle/], ['titulaire', 'Titulaire', true, /titulaire|attributaire|fournisseur|entreprise/], ['montant_notifie', 'Montant notifié HT', false, /montant|prix/],
      ['date_notification', 'Date de notification', false, /notif/], ['date_debut', 'Date de début', false, /debut|demarrage|effet/], ['duree_mois', 'Durée (mois)', false, /duree/], ['service', 'Service', false, /service|direction/]] },
    fournisseurs: { libelle: 'Fournisseurs', cle: 'raison_sociale', champs: [['raison_sociale', 'Raison sociale', true, /raison|nom|societe|entreprise/], ['siret', 'SIRET', false, /siret|siren/], ['adresse', 'Adresse', false, /adresse/], ['commune', 'Commune', false, /commune|ville/],
      ['contact', 'Interlocuteur', false, /contact|interlocuteur/], ['email', 'Courriel', false, /mail|courriel/], ['telephone', 'Téléphone', false, /tel/], ['domaines', 'Domaines', false, /domaine|activite/]] }
  };
  function lireDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const s = String(v).trim(); let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0].slice(0, 10) : undefined; // undefined = illisible
  }
  function lireNombre(v) { if (v == null || v === '') return null; if (typeof v === 'number') return v; const n = Number(String(v).replace(/[\s €]/g, '').replace(',', '.')); return isNaN(n) ? undefined : n; }

  // Applique les règles de correspondance : renvoie les lignes prêtes et les anomalies, sans rien écrire.
  function preparer(cible, lignes, entetes, corr, existants) {
    const def = CIBLES[cible]; const pretes = [], anomalies = []; const vus = new Set(existants.map(x => norm(x[def.cle])));
    lignes.forEach((l, i) => {
      const o = {}; const pb = [];
      for (const ch of def.champs) { const col = corr[ch[0]]; let v = col === '' || col == null ? null : l[Number(col)];
        if (/date/.test(ch[0])) { v = lireDate(v); if (v === undefined) { pb.push(ch[1] + ' illisible'); v = null; } }
        else if (/montant|duree/.test(ch[0])) { v = lireNombre(v); if (v === undefined) { pb.push(ch[1] + ' non numérique'); v = null; } }
        else v = v == null ? null : String(v).trim() || null;
        if (ch[2] && (v == null || v === '')) pb.push(ch[1] + ' manquant');
        o[ch[0]] = v; }
      const cle = norm(o[def.cle]);
      if (cle && vus.has(cle)) pb.push('Doublon : « ' + o[def.cle] + ' » existe déjà');
      if (pb.length) anomalies.push({ ligne: i + 2, valeur: o[def.cle] || '(vide)', problemes: pb.join(' ; ') }); else { vus.add(cle); pretes.push(o); }
    });
    return { pretes, anomalies };
  }

  /* ---------- Plan de sauvegarde (rotation à plusieurs échéances, voir .github/workflows/sauvegarde.yml) ---------- */
  const DEPOT = (window.CONFIG && CONFIG.depotSauvegarde) || 'Psyc01-cpu/vavang-demo';
  const GH = 'https://github.com/' + DEPOT;
  // [échéance, fréquence, conservation, lieu de stockage, chiffrement, perte maximale si on remonte à cette échéance]
  const ECHEANCES = [
    ['Courante', 'Toutes les 3 heures (minute 17, heure UTC)', '3 jours', 'Artefact GitHub Actions', 'Oui si le secret SAUVEGARDE_CLE existe, sinon non', '3 h'],
    ['Quotidienne', 'Chaque jour à 02:17 UTC (06:17 à La Réunion), sauf le dimanche', '30 jours', 'Artefact GitHub Actions', 'Oui si le secret SAUVEGARDE_CLE existe, sinon non', '24 h (au-delà de 3 jours)'],
    ['Hebdomadaire', 'Le dimanche à 02:17 UTC', '90 jours (maximum de GitHub pour un dépôt public)', 'Artefact GitHub Actions', 'Oui si le secret SAUVEGARDE_CLE existe, sinon non', '7 jours (au-delà de 30 jours)'],
    ['Mensuelle', 'Le premier dimanche du mois, seulement si le secret SAUVEGARDE_CLE existe', '12 mois (les 12 dernières)', 'Release GitHub', 'Oui, toujours : rien n\'est publié sans chiffrement', '1 mois (au-delà de 90 jours)']
  ];
  const ACTIONS_SAUVEGARDE = ['Sauvegarde exportée', 'Export complet des données', 'Restauration de sauvegarde', 'Restauration d\'une sauvegarde'];
  async function cartePlanSauvegarde(genererExport) {
    const enLigne = D.mode === 'supabase';
    let dernieres = null;
    if (D.peut('journal.lire')) {
      try { dernieres = (await D.lister('journal', {}, { ordre: 'date', desc: true, limite: 1000 })).filter(l => ACTIONS_SAUVEGARDE.includes(l.action)).slice(0, 8); } catch (e) { dernieres = null; }
    }
    const lienExterne = (href, texte) => h('a', { href, target: '_blank', rel: 'noopener' }, texte);
    return U.carte('Plan de sauvegarde', [
      h('p', enLigne
        ? 'Version en ligne : la base et les fichiers sont sauvegardés automatiquement, hors de l\'hébergeur, par une action GitHub planifiée. Chaque sauvegarde porte son échéance dans son nom (par exemple « sauvegarde-quotidienne-20261119-0217 », heure UTC).'
        : 'Version installée sur un poste : les données vivent dans ce navigateur et ne sont pas sauvegardées automatiquement. La seule sauvegarde est l\'export complet (archive ZIP), à conserver hors du poste. Le plan ci-dessous s\'applique à la version en ligne.'),
      U.tableau([{ titre: 'Échéance', valeur: e => h('b', e[0]) }, { titre: 'Fréquence', valeur: e => e[1] }, { titre: 'Conservation', valeur: e => e[2] }, { titre: 'Lieu de stockage', valeur: e => e[3] }, { titre: 'Chiffrement', valeur: e => e[4] }, { titre: 'Perte maximale (RPO)', valeur: e => e[5] }], ECHEANCES, { legende: 'Échéances de sauvegarde de la version en ligne' }),
      h('p.aide', 'Le stockage chez GitHub est séparé de la base (Supabase). Les horaires de GitHub ne sont pas garantis : une exécution peut être retardée. À ce jour, le secret SAUVEGARDE_CLE n\'est pas défini sur la démonstration : les artefacts sont en clair (données fictives) et aucune copie mensuelle n\'est publiée. Coût : 0 € (dépôt public).'),
      h('h3', { style: { marginTop: '16px' } }, 'Sauvegarder maintenant'),
      enLigne
        ? h('div', h('p', 'La sauvegarde se lance depuis GitHub, avec un compte qui a les droits d\'écriture sur le dépôt : ouvrez la page de l\'action, cliquez sur « Run workflow », choisissez l\'échéance (courante par défaut) puis confirmez. Elle dure environ une minute et demie ; l\'artefact apparaît en bas de la page de l\'exécution.'),
          h('div.actions', h('a.bouton.accent', { href: GH + '/actions/workflows/sauvegarde.yml', target: '_blank', rel: 'noopener', style: { textDecoration: 'none' } }, 'Sauvegarder maintenant (GitHub)')))
        : h('div', h('p', 'Génère l\'export complet de ce poste (archive ZIP) et le télécharge. Le résultat s\'affiche dans la carte « Export complet des données » ci-dessous.'), h('div.actions', U.bouton('Sauvegarder maintenant', genererExport, 'accent'))),
      h('h3', { style: { marginTop: '16px' } }, 'Dernières sauvegardes'),
      enLigne ? h('p', 'Les sauvegardes elles-mêmes se téléchargent depuis GitHub : ', lienExterne(GH + '/actions/workflows/sauvegarde.yml', 'exécutions de l\'action de sauvegarde'), ' (artefacts ; connexion à GitHub demandée) et ', lienExterne(GH + '/releases', 'releases'), ' (copies mensuelles chiffrées). Leur liste n\'est pas chargée ici : la politique de sécurité de l\'application n\'autorise que les échanges avec son propre serveur.') : null,
      dernieres == null ? h('p.aide', 'Le journal n\'est pas accessible avec votre profil.') : U.tableau([{ titre: 'Date', valeur: l => U.dateHeure(l.date) }, { titre: 'Action', valeur: l => l.action }, { titre: 'Détail', valeur: l => l.objet_libelle || '' }, { titre: 'Par', valeur: l => l.auteur_nom || '' }], dernieres,
        { legende: 'Sauvegardes, exports et restaurations inscrits au journal', vide: enLigne ? 'Aucune sauvegarde inscrite au journal depuis la dernière remise à zéro de la démonstration.' : 'Aucun export ni restauration inscrit au journal.' }),
      dernieres && enLigne ? h('p.aide', 'Ce tableau vient du journal de l\'application. Sur la démonstration, les données sont remises à zéro chaque nuit : il ne montre que les sauvegardes faites depuis.') : null
    ]);
  }

  E.reprise = async function () {
    const peutImporter = D.peut('reprise.importer'), peutExporter = D.peut('export.complet');
    const [reprises, marches, consultations, fournisseurs] = await Promise.all([D.lister('reprises', {}, { ordre: 'date', desc: true }), D.lister('marches', {}, { ordre: 'numero' }), E.consultationsVisibles(), D.lister('fournisseurs')]);
    const zoneImport = h('div');
    const importerTableur = async fichier => {
      const feuilles = await Docs.lireTableur(fichier); const feuille = feuilles.find(f => f.lignes.length > 1) || feuilles[0];
      if (!feuille || feuille.lignes.length < 2) throw new Error('Le fichier ne contient aucune ligne de données.');
      const entetes = feuille.lignes[0].map(String), lignes = feuille.lignes.slice(1).filter(l => l.some(x => String(x).trim() !== ''));
      let cible = /fournisseur|raison/i.test(entetes.join(' ')) && !/march|titulaire/i.test(entetes.join(' ')) ? 'fournisseurs' : 'marches';
      const corr = {}; let resultat = null;
      const deviner = () => { for (const ch of CIBLES[cible].champs) { const i = entetes.findIndex(e => ch[3].test(norm(e))); corr[ch[0]] = i >= 0 ? String(i) : ''; } };
      deviner();
      const dessiner = () => zoneImport.replaceChildren(U.carte('Reprise du fichier « ' + fichier.name + ' »', [
        h('p', lignes.length + ' ligne(s) de données lue(s) dans la feuille « ' + feuille.nom + ' », ' + entetes.length + ' colonne(s).'),
        h('div.champ', { style: { maxWidth: '320px', marginBottom: '12px' } }, h('label', 'Données reprises'), h('select', { onchange: e => { cible = e.target.value; deviner(); resultat = null; dessiner(); } }, Object.entries(CIBLES).map(x => h('option', { value: x[0], selected: x[0] === cible }, x[1].libelle)))),
        h('h3', 'Règles de correspondance'), h('p.aide', 'Associez chaque donnée de la solution à une colonne du fichier. La proposition est faite d\'après les intitulés ; corrigez-la si besoin.'),
        h('div.formulaire', { style: { margin: '8px 0 14px' } }, CIBLES[cible].champs.map(ch => h('div.champ', h('label', ch[1] + (ch[2] ? ' *' : '')), h('select', { 'data-corr': ch[0], onchange: e => { corr[ch[0]] = e.target.value; resultat = null; dessiner(); } }, h('option', { value: '' }, '— non repris —'), entetes.map((e, i) => h('option', { value: i, selected: String(i) === corr[ch[0]] }, e)))))),
        h('div.actions', U.bouton('Reprise à blanc (contrôle sans écriture)', async () => { resultat = preparer(cible, lignes, entetes, corr, cible === 'marches' ? marches : fournisseurs); await D.journal('Reprise à blanc', 'reprises', null, fichier.name, { lignes: lignes.length, pretes: resultat.pretes.length, anomalies: resultat.anomalies.length }); dessiner(); }, 'accent')),
        resultat ? h('div', { style: { marginTop: '14px' } }, h('h3', 'Rapport de contrôle'),
          h('div.note-info' + (resultat.anomalies.length ? '.alerte' : '.ok'), resultat.pretes.length + ' ligne(s) prête(s) à être reprise(s), ' + resultat.anomalies.length + ' ligne(s) en anomalie (non reprises). Le fichier source est conservé tel quel.'),
          U.tableau([{ titre: 'Ligne du fichier', classe: 'etroit', valeur: a => a.ligne }, { titre: 'Élément', valeur: a => a.valeur }, { titre: 'Anomalie', valeur: a => a.problemes }], resultat.anomalies, { vide: 'Aucune anomalie.' }),
          resultat.pretes.length ? h('div.actions', { style: { marginTop: '10px' } }, U.bouton('Reprise définitive de ' + resultat.pretes.length + ' ligne(s)', async () => {
            const chemin = await D.deposer(fichier, 'reprises');
            const r = await D.creer('reprises', { date: D.maintenant(), auteur_nom: D.utilisateur.nom, source: fichier.name, chemin, cible, nb_lignes: lignes.length, nb_creees: resultat.pretes.length, nb_anomalies: resultat.anomalies.length, anomalies: resultat.anomalies, correspondance: Object.fromEntries(CIBLES[cible].champs.map(ch => [ch[1], corr[ch[0]] === '' ? null : entetes[Number(corr[ch[0]])]])), statut: 'definitive' }, { action: 'Reprise définitive de données', libelle: fichier.name + ' — ' + resultat.pretes.length + ' ' + CIBLES[cible].libelle.toLowerCase() });
            const tous = await D.lister('fournisseurs');
            for (const o of resultat.pretes) {
              if (cible === 'marches') { let f = tous.find(x => norm(x.raison_sociale) === norm(o.titulaire)); if (!f) { f = await D.creer('fournisseurs', { raison_sociale: o.titulaire, source: 'Reprise ' + fichier.name, actif: true, reprise_id: r.id }, false); tous.push(f); }
                await D.creer('marches', Object.assign({ fournisseur_id: f.id, statut: 'en_cours', forme: 'forfait', reprise_id: r.id }, o), false); }
              else await D.creer('fournisseurs', Object.assign({ actif: true, source: 'Reprise ' + fichier.name, reprise_id: r.id }, o), false);
            }
            U.message('Reprise terminée : ' + resultat.pretes.length + ' élément(s) créé(s).'); zoneImport.replaceChildren(); U.recharger(); }, 'accent')) : null) : null]));
      dessiner();
    };
    const annuler = async r => {
      if (!(await U.confirmer('Retour arrière', 'Les éléments créés par cette reprise seront supprimés (sauf ceux qui portent déjà des événements d\'exécution). Le fichier source et le rapport de contrôle sont conservés.', 'Annuler la reprise'))) return;
      let n = 0, gardes = 0;
      for (const m of await D.lister('marches', { reprise_id: r.id })) { if ((await D.lister('evenements', { marche_id: m.id })).length) { gardes++; continue; } await D.supprimer('marches', m.id, false); n++; }
      for (const f of await D.lister('fournisseurs', { reprise_id: r.id })) { if ((await D.lister('marches', { fournisseur_id: f.id })).length || (await D.lister('offres', { fournisseur_id: f.id })).length) { gardes++; continue; } await D.supprimer('fournisseurs', f.id, false); n++; }
      await D.modifier('reprises', r.id, { statut: 'annulee', annulee_par_nom: D.utilisateur.nom, annulee_le: D.maintenant() }, { action: 'Retour arrière sur une reprise', libelle: r.source, detail: { supprimes: n, conserves: gardes } });
      U.message(n + ' élément(s) supprimé(s), ' + gardes + ' conservé(s).'); U.recharger();
    };
    const zoneExport = h('div');
    const genererExport = async () => { zoneExport.replaceChildren(h('p.aide', 'Préparation de l\'archive…')); const r = await Docs.exportComplet(t => { zoneExport.firstChild.textContent = t; });
      U.telechargerBlob(r.blob, 'export-complet-' + D.aujourdhui() + '.zip');
      zoneExport.replaceChildren(h('div.note-info.ok', 'Archive générée (' + U.taille(r.blob.size) + '). Inventaire de contrôle :'), U.tableau([{ titre: 'Table', valeur: i => i.libelle }, { titre: 'Éléments', num: true, valeur: i => i.nombre_de_lignes }, { titre: 'Fichiers', valeur: i => i.fichiers }], r.inventaire)); };
    const planSauvegarde = peutExporter ? await cartePlanSauvegarde(genererExport) : null;
    return h('div', U.titrePage('Reprise et export', 'Reprise des dossiers existants et restitution complète des données.'),
      planSauvegarde,
      peutImporter ? U.carte('Reprendre un tableau de suivi (XLSX, XLS, ODS, CSV)', [h('p', 'Déposez un tableau de marchés ou de fournisseurs. La reprise se fait en deux temps : une reprise à blanc qui contrôle les données sans rien écrire, puis la reprise définitive. Un retour arrière reste possible.'),
        h('label.bouton.accent', 'Choisir un fichier', h('input', { type: 'file', hidden: true, id: 'fichier-reprise', accept: '.xlsx,.xls,.ods,.csv', onchange: U.agir(e => importerTableur(e.target.files[0])) }))]) : null,
      zoneImport,
      peutImporter ? U.carte('Reprendre des documents (PDF, DOCX, ODT, XLSX, ODS, CSV)', U.formulaire([
        { nom: 'cible', libelle: 'Rattacher à', type: 'choix', requis: true, large: true, options: marches.map(m => ['m|' + m.id, 'Marché ' + m.numero + ' — ' + m.objet]).concat(consultations.map(c => ['c|' + c.id, 'Consultation ' + c.reference + ' — ' + c.objet])) },
        { nom: 'fichiers', libelle: 'Documents', type: 'fichier', multiple: true, requis: true, large: true, aide: 'Les fichiers sources sont conservés sans modification ; leur texte est lu pour permettre la recherche. Les formats non reconnus sont conservés et signalés.' }], {}, async v => {
        const p = v.cible.split('|'); const r = await E.deposerPieces(v.fichiers, p[0] === 'm' ? { marche_id: p[1], type_piece: 'Document repris' } : { consultation_id: p[1], type_piece: 'Autre pièce' }, 'reprise de documents');
        const illisibles = r.filter(x => !x.lisible).length; U.message(r.length + ' document(s) repris' + (illisibles ? ', dont ' + illisibles + ' sans texte lisible (à vérifier)' : '') + '.', illisibles ? 'info' : 'ok'); U.recharger(); }, { libelle: 'Reprendre les documents' })) : null,
      U.carte('Historique des reprises', U.tableau([{ titre: 'Date', valeur: r => U.dateHeure(r.date) }, { titre: 'Fichier source', valeur: r => h('button.lien', { type: 'button', onclick: U.agir(async () => { const b = await D.telecharger(r.chemin); U.telechargerBlob(b, r.source); }) }, r.source) }, { titre: 'Données', valeur: r => CIBLES[r.cible].libelle }, { titre: 'Lignes lues', num: true, valeur: r => r.nb_lignes }, { titre: 'Créées', num: true, valeur: r => r.nb_creees },
        { titre: 'Anomalies', num: true, valeur: r => r.nb_anomalies ? h('button.lien', { type: 'button', onclick: () => U.modale('Rapport de contrôle — ' + r.source, U.tableau([{ titre: 'Ligne', valeur: a => a.ligne }, { titre: 'Élément', valeur: a => a.valeur }, { titre: 'Anomalie', valeur: a => a.problemes }], r.anomalies), { large: true }) }, r.nb_anomalies) : 0 },
        { titre: 'Par', valeur: r => r.auteur_nom }, { titre: 'État', valeur: r => r.statut === 'annulee' ? U.badge('Annulée (retour arrière)', 'neutre') : U.badge('Définitive', 'ok') },
        { titre: '', classe: 'etroit', valeur: r => peutImporter && r.statut !== 'annulee' ? U.bouton('Retour arrière', () => annuler(r), 'danger.petit') : null }], reprises, { vide: 'Aucune reprise effectuée.' })),
      peutExporter && D.mode === 'local' ? U.carte('Restaurer une sauvegarde', [h('p', 'Rechargez un export complet (archive ZIP produite ci-dessous). L\'archive est d\'abord contrôlée par rapport à son inventaire ; rien n\'est écrit tant que vous n\'avez pas confirmé. Toutes les données actuelles sont alors remplacées par celles de la sauvegarde. Les comptes de connexion et les mots de passe ne font pas partie de l\'export : ils sont conservés.'),
        h('label.bouton.secondaire', 'Choisir une sauvegarde (ZIP)', h('input', { type: 'file', hidden: true, id: 'fichier-sauvegarde', accept: '.zip', onchange: U.agir(async e => {
          const a = await Docs.analyserSauvegarde(e.target.files[0]);
          const m = U.modale('Contrôle de la sauvegarde', [U.definition([['Fichier', e.target.files[0].name], ['Export du', a.date ? a.date[1] : 'date inconnue'], ['Éléments', a.total], ['Fichiers de documents', a.fichiers.length + (a.manquants ? ' (' + a.manquants + ' absents)' : '')], ['Contrôle de l\'inventaire', a.ecarts.length ? U.badge(a.ecarts.length + ' écart(s)', 'danger') : U.badge('Conforme', 'ok')]]),
            a.ecarts.length ? h('ul', a.ecarts.map(x => h('li', x))) : null,
            h('div.note-info.alerte', 'La restauration remplace toutes les données actuelles. Faites d\'abord un export complet si vous voulez les garder.'),
            h('div.actions', U.bouton('Restaurer cette sauvegarde', async () => { await Docs.restaurer(a); m.fermer(); U.message('Sauvegarde restaurée : ' + a.total + ' éléments et ' + a.fichiers.length + ' fichiers.'); E.menu(); U.recharger(); }, 'danger'), U.bouton('Annuler', () => m.fermer(), 'secondaire'))]);
        }) }))])
        // En ligne : la restauration écraserait les données partagées de tous les utilisateurs ; elle est remplacée par la remise à zéro nocturne.
        : peutExporter && D.mode === 'supabase' ? U.carte('Restaurer une sauvegarde', h('div.note-info', h('b', 'Indisponible dans la version en ligne. '), 'La restauration remplacerait les données partagées par tous les utilisateurs du serveur : elle n\'est proposée que dans la version installée sur un poste. Les données de démonstration sont remises à zéro automatiquement chaque nuit (vers 3 h, heure de La Réunion). L\'export complet ci-dessous reste disponible.')) : null,
      peutExporter ? U.carte('Export complet des données (réversibilité)', [h('p', 'Archive ZIP contenant toutes les tables (JSON et CSV), les fichiers sources déposés, le texte extrait des pièces, les journaux, les utilisateurs et habilitations, un inventaire et un dictionnaire des données. Aucun format propriétaire.'),
        D.mode === 'supabase' ? h('p.aide', 'Version en ligne : l\'archive ne contient que les données que votre profil a le droit de consulter (règles d\'accès du serveur). Les comptes de connexion, mots de passe et facteurs de double authentification n\'en font pas partie.') : null, zoneExport],
        [U.bouton('Générer l\'export complet', genererExport, 'accent')]) : null);
  };
  U.route('/reprise', E.reprise);
})();
