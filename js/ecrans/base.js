/* Écrans de base : connexion, menu, tableau de bord, journal. */
(function () {
  'use strict';
  const h = U.h;
  const E = window.Ecrans = {};

  E.L = {
    consultation: { preparation: ['En préparation', 'neutre'], publiee: ['Publiée', 'info'], analyse: ['Analyse en cours', 'alerte'], attribuee: ['Attribuée', 'ok'], close: ['Close', 'neutre'] },
    nature: { travaux: 'Travaux', fournitures: 'Fournitures', services: 'Services' },
    besoin: { recense: ['Recensé', 'neutre'], valide: ['Procédure arrêtée', 'ok'], consultation: ['Consultation créée', 'info'], abandonne: ['Abandonné', 'neutre'] },
    dce: { redaction: ['En rédaction', 'neutre'], relecture: ['En relecture', 'alerte'], validation: ['En attente de validation', 'alerte'], valide: ['Validé', 'ok'], publie: ['Publié', 'info'] },
    analyse: { preparation: ['Préparation', 'neutre'], en_cours: ['Analyse en cours', 'info'], en_relecture: ['En relecture', 'alerte'], validee: ['Analyse validée', 'ok'] },
    note: { brouillon: ['Brouillon', 'neutre'], proposee: ['Proposée', 'info'], validee: ['Validée', 'ok'], a_revoir: ['À revoir', 'alerte'] },
    candidature: { a_examiner: ['À examiner', 'neutre'], complete: ['Constat : complète', 'info'], a_completer: ['Constat : à compléter', 'alerte'], admise: ['Décision : admise', 'ok'], non_admise: ['Décision : non admise', 'danger'] },
    marche: { en_cours: ['En cours', 'ok'], termine: ['Terminé', 'neutre'], resilie: ['Résilié', 'danger'] },
    evenement: { ordre_service: 'Ordre de service', bon_commande: 'Bon de commande', avenant: 'Avenant', reconduction: 'Reconduction', revision_prix: 'Révision de prix', reception: 'Réception / service fait', autre: 'Autre événement' },
    demande: { complement: 'Demande de complément (candidature)', precision: 'Demande de précisions', justification_prix: 'Demande de justification du prix', regularisation: 'Demande de régularisation', negociation: 'Négociation' },
    piece: { non_controlee: ['Non contrôlée', 'neutre'], conforme: ['Conforme', 'ok'], incomplete: ['Incomplète', 'alerte'], illisible: ['Illisible', 'danger'], incoherente: ['Incohérente', 'danger'] }
  };
  E.badge = (famille, cle) => { const x = E.L[famille][cle] || [cle || '—', 'neutre']; return U.badge(x[0], x[1]); };
  E.TYPES_PIECE = ['Acte d\'engagement', 'DC1 — Lettre de candidature', 'DC2 — Déclaration du candidat', 'Attestation d\'assurance', 'Mémoire technique', 'Bordereau de prix / DPGF', 'Détail quantitatif estimatif', 'Certificats et qualifications', 'CV et références', 'Fiches techniques', 'Autre pièce'];

  E.consultationsVisibles = async () => (await D.lister('consultations', {}, { ordre: 'cree_le', desc: true })).filter(D.voitConsultation);

  /* ---------- Connexion ---------- */
  E.connexion = function () {
    document.getElementById('menu').hidden = true;
    const f = U.formulaire([
      { nom: 'email', libelle: 'Adresse électronique', type: 'email', requis: true },
      { nom: 'mdp', libelle: 'Mot de passe', type: 'motdepasse', requis: true }
    ], {}, async v => { await D.connexion(v.email, v.mdp); if (!location.hash || location.hash === '#/connexion') location.hash = '/'; E.menu(); U.rafraichir(); }, { libelle: 'Se connecter' });
    const demo = (window.CONFIG.afficherComptesDemo && window.Demo) ? h('div.comptes-demo', h('strong', 'Comptes de démonstration'), h('p.aide', 'Données fictives. Cliquez sur un profil pour remplir le formulaire.'),
      window.Demo.COMPTES.map(c => h('button', { type: 'button', onclick: () => { f.controles.email.value = c.email; f.controles.mdp.value = c.mot_de_passe; } }, h('b', D.ROLES[c.role]), ' — ' + c.nom))) : null;
    document.getElementById('contenu').replaceChildren(h('div.connexion',
      h('div.cote', h('h1', { html: 'Gestion des marchés publics<br><i>côté acheteur</i>' }),
        h('p', 'Du recensement du besoin à l\'évaluation du titulaire : préparation, dossier de consultation, analyse des offres, suivi d\'exécution.'),
        h('p', 'Chaque note, chaque classement et chaque décision reste validé par un agent habilité. Toutes les actions sont tracées.'),
        h('p', { style: { marginTop: '28px', fontSize: '.8rem' } }, 'Une solution de l\'entreprise.ai — Saint-Paul, La Réunion')),
      h('div.forme', h('h2', { style: { marginBottom: '14px' } }, 'Connexion'), f, demo,
        D.mode === 'local' ? h('p.aide', { style: { marginTop: '12px' } }, 'Mode démonstration locale : les données restent dans ce navigateur.') : null)));
  };

  /* ---------- Menu ---------- */
  E.menu = function () {
    const m = document.getElementById('menu'); if (!D.utilisateur) { m.hidden = true; return; }
    document.body.classList.remove('public'); if (E.arreterCarrousel) E.arreterCarrousel(); setTimeout(() => { if (E.majIdentiteMenu) E.majIdentiteMenu(); }, 0);
    m.hidden = false;
    const lien = (chemin, libelle, droit) => (!droit || droit.some(D.peut)) ? h('a', { href: '#' + chemin, 'data-chemin': chemin }, libelle) : null;
    m.replaceChildren(...[
      h('div.marque', { id: 'identite-menu' }, h('span', window.CONFIG.organisme || '')),
      h('nav', { 'aria-label': 'Menu principal' },
        lien('/', 'Tableau de bord'), lien('/notifications', 'Notifications'),
        h('div.groupe', 'Préparation'), lien('/besoins', 'Besoins et seuils'), lien('/procedure', 'Aide au choix de la procédure'),
        h('div.groupe', 'Passation'), lien('/consultations', 'Consultations (mes dossiers)'), lien('/modeles', 'Modèles'),
        h('div.groupe', 'Exécution'), lien('/marches', 'Marchés'), lien('/fournisseurs', 'Fournisseurs'), lien('/evaluations', 'Évaluations des titulaires'),
        h('div.groupe', 'Administration'),
        lien('/support', 'Demandes d\'assistance', ['support.declarer', 'support.traiter']),
        lien('/reprise', 'Reprise, export et sauvegarde', ['reprise.importer', 'export.complet']),
        lien('/journal', 'Journal des actions', ['journal.lire']),
        lien('/admin', 'Utilisateurs et habilitations', ['admin.utilisateurs']),
        lien('/accueil-admin', 'Page d\'accueil et annonces', ['accueil.ecrire']),
        lien('/parametres', 'Paramètres', ['admin.parametres'])),
      D.mode === 'local' ? h('div.mode-local', 'Mode démonstration locale') : null,
      h('div.compte', h('b', D.utilisateur.nom), h('span', D.ROLES[D.utilisateur.role] + (D.utilisateur.service ? ' · ' + D.utilisateur.service : '')), h('a.lien-securite', { href: '#/securite', 'data-chemin': '/securite' }, 'Ma sécurité'),
        h('button', { type: 'button', onclick: U.agir(async () => { await D.deconnexion(); location.hash = '/'; U.rafraichir(); }) }, 'Se déconnecter'))].filter(Boolean));
  };
  E.majMenu = function (chemin) {
    if (E.majCloche) E.majCloche();
    if (document.getElementById('menu').hidden || !document.querySelector('#menu nav')) E.menu();
    const racine = '/' + (chemin.split('/')[1] || '');
    const alias = { '/consultation': '/consultations', '/marche': '/marches', '/fournisseur': '/fournisseurs' };
    document.querySelectorAll('#menu nav a').forEach(a => a.classList.toggle('actif', a.dataset.chemin === (alias[racine] || racine)));
  };

  /* ---------- Tableau de bord ---------- */
  E.alertes = async function () {
    const auj = D.aujourdhui(); const alertes = [];
    const consultations = await E.consultationsVisibles(); const ids = consultations.map(c => c.id); const parId = Object.fromEntries(consultations.map(c => [c.id, c]));
    const [lots, analyses, docs, demandes, marches, evenements, besoins, params, offres, attendues, pieces] = await Promise.all([
      D.lister('lots'), D.lister('analyses'), D.lister('documents_dce'), D.lister('demandes'), D.lister('marches'), D.lister('evenements'), D.lister('besoins'), D.lister('parametres'),
      D.lister('offres'), D.lister('pieces_attendues'), D.lister('pieces')]);
    const lotsVis = lots.filter(l => ids.includes(l.consultation_id));
    for (const a of analyses) { const l = lotsVis.find(x => x.id === a.lot_id); if (l && a.statut === 'en_relecture') alertes.push({ ton: 'alerte', quand: a.soumise_le, texte: 'Analyse à valider — ' + parId[l.consultation_id].reference + ', lot ' + l.numero, lien: '/consultation/' + l.consultation_id + '/analyse?lot=' + l.id }); }
    const circuit = await D.circuitDce();
    for (const d of docs) { const e = circuit.find(x => x.id === d.statut); if (ids.includes(d.consultation_id) && e) alertes.push({ ton: 'alerte', texte: 'DCE en attente (' + e.libelle.toLowerCase() + ') — ' + d.titre + ' (' + parId[d.consultation_id].reference + ')', lien: '/consultation/' + d.consultation_id + '/dce/' + d.id }); }
    for (const d of demandes) if (ids.includes(d.consultation_id) && d.statut === 'sans_reponse' && !d.decision) alertes.push({ ton: 'danger', texte: 'Candidat sans réponse : décision à prendre — ' + E.L.demande[d.type] + ' (' + parId[d.consultation_id].reference + ')', lien: '/consultation/' + d.consultation_id + '/offres' });
    for (const d of demandes) if (ids.includes(d.consultation_id) && d.statut === 'envoyee' && d.echeance) { const j = Calcul.joursAvant(d.echeance, auj); if (j < 0) alertes.push({ ton: 'danger', texte: 'Réponse attendue depuis le ' + U.date(d.echeance) + ' — ' + E.L.demande[d.type] + ' (' + parId[d.consultation_id].reference + ')', lien: '/consultation/' + d.consultation_id + '/offres' }); else if (j <= 3) alertes.push({ ton: 'alerte', texte: 'Échéance de réponse dans ' + j + ' j — ' + E.L.demande[d.type] + ' (' + parId[d.consultation_id].reference + ')', lien: '/consultation/' + d.consultation_id + '/offres' }); }
    for (const c of consultations) {
      if (c.date_limite_offres && ['preparation', 'publiee'].includes(c.statut)) { const j = Calcul.joursAvant(c.date_limite_offres, auj); if (j >= 0 && j <= 15) alertes.push({ ton: 'info', texte: 'Date limite de remise des offres dans ' + j + ' j — ' + c.reference, lien: '/consultation/' + c.id }); }
      const att = attendues.filter(a => a.consultation_id === c.id && a.obligatoire);
      for (const o of offres.filter(x => x.consultation_id === c.id)) { const m = att.filter(a => !pieces.some(p => p.offre_id === o.id && p.type_piece === a.type_piece)); if (m.length && c.statut !== 'close' && c.statut !== 'attribuee') alertes.push({ ton: 'alerte', texte: m.length + ' pièce(s) attendue(s) absente(s) — ' + o.candidat + ' (' + c.reference + ') : à vérifier', lien: '/consultation/' + c.id + '/offres' }); }
    }
    const delai = 120;
    for (const m of marches.filter(x => x.statut === 'en_cours')) {
      const nb = evenements.filter(e => e.marche_id === m.id && e.type === 'reconduction' && e.statut === 'decidee').length;
      for (const e of Calcul.echeancesMarche(m, nb).echeances) { const j = Calcul.joursAvant(e.date, auj); if (j <= delai) alertes.push({ ton: j < 0 ? 'danger' : j <= 30 ? 'alerte' : 'info', texte: e.libelle + ' — marché ' + m.numero + (j < 0 ? ' (échéance dépassée depuis le ' + U.date(e.date) + ')' : ' : ' + U.date(e.date) + ' (dans ' + j + ' j)'), lien: '/marche/' + m.id }); }
      if (m.montant_max) { const cumul = Calcul.somme(evenements.filter(e => e.marche_id === m.id && e.type === 'bon_commande').map(e => e.montant)); if (cumul >= 0.8 * m.montant_max) alertes.push({ ton: cumul >= m.montant_max ? 'danger' : 'alerte', texte: 'Bons de commande : ' + U.nombre(cumul / m.montant_max * 100, 0) + ' % du montant maximum — marché ' + m.numero, lien: '/marche/' + m.id }); }
    }
    const seuils = (params.find(p => p.id === 'seuils') || {}).valeur;
    for (const g of Calcul.computation(besoins.filter(b => b.annee === new Date().getFullYear() || b.annee === new Date().getFullYear() + 1), seuils))
      if (g.besoins.length > 1 && g.niveau >= 2 && g.besoins.some(b => !b.procedure_retenue)) alertes.push({ ton: 'info', texte: 'Computation des seuils — ' + g.famille + ' (' + g.annee + ') : ' + U.euros(g.total) + ' HT cumulés sur ' + g.besoins.length + ' besoins', lien: '/besoins' });
    return { alertes, consultations, lots: lotsVis, analyses, marches, evenements };
  };

  E.tableauDeBord = async function () {
    const [r, donneesFrise] = await Promise.all([E.alertes(), E.chargerDonneesFrise ? E.chargerDonneesFrise() : null]);
    const enCours = r.consultations.filter(c => !['close', 'attribuee'].includes(c.statut));
    const marchesEnCours = r.marches.filter(m => m.statut === 'en_cours');
    const parStatut = Object.keys(E.L.consultation).map(s => [s, r.consultations.filter(c => c.statut === s).length]);
    const max = Math.max(1, ...parStatut.map(x => x[1]));
    const ordreTon = { danger: 0, alerte: 1, info: 2 };
    r.alertes.sort((a, b) => ordreTon[a.ton] - ordreTon[b.ton]);
    return h('div',
      U.titrePage('Tableau de bord', 'Bonjour ' + D.utilisateur.nom + ' — ' + new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
      h('div.indicateurs',
        h('div.indicateur.accent', h('b', enCours.length), h('span', 'consultations en cours')),
        h('div.indicateur', h('b', r.analyses.filter(a => a.statut === 'en_relecture' && r.lots.some(l => l.id === a.lot_id)).length), h('span', 'analyses en attente de validation')),
        h('div.indicateur', h('b', marchesEnCours.length), h('span', 'marchés en cours d\'exécution')),
        h('div.indicateur', h('b', U.nombre(Calcul.somme(marchesEnCours.map(m => m.montant_notifie)) / 1000, 0) + ' k€'), h('span', 'montant notifié des marchés en cours (HT)')),
        h('div.indicateur', h('b', r.alertes.filter(a => a.ton !== 'info').length), h('span', 'alertes à traiter'))),
      donneesFrise ? U.carte('Où en sont mes dossiers', [h('p.aide', 'Nombre de dossiers à chaque étape du parcours. Cliquez sur une pastille pour afficher les dossiers concernés.'),
        E.compteurEtapes(r.consultations.map(c => E.etapeConsultation(c, donneesFrise)))], U.bouton('Voir mes dossiers', () => U.aller('/consultations'), 'secondaire')) : null,
      h('div.grille2',
        U.carte('Alertes et échéances', r.alertes.length ? U.tableau([
          { titre: 'Niveau', classe: 'etroit', valeur: a => U.badge({ danger: 'Urgent', alerte: 'À traiter', info: 'Information' }[a.ton], a.ton) },
          { titre: 'Objet', valeur: a => h('a', { href: '#' + a.lien }, a.texte) }], r.alertes) : U.vide('Aucune alerte.')),
        h('div',
          U.carte('Consultations par étape', h('div', parStatut.map(x => h('div', { style: { display: 'grid', gridTemplateColumns: '150px 1fr 30px', gap: '8px', alignItems: 'center', margin: '6px 0', fontSize: '.88rem' } },
            h('span', E.L.consultation[x[0]][0]), h('div', { style: { background: 'var(--fond-doux)', borderRadius: '3px', height: '14px' } }, h('div', { style: { width: (x[1] / max * 100) + '%', background: x[0] === 'analyse' ? 'var(--braise)' : 'var(--noir)', height: '14px', borderRadius: '3px' } })), h('b', x[1]))))),
          U.carte('Dossiers en cours', U.tableau([
            { titre: 'Référence', valeur: c => h('a', { href: '#/consultation/' + c.id }, c.reference) }, { titre: 'Objet', valeur: c => c.objet },
            { titre: 'Étape', valeur: c => E.badge('consultation', c.statut) }], enCours.slice(0, 8), { vide: 'Aucune consultation en cours.' })))));
  };
  U.route('/', E.tableauDeBord);
  U.route('/connexion', E.tableauDeBord);

  /* ---------- Journal ---------- */
  E.journal = async function () {
    D.exiger('journal.lire');
    const lignes = await D.lister('journal', {}, { ordre: 'date', desc: true, limite: 3000 });
    const filtre = { texte: U.param('q') || '', auteur: '', du: '', au: '', securite: U.param('securite') === '1' };
    const zone = h('div');
    const filtrer = () => lignes.filter(l => (!filtre.securite || E.estSecurite(l)) && (!filtre.auteur || l.auteur_nom === filtre.auteur) && (!filtre.du || l.date >= filtre.du) && (!filtre.au || l.date.slice(0, 10) <= filtre.au)
      && (!filtre.texte || (l.action + ' ' + (l.objet_libelle || '') + ' ' + l.auteur_nom + ' ' + (l.objet_type || '')).toLowerCase().includes(filtre.texte.toLowerCase())));
    const dessiner = () => { const f = filtrer(); zone.replaceChildren(h('p.aide', f.length + ' action(s) affichée(s) sur ' + lignes.length + '. Le journal ne peut être ni modifié ni supprimé.'), E.tableauJournal(f.slice(0, 500))); };
    const auteurs = Array.from(new Set(lignes.map(l => l.auteur_nom))).sort();
    const barre = h('div.actions', { style: { marginBottom: '12px' } },
      h('input.saisie', { type: 'search', placeholder: 'Rechercher une action, un objet…', 'aria-label': 'Rechercher', style: { maxWidth: '280px' }, value: filtre.texte, oninput: e => { filtre.texte = e.target.value; dessiner(); } }),
      h('select.saisie', { 'aria-label': 'Auteur', style: { maxWidth: '220px' }, onchange: e => { filtre.auteur = e.target.value; dessiner(); } }, h('option', { value: '' }, 'Tous les auteurs'), auteurs.map(a => h('option', a))),
      h('label', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', id: 'filtre-securite', checked: filtre.securite, onchange: e => { filtre.securite = e.target.checked; dessiner(); } }), 'Journal de sécurité uniquement'),
      h('label', 'du ', h('input.saisie', { type: 'date', style: { width: 'auto' }, onchange: e => { filtre.du = e.target.value; dessiner(); } })),
      h('label', 'au ', h('input.saisie', { type: 'date', style: { width: 'auto' }, onchange: e => { filtre.au = e.target.value; dessiner(); } })),
      U.bouton('Exporter (CSV)', async () => { const f = filtrer(); U.telechargerBlob(new Blob([Docs.csv(f.map(E.ligneJournalPlate))], { type: 'text/csv' }), 'journal-' + D.aujourdhui() + '.csv'); await D.journal('Export du journal', 'journal', null, f.length + ' lignes'); }, 'secondaire'));
    dessiner();
    return h('div', U.titrePage('Journal des actions', 'Qui a fait quoi, quand, sur quel objet.'), U.carte(null, [barre, zone]));
  };
  E.ligneJournalPlate = l => ({ date: l.date, auteur: l.auteur_nom, profil: D.ROLES[l.auteur_role] || '', action: l.action, objet: l.objet_libelle || '', type_objet: l.objet_type || '', identifiant_objet: l.objet_id || '', resultat: l.resultat, detail: l.detail ? JSON.stringify(l.detail) : '', origine: l.origine || '' });
  E.tableauJournal = lignes => U.tableau([
    { titre: 'Date et heure', classe: 'etroit', valeur: l => U.dateHeure(l.date) },
    { titre: 'Auteur', valeur: l => [l.auteur_nom, l.auteur_role ? h('div.aide', D.ROLES[l.auteur_role]) : null] },
    { titre: 'Action', valeur: l => h('b', l.action) },
    { titre: 'Objet', valeur: l => [l.objet_libelle || '—', l.detail && l.detail.champs_modifies && l.detail.champs_modifies.length ? h('div.aide', 'Champs : ' + l.detail.champs_modifies.join(', ')) : null] },
    { titre: 'Résultat', classe: 'etroit', valeur: l => U.badge(l.resultat, l.resultat === 'réussi' ? 'ok' : 'danger') }], lignes, { vide: 'Aucune action enregistrée.' });
  U.route('/journal', E.journal);
})();
