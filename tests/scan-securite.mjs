// Contrôle de sécurité PASSIF de la démo en ligne (remplace un scan OWASP ZAP, non réalisé faute de Docker/ZAP sur le poste).
//   node tests/scan-securite.mjs [url]   → mesures/scan-securite.json et résumé à l'écran
// Ce script n'envoie AUCUNE écriture à la base : uniquement des lectures (GET), des requêtes OPTIONS/HEAD/TRACE/PUT/DELETE
// vers le serveur de fichiers statiques (GitHub Pages, qui ne peut rien modifier) et des appels de fonctions en lecture seule
// sous le rôle anonyme. Il ne remplace ni un scan actif (injections, fuzzing) ni un test d'intrusion.
import fs from 'node:fs'; import path from 'node:path'; import tls from 'node:tls'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.argv[2] || 'https://psyc01-cpu.github.io/vavang-demo/').replace(/\/?$/, '/');
const cfgTxt = fs.readFileSync(path.join(racine, 'config.js'), 'utf8');
const API = (cfgTxt.match(/supabaseUrl:\s*'([^']+)'/) || [])[1];
const CLE = (cfgTxt.match(/supabaseCle:\s*'([^']+)'/) || [])[1];
const TABLES = ['profils', 'habilitations', 'parametres', 'journal', 'besoins', 'consultations', 'affectations', 'lots', 'grilles', 'criteres',
  'grille_versions', 'modeles_grille', 'pieces_attendues', 'offres', 'pieces', 'annotations', 'lignes_prix', 'notes', 'notes_historique', 'demandes',
  'analyses', 'rapports', 'modeles_document', 'documents_dce', 'documents_versions', 'validations', 'marches', 'evenements', 'fournisseurs',
  'fournisseur_suivi', 'evaluations', 'reprises', 'annonces', 'notifications', 'tickets', 'factures', 'calculs', 'trace_technique'];

const R = { date: new Date().toISOString(), cible: SITE, api: API, nature: 'Contrôle passif maison. Scan OWASP ZAP non réalisé (Docker absent du poste), remplacé par ce contrôle passif.', constats: [], details: {} };
const constat = (gravite, sujet, texte) => { R.constats.push({ gravite, sujet, texte }); console.log(('[' + gravite + ']').padEnd(14), sujet.padEnd(28), texte); };
const entetes = h => Object.fromEntries([...h.entries()]);
async function req(url, opt = {}) { try { const r = await fetch(url, Object.assign({ redirect: 'manual' }, opt)); const corps = opt.method === 'HEAD' ? '' : await r.text(); return { statut: r.status, entetes: entetes(r.headers), corps }; } catch (e) { return { statut: 0, erreur: e.message, entetes: {}, corps: '' }; } }

// 1. Transport : redirection HTTP → HTTPS et version TLS
const hote = new URL(SITE).hostname;
const http = await req(SITE.replace('https://', 'http://'), { method: 'HEAD' });
R.details.redirectionHttp = { statut: http.statut, location: http.entetes.location || null };
if ([301, 302, 307, 308].includes(http.statut) && /^https:/.test(http.entetes.location || '')) constat('ok', 'HTTPS', 'http:// redirige vers https:// (' + http.statut + ')');
else constat('a-corriger', 'HTTPS', 'pas de redirection HTTP→HTTPS constatée (statut ' + http.statut + ')');
async function tlsInfo(h) { return new Promise(ok => { const s = tls.connect(443, h, { servername: h }, () => { const c = s.getPeerCertificate(); ok({ protocole: s.getProtocol(), chiffrement: s.getCipher().name, certificatValide: s.authorized, emetteur: c.issuer && c.issuer.O, expire: c.valid_to }); s.end(); }); s.on('error', e => ok({ erreur: e.message })); }); }
R.details.tls = { site: await tlsInfo(hote), api: API ? await tlsInfo(new URL(API).hostname) : null };
for (const [k, v] of Object.entries(R.details.tls)) if (v) constat(v.certificatValide && /TLSv1\.[23]/.test(v.protocole) ? 'ok' : 'a-corriger', 'TLS ' + k, (v.protocole || v.erreur) + ', certificat ' + (v.certificatValide ? 'valide' : 'NON valide') + (v.expire ? ' (expire ' + v.expire + ')' : ''));

// 2. En-têtes de la page
const page = await req(SITE);
R.details.page = { statut: page.statut, entetes: page.entetes };
const h = page.entetes;
const verif = [
  ['strict-transport-security', 'HSTS', 'a-corriger'],
  ['x-content-type-options', 'X-Content-Type-Options', 'a-corriger'],
  ['content-security-policy', 'CSP (en-tête HTTP)', 'info'],
  ['x-frame-options', 'X-Frame-Options', 'a-corriger'],
  ['referrer-policy', 'Referrer-Policy', 'faible'],
  ['permissions-policy', 'Permissions-Policy', 'faible']];
for (const [n, nom, g] of verif) constat(h[n] ? 'ok' : g, 'Page : ' + nom, h[n] ? h[n].slice(0, 90) : 'absent');
const cspMeta = (page.corps.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i) || [])[1] || null;
R.details.cspMeta = cspMeta;
if (cspMeta) {
  constat('ok', 'CSP (balise meta)', 'présente ; script-src ' + ((cspMeta.match(/script-src ([^;]+)/) || [])[1] || '?') + ' ; object-src ' + ((cspMeta.match(/object-src ([^;]+)/) || [])[1] || '?'));
  if (/'unsafe-inline'/.test((cspMeta.match(/style-src ([^;]+)/) || [])[1] || '')) constat('faible', 'CSP style-src', "'unsafe-inline' autorisé pour les styles (attributs style de l'interface)");
  if (!/frame-ancestors/.test(cspMeta)) constat('a-corriger', 'Clickjacking', "ni X-Frame-Options ni frame-ancestors (ce dernier est sans effet en balise meta) : la page peut être intégrée dans un cadre tiers. GitHub Pages ne permet pas d'ajouter l'en-tête.");
}
if (h['set-cookie']) constat('info', 'Cookies (page)', h['set-cookie']); else constat('ok', 'Cookies (page)', 'aucun cookie déposé par le serveur');
if (h.server) constat('info', 'Serveur annoncé', h.server);

// 3. Ressources servies : secrets, versions, contenu mixte
const ressources = [...page.corps.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^(https?:|data:|mailto:)/.test(u) || u.startsWith(SITE));
// Fichiers chargés dynamiquement (bibliothèques tierces à la demande) : relevés dans le code.
const dyn = new Set();
const fichiers = {};
for (const u of ressources) { const r = await req(new URL(u, SITE).href); fichiers[u] = r; }
for (const [u, r] of Object.entries(fichiers)) for (const m of r.corps.matchAll(/['"]((?:vendor|js|css|img)\/[\w./-]+\.(?:js|css|json|svg|png))['"]/g)) if (!fichiers[m[1]]) dyn.add(m[1]);
for (const u of dyn) { const r = await req(new URL(u, SITE).href); if (r.statut === 200) fichiers[u] = r; }
const textuels = Object.entries(fichiers).filter(([u]) => /\.(js|css|html|json)$/.test(u) || u === '');
textuels.unshift(['index.html', page]);
R.details.ressources = Object.entries(fichiers).map(([u, r]) => ({ chemin: u, statut: r.statut, octets: r.corps.length, type: r.entetes['content-type'] }));
constat('info', 'Ressources analysées', textuels.length + ' fichiers texte (HTML, JS, CSS), ' + (Object.keys(fichiers).length - textuels.length + 1) + ' autres');

const MOTIFS = [
  ['service_role', /service_role/g], ['clé secrète Supabase (sb_secret_)', /sb_secret_[A-Za-z0-9_-]{10,}/g],
  ['clé privée PEM', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g], ['jeton JWT', /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['clé AWS', /AKIA[0-9A-Z]{16}/g], ['jeton GitHub', /gh[pousr]_[A-Za-z0-9]{36}/g], ['clé Stripe live', /sk_live_[A-Za-z0-9]{10,}/g], ['clé Google API', /AIza[0-9A-Za-z_-]{35}/g]];
const secrets = [];
for (const [u, r] of textuels) for (const [nom, re] of MOTIFS) for (const m of r.corps.matchAll(re)) {
  let detail = r.corps.slice(Math.max(0, m.index - 50), m.index + 60).replace(/\s+/g, ' ');
  if (nom === 'jeton JWT') { try { const p = JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url').toString()); detail = 'rôle ' + p.role; } catch { /* illisible */ } }
  secrets.push({ fichier: u, motif: nom, contexte: detail });
}
R.details.secrets = secrets;
// « service_role » peut apparaître dans le code de la bibliothèque Supabase (nom de rôle) sans être une clé : on le signale à part.
const vrais = secrets.filter(s => !(s.motif === 'service_role' && /vendor\/supabase/.test(s.fichier)));
if (!vrais.length) constat('ok', 'Secrets dans le code servi', 'aucun motif de secret trouvé (' + MOTIFS.map(m => m[0]).join(', ') + ')' + (secrets.length ? ' ; ' + secrets.length + ' mention(s) du mot service_role dans la bibliothèque Supabase, sans clé' : ''));
else constat('critique', 'Secrets dans le code servi', vrais.length + ' occurrence(s) : ' + vrais.map(s => s.fichier + ' / ' + s.motif).join(' ; '));
constat('info', 'Valeurs publiques assumées', 'clé publishable Supabase, mot de passe des comptes démo et clé TOTP de l\'admin démo (config.js) : publiques par choix, données fictives');

// Contenu mixte : ressources chargées en http:// (on ignore les espaces de noms XML et les commentaires de licence)
const mixte = [];
for (const [u, r] of textuels) for (const m of r.corps.matchAll(/(?:src|href)\s*=\s*["']http:\/\/[^"']+|url\(\s*["']?http:\/\/[^)"']+|fetch\(\s*["']http:\/\/[^"']+|(?:connect|import)\s*\(\s*["']http:\/\/[^"']+/g)) mixte.push({ fichier: u, extrait: m[0].slice(0, 100) });
R.details.contenuMixte = mixte;
constat(mixte.length ? 'a-verifier' : 'ok', 'Contenu mixte', mixte.length ? mixte.length + ' référence(s) http:// à examiner' : 'aucune ressource chargée en http:// ; la CSP n\'autorise que self et Supabase en https/wss');
const cartes = textuels.filter(([, r]) => /sourceMappingURL=/.test(r.corps)).map(([u]) => u);
R.details.sourceMaps = cartes;
if (cartes.length) constat('info', 'Cartes de source', 'référencées dans ' + cartes.join(', ') + ' (code source déjà public, sans enjeu)');

// Bibliothèques : version lue dans le fichier servi, et comparaison d'empreinte avec node_modules
const empreinte = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);
const BIBS = [
  ['vendor/xlsx.full.min.js', 'SheetJS', /version="(\d+\.\d+\.\d+)"/, 'xlsx/dist/xlsx.full.min.js', 'CVE-2023-30533 et CVE-2024-22363 corrigées à partir de 0.20.2'],
  ['vendor/pdf.min.js', 'pdf.js', /version="(\d+\.\d+\.\d+)"|pdfjsVersion\s*=\s*"([\d.]+)"/, 'pdfjs-dist/build/pdf.min.js', 'CVE-2024-4367 corrigée en 4.2.67 : version servie antérieure, faille neutralisée par isEvalSupported:false (vérifié dans le code)'],
  ['vendor/jszip.min.js', 'JSZip', /v(\d+\.\d+\.\d+)/, 'jszip/dist/jszip.min.js', 'CVE-2022-48285 corrigée à partir de 3.8.0'],
  ['vendor/pdfmake.min.js', 'pdfmake', /v(\d+\.\d+\.\d+)/, 'pdfmake/build/pdfmake.min.js', 'aucune alerte connue relevée (non vérifié dans une base CVE)'],
  ['vendor/supabase.js', 'supabase-js', null, '@supabase/supabase-js/dist/umd/supabase.js', 'aucune alerte connue relevée (non vérifié dans une base CVE)'],
  ['vendor/docx.js', 'docx', null, 'docx/dist/index.iife.js', 'aucune alerte connue relevée (non vérifié dans une base CVE)'],
  ['vendor/qrcode.js', 'qrcode-generator', null, 'qrcode-generator/qrcode.js', 'aucune alerte connue relevée (non vérifié dans une base CVE)']];
R.details.bibliotheques = [];
for (const [chemin, nom, re, nm, note] of BIBS) {
  let r = fichiers[chemin]; if (!r) { r = await req(new URL(chemin, SITE).href); }
  if (r.statut !== 200) { R.details.bibliotheques.push({ nom, chemin, servi: false }); continue; }
  const m = re && r.corps.match(re); let version = m ? (m[1] || m[2]) : null; let identiqueNodeModules = null;
  const pnm = path.join(racine, 'node_modules', nm);
  if (fs.existsSync(pnm)) { identiqueNodeModules = empreinte(fs.readFileSync(pnm, 'utf8')) === empreinte(r.corps); const pk = path.join(racine, 'node_modules', nm.split('/').slice(0, nm.startsWith('@') ? 2 : 1).join('/'), 'package.json'); if (!version && identiqueNodeModules && fs.existsSync(pk)) version = JSON.parse(fs.readFileSync(pk, 'utf8')).version + ' (déduite : fichier identique au paquet npm)'; }
  R.details.bibliotheques.push({ nom, chemin, servi: true, version: version || 'non déterminée', identiqueNodeModules, note });
  constat('info', 'Bibliothèque ' + nom, (version || 'version non déterminée') + ' — ' + note);
}

// 4. Méthodes HTTP sur le serveur de fichiers
R.details.methodes = {};
for (const m of ['OPTIONS', 'TRACE', 'PUT', 'DELETE', 'POST']) { const r = await req(SITE + 'index.html', { method: m, body: ['PUT', 'POST'].includes(m) ? 'x' : undefined }); R.details.methodes[m] = r.statut; }
const accepte = Object.entries(R.details.methodes).filter(([, s]) => s >= 200 && s < 300).map(([m]) => m);
constat(accepte.some(m => m !== 'OPTIONS') ? 'a-corriger' : 'ok', 'Méthodes HTTP (page)', Object.entries(R.details.methodes).map(([m, s]) => m + ' ' + (s === 0 ? 'non testée (méthode refusée par le client Node)' : s)).join(', '));

// 5. Fichiers sensibles exposés
R.details.fichiersSensibles = {};
for (const f of ['.git/config', '.env', 'node_modules/', 'package.json', 'supabase/schema.sql', 'tests/serveur.mjs']) R.details.fichiersSensibles[f] = (await req(SITE + f, { method: 'HEAD' })).statut;
const fs200 = Object.entries(R.details.fichiersSensibles).filter(([, s]) => s === 200).map(([f]) => f);
constat(fs200.some(f => ['.git/config', '.env'].includes(f)) ? 'critique' : 'ok', 'Fichiers sensibles', Object.entries(R.details.fichiersSensibles).map(([f, s]) => f + ' ' + s).join(', ') + (fs200.length ? ' (dépôt public : les fichiers en 200 sont déjà publics sur GitHub)' : ''));

// 6. API Supabase sous le rôle anonyme (lecture seule)
if (API && CLE) {
  const H = { apikey: CLE, Authorization: 'Bearer ' + CLE };
  const racineApi = await req(API + '/rest/v1/', { headers: H });
  R.details.api = { racine: { statut: racineApi.statut, entetes: racineApi.entetes, extrait: racineApi.corps.slice(0, 200) } };
  const ha = racineApi.entetes;
  constat(ha['strict-transport-security'] ? 'ok' : 'faible', 'API : HSTS', ha['strict-transport-security'] || 'absent');
  constat(ha['x-content-type-options'] ? 'ok' : 'faible', 'API : X-Content-Type-Options', ha['x-content-type-options'] || 'absent');
  if (ha['set-cookie']) constat('info', 'API : cookies', ha['set-cookie'].slice(0, 120)); else constat('ok', 'API : cookies', 'aucun cookie (jeton porté par en-tête Authorization)');
  constat(racineApi.statut === 200 && /"paths"/.test(racineApi.corps) ? 'faible' : 'ok', 'API : schéma OpenAPI', racineApi.statut === 200 && /"paths"/.test(racineApi.corps) ? 'le schéma des tables est lisible par le rôle anonyme (structure seulement, déjà publique dans le dépôt)' : 'non lisible en anonyme (statut ' + racineApi.statut + ')');
  const cors = await req(API + '/rest/v1/consultations?select=id&limit=1', { headers: Object.assign({ Origin: 'https://site-tiers.example' }, H) });
  constat('info', 'API : CORS', 'Access-Control-Allow-Origin = ' + (cors.entetes['access-control-allow-origin'] || 'absent') + ' (comportement standard de Supabase ; la protection repose sur le jeton et les politiques RLS)');
  // Lecture de chaque table en anonyme : on attend 0 ligne ou un refus.
  R.details.api.tablesAnonymes = {};
  for (const t of TABLES) { const r = await req(API + '/rest/v1/' + t + '?select=id&limit=5', { headers: H }); let n = null; try { const j = JSON.parse(r.corps); n = Array.isArray(j) ? j.length : null; } catch { /* corps non JSON */ } R.details.api.tablesAnonymes[t] = { statut: r.statut, lignes: n, message: n === null ? r.corps.slice(0, 120) : undefined }; }
  // Exception voulue (supabase/schema.sql, politique accueil_public) : les annonces ACTIVES de la page d'accueil sont publiques.
  const ann = await req(API + '/rest/v1/annonces?select=id,d', { headers: H }); let annOk = null;
  try { const j = JSON.parse(ann.corps); annOk = Array.isArray(j) ? { lignes: j.length, inactivesVisibles: j.filter(x => !(x.d && (x.d.actif === true || x.d.actif === 'true'))).length } : null; } catch { /* */ }
  R.details.api.annoncesPubliques = annOk;
  const fuites = Object.entries(R.details.api.tablesAnonymes).filter(([t, v]) => v.lignes > 0 && !(t === 'annonces' && annOk && annOk.inactivesVisibles === 0)).map(([t, v]) => t + ' (' + v.lignes + ')');
  constat(fuites.length ? 'critique' : 'ok', 'RLS : lecture anonyme', fuites.length ? 'lignes lisibles sans connexion : ' + fuites.join(', ') : TABLES.length + ' tables interrogées sans connexion : aucune ligne renvoyée, sauf les annonces actives de la page d’accueil (' + (annOk ? annOk.lignes : '?') + ', publiques par conception, aucune annonce inactive visible)');
  // Fonctions en lecture seule, interdites au rôle anonyme d'après supabase/schema_demo.sql.
  R.details.api.fonctionsAnonymes = {};
  for (const f of ['moi', 'mon_profil', 'etat_securite_comptes']) { const r = await req(API + '/rest/v1/rpc/' + f, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: '{}' }); R.details.api.fonctionsAnonymes[f] = { statut: r.statut, extrait: r.corps.slice(0, 160) }; }
  const fOuv = Object.entries(R.details.api.fonctionsAnonymes).filter(([, v]) => v.statut >= 200 && v.statut < 300 && !/^(null|\[\]|\{\})$/.test(v.extrait.trim())).map(([f]) => f);
  constat(fOuv.length ? 'a-corriger' : 'ok', 'Fonctions : appel anonyme', Object.entries(R.details.api.fonctionsAnonymes).map(([f, v]) => f + ' ' + v.statut).join(', '));
  const st = await req(API + '/storage/v1/bucket', { headers: H });
  let nb = null; try { const j = JSON.parse(st.corps); nb = Array.isArray(j) ? j.length : null; } catch { /* */ }
  R.details.api.stockageAnonyme = { statut: st.statut, compartiments: nb };
  constat(nb > 0 ? 'a-verifier' : 'ok', 'Stockage : liste anonyme', nb > 0 ? nb + ' compartiment(s) listables sans connexion' : 'aucun compartiment listable sans connexion (statut ' + st.statut + ')');
  const reg = await req(API + '/auth/v1/settings', { headers: { apikey: CLE } });
  try { const j = JSON.parse(reg.corps); R.details.api.authentification = { inscriptionDesactivee: j.disable_signup, confirmationEmailAuto: j.mailer_autoconfirm, fournisseursExternes: Object.entries(j.external || {}).filter(([, v]) => v === true).map(([k]) => k) };
    constat(j.disable_signup ? 'ok' : 'a-corriger', 'Auth : inscription libre', j.disable_signup ? 'désactivée (comptes créés par l\'administrateur seulement)' : 'ACTIVÉE : n\'importe qui peut créer un compte via l\'API (les politiques RLS restent la barrière)');
  } catch { constat('info', 'Auth : réglages', 'non lisibles (statut ' + reg.statut + ')'); }
}

// 7. npm audit (dépendances de production : aucune, toutes les bibliothèques sont des dépendances de développement copiées dans vendor/)
function audit(arg) { try { return JSON.parse(execSync('npm audit --json ' + arg, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { try { return JSON.parse(e.stdout); } catch { return { erreur: e.message }; } } }
const aProd = audit('--omit=dev'), aTout = audit('');
R.details.npmAudit = { omitDev: aProd.metadata ? aProd.metadata.vulnerabilities : aProd, complet: aTout.metadata ? aTout.metadata.vulnerabilities : aTout,
  paquetsComplet: aTout.vulnerabilities ? Object.entries(aTout.vulnerabilities).map(([n, v]) => n + ' (' + v.severity + ')') : [] };
constat('info', 'npm audit --omit=dev', JSON.stringify(R.details.npmAudit.omitDev) + ' — sans portée réelle : le projet n\'a aucune dépendance de production');
constat('info', 'npm audit (complet)', JSON.stringify(R.details.npmAudit.complet) + ' : ' + R.details.npmAudit.paquetsComplet.join(', '));

R.limites = ['Scan OWASP ZAP non réalisé, remplacé par un contrôle passif.', 'Aucun test actif : injections, XSS, contournement d\'authentification, élévation de droits par requêtes forgées non testés par ce script.',
  'Écritures anonymes ou par un profil non habilité non testées par ce script (pour ne rien écrire en base).', 'Versions des bibliothèques non confrontées à une base CVE en ligne ; les notes indiquent les failles connues de l\'auteur.'];
const bilan = R.constats.reduce((a, c) => (a[c.gravite] = (a[c.gravite] || 0) + 1, a), {});
R.bilan = bilan; console.log('\nBilan :', JSON.stringify(bilan));
fs.mkdirSync(path.join(racine, 'mesures'), { recursive: true });
fs.writeFileSync(path.join(racine, 'mesures', 'scan-securite.json'), JSON.stringify(R, null, 1));
