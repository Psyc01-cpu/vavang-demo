/* Sécurité des accès : double authentification (TOTP), déconnexion après inactivité, verrouillage après échecs,
   journal de sécurité, paramètres de sécurité. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  /* ---------- Déconnexion automatique après inactivité ---------- */
  let derniere = Date.now();
  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { derniere = Date.now(); }, { passive: true }));
  E.verifierInactivite = async function () {
    if (!D.utilisateur) return false;
    const sec = await D.parametresSecurite();
    if (Date.now() - derniere < sec.inactivite_minutes * 60000) return false;
    await D.journal('Déconnexion automatique après ' + sec.inactivite_minutes + ' min d\'inactivité', 'securite', D.utilisateur.id, D.utilisateur.nom);
    await D.deconnexion(); location.hash = '/'; await U.rafraichir();
    U.message('Session fermée après ' + sec.inactivite_minutes + ' minutes d\'inactivité. Reconnectez-vous pour continuer.', 'info');
    return true;
  };
  window.__simulerInactivite = minutes => { derniere = Date.now() - minutes * 60000 - 1000; return E.verifierInactivite(); }; // pour les tests
  setInterval(() => { E.verifierInactivite().catch(() => {}); }, 20000);

  /* ---------- Double authentification obligatoire pour les administrateurs ---------- */
  // État de la double authentification de l'agent connecté. En ligne (Supabase), gardé une minute en cache
  // pour ne pas interroger le serveur à chaque écran ; vidé après activation.
  let cacheMfa = null;
  E.viderEtatMfa = () => { cacheMfa = null; };
  E.etatMfa = async function () {
    if (D.mode !== 'supabase') return { mfa: D.etatSecurite(D.utilisateur.id).mfa };
    if (cacheMfa && cacheMfa.uid === D.utilisateur.id && Date.now() - cacheMfa.t < 60000) return cacheMfa.v;
    const v = await D.etatMfa(); cacheMfa = { uid: D.utilisateur.id, t: Date.now(), v }; return v;
  };
  // Niveau de session atteint (aal2 = mot de passe + code). D.etatMfa renvoie l'objet de Supabase ou le niveau seul.
  const niveauAal = m => m && m.aal ? (m.aal.currentLevel || m.aal) : null;
  const rafraichir = U.rafraichir;
  U.rafraichir = async function () {
    const chemin = (location.hash || '#/').slice(1).split('?')[0] || '/';
    if (D.utilisateur && D.mode === 'supabase' && chemin !== '/securite' && D.mfaRequis) {
      // En ligne : sans session aal2, le serveur ne donne de toute façon aucun droit à ce compte.
      const m = await E.etatMfa().catch(() => ({ mfa: false }));
      if (!m.mfa || (niveauAal(m) && niveauAal(m) !== 'aal2')) { location.hash = '/securite'; return; }
    }
    if (D.utilisateur && D.mode === 'local' && chemin !== '/securite') {
      const sec = await D.parametresSecurite();
      if (E.mfaObligatoire(sec) && !D.etatSecurite(D.utilisateur.id).mfa && !(E.reportMfaPermis() && sessionStorage.getItem('mfa-demo-reportee') === D.utilisateur.id)) { location.hash = '/securite'; return; }
    }
    const r = await rafraichir.apply(this, arguments);
    // Invitation à activer la double authentification (proposée par l'administrateur, à tous ou à un agent)
    if (D.utilisateur && chemin !== '/securite' && !sessionStorage.getItem('mfa-plus-tard') && !(await E.etatMfa().catch(() => ({ mfa: true }))).mfa) {
      const sec = await D.parametresSecurite();
      const invite = sec.mfa_proposer || (await D.lister('notifications', { destinataire_id: D.utilisateur.id })).some(n => n.type === 'mfa' && !n.lu);
      const zone = document.getElementById('contenu');
      if (invite && zone && !zone.querySelector('.invitation-mfa')) zone.prepend(h('div.note-info.invitation-mfa', h('b', 'Protégez votre compte : '), 'activez la double authentification. Un code à 6 chiffres sur votre téléphone, en plus du mot de passe. ',
        h('a.bouton.accent.petit', { href: '#/securite' }, 'Activer maintenant'), ' ', h('button.bouton.secondaire.petit', { type: 'button', onclick: e => { sessionStorage.setItem('mfa-plus-tard', '1'); e.target.closest('.invitation-mfa').remove(); } }, 'Plus tard')));
    }
    return r;
  };

  // Report de la double authentification : uniquement en démonstration locale explicite, jamais en ligne.
  E.reportMfaPermis = () => D.mode === 'local' && window.CONFIG.reportMfaDemoLocale === true && /^(127\.0\.0\.1|localhost|\[::1\])$/.test(location.hostname);
  E.mfaObligatoire = sec => !!(sec.mfa_tous || (sec.mfa_admin && D.utilisateur && D.utilisateur.role === 'administrateur'));

  /* ---------- Écran « Ma sécurité » ---------- */
  E.maSecurite = async function () {
    const enLigne = D.mode === 'supabase';
    const sec = enLigne ? await D.parametresSecurite().catch(() => Object.assign({}, D.SECURITE_DEFAUT)) : await D.parametresSecurite();
    const etat = enLigne ? Object.assign({}, await E.etatMfa(), { derniere_connexion: await D.maDerniereConnexion().catch(() => null) }) : D.etatSecurite(D.utilisateur.id);
    const obligatoire = enLigne ? !!D.mfaRequis : E.mfaObligatoire(sec);
    const zone = h('div');
    // En ligne : le facteur est créé par Supabase (QR fourni en image SVG), puis confirmé par un premier code.
    const activerEnLigne = async () => {
      const e = await D.enrolerMfa();
      const code = h('input.saisie', { id: 'code-totp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '123456', style: { maxWidth: '160px', fontSize: '1.3rem', letterSpacing: '.2em' } });
      zone.replaceChildren(U.carte('Activer la double authentification', h('div.mfa-etapes',
        h('img', { src: e.qr, alt: 'Code QR à scanner', width: 200, height: 200 }),
        h('ol', h('li', 'Ouvrez votre application d\'authentification (Microsoft Authenticator, Google Authenticator, FreeOTP…) et scannez ce code.'),
          h('li', 'Si vous ne pouvez pas scanner, saisissez cette clé : ', h('code', { id: 'secret-totp' }, String(e.secret || '').replace(/(.{4})/g, '$1 ').trim())),
          h('li', 'Saisissez le code à 6 chiffres affiché par l\'application :'),
          h('div.actions', code, U.bouton('Vérifier et activer', async () => {
            if (!/^\d{6}$/.test(code.value.trim())) throw new Error('Saisissez les 6 chiffres affichés par l\'application.');
            await D.confirmerMfa(e.factorId, code.value.trim()); E.viderEtatMfa();
            U.message('Double authentification activée. Elle vous sera demandée à chaque connexion.'); location.hash = '/'; if (E.menu) E.menu(); U.rafraichir();
          }, 'accent'))))));
      code.focus();
    };
    const activer = enLigne ? activerEnLigne : async () => {
      await D.chargerScript('vendor/qrcode.js');
      const secret = TOTP.genererSecret(); const uri = TOTP.uri(secret, D.utilisateur.email, (window.CONFIG.nomLogiciel || 'vavang'));
      const qr = qrcode(0, 'M'); qr.addData(uri); qr.make();
      const code = h('input.saisie', { id: 'code-totp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, placeholder: '123456', style: { maxWidth: '160px', fontSize: '1.3rem', letterSpacing: '.2em' } });
      zone.replaceChildren(U.carte('Activer la double authentification', h('div.mfa-etapes',
        h('div', { html: qr.createSvgTag({ cellSize: 5, margin: 2, scalable: false }), 'aria-label': 'Code QR à scanner', role: 'img' }),
        h('ol', h('li', 'Ouvrez votre application d\'authentification (Microsoft Authenticator, Google Authenticator, FreeOTP…) et scannez ce code.'),
          h('li', 'Si vous ne pouvez pas scanner, saisissez cette clé : ', h('code', { id: 'secret-totp' }, secret.replace(/(.{4})/g, '$1 ').trim())),
          h('li', 'Saisissez le code à 6 chiffres affiché par l\'application :'),
          h('div.actions', code, U.bouton('Vérifier et activer', async () => { await D.activerMfa(secret, code.value); U.message('Double authentification activée. Elle vous sera demandée à chaque connexion.'); location.hash = '/'; }, 'accent'))))));
      code.focus();
    };
    const journal = enLigne ? await D.mesEvenementsSecurite(12).catch(() => []) : (await D.lister('journal', {}, { ordre: 'date', desc: true, limite: 400 })).filter(l => (l.auteur_id === D.utilisateur.id || l.objet_id === D.utilisateur.id) && E.estSecurite(l)).slice(0, 12);
    return h('div', U.titrePage('Ma sécurité', D.utilisateur.nom + ' — ' + D.utilisateur.email),
      obligatoire && !etat.mfa ? h('div.note-info.alerte', h('b', 'Étape obligatoire : '), (sec.mfa_tous ? 'tous les comptes' : 'les comptes administrateurs') + ' doivent activer la double authentification avant d\'accéder à l\'application.') : null,
      h('div.grille2',
        U.carte('Double authentification', [U.definition([['État', etat.mfa ? U.badge('Activée', 'ok') : U.badge('Non activée', 'alerte')], ['Méthode', 'Code à 6 chiffres renouvelé toutes les 30 secondes (TOTP), calculé par une application sur votre téléphone'],
            ['Obligatoire pour votre profil', obligatoire ? 'Oui' : 'Non (recommandée)'], ['Dernière connexion', U.dateHeure(etat.derniere_connexion)]]),
          etat.mfa ? h('p.aide', 'Téléphone perdu ou changé : demandez à l\'administrateur de réinitialiser votre double authentification, puis activez-la de nouveau.') : null,
          enLigne ? h('p.aide', 'Session restée ouverte sur un autre appareil ou un poste partagé ? Fermez vos autres sessions : elles devront se reconnecter.') : null],
          (l => l.length ? l : null)((etat.mfa ? [] : [U.bouton('Activer la double authentification', activer, 'accent'),
            obligatoire && E.reportMfaPermis() ? U.bouton('Passer cette étape (démonstration)', async () => {
              sessionStorage.setItem('mfa-demo-reportee', D.utilisateur.id);
              await D.journal('Double authentification reportée (mode démonstration)', 'securite', D.utilisateur.id, D.utilisateur.nom, null, null, 'reporté');
              U.message('Étape reportée pour cette session de démonstration. En service réel, elle reste obligatoire.', 'info'); location.hash = '/';
            }, 'secondaire') : null]).concat(enLigne ? [U.bouton('Fermer mes autres sessions', async () => {
              if (!(await U.confirmer('Fermer mes autres sessions', 'Vos sessions ouvertes dans d\'autres navigateurs ou sur d\'autres appareils seront fermées. Celle-ci reste ouverte.', 'Fermer'))) return;
              await D.fermerAutresSessions(); U.message('Vos autres sessions sont fermées.');
            }, 'secondaire')] : []))),
        U.carte('Règles de sécurité en vigueur', U.definition([['Déconnexion automatique', 'après ' + sec.inactivite_minutes + ' minutes sans activité'], ['Verrouillage du compte', 'après ' + sec.echecs_max + ' échecs de connexion, pendant ' + sec.verrouillage_minutes + ' minutes'], ['Double authentification', sec.mfa_tous ? 'obligatoire pour tous' : (sec.mfa_admin ? 'obligatoire pour les administrateurs' : 'facultative') + (sec.mfa_proposer ? ', proposée à chaque connexion' : '')]]))),
      zone,
      U.carte('Vos derniers événements de sécurité', E.tableauJournal(journal)));
  };
  U.route('/securite', E.maSecurite);

  /* ---------- Journal de sécurité ---------- */
  E.estSecurite = l => ['session', 'securite', 'profils', 'habilitations', 'parametres'].includes(l.objet_type) || /connexion|habilitation|compte|mot de passe|double authentification/i.test(l.action || '');

  /* ---------- Administration : état de sécurité des comptes et paramètres ---------- */
  // p : profil ; etatEnLigne : état précalculé par D.etatSecuriteComptes() en mode Supabase (un seul appel pour tout l'écran).
  E.celluleSecurite = function (p, etatEnLigne) {
    const enLigne = D.mode === 'supabase';
    if (enLigne && !etatEnLigne) return '—';
    const e = enLigne ? { mfa: !!etatEnLigne.mfa, verrouille: !!(etatEnLigne.verrouille_jusqua && new Date(etatEnLigne.verrouille_jusqua) > new Date()), verrouille_jusqua: etatEnLigne.verrouille_jusqua,
      sessions: Number(etatEnLigne.sessions) || 0, derniere_connexion: etatEnLigne.derniere_connexion } : D.etatSecurite(p.id);
    return h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' } },
      e.mfa ? U.badge('Double authentification', 'ok') : U.badge('Sans double authentification', p.role === 'administrateur' ? 'alerte' : 'neutre'),
      e.verrouille ? [U.badge('Verrouillé jusqu\'à ' + new Date(e.verrouille_jusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), 'danger'), U.bouton('Déverrouiller', async () => { await D.deverrouiller(p.id); U.message('Compte déverrouillé.'); U.recharger(); }, 'secondaire.petit')] : null,
      !e.mfa && p.id !== D.utilisateur.id && p.actif !== false ? U.bouton('Proposer l\'activation', async () => { await D.creer('notifications', { destinataire_id: p.id, type: 'mfa', texte: 'L\'administrateur vous propose d\'activer la double authentification', lien: '/securite', lu: false, date: D.maintenant(), emetteur_nom: D.utilisateur.nom }, false); await D.journal('Proposition d\'activation de la double authentification', 'securite', p.id, p.nom); U.message('Proposition envoyée à ' + p.nom + ' : elle s\'affichera à sa prochaine connexion.'); }, 'secondaire.petit') : null,
      e.mfa && p.id !== D.utilisateur.id ? U.bouton('Réinitialiser la double authentification', async () => { if (await U.confirmer('Réinitialiser', p.nom + ' devra activer de nouveau la double authentification à sa prochaine connexion.', 'Réinitialiser')) { await D.reinitialiserMfa(p.id); U.recharger(); } }, 'secondaire.petit') : null,
      enLigne && e.sessions > 0 && p.id !== D.utilisateur.id ? U.bouton('Fermer ses sessions (' + e.sessions + ')', async () => { if (await U.confirmer('Fermer ses sessions', 'Toutes les sessions ouvertes de ' + p.nom + ' seront fermées : il lui faudra se reconnecter.', 'Fermer')) { await D.revoquerSessions(p.id); U.message('Sessions de ' + p.nom + ' fermées.'); U.recharger(); } }, 'secondaire.petit') : null,
      enLigne && e.derniere_connexion ? h('span.aide', 'Dernière connexion : ' + U.dateHeure(e.derniere_connexion)) : null);
  };
  E.carteSecurite = async function () {
    const sec = await D.parametresSecurite(); const ligne = (await D.lister('parametres', { id: 'securite' }))[0];
    const f = U.formulaire([
      { nom: 'inactivite_minutes', libelle: 'Déconnexion automatique après (minutes d\'inactivité)', type: 'nombre', requis: true, min: 1, max: 480 },
      { nom: 'echecs_max', libelle: 'Verrouillage du compte après (échecs de connexion)', type: 'nombre', requis: true, min: 3, max: 20 },
      { nom: 'verrouillage_minutes', libelle: 'Durée du verrouillage (minutes)', type: 'nombre', requis: true, min: 1, max: 1440 },
      { nom: 'mfa_admin', libelle: 'Double authentification obligatoire pour les administrateurs', type: 'case' },
      { nom: 'mfa_tous', libelle: 'Double authentification obligatoire pour tous les utilisateurs', type: 'case' },
      { nom: 'mfa_proposer', libelle: 'Proposer l\'activation à chaque connexion aux utilisateurs qui ne l\'ont pas', type: 'case' }], sec, async v => {
      if (v.inactivite_minutes < 1 || v.echecs_max < 3 || v.verrouillage_minutes < 1) throw new Error('Valeurs trop basses : au moins 1 minute d\'inactivité, 3 échecs et 1 minute de verrouillage.');
      const trace = { action: 'Modification des paramètres de sécurité', libelle: 'Inactivité ' + v.inactivite_minutes + ' min, verrouillage après ' + v.echecs_max + ' échecs', detail: v };
      if (ligne) await D.modifier('parametres', 'securite', { valeur: v }, trace); else await D.creer('parametres', { id: 'securite', valeur: v }, trace);
      U.message('Paramètres de sécurité enregistrés.'); U.recharger();
    });
    return U.carte('Sécurité des accès', [h('p.aide', 'S\'appliquent à tous les comptes. Chaque modification est tracée au journal de sécurité.'), f]);
  };
})();
