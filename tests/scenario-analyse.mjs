// Scénario complémentaire du module d'analyse (CCTP 2.1.4), joué dans Chrome sans interface, en mode local :
//   1. détection des pièces incomplètes ou incohérentes (bordereau : ligne sans prix, montant de ligne faux, quantité modifiée,
//      ligne absente ; déclarations : deux SIREN différents ; pli enregistré après la date limite) ;
//   2. plusieurs contributeurs sur un même critère (deux analystes, moyenne des contributions validées, contributions conservées) ;
//   3. négociation : tours, montant avant et après chaque tour, décision tracée ; refus en appel d'offres ;
//   4. support : canaux de déclaration (portail, courriel, téléphone d'astreinte) et demande reçue par courriel, P1 pris en charge en 1 heure.
//   node tests/scenario-analyse.mjs
// Captures 88 et suivantes dans captures/ ; résultat dans captures/resultat-scenario-analyse.txt.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import { demarrer } from './serveur.mjs';
const require = createRequire(import.meta.url); const XLSX = require('xlsx'); const docx = require('docx');
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURES = path.join(racine, 'captures'), PLIS = path.join(racine, 'demo', 'plis-analyse');
fs.mkdirSync(PLIS, { recursive: true });
const PREMIERE = 88;
for (const f of fs.readdirSync(CAPTURES)) if (/^(8[89]|9\d)-.*\.png$/.test(f)) fs.unlinkSync(path.join(CAPTURES, f));
const PORT = Number(process.env.PORT_TEST) || 4178, URL = 'http://127.0.0.1:' + PORT + '/';
const MDP = 'Demonstration-2026';
const nav = (process.env.NAVIGATEUR ? [process.env.NAVIGATEUR] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']).find(p => fs.existsSync(p));
const pause = ms => new Promise(r => setTimeout(r, ms));
let etape = 0; const constats = [];
const ok = (cond, texte) => { if (!cond) throw new Error('ÉCHEC — ' + texte); constats.push(texte); console.log('   ✓ ' + texte); };
const titre = t => console.log('\n' + (++etape) + '. ' + t);
// TOTP (RFC 6238) pour l'administrateur, comme dans scenario.mjs
const deBase32 = s => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { v = (v << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = secret => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const hm = crypto.createHmac('sha1', deBase32(secret)).update(b).digest(); const o = hm[19] & 15; return String((hm.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0'); };

// SIRET fictif à clé de Luhn correcte (préfixe 000 000 : aucune entreprise réelle)
function siretFictif(base13) { for (let k = 0; k <= 9; k++) { const c = base13 + k; let t = 0; for (let i = 0; i < 14; i++) { let d = Number(c[13 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } t += d; } if (t % 10 === 0) return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4'); } }

const serveur = await demarrer(PORT);
const navigateur = await puppeteer.launch({ executablePath: nav, headless: true, args: ['--window-size=1440,960', '--lang=fr-FR'] });
const page = await navigateur.newPage(); await page.setViewport({ width: 1440, height: 960 });
const erreurs = []; page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) erreurs.push('console: ' + m.text()); });

/* ---------- Plis fictifs ---------- */
async function pdf(fichier, html) { const p = await navigateur.newPage(); await p.setContent('<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.5;margin:40px">' + html + '</body></html>'); await p.pdf({ path: fichier, format: 'A4' }); await p.close(); }
const DES = ['Maintenance préventive — visite mensuelle', 'Astreinte et dépannage — forfait mensuel', 'Pièces et petites réparations — forfait'];
const CANDIDATS = [
  { nom: 'Exemple Bassin Bleu Services', court: 'BassinBleu', montant: 98400, depot: '2026-11-09', siretAE: siretFictif('0000000120001'), siretDC1: siretFictif('0000000120001'),
    lignes: [[24, 2600, 62400], [24, 1000, 24000], [1, 12000, 12000]] },
  { nom: 'Exemple Cilaos Ascenseurs', court: 'Cilaos', montant: 93000, depot: '2026-11-12', siretAE: siretFictif('0000000130001'), siretDC1: siretFictif('0000000130001'),
    lignes: [[24, 2400, 57600], [24, 1100, 26400], [1, 9000, 9000]] },
  // pli incohérent : quantité 12 au lieu de 24, montant de ligne faux (24 × 900 = 21 600, inscrit 22 000), ligne de pièces sans prix,
  // SIREN de l'acte d'engagement différent de celui de la lettre de candidature
  { nom: 'Exemple Grand Coude Maintenance', court: 'GrandCoude', montant: 51600, depot: '2026-11-10', siretAE: siretFictif('0000000140001'), siretDC1: siretFictif('0000000150001'),
    lignes: [[12, 2500, 30000], [24, 900, 22000], [1, '', '']] }];
async function fabriquerPlis() {
  for (const c of CANDIDATS) {
    const d = path.join(PLIS, c.court); fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); c.fichiers = [];
    const f = n => { const p = path.join(d, n); c.fichiers.push(p); return p; };
    await pdf(f('Memoire_technique_' + c.court + '.pdf'), '<h1>Mémoire technique</h1><p><b>' + c.nom + '</b> (société fictive)</p><p>Maintenance des ascenseurs — lot 1.</p><h2>Organisation</h2><p>Deux techniciens habilités, un référent unique, rapport de visite sous 48 heures.</p>');
    await pdf(f('DC1_' + c.court + '.pdf'), '<h1>DC1 — Lettre de candidature</h1><p>Le candidat ' + c.nom + ' (société fictive), SIRET ' + c.siretDC1 + ', présente sa candidature pour le lot 1.</p>');
    await pdf(f('DC2_' + c.court + '.pdf'), '<h1>DC2 — Déclaration du candidat</h1><p>' + c.nom + ' déclare un chiffre d\'affaires moyen fictif.</p>');
    const D = docx; const doc = new D.Document({ sections: [{ children: ['ACTE D\'ENGAGEMENT', c.nom + ' (société fictive) — SIRET ' + c.siretAE, 'Lot 1 — Maintenance des ascenseurs', 'Le candidat s\'engage à exécuter les prestations pour un montant de ' + c.montant.toLocaleString('fr-FR') + ' euros hors taxes.'].map(t => new D.Paragraph({ children: [new D.TextRun(t)] })) }] });
    fs.writeFileSync(f('Acte_engagement_' + c.court + '.docx'), await D.Packer.toBuffer(doc));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['DPGF — ' + c.nom], [], ['Désignation', 'Unité', 'Quantité', 'Prix unitaire HT', 'Montant HT']].concat(c.lignes.map((l, i) => [DES[i], ['visite', 'mois', 'forfait'][i], l[0], l[1], l[2]]))), 'DPGF');
    XLSX.writeFile(wb, f('DPGF_' + c.court + '.xlsx'));
  }
}

/* ---------- Outils de pilotage (repris de scenario.mjs) ---------- */
const attendre = (texte, delai = 15000) => page.waitForFunction(t => document.body.innerText.includes(t), { timeout: delai }, texte).catch(() => { throw new Error('Texte attendu absent : « ' + texte + ' »'); });
const present = texte => page.evaluate(t => document.body.innerText.includes(t), texte);
async function clic(texte, options = {}) {
  const trouver = (t, o) => { const racine = [...document.querySelectorAll('.modale')].pop() || document.getElementById('app');
    let zone = racine; if (o.pres) { const c = [...racine.querySelectorAll(o.dans || 'tr,.bloc-critere,.contribution,.carte')].filter(e => e.innerText.includes(o.pres)); zone = c.sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!zone) return null; }
    const els = [...zone.querySelectorAll('button,a,label.bouton')].filter(e => e.offsetParent !== null && (o.exact ? e.innerText.trim() === t : e.innerText.trim().includes(t)));
    return els[o.rang || 0] || null; };
  await page.waitForFunction((t, o, f) => { const e = (new Function('return ' + f)())(t, o); return e && !e.disabled; }, { timeout: 15000 }, texte, options, trouver.toString()).catch(() => { throw new Error('Bouton introuvable : « ' + texte + ' »' + (options.pres ? ' près de « ' + options.pres + ' »' : '')); });
  await page.evaluate((t, o, f) => (new Function('return ' + f)())(t, o).click(), texte, options, trouver.toString());
  await pause(options.attente || 350);
}
async function remplir(libelle, valeur, options = {}) {
  const r = await page.evaluate((lib, val, o) => {
    const racine = [...document.querySelectorAll('.modale')].pop() || document.getElementById('app');
    let zone = racine; if (o.pres) { zone = [...racine.querySelectorAll('.bloc-critere,.carte,tr')].filter(e => e.innerText.includes(o.pres)).sort((a, b) => a.innerText.length - b.innerText.length)[0]; if (!zone) return 'zone'; }
    const champ = [...zone.querySelectorAll('.champ')].find(c => { const l = c.querySelector('label'); return l && l.innerText.trim().startsWith(lib); }); if (!champ) return 'champ';
    const el = champ.querySelector('input,select,textarea');
    if (el.tagName === 'SELECT') { const op = [...el.options].find(x => x.value === String(val) || x.text.includes(val)); if (!op) return 'option'; el.value = op.value; }
    else if (el.type === 'checkbox') { if (el.checked !== !!val) el.click(); return 'ok'; }
    else { const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(val)); }
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok';
  }, libelle, valeur, options);
  if (r !== 'ok') throw new Error('Champ « ' + libelle + ' » : ' + r + ' introuvable');
}
const valider = async (libelle = 'Enregistrer') => { await page.evaluate(l => { const m = [...document.querySelectorAll('.modale')].pop(); const b = [...m.querySelectorAll('button[type=submit]')].find(x => x.innerText.includes(l)) || m.querySelector('button[type=submit]'); b.click(); }, libelle); await pause(700);
  const e = await page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); const z = m && m.querySelector('.erreur-formulaire'); return z ? z.textContent : ''; }); if (e) throw new Error('Formulaire refusé : ' + e); };
const soumettre = async () => { await page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); m.querySelector('button[type=submit]').click(); }); await pause(700); return page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); const z = m && m.querySelector('.erreur-formulaire'); return z ? z.textContent : ''; }); };
const fermerModale = () => page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); if (m) m.querySelector('.modale-tete button').click(); });
let numero = PREMIERE - 1; const fichiersCaptures = [];
async function capture(nom, options = {}) { await pause(350); await page.evaluate(() => { const z = document.getElementById('messages'); if (z) z.replaceChildren(); }); const f = String(++numero).padStart(2, '0') + '-' + nom + '.png';
  if (options.element) { const el = await page.evaluateHandle(sel => { const [s, txt] = sel; return [...document.querySelectorAll(s)].filter(e => e.innerText.includes(txt)).sort((a, b) => a.innerText.length - b.innerText.length)[0]; }, options.element); await el.asElement().screenshot({ path: path.join(CAPTURES, f) }); }
  else await page.screenshot({ path: path.join(CAPTURES, f), fullPage: options.entier !== false });
  fichiersCaptures.push(f); console.log('   📷 ' + f); }
async function aller(chemin, texte) { await page.evaluate(c => { location.hash = c; }, chemin); await pause(500); if (texte) await attendre(texte); }
let secretAdmin = null;
async function connecter(profil) { if (await page.evaluate(() => !!window.D && !!D.utilisateur)) { await clic('Se déconnecter'); await attendre('Connexion'); }
  await remplir('Adresse électronique', profil + '@demo.example'); await remplir('Mot de passe', MDP); await clic('Se connecter', { attente: 900 });
  await page.waitForFunction(() => /Tableau de bord|Étape obligatoire|Saisissez le code à 6 chiffres/.test(document.body.innerText), { timeout: 15000 });
  if (await present('Saisissez le code à 6 chiffres')) { await remplir('Code de vérification', totp(secretAdmin)); await clic('Se connecter', { attente: 900 }); }
  await attendre('Tableau de bord'); }
const tenter = code => page.evaluate(async c => { try { await (new Function('return (async () => {' + c + '})()'))(); return 'accepté'; } catch (e) { return 'refusé : ' + e.message; } }, code);
const idOffre = (cid, nom) => page.evaluate(async (id, n) => (await D.lister('offres', { consultation_id: id })).find(o => o.candidat === n).id, cid, nom);

/* =================================================================== */
try {
  console.log('Navigateur : ' + nav); await fabriquerPlis(); console.log('Plis fictifs fabriqués dans demo/plis-analyse');
  await page.goto(URL, { waitUntil: 'networkidle0' }); await page.evaluate(async () => { indexedDB.deleteDatabase('logiciel-acheteur'); sessionStorage.clear(); }); await page.goto(URL, { waitUntil: 'networkidle0' }); await attendre('Connexion');

  titre('Préparation : consultation MAPA, grille « moyenne des contributions », deux analystes habilités');
  await connecter('gestionnaire');
  await aller('/besoins', 'Computation des seuils');
  await clic('Recenser un besoin'); await remplir('Objet du besoin', 'Maintenance des ascenseurs du siège'); await remplir('Service prescripteur', 'Direction de l\'environnement'); await remplir('Nature', 'Services'); await remplir('Famille homogène', 'Maintenance des ascenseurs'); await remplir('Montant estimé', 100000); await remplir('Durée', 24); await valider(); await attendre('Maintenance des ascenseurs du siège');
  await clic('Choisir la procédure', { pres: 'Maintenance des ascenseurs du siège' }); await remplir('Procédure retenue', 'Procédure adaptée (MAPA)'); await remplir('Type de marché', 'Marché ordinaire à prix forfaitaire'); await valider(); await pause(500);
  await clic('Créer la consultation', { pres: 'Maintenance des ascenseurs du siège' }); await remplir('Référence', '2026-031'); await remplir('Date limite de remise des offres', '2026-11-10'); await valider('Créer la consultation'); await attendre('Habilitations sur ce dossier');
  const cid = await page.evaluate(() => location.hash.split('/')[2]);
  for (const a of [['Dominique Vidal', 'Valideur'], ['Sacha Leroy', 'Analyste']]) { await clic('Affecter un agent'); await remplir('Agent', a[0]); await remplir('Fonction sur le dossier', a[1]); await valider(); await pause(400); }
  await clic('Passer à l\'étape « Publiée »'); await clic('Confirmer', { exact: true }); await attendre('Passer à l\'étape « Analyse en cours »');
  await aller('/consultation/' + cid + '/analyse', 'Critères, sous-critères et pondérations');
  const critere = async (code, libelle, nature, pond, bareme) => { await clic('Ajouter un critère'); await remplir('Numéro', code); await remplir('Libellé', libelle); await remplir('Nature', nature); await remplir('Pondération', pond); if (bareme) await remplir('Barème', bareme); await valider(); await attendre(libelle); };
  await critere('1', 'Prix des prestations', 'Critère de prix', 40);
  await critere('2', 'Valeur technique', 'Critère noté', 60, 10);
  await clic('Modifier la méthode'); await remplir('Plusieurs analystes', 'moyenne'); await valider(); await pause(400);
  ok(await present('Moyenne automatique des contributions validées'), 'grille paramétrée : plusieurs analystes sur un même critère, consolidation par moyenne des contributions validées (option activée par la collectivité)');
  await connecter('valideur'); await aller('/consultation/' + cid + '/analyse', 'Verrouiller la grille'); await clic('Verrouiller la grille'); await clic('Verrouiller', { exact: true }); await attendre('Grille verrouillée');

  titre('Détection des pièces incomplètes ou incohérentes');
  await connecter('gestionnaire'); await aller('/consultation/' + cid, 'Habilitations sur ce dossier'); await clic('Passer à l\'étape « Analyse en cours »'); await clic('Confirmer', { exact: true }); await pause(600);
  for (const c of CANDIDATS) {
    await aller('/consultation/' + cid + '/offres', 'Tableau comparatif des candidatures');
    await clic('Déposer une offre'); await remplir('ou nom d\'un nouveau candidat', c.nom); await remplir('Date de dépôt', c.depot); await remplir('Montant de l\'offre', c.montant);
    const entree = await page.$('.modale input[type=file]'); await entree.uploadFile(...c.fichiers); await valider('Importer le pli'); await attendre('Pièces du pli (' + c.fichiers.length + ')', 30000);
    await clic('Lire le bordereau déposé'); await clic('Importer', { exact: true }); await attendre('Total recalculé');
  }
  // fiche du pli incohérent (importé en dernier : comparaison avec les deux autres bordereaux)
  ok(await present('montant inscrit au bordereau (22 000,00 €) différent de quantité × prix unitaire (21 600,00 €)'), 'bordereau : montant de ligne inscrit (22 000 €) différent de quantité × prix unitaire (21 600 €), signalé');
  ok(await present('quantité 12 au lieu de 24 dans toutes les autres offres'), 'bordereau : quantité modifiée par le candidat (12 au lieu de 24 dans les autres offres), signalée');
  ok(await present('« Pièces et petites réparations — forfait » du bordereau déposé : quantité ou prix unitaire non renseigné'), 'bordereau : ligne sans prix unitaire, non importée et signalée comme incomplète');
  ok(await present('présente dans 2 autre(s) offre(s), absente de ce bordereau'), 'bordereau : ligne présente dans les autres offres et absente de celle-ci, signalée');
  ok(await present('Les déclarations citent 2 entreprises différentes'), 'déclarations : SIREN de l\'acte d\'engagement différent de celui de la lettre de candidature, signalé');
  ok(await present('Signalements automatiques — à vérifier par l\'agent'), 'signalements présentés comme des alertes à vérifier, sans aucune décision automatique');
  await capture('analyse-pli-incoherent-signalements');
  const oCilaos = await idOffre(cid, 'Exemple Cilaos Ascenseurs');
  await aller('/consultation/' + cid + '/offre/' + oCilaos, 'Offre financière');
  ok(await present('après la date limite du 10/11/2026'), 'pli enregistré le 12/11/2026, après la date limite du 10/11/2026 : signalé');
  const oBassin = await idOffre(cid, 'Exemple Bassin Bleu Services');
  await aller('/consultation/' + cid + '/offre/' + oBassin, 'Offre financière');
  ok(await present('Aucun signalement automatique sur ce pli') || !(await present('Bordereau —')), 'pli conforme (Bassin Bleu) : aucun signalement sur le bordereau ni sur les déclarations');
  await aller('/consultation/' + cid + '/offres', 'Tableau comparatif des candidatures'); await capture('analyse-tableau-comparatif-alertes-par-pli');

  titre('Plusieurs contributeurs : deux analystes sur le même critère, moyenne des contributions validées');
  await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée');
  await clic('Exemple Bassin Bleu Services', { pres: 'Offre analysée', dans: '.actions' }); await pause(500);
  await remplir('Note sur 10', 8, { pres: 'Valeur technique' }); await remplir('Appréciation', 'Référent unique et rapport de visite sous 48 heures : organisation solide.', { pres: 'Valeur technique' });
  await clic('Proposer à la validation', { pres: 'Valeur technique', dans: '.bloc-critere', attente: 900 });
  await connecter('prescripteur'); await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée');
  await clic('Exemple Bassin Bleu Services', { pres: 'Offre analysée', dans: '.actions' }); await pause(500);
  ok(await present('Camille Morel'), 'le second analyste voit la contribution du premier, qui reste distincte de la sienne');
  await remplir('Note sur 10', 6, { pres: 'Valeur technique' }); await remplir('Appréciation', 'Deux techniciens seulement pour le parc : moyens justes.', { pres: 'Valeur technique' });
  await clic('Proposer à la validation', { pres: 'Valeur technique', dans: '.bloc-critere', attente: 900 });
  const contributions = await page.evaluate(async id => (await D.lister('notes', { consultation_id: id })).map(n => [n.analyste_nom, n.note, n.statut]), cid);
  ok(contributions.length === 2 && contributions.some(x => x[0] === 'Camille Morel' && x[1] === 8) && contributions.some(x => x[0] === 'Sacha Leroy' && x[1] === 6), 'deux contributions individuelles enregistrées, chacune au nom de son auteur (Camille Morel 8/10, Sacha Leroy 6/10)');
  ok((await tenter("const n = (await D.lister('notes', { consultation_id: '" + cid + "' })).find(x => x.analyste_nom === 'Camille Morel'); await D.modifier('notes', n.id, { note: 2 });")).includes('Seul l\'auteur'),'règle vérifiée : un analyste ne peut pas modifier la contribution d\'un autre');
  await connecter('valideur'); await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée');
  await clic('Exemple Bassin Bleu Services', { pres: 'Offre analysée', dans: '.actions' }); await pause(500);
  ok(await present('2 contributions'), 'le valideur voit les deux contributions sur le critère');
  await capture('analyse-deux-contributions-sur-un-critere', { element: ['.bloc-critere', 'Valeur technique'] });
  for (let k = 0; k < 2; k++) await clic('Valider cette note', { exact: true, attente: 900 });
  ok(await present('Note consolidée : 7 / 10 (moyenne de 2 contributions validées)'), 'note consolidée affichée : moyenne des deux contributions validées, 7 / 10');
  await capture('analyse-note-consolidee-moyenne-des-contributions', { element: ['.bloc-critere', 'Valeur technique'] });
  for (const c of CANDIDATS) { const oid = await idOffre(cid, c.nom); await aller('/consultation/' + cid + '/offre/' + oid, 'Offre financière'); await clic('Valider le montant'); if (await present('Écart constaté') || await page.evaluate(() => !!document.querySelector('.modale'))) await clic('Confirmer', { exact: true }); await attendre('Rouvrir le montant'); }
  const calc = await page.evaluate(async id => { const l = (await D.lister('lots', { consultation_id: id }))[0]; const d = await Ecrans.donneesLot(l); const o = d.offres.find(x => x.candidat.includes('Bassin')); const ligne = d.calcul.lignes.find(x => x.offre_id === o.id); const k = d.criteres.find(x => x.code === '2'); return { points: ligne.detail[k.id].points, brute: ligne.detail[k.id].brute }; }, cid);
  ok(calc.brute === 7 && calc.points === 42, 'calcul : (8 + 6) ÷ 2 = 7 ; 7 ÷ 10 × 60 = 42 points pour la valeur technique');
  await aller('/consultation/' + cid + '/analyse?vue=synthese', 'Contrôle des calculs');
  ok(await present('(8 + 6) ÷ 2 = 7') && await present('Saisie : Camille Morel') && await present('Saisie : Sacha Leroy'), 'contrôle des calculs : moyenne détaillée et auteur de chaque contribution validée');
  await page.evaluate(() => [...document.querySelectorAll('h2')].find(x => x.textContent.startsWith('Contrôle des calculs')).scrollIntoView());
  await capture('analyse-controle-des-calculs-deux-analystes', { element: ['.carte', 'Chaque point attribué est recalculable'] });
  const hist = await page.evaluate(async id => (await D.lister('notes_historique', { consultation_id: id })).map(x => x.auteur_nom), cid);
  ok(hist.includes('Camille Morel') && hist.includes('Sacha Leroy'), 'historique conservé pour chaque contribution individuelle (notes_historique)');

  titre('Négociation : tour, montant avant et après le tour, décision tracée ; refus en appel d\'offres');
  await connecter('gestionnaire'); await aller('/consultation/' + cid + '/offre/' + oCilaos, 'Demandes adressées à ce candidat');
  await clic('Nouvelle demande'); await remplir('Nature', 'Négociation'); await remplir('Objet de la demande', 'Négociation sur le forfait d\'astreinte et sur le délai de remise du rapport de visite.'); await remplir('Tour de négociation', 1); await remplir('Réponse attendue', '2026-11-27'); await valider(); await pause(500);
  await clic('Saisir la réponse'); await remplir('Le candidat a-t-il répondu', 'oui'); await remplir('Réponse reçue', 'Le candidat ramène le forfait d\'astreinte à 1 000 € par mois et remet le rapport sous 24 heures.'); await remplir('Montant proposé', 90600); await valider(); await pause(500);
  await connecter('valideur'); await aller('/consultation/' + cid + '/offre/' + oCilaos, 'Demandes adressées à ce candidat');
  await clic('Décider', { pres: 'Tour n° 1', dans: 'tr', exact: true }); await remplir('Décision prise', 'Proposition du tour 1 retenue : offre négociée à enregistrer et à valider.'); await valider(); await pause(500);
  const dn = await page.evaluate(async id => (await D.lister('demandes', { consultation_id: id })).find(x => x.type === 'negociation'), cid);
  ok(dn && dn.tour === 1 && dn.montant_initial === 93000 && dn.montant_propose === 90600 && dn.decision_par_nom === 'Dominique Vidal', 'tour 1 tracé : montant avant le tour 93 000 €, montant proposé 90 600 €, décision nominative du valideur');
  const jn = await page.evaluate(async id => (await D.lister('journal', { consultation_id: id })).filter(l => /Négociation|demande au candidat|Réponse du candidat/i.test(l.action)).map(l => l.action), cid);
  ok(jn.some(a => a.includes('Négociation (tour 1)')) && jn.some(a => a.includes('Réponse du candidat')) && jn.some(a => a.includes('Décision sur une demande')), 'journal : envoi du tour 1, réponse et décision inscrits');
  await aller('/consultation/' + cid + '/offres', 'Négociations');
  ok(await present('-2,6 %'), 'suivi des négociations : écart de -2,6 % entre le montant avant le tour et le montant proposé');
  await capture('analyse-negociation-tours-et-montants', { element: ['.carte', 'Chaque tour est une demande tracée'] });
  // consultation en appel d'offres ouvert : la négociation est refusée
  await connecter('gestionnaire');
  const ao = await page.evaluate(async () => { const c = await D.creer('consultations', { reference: '2026-032', objet: 'Fourniture de mobilier (appel d\'offres)', nature: 'fournitures', procedure: 'Appel d\'offres ouvert', type_marche: 'Marché ordinaire à prix forfaitaire', montant_estime: 250000, statut: 'analyse', date_limite_offres: '2026-11-10', service: 'Direction de la commande publique' }, false);
    const l = await D.creer('lots', { consultation_id: c.id, numero: 1, intitule: 'Lot unique', montant_estime: 250000 }, false);
    const o = await D.creer('offres', { consultation_id: c.id, lot_id: l.id, candidat: 'Exemple Vétiver Mobilier', type_offre: 'base', date_depot: '2026-11-09', montant_ht: 240000, montant_valide: false, candidature_statut: 'a_examiner', ecartee: false }, false);
    return { c: c.id, o: o.id }; });
  await aller('/consultation/' + ao.c + '/offre/' + ao.o, 'Demandes adressées à ce candidat');
  await clic('Nouvelle demande'); await remplir('Nature', 'Négociation'); await remplir('Objet de la demande', 'Baisse du prix unitaire des bureaux.'); await remplir('Tour de négociation', 1);
  const refus = await soumettre();
  ok(/Négociation impossible : Appel d'offres/.test(refus), 'appel d\'offres ouvert : la demande de négociation est refusée par l\'application (« ' + refus.trim().slice(0, 80) + '… »)');
  await capture('analyse-negociation-refusee-en-appel-d-offres', { entier: false });
  await fermerModale(); await pause(300);
  ok((await tenter("await D.creer('demandes', { consultation_id: '" + ao.c + "', offre_id: '" + ao.o + "', type: 'precision', objet: 'Préciser la teneur de l\\'offre', statut: 'envoyee' }, false);")) === 'accepté', 'appel d\'offres : une demande de précisions reste possible');

  titre('Support : trois canaux de déclaration ; demande reçue par courriel, P1 pris en charge en 1 heure');
  await aller('/support', 'Comment déclarer une demande');
  ok(await present('contact@lentreprise.ai') && await present('Téléphone d\'astreinte') && await present('prise en charge en 1 heure'), 'écran des demandes : portail, courriel (adresse affichée à tous les agents) et téléphone d\'astreinte pour les P1');
  ok(await page.evaluate(() => [...document.querySelectorAll('tr')].some(r => r.innerText.startsWith('P1') && r.innerText.includes('1 heure'))), 'tableau des délais : P1, prise en charge en 1 heure');
  await capture('support-canaux-de-declaration-et-delais');
  await connecter('support'); await aller('/support', 'Enregistrer une demande reçue par courriel');
  await clic('Enregistrer une demande reçue par courriel ou téléphone'); await remplir('Canal', 'courriel'); await remplir('Nom du demandeur', 'Camille Morel'); await remplir('Adresse courriel ou numéro', 'gestionnaire@demo.example');
  await remplir('Service du demandeur', 'Direction de la commande publique'); await remplir('Objet', 'Connexion impossible pour tous les agents depuis 9 h'); await remplir('Criticité', 'P1'); await remplir('Contenu du courriel', 'Message de connexion refusée pour tous les comptes ; aucune analyse ne peut avancer.');
  await valider('Enregistrer la demande'); await attendre('Demande reçue par courriel');
  const tk = await page.evaluate(async () => (await D.lister('tickets')).find(t => t.origine === 'courriel'));
  const ecartMin = (new Date(tk.echeances.prise_en_charge) - new Date(tk.date_reception)) / 60000;
  ok(tk && tk.demandeur_id === 'u-gest' && ecartMin === 60, 'demande ' + tk.numero + ' reçue par courriel : enregistrée par le support, rattachée au compte de l\'agent, échéance de prise en charge à réception + 60 minutes');
  await capture('support-demande-recue-par-courriel-p1');
  await connecter('gestionnaire'); await aller('/notifications', 'Vos notifications');
  ok(await present('Votre demande reçue par courriel est enregistrée'), 'l\'agent est notifié dans l\'application de l\'enregistrement de sa demande');

  ok(erreurs.length === 0, 'aucune erreur JavaScript pendant le scénario' + (erreurs.length ? ' : ' + erreurs.join(' | ') : ''));
  const bilan = ['Scénario complémentaire du module d\'analyse — ' + new Date().toISOString(), constats.length + ' vérifications réussies, ' + fichiersCaptures.length + ' captures, 0 erreur JavaScript.', '', ...constats.map(x => '✓ ' + x), '', 'Captures :', ...fichiersCaptures];
  fs.writeFileSync(path.join(CAPTURES, 'resultat-scenario-analyse.txt'), bilan.join('\n') + '\n');
  console.log('\n' + bilan[1]);
} catch (e) {
  console.error('\n' + e.message); await page.screenshot({ path: path.join(CAPTURES, 'ECHEC-analyse.png'), fullPage: true }).catch(() => {});
  if (erreurs.length) console.error('Erreurs JavaScript : ' + erreurs.join(' | '));
  process.exitCode = 1;
} finally { await navigateur.close(); serveur.close(); }
