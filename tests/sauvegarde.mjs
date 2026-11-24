// Sauvegarde logique de la base hébergée (Supabase), sans secret ni service payant.
// Ouvre la démonstration en ligne dans Chrome sans interface, se connecte en administrateur (mot de passe + code TOTP calculé
// depuis CONFIG.demoMfaSecret, clé de démonstration volontairement publique), appelle exporter_sauvegarde() (supabase/sauvegarde.sql),
// télécharge les fichiers des compartiments « pieces » et « accueil », puis écrit dans un dossier :
//   sauvegarde-AAAAMMJJ-HHMM.json   (heure UTC)  données + inventaire des fichiers + empreintes SHA-256
//   fichiers/<compartiment>/<chemin>               copie des fichiers
//   SHA256SUMS                                     empreintes au format « sha256sum -c »
//
//   node tests/sauvegarde.mjs [dossier_de_sortie]
// Variables d'environnement (toutes facultatives) :
//   VAVANG_URL       adresse de l'application (défaut : la démo publique)
//   CHROME           chemin de Chrome (défaut : Chrome Windows, sinon google-chrome)
//   CHROME_ARGS      arguments supplémentaires, séparés par « ; » (ex. « --host-resolver-rules=MAP vavang.localhost 127.0.0.1 »)
//   VAVANG_ADMIN, VAVANG_MDP, VAVANG_TOTP   compte administrateur (défaut : compte de démonstration public)
//   SAUVEGARDE_CLE   phrase de passe (32 caractères au moins) : si elle est fournie, le dossier est chiffré en AES-256-GCM
//                    (tests/chiffrement-sauvegarde.mjs) dans <nom>.vvs, puis le dossier en clair est supprimé
//   SAUVEGARDE_CHIFFREMENT=obligatoire   refuse de sauvegarder sans SAUVEGARDE_CLE (instance de production)
// Le script s'arrête en erreur (code 1) au moindre écart : il n'écrit jamais une sauvegarde partielle sans le dire.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { chiffrerDossier, exigerCle } from './chiffrement-sauvegarde.mjs';

export const URL_DEMO = 'https://psyc01-cpu.github.io/vavang-demo/';
export const sha256 = donnees => crypto.createHash('sha256').update(donnees).digest('hex');
// Empreinte d'une table : SHA-256 du JSON des lignes, dans l'ordre renvoyé par le serveur (trié par id).
export const empreinteTable = lignes => sha256(JSON.stringify(lignes));
export const maintenant = () => performance.now();
export const secondes = ms => Math.round(ms) / 1000;

function cheminChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const p of ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'])
    if (fs.existsSync(p)) return p;
  throw new Error('Chrome introuvable : renseigner la variable CHROME.');
}

// Chemin de fichier venu du serveur : refusé s'il pourrait sortir du dossier de sauvegarde.
export function cheminSur(compartiment, chemin) {
  const morceaux = String(chemin).split('/');
  if (!/^(pieces|accueil)$/.test(compartiment) || !chemin || morceaux.some(m => m === '' || m === '.' || m === '..' || /[\\:\0]/.test(m)))
    throw new Error('Chemin de fichier refusé : ' + compartiment + '/' + chemin);
  return path.join(compartiment, ...morceaux);
}
const encoderChemin = chemin => String(chemin).split('/').map(encodeURIComponent).join('/');

/* ---------- Connexion de l'administrateur dans l'application elle-même ---------- */
export async function connecter() {
  const url = process.env.VAVANG_URL || URL_DEMO;
  const email = process.env.VAVANG_ADMIN || 'admin@demo.example', mdp = process.env.VAVANG_MDP || 'Demonstration-2026';
  const args = (process.env.CHROME_ARGS || '').split(';').map(s => s.trim()).filter(Boolean);
  if (process.env.CI) args.push('--no-sandbox'); // exécuteurs GitHub (Ubuntu) : bac à sable Chrome indisponible
  const navigateur = await puppeteer.launch({ executablePath: cheminChrome(), headless: true, args });
  try {
    const page = await navigateur.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() => window.D && window.TOTP && window.CONFIG, { timeout: 30000 });
    const mode = await page.evaluate(() => D.mode);
    if (mode !== 'supabase') throw new Error('L\'application est en mode « ' + mode + ' » à cette adresse : la sauvegarde ne concerne que le mode hébergé.');
    const r = await page.evaluate(async (email, mdp, secretEnv) => {
      const secret = secretEnv || CONFIG.demoMfaSecret;
      try { await D.connexion(email, mdp); } catch (e) {
        if (!e.mfa) return { erreur: e.message };
        if (!secret) return { erreur: 'Code de double authentification demandé, mais aucune clé TOTP disponible.' };
        // à moins de 3 s du changement de période, attendre le code suivant (évite un échec compté au verrouillage)
        const reste = 30000 - (Date.now() % 30000); if (reste < 3000) await new Promise(ok => setTimeout(ok, reste + 500));
        try { await D.connexion(email, mdp, await TOTP.code(secret)); } catch (e2) { return { erreur: e2.message }; }
      }
      if (!D.utilisateur || !D.droits.has('admin.utilisateurs')) return { erreur: 'Connecté, mais sans les droits d\'administrateur.' };
      const brut = localStorage.getItem('acheteur-session'); const s = brut && JSON.parse(brut);
      const jeton = s && (s.access_token || (s.currentSession && s.currentSession.access_token));
      if (!jeton) return { erreur: 'Jeton de session introuvable après connexion.' };
      return { jeton, supabaseUrl: CONFIG.supabaseUrl, cle: CONFIG.supabaseCle, nom: D.utilisateur.nom };
    }, email, mdp, process.env.VAVANG_TOTP || '');
    if (r.erreur) throw new Error('Connexion administrateur : ' + r.erreur);
    return Object.assign(r, { url, navigateur });
  } catch (e) { await navigateur.close(); throw e; }
}

/* ---------- Appels au serveur avec le jeton de la session (API REST et stockage) ---------- */
export function client(c) {
  const entetes = extra => Object.assign({ apikey: c.cle, Authorization: 'Bearer ' + c.jeton }, extra || {});
  const verifier = async (rep, quoi) => { if (!rep.ok) throw new Error(quoi + ' : HTTP ' + rep.status + ' ' + (await rep.text()).slice(0, 500)); return rep; };
  return {
    rpc: async (nom, params) => (await verifier(await fetch(c.supabaseUrl + '/rest/v1/rpc/' + nom, {
      method: 'POST', headers: entetes({ 'Content-Type': 'application/json' }), body: JSON.stringify(params || {}) }), 'Fonction ' + nom)).json(),
    telecharger: async (compartiment, chemin) => Buffer.from(await (await verifier(await fetch(c.supabaseUrl + '/storage/v1/object/authenticated/' + compartiment + '/' + encoderChemin(chemin),
      { headers: entetes() }), 'Téléchargement ' + compartiment + '/' + chemin)).arrayBuffer()),
    deposer: async (compartiment, chemin, contenu, type) => verifier(await fetch(c.supabaseUrl + '/storage/v1/object/' + compartiment + '/' + encoderChemin(chemin),
      { method: 'POST', headers: entetes({ 'Content-Type': type || 'application/octet-stream', 'x-upsert': 'false' }), body: contenu }), 'Dépôt ' + compartiment + '/' + chemin),
    supprimer: async (compartiment, chemins) => verifier(await fetch(c.supabaseUrl + '/storage/v1/object/' + compartiment,
      { method: 'DELETE', headers: entetes({ 'Content-Type': 'application/json' }), body: JSON.stringify({ prefixes: chemins }) }), 'Suppression dans ' + compartiment),
    // ferme la seule session de ce script (scope=local), pas celles des visiteurs du compte partagé
    deconnecter: async () => { try { await fetch(c.supabaseUrl + '/auth/v1/logout?scope=local', { method: 'POST', headers: entetes() }); } catch { /* sans effet sur le résultat */ } }
  };
}

/* ---------- Sauvegarde ---------- */
async function sauvegarder(sortie) {
  // Production : pas de sauvegarde en clair. La clé est contrôlée avant toute connexion.
  if (process.env.SAUVEGARDE_CHIFFREMENT === 'obligatoire' || process.env.SAUVEGARDE_CLE) exigerCle();
  const t0 = maintenant(), duree = {};
  const c = await connecter(); duree.connexion_s = secondes(maintenant() - t0);
  const api = client(c);
  try {
    let t = maintenant();
    const s = await api.rpc('exporter_sauvegarde');
    if (!s || s.version !== 1 || !s.tables) throw new Error('Réponse inattendue de exporter_sauvegarde().');
    duree.export_base_s = secondes(maintenant() - t);

    const horodatage = s.date.replace(/[-:]/g, '').replace('T', '-').slice(0, 13); // AAAAMMJJ-HHMM (UTC)
    const nom = 'sauvegarde-' + horodatage;
    const dossier = path.resolve(sortie, nom); fs.mkdirSync(path.join(dossier, 'fichiers'), { recursive: true });

    t = maintenant();
    const empreintes = { tables: {}, fichiers: {} }, comptes = {};
    for (const [table, lignes] of Object.entries(s.tables)) { empreintes.tables[table] = empreinteTable(lignes); comptes[table] = lignes.length; }
    const sommes = [];
    for (const f of s.fichiers || []) {
      const relatif = cheminSur(f.compartiment, f.chemin);
      const contenu = await api.telecharger(f.compartiment, f.chemin);
      if (f.taille != null && contenu.length !== Number(f.taille)) throw new Error('Taille inattendue pour ' + relatif + ' : ' + contenu.length + ' au lieu de ' + f.taille);
      const cible = path.join(dossier, 'fichiers', relatif); fs.mkdirSync(path.dirname(cible), { recursive: true }); fs.writeFileSync(cible, contenu);
      const h = sha256(contenu); empreintes.fichiers[f.compartiment + '/' + f.chemin] = h;
      sommes.push(h + '  fichiers/' + relatif.split(path.sep).join('/'));
    }
    duree.fichiers_s = secondes(maintenant() - t);

    const document = Object.assign({}, s, { comptes, empreintes, source: c.url, durees: duree });
    const fichierJson = nom + '.json';
    const texte = JSON.stringify(document, null, 1);
    fs.writeFileSync(path.join(dossier, fichierJson), texte);
    sommes.unshift(sha256(texte) + '  ' + fichierJson);
    fs.writeFileSync(path.join(dossier, 'SHA256SUMS'), sommes.join('\n') + '\n');
    duree.total_s = secondes(maintenant() - t0);

    const bilan = { dossier, fichier: fichierJson, date: s.date, tables: Object.keys(comptes).length, lignes: s.lignes, fichiers: (s.fichiers || []).length,
      octets_fichiers: (s.fichiers || []).reduce((a, f) => a + Number(f.taille || 0), 0), sha256_json: sha256(texte), durees: duree };
    if (process.env.SAUVEGARDE_CLE) {
      const t2 = maintenant();
      bilan.chiffrement = await chiffrerDossier(dossier, process.env.SAUVEGARDE_CLE, { supprimerClair: true });
      duree.chiffrement_s = secondes(maintenant() - t2);
    }
    console.log(JSON.stringify(bilan, null, 1));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'dossier=' + dossier + '\nnom=' + nom + '\n');
    return bilan;
  } finally { await api.deconnecter(); await c.navigateur.close(); }
}

if (process.argv[1] && /[\\/]sauvegarde\.mjs$/.test(process.argv[1])) {
  sauvegarder(process.argv[2] || 'sauvegardes').catch(e => { console.error('ÉCHEC de la sauvegarde : ' + e.message); process.exit(1); });
}
