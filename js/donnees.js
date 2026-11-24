/* Accès aux données. Deux modes, même interface :
   - « supabase » : Postgres + authentification + stockage Supabase (mode cible, hébergé dans l'UE) ;
   - « local »    : base du navigateur (IndexedDB), pour la démonstration hors ligne et le développement.
   Les règles métier (Regles) sont vérifiées ici dans les deux modes ; en mode Supabase elles sont
   en plus imposées côté serveur par les politiques d'accès et les déclencheurs de supabase/schema.sql. */
(function () {
  'use strict';

  const TABLES = {
    profils: 'Utilisateurs', habilitations: 'Habilitations par profil', parametres: 'Paramètres', journal: 'Journal des actions',
    besoins: 'Besoins recensés', consultations: 'Consultations', affectations: 'Habilitations par dossier', lots: 'Lots',
    grilles: 'Grilles d\'analyse', criteres: 'Critères et sous-critères', grille_versions: 'Versions des grilles', modeles_grille: 'Modèles de grilles',
    pieces_attendues: 'Pièces attendues', offres: 'Candidatures et offres', pieces: 'Pièces et documents', annotations: 'Annotations et signets',
    lignes_prix: 'Lignes de prix', notes: 'Notes et appréciations', notes_historique: 'Historique des notes', demandes: 'Demandes aux candidats',
    analyses: 'Analyses par lot', rapports: 'Rapports d\'analyse', modeles_document: 'Modèles de documents et de courriers',
    documents_dce: 'Documents du DCE', documents_versions: 'Versions des documents', validations: 'Circuit de validation',
    marches: 'Marchés', evenements: 'Événements d\'exécution', fournisseurs: 'Fournisseurs', fournisseur_suivi: 'Suivi des fournisseurs',
    evaluations: 'Évaluations des titulaires', reprises: 'Reprises de données', annonces: 'Page d\'accueil : annonces, actualités et rubriques',
    notifications: 'Notifications', tickets: 'Demandes d\'assistance', factures: 'Factures et paiements', calculs: 'Journal des calculs'
  };

  const ROLES = { administrateur: 'Administrateur', gestionnaire: 'Gestionnaire de marchés', prescripteur: 'Service prescripteur', valideur: 'Valideur', lecteur: 'Lecteur / auditeur', support: 'Support éditeur' };

  const DROITS = {
    'besoins.ecrire': 'Recenser et modifier les besoins',
    'besoins.valider': 'Arrêter la procédure d\'un besoin',
    'consultations.ecrire': 'Créer et modifier les consultations et les lots',
    'consultations.toutes': 'Voir tous les dossiers (sinon : seulement les dossiers affectés)',
    'consultations.service': 'Voir les dossiers de son service',
    'dce.rediger': 'Rédiger les documents du DCE',
    'dce.relire': 'Relire les documents du DCE',
    'dce.valider': 'Valider les documents du DCE',
    'dce.publier': 'Marquer le DCE comme publié',
    'analyse.parametrer': 'Paramétrer la grille d\'analyse',
    'analyse.verrouiller': 'Verrouiller ou déverrouiller la grille',
    'analyse.saisir': 'Déposer les offres, saisir appréciations et notes',
    'analyse.valider': 'Valider les notes, les montants et l\'analyse',
    'rapport.rediger': 'Rédiger le rapport d\'analyse',
    'rapport.valider': 'Valider le rapport d\'analyse',
    'execution.ecrire': 'Suivre l\'exécution des marchés',
    'fournisseurs.ecrire': 'Gérer les fiches fournisseurs',
    'evaluations.ecrire': 'Évaluer les titulaires',
    'evaluations.valider': 'Valider les évaluations',
    'modeles.ecrire': 'Gérer les modèles (documents, grilles, courriers)',
    'reprise.importer': 'Importer des dossiers existants',
    'export.complet': 'Exporter l\'ensemble des données',
    'journal.lire': 'Consulter le journal des actions',
    'admin.utilisateurs': 'Gérer les utilisateurs et les habilitations',
    'admin.parametres': 'Modifier les paramètres (seuils, règles)',
    'accueil.ecrire': 'Publier les annonces et actualités de la page d\'accueil',
    'support.declarer': 'Déclarer une demande d\'assistance au support',
    'support.traiter': 'Traiter les demandes d\'assistance (équipe support de l\'éditeur)'
  };
  const DROITS_DEFAUT = {
    administrateur: Object.keys(DROITS),
    gestionnaire: ['besoins.ecrire', 'consultations.ecrire', 'consultations.toutes', 'dce.rediger', 'dce.publier', 'analyse.parametrer', 'analyse.saisir',
      'rapport.rediger', 'execution.ecrire', 'fournisseurs.ecrire', 'evaluations.ecrire', 'modeles.ecrire', 'reprise.importer', 'journal.lire', 'accueil.ecrire'],
    prescripteur: ['besoins.ecrire', 'dce.rediger', 'analyse.saisir', 'evaluations.ecrire'],
    valideur: ['consultations.toutes', 'besoins.valider', 'dce.relire', 'dce.valider', 'analyse.verrouiller', 'analyse.valider', 'rapport.valider', 'evaluations.valider', 'journal.lire'],
    lecteur: ['journal.lire']
  };

  for (const r of ['gestionnaire', 'prescripteur', 'valideur', 'lecteur']) DROITS_DEFAUT[r].push('support.declarer');
  DROITS_DEFAUT.prescripteur.push('consultations.service');
  DROITS_DEFAUT.support = ['support.traiter', 'support.declarer'];

  const cfg = window.CONFIG || { mode: 'local' };
  const D = { mode: cfg.mode === 'supabase' ? 'supabase' : 'local', TABLES, ROLES, DROITS, DROITS_DEFAUT, utilisateur: null, droits: new Set(), affectations: [] };
  D.mfaEnAttente = false; // mode supabase : session aal1 en attente du code de double authentification
  D.mfaRequis = false;    // mode supabase : double authentification exigée pour ce profil (renvoyé par mon_profil)
  let sb = null;         // client Supabase
  let pret = false, deconnexionEnCours = false;
  let idb = null;        // base IndexedDB
  const cache = {};      // mode local : toutes les lignes en mémoire

  D.id = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now() + Math.random().toString(16).slice(2));
  D.maintenant = () => new Date().toISOString();
  D.aujourdhui = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

  /* ---------- IndexedDB ---------- */
  function ouvrirIdb() {
    return new Promise((ok, ko) => {
      const r = indexedDB.open('logiciel-acheteur', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('lignes'); r.result.createObjectStore('fichiers'); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
    });
  }
  function idbReq(store, mode, fn) {
    return new Promise((ok, ko) => {
      const tx = idb.transaction(store, mode); const res = fn(tx.objectStore(store));
      tx.oncomplete = () => ok(res && res.result); tx.onerror = () => ko(tx.error);
    });
  }

  /* ---------- Initialisation ---------- */
  D.init = async function () {
    if (D.mode === 'supabase') {
      if (!cfg.supabaseUrl || !cfg.supabaseCle) throw new Error('Configuration incomplète : renseignez l\'adresse (supabaseUrl) et la clé publique (supabaseCle) dans config.js.');
      if (!window.supabase) await D.chargerScript('vendor/supabase.js');
      // Flux PKCE : le retour d'un fournisseur d'identité (SSO) arrive en « ?code=… », compatible avec les routes en « #/… ».
      const retourSso = new URLSearchParams(location.search);
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseCle, { auth: { persistSession: true, storageKey: 'acheteur-session', flowType: 'pkce', detectSessionInUrl: true } });
      if (retourSso.has('code') || retourSso.has('error')) {
        if (retourSso.has('error')) D.erreurSso = traduireSso(retourSso.get('error_description') || retourSso.get('error'));
        else { try { await sb.auth.exchangeCodeForSession(retourSso.get('code')); } catch (e) { /* déjà échangé par detectSessionInUrl */ } D.retourSso = true; }
        history.replaceState(null, '', location.pathname + (location.hash || '#/'));
      }
      // Session fermée ailleurs (expiration, révocation, autre onglet) : on oublie l'utilisateur et on réaffiche l'écran.
      sb.auth.onAuthStateChange(ev => {
        if (ev !== 'SIGNED_OUT') return;
        D.utilisateur = null; D.droits = new Set(); D.affectations = []; D.mfaEnAttente = false; D.mfaRequis = false;
        if (pret && !deconnexionEnCours && window.U && U.rafraichir) setTimeout(() => U.rafraichir(), 0);
      });
      try {
        const { data } = await sb.auth.getSession();
        if (data && data.session) {
          const aal = await etatAal();
          // Mot de passe vérifié mais code de double authentification pas encore saisi : profil non chargé.
          if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') D.mfaEnAttente = true;
          else await chargerProfil(data.session.user.id);
          // Retour d'une connexion unique (SSO) : connexion enregistrée côté serveur, comme pour un mot de passe.
          if (D.retourSso && D.utilisateur) { try { await sb.rpc('connexion_reussie'); } catch (e) { /* sans effet */ } }
        }
      } catch (e) {
        console.warn('session', e); D.utilisateur = null; D.droits = new Set(); D.affectations = []; D.mfaEnAttente = false;
        try { await sb.auth.signOut({ scope: 'local' }); } catch (e2) { /* page publique quand même */ }
      }
      pret = true;
    } else {
      idb = await ouvrirIdb();
      for (const t of Object.keys(TABLES).concat(['comptes_locaux'])) cache[t] = [];
      const toutes = await idbReq('lignes', 'readonly', s => s.getAll());
      for (const l of toutes) (cache[l.__t] || (cache[l.__t] = [])).push(l);
      if (!cache.profils.length && window.Demo) await window.Demo.installer(D);
      else if (window.Demo) await window.Demo.completer(D, cache);
      await D._hacherComptes();
      const uid = sessionStorage.getItem('acheteur-uid') || localStorage.getItem('acheteur-uid');
      if (uid) await chargerProfil(uid);
    }
  };
  async function chargerProfil(uid) {
    if (D.mode === 'supabase') {
      // mon_profil : seule lecture permise à un administrateur en aal1, pour qu'il puisse aller jusqu'à l'enrôlement.
      const { data: r, error } = await sb.rpc('mon_profil'); if (error) throw new Error(traduire(error));
      if (!r || r.actif === false) { D.utilisateur = null; D.droits = new Set(); D.affectations = []; return; }
      const prof = Object.assign({}, r); delete prof.mfa_requis; delete prof.aal;
      D.mfaRequis = !!r.mfa_requis; D.utilisateur = prof;
      const aal = await etatAal();
      if (D.mfaRequis && aal.currentLevel !== 'aal2') { D.droits = new Set(); D.affectations = []; return; } // seul /securite reste accessible
      const hs = await D.lister('habilitations', { role: prof.role }, { brut: true });
      D.droits = new Set(hs.map(x => x.droit));
      D.affectations = await D.lister('affectations', { profil_id: prof.id }, { brut: true });
      return;
    }
    const p = await D.lire('profils', uid, true);
    if (!p || p.actif === false) { D.utilisateur = null; return; }
    D.utilisateur = p;
    const h = await D.lister('habilitations', { role: p.role }, { brut: true });
    D.droits = new Set(h.map(x => x.droit));
    D.affectations = await D.lister('affectations', { profil_id: p.id }, { brut: true });
  }
  D.peut = droit => D.droits.has(droit);
  D.exiger = droit => { if (!D.peut(droit)) throw new Error('Action non autorisée pour votre profil (' + (DROITS[droit] || droit) + ').'); };
  D.fonctionSurDossier = consultationId => { const a = D.affectations.find(x => x.consultation_id === consultationId); return a ? a.fonction : null; };
  // Habilitation limitée à certains lots : une affectation peut viser un lot précis.
  D.lotAutorise = (consultationId, lotId) => {
    if (!lotId || D.peut('consultations.toutes')) return true;
    const a = D.affectations.filter(x => x.consultation_id === consultationId);
    return !a.length || a.some(x => !x.lot_id || x.lot_id === lotId);
  };
  // Circuit de validation du DCE, paramétrable par l'administrateur (étapes entre la rédaction et la validation finale).
  D.CIRCUIT_DCE_DEFAUT = [{ id: 'relecture', libelle: 'Relecture', droit: 'dce.relire' }, { id: 'validation', libelle: 'Validation', droit: 'dce.valider' }];
  D.circuitDce = async () => { const p = (await D.lister('parametres', { id: 'circuit_dce' }))[0]; return (p && Array.isArray(p.valeur) && p.valeur.length) ? p.valeur : D.CIRCUIT_DCE_DEFAUT; };
  D.voitConsultation = c => D.peut('consultations.toutes') || (D.peut('consultations.service') && !!c.service && !!D.utilisateur && c.service === D.utilisateur.service) || c.cree_par === (D.utilisateur && D.utilisateur.id) || !!D.fonctionSurDossier(c.id);

  /* ---------- Authentification ---------- */
  D.chargerScript = src => new Promise((ok, ko) => { if (document.querySelector('script[data-src="' + src + '"]')) { const e = document.querySelector('script[data-src="' + src + '"]'); return e.dataset.charge ? ok() : e.addEventListener('load', () => ok()); }
    const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = () => { s.dataset.charge = '1'; ok(); }; s.onerror = () => ko(new Error('Chargement impossible : ' + src)); document.head.appendChild(s); });

  /* ---------- Sécurité des comptes (mode local) ---------- */
  D.SECURITE_DEFAUT = { inactivite_minutes: 15, echecs_max: 5, verrouillage_minutes: 15, mfa_admin: true, mfa_tous: false, mfa_proposer: true };
  D.parametresSecurite = async () => { const p = (await D.lister('parametres', { id: 'securite' }))[0]; return Object.assign({}, D.SECURITE_DEFAUT, p && p.valeur); };
  const compte = uid => (cache.comptes_locaux || []).find(x => x.id === uid);
  async function empreinteMdp(mdp, sel) {
    const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(mdp), 'PBKDF2', false, ['deriveBits']);
    const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(sel), iterations: 120000, hash: 'SHA-256' }, cle, 256);
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  async function hacherCompte(c) { if (c.mot_de_passe == null) return; c.sel = D.id(); c.empreinte = await empreinteMdp(c.mot_de_passe, c.sel); delete c.mot_de_passe; await idbReq('lignes', 'readwrite', s => s.put(c, 'comptes_locaux|' + c.id)); }
  async function verifierMdp(c, mdp) { if (c.empreinte) return (await empreinteMdp(String(mdp || ''), c.sel)) === c.empreinte; return c.mot_de_passe === mdp; }
  D._hacherComptes = async () => { for (const c of cache.comptes_locaux || []) await hacherCompte(c); };
  const sauverCompte = c => idbReq('lignes', 'readwrite', s => s.put(c, 'comptes_locaux|' + c.id));
  D.etatSecurite = uid => { const c = compte(uid) || {}; return { mfa: !!c.totp_secret, verrouille: !!(c.verrouille_jusqua && c.verrouille_jusqua > D.maintenant()), verrouille_jusqua: c.verrouille_jusqua || null, derniere_connexion: c.derniere_connexion || null }; };
  D.activerMfa = async (secret, codeSaisi) => {
    if (!(await TOTP.verifier(secret, codeSaisi))) { await D.journal('Activation de la double authentification refusée (code invalide)', 'securite', D.utilisateur.id, D.utilisateur.nom, null, null, 'échec'); throw new Error('Code incorrect : vérifiez l\'heure de votre téléphone et saisissez le code affiché.'); }
    const c = compte(D.utilisateur.id); c.totp_secret = secret; c.totp_active_le = D.maintenant(); await sauverCompte(c);
    await D.journal('Activation de la double authentification', 'securite', D.utilisateur.id, D.utilisateur.nom);
  };
  const sansCompte = () => new Error('Aucun compte de connexion n\'est rattaché à ce profil.');
  // Appel d'une fonction serveur (mode supabase) : l'erreur est traduite et levée.
  async function rpc(nom, params) { const { data, error } = await sb.rpc(nom, params || {}); if (error) throw new Error(traduire(error)); return data; }
  D.reinitialiserMfa = async uid => {
    D.exiger('admin.utilisateurs');
    if (D.mode === 'supabase') { await rpc('reinitialiser_mfa', { p_id: uid }); return; }
    const c = compte(uid); if (!c) throw sansCompte(); delete c.totp_secret; await sauverCompte(c); const p = cache.profils.find(x => x.id === uid); await D.journal('Réinitialisation de la double authentification', 'securite', uid, p && p.nom);
  };
  D.deverrouiller = async uid => {
    D.exiger('admin.utilisateurs');
    if (D.mode === 'supabase') { await rpc('deverrouiller_compte', { p_id: uid }); return; }
    const c = compte(uid); if (!c) throw sansCompte(); c.verrouille_jusqua = null; c.echecs = 0; await sauverCompte(c); const p = cache.profils.find(x => x.id === uid); await D.journal('Déverrouillage d\'un compte', 'securite', uid, p && p.nom);
  };
  // Ferme toutes les sessions d'un compte (mode supabase) ; en local, les sessions sont propres à chaque navigateur : rien à fermer.
  D.revoquerSessions = async uid => { D.exiger('admin.utilisateurs'); if (D.mode !== 'supabase') return 0; return (await rpc('revoquer_sessions', { p_id: uid })) || 0; };
  // État de sécurité de tous les comptes, calculé une fois pour l'écran d'administration : { id: { mfa, verrouille, verrouille_jusqua, derniere_connexion, sessions } }.
  D.etatSecuriteComptes = async () => {
    const m = {};
    if (D.mode === 'supabase') {
      for (const r of (await rpc('etat_securite_comptes')) || []) m[r.id] = { mfa: !!r.mfa, verrouille: !!(r.verrouille_jusqua && new Date(r.verrouille_jusqua) > new Date()),
        verrouille_jusqua: r.verrouille_jusqua || null, derniere_connexion: r.derniere_connexion || null, sessions: r.sessions || 0 };
    } else for (const c of cache.comptes_locaux || []) m[c.id] = D.etatSecurite(c.id);
    return m;
  };
  // Niveau d'authentification de la session (aal1 : mot de passe ; aal2 : mot de passe + code).
  async function etatAal() { const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); if (error) throw new Error(traduire(error)); return data || {}; }
  D.etatMfa = async () => {
    if (D.mode !== 'supabase') return { mfa: !!(D.utilisateur && D.etatSecurite(D.utilisateur.id).mfa) };
    const [{ data: f, error }, aal] = await Promise.all([sb.auth.mfa.listFactors(), etatAal()]); if (error) throw new Error(traduire(error));
    return { mfa: ((f && f.totp) || []).some(x => x.status === 'verified'), aal: aal.currentLevel || null, aalSuivant: aal.nextLevel || null };
  };
  // Activation en deux temps : enrolerMfa (clé + QR) puis confirmerMfa (premier code). En local, le secret est généré ici et vérifié par activerMfa.
  D.enrolerMfa = async () => {
    if (D.mode !== 'supabase') { const secret = TOTP.genererSecret(); return { factorId: secret, qr: null, secret, uri: TOTP.uri(secret, D.utilisateur.email, cfg.nomLogiciel || 'vavang') }; }
    const { data: l } = await sb.auth.mfa.listFactors();
    for (const f of ((l && l.all) || []).filter(x => x.status === 'unverified')) await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'vavang' }); if (error) throw new Error(traduire(error));
    return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri };
  };
  D.confirmerMfa = async (factorId, code) => {
    if (D.mode !== 'supabase') return D.activerMfa(factorId, code);
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: String(code || '').replace(/\s+/g, '') });
    if (error) throw new Error('Code incorrect : vérifiez l\'heure de votre téléphone et saisissez le code affiché.');
    await sb.auth.refreshSession(); D.mfaEnAttente = false;
    await chargerProfil(D.utilisateur.id); // droits obtenus en aal2
    // Accepté par journaliser seulement en aal2 avec un facteur vérifié : la trace ne peut pas être forgée.
    await D.journal('Activation de la double authentification', 'securite', D.utilisateur && D.utilisateur.id, D.utilisateur && D.utilisateur.nom);
  };
  D.fermerAutresSessions = async () => {
    if (D.mode !== 'supabase') return;
    const { error } = await sb.auth.signOut({ scope: 'others' }); if (error) throw new Error(traduire(error));
    await D.journal('Fermeture des autres sessions', 'session', D.utilisateur && D.utilisateur.id, D.utilisateur && D.utilisateur.nom);
  };
  D.mesEvenementsSecurite = async (limite) => {
    limite = limite || 12;
    if (D.mode === 'supabase') return (await rpc('mes_evenements_securite', { p_limite: limite })) || [];
    const u = D.utilisateur; if (!u) return [];
    const Ecr = window.Ecrans; const estSec = l => (Ecr && Ecr.estSecurite) ? Ecr.estSecurite(l) : ['session', 'securite'].includes(l.objet_type);
    return (await D.lister('journal', {}, { ordre: 'date', desc: true, limite: 400 })).filter(l => (l.auteur_id === u.id || l.objet_id === u.id) && estSec(l)).slice(0, limite);
  };
  /* ---------- Connexion unique (SSO) par un fournisseur d'identité externe (mode hébergé) ---------- */
  function traduireSso(m) {
    m = String(m || '');
    if (/signups? not allowed|not allowed for this instance/i.test(m)) return 'Ce compte externe n\'est associé à aucun compte vavang. Connectez-vous d\'abord avec votre adresse et votre mot de passe, puis associez-le dans « Ma sécurité ».';
    if (/access_denied|denied/i.test(m)) return 'Connexion annulée chez le fournisseur d\'identité.';
    return 'Connexion unique impossible : ' + m;
  }
  D.ssoFournisseurs = () => (D.mode === 'supabase' && Array.isArray(cfg.sso)) ? cfg.sso : [];
  const retourVers = suite => location.origin + location.pathname + (suite || '#/');
  D.connexionSso = async fournisseur => {
    const { error } = await sb.auth.signInWithOAuth({ provider: fournisseur, options: { redirectTo: retourVers('#/') } });
    if (error) throw new Error(traduireSso(error.message));
  };
  D.identitesSso = async () => {
    if (D.mode !== 'supabase') return [];
    const { data, error } = await sb.auth.getUserIdentities(); if (error) throw new Error(traduire(error));
    return ((data && data.identities) || []).filter(i => i.provider !== 'email');
  };
  D.lierSso = async fournisseur => {
    const { error } = await sb.auth.linkIdentity({ provider: fournisseur, options: { redirectTo: retourVers('#/securite') } });
    if (error) throw new Error(traduireSso(error.message));
  };
  D.delierSso = async fournisseur => {
    const id = (await D.identitesSso()).find(i => i.provider === fournisseur); if (!id) return;
    const { error } = await sb.auth.unlinkIdentity(id); if (error) throw new Error(traduire(error));
    await D.journal('Dissociation d\'un compte externe (SSO)', 'securite', D.utilisateur && D.utilisateur.id, fournisseur);
  };
  D.maDerniereConnexion = async () => {
    if (D.mode === 'supabase') { const { data } = await sb.auth.getUser(); return (data && data.user && data.user.last_sign_in_at) || null; }
    return D.utilisateur ? D.etatSecurite(D.utilisateur.id).derniere_connexion : null;
  };
  // Le nom affiché de la collectivité est mis en cache par les écrans : on le vide à chaque changement d'utilisateur.
  const viderIdentite = () => { try { if (window.Ecrans && typeof window.Ecrans.viderIdentite === 'function') window.Ecrans.viderIdentite(); window.dispatchEvent(new Event('vavang:utilisateur')); } catch (e) { /* sans effet */ } };
  async function signalerEchec(email) { try { await sb.rpc('signaler_echec_connexion', { p_email: email }); } catch (e) { /* ne bloque pas le message */ } }

  D.connexion = async function (email, motDePasse, codeMfa) {
    email = String(email || '').trim().toLowerCase();
    if (D.mode === 'supabase') {
      const horsLigne = 'Connexion au serveur impossible. Vérifiez votre accès Internet.';
      let session = null;
      // Mot de passe déjà vérifié (session aal1 en attente) : seul le code est demandé, sans refaire signInWithPassword.
      if (D.mfaEnAttente && codeMfa) { const { data: s } = await sb.auth.getSession(); session = s && s.session;
        if (!session && !email) { D.mfaEnAttente = false; throw new Error('Session expirée, reconnectez-vous.'); } }
      if (!session) {
        let r; try { r = await sb.auth.signInWithPassword({ email, password: motDePasse }); } catch (e) { throw new Error(horsLigne); }
        if (r.error) {
          const c = r.error.code || '', m = r.error.message || '';
          if (c === 'user_banned' || /banned/i.test(m)) throw new Error('Compte verrouillé temporairement après plusieurs échecs de connexion. Réessayez plus tard ou demandez à l\'administrateur de le déverrouiller.');
          if (c === 'over_request_rate_limit' || /rate limit/i.test(m)) throw new Error('Trop de tentatives depuis ce poste : patientez quelques minutes avant de réessayer.');
          if (c === 'email_not_confirmed') throw new Error('Adresse électronique non confirmée : contactez l\'administrateur.');
          if (r.error.name === 'AuthRetryableFetchError' || r.error.status === 0 || /Failed to fetch|NetworkError|fetch/i.test(m)) throw new Error(horsLigne);
          await signalerEchec(email); throw new Error('Adresse ou mot de passe incorrect.');
        }
        session = r.data.session;
      }
      const aal = await etatAal();
      if (aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        D.mfaEnAttente = true;
        if (!codeMfa) { const e = new Error('Saisissez le code à 6 chiffres affiché par votre application d\'authentification.'); e.mfa = true; throw e; }
        const { data: l, error: el } = await sb.auth.mfa.listFactors(); if (el) throw new Error(traduire(el));
        const f = ((l && l.totp) || []).find(x => x.status === 'verified'); if (!f) throw new Error('Aucune double authentification active sur ce compte.');
        const { error: ev } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: String(codeMfa).replace(/\s+/g, '') });
        if (ev) { await signalerEchec(email); const e = new Error('Code de vérification incorrect.'); e.mfa = true; throw e; }
      }
      D.mfaEnAttente = false;
      await chargerProfil(session.user.id);
      if (!D.utilisateur) { await sb.auth.signOut({ scope: 'local' }); throw new Error('Ce compte est désactivé.'); }
      const { error: ec } = await sb.rpc('connexion_reussie'); if (ec) console.warn('connexion_reussie', ec.message); // le serveur journalise la connexion
    } else {
      const sec = await D.parametresSecurite();
      const c = cache.comptes_locaux.find(x => x.email === email);
      const p = c && cache.profils.find(x => x.id === c.id);
      if (c && c.verrouille_jusqua && c.verrouille_jusqua > D.maintenant()) {
        await D.journal('Connexion refusée (compte verrouillé)', 'securite', c.id, email, null, null, 'refusé');
        throw new Error('Compte verrouillé après plusieurs échecs de connexion, jusqu\'à ' + new Date(c.verrouille_jusqua).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + '. L\'administrateur peut le déverrouiller.');
      }
      const echec = async (motif, message) => {
        if (c) {
          c.echecs = (c.echecs || 0) + 1;
          if (c.echecs >= sec.echecs_max) { c.verrouille_jusqua = new Date(Date.now() + sec.verrouillage_minutes * 60000).toISOString(); c.echecs = 0; await sauverCompte(c);
            await D.journal('Compte verrouillé après ' + sec.echecs_max + ' échecs de connexion', 'securite', c.id, email, null, null, 'refusé');
            throw new Error('Trop d\'échecs : le compte est verrouillé pendant ' + sec.verrouillage_minutes + ' minutes. L\'administrateur peut le déverrouiller.'); }
          await sauverCompte(c);
        }
        await D.journalAnonyme(motif, email); throw new Error(message);
      };
      if (!c || !(await verifierMdp(c, motDePasse)) || !p) await echec('Échec de connexion', 'Adresse ou mot de passe incorrect.');
      if (p.actif === false) { await D.journalAnonyme('Connexion refusée (compte désactivé)', email); throw new Error('Ce compte est désactivé.'); }
      if (c.totp_secret) {
        if (!codeMfa) { const e = new Error('Saisissez le code à 6 chiffres affiché par votre application d\'authentification.'); e.mfa = true; throw e; }
        if (!(await TOTP.verifier(c.totp_secret, codeMfa))) await echec('Échec de connexion (code de double authentification incorrect)', 'Code de vérification incorrect.');
      }
      c.echecs = 0; c.derniere_connexion = D.maintenant(); await sauverCompte(c);
      sessionStorage.setItem('acheteur-uid', p.id);
      await chargerProfil(p.id);
    }
    if (D.mode === 'local') await D.journal('Connexion', 'session', D.utilisateur.id, D.utilisateur.nom, D.etatSecurite(D.utilisateur.id).mfa ? { double_authentification: true } : null);
    viderIdentite();
  };
  D.deconnexion = async function () {
    if (D.utilisateur) await D.journal('Déconnexion', 'session', D.utilisateur.id, D.utilisateur.nom);
    if (D.mode === 'supabase') {
      // Portée locale : seule la session de ce navigateur est fermée (les autres postes restent connectés).
      deconnexionEnCours = true;
      try { await sb.auth.signOut({ scope: 'local' }); } catch (e) { console.warn('deconnexion', e); } finally { deconnexionEnCours = false; }
      D.mfaEnAttente = false; D.mfaRequis = false;
    } else { sessionStorage.removeItem('acheteur-uid'); localStorage.removeItem('acheteur-uid'); }
    D.utilisateur = null; D.droits = new Set(); D.affectations = [];
    viderIdentite();
  };

  /* ---------- Lecture ---------- */
  D.lister = async function (table, filtre, options) {
    filtre = filtre || {}; options = options || {};
    let lignes;
    if (D.mode === 'supabase') {
      // Chaque table porte un identifiant et un document JSON « d » : les filtres portent sur les clés du document.
      // Colonnes techniques (cree_le, cree_par, modifie_le) reprises dans l'objet ; options.colonnes : seules ces clés du document sont lues (ex. pièces sans 'pages').
      const TECH = ['cree_le', 'cree_par', 'modifie_le'];
      const cles = Array.isArray(options.colonnes) ? options.colonnes.filter(k => /^\w+$/.test(k) && k !== 'id' && !TECH.includes(k)) : null;
      const select = 'id,' + TECH.join(',') + (cles ? cles.map(k => ',' + k + ':d->' + k).join('') : ',d');
      const max = table === 'journal' ? (options.limite || 3000) : 5000, asc = !(table === 'journal' && options.desc);
      const page = (de, a) => {
        let q = sb.from(table).select(select);
        for (const k of Object.keys(filtre)) { const col = k === 'id' ? 'id' : 'd->>' + k; const v = filtre[k];
          q = Array.isArray(v) ? q.in(col, v.map(String)) : (v === null ? q.is(col, null) : q.eq(col, String(v))); }
        return q.order('cree_le', { ascending: asc }).order('id', { ascending: true }).range(de, a);
      };
      // Pagination par tranches de 1000 lignes (plafond du serveur), jusqu'à une tranche incomplète ou la limite demandée.
      const brutes = [];
      for (let i = 0; i < max; i += 1000) {
        const n = Math.min(1000, max - i);
        const { data, error } = await page(i, i + n - 1); if (error) throw new Error(traduire(error));
        brutes.push(...data); if (data.length < n) break;
      }
      lignes = brutes.map(r => {
        const d = cles ? Object.fromEntries(cles.filter(k => r[k] !== undefined).map(k => [k, r[k]])) : (r.d || {});
        const o = Object.assign({}, d, { id: r.id });
        // Les valeurs techniques complètent le document sans l'écraser ; on retient celles ajoutées pour ne pas les réécrire dans « d ».
        const ajoutees = TECH.filter(k => !(k in d) && r[k] !== undefined); for (const k of ajoutees) o[k] = r[k];
        Object.defineProperty(o, '__tech', { value: ajoutees, enumerable: false });
        return o;
      });
      if (options.ordre) lignes.sort((a, b) => cmp(a[options.ordre], b[options.ordre]) * (options.desc ? -1 : 1));
      if (options.limite) lignes = lignes.slice(0, options.limite);
    } else {
      lignes = (cache[table] || []).filter(l => Object.keys(filtre).every(k => Array.isArray(filtre[k]) ? filtre[k].includes(l[k]) : (l[k] === undefined ? null : l[k]) === filtre[k]))
        .map(l => { const c = structuredClone(l); delete c.__t; return c; });
      if (options.ordre) lignes.sort((a, b) => cmp(a[options.ordre], b[options.ordre]) * (options.desc ? -1 : 1));
      if (options.limite) lignes = lignes.slice(0, options.limite);
    }
    return lignes;
  };
  D.lire = async function (table, id) {
    if (!id) return null;
    const r = await D.lister(table, { id }); return r[0] || null;
  };
  function sansId(l) { const c = Object.assign({}, l); delete c.id; return c; }
  function cmp(a, b) { if (a == null) return b == null ? 0 : -1; if (b == null) return 1; return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'fr', { numeric: true }); }

  /* ---------- Écriture ---------- */
  // trace : { action, libelle, consultation_id, detail } — entrée lisible dans le journal ; sinon libellé générique.
  D.creer = async function (table, ligne, trace) {
    ligne = Object.assign({ id: D.id() }, ligne);
    await Regles.verifier(table, 'creer', null, ligne);
    if (D.mode === 'supabase') {
      if (!('cree_le' in ligne)) ligne.cree_le = D.maintenant(); // sinon l'objet renvoyé n'a pas de date
      const { error } = await sb.from(table).insert({ id: ligne.id, d: sansId(ligne) }); if (error) throw new Error(traduire(error));
    } else {
      if (!('cree_le' in ligne)) ligne.cree_le = D.maintenant();
      const l = Object.assign({ __t: table }, ligne); cache[table].push(l);
      await idbReq('lignes', 'readwrite', s => s.put(l, table + '|' + l.id));
    }
    if (trace !== false && table !== 'journal') await D.journal((trace && trace.action) || 'Création', table, ligne.id, (trace && trace.libelle) || TABLES[table], trace && trace.detail, trace && trace.consultation_id);
    return ligne;
  };
  D.modifier = async function (table, id, patch, trace) {
    const avant = await D.lire(table, id);
    if (!avant) throw new Error('Élément introuvable (' + (TABLES[table] || table) + ').');
    const apres = Object.assign({}, avant, patch);
    await Regles.verifier(table, 'modifier', avant, apres);
    if (D.mode === 'supabase') {
      // Les colonnes techniques lues avec la ligne ne sont pas réécrites dans le document, sauf si le patch les fixe.
      const d = sansId(apres); for (const k of avant.__tech || []) if (!(k in patch)) delete d[k];
      const { data, error } = await sb.from(table).update({ d }).eq('id', id).select('id'); if (error) throw new Error(traduire(error));
      if (!data || !data.length) throw new Error('Action non autorisée pour votre profil.'); // aucune ligne modifiée (politique d'accès)
    } else {
      const i = cache[table].findIndex(x => x.id === id); const l = Object.assign({ __t: table }, apres); cache[table][i] = l;
      await idbReq('lignes', 'readwrite', s => s.put(l, table + '|' + id));
    }
    if (trace !== false) {
      const champs = Object.keys(patch).filter(k => JSON.stringify(avant[k]) !== JSON.stringify(patch[k]));
      await D.journal((trace && trace.action) || 'Modification', table, id, (trace && trace.libelle) || TABLES[table],
        Object.assign({ champs_modifies: champs }, trace && trace.detail), trace && trace.consultation_id);
    }
    return apres;
  };
  D.supprimer = async function (table, id, trace) {
    const avant = await D.lire(table, id); if (!avant) return;
    await Regles.verifier(table, 'supprimer', avant, null);
    if (D.mode === 'supabase') {
      const { data, error } = await sb.from(table).delete().eq('id', id).select('id'); if (error) throw new Error(traduire(error));
      if (!data || !data.length) throw new Error('Action non autorisée pour votre profil.'); // aucune ligne supprimée (politique d'accès)
    } else {
      cache[table] = cache[table].filter(x => x.id !== id);
      await idbReq('lignes', 'readwrite', s => s.delete(table + '|' + id));
    }
    if (trace !== false) await D.journal((trace && trace.action) || 'Suppression', table, id, (trace && trace.libelle) || TABLES[table], trace && trace.detail, trace && trace.consultation_id);
  };

  /* ---------- Guichet d'assistance (dépôt sans connexion) ----------
     Pas de ligne directe : le demandeur choisit un type de panne, écrit un commentaire et laisse un numéro de rappel.
     Valeurs autorisées et limites partagées avec l'écran (js/ecrans/guichet.js) et avec le serveur (supabase/guichet.sql). */
  D.GUICHET = {
    types: [['connexion', 'Je n\'arrive pas à me connecter'], ['compte', 'Compte bloqué / mot de passe'], ['ecran', 'Un écran ne s\'affiche pas ou une erreur apparaît'],
      ['lenteur', 'Lenteur'], ['fichiers', 'Import / export de fichiers'], ['documents', 'Document ou modèle (DCE, rapport)'], ['analyse', 'Analyse des offres / calculs'],
      ['droits', 'Droits et habilitations'], ['evolution', 'Demande d\'évolution'], ['autre', 'Autre question']],
    urgences: [['bloquant', 'Bloquant — je ne peux plus travailler', 'P2'], ['genant', 'Gênant — je contourne, mais cela me ralentit', 'P3'], ['sans_urgence', 'Sans urgence — une question, une idée', 'P4']],
    profils: [['agent', 'Agent utilisateur'], ['referent', 'Référent de la collectivité'], ['autre', 'Autre']],
    creneaux: [['des_que_possible', 'Dès que possible, aux horaires du guichet'], ['matin', 'Le matin (8 h – 12 h)'], ['apres_midi', 'L\'après-midi (12 h – 17 h)']],
    limites: { nom: 120, collectivite: 160, telephone: 30, courriel: 160, commentaire: 3000 },
    plafonds: { parTelephone: 5, parCourriel: 5, total: 30 } // dépôts par heure
  };
  const libelleDe = (liste, cle) => (liste.find(x => x[0] === cle) || [])[1];
  // Contrôle et nettoyage d'une demande du guichet (mêmes règles que deposer_demande_guichet côté serveur).
  D.validerGuichet = function (v) {
    const G = D.GUICHET, L = G.limites, t = x => String(x == null ? '' : x).trim();
    if (t(v.site_web)) throw new Error('Demande refusée.'); // champ piège invisible : rempli seulement par un robot
    const p = { type_demande: t(v.type_demande), commentaire: t(v.commentaire), nom: t(v.nom), collectivite: t(v.collectivite), telephone: t(v.telephone), courriel: t(v.courriel).toLowerCase(),
      profil: t(v.profil) || 'agent', creneau: t(v.creneau) || 'des_que_possible', urgence: t(v.urgence) };
    if (!libelleDe(G.types, p.type_demande)) throw new Error('Choisissez le type de panne ou de demande.');
    if (!p.commentaire) throw new Error('Décrivez votre demande dans le commentaire.');
    if (!p.nom) throw new Error('Indiquez vos nom et prénom.');
    if (!p.collectivite) throw new Error('Indiquez votre collectivité et votre service.');
    if (!p.telephone) throw new Error('Indiquez le numéro auquel l\'équipe support peut vous rappeler.');
    for (const k of Object.keys(L)) if (p[k].length > L[k]) throw new Error('Texte trop long (' + k + ' : ' + L[k] + ' caractères au plus).');
    const chiffres = p.telephone.replace(/\D/g, '');
    if (!/^[0-9+ .()-]+$/.test(p.telephone) || chiffres.length < 6 || chiffres.length > 15) throw new Error('Numéro de rappel invalide : chiffres, espaces, points ou tirets (6 à 15 chiffres).');
    if (p.courriel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.courriel)) throw new Error('Adresse électronique invalide.');
    if (!libelleDe(G.profils, p.profil)) throw new Error('Profil inconnu.');
    if (!libelleDe(G.creneaux, p.creneau)) throw new Error('Créneau de rappel inconnu.');
    if (!libelleDe(G.urgences, p.urgence)) throw new Error('Indiquez l\'urgence de la demande.');
    if (v.consentement !== true) throw new Error('Cochez la case d\'accord sur le traitement de vos coordonnées.');
    return p;
  };
  // Dépôt d'une demande au guichet, sans connexion. En ligne : fonction serveur (numéro et heure posés par le serveur).
  // En local : écriture directe de la demande (table tickets) et des notifications du support, sans passer par Regles (le visiteur n'a pas de compte) ;
  // les autres règles restent entières. Un agent connecté qui dépose au guichet reste le demandeur (comme garde() côté serveur).
  D.deposerDemandeGuichet = async function (v) {
    const p = D.validerGuichet(v);
    if (D.mode === 'supabase') {
      const r = await rpc('deposer_demande_guichet', { p: Object.assign({ consentement: true }, p) });
      return { id: r.id, numero: r.numero, date_depot: r.date_depot };
    }
    const G = D.GUICHET, maintenant = D.maintenant(), heure = Date.now() - 3600000;
    const recents = cache.tickets.filter(x => x.origine === 'guichet' && new Date(x.date_depot).getTime() > heure);
    const telCle = p.telephone.replace(/\D/g, '');
    if (recents.length >= G.plafonds.total || recents.filter(x => String((x.demandeur || {}).telephone || '').replace(/\D/g, '') === telCle).length >= G.plafonds.parTelephone
      || (p.courriel && recents.filter(x => (x.demandeur || {}).courriel === p.courriel).length >= G.plafonds.parCourriel))
      throw new Error('Trop de demandes déposées en peu de temps : réessayez dans une heure.');
    const an = new Date().getFullYear();
    const max = Math.max(0, ...cache.tickets.map(x => String(x.numero || '').match(new RegExp('^T-' + an + '-(\\d+)$'))).filter(Boolean).map(m => Number(m[1])));
    const numero = 'T-' + an + '-' + String(max + 1).padStart(4, '0');
    const criticite = G.urgences.find(x => x[0] === p.urgence)[2], typeLib = libelleDe(G.types, p.type_demande);
    const ligne = { __t: 'tickets', id: D.id(), numero, origine: 'guichet', type_demande: p.type_demande, type_libelle: typeLib, objet: typeLib, description: p.commentaire, criticite, urgence: p.urgence,
      demandeur_id: (D.utilisateur && D.utilisateur.id) || null, demandeur_nom: p.nom, service: p.collectivite, demandeur: { nom: p.nom, collectivite: p.collectivite, telephone: p.telephone, courriel: p.courriel, profil: p.profil },
      rappel: { creneau: p.creneau }, consentement: true, date_depot: maintenant, date_creation: maintenant, cree_le: maintenant, statut: 'nouveau', pieces_jointes: [], rappels: [],
      echeances: Calcul.echeancesSupport(criticite, maintenant),
      historique: [{ date: maintenant, auteur: p.nom + ' (guichet)', type: 'Dépôt au guichet', texte: 'Demande déposée au guichet (' + libelleDe(G.urgences, p.urgence) + '). Rappel souhaité : ' + libelleDe(G.creneaux, p.creneau).toLowerCase() + '.' }] };
    cache.tickets.push(ligne); await idbReq('lignes', 'readwrite', s => s.put(ligne, 'tickets|' + ligne.id));
    // Notification de l'équipe support (écrite ici : le visiteur ne peut pas passer par D.creer).
    const roles = new Set(cache.habilitations.filter(x => x.droit === 'support.traiter').map(x => x.role));
    for (const pr of cache.profils.filter(x => x.actif !== false && roles.has(x.role))) {
      const n = { __t: 'notifications', id: D.id(), destinataire_id: pr.id, texte: 'Nouvelle demande au guichet ' + numero + ' (' + criticite + ') : ' + typeLib, lien: '/support/' + ligne.id, lu: false, date: maintenant, emetteur_nom: 'Guichet', cree_le: maintenant };
      cache.notifications.push(n); await idbReq('lignes', 'readwrite', s => s.put(n, 'notifications|' + n.id));
    }
    await D.journal('Dépôt d\'une demande au guichet', 'tickets', ligne.id, numero + ' — ' + typeLib, { urgence: p.urgence, criticite });
    return { id: ligne.id, numero, date_depot: maintenant };
  };

  /* ---------- Journal (ajout seul : ni modification ni suppression) ---------- */
  D.journal = async function (action, objetType, objetId, libelle, detail, consultationId, resultat) {
    const u = D.utilisateur || {};
    const e = { action, objet_type: objetType || null, objet_id: objetId || null, objet_libelle: libelle || null, detail: detail || null,
      consultation_id: consultationId || null, resultat: resultat || 'réussi' };
    try {
      if (D.mode === 'supabase') {
        const { error } = await sb.rpc('journaliser', { p_action: e.action, p_objet_type: e.objet_type, p_objet_id: e.objet_id, p_objet_libelle: e.objet_libelle,
          p_detail: e.detail, p_consultation_id: e.consultation_id, p_resultat: e.resultat, p_origine: navigator.userAgent.slice(0, 120) });
        if (error) console.warn('journal', error.message);
      } else {
        const l = Object.assign({ __t: 'journal', id: D.id(), date: D.maintenant(), auteur_id: u.id || null, auteur_nom: u.nom || 'Non connecté', auteur_role: u.role || null,
          origine: 'navigateur' }, e);
        cache.journal.push(l); await idbReq('lignes', 'readwrite', s => s.put(l, 'journal|' + l.id));
      }
    } catch (err) { console.warn('journal', err); }
  };
  // En mode supabase, les échecs de connexion sont comptés et journalisés par le serveur (signaler_echec_connexion) : rien à écrire ici.
  D.journalAnonyme = (action, email) => D.mode === 'supabase' ? Promise.resolve() : D.journal(action, 'session', null, email, null, null, 'échec');

  /* ---------- Fichiers ---------- */
  // Compartiment de stockage : 'accueil' (public : photos des annonces, logo) ou 'pieces' (privé).
  const compartiment = chemin => /^(accueil|identite)(\/|$)/.test(String(chemin || '')) ? 'accueil' : 'pieces';
  D.deposer = async function (fichier, dossier) {
    dossier = dossier || 'divers';
    // Pièces jointes du support : rangées sous support/<identifiant du déposant>/ (condition des politiques de stockage).
    if (D.mode === 'supabase' && /^support(\/|$)/.test(dossier) && D.utilisateur) {
      const reste = dossier.split('/').slice(1).filter(Boolean); if (reste[0] !== D.utilisateur.id) reste.unshift(D.utilisateur.id);
      dossier = ['support'].concat(reste).join('/');
    }
    const chemin = dossier + '/' + D.id() + '-' + fichier.name.replace(/[^\w.\-]+/g, '_');
    if (D.mode === 'supabase') {
      const { error } = await sb.storage.from(compartiment(chemin)).upload(chemin, fichier, { contentType: fichier.type || 'application/octet-stream' });
      if (error) throw new Error(traduire(error));
    } else await idbReq('fichiers', 'readwrite', s => s.put(fichier, chemin));
    return chemin;
  };
  D.telecharger = async function (chemin) {
    if (D.mode === 'supabase') { const { data, error } = await sb.storage.from(compartiment(chemin)).download(chemin); if (error) throw new Error(traduire(error)); return data; }
    return idbReq('fichiers', 'readonly', s => s.get(chemin));
  };
  D.supprimerFichier = async function (chemin) {
    if (D.mode === 'supabase') { const { error } = await sb.storage.from(compartiment(chemin)).remove([chemin]); if (error) throw new Error(traduire(error)); }
    else await idbReq('fichiers', 'readwrite', s => s.delete(chemin));
  };
  // Adresse publique d'une image du compartiment 'accueil' (lisible sans connexion) ; null en mode local.
  D.urlPublique = chemin => D.mode === 'supabase' && chemin ? sb.storage.from('accueil').getPublicUrl(chemin).data.publicUrl : null;

  /* ---------- Administration des comptes ---------- */
  D.creerCompte = async function (compte) {
    D.exiger('admin.utilisateurs');
    const email = String(compte.email).trim().toLowerCase();
    let id;
    if (D.mode === 'supabase') {
      // Création par la fonction serveur creer_compte (contrôles et journal côté serveur).
      return rpc('creer_compte', { p_email: email, p_mdp: compte.mot_de_passe, p_nom: compte.nom, p_role: compte.role, p_service: compte.service || '' });
    } else {
      if (cache.comptes_locaux.some(c => c.email === email)) throw new Error('Un compte existe déjà avec cette adresse.');
      id = D.id();
      const c = { __t: 'comptes_locaux', id, email, mot_de_passe: compte.mot_de_passe }; cache.comptes_locaux.push(c); await hacherCompte(c);
      await idbReq('lignes', 'readwrite', s => s.put(c, 'comptes_locaux|' + id));
      await D.creer('profils', { id, email, nom: compte.nom, role: compte.role, service: compte.service || '', actif: true }, false);
    }
    await D.journal('Création d\'un compte', 'profils', id, compte.nom + ' (' + ROLES[compte.role] + ')');
    return id;
  };
  D.changerMotDePasse = async function (id, motDePasse) {
    D.exiger('admin.utilisateurs');
    if (D.mode === 'supabase') { await rpc('definir_mot_de_passe', { p_id: id, p_mdp: motDePasse }); return; } // journal écrit par le serveur
    else {
      const c = cache.comptes_locaux.find(x => x.id === id); c.mot_de_passe = motDePasse; delete c.empreinte; await hacherCompte(c);
      await idbReq('lignes', 'readwrite', s => s.put(c, 'comptes_locaux|' + id));
    }
    const p = await D.lire('profils', id);
    await D.journal('Réinitialisation du mot de passe', 'profils', id, p && p.nom);
  };

  /* ---------- Réinitialisation du mode local (démonstration) ---------- */
  D.reinitialiserLocal = async function () {
    if (D.mode !== 'local') throw new Error('Réinitialisation réservée au mode local : en ligne, la démonstration est remise à zéro chaque nuit.');
    await idbReq('lignes', 'readwrite', s => s.clear()); await idbReq('fichiers', 'readwrite', s => s.clear());
    sessionStorage.removeItem('acheteur-uid'); location.reload();
  };
  D._installerLocal = async function (table, lignes) { // utilisé par les données de démonstration
    for (const x of lignes) { const l = Object.assign({ __t: table, cree_le: D.maintenant() }, x); cache[table].push(l); }
    await idbReq('lignes', 'readwrite', s => { for (const l of cache[table]) s.put(l, table + '|' + l.id); });
  };
  // Restauration d'une sauvegarde (export complet) : remplace toutes les données ; les comptes et mots de passe locaux sont conservés.
  D._restaurerLocal = async (tables, fichiers) => {
    if (D.mode !== 'local') throw new Error('La restauration d\'une sauvegarde n\'est possible qu\'en mode local.');
    const comptes = cache.comptes_locaux.slice();
    await idbReq('lignes', 'readwrite', s => s.clear()); await idbReq('fichiers', 'readwrite', s => s.clear());
    for (const t of Object.keys(cache)) cache[t] = [];
    cache.comptes_locaux = comptes;
    await idbReq('lignes', 'readwrite', s => {
      for (const c of comptes) s.put(c, 'comptes_locaux|' + c.id);
      for (const t of Object.keys(tables)) for (const l of tables[t]) { const x = Object.assign({ __t: t }, l); (cache[t] || (cache[t] = [])).push(x); s.put(x, t + '|' + x.id); }
    });
    await idbReq('fichiers', 'readwrite', s => { for (const f of fichiers) s.put(f[1], f[0]); });
    if (D.utilisateur) await chargerProfil(D.utilisateur.id);
  };
  D._majLocal = async (table, id, patch) => { const l = cache[table].find(x => x.id === id); if (!l) return; Object.assign(l, patch); await idbReq('lignes', 'readwrite', s => s.put(l, table + '|' + id)); };
  D._fichierLocal = (chemin, blob) => idbReq('fichiers', 'readwrite', s => s.put(blob, chemin));

  function traduire(e) {
    const m = (e && (e.message || e.error_description)) || String(e), code = (e && e.code) || '';
    if (/REGLE:/.test(m)) return m.replace(/^.*?REGLE:\s*/, '');
    if (/row-level security|permission denied|not authorized/i.test(m) || code === '42501') return 'Action non autorisée pour votre profil.';
    if (/duplicate key/i.test(m) || code === '23505') return 'Cet élément existe déjà.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion au serveur impossible. Vérifiez votre accès Internet.';
    if (code === 'PGRST301' || code === 'PGRST303' || /JWT|refresh token|session.*(expired|not found|missing)/i.test(m)) {
      D.utilisateur = null; D.droits = new Set(); D.affectations = []; return 'Session expirée, reconnectez-vous.';
    }
    if (/banned/i.test(m)) return 'Compte verrouillé temporairement après plusieurs échecs de connexion.';
    if (/rate limit/i.test(m)) return 'Trop de demandes en peu de temps : patientez quelques instants avant de réessayer.';
    if (/exceeded the maximum|Payload too large|too large/i.test(m)) return 'Fichier trop volumineux pour être déposé.';
    if (code === 'PGRST116') return 'Élément introuvable.';
    if (code === 'PGRST202') return 'Fonction indisponible sur le serveur : la base de données n\'est pas à jour.';
    if (code === 'PGRST204' || code === 'PGRST200') return 'Donnée inconnue du serveur : la base de données n\'est pas à jour.';
    if (/^PGRST/.test(code)) return 'Requête refusée par le serveur (' + code + ').';
    return m;
  }

  /* ---------- Règles métier ---------- */
  const Regles = {
    async verifier(table, op, avant, apres) {
      const u = D.utilisateur;
      if (table === 'journal') { if (op !== 'creer') throw new Error('Le journal ne peut être ni modifié ni supprimé.'); return; }
      if (!u) throw new Error('Vous devez être connecté.');
      const l = apres || avant;
      if (table === 'notifications') { if (op !== 'creer' && avant.destinataire_id !== u.id) throw new Error('Cette notification ne vous est pas destinée.'); return; }
      if (table === 'tickets') {
        if (op === 'creer') { D.exiger('support.declarer'); return; }
        if (op === 'supprimer') throw new Error('Une demande d\'assistance ne peut pas être supprimée : elle reste dans l\'historique.');
        const demandeur = avant.demandeur_id === u.id;
        if (!demandeur && !D.peut('support.traiter') && !D.peut('admin.utilisateurs')) throw new Error('Seuls le demandeur, l\'administrateur et le support interviennent sur cette demande.');
        if (apres.statut === 'clos' && avant.statut !== 'clos' && !demandeur && !D.peut('admin.utilisateurs')) throw new Error('La clôture est validée par la collectivité (le demandeur ou l\'administrateur), pas par le support.');
        if (['pris_en_charge', 'en_cours', 'contourne', 'resolu'].includes(apres.statut) && avant.statut !== apres.statut && !D.peut('support.traiter')) throw new Error('Cette étape relève de l\'équipe support.');
        return;
      }
      if (l && l.consultation_id && l.lot_id && ['notes', 'offres', 'analyses', 'grilles', 'criteres', 'demandes', 'pieces', 'rapports'].includes(table) && !D.lotAutorise(l.consultation_id, l.lot_id))
        throw new Error('Ce lot ne vous est pas affecté : votre habilitation sur ce dossier est limitée à d\'autres lots.');
      // Grille verrouillée : critères et paramètres de notation figés
      if (table === 'criteres') {
        D.exiger('analyse.parametrer');
        const g = (await D.lister('grilles', { lot_id: l.lot_id }))[0];
        if (g && g.statut === 'verrouillee') throw new Error('La grille est verrouillée : les critères et les pondérations ne peuvent plus être modifiés.');
      }
      if (table === 'grilles' && op === 'modifier') {
        const changeStatut = avant.statut !== apres.statut;
        if (changeStatut) D.exiger('analyse.verrouiller');
        else { D.exiger('analyse.parametrer'); if (avant.statut === 'verrouillee') throw new Error('La grille est verrouillée : la méthode de notation ne peut plus être modifiée.'); }
      }
      if (table === 'grilles' && op === 'supprimer' && avant.statut === 'verrouillee') throw new Error('Une grille verrouillée ne peut pas être supprimée.');
      // Notes : saisie par l'analyste, validation par un autre utilisateur habilité
      if (table === 'notes') {
        if (op === 'supprimer') { if (avant.statut === 'validee') throw new Error('Une note validée ne peut pas être supprimée.'); if (avant.analyste_id !== u.id) throw new Error('Seul l\'auteur peut supprimer sa contribution.'); return; }
        const g = (await D.lister('grilles', { lot_id: l.lot_id }))[0];
        if (!g || g.statut !== 'verrouillee') throw new Error('La grille doit être verrouillée avant toute saisie de note.');
        const a = (await D.lister('analyses', { lot_id: l.lot_id }))[0];
        if (a && a.statut === 'validee') throw new Error('L\'analyse de ce lot est validée : les notes ne peuvent plus être modifiées.');
        const devientValidee = apres.statut === 'validee' && (!avant || avant.statut !== 'validee');
        const etaitValidee = avant && avant.statut === 'validee';
        const renvoi = avant && apres.statut === 'a_revoir' && avant.statut !== 'a_revoir';
        if (devientValidee || etaitValidee || renvoi) {
          D.exiger('analyse.valider');
          if (devientValidee && apres.analyste_id === u.id) throw new Error('Vous ne pouvez pas valider votre propre contribution : la validation revient à un autre utilisateur habilité.');
          if (devientValidee) {
            const c = await D.lire('criteres', apres.critere_id);
            if (apres.note === null || apres.note === '' || isNaN(Number(apres.note))) throw new Error('Une note chiffrée est nécessaire avant validation.');
            if (Number(apres.note) < 0 || Number(apres.note) > Number(c.bareme)) throw new Error('La note doit être comprise entre 0 et ' + c.bareme + '.');
            if (!String(apres.appreciation || '').trim() && !String(apres.extrait || '').trim()) throw new Error('Une note ne peut être validée sans justification (appréciation ou extrait de document).');
            const grilleLot = (await D.lister('grilles', { lot_id: apres.lot_id }))[0];
            const deja = grilleLot && grilleLot.consolidation === 'moyenne' ? [] : (await D.lister('notes', { offre_id: apres.offre_id, critere_id: apres.critere_id, statut: 'validee' })).filter(n => n.id !== apres.id);
            if (deja.length) throw new Error('Une autre contribution est déjà validée pour ce critère : rouvrez-la avant d\'en valider une autre.');
          }
          if (etaitValidee && apres.statut === 'validee') {
            const fige = ['note', 'appreciation', 'points_forts', 'points_faibles', 'reserves', 'extrait', 'piece_id', 'page'];
            if (fige.some(k => JSON.stringify(avant[k]) !== JSON.stringify(apres[k]))) throw new Error('Une note validée ne peut pas être modifiée : elle doit d\'abord être rouverte par un valideur.');
          }
        } else {
          D.exiger('analyse.saisir');
          if (avant && avant.analyste_id !== u.id) throw new Error('Seul l\'auteur peut modifier sa contribution.');
          if (!avant && apres.analyste_id !== u.id) throw new Error('Une contribution est toujours saisie en son nom propre.');
        }
      }
      if ((table === 'offres' && op !== 'modifier') || table === 'lignes_prix') D.exiger('analyse.saisir');
      if (table === 'grilles' && op === 'creer') D.exiger('analyse.parametrer');
      if (table === 'grille_versions') { if (op !== 'creer') throw new Error('L\'historique des versions ne peut pas être modifié.'); D.exiger('analyse.verrouiller'); }
      if (table === 'analyses' && op === 'creer') D.exiger('analyse.saisir');
      if (['notes_historique', 'documents_versions', 'validations', 'calculs'].includes(table) && op !== 'creer') throw new Error('Les historiques ne peuvent pas être modifiés.');
      if (table === 'demandes' && !(D.peut('analyse.saisir') || D.peut('analyse.valider'))) D.exiger('analyse.saisir');
      // Négociation : refusée lorsque la procédure ne la permet pas (appel d'offres)
      if (table === 'demandes' && apres && apres.type === 'negociation' && (op === 'creer' || (avant && avant.type !== 'negociation'))) {
        const cons = await D.lire('consultations', apres.consultation_id);
        if (cons && Calcul.negociationAutorisee(cons.procedure).autorisee === false) throw new Error('Négociation impossible : ' + Calcul.negociationAutorisee(cons.procedure).motif);
      }
      // Offres : validation du montant, décisions sur la candidature et sur l'offre réservées aux valideurs
      if (table === 'offres' && op === 'modifier') {
        const decisions = ['montant_valide', 'candidature_statut', 'ecartee'];
        const touche = decisions.filter(k => JSON.stringify(avant[k]) !== JSON.stringify(apres[k]));
        if (touche.some(k => k !== 'candidature_statut' || ['admise', 'non_admise'].includes(apres.candidature_statut) || ['admise', 'non_admise'].includes(avant.candidature_statut))) D.exiger('analyse.valider');
        if (avant.montant_valide && apres.montant_valide && Number(avant.montant_ht) !== Number(apres.montant_ht)) throw new Error('Le montant est validé : il doit être rouvert par un valideur avant correction.');
        if (apres.ecartee && !String(apres.ecartee_motif || '').trim()) throw new Error('Une décision d\'écarter une offre doit être motivée.');
        if (apres.candidature_statut === 'non_admise' && !String(apres.candidature_motif || '').trim()) throw new Error('Une décision de non-admission doit être motivée.');
      }
      if (table === 'analyses' && op === 'modifier' && avant.statut !== apres.statut) {
        if (apres.statut === 'validee' || avant.statut === 'validee' || (avant.statut === 'en_relecture' && apres.statut === 'en_cours')) D.exiger('analyse.valider');
        else D.exiger('analyse.saisir');
      }
      if (table === 'rapports') {
        if (op !== 'creer' && avant.statut === 'valide') throw new Error('Un rapport validé est figé : créez une nouvelle version pour le modifier.');
        if (apres && apres.statut === 'valide') D.exiger('rapport.valider'); else D.exiger('rapport.rediger');
      }
      if (table === 'documents_dce' && op === 'modifier') {
        if (avant.statut === 'publie' && apres.contenu !== avant.contenu) throw new Error('Un document publié ne peut plus être modifié : créez une nouvelle version.');
        if (avant.statut !== apres.statut) {
          const circuit = await D.circuitDce(); const ids = circuit.map(e => e.id);
          const i = ids.indexOf(avant.statut);
          if (avant.statut === 'redaction') { D.exiger('dce.rediger'); if (apres.statut !== ids[0]) throw new Error('Un document en rédaction est soumis à la première étape du circuit.'); }
          else if (i >= 0) { D.exiger(circuit[i].droit); if (![ids[i + 1] || 'valide', 'redaction'].includes(apres.statut)) throw new Error('Cette transition ne respecte pas le circuit de validation.'); }
          else if (avant.statut === 'valide' && apres.statut === 'publie') D.exiger('dce.publier');
          else if (['valide', 'publie'].includes(avant.statut) && apres.statut === 'redaction') D.exiger('dce.rediger');
          else throw new Error('Cette transition ne respecte pas le circuit de validation.');
        } else if (apres.contenu !== avant.contenu) { D.exiger('dce.rediger'); if (avant.statut !== 'redaction') throw new Error('Le document est en cours de validation : il doit revenir en rédaction pour être modifié.'); }
      }
      const droitTable = { besoins: 'besoins.ecrire', consultations: 'consultations.ecrire', lots: 'consultations.ecrire', affectations: 'consultations.ecrire',
        marches: 'execution.ecrire', evenements: 'execution.ecrire', fournisseurs: 'fournisseurs.ecrire', fournisseur_suivi: 'fournisseurs.ecrire',
        modeles_document: 'modeles.ecrire', modeles_grille: 'modeles.ecrire', habilitations: 'admin.utilisateurs', parametres: 'admin.parametres',
        profils: 'admin.utilisateurs', reprises: 'reprise.importer', pieces_attendues: 'consultations.ecrire', annonces: 'accueil.ecrire', factures: 'execution.ecrire' }[table];
      if (droitTable && !(table === 'besoins' && D.peut('besoins.valider'))) D.exiger(droitTable);
      if (table === 'evaluations') {
        if (avant && avant.statut === 'validee') throw new Error('Une évaluation validée est figée.');
        if (apres && apres.statut === 'validee') D.exiger('evaluations.valider'); else D.exiger('evaluations.ecrire');
        if (apres && apres.statut === 'validee' && !String(apres.faits || '').trim()) throw new Error('Une évaluation doit être rattachée à des faits vérifiables avant validation.');
      }
      if (table === 'profils' && op === 'modifier' && avant.id === u.id && (apres.role !== avant.role || apres.actif === false)) throw new Error('Vous ne pouvez pas modifier votre propre profil ni désactiver votre propre compte.');
    }
  };
  D.Regles = Regles;
  window.D = D;
})();
