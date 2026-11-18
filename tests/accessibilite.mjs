// Audit automatique d'accessibilité (axe-core, règles WCAG 2.1 niveaux A et AA) sur les écrans principaux.
//   node tests/accessibilite.mjs   → mesures/accessibilite.json et résumé à l'écran
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
import { demarrer } from './serveur.mjs';
const require = createRequire(import.meta.url);
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const axe = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 4176, URL = 'http://127.0.0.1:' + PORT + '/';
const nav = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const serveur = await demarrer(PORT);
const b = await puppeteer.launch({ executablePath: nav, headless: true });
const p = await b.newPage(); await p.setViewport({ width: 1366, height: 900 });
await p.goto(URL, { waitUntil: 'networkidle0' });
const ECRANS = [['Page d\'accueil', '/', null], ['Article', '/info/r-analyser', null], ['Tableau de bord', '/', 'gestionnaire'], ['Consultations', '/consultations', 'gestionnaire'],
  ['Candidatures et offres', '/consultation/c1/offres', 'gestionnaire'], ['Analyse — saisie des notes', '/consultation/c1/analyse?vue=notation', 'gestionnaire'], ['Analyse — synthèse', '/consultation/c1/analyse?vue=synthese', 'gestionnaire'],
  ['Fiche d\'un marché', '/marche/m1', 'gestionnaire'], ['Demandes d\'assistance', '/support', 'gestionnaire'], ['Notifications', '/notifications', 'gestionnaire'], ['Paramètres', '/parametres', 'admin']];
const res = []; let courant = null;
for (const [nom, chemin, profil] of ECRANS) {
  if (profil !== courant) {
    await p.evaluate(async pr => { if (D.utilisateur) await D.deconnexion(); if (pr) { await D.connexion(pr + '@demo.example', 'Demonstration-2026'); sessionStorage.setItem('mfa-demo-reportee', D.utilisateur.id); sessionStorage.setItem('mfa-plus-tard', '1'); Ecrans.menu(); } }, profil);
    courant = profil;
  }
  await p.evaluate(c => { location.hash = c; }, chemin); await new Promise(r => setTimeout(r, 1500));
  await p.evaluate(axe);
  const r = await p.evaluate(async () => { const x = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }); return { violations: x.violations.map(v => ({ id: v.id, impact: v.impact, aide: v.help, noeuds: v.nodes.length, exemple: v.nodes[0] && v.nodes[0].target.join(' ') })), passes: x.passes.length }; });
  res.push(Object.assign({ ecran: nom, chemin }, r));
  console.log(nom.padEnd(32), r.violations.length ? r.violations.map(v => v.id + ' (' + v.impact + ', ' + v.noeuds + ')').join(', ') : 'aucune violation', '— ' + r.passes + ' règles respectées');
}
await b.close(); serveur.close();
fs.mkdirSync(path.join(racine, 'mesures'), { recursive: true });
fs.writeFileSync(path.join(racine, 'mesures', 'accessibilite.json'), JSON.stringify({ date: new Date().toISOString(), outil: 'axe-core ' + require('axe-core/package.json').version, regles: 'WCAG 2.1 A et AA', ecrans: res }, null, 1));
