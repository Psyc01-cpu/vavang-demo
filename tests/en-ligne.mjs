// Batterie de tests de sécurité CÔTÉ SERVEUR contre la vraie base Supabase de la démonstration publique.
// Chaque test interroge directement le serveur (supabase-js créé dans la page, sans passer par l'interface) :
// ce qui est vérifié ici tient même si l'interface est contournée.
//   node tests/en-ligne.mjs                                   (cible : démo publique GitHub Pages)
//   node tests/en-ligne.mjs http://vavang.localhost:4173/      (serveur local, mode supabase, même base)
// Sorties : mesures/en-ligne.json, captures/70-*.png et suivantes.
// Remarques : la base est partagée avec les visiteurs et remise à zéro chaque nuit (23 h UTC) ; les comptes jetables
// créés ici (@exemple-test.invalid) sont désactivés à la fin et supprimés par la remise à zéro.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CIBLE = process.argv[2] || 'https://psyc01-cpu.github.io/vavang-demo/';
const LOCAL = /\.localhost\b/.test(CIBLE);
const CAPTURES = path.join(racine, 'captures'), SORTIE = path.join(racine, 'mesures', 'en-ligne.json');
const MDP = 'Demonstration-2026';
const ID = { admin: '00000000-0000-4000-a000-000000000001', gestionnaire: '00000000-0000-4000-a000-000000000002', prescripteur: '00000000-0000-4000-a000-000000000003',
  valideur: '00000000-0000-4000-a000-000000000004', lecteur: '00000000-0000-4000-a000-000000000005', support: '00000000-0000-4000-a000-000000000006' };
const pause = ms => new Promise(r => setTimeout(r, ms));

// TOTP indépendant de l'application (RFC 6238) : joue le rôle du téléphone de l'administrateur.
const deBase32 = s => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { v = (v << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret, pas) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(pas)); const hm = crypto.createHmac('sha1', deBase32(secret)).update(b).digest(); const o = hm[19] & 15; return String((hm.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0'); };
let dernierPas = 0;
// Code jamais réutilisé : on attend une nouvelle fenêtre de 30 s si le code courant a déjà servi (ou expire dans moins de 4 s).
async function codeFrais(secret) {
  for (;;) { const t = Date.now(), pas = Math.floor(t / 30000), reste = 30000 - (t % 30000);
    if (pas > dernierPas && reste > 4000) { dernierPas = pas; return totp(secret, pas); }
    await pause(Math.min(reste + 300, 30000)); }
}

/* ---------- Résultats ---------- */
const resultats = []; let enCours = '';
const section = t => { enCours = t; console.log('\n== ' + t); };
// statut : 'conforme' | 'NON CONFORME' | 'limite' | 'non vérifié'
function noter(test, attendu, obtenu, conforme, statutForce) {
  const statut = statutForce || (conforme ? 'conforme' : 'NON CONFORME');
  resultats.push({ section: enCours, test, attendu, obtenu: typeof obtenu === 'string' ? obtenu : JSON.stringify(obtenu), statut });
  console.log((statut === 'conforme' ? '  ✓ ' : statut === 'NON CONFORME' ? '  ✗ ' : '  ~ ') + test + ' — obtenu : ' + (typeof obtenu === 'string' ? obtenu : JSON.stringify(obtenu)).slice(0, 220));
}
const refuse = r => !!(r && (r.erreur || (typeof r.n === 'number' && r.n === 0)));

/* ---------- Navigateur ---------- */
let serveur = null;
if (LOCAL) { const { demarrer } = await import('./serveur.mjs'); serveur = await demarrer(Number(new URL(CIBLE).port) || 4173); }
const args = ['--lang=fr-FR'].concat(LOCAL ? ['--host-resolver-rules=MAP ' + new URL(CIBLE).hostname + ' 127.0.0.1'] : []);
const navigateur = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args });
const erreursJS = [];
async function ouvrir(ctx) {
  const p = await (ctx || navigateur).newPage(); await p.setViewport({ width: 1440, height: 960 });
  p.on('pageerror', e => erreursJS.push('pageerror: ' + e.message));
  await p.goto(CIBLE, { waitUntil: 'networkidle0', timeout: 60000 });
  await p.waitForFunction(() => window.D && window.supabase && window.CONFIG, { timeout: 30000 });
  // Outils de test injectés dans la page (évaluation CDP : non soumise à la CSP de la page, qui reste intacte).
  await p.evaluate(() => {
    window.__C = {};
    window.__client = nom => (window.__C[nom] = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseCle,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'test-' + nom } }));
    const err = e => ({ erreur: e.message || String(e), code: e.code || e.status || null });
    window.__connecter = async (nom, email, mdp) => { const c = window.__client(nom); const r = await c.auth.signInWithPassword({ email, password: mdp }); return r.error ? err(r.error) : { ok: true, uid: r.data.user.id }; };
    window.__aal = async nom => { const { data, error } = await window.__C[nom].auth.mfa.getAuthenticatorAssuranceLevel(); return error ? err(error) : data; };
    window.__verifier = async (nom, code) => { const c = window.__C[nom]; const { data: l, error: e1 } = await c.auth.mfa.listFactors(); if (e1) return err(e1);
      const f = (l.totp || []).find(x => x.status === 'verified'); if (!f) return { erreur: 'aucun facteur vérifié' };
      const { error } = await c.auth.mfa.challengeAndVerify({ factorId: f.id, code }); return error ? err(error) : { ok: true }; };
    window.__rpc = async (nom, fn, params) => { const { data, error } = await window.__C[nom].rpc(fn, params || {}); return error ? err(error) : { data }; };
    window.__lire = async (nom, table, cols, eq) => { let q = window.__C[nom].from(table).select(cols || 'id'); if (eq) for (const k in eq) q = q.eq(k, eq[k]);
      const { data, error } = await q.limit(5000); return error ? err(error) : { n: data.length, lignes: data }; };
    window.__ecrire = async (nom, op, table, valeur, id) => { const t = window.__C[nom].from(table); let q;
      if (op === 'insert') q = t.insert(valeur).select('id'); else if (op === 'update') q = t.update(valeur).eq('id', id).select('id'); else q = t.delete().eq('id', id).select('id');
      const { data, error } = await q; return error ? err(error) : { n: (data || []).length }; };
    window.__telecharger = async (nom, chemin) => { const { data, error } = await window.__C[nom].storage.from('pieces').download(chemin); return error ? err(error) : { ok: true, octets: data.size }; };
    window.__liste = async (nom, dossier) => { const { data, error } = await window.__C[nom].storage.from('pieces').list(dossier || '', { limit: 1000 }); return error ? err(error) : { n: data.length, noms: data.map(x => x.name) }; };
    window.__deposer = async (nom, chemin, texte, type) => { const { error } = await window.__C[nom].storage.from('pieces').upload(chemin, new Blob([texte], { type }), { contentType: type, upsert: false }); return error ? err(error) : { ok: true }; };
    window.__deconnecter = async nom => { try { await window.__C[nom].auth.signOut({ scope: 'local' }); } catch (e) { /* sans effet */ } };
  });
  return p;
}
const capture = async (p, nom) => { await pause(600); await p.screenshot({ path: path.join(CAPTURES, nom + '.png'), fullPage: false }); console.log('  [capture] ' + nom + '.png'); };
const attendreCalme = p => p.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {});
const aller = async (p, chemin) => { await p.evaluate(c => { sessionStorage.setItem('mfa-plus-tard', '1'); U.aller(c); }, chemin); await attendreCalme(p); await pause(500); };
async function connexionUI(p, email, mdp, code) {
  await p.evaluate((e, m, c) => { const f = Array.from(document.querySelectorAll('form.formulaire')).find(x => x.querySelector('input[name=email]'));
    if (e !== null) { f.querySelector('input[name=email]').value = e; f.querySelector('input[name=mdp]').value = m; }
    if (c) f.querySelector('input[name=code]').value = c; f.requestSubmit(); }, email, mdp, code || '');
  await attendreCalme(p); await pause(800);
}

const debut = new Date();
const p = await ouvrir();
const mode = await p.evaluate(() => D.mode);
console.log('Cible : ' + CIBLE + ' | mode : ' + mode + ' | organisme : ' + await p.evaluate(() => CONFIG.organisme));
if (mode !== 'supabase') throw new Error('La page n\'est pas en mode supabase : tests sans objet.');
const secretAdmin = await p.evaluate(() => CONFIG.demoMfaSecret);
const L = (fn, ...a) => p.evaluate(fn, ...a);
const ts = Date.now().toString(36);
const jetables = []; // { id, email } à désactiver en fin de batterie

try {
  /* =========================== 1. HTTPS =========================== */
  section('1. HTTPS et en-têtes');
  if (LOCAL) noter('Page servie en HTTPS', 'https', 'cible locale (http://' + new URL(CIBLE).host + ') : test sans objet ici, à jouer sur la démo publique', true, 'non vérifié');
  else {
    const r = await fetch(CIBLE); const html = await r.text();
    noter('Page servie en HTTPS', 'protocole https, statut 200', new URL(r.url).protocol + ' ' + r.status, new URL(r.url).protocol === 'https:' && r.status === 200);
    const rh = await fetch(CIBLE.replace(/^https:/, 'http:'), { redirect: 'manual' });
    const loc = rh.headers.get('location') || '';
    noter('http:// redirige vers https://', 'redirection 301/308 vers https', rh.status + ' → ' + loc, [301, 302, 307, 308].includes(rh.status) && loc.startsWith('https://'));
    const hsts = r.headers.get('strict-transport-security');
    noter('En-tête HSTS', 'Strict-Transport-Security présent', hsts || 'absent', !!hsts);
    const csp = (html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/i) || [])[1] || '';
    const scriptSrc = (csp.match(/script-src([^;]*)/) || [])[1] || '';
    noter('CSP (balise meta)', 'default-src \'self\', script-src sans \'unsafe-inline\' ni \'unsafe-eval\', object-src \'none\', connect-src limité au projet Supabase',
      csp ? csp.slice(0, 160) + '…' : 'absente',
      /default-src 'self'/.test(csp) && /script-src/.test(csp) && !/unsafe-(inline|eval)/.test(scriptSrc) && /object-src 'none'/.test(csp) && /connect-src[^;]*talremuridyehynsnfzv\.supabase\.co/.test(csp) && !/connect-src[^;]*\*/.test(csp));
    // Protection contre l'inclusion dans un cadre : frame-ancestors est ignoré en meta, GitHub Pages n'envoie pas X-Frame-Options.
    const xfo = r.headers.get('x-frame-options');
    noter('Anti-inclusion en cadre (clickjacking)', 'X-Frame-Options ou CSP frame-ancestors en en-tête HTTP', xfo ? 'X-Frame-Options : ' + xfo : 'absent (GitHub Pages ne permet pas d\'en-têtes personnalisés ; frame-ancestors est sans effet en meta)', !!xfo, xfo ? null : 'limite');
    const rs = await fetch('http://talremuridyehynsnfzv.supabase.co/rest/v1/', { redirect: 'manual' }).catch(e => ({ status: 'refus réseau : ' + e.message, headers: new Map() }));
    const ls = rs.headers && rs.headers.get ? rs.headers.get('location') || '' : '';
    noter('API Supabase en http://', 'redirection vers https ou refus', rs.status + (ls ? ' → ' + ls : ''), typeof rs.status !== 'number' || ([301, 302, 307, 308].includes(rs.status) && ls.startsWith('https://')) || rs.status >= 400);
  }

  /* =========================== 4. Double authentification (avant le reste : le client admin aal2 sert de référence) =========================== */
  section('4. Double authentification de l\'administrateur');
  let r, r2;
  r = await L(() => __connecter('admin', 'admin@demo.example', 'Demonstration-2026'));
  noter('Mot de passe admin accepté (1er facteur)', 'session ouverte en aal1', r.ok ? 'session ouverte' : r.erreur, !!r.ok);
  let aal = await L(() => __aal('admin'));
  noter('Niveau de session après mot de passe seul', 'currentLevel aal1, nextLevel aal2', aal.currentLevel + ' → ' + aal.nextLevel, aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2');
  r = await L(() => __rpc('admin', 'moi'));
  noter('moi() en aal1', 'nul', r.erreur ? 'erreur : ' + r.erreur : String(r.data), !r.erreur && r.data === null);
  r = await L(() => __lire('admin', 'consultations'));
  noter('Lecture des consultations en aal1', '0 ligne', r.erreur ? 'erreur : ' + r.erreur : r.n + ' ligne(s)', refuse(r));
  r = await L(() => __lire('admin', 'profils'));
  noter('Lecture des profils en aal1', '0 ligne', r.erreur ? 'erreur : ' + r.erreur : r.n + ' ligne(s)', refuse(r));
  r = await L(() => __rpc('admin', 'etat_securite_comptes'));
  noter('Fonction d\'administration (etat_securite_comptes) en aal1', 'refusée', r.erreur ? 'refusée : ' + r.erreur : 'acceptée (' + (r.data || []).length + ' lignes)', !!r.erreur);
  r = await L(() => __rpc('admin', 'mon_profil'));
  noter('mon_profil() en aal1 (seule lecture permise)', 'profil renvoyé avec mfa_requis = true, aal1', r.erreur ? r.erreur : { role: r.data && r.data.role, mfa_requis: r.data && r.data.mfa_requis, aal: r.data && r.data.aal }, !r.erreur && r.data && r.data.mfa_requis === true && r.data.aal === 'aal1');
  r = await L(c => __verifier('admin', c), '000000');
  noter('Code TOTP faux', 'refusé', r.ok ? 'accepté' : 'refusé : ' + r.erreur, !r.ok);
  r = await L(c => __verifier('admin', c), await codeFrais(secretAdmin));
  noter('Code TOTP exact', 'accepté', r.ok ? 'accepté' : r.erreur, !!r.ok);
  aal = await L(() => __aal('admin'));
  noter('Niveau de session après le code', 'aal2', aal.currentLevel, aal.currentLevel === 'aal2');
  r = await L(() => __rpc('admin', 'moi'));
  noter('moi() en aal2', 'profil administrateur', r.erreur ? r.erreur : (r.data && r.data.role), !r.erreur && r.data && r.data.role === 'administrateur');
  const toutesConsult = await L(() => __lire('admin', 'consultations', 'id,cree_par,d'));
  noter('Lecture des consultations en aal2', 'toutes (≥ 2 : c1, c2)', toutesConsult.erreur || toutesConsult.n + ' ligne(s)', !toutesConsult.erreur && toutesConsult.n >= 2);

  /* =========================== 2. Cloisonnement (RLS) =========================== */
  section('2. Cloisonnement par les règles d\'accès du serveur');
  // Vérité de référence lue par l'administrateur (aal2).
  const ref = {};
  for (const t of ['offres', 'notes', 'pieces', 'lots', 'lignes_prix', 'affectations']) ref[t] = (await L(t => __lire('admin', t, 'id,d->>consultation_id'), t)).lignes || [];
  const affect = ref.affectations.map(a => a.consultation_id);
  const affectations = (await L(() => __lire('admin', 'affectations', 'id,d'))).lignes || [];
  const consultations = toutesConsult.lignes || [];
  const habil = (await L(() => __lire('admin', 'habilitations', 'id,d'))).lignes || [];
  const profils = (await L(() => __lire('admin', 'profils', 'id,d'))).lignes || [];
  const aDroit = (role, droit) => habil.some(h => h.d.role === role && h.d.droit === droit);
  const attenduVisible = qui => { const pr = profils.find(x => x.id === ID[qui]); const role = pr.d.role, service = pr.d.service;
    return new Set(consultations.filter(c => aDroit(role, 'consultations.toutes') || c.d.cree_par === ID[qui] || c.cree_par === ID[qui]
      || (aDroit(role, 'consultations.service') && c.d.service === service) || affectations.some(a => a.d.consultation_id === c.id && a.d.profil_id === ID[qui])).map(c => c.id)); };
  const memes = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

  // Fichiers de démonstration du compartiment « pieces » : téléversés par le gestionnaire s'ils manquent.
  r = await L(() => __connecter('gestionnaire', 'gestionnaire@demo.example', 'Demonstration-2026'));
  if (!r.ok) throw new Error('Connexion gestionnaire impossible : ' + r.erreur);
  const liste = JSON.parse(fs.readFileSync(path.join(racine, 'supabase', 'seed', 'fichiers', 'liste.json'), 'utf8'));
  let deposes = 0, presents = 0, echecsDepot = [];
  for (const f of liste) {
    const t = await L(c => __telecharger('gestionnaire', c), f.chemin);
    if (t.ok) { presents++; continue; }
    const texte = fs.readFileSync(path.join(racine, 'supabase', 'seed', 'fichiers', f.chemin), 'utf8');
    const d = await L((c, x, ty) => __deposer('gestionnaire', c, x, ty), f.chemin, texte, f.type);
    if (d.ok) deposes++; else echecsDepot.push(f.chemin + ' : ' + d.erreur);
  }
  noter('Fichiers de démonstration présents dans « pieces » (préparation)', liste.length + ' fichiers', presents + ' déjà présents, ' + deposes + ' téléversés par le gestionnaire' + (echecsDepot.length ? ', échecs : ' + echecsDepot.join(' ; ') : ''), presents + deposes === liste.length);
  const FICHIER = 'c1/demo-o1-0.txt';

  for (const qui of ['support', 'prescripteur', 'lecteur']) {
    r = await L((n, e) => __connecter(n, e, 'Demonstration-2026'), qui, qui + '@demo.example');
    if (!r.ok) { noter('Connexion ' + qui, 'ouverte', r.erreur, false); continue; }
    const vu = await L(n => __lire(n, 'consultations'), qui);
    const attendu = attenduVisible(qui);
    const obtenu = new Set((vu.lignes || []).map(x => x.id));
    const lib = qui === 'support' ? 'aucune' : qui === 'prescripteur' ? 'celles de son service, créées par lui ou affectées' : 'seulement celle(s) affectée(s)';
    noter(qui + ' : consultations lisibles', lib + ' → [' + [...attendu].join(', ') + ']', vu.erreur ? 'erreur : ' + vu.erreur : '[' + [...obtenu].join(', ') + ']', !vu.erreur && memes(attendu, obtenu) && (qui !== 'support' || obtenu.size === 0));
    for (const t of ['offres', 'notes', 'pieces', 'lignes_prix']) {
      const v = await L((n, t) => __lire(n, t, 'id,d->>consultation_id'), qui, t);
      const att = ref[t].filter(x => x.consultation_id && attendu.has(x.consultation_id));
      const horsDossier = (v.lignes || []).filter(x => x.consultation_id && !attendu.has(x.consultation_id));
      const sansDossier = (v.lignes || []).filter(x => !x.consultation_id);
      noter(qui + ' : ' + t + ' lisibles', att.length + ' (celles des dossiers visibles), aucune d\'un autre dossier',
        v.erreur ? 'erreur : ' + v.erreur : v.n + ' ligne(s), dont ' + horsDossier.length + ' hors dossier et ' + sansDossier.length + ' sans dossier',
        !v.erreur && horsDossier.length === 0 && v.n - sansDossier.length === att.length && (qui !== 'support' || v.n === 0));
    }
    const tf = await L((n, c) => __telecharger(n, c), qui, FICHIER);
    const doitLire = attendu.has('c1');
    noter(qui + ' : téléchargement direct de ' + FICHIER, doitLire ? 'autorisé (dossier visible)' : 'refusé', tf.ok ? 'autorisé (' + tf.octets + ' octets)' : 'refusé : ' + tf.erreur, doitLire ? !!tf.ok : !tf.ok);
    const lf = await L(n => __liste(n, 'c1'), qui);
    noter(qui + ' : liste du dossier c1 du compartiment', doitLire ? 'fichiers listés' : '0 fichier', lf.erreur ? 'erreur : ' + lf.erreur : lf.n + ' fichier(s)', doitLire ? lf.n > 0 : refuse(lf));
  }
  // Dépôt dans le dossier d'une consultation non visible (le prescripteur a le droit d'écrire des pièces, mais ne voit pas c2).
  const cheminIntrus = 'c2/test-depot-intrus-' + ts + '.txt';
  r = await L(c => __deposer('prescripteur', c, 'depot de test', 'text/plain'), cheminIntrus);
  noter('prescripteur : dépôt d\'un fichier dans le dossier c2 (consultation qu\'il ne voit pas)','refusé', r.ok ? 'ACCEPTÉ' : 'refusé : ' + r.erreur, !r.ok);
  if (r.ok) { const s = await L(async c => { const { error } = await __C.admin.storage.from('pieces').remove([c]); return error ? error.message : 'supprimé'; }, cheminIntrus); console.log('  nettoyage ' + cheminIntrus + ' : ' + s); }
  // Support : données sans dossier de consultation (marchés, factures, fournisseurs, évaluations) — règle « voit_dossier(null) ».
  for (const t of ['marches', 'factures', 'fournisseurs', 'evaluations', 'evenements']) {
    const v = await L(t => __lire('support', t), t); const tot = await L(t => __lire('admin', t), t);
    noter('support : ' + t + ' (données sans dossier de consultation)', '0 ligne (le support éditeur n\'a aucun droit métier)', v.erreur ? 'erreur : ' + v.erreur : v.n + ' ligne(s) sur ' + tot.n, refuse(v) || tot.n === 0 && v.n === 0);
  }
  const racinePieces = await L(() => __liste('support', ''));
  noter('support : liste de la racine du compartiment « pieces »', 'aucun dossier de consultation ni de marché', racinePieces.erreur ? 'erreur : ' + racinePieces.erreur : '[' + racinePieces.noms.join(', ') + ']', refuse(racinePieces) || racinePieces.noms.every(x => x === 'support'));

  // Anonyme (aucune connexion)
  await L(() => __client('anon'));
  const TABLES = ['profils', 'habilitations', 'parametres', 'journal', 'besoins', 'consultations', 'affectations', 'lots', 'grilles', 'criteres', 'grille_versions', 'modeles_grille', 'pieces_attendues',
    'offres', 'pieces', 'annotations', 'lignes_prix', 'notes', 'notes_historique', 'demandes', 'analyses', 'rapports', 'modeles_document', 'documents_dce', 'documents_versions', 'validations', 'marches',
    'evenements', 'fournisseurs', 'fournisseur_suivi', 'evaluations', 'reprises', 'annonces', 'notifications', 'tickets', 'factures', 'calculs', 'trace_technique', 'verrous_connexion', 'demo_seed', 'demo_meta'];
  const fuites = [];
  let annoncesOk = null, parametresOk = null;
  for (const t of TABLES) {
    const v = await L(t => __lire('anon', t, t === 'annonces' ? 'id,d->actif' : t === 'trace_technique' || t === 'verrous_connexion' || t === 'demo_seed' || t === 'demo_meta' ? '*' : 'id'), t);
    if (v.erreur || v.n === 0) continue;
    if (t === 'annonces') { annoncesOk = v.lignes.every(x => x.actif === true); if (!annoncesOk) fuites.push('annonces inactives'); continue; }
    if (t === 'parametres') { parametresOk = v.lignes.every(x => x.id === 'identite'); if (!parametresOk) fuites.push('parametres : ' + v.lignes.map(x => x.id).join(',')); continue; }
    fuites.push(t + ' (' + v.n + ')');
  }
  noter('anonyme : lecture des ' + TABLES.length + ' tables', 'rien, sauf annonces actives et paramètre « identite »', fuites.length ? 'fuites : ' + fuites.join(' ; ') : 'aucune fuite (annonces actives : ' + (annoncesOk === null ? 'aucune' : 'oui') + ', parametres : ' + (parametresOk === null ? 'aucun' : 'identite seul') + ')', fuites.length === 0);
  r = await L(c => __telecharger('anon', c), FICHIER);
  noter('anonyme : téléchargement de ' + FICHIER, 'refusé', r.ok ? 'autorisé' : 'refusé : ' + r.erreur, !r.ok);
  const fonctionsAnon = {};
  for (const [fn, prm] of [['moi', {}], ['mon_profil', {}], ['creer_compte', { p_email: 'x@exemple-test.invalid', p_mdp: 'xxxxxxxxxxxxxxx', p_nom: 'x', p_role: 'lecteur' }], ['revoquer_sessions', { p_id: ID.admin }],
    ['etat_securite_comptes', {}], ['deverrouiller_compte', { p_id: ID.admin }], ['mes_evenements_securite', {}], ['reinitialiser_demo', {}]]) {
    const v = await L((fn, prm) => __rpc('anon', fn, prm), fn, prm); fonctionsAnon[fn] = v.erreur ? 'refusée' : 'ACCEPTÉE';
  }
  noter('anonyme : appel des fonctions serveur sensibles', 'toutes refusées', fonctionsAnon, Object.values(fonctionsAnon).every(x => x === 'refusée'));

  /* =========================== 3. Écritures interdites =========================== */
  section('3. Écritures interdites par le serveur (interface contournée)');
  const o1 = (await L(() => __lire('admin', 'offres', 'id,d', { id: 'o1' }))).lignes[0];
  r = await L(id => __ecrire('lecteur', 'insert', 'consultations', { id, d: { reference: 'TEST-INTRUSION', objet: 'Insertion directe par le lecteur', service: 'Contrôle de gestion' } }), 'test-intrus-' + ts);
  noter('lecteur : insertion directe d\'une consultation', 'refusée', r.erreur ? 'refusée : ' + r.erreur : r.n + ' ligne insérée', !!r.erreur);
  if (!r.erreur && r.n) await L(id => __ecrire('admin', 'delete', 'consultations', null, id), 'test-intrus-' + ts);
  if (o1) {
    const d2 = Object.assign({}, o1.d, { montant_ht: (Number(o1.d.montant_ht) || 0) + 1 });
    r = await L(d => __ecrire('lecteur', 'update', 'offres', { d }, 'o1'), d2);
    const apres = (await L(() => __lire('admin', 'offres', 'id,d', { id: 'o1' }))).lignes[0];
    noter('lecteur : modification directe du montant de l\'offre o1', '0 ligne modifiée, montant inchangé', (r.erreur ? 'erreur : ' + r.erreur : r.n + ' ligne(s) modifiée(s)') + ', montant ' + apres.d.montant_ht, refuse(r) && apres.d.montant_ht === o1.d.montant_ht);
    if (apres.d.montant_ht !== o1.d.montant_ht) await L(d => __ecrire('admin', 'update', 'offres', { d }, 'o1'), o1.d);
    r = await L(() => __ecrire('lecteur', 'delete', 'offres', null, 'o1'));
    const encore = (await L(() => __lire('admin', 'offres', 'id', { id: 'o1' }))).n;
    noter('lecteur : suppression directe de l\'offre o1', '0 ligne supprimée', (r.erreur ? 'erreur : ' + r.erreur : r.n + ' ligne(s) supprimée(s)') + ', o1 ' + (encore ? 'toujours présente' : 'DISPARUE'), refuse(r) && encore === 1);
  } else noter('lecteur : modification de l\'offre o1', 'refusée', 'offre o1 absente de la base (jeu modifié ?)', false, 'non vérifié');
  const profG = profils.find(x => x.id === ID.gestionnaire);
  r = await L((d, id) => __ecrire('gestionnaire', 'update', 'profils', { d }, id), Object.assign({}, profG.d, { role: 'administrateur' }), ID.gestionnaire);
  const roleG = (await L(() => __lire('admin', 'profils', 'id,d->>role', { id: '00000000-0000-4000-a000-000000000002' }))).lignes[0];
  noter('gestionnaire : se donner le profil administrateur (update direct de son profil)', 'refusé, profil inchangé', (r.erreur ? 'refusé : ' + r.erreur : r.n + ' ligne(s) modifiée(s)') + ', profil = ' + (roleG && roleG.role), refuse(r) && roleG && roleG.role === 'gestionnaire');
  r = await L(() => __ecrire('lecteur', 'insert', 'habilitations', { id: 'lecteur|admin.utilisateurs', d: { role: 'lecteur', droit: 'admin.utilisateurs' } }));
  noter('lecteur : s\'accorder une habilitation (insert direct)', 'refusé', r.erreur ? 'refusé : ' + r.erreur : r.n + ' ligne insérée', !!r.erreur);
  if (!r.erreur && r.n) await L(() => __ecrire('admin', 'delete', 'habilitations', null, 'lecteur|admin.utilisateurs'));
  const fnLecteur = {};
  for (const [fn, prm] of [['creer_compte', { p_email: 'intrus-' + ts + '@exemple-test.invalid', p_mdp: 'Intrusion-123456', p_nom: 'Intrus', p_role: 'administrateur' }], ['revoquer_sessions', { p_id: ID.valideur }],
    ['etat_securite_comptes', {}], ['deverrouiller_compte', { p_id: ID.valideur }], ['definir_mot_de_passe', { p_id: ID.valideur, p_mdp: 'Intrusion-123456' }], ['reinitialiser_mfa', { p_id: ID.valideur }]]) {
    const v = await L((fn, prm) => __rpc('lecteur', fn, prm), fn, prm); fnLecteur[fn] = v.erreur ? 'refusée' : 'ACCEPTÉE';
  }
  noter('lecteur : fonctions d\'administration (création de compte, sessions, mots de passe…)', 'toutes refusées', fnLecteur, Object.values(fnLecteur).every(x => x === 'refusée'));

  // Notes : validation de sa propre contribution.
  const grille = (await L(() => __lire('admin', 'grilles', 'id,d->>statut,d->>lot_id', { 'd->>lot_id': 'l1' }))).lignes || [];
  const idNote = 'test-autovalid-' + ts;
  r = await L((id, uid) => __ecrire('admin', 'insert', 'notes', { id, d: { consultation_id: 'c1', lot_id: 'l1', offre_id: 'o3', critere_id: 'k22', analyste_id: uid, analyste_nom: 'Compte de test', note: 5, appreciation: 'Contribution de test', statut: 'proposee' } }), idNote, ID.admin);
  const noteCree = !r.erreur && r.n === 1;
  noter('administrateur (analyste et valideur) : dépôt de sa propre note « proposée »', 'acceptée (préalable)', r.erreur ? 'refusée : ' + r.erreur + ' (grille l1 : ' + JSON.stringify(grille) + ')' : 'acceptée', noteCree, noteCree ? null : 'non vérifié');
  if (noteCree) {
    r = await L((id, uid) => __ecrire('admin', 'update', 'notes', { d: { consultation_id: 'c1', lot_id: 'l1', offre_id: 'o3', critere_id: 'k22', analyste_id: uid, analyste_nom: 'Compte de test', note: 5, appreciation: 'Contribution de test', statut: 'validee' } }, id), idNote, ID.admin);
    noter('administrateur : valider sa propre note (update direct)', 'refusé par le déclencheur garde()', r.erreur ? 'refusé : ' + r.erreur : r.n + ' ligne(s) modifiée(s)', !!r.erreur && /propre contribution/i.test(r.erreur));
    r = await L(id => __ecrire('admin', 'delete', 'notes', null, id), idNote);
    noter('Nettoyage : suppression de la note de test par son auteur', 'acceptée', r.erreur ? 'refusée : ' + r.erreur : r.n + ' ligne supprimée', !r.erreur && r.n === 1, r.erreur ? 'non vérifié' : null);
  }
  r = await L(id => __ecrire('admin', 'insert', 'notes', { id, d: { consultation_id: 'c1', lot_id: 'l1', offre_id: 'o3', critere_id: 'k23', analyste_id: '00000000-0000-4000-a000-000000000001', analyste_nom: 'Compte de test', note: 5, appreciation: 'x', statut: 'validee' } }), idNote + 'b');
  noter('administrateur : insérer directement sa note déjà « validée »', 'refusé', r.erreur ? 'refusé : ' + r.erreur : 'ACCEPTÉ', !!r.erreur);
  if (!r.erreur) await L(id => __ecrire('admin', 'delete', 'notes', null, id), idNote + 'b');
  const n7 = (await L(() => __lire('admin', 'notes', 'id,d', { id: 'n7' }))).lignes[0];
  if (n7) {
    r = await L(d => __ecrire('gestionnaire', 'update', 'notes', { d }, 'n7'), Object.assign({}, n7.d, { statut: 'validee' }));
    const n7b = (await L(() => __lire('admin', 'notes', 'id,d->>statut', { id: 'n7' }))).lignes[0];
    noter('gestionnaire (analyste sans droit de valider) : valider sa note n7', 'refusé', (r.erreur ? 'refusé : ' + r.erreur : r.n + ' ligne(s)') + ', statut = ' + n7b.statut, !!r.erreur && n7b.statut === n7.d.statut);
  }
  // Journal
  const j = (await L(() => __lire('gestionnaire', 'journal', 'id,d')));
  const ligneJ = j.lignes && j.lignes[0];
  if (ligneJ) {
    r = await L((id, d) => __ecrire('gestionnaire', 'update', 'journal', { d: Object.assign({}, d, { action: 'Entrée falsifiée' }) }, id), ligneJ.id, ligneJ.d);
    r2 = await L(id => __ecrire('gestionnaire', 'delete', 'journal', null, id), ligneJ.id);
    const apres = (await L(id => __lire('admin', 'journal', 'id,d', { id }), ligneJ.id)).lignes[0];
    noter('gestionnaire (lecteur du journal) : modifier puis supprimer une entrée du journal', '0 ligne modifiée, 0 supprimée, entrée intacte',
      'modif : ' + (r.erreur || r.n + ' ligne') + ' ; suppr : ' + (r2.erreur || r2.n + ' ligne') + ' ; entrée ' + (apres && apres.d.action === ligneJ.d.action ? 'intacte' : 'ALTÉRÉE'), refuse(r) && refuse(r2) && apres && apres.d.action === ligneJ.d.action);
  } else noter('Modification du journal', 'refusée', 'aucune entrée lisible par le gestionnaire', false, 'non vérifié');
  r = await L(() => __ecrire('gestionnaire', 'insert', 'journal', { d: { action: 'Entrée forgée', auteur_nom: 'Quelqu\'un d\'autre' } }));
  noter('gestionnaire : insertion directe dans le journal', 'refusée (seule la fonction journaliser écrit)', r.erreur ? 'refusée : ' + r.erreur : 'ACCEPTÉE', !!r.erreur);
  r = await L(() => __rpc('anon', 'journaliser', { p_action: 'Entrée anonyme' }));
  noter('anonyme : journaliser()', 'refusé', r.erreur ? 'refusé : ' + r.erreur : 'ACCEPTÉ', !!r.erreur);
  r = await L(() => __rpc('gestionnaire', 'journaliser', { p_action: 'Connexion', p_objet_type: 'session' }));
  noter('gestionnaire : forger un événement de sécurité « Connexion » par journaliser()', 'refusé (événement réservé au serveur)', r.erreur ? 'refusé : ' + r.erreur : 'ACCEPTÉ', !!r.erreur);
  r = await L(() => __rpc('gestionnaire', 'journaliser', { p_action: 'Activation de la double authentification', p_objet_type: 'securite' }));
  noter('gestionnaire : prétendre avoir activé la double authentification', 'refusé (aucun facteur vérifié)', r.erreur ? 'refusé : ' + r.erreur : 'ACCEPTÉ', !!r.erreur);

  /* =========================== Captures : accueil et connexion admin =========================== */
  section('Captures de l\'interface en ligne (70 et suivantes)');
  await capture(p, '70-en-ligne-accueil-organisme-fictif');
  await connexionUI(p, 'admin@demo.example', MDP);
  const demandeCode = await L(() => !!D.mfaEnAttente && !document.querySelector('input[name=code]').closest('.champ').hidden);
  noter('Interface : connexion admin sans code', 'champ « Code de vérification » demandé', demandeCode ? 'code demandé' : 'pas de demande de code', demandeCode);
  await capture(p, '71-en-ligne-connexion-admin-code-demande');
  await connexionUI(p, null, null, await codeFrais(secretAdmin));
  const uiAdmin = await L(() => D.utilisateur && D.utilisateur.role);
  noter('Interface : connexion admin avec code', 'connecté administrateur', String(uiAdmin), uiAdmin === 'administrateur');
  await aller(p, '/securite');
  await capture(p, '72-en-ligne-ma-securite-double-authentification-active');

  /* =========================== 7 (début) + 5. Compte jetable et verrouillage =========================== */
  section('5. Verrouillage après échecs de connexion');
  const sec = (await L(() => __lire('admin', 'parametres', 'id,d', { id: 'securite' }))).lignes[0];
  const MAX = (sec && sec.d.valeur && Number(sec.d.valeur.echecs_max)) || 5;
  const email = 'jetable-' + ts + '@exemple-test.invalid', mdpJ = 'Jetable-' + ts + '-Test!';
  const idJ = await L((e, m, t) => D.creerCompte({ email: e, mot_de_passe: m, nom: 'Compte jetable de test ' + t, role: 'lecteur', service: 'Essais' }).then(String).catch(x => 'ERREUR ' + x.message), email, mdpJ, ts);
  const creeOk = /^[0-9a-f-]{36}$/.test(idJ);
  if (creeOk) jetables.push({ id: idJ, email });
  noter('Création par l\'administrateur d\'un compte jetable (D.creerCompte → creer_compte)', 'identifiant renvoyé', creeOk ? idJ : idJ, creeOk);
  if (!creeOk) throw new Error('Compte jetable non créé : ' + idJ);
  r = await L((e, m) => __connecter('jetable', e, m), email, mdpJ);
  r2 = await L(() => __rpc('jetable', 'moi'));
  noter('Compte jetable : première connexion', 'acceptée, moi() renvoie le profil lecteur', (r.ok ? 'acceptée' : r.erreur) + ', moi = ' + (r2.data && r2.data.role), !!r.ok && r2.data && r2.data.role === 'lecteur');
  await L(() => __deconnecter('jetable'));
  const essais = [];
  for (let i = 0; i < MAX; i++) {
    const e = await L((e) => __connecter('essai', e, 'Mauvais-mot-de-passe-' + Math.random()), email);
    await L(e => __rpc('anon', 'signaler_echec_connexion', { p_email: e }), email); // ce que fait l'application après un échec (D.connexion)
    essais.push(e.ok ? 'ACCEPTÉ' : (e.code || 'refus'));
  }
  noter(MAX + ' mauvais mots de passe', MAX + ' refus', essais.join(', '), essais.every(x => x !== 'ACCEPTÉ'));
  r = await L((e, m) => __connecter('jetable', e, m), email, mdpJ);
  noter('Connexion avec le BON mot de passe après ' + MAX + ' échecs', 'refusée (compte verrouillé, user_banned)', r.ok ? 'ACCEPTÉE' : 'refusée : ' + r.erreur + ' [' + r.code + ']', !r.ok && /ban/i.test(String(r.code) + r.erreur));
  await aller(p, '/admin');
  const voitDeverrouiller = await L(() => Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Déverrouiller'));
  noter('Interface admin : bouton « Déverrouiller » sur le compte verrouillé', 'présent', voitDeverrouiller ? 'présent' : 'absent', voitDeverrouiller);
  await p.evaluate(e => { const l = Array.from(document.querySelectorAll('tr')).find(tr => tr.textContent.includes(e)); if (l) l.scrollIntoView({ block: 'center' }); }, email);
  await capture(p, '73-en-ligne-administration-compte-verrouille-deverrouiller');
  r = await L(id => D.deverrouiller(id).then(() => 'ok').catch(e => 'ERREUR ' + e.message), idJ);
  noter('D.deverrouiller par l\'administrateur', 'accepté', r, r === 'ok');
  r = await L((e, m) => __connecter('jetable', e, m), email, mdpJ);
  r2 = await L(() => __rpc('jetable', 'moi'));
  noter('Connexion après déverrouillage', 'acceptée, données lisibles', (r.ok ? 'acceptée' : r.erreur) + ', moi = ' + (r2.data ? r2.data.role : 'nul'), !!r.ok && !!r2.data);

  // Faille recherchée : le verrouillage peut-il être déclenché par n'importe qui, sans aucune tentative de connexion ?
  section('5 bis. Verrouillage déclenché sans tentative de connexion (déni de service)');
  for (let i = 0; i < MAX; i++) await L(e => __rpc('anon', 'signaler_echec_connexion', { p_email: e }), email);
  r = await L((e, m) => __connecter('verif', e, m), email, mdpJ);
  noter('Anonyme : ' + MAX + ' appels à signaler_echec_connexion(adresse) SANS essayer de mot de passe, puis connexion avec le bon mot de passe',
    'connexion acceptée (un tiers ne doit pas pouvoir bloquer un compte en connaissant seulement son adresse)', r.ok ? 'acceptée' : 'REFUSÉE : ' + r.erreur + ' [' + r.code + '] — le compte est bloqué par un tiers anonyme', !!r.ok);
  if (!r.ok) await L(id => D.deverrouiller(id).catch(() => {}), idJ);
  else await L(() => __deconnecter('verif'));

  /* =========================== 6. Révocation de session à distance =========================== */
  section('6. Révocation de session à distance');
  const ctx2 = await navigateur.createBrowserContext();
  const p2 = await ouvrir(ctx2);
  r = await p2.evaluate((e, m) => __connecter('jetable', e, m), email, mdpJ);
  r2 = await p2.evaluate(() => __rpc('jetable', 'moi'));
  noter('2e navigateur (contexte isolé) : connexion du compte jetable', 'acceptée, moi() non nul', (r.ok ? 'acceptée' : r.erreur) + ', moi = ' + (r2.data ? r2.data.role : 'nul'), !!r.ok && !!r2.data);
  await aller(p, '/admin');
  const boutonSessions = await L(e => { const l = Array.from(document.querySelectorAll('tr')).find(tr => tr.textContent.includes(e)); const b = l && Array.from(l.querySelectorAll('button')).find(x => /Fermer ses sessions/.test(x.textContent)); if (l) l.scrollIntoView({ block: 'center' }); return b ? b.textContent.trim() : null; }, email);
  noter('Interface admin : bouton « Fermer ses sessions » sur le compte jetable', 'présent avec le nombre de sessions', boutonSessions || 'absent', !!boutonSessions);
  await capture(p, '74-en-ligne-administration-fermer-ses-sessions');
  const nRevoq = await L(id => D.revoquerSessions(id).catch(e => 'ERREUR ' + e.message), idJ);
  noter('D.revoquerSessions par l\'administrateur', '≥ 2 sessions fermées (navigateur 1 et 2)', String(nRevoq), typeof nRevoq === 'number' && nRevoq >= 2);
  r = await p2.evaluate(() => __rpc('jetable', 'moi'));
  r2 = await p2.evaluate(() => __lire('jetable', 'profils'));
  noter('2e navigateur, requête suivante avec l\'ancien jeton d\'accès', 'moi() nul, aucune donnée lisible', 'moi = ' + (r.erreur ? 'erreur ' + r.erreur : String(r.data && r.data.role || r.data)) + ', profils = ' + (r2.erreur || r2.n), !r.erreur && r.data === null && refuse(r2));
  r = await p2.evaluate(async () => { const { error } = await __C.jetable.auth.refreshSession(); return error ? { erreur: error.message } : { ok: true }; });
  noter('2e navigateur : renouvellement du jeton (refresh token)', 'refusé', r.ok ? 'ACCEPTÉ' : 'refusé : ' + r.erreur, !r.ok);
  r = await L(() => __rpc('jetable', 'moi'));
  noter('1er navigateur (autre session du même compte)', 'moi() nul également', r.erreur ? 'erreur ' + r.erreur : String(r.data), !r.erreur && r.data === null);
  await ctx2.close();

  /* =========================== 7. Mot de passe, désactivation =========================== */
  section('7. Création de compte (ci-dessus), changement de mot de passe, désactivation');
  r = await L((e, m) => __connecter('jetable', e, m), email, mdpJ);
  const nouveauMdp = 'Nouveau-' + ts + '-Mdp!';
  r2 = await L((id, m) => D.changerMotDePasse(id, m).then(() => 'ok').catch(e => 'ERREUR ' + e.message), idJ, nouveauMdp);
  noter('D.changerMotDePasse par l\'administrateur', 'accepté', r2, r2 === 'ok');
  r = await L(() => __rpc('jetable', 'moi'));
  noter('Session ouverte avant le changement de mot de passe', 'fermée (moi() nul)', r.erreur ? 'erreur ' + r.erreur : String(r.data && r.data.role || r.data), !r.erreur && r.data === null);
  r = await L((e, m) => __connecter('ancien', e, m), email, mdpJ);
  noter('Connexion avec l\'ancien mot de passe', 'refusée', r.ok ? 'ACCEPTÉE' : 'refusée : ' + r.erreur, !r.ok);
  r = await L((e, m) => __connecter('jetable', e, m), email, nouveauMdp);
  r2 = await L(() => __rpc('jetable', 'moi'));
  noter('Connexion avec le nouveau mot de passe', 'acceptée', (r.ok ? 'acceptée' : r.erreur) + ', moi = ' + (r2.data ? r2.data.role : 'nul'), !!r.ok && !!r2.data);
  r = await L(id => D.modifier('profils', id, { actif: false }, { action: 'Désactivation d\'un compte', libelle: 'compte jetable de test' }).then(() => 'ok').catch(e => 'ERREUR ' + e.message), idJ);
  noter('Désactivation du compte par l\'administrateur', 'acceptée', r, r === 'ok');
  if (r === 'ok') jetables.find(x => x.id === idJ).desactive = true;
  r = await L(() => __rpc('jetable', 'moi')); r2 = await L(() => __lire('jetable', 'profils'));
  noter('Session du compte désactivé', 'fermée : moi() nul, aucune donnée', 'moi = ' + (r.erreur ? 'erreur' : String(r.data)) + ', profils = ' + (r2.erreur || r2.n), !r.erreur && r.data === null && refuse(r2));
  r = await L((e, m) => __connecter('apres', e, m), email, nouveauMdp);
  r2 = r.ok ? await L(() => __rpc('apres', 'mon_profil')) : null;
  const r3 = r.ok ? await L(() => __lire('apres', 'profils')) : null;
  noter('Nouvelle connexion du compte désactivé', 'aucune donnée lisible (le service d\'authentification délivre un jeton, mais mon_profil et toutes les lectures sont vides)',
    r.ok ? 'jeton délivré ; mon_profil = ' + String(r2.data) + ', profils = ' + (r3.erreur || r3.n) : 'refusée : ' + r.erreur, !r.ok || (r2.data === null && refuse(r3)));

  /* =========================== 8. Comptes de secours =========================== */
  section('8. Comptes de secours (administrateurs)');
  const admins = (await L(() => __lire('admin', 'profils', 'id,d'))).lignes.filter(x => x.d.role === 'administrateur' && x.d.actif !== false);
  noter('Au moins 2 administrateurs actifs (compte de secours)', '≥ 2', admins.length + ' administrateur(s) actif(s) — démo : un seul compte administrateur partagé ; aucun administrateur permanent n\'est créé par ce test', admins.length >= 2, admins.length >= 2 ? null : 'limite');
  const profA = admins.find(x => x.id === ID.admin);
  r = await L((d, id) => __ecrire('admin', 'update', 'profils', { d }, id), Object.assign({}, profA.d, { role: 'lecteur' }), ID.admin);
  noter('Le dernier administrateur ne peut pas se retirer le profil', 'refusé', r.erreur ? 'refusé : ' + r.erreur : r.n + ' ligne(s) modifiée(s)', !!r.erreur || r.n === 0);

  /* =========================== Captures : refus vus par des profils limités =========================== */
  section('Captures : refus d\'accès vus par un profil limité');
  const ctx3 = await navigateur.createBrowserContext();
  const p3 = await ouvrir(ctx3);
  await connexionUI(p3, 'lecteur@demo.example', MDP);
  await aller(p3, '/admin');
  const refusLecteur = await p3.evaluate(() => (document.getElementById('contenu') || document.body).innerText.slice(0, 200));
  noter('Interface : le lecteur ouvre /admin', 'refus affiché', refusLecteur.replace(/\s+/g, ' ').slice(0, 140), /impossible|réservé|autoris|habilit/i.test(refusLecteur));
  await capture(p3, '75-en-ligne-refus-administration-profil-lecteur');
  await p3.evaluate(() => D.deconnexion()); await p3.goto(CIBLE, { waitUntil: 'networkidle0' });
  await connexionUI(p3, 'support@demo.example', MDP);
  await aller(p3, '/consultation/c1');
  const refusSupport = await p3.evaluate(() => (document.getElementById('contenu') || document.body).innerText.slice(0, 200));
  noter('Interface : le support ouvre la consultation c1', 'refus ou dossier introuvable', refusSupport.replace(/\s+/g, ' ').slice(0, 140), /impossible|introuvable|autoris|accès/i.test(refusSupport));
  await capture(p3, '76-en-ligne-refus-consultation-profil-support');
  await p3.evaluate(() => D.deconnexion()).catch(() => {});
  await ctx3.close();
} catch (e) {
  noter('Exécution de la batterie', 'sans interruption', 'interrompue : ' + e.message, false, 'non vérifié');
  console.error(e);
} finally {
  // Nettoyage : comptes jetables désactivés (supprimés par la remise à zéro nocturne), sessions de test fermées.
  for (const j of jetables) if (!j.desactive) {
    const r = await L(id => D.modifier('profils', id, { actif: false }, false).then(() => 'ok').catch(e => 'ERREUR ' + e.message), j.id).catch(e => 'ERREUR ' + e.message);
    j.desactive = r === 'ok'; console.log('  nettoyage ' + j.email + ' : ' + r);
  }
  await L(async () => { for (const n of Object.keys(__C)) await __deconnecter(n); try { await D.deconnexion(); } catch (e) { /* déjà fermée */ } }).catch(() => {});
  await navigateur.close(); if (serveur) serveur.close();
}

const bilan = { conforme: 0, 'NON CONFORME': 0, limite: 0, 'non vérifié': 0 };
for (const x of resultats) bilan[x.statut]++;
const sortie = { cible: CIBLE, debut: debut.toISOString(), fin: new Date().toISOString(), bilan, comptes_jetables: jetables, erreurs_js: erreursJS, resultats };
fs.mkdirSync(path.dirname(SORTIE), { recursive: true }); fs.writeFileSync(SORTIE, JSON.stringify(sortie, null, 1));
console.log('\nBilan : ' + JSON.stringify(bilan) + ' sur ' + resultats.length + ' contrôles → ' + path.relative(racine, SORTIE));
