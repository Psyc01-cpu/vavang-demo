/* Consultations : liste, fiche, lots, habilitations par dossier, pièces attendues. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const PROCEDURES = ['Marché sans publicité ni mise en concurrence', 'Procédure adaptée (MAPA)', 'Appel d\'offres ouvert', 'Appel d\'offres restreint', 'Procédure avec négociation', 'Consultation sur devis'];
  const TYPES_MARCHE = ['Marché ordinaire à prix forfaitaire', 'Marché à prix unitaires', 'Accord-cadre à bons de commande', 'Accord-cadre à marchés subséquents', 'Marché mixte (forfait et bons de commande)'];
  E.PROCEDURES = PROCEDURES; E.TYPES_MARCHE = TYPES_MARCHE;
  const natures = Object.entries(E.L.nature);

  E.champsConsultation = () => [
    { nom: 'reference', libelle: 'Référence', requis: true }, { nom: 'service', libelle: 'Service prescripteur' },
    { nom: 'objet', libelle: 'Objet de la consultation', requis: true, large: true },
    { nom: 'nature', libelle: 'Nature', type: 'choix', options: natures, requis: true }, { nom: 'procedure', libelle: 'Procédure', type: 'choix', options: PROCEDURES.map(p => [p, p]), requis: true },
    { nom: 'type_marche', libelle: 'Type de marché', type: 'choix', options: TYPES_MARCHE.map(p => [p, p]) }, { nom: 'montant_estime', libelle: 'Montant estimé (€ HT)', type: 'nombre' },
    { nom: 'date_limite_offres', libelle: 'Date limite de remise des offres', type: 'date' }];

  E.creerConsultation = async function (v, besoin) {
    const c = await D.creer('consultations', Object.assign({ statut: 'preparation', cree_par: D.utilisateur.id, besoin_id: besoin ? besoin.id : null }, v), { action: 'Création de la consultation', libelle: v.reference + ' — ' + v.objet });
    await D.creer('lots', { consultation_id: c.id, numero: 1, intitule: 'Lot unique', montant_estime: v.montant_estime }, false);
    for (const t of ['Acte d\'engagement', 'DC1 — Lettre de candidature', 'DC2 — Déclaration du candidat', 'Mémoire technique', 'Bordereau de prix / DPGF'])
      await D.creer('pieces_attendues', { consultation_id: c.id, type_piece: t, obligatoire: true }, false);
    return c;
  };

  // Vue « Mes dossiers » : un dossier = une carte avec sa mini-frise ; bascule « Cartes / Tableau » (choix mémorisé sur ce poste) ; filtre ?etape=… depuis les pastilles.
  const lireVue = () => { try { return localStorage.getItem('vavang-vue-dossiers') === 'tableau' ? 'tableau' : 'cartes'; } catch (e) { return 'cartes'; } };
  const ecrireVue = v => { try { localStorage.setItem('vavang-vue-dossiers', v); } catch (e) { /* stockage indisponible : choix non mémorisé */ } };
  E.consultations = async function () {
    const [liste, donnees] = await Promise.all([E.consultationsVisibles(), E.chargerDonneesFrise()]);
    const etats = Object.fromEntries(liste.map(c => [c.id, E.etapeConsultation(c, donnees)]));
    const filtre = U.param('etape'); const etapeFiltre = E.ETAPES_PARCOURS.find(e => e.cle === filtre);
    const affichees = etapeFiltre ? liste.filter(c => etats[c.id].cle === filtre) : liste;
    const nouveau = D.peut('consultations.ecrire') ? U.bouton('Nouveau dossier', async () => {
      const n = (await D.lister('consultations')).length + 1;
      U.editer('Nouveau dossier de consultation', E.champsConsultation(), { reference: new Date().getFullYear() + '-' + String(n).padStart(3, '0') }, async v => { const c = await E.creerConsultation(v); location.hash = '/consultation/' + c.id; });
    }, 'accent') : null;
    const zone = h('div');
    let vue = lireVue();
    const bascule = h('div.bascule-vue', { role: 'group', 'aria-label': 'Affichage des dossiers' });
    const dessiner = () => {
      bascule.replaceChildren(...[['cartes', 'Cartes'], ['tableau', 'Tableau']].map(x => h('button.bouton.petit' + (vue === x[0] ? '' : '.secondaire'), { type: 'button', 'aria-pressed': vue === x[0] ? 'true' : 'false', 'data-vue': x[0], onclick: () => { vue = x[0]; ecrireVue(vue); dessiner(); } }, x[1])));
      if (!affichees.length) { zone.replaceChildren(U.carte(null, U.vide(etapeFiltre ? 'Aucun dossier à l\'étape « ' + etapeFiltre.libelle + ' ».' : 'Aucune consultation ne vous est accessible.'))); return; }
      zone.replaceChildren(vue === 'cartes' ? h('div.dossiers-grille', affichees.map(c => E.carteDossier(c, etats[c.id])))
        : U.carte(null, U.tableau([
          { titre: 'Référence', valeur: c => h('b', c.reference) }, { titre: 'Objet', valeur: c => c.objet }, { titre: 'Nature', valeur: c => E.L.nature[c.nature] || '—' },
          { titre: 'Procédure', valeur: c => c.procedure }, { titre: 'Estimation HT', num: true, valeur: c => U.euros(c.montant_estime) },
          { titre: 'Remise des offres', valeur: c => U.date(c.date_limite_offres) }, { titre: 'Statut', valeur: c => E.badge('consultation', c.statut) },
          { titre: 'Étape du parcours', valeur: c => [E.miniFrise(etats[c.id]), h('div.aide', etats[c.id].courante.libelle)] }],
          affichees, { surClic: c => U.aller('/consultation/' + c.id) })));
    };
    dessiner();
    return h('div', U.titrePage('Mes dossiers', D.peut('consultations.toutes') ? 'Tous les dossiers de passation, étape par étape.' : 'Les dossiers qui vous sont affectés, étape par étape.', nouveau),
      U.carte('Où en sont mes dossiers', [E.compteurEtapes(Object.values(etats), filtre),
        etapeFiltre ? h('p.filtre-actif', 'Filtre : étape « ' + etapeFiltre.libelle + ' » — ' + affichees.length + ' dossier(s). ', h('a', { href: '#/consultations' }, 'Afficher tous les dossiers')) : null], bascule),
      zone);
  };
  U.route('/consultations', E.consultations);

  E.ONGLETS = [['fiche', 'Fiche et lots'], ['dce', 'Dossier de consultation'], ['offres', 'Candidatures et offres'], ['analyse', 'Analyse'], ['rapport', 'Rapport et courriers'], ['audit', 'Dossier d\'audit']];
  E.chargerConsultation = async function (id) {
    const c = await D.lire('consultations', id);
    if (!c) throw new Error('Consultation introuvable.');
    if (!D.voitConsultation(c)) { await D.journal('Accès refusé à un dossier', 'consultations', id, c.reference, null, id, 'refusé'); throw new Error('Ce dossier ne vous est pas affecté.'); }
    return c;
  };
  E.enteteConsultation = function (c, onglet) {
    const f = D.fonctionSurDossier(c.id);
    return [U.fil([['Consultations', '/consultations'], [c.reference]]),
      U.titrePage(c.objet, c.reference + ' · ' + (E.L.nature[c.nature] || '') + ' · ' + c.procedure, [E.badge('consultation', c.statut), f ? U.badge('Votre fonction sur ce dossier : ' + f, 'info') : null]),
      E.friseConsultation ? E.friseConsultation(c) : null,
      U.onglets(E.ONGLETS, onglet, o => U.aller('/consultation/' + c.id + (o === 'fiche' ? '' : '/' + o)))];
  };

  E.consultation = async function (id) {
    const c = await E.chargerConsultation(id);
    const peut = D.peut('consultations.ecrire');
    const [lots, affect, profils, attendues, besoin] = await Promise.all([D.lister('lots', { consultation_id: id }, { ordre: 'numero' }), D.lister('affectations', { consultation_id: id }),
      D.lister('profils'), D.lister('pieces_attendues', { consultation_id: id }), D.lire('besoins', c.besoin_id)]);
    const ordre = Object.keys(E.L.consultation);
    const suivant = ordre[ordre.indexOf(c.statut) + 1];
    const tr = { action: 'Modification de la consultation', libelle: c.reference, consultation_id: id };
    const champsLot = [{ nom: 'numero', libelle: 'Numéro', type: 'nombre', requis: true }, { nom: 'montant_estime', libelle: 'Montant estimé (€ HT)', type: 'nombre' }, { nom: 'intitule', libelle: 'Intitulé du lot', requis: true, large: true }];
    return h('div', E.enteteConsultation(c, 'fiche'),
      h('div.etapes', ordre.map(s => h('span' + (s === c.statut ? '.courant' : ordre.indexOf(s) < ordre.indexOf(c.statut) ? '.fait' : ''), E.L.consultation[s][0]))),
      h('div.grille2',
        U.carte('Fiche', U.definition([['Référence', c.reference], ['Objet', c.objet], ['Service prescripteur', c.service], ['Nature', E.L.nature[c.nature]], ['Procédure', c.procedure], ['Type de marché', c.type_marche],
          ['Montant estimé', U.euros(c.montant_estime) + ' HT'], ['Date limite des offres', U.date(c.date_limite_offres)], besoin ? ['Besoin d\'origine', h('a', { href: '#/besoins' }, besoin.reference + ' — ' + besoin.objet)] : null]),
          peut ? [U.bouton('Modifier', () => U.editer('Modifier la consultation', E.champsConsultation(), c, v => D.modifier('consultations', id, v, tr)), 'secondaire'),
            suivant ? U.bouton('Passer à l\'étape « ' + E.L.consultation[suivant][0] + ' »', async () => { if (await U.confirmer('Changer d\'étape', 'La consultation passera à l\'étape « ' + E.L.consultation[suivant][0] + ' ». Cette action est tracée au journal.')) { await D.modifier('consultations', id, { statut: suivant }, { action: 'Changement d\'étape : ' + E.L.consultation[suivant][0], libelle: c.reference, consultation_id: id }); U.recharger(); } }, 'secondaire') : null] : null),
        U.carte('Lots', U.tableau([
          { titre: 'N°', classe: 'etroit', valeur: l => l.numero }, { titre: 'Intitulé', valeur: l => l.intitule }, { titre: 'Estimation HT', num: true, valeur: l => U.euros(l.montant_estime) },
          { titre: '', classe: 'etroit', valeur: l => peut ? [U.bouton('Modifier', () => U.editer('Modifier le lot', champsLot, l, v => D.modifier('lots', l.id, v, { action: 'Modification d\'un lot', libelle: c.reference + ' — lot ' + l.numero, consultation_id: id })), 'secondaire.petit'), ' ',
            U.bouton('Supprimer', async () => { if ((await D.lister('offres', { lot_id: l.id })).length) throw new Error('Ce lot contient des offres : il ne peut pas être supprimé.'); if (await U.confirmer('Supprimer le lot', 'Supprimer le lot ' + l.numero + ' ?')) { await D.supprimer('lots', l.id, { action: 'Suppression d\'un lot', libelle: c.reference + ' — lot ' + l.numero, consultation_id: id }); U.recharger(); } }, 'danger.petit')] : null }], lots),
          peut ? U.bouton('Ajouter un lot', () => U.editer('Nouveau lot', champsLot, { numero: lots.length + 1 }, v => D.creer('lots', Object.assign({ consultation_id: id }, v), { action: 'Ajout d\'un lot', libelle: c.reference + ' — lot ' + v.numero, consultation_id: id })), 'secondaire') : null)),
      h('div.grille2',
        U.carte('Habilitations sur ce dossier', [h('p.aide', 'Les agents affectés accèdent à ce dossier même sans droit de voir tous les dossiers. La fonction précise leur rôle dans l\'analyse.'),
          U.tableau([{ titre: 'Agent', valeur: a => { const p = profils.find(x => x.id === a.profil_id); return p ? [p.nom, h('div.aide', D.ROLES[p.role] + (p.service ? ' · ' + p.service : ''))] : '—'; } },
            { titre: 'Fonction sur le dossier', valeur: a => U.badge(a.fonction, 'info') },
            { titre: 'Périmètre', valeur: a => { const l = lots.find(x => x.id === a.lot_id); return l ? 'Lot ' + l.numero + ' seulement' : 'Tous les lots'; } },
            { titre: '', classe: 'etroit', valeur: a => peut ? U.bouton('Retirer', async () => { const p = profils.find(x => x.id === a.profil_id); await D.supprimer('affectations', a.id, { action: 'Retrait d\'une habilitation sur dossier', libelle: (p ? p.nom : '') + ' — ' + c.reference, consultation_id: id }); U.recharger(); }, 'danger.petit') : null }], affect, { vide: 'Aucun agent affecté nommément.' })],
          peut ? U.bouton('Affecter un agent', () => U.editer('Affecter un agent au dossier', [
            { nom: 'profil_id', libelle: 'Agent', type: 'choix', requis: true, options: profils.filter(p => p.actif !== false && !affect.some(a => a.profil_id === p.id)).map(p => [p.id, p.nom + ' — ' + D.ROLES[p.role]]) },
            { nom: 'fonction', libelle: 'Fonction sur le dossier', type: 'choix', requis: true, options: [['analyste', 'Analyste'], ['valideur', 'Valideur'], ['lecteur', 'Lecteur']] },
            { nom: 'lot_id', libelle: 'Périmètre', type: 'choix', vide: false, options: [['', 'Tous les lots']].concat(lots.map(l => [l.id, 'Lot ' + l.numero + ' seulement — ' + l.intitule])), aide: 'Limiter l\'habilitation à un lot : l\'agent ne verra et ne notera que ce lot.' }], {},
            v => D.creer('affectations', Object.assign({ consultation_id: id }, v, { lot_id: v.lot_id || null }), { action: 'Habilitation sur dossier : ' + v.fonction + (v.lot_id ? ' (lot ' + (lots.find(l => l.id === v.lot_id) || {}).numero + ')' : ''), libelle: (profils.find(p => p.id === v.profil_id) || {}).nom + ' — ' + c.reference, consultation_id: id })), 'secondaire') : null),
        U.carte('Pièces attendues des candidats', [h('p.aide', 'Sert au contrôle de complétude : toute pièce obligatoire absente d\'un pli est signalée, à vérifier par l\'agent.'),
          U.tableau([{ titre: 'Pièce', valeur: a => a.type_piece }, { titre: 'Caractère', valeur: a => U.badge(a.obligatoire ? 'Obligatoire' : 'Facultative', a.obligatoire ? 'alerte' : 'neutre') },
            { titre: '', classe: 'etroit', valeur: a => peut ? U.bouton('Retirer', async () => { await D.supprimer('pieces_attendues', a.id, { action: 'Retrait d\'une pièce attendue', libelle: a.type_piece + ' — ' + c.reference, consultation_id: id }); U.recharger(); }, 'danger.petit') : null }], attendues)],
          peut ? U.bouton('Ajouter une pièce attendue', () => U.editer('Pièce attendue', [
            { nom: 'type_piece', libelle: 'Type de pièce', type: 'choix', requis: true, options: E.TYPES_PIECE.filter(t => !attendues.some(a => a.type_piece === t)).map(t => [t, t]) },
            { nom: 'obligatoire', libelle: 'Pièce obligatoire', type: 'case', defaut: true }], {}, v => D.creer('pieces_attendues', Object.assign({ consultation_id: id }, v), { action: 'Ajout d\'une pièce attendue', libelle: v.type_piece + ' — ' + c.reference, consultation_id: id })), 'secondaire') : null)));
  };
  U.route('/consultation/:id', E.consultation);
  U.route('/consultation/:id/fiche', E.consultation);
})();
