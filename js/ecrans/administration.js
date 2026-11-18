/* Administration : utilisateurs, habilitations par profil, paramètres (seuils). */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  E.admin = async function () {
    D.exiger('admin.utilisateurs');
    const [profils, hab] = await Promise.all([D.lister('profils', {}, { ordre: 'nom' }), D.lister('habilitations')]);
    const roles = Object.entries(D.ROLES);
    // En ligne : état de sécurité de tous les comptes (double authentification, verrouillage, sessions) lu en un seul appel serveur.
    let etats = null;
    if (D.mode === 'supabase') {
      try { const r = await D.etatSecuriteComptes(); etats = Array.isArray(r) ? Object.fromEntries(r.map(x => [x.id, x])) : (r || {}); }
      catch (e) { console.warn('etat_securite_comptes', e); etats = {}; }
    }
    const champs = nouveau => [{ nom: 'nom', libelle: 'Nom affiché', requis: true }, { nom: 'email', libelle: 'Adresse électronique', type: 'email', requis: true, lectureSeule: !nouveau },
      { nom: 'role', libelle: 'Profil', type: 'choix', requis: true, options: roles }, { nom: 'service', libelle: 'Service' }].concat(nouveau ? [{ nom: 'mot_de_passe', libelle: 'Mot de passe initial (12 caractères au moins)', type: 'motdepasse', requis: true }] : []);
    const a = (role, droit) => hab.some(x => x.role === role && x.droit === droit);
    const basculer = async (role, droit, coche) => {
      if (role === 'administrateur' && droit === 'admin.utilisateurs' && !coche) throw new Error('Le profil administrateur doit conserver la gestion des utilisateurs.');
      if (coche) await D.creer('habilitations', { id: role + '|' + droit, role, droit }, { action: 'Habilitation accordée', libelle: D.ROLES[role] + ' : ' + D.DROITS[droit] });
      else await D.supprimer('habilitations', role + '|' + droit, { action: 'Habilitation retirée', libelle: D.ROLES[role] + ' : ' + D.DROITS[droit] });
      U.message('Habilitation mise à jour. Elle s\'applique à la prochaine connexion des agents concernés.'); U.recharger();
    };
    const actifs = profils.filter(p => p.actif !== false).length;
    return h('div', U.titrePage('Utilisateurs et habilitations', actifs + ' compte(s) nominatif(s) actif(s).',
      [U.bouton('Nouvel utilisateur', () => U.editer('Nouvel utilisateur', champs(true), {}, async v => { if (String(v.mot_de_passe).length < 12) throw new Error('Le mot de passe doit compter au moins 12 caractères.'); await D.creerCompte(v); }), 'accent')]),
      U.carte('Comptes', U.tableau([{ titre: 'Nom', valeur: p => h('b', p.nom) }, { titre: 'Adresse', valeur: p => p.email }, { titre: 'Profil', valeur: p => U.badge(D.ROLES[p.role], 'info') }, { titre: 'Service', valeur: p => p.service },
        { titre: 'État', valeur: p => p.actif !== false ? U.badge('Actif', 'ok') : U.badge('Désactivé', 'danger') },
        { titre: 'Sécurité', valeur: p => E.celluleSecurite ? E.celluleSecurite(p, etats ? etats[p.id] : undefined) : '—' },
        { titre: '', classe: 'etroit', valeur: p => [U.bouton('Modifier', () => U.editer('Modifier l\'utilisateur', champs(false), p, v => D.modifier('profils', p.id, v, { action: v.role !== p.role ? 'Changement de profil : ' + D.ROLES[p.role] + ' → ' + D.ROLES[v.role] : 'Modification d\'un compte', libelle: p.nom })), 'secondaire.petit'), ' ',
          p.id !== D.utilisateur.id ? U.bouton(p.actif !== false ? 'Désactiver' : 'Réactiver', async () => { await D.modifier('profils', p.id, { actif: p.actif === false }, { action: p.actif !== false ? 'Désactivation d\'un compte' : 'Réactivation d\'un compte', libelle: p.nom }); U.recharger(); }, (p.actif !== false ? 'danger' : 'secondaire') + '.petit') : null, ' ',
          U.bouton('Mot de passe', () => U.editer('Réinitialiser le mot de passe de ' + p.nom, [{ nom: 'mdp', libelle: 'Nouveau mot de passe (12 caractères au moins)', type: 'motdepasse', requis: true }], {}, async v => { if (v.mdp.length < 12) throw new Error('Le mot de passe doit compter au moins 12 caractères.'); await D.changerMotDePasse(p.id, v.mdp); }), 'secondaire.petit')] }], profils)),
      U.carte('Habilitations par profil', [h('p.aide', 'Cochez les actions autorisées pour chaque profil. Chaque modification est tracée au journal. Les droits sur un dossier précis se règlent dans la fiche de la consultation.'),
        h('div.tableau-zone', h('table.tableau.matrice', h('thead', h('tr', h('th', { scope: 'col' }, 'Action autorisée'), roles.map(r => h('th', { scope: 'col' }, r[1])))),
          h('tbody', Object.entries(D.DROITS).map(d => h('tr', h('td', d[1]), roles.map(r => h('td', h('input', { type: 'checkbox', checked: a(r[0], d[0]), 'aria-label': r[1] + ' — ' + d[1], onchange: U.agir(e => basculer(r[0], d[0], e.target.checked)) })))))))) ]));
  };
  U.route('/admin', E.admin);

  E.parametres = async function () {
    D.exiger('admin.parametres');
    const params = await D.lister('parametres');
    const ligne = params.find(p => p.id === 'seuils');
    const s = Object.assign({}, Calcul.SEUILS_DEFAUT, ligne && ligne.valeur);
    const f = U.formulaire([
      { nom: 'date_effet', libelle: 'Date d\'effet de ces seuils', type: 'date', requis: true }, { nom: 'publicite_obligatoire', libelle: 'Publicité au BOAMP ou dans un JAL à partir de (€ HT)', type: 'nombre', requis: true },
      { nom: 'dispense_fournitures_services', libelle: 'Dispense de publicité et de mise en concurrence — fournitures et services, en dessous de (€ HT)', type: 'nombre', requis: true },
      { nom: 'dispense_travaux', libelle: 'Dispense — travaux, en dessous de (€ HT)', type: 'nombre', requis: true },
      { nom: 'formalise_fournitures_services', libelle: 'Procédure formalisée — fournitures et services, à partir de (€ HT)', type: 'nombre', requis: true },
      { nom: 'formalise_travaux', libelle: 'Procédure formalisée — travaux, à partir de (€ HT)', type: 'nombre', requis: true }], s, async v => {
      if (ligne) await D.modifier('parametres', 'seuils', { valeur: v, modifie_par_nom: D.utilisateur.nom, modifie_le: D.maintenant() }, { action: 'Modification des seuils de procédure', libelle: 'Seuils en vigueur au ' + U.date(v.date_effet), detail: v });
      else await D.creer('parametres', { id: 'seuils', valeur: v, modifie_par_nom: D.utilisateur.nom, modifie_le: D.maintenant() }, { action: 'Modification des seuils de procédure', libelle: 'Seuils en vigueur au ' + U.date(v.date_effet), detail: v });
      U.message('Seuils enregistrés.'); U.recharger();
    });
    return h('div', U.titrePage('Paramètres', 'Seuils de procédure utilisés pour la computation et l\'aide au choix de la procédure.'),
      U.carte('Seuils de procédure', [h('div.note-info.alerte', 'Les seuils évoluent (seuils européens révisés tous les deux ans, décrets nationaux). Ils sont à vérifier et à mettre à jour par l\'administrateur à chaque évolution réglementaire ; chaque modification est tracée.'),
        ligne && ligne.modifie_par_nom ? h('p.aide', 'Dernière modification par ' + ligne.modifie_par_nom + ' le ' + U.dateHeure(ligne.modifie_le)) : h('p.aide', 'Valeurs par défaut de la solution.'), f]),
      E.cartesParametres ? await E.cartesParametres() : null,
      D.mode === 'local' ? U.carte('Mode démonstration locale', h('p', 'Les données sont enregistrées dans ce navigateur. La réinitialisation efface tout et réinstalle le jeu de données fictif.'), [U.bouton('Réinitialiser les données de démonstration', async () => { if (await U.confirmer('Réinitialiser', 'Toutes les données locales seront effacées et remplacées par le jeu de démonstration.', 'Réinitialiser')) await D.reinitialiserLocal(); }, 'danger')])
        : window.CONFIG.afficherComptesDemo ? U.carte('Démonstration en ligne', h('p', 'Les données et les comptes de démonstration sont partagés entre les visiteurs. Ils sont remis à zéro chaque nuit à 3 h (heure de La Réunion) : comptes créés, dépôts et modifications du jour disparaissent alors.')) : null);
  };
  U.route('/parametres', E.parametres);
})();
