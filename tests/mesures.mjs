// Mesures de sobriété : poids transféré, nombre de requêtes, temps de chargement, mémoire, par écran.
//   node tests/mesures.mjs [etiquette]   → écrit mesures/<etiquette>.json
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { demarrer } from './serveur.mjs';
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const etiquette = process.argv[2] || 'mesure';
const PORT = 4175, URL = 'http://127.0.0.1:' + PORT + '/';
const nav = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const serveur = await demarrer(PORT);
const b = await puppeteer.launch({ executablePath: nav, headless: true });
const ECRANS = [['Page d\'accueil (avant connexion)', '/', null], ['Tableau de bord', '/', 'gestionnaire'], ['Analyse d\'une consultation', '/consultation/c1/analyse?vue=synthese', 'gestionnaire'], ['Fiche d\'une offre', '/consultation/c1/offre/o1', 'gestionnaire']];
const res = [];
for (const [nom, chemin, profil] of ECRANS) {
  const ctx = await b.createBrowserContext(); const p = await ctx.newPage(); await p.setViewport({ width: 1366, height: 900 });
  const cdp = await p.createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // installe la base de démonstration, connecte le profil, puis mesure un chargement à froid de l'écran
  await p.goto(URL, { waitUntil: 'networkidle0' });
  if (profil) await p.evaluate(async pr => { await D.connexion(pr + '@demo.example', 'Demonstration-2026'); localStorage.setItem('acheteur-uid', D.utilisateur.id); }, profil);
  await p.goto('about:blank');
  const reqs = new Map(); let octets = 0;
  cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, type: e.type }));
  cdp.on('Network.loadingFinished', e => { octets += e.encodedDataLength; const r = reqs.get(e.requestId); if (r) r.octets = e.encodedDataLength; });
  const t0 = Date.now();
  await p.goto(URL + '#' + chemin, { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 600));
  const duree = Date.now() - t0;
  const m = await p.metrics(); const perf = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const liste = [...reqs.values()].filter(r => r.octets != null);
  const parType = {}; for (const r of liste) { const t = r.type || 'Other'; parType[t] = (parType[t] || 0) + r.octets; }
  res.push({ ecran: nom, requetes: liste.length, octets_transferes: octets, ko: Math.round(octets / 1024), par_type_ko: Object.fromEntries(Object.entries(parType).map(([k, v]) => [k, Math.round(v / 1024)])),
    dom_content_loaded_ms: perf.dcl, load_ms: perf.load, chargement_complet_ms: duree, noeuds_dom: m.Nodes, tas_js_mo: Math.round(m.JSHeapUsedSize / 1048576 * 10) / 10,
    plus_lourds: liste.sort((a, c) => c.octets - a.octets).slice(0, 6).map(r => r.url.replace(URL, '') + ' : ' + Math.round(r.octets / 1024) + ' Ko') });
  await ctx.close();
}
await b.close(); serveur.close();
fs.mkdirSync(path.join(racine, 'mesures'), { recursive: true });
fs.writeFileSync(path.join(racine, 'mesures', etiquette + '.json'), JSON.stringify({ date: new Date().toISOString(), navigateur: nav, note: 'Cache désactivé, serveur local sans compression : poids bruts, majorants de ce que transférerait un hébergement compressé.', ecrans: res }, null, 1));
for (const r of res) console.log(r.ecran.padEnd(36), String(r.requetes).padStart(3), 'requêtes', String(r.ko).padStart(6), 'Ko', String(r.load_ms).padStart(5), 'ms', r.tas_js_mo, 'Mo JS');
