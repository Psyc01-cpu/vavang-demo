// Scénario complet joué dans un vrai navigateur (Edge ou Chrome sans interface), avec quatre comptes de profils différents.
// Il fabrique des plis fictifs, déroule l'analyse de bout en bout, vérifie les calculs et les règles, et enregistre les captures d'écran.
//   node tests/scenario.mjs
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
import { demarrer } from './serveur.mjs';
import crypto from 'node:crypto';
// Calcul TOTP indépendant de l'application (RFC 6238), pour jouer le rôle du téléphone de l'administrateur.
const deBase32 = s => { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0, v = 0; const out = []; for (const ch of s.replace(/\s/g, '')) { v = (v << 5) | A.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = secret => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const hm = crypto.createHmac('sha1', deBase32(secret)).update(b).digest(); const o = hm[19] & 15; return String((hm.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0'); };
let secretAdmin = null;
const require = createRequire(import.meta.url); const XLSX = require('xlsx'); const docx = require('docx');
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURES = path.join(racine, 'captures'), PLIS = path.join(racine, 'demo', 'plis'), EXPORTS = path.join(CAPTURES, 'exports');
for (const d of [CAPTURES, PLIS, EXPORTS]) fs.mkdirSync(d, { recursive: true });
// Seules les captures du scénario (01 à 69) sont effacées : les 70 et suivantes viennent d'autres tests (en-ligne.mjs).
for (const f of fs.readdirSync(CAPTURES)) if (/^(0[1-9]|[1-6]\d)-.*\.png$/.test(f)) fs.unlinkSync(path.join(CAPTURES, f));
for (const f of fs.readdirSync(EXPORTS)) fs.unlinkSync(path.join(EXPORTS, f));
const PORT = Number(process.env.PORT_TEST) || 4174, URL = 'http://127.0.0.1:' + PORT + '/';
const MDP = 'Demonstration-2026';
const nav = (process.env.NAVIGATEUR ? [process.env.NAVIGATEUR] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']).find(p => fs.existsSync(p));
const pause = ms => new Promise(r => setTimeout(r, ms));
let etape = 0; const constats = [];
const ok = (cond, texte) => { if (!cond) throw new Error('ÉCHEC — ' + texte); constats.push(texte); console.log('   ✓ ' + texte); };
const titre = t => console.log('\n' + (++etape) + '. ' + t);

const serveur = await demarrer(PORT);
const navigateur = await puppeteer.launch({ executablePath: nav, headless: true, args: ['--window-size=1440,960', '--lang=fr-FR'] });
const page = await navigateur.newPage(); await page.setViewport({ width: 1440, height: 960 });
const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: EXPORTS });
const erreurs = []; page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) erreurs.push('console: ' + m.text()); });

/* ---------- Fabrication des plis fictifs ---------- */
async function pdf(fichier, html) { const p = await navigateur.newPage(); await p.setContent('<html><body style="font-family:Georgia,serif;font-size:12pt;line-height:1.5;margin:40px">' + html + '</body></html>'); await p.pdf({ path: fichier, format: 'A4' }); await p.close(); }
const CANDIDATS = [
  { nom: 'Exemple Jamrosat Ascenseurs', court: 'Jamrosat', montant: 98400, lignes: [[24, 2600], [24, 1000], [1, 12000]], notes: [8, 9], dc2: true,
    moyens: 'Trois techniciens ascensoristes habilités sont affectés au marché, dont un référent unique. Un stock de pièces détachées est constitué sur l\'île pour les douze appareils du périmètre.', delai: 'Délai d\'intervention sur panne : 2 heures en journée. Désincarcération de personnes bloquées : 45 minutes, 24 heures sur 24.' },
  { nom: 'Exemple Letchi Maintenance', court: 'Letchi', montant: 112000, lignes: [[24, 3000], [24, 1200], [1, 11200]], notes: [7, 6], dc2: true,
    moyens: 'Deux techniciens interviennent sur le marché. Les pièces détachées sont commandées auprès du fabricant, avec un délai d\'approvisionnement de dix jours.', delai: 'Délai d\'intervention sur panne : 4 heures en journée. Désincarcération de personnes bloquées : 1 heure, 24 heures sur 24.' },
  { nom: 'Exemple Zévi Levage', court: 'Zevi', montant: 61500, lignes: [[24, 1500], [24, 700], [1, 8200]], notes: [5, 4], dc2: false,
    moyens: 'Un technicien polyvalent assure les visites. Les pièces sont approvisionnées à la demande.', delai: 'Délai d\'intervention sur panne : 8 heures ouvrées. Désincarcération de personnes bloquées : 2 heures.' }];
async function fabriquerPlis() {
  for (const c of CANDIDATS) {
    const d = path.join(PLIS, c.court); fs.mkdirSync(d, { recursive: true }); c.fichiers = [];
    const f = n => { const p = path.join(d, n); c.fichiers.push(p); return p; };
    await pdf(f('Memoire_technique_' + c.court + '.pdf'), '<h1>Mémoire technique</h1><p><b>' + c.nom + '</b> (société fictive)</p><p>Consultation : maintenance des ascenseurs des bâtiments communautaires — lot 1</p><h2>1. Organisation et moyens</h2><p>' + c.moyens + '</p><p>Chaque visite donne lieu à un rapport remis sous 48 heures et consigné dans le carnet d\'entretien de l\'appareil.</p><div style="page-break-after:always"></div><h2>2. Délais d\'intervention</h2><p>' + c.delai + '</p><p>Un numéro d\'appel unique est mis à la disposition de l\'acheteur.</p><div style="page-break-after:always"></div><h2>3. Démarche environnementale</h2><p>Les huiles et pièces usagées sont reprises et remises à une filière de traitement agréée.</p>');
    await pdf(f('DC1_' + c.court + '.pdf'), '<h1>DC1 — Lettre de candidature</h1><p>Le candidat ' + c.nom + ' (société fictive) présente sa candidature pour le lot 1 de la consultation.</p>');
    if (!c.dc2) c.dc2Tardif = path.join(d, 'DC2_' + c.court + '.pdf');
    await pdf(c.dc2 ? f('DC2_' + c.court + '.pdf') : c.dc2Tardif, '<h1>DC2 — Déclaration du candidat</h1><p>' + c.nom + ' déclare un chiffre d\'affaires moyen fictif et les moyens décrits au mémoire technique.</p>');
    const D = docx; const doc = new D.Document({ sections: [{ children: ['ACTE D\'ENGAGEMENT', c.nom + ' (société fictive)', 'Lot 1 — Maintenance des ascenseurs — secteur nord', 'Le candidat s\'engage à exécuter les prestations pour un montant de ' + c.montant.toLocaleString('fr-FR') + ' euros hors taxes sur la durée du marché.', 'Durée : 24 mois.'].map(t => new D.Paragraph({ children: [new D.TextRun(t)] })) }] });
    fs.writeFileSync(f('Acte_engagement_' + c.court + '.docx'), await D.Packer.toBuffer(doc));
    const wb = XLSX.utils.book_new(); const des = ['Maintenance préventive — visite mensuelle des 12 appareils', 'Astreinte et dépannage — forfait mensuel', 'Pièces et petites réparations — forfait'];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['DPGF — ' + c.nom], [], ['Désignation', 'Unité', 'Quantité', 'Prix unitaire HT', 'Montant HT']].concat(c.lignes.map((l, i) => [des[i], ['visite', 'mois', 'forfait'][i], l[0], l[1], l[0] * l[1]]))), 'DPGF');
    XLSX.writeFile(wb, f('DPGF_' + c.court + '.xlsx'));
    if (!c.dc2) await pdf(f('Attestation_assurance_scan_' + c.court + '.pdf'), '<img style="width:500px;height:300px" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">');
  }
  const csv = ['Numéro;Objet du marché;Titulaire;Montant HT;Date de notification;Date de début;Durée (mois);Service', '2023-M-101;Entretien des climatisations;Exemple Pétrel Climatisation;48 500,00;12/04/2023;01/05/2023;36;Patrimoine', '2023-M-118;Fourniture de vêtements de travail;Exemple Vétiver Textile;22 300,00;03/07/2023;15/07/2023;48;Moyens généraux',
    '2024-M-007;Location de véhicules utilitaires;Exemple Cardinal Mobilité;131 000,00;30/01/2024;01/03/2024;36;Moyens généraux', '2024-M-044;Études géotechniques;;18 900,00;17/06/2024;01/07/2024;12;Patrimoine', '2024-M-052;Contrôles réglementaires;Exemple Paille-en-queue Contrôle;montant à préciser;31/02/2024;01/09/2024;24;Patrimoine'];
  fs.writeFileSync(path.join(PLIS, 'marches_existants.csv'), '\ufeff' + csv.join('\r\n'));
}

/* ---------- Outils de pilotage de la page ---------- */
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
const erreurFormulaire = () => page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); const z = m && m.querySelector('.erreur-formulaire'); return z ? z.textContent : ''; });
const dernierMessage = () => page.evaluate(() => [...document.querySelectorAll('#messages .message')].map(m => m.textContent).pop() || '');
const fermerModale = () => page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); if (m) m.querySelector('.modale-tete button').click(); });
let numero = 0;
async function capture(nom, options = {}) { await pause(350); await page.evaluate(() => { const z = document.getElementById('messages'); if (z) z.replaceChildren(); }); const f = String(++numero).padStart(2, '0') + '-' + nom + '.png'; await page.screenshot({ path: path.join(CAPTURES, f), fullPage: options.entier !== false }); console.log('   📷 ' + f); }
async function aller(chemin, texte) { await page.evaluate(c => { location.hash = c; }, chemin); await pause(500); if (texte) await attendre(texte); }
async function connecter(profil) { if (await page.evaluate(() => !!window.D && !!D.utilisateur)) { await clic('Se déconnecter'); await attendre('Connexion'); }
  await remplir('Adresse électronique', profil + '@demo.example'); await remplir('Mot de passe', MDP); await clic('Se connecter', { attente: 900 });
  await page.waitForFunction(() => /Tableau de bord|Étape obligatoire|Saisissez le code à 6 chiffres/.test(document.body.innerText), { timeout: 15000 });
  if (await present('Saisissez le code à 6 chiffres')) { await remplir('Code de vérification', totp(secretAdmin)); await clic('Se connecter', { attente: 900 }); }
  else if (await present('Étape obligatoire')) await activerDoubleAuthentification();
  await attendre('Tableau de bord'); }
async function activerDoubleAuthentification() {
  await clic('Activer la double authentification'); await attendre('Vérifier et activer');
  secretAdmin = await page.evaluate(() => document.getElementById('secret-totp').textContent.replace(/\s/g, ''));
  await capture('securite-activation-double-authentification');
  await page.evaluate(c => { const i = document.getElementById('code-totp'); i.value = c; }, totp(secretAdmin)); await clic('Vérifier et activer', { attente: 900 });
  ok(await page.evaluate(async () => (await D.lister('journal')).some(l => l.action === 'Activation de la double authentification')), "double authentification imposée au premier accès de l'administrateur : code QR, clé, vérification d'un code TOTP");
}
const telechargement = async () => { await pause(900); return page.evaluate(() => window.__dernierTelechargement); };
const tenter = code => page.evaluate(async c => { try { await (new Function('return (async () => {' + c + '})()'))(); return 'accepté'; } catch (e) { return 'refusé : ' + e.message; } }, code);

/* =================================================================== */
try {
  console.log('Navigateur : ' + nav); await fabriquerPlis(); console.log('Plis fictifs fabriqués dans demo/plis');
  await page.goto(URL, { waitUntil: 'networkidle0' }); await page.evaluate(async () => { indexedDB.deleteDatabase('logiciel-acheteur'); sessionStorage.clear(); }); await page.goto(URL, { waitUntil: 'networkidle0' }); await attendre('Connexion');
  await pause(1200); await capture('page-d-accueil');
  ok(await present('Contacter le support') && await present('Préparer le besoin') && await present('À la une'), "page d'accueil : onglets, support, annonces et actualités affichés avant connexion");
  await clic('?', { exact: true }); await attendre('Comptes de démonstration'); await capture('page-d-accueil-aide-connexion', { entier: false }); await clic('✕', { exact: true });
  await page.evaluate(() => { location.hash = '/info/r-analyser'; }); await attendre('Avant les plis'); await capture('page-d-accueil-rubrique', { entier: false }); await page.evaluate(() => { location.hash = '/'; }); await attendre('Connexion');

  titre('Socle — administrateur : comptes, habilitations, paramètres');
  await connecter('admin'); await aller('/admin', 'Habilitations par profil'); await capture('utilisateurs-et-habilitations');
  await clic('Nouvel utilisateur'); await remplir('Nom affiché', 'Morgan Texier'); await remplir('Adresse électronique', 'morgan.texier@demo.example'); await remplir('Profil', 'Service prescripteur'); await remplir('Service', 'Direction du patrimoine'); await remplir('Mot de passe initial', 'Patrimoine-2026-x'); await valider(); await attendre('Morgan Texier');
  ok(await present('morgan.texier@demo.example'), 'création d\'un compte nominatif avec son profil');
  ok((await tenter("await D.modifier('profils', D.utilisateur.id, { actif: false })")).startsWith('refusé'), 'un administrateur ne peut pas désactiver son propre compte');
  await aller('/parametres', 'Seuils de procédure'); await capture('parametres-seuils');
  await aller('/accueil-admin', 'Annonces qui défilent'); await clic('Nouvelle annonce'); await remplir('Surtitre', 'Collectivité'); await remplir('Couleur', 'Braise'); await remplir('Titre', 'Fermeture des services le 20 décembre'); await remplir('Texte', 'Les plis restent déposables sur la plateforme de dématérialisation.'); await valider(); await attendre('Fermeture des services le 20 décembre');
  await capture('administration-page-d-accueil');
  ok(await page.evaluate(async () => (await D.lister('annonces', { type: 'carrousel' })).some(a => a.titre.startsWith('Fermeture') && a.actif)), "l'administrateur publie une annonce sur la page d'accueil, tracée au journal");

  titre('Sécurité : double authentification, verrouillage après échecs, déconnexion après inactivité, journal de sécurité');
  await clic('Se déconnecter'); await attendre('Connexion');
  await remplir('Adresse électronique', 'admin@demo.example'); await remplir('Mot de passe', MDP); await clic('Se connecter', { attente: 900 }); await attendre('Saisissez le code à 6 chiffres');
  await capture('connexion-code-de-double-authentification', { entier: false });
  await remplir('Code de vérification', '000000'); await clic('Se connecter', { attente: 700 }); ok(await present('Code de vérification incorrect'), 'un code de double authentification faux est refusé');
  await remplir('Code de vérification', totp(secretAdmin)); await clic('Se connecter', { attente: 900 }); await attendre('Tableau de bord'); ok(true, "connexion de l'administrateur avec mot de passe et code TOTP");
  await clic('Se déconnecter'); await attendre('Connexion');
  for (let k = 0; k < 5; k++) { await remplir('Adresse électronique', 'prescripteur@demo.example'); await remplir('Mot de passe', 'mauvais-mot-de-passe'); await clic('Se connecter', { attente: 400 }); }
  ok(await present('le compte est verrouillé pendant 15 minutes'), 'compte verrouillé après 5 échecs de connexion (seuil paramétrable)');
  await remplir('Mot de passe', MDP); await clic('Se connecter', { attente: 500 }); ok(await present('Compte verrouillé'), 'même avec le bon mot de passe, le compte verrouillé reste refusé');
  await capture('connexion-compte-verrouille', { entier: false });
  await connecter('admin'); await aller('/admin', 'Habilitations par profil'); ok(await present('Verrouillé jusqu'), "l'administrateur voit le compte verrouillé"); await capture('utilisateurs-securite-des-comptes');
  await clic('Déverrouiller', { pres: 'prescripteur@demo.example', dans: 'tr' }); await pause(600); ok(!(await present('Verrouillé jusqu')), "déverrouillage du compte par l'administrateur, tracé");
  await page.evaluate(() => window.__simulerInactivite(16)); await attendre('Session fermée après 15 minutes'); ok(true, 'déconnexion automatique après 15 minutes sans activité (durée paramétrable)');
  await connecter('admin'); await aller('/journal?securite=1', 'Journal des actions'); await capture('journal-de-securite', { entier: false });
  ok(await present('Compte verrouillé après 5 échecs') && await present('Déverrouillage d\'un compte') && await present('Déconnexion automatique') && await present('Activation de la double authentification'), 'journal de sécurité : verrouillage, déverrouillage, double authentification, déconnexion automatique, échecs de connexion');

  titre('Gestionnaire : tableau de bord, besoins, création de la consultation et des lots');
  await connecter('gestionnaire'); await capture('tableau-de-bord');
  await aller('/besoins', 'Computation des seuils'); await capture('besoins-et-computation-des-seuils');
  await clic('Recenser un besoin'); await remplir('Objet du besoin', 'Maintenance des ascenseurs des bâtiments communautaires'); await remplir('Service prescripteur', 'Direction du patrimoine'); await remplir('Nature', 'Services'); await remplir('Famille homogène', 'Maintenance des ascenseurs'); await remplir('Montant estimé', 180000); await remplir('Durée', 24); await remplir('Besoin récurrent', true); await valider(); await attendre('Maintenance des ascenseurs');
  await clic('Choisir la procédure', { pres: 'Maintenance des ascenseurs des bâtiments' }); await capture('aide-au-choix-de-procedure', { entier: false });
  await remplir('Procédure retenue', 'Procédure adaptée (MAPA)'); await remplir('Type de marché', 'Marché ordinaire à prix forfaitaire'); await valider(); await pause(500);
  await clic('Créer la consultation', { pres: 'Maintenance des ascenseurs des bâtiments' }); await remplir('Référence', '2026-021'); await remplir('Date limite de remise des offres', '2026-11-10'); await valider('Créer la consultation'); await attendre('Habilitations sur ce dossier');
  const cid = await page.evaluate(() => location.hash.split('/')[2]);
  await clic('Modifier', { pres: 'Lot unique', dans: 'tr' }); await remplir('Intitulé du lot', 'Bâtiments du secteur nord'); await remplir('Montant estimé', 105000); await valider(); await pause(400);
  await clic('Ajouter un lot'); await remplir('Intitulé du lot', 'Bâtiments du secteur est'); await remplir('Montant estimé', 75000); await valider(); await attendre('Bâtiments du secteur est');
  for (const a of [['Dominique Vidal', 'Valideur'], ['Claude Besson', 'Lecteur'], ['Sacha Leroy', 'Analyste']]) { await clic('Affecter un agent'); await remplir('Agent', a[0]); await remplir('Fonction sur le dossier', a[1]); if (a[0] === 'Sacha Leroy') await remplir('Périmètre', 'Lot 2 seulement'); await valider(); await pause(400); }
  ok(await present('Lot 2 seulement'), 'habilitation sur dossier limitée à un lot (Sacha Leroy, analyste du lot 2 seulement)');
  ok(await present('Bâtiments du secteur est') && await present('Claude Besson'), 'consultation 2026-021 créée depuis le besoin, avec deux lots et trois agents habilités sur le dossier');
  await capture('consultation-fiche-lots-habilitations');

  await clic('Passer à l\'étape « Publiée »'); await clic('Confirmer', { exact: true }); await attendre('Passer à l\'étape « Analyse en cours »');

  titre('Gestionnaire : paramétrage de la grille, contrôle du total des pondérations');
  await aller('/consultation/' + cid + '/analyse', 'Critères, sous-critères et pondérations');
  const critere = async (code, libelle, nature, pond, bareme, parent, desc) => { await clic('Ajouter un critère'); if (parent) await remplir('Rattaché à', parent); await remplir('Numéro', code); await remplir('Libellé', libelle); await remplir('Nature', nature); await remplir('Pondération', pond); if (bareme) await remplir('Barème', bareme); if (desc) await remplir('Éléments d\'appréciation', desc); await valider(); await attendre(libelle); };
  await critere('1', 'Prix des prestations', 'Critère de prix', 40);
  await critere('2', 'Valeur technique', 'Critère noté', 60, 10);
  await critere('2.1', 'Organisation et moyens affectés', 'Critère noté', 35, 10, 'Valeur technique', 'Équipe, qualifications, stock de pièces, compte rendu des visites.');
  await critere('2.2', 'Délais d\'intervention', 'Critère noté', 20, 10, 'Valeur technique', 'Délais sur panne et pour la désincarcération.');
  ok(await present('la somme des sous-critères fait 55 pour une pondération de 60'), 'incohérence détectée : sous-critères 55 pour 60, verrouillage impossible');
  await capture('grille-controle-de-coherence-en-erreur');
  await clic('Modifier', { pres: 'Délais d\'intervention', dans: 'tr' }); await remplir('Pondération', 25); await valider(); await attendre('la grille est cohérente');
  await clic('Modifier la méthode'); await remplir('Seuil d\'alerte', 30); await valider(); await pause(400);
  ok(await present('Total des pondérations : 100 / 100'), 'grille cohérente : total des pondérations égal à 100');
  ok(!(await present('Verrouiller la grille')), 'le gestionnaire ne voit pas le bouton de verrouillage (réservé au valideur)');
  await clic('Enregistrer comme modèle'); await remplir('Nom du modèle', 'Maintenance — prix 40, technique 60'); await valider(); await pause(400);
  await capture('grille-parametree');

  titre('Valideur : verrouillage de la grille');
  await connecter('valideur'); await aller('/consultation/' + cid + '/analyse', 'Verrouiller la grille');
  await clic('Verrouiller la grille'); await clic('Verrouiller', { exact: true }); await attendre('Grille verrouillée');
  ok(await present('version 1, par Dominique Vidal'), 'grille verrouillée en version 1 par le valideur, horodatée');
  await capture('grille-verrouillee');

  titre('Gestionnaire : import de trois offres avec leurs pièces, pièces manquantes');
  await connecter('gestionnaire'); await aller('/consultation/' + cid, 'Habilitations sur ce dossier'); await clic('Passer à l\'étape « Analyse en cours »'); await clic('Confirmer', { exact: true }); await pause(600);
  ok((await tenter("const c = (await D.lister('criteres', { consultation_id: '" + cid + "' }))[0]; await D.modifier('criteres', c.id, { ponderation: 50 });")).includes('verrouillée'), 'règle vérifiée : une pondération ne peut plus être modifiée après verrouillage');
  await aller('/consultation/' + cid + '/offres', 'Tableau comparatif des candidatures');
  for (const c of CANDIDATS) {
    await clic('Déposer une offre'); await remplir('Lot', 'Lot 1'); await remplir('ou nom d\'un nouveau candidat', c.nom); await remplir('Date de dépôt', '2026-11-09'); await remplir('Montant de l\'offre', c.montant);
    const entree = await page.$('.modale input[type=file]'); await entree.uploadFile(...c.fichiers); await valider('Importer le pli'); await attendre('Pièces du pli (' + c.fichiers.length + ')', 30000);
    if (c.court === 'Jamrosat') { await clic('Lire le bordereau déposé'); await clic('Importer', { exact: true }); await attendre('Total recalculé : 98 400,00 €'); ok(await present('Concordant'), 'bordereau XLSX lu : 3 lignes, total recalculé concordant avec le montant déclaré');
      await clic('Contrôler', { pres: 'DC1_Jamrosat.pdf', dans: 'tr' }); await remplir('Résultat du contrôle', 'Conforme'); await remplir('Commentaire', 'Signature et habilitation du signataire vérifiées.'); await valider(); await pause(500);
      ok(await page.evaluate(async () => (await D.lister('pieces', { nom_fichier: 'DC1_Jamrosat.pdf' }))[0].controle === 'conforme'), 'contrôle d\'une pièce par l\'agent enregistré avec son auteur et sa date'); await capture('offre-pieces-et-lignes-de-prix'); }
    if (c.court === 'Zevi') { await clic('Lire le bordereau déposé'); await clic('Importer', { exact: true }); await attendre('à vérifier'); ok(await present('Pièce obligatoire absente : DC2') && await present('Texte non lisible automatiquement'), 'pli incomplet : DC2 absent et document scanné signalés, à vérifier'); ok(await present('Écart de'), 'écart entre le total recalculé (61 000 €) et le montant déclaré (61 500 €) signalé');
      await clic('Enregistrer un constat'); await remplir('Constat', 'Candidature à compléter'); await remplir('Observations', 'DC2 absent du pli.'); await valider(); await pause(400);
      await clic('Nouvelle demande'); await remplir('Nature', 'Demande de complément'); await remplir('Objet de la demande', 'Produire le formulaire DC2.'); await remplir('Réponse attendue', '2026-11-25'); await valider(); await pause(400); await capture('offre-incomplete-signalements'); }
    await aller('/consultation/' + cid + '/offres', 'Tableau comparatif des candidatures');
  }
  ok(await present('Exemple Zévi Levage') && await present('Absente'), 'trois offres importées ; tableau comparatif des candidatures avec la pièce absente');
  await page.evaluate(() => { const i = document.querySelector('input[type=search]'); i.value = 'désincarcération'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await attendre('passage(s) trouvé(s)');
  ok(await present('3 passage(s) trouvé(s)'), 'recherche plein texte dans les pièces : 3 passages trouvés dans les 3 mémoires PDF');
  await capture('candidatures-tableau-comparatif-et-recherche');
  await page.evaluate(() => [...document.querySelectorAll('tr.cliquable')].find(r => r.innerText.includes('Memoire_technique_Letchi.pdf')).click()); await attendre('Annoter la sélection');
  ok(await page.evaluate(() => !!document.querySelector('.modale .pages mark')), 'ouverture de la pièce à la page trouvée, terme recherché surligné');
  await page.evaluate(() => { const d = document.querySelector('.modale .pages [data-page="2"]'); const r = document.createRange(); r.selectNodeContents(d); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await clic('Annoter la sélection'); await remplir('Commentaire interne', 'Délai de désincarcération à comparer avec les autres offres.'); await remplir('Marquer comme signet', true); await valider(); await attendre('Annotations et signets (1)');
  ok(await page.evaluate(async () => { const a = await D.lister('annotations'); return a.length === 1 && a[0].page === 2 && a[0].signet === true && !!a[0].auteur_nom; }), 'annotation avec signet enregistrée sur la page 2 de la pièce, avec son auteur');
  await fermerModale(); await pause(300);

  titre('Gestionnaire : appréciations et notes par critère, avec renvoi vers un extrait');
  await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée');
  const APP = { Jamrosat: ['Équipe dédiée et qualifiée, référent unique, stock de pièces sur l\'île.', 'Délais très courts, astreinte permanente.'], Letchi: ['Équipe suffisante ; approvisionnement des pièces en dix jours.', 'Délais dans la moyenne.'], Zevi: ['Un seul technicien pour douze appareils : moyens limités.', 'Délais longs, limités aux heures ouvrées pour les pannes.'] };
  for (const c of CANDIDATS) {
    await clic(c.nom, { exact: false, pres: 'Offre analysée', dans: '.actions' }); await pause(500);
    if (c.court === 'Jamrosat') {
      await remplir('Note sur 10', 8, { pres: 'Organisation et moyens affectés' }); await clic('Proposer à la validation', { pres: 'Organisation et moyens affectés', dans: '.bloc-critere' });
      ok((await dernierMessage()).includes('Justifiez la note'), 'une note sans justification ne peut pas être proposée à la validation'); await pause(300);
      await clic('Associer un extrait', { pres: 'Organisation et moyens affectés', dans: '.bloc-critere' }); await clic('Memoire_technique_Jamrosat.pdf'); await attendre('Utiliser la sélection');
      await page.evaluate(() => { const d = document.querySelector('.modale .pages [data-page="1"]'); const n = [...d.childNodes].find(x => x.textContent.includes('Trois techniciens')) || d; const t = n.nodeType === 3 ? n : n.firstChild; const i = t.textContent.indexOf('Trois techniciens'); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, t.textContent.indexOf('référent unique') + 15); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
      await capture('lecteur-de-piece-selection-d-un-extrait', { entier: false });
      await clic('Utiliser la sélection comme extrait'); await attendre('Source : Memoire_technique_Jamrosat.pdf, page 1');
    }
    await remplir('Note sur 10', c.notes[0], { pres: 'Organisation et moyens affectés' }); await remplir('Appréciation', APP[c.court][0], { pres: 'Organisation et moyens affectés' });
    if (c.court === 'Jamrosat') { await remplir('Points forts', 'Référent unique ; stock local de pièces.', { pres: 'Organisation et moyens affectés' }); await capture('saisie-d-une-note-avec-extrait'); }
    await clic('Proposer à la validation', { pres: 'Organisation et moyens affectés', dans: '.bloc-critere', attente: 900 });
    await remplir('Note sur 10', c.notes[1], { pres: '2.2 — Délais' }); await remplir('Appréciation', APP[c.court][1], { pres: '2.2 — Délais' }); await clic('Proposer à la validation', { pres: '2.2 — Délais', dans: '.bloc-critere', attente: 900 });
  }
  ok((await page.evaluate(async id => (await D.lister('notes', { consultation_id: id, statut: 'proposee' })).length, cid)) === 6, 'six notes saisies et proposées à la validation, chacune avec sa justification');
  await aller('/consultation/' + cid + '/analyse?vue=notation&mode=critere', 'Critère comparé'); await capture('comparaison-transversale-par-critere');
  await aller('/consultation/' + cid + '/analyse?vue=prix', 'Signalements sur les prix');
  ok(await present('Exemple Zévi Levage') && await present('À vérifier au titre des offres potentiellement anormalement basses'), 'écart de prix signalé pour l\'offre la plus basse, sans qualification ni rejet');
  ok(await present('Montants des autres offres non validés') || await present('Montant non validé'), 'aucune note de prix tant que les montants ne sont pas validés par un agent habilité');
  await capture('analyse-financiere-signalement-prix-bas');
  await aller('/consultation/' + cid + '/analyse?vue=synthese', 'Tableau d\'analyse et classement provisoire');
  ok(await present('Classement partiel') && !(await present('75,50')), 'avant validation : aucun total, aucun classement');
  await capture('synthese-avant-validation');
  ok((await tenter("const n = (await D.lister('notes', { consultation_id: '" + cid + "' }))[0]; await D.modifier('notes', n.id, { statut: 'validee' });")).startsWith('refusé'), 'règle vérifiée : l\'analyste ne peut pas valider une note');
  await clic('Soumettre l\'analyse à la relecture'); await clic('Soumettre', { exact: true }); await attendre('Analyse soumise à la relecture');

  const zevi = CANDIDATS[2]; const oz = await page.evaluate(async (id, n) => (await D.lister('offres', { consultation_id: id })).find(o => o.candidat === n).id, cid, zevi.nom);
  await aller('/consultation/' + cid + '/offre/' + oz, 'Demandes adressées à ce candidat'); await (await page.$('#contenu label.bouton input[type=file]')).uploadFile(zevi.dc2Tardif); await attendre('Pièces du pli (' + (zevi.fichiers.length + 1) + ')', 30000);
  await clic('Saisir la réponse'); await remplir('Le candidat a-t-il répondu', 'oui'); await remplir('Réponse reçue', 'DC2 transmis par le candidat dans le délai imparti ; pièce versée au pli.'); await valider(); await pause(500);
  ok(!(await present('Pièce obligatoire absente : DC2')), 'réponse à la demande de complément enregistrée : le DC2 versé au pli lève le signalement');

  titre('Valideur : contrôle, renvoi d\'une note, validation des montants et des notes');
  await connecter('valideur'); await capture('tableau-de-bord-valideur-analyse-a-valider');
  ok(await page.evaluate(async () => (await D.lister('notifications', { destinataire_id: D.utilisateur.id })).some(n => n.texte.startsWith('Analyse à valider'))), "le valideur reçoit une notification « Analyse à valider » dans l'application");
  await aller('/consultation/' + cid + '/offre/' + oz, 'Demandes adressées à ce candidat'); await clic('Décider', { pres: 'Demande de complément', dans: 'tr', exact: true }); await remplir('Décision prise', 'Candidature complétée dans le délai : complément accepté.'); await valider(); await pause(500);
  for (const c of CANDIDATS) { const oid = await page.evaluate(async (id, n) => (await D.lister('offres', { consultation_id: id })).find(o => o.candidat === n).id, cid, c.nom);
    await aller('/consultation/' + cid + '/offre/' + oid, 'Offre financière'); await clic('Valider le montant'); if (c.court === 'Zevi') { await clic('Confirmer', { exact: true }); } await attendre('Rouvrir le montant');
    await clic('Décider de l\'admission'); await remplir('Décision', 'Candidature admise'); await valider(); await attendre('Décision : admise'); if (c.court === 'Zevi') await capture('offre-decisions-humaines-tracees'); }
  ok(true, 'trois candidatures admises et trois montants validés par décision nominative du valideur');
  await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée');
  await clic('Exemple Letchi Maintenance', { pres: 'Offre analysée', dans: '.actions' }); await pause(500);
  await clic('Renvoyer à l\'analyste', { pres: '2.2 — Délais', dans: '.bloc-critere' }); await remplir('Commentaire pour l\'analyste', 'La désincarcération en 1 heure 24 h sur 24 mérite d\'être prise en compte : revoir la note.'); await valider(); await pause(500);
  for (const c of CANDIDATS) { await clic(c.nom, { pres: 'Offre analysée', dans: '.actions' }); await pause(500);
    while (await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === 'Valider cette note'))) { await clic('Valider cette note', { exact: true, attente: 900 }); } }
  ok((await page.evaluate(async id => (await D.lister('notes', { consultation_id: id, statut: 'validee' })).length, cid)) === 5, 'cinq notes validées par le valideur, une renvoyée à l\'analyste avec commentaire');
  await capture('validation-des-notes-par-le-valideur');
  await aller('/consultation/' + cid + '/analyse?vue=synthese', 'Tableau d\'analyse');
  ok(await present('Classement partiel') && await present('Exemple Letchi Maintenance : critère(s) 2.2'), 'classement partiel : l\'offre dont une note n\'est pas validée n\'est pas classée');
  await clic('Valider l\'analyse'); ok((await dernierMessage()).includes('doivent être validés'), 'validation de l\'analyse refusée tant qu\'une note n\'est pas validée');
  await capture('synthese-classement-partiel');

  titre('Gestionnaire : correction de la note renvoyée');
  await connecter('gestionnaire'); await aller('/notifications', 'Vos notifications'); ok(await present('Note à revoir'), "l'analyste est notifié de la note renvoyée par le valideur"); await capture('centre-de-notifications');
  await connecter('gestionnaire'); await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée'); await clic('Exemple Letchi Maintenance', { pres: 'Offre analysée', dans: '.actions' }); await attendre('À revoir — commentaire du valideur');
  await remplir('Appréciation', 'Délais sur panne dans la moyenne ; désincarcération en 1 heure, 24 heures sur 24.', { pres: '2.2 — Délais' }); await clic('Proposer à la validation', { pres: '2.2 — Délais', dans: '.bloc-critere', attente: 900 });

  titre('Valideur : validation finale, classement provisoire, contrôle des calculs');
  await connecter('valideur'); await aller('/consultation/' + cid + '/analyse?vue=notation', 'Offre analysée'); await clic('Exemple Letchi Maintenance', { pres: 'Offre analysée', dans: '.actions' }); await pause(500); await clic('Valider cette note', { exact: true, attente: 900 });
  await aller('/consultation/' + cid + '/analyse?vue=synthese', 'Toutes les notes et tous les montants sont validés');
  const totaux = await page.evaluate(async id => { const l = (await D.lister('lots', { consultation_id: id })).find(x => x.numero === 1); const d = await Ecrans.donneesLot(l); return d.calcul.lignes.map(x => [x.candidat, x.total, x.rang, Object.values(x.detail).map(v => v.points)]); }, cid);
  console.log('   calcul :', JSON.stringify(totaux));
  const T = n => totaux.find(x => x[0].includes(n));
  ok(T('Jamrosat')[1] === 75.5 && T('Zévi')[1] === 67.5 && T('Letchi')[1] === 61.46, 'totaux conformes au calcul à la main : 75,50 — 67,50 — 61,46 (prix 40 × 61 500 ÷ montant ; notes ÷ 10 × pondération)');
  ok(T('Jamrosat')[2] === 1 && T('Zévi')[2] === 2 && T('Letchi')[2] === 3, 'classement provisoire : 1er Jamrosat, 2e Zévi, 3e Letchi');
  ok(await present('75,50') && await present('61,46'), 'le tableau affiché porte les mêmes valeurs');
  await clic('Valider l\'analyse'); await clic('Valider', { exact: true }); await attendre('Analyse validée');
  await capture('synthese-classement-provisoire-et-controle-des-calculs');
  ok(await present('Synthèse par candidat') && await present('Points forts relevés') && await present('Référent unique ; stock local de pièces.'), 'synthèse par candidat assemblée sans IA à partir des seules appréciations validées, avec renvoi au critère et à la source');
  await clic('Exporter les synthèses (Word)'); let t = await telechargement(); ok(t && t.nom.startsWith('synthese-candidats') && t.taille > 5000, 'synthèses par candidat exportées en Word');
  await clic('Exporter le tableau (XLSX)'); t = await telechargement(); ok(t && t.nom.endsWith('.xlsx') && t.taille > 3000, 'tableau d\'analyse exporté en XLSX (' + t.taille + ' octets)');

  titre('Gestionnaire : rapport d\'analyse modifiable, export PDF et Word, courrier type');
  await connecter('gestionnaire');
  ok((await tenter("const n = (await D.lister('notes', { consultation_id: '" + cid + "' }))[0]; await D.modifier('notes', n.id, { appreciation: 'x' });")).startsWith('refusé'), 'règle vérifiée : après validation de l\'analyse, les notes sont figées');
  await aller('/consultation/' + cid + '/rapport', 'Versions du rapport'); await clic('Générer le projet de rapport'); await attendre('Rapport — version 1');
  await page.evaluate(() => { const z = [...document.querySelectorAll('.rapport-section textarea')].pop(); z.value = z.value.replace(/\[À compléter[^\]]*\]/, 'Il est proposé à la commission de retenir l\'offre classée première, sous réserve de la vérification des pièces de l\'attributaire pressenti.'); });
  await clic('Enregistrer les modifications'); await attendre('Rapport enregistré');
  ok(await page.evaluate(async id => (await D.lister('rapports', { consultation_id: id }))[0].sections.at(-1).texte.includes('Il est proposé à la commission'), cid), 'projet de rapport généré, modifié à la main et enregistré');
  await capture('rapport-d-analyse-projet-modifiable');
  await clic('Exporter en PDF'); t = await telechargement(); ok(t && t.nom.endsWith('.pdf') && t.taille > 15000, 'rapport exporté en PDF (' + t.taille + ' octets)');
  await clic('Exporter en Word'); t = await telechargement(); ok(t && t.nom.endsWith('.docx') && t.taille > 8000, 'rapport exporté en Word modifiable (' + t.taille + ' octets)');
  await clic('Préparer un courrier'); await remplir('Modèle', 'Information du candidat non retenu'); await remplir('Candidat', 'Exemple Letchi Maintenance'); await valider('Préparer'); await attendre('Projet établi à partir du modèle');
  ok(await page.evaluate(() => document.querySelector('.modale textarea').value.includes('61,46') && document.querySelector('.modale textarea').value.includes('Exemple Jamrosat Ascenseurs')), 'courrier type prérempli avec la note, le rang et l\'attributaire pressenti');
  await capture('courrier-type-prerempli', { entier: false }); await clic('Exporter en Word'); t = await telechargement(); ok(t && t.nom.startsWith('courrier') && t.taille > 5000, 'courrier exporté en Word'); await fermerModale();

  titre('Valideur : validation du rapport');
  await connecter('valideur'); await aller('/consultation/' + cid + '/rapport', 'Rapport — version 1'); await clic('Valider le rapport'); await clic('Valider', { exact: true }); await attendre('Validé par Dominique Vidal');
  ok((await tenter("const r = (await D.lister('rapports', { consultation_id: '" + cid + "' }))[0]; await D.modifier('rapports', r.id, { sections: [] });")).includes('figé'), 'règle vérifiée : un rapport validé est figé');
  await capture('rapport-valide');

  titre('Lecteur / auditeur : accès en lecture, dossier d\'audit');
  await connecter('lecteur'); await aller('/consultations', 'Les dossiers qui vous sont affectés');
  ok(await present('2026-021') && !(await present('Nouvelle consultation')), 'le lecteur ne voit que ses dossiers affectés et n\'a aucun bouton de création');
  await aller('/consultation/' + cid + '/offres', 'Tableau comparatif'); ok(!(await present('Déposer une offre')), 'le lecteur ne peut pas déposer d\'offre');
  ok((await tenter("await D.creer('offres', { consultation_id: '" + cid + "', candidat: 'x' })")).startsWith('refusé'), 'règle vérifiée : écriture refusée au profil lecteur');
  const autre = await page.evaluate(async () => (await D.lister('consultations')).find(c => c.reference.endsWith('-007')).id); await aller('/consultation/' + autre); await attendre('Ce dossier ne vous est pas affecté');
  ok(true, 'accès refusé (et tracé) à un dossier non affecté');
  await aller('/consultation/' + cid + '/audit', 'Restitution du dossier d\'audit'); await capture('dossier-d-audit');
  await clic('Dossier d\'audit (PDF)'); t = await telechargement(); ok(t && t.nom.endsWith('.pdf') && t.taille > 20000, 'dossier d\'audit restitué en PDF (' + t.taille + ' octets)');
  await clic('Archive complète'); await pause(1500); t = await telechargement(); ok(t && t.nom.endsWith('.zip') && t.taille > 100000, 'archive d\'audit avec les pièces sources (' + t.taille + ' octets)');
  await aller('/journal', 'Journal des actions'); await capture('journal-des-actions', { entier: false });
  const j = await page.evaluate(async id => { const l = await D.lister('journal', { consultation_id: id }); return { n: l.length, auteurs: [...new Set(l.map(x => x.auteur_nom))], actions: [...new Set(l.map(x => x.action))].length, complets: l.every(x => x.date && x.auteur_nom && x.action) }; }, cid);
  ok(j.n > 60 && j.auteurs.length >= 3 && j.complets, 'journal du dossier : ' + j.n + ' actions horodatées, ' + j.auteurs.length + ' auteurs, ' + j.actions + ' types d\'action');
  ok((await tenter("const l = (await D.lister('journal'))[0]; await D.modifier('journal', l.id, { action: 'x' });")).startsWith('refusé'), 'règle vérifiée : le journal ne peut pas être modifié');

  titre('Habilitation limitée à un lot');
  await connecter('prescripteur'); await aller('/consultation/' + cid + '/analyse', 'Lot analysé');
  ok(await present('Habilitation limitée : 1 lot(s) sur 2') && !(await present('Lot 1 — Bâtiments du secteur nord')), "l'analyste habilité sur le lot 2 ne voit pas le lot 1");
  ok((await tenter("const l = (await D.lister('lots', { consultation_id: '" + cid + "' })).find(x => x.numero === 1); const o = (await D.lister('offres', { lot_id: l.id }))[0]; const k = (await D.lister('criteres', { lot_id: l.id })).find(x => x.code === '2.1'); await D.creer('notes', { lot_id: l.id, consultation_id: '" + cid + "', offre_id: o.id, critere_id: k.id, analyste_id: D.utilisateur.id, note: 5, statut: 'brouillon' });")).includes('Ce lot ne vous est pas affecté'), 'règle vérifiée : saisie refusée sur un lot non affecté');
  await capture('habilitation-limitee-a-un-lot', { entier: false });

  titre('Paramétrage : circuit de validation du DCE et critères d\'évaluation');
  await connecter('admin'); await aller('/parametres', 'Circuit de validation du dossier de consultation');
  await clic('Ajouter une étape'); await remplir('Nom de l\'étape', 'Visa juridique'); await remplir('Habilitation requise', 'Relire les documents du DCE'); await remplir('Position', 'Avant « Validation »'); await valider(); await attendre('Visa juridique');
  await clic('Ajouter un critère'); await remplir('Critère', 'Qualité des rapports de visite'); await remplir('Coefficient', 2); await valider(); await attendre('Qualité des rapports de visite');
  await capture('parametres-circuit-criteres-securite');
  ok(await page.evaluate(async () => (await D.circuitDce()).map(e => e.libelle).join(' > ') === 'Relecture > Visa juridique > Validation'), "circuit paramétré par l'administrateur : Relecture > Visa juridique > Validation");

  titre('DCE : modèle, versions, circuit paramétré rédaction → relecture → visa → validation → publication');
  await connecter('gestionnaire'); await aller('/consultation/' + cid + '/dce', 'Contrôle de complétude du dossier');
  await clic('Nouveau document'); await remplir('Type de document', 'Règlement de la consultation'); await remplir('Modèle', 'Règlement de la consultation — procédure adaptée'); await valider('Créer'); await attendre('Circuit de validation');
  ok(await page.evaluate(() => document.querySelector('textarea').value.includes('2026-021') && document.querySelector('textarea').value.includes('Organisation et moyens affectés : 35 points')), 'document généré depuis le modèle : référence, lots et critères de la grille repris automatiquement');
  ok(await present('passage(s) « [à compléter] » restant(s)'), 'contrôle automatique : passage à compléter signalé');
  await clic('Insérer une clause'); await capture('dce-bibliotheque-de-clauses', { entier: false }); await clic('Insérer', { pres: 'offres anormalement basses', dans: '.bloc-critere', exact: true });
  await page.evaluate(() => { const z = document.querySelector('textarea'); z.value = z.value.replace(/\[à compléter[^\]]*\]/, 'Les questions sont posées sur le profil d\'acheteur au plus tard dix jours avant la date limite.'); });
  await clic('Enregistrer (nouvelle version)'); await remplir('Nature des modifications', 'Ajout de la clause sur les offres anormalement basses ; article 6 complété'); await valider(); await attendre('v2');
  await capture('dce-document-versions-et-circuit');
  await clic('Soumettre (Relecture)'); await attendre('Soumis à : Relecture');
  await connecter('valideur'); const did = await page.evaluate(async id => (await D.lister('documents_dce', { consultation_id: id }))[0].id, cid);
  ok(await page.evaluate(async () => (await D.lister('notifications', { destinataire_id: D.utilisateur.id })).some(n => n.texte.startsWith('Document à traiter (Relecture)'))), "le relecteur est notifié dans l'application");
  await aller('/consultation/' + cid + '/dce/' + did, 'Approuver (Relecture)'); await clic('Approuver (Relecture)'); await attendre('Relecture : approuvé');
  await clic('Approuver (Visa juridique)'); await attendre('Visa juridique : approuvé'); await capture('dce-circuit-parametre-en-cours'); await clic('Approuver (Validation)'); await attendre('document validé');
  await connecter('gestionnaire'); await aller('/consultation/' + cid + '/dce/' + did, 'Marquer comme publié'); await clic('Marquer comme publié'); await clic('Marquer publié', { exact: true }); await attendre('Document publié');
  ok(await page.evaluate(async id => (await D.lister('validations', { objet_id: id })).length === 5, did), 'circuit paramétré complet tracé : soumis, relu, visa juridique, validé, publié — cinq étapes nominatives et horodatées');
  await clic('Word'); t = await telechargement(); ok(t && t.nom.endsWith('.docx'), 'document du DCE exporté en Word');
  await aller('/consultation/' + cid + '/dce', 'Contrôle de complétude'); await capture('dce-controle-de-completude');
  await aller('/modeles', 'Documents du DCE'); await capture('modeles-de-documents'); await aller('/modeles?type=grille', 'Modèles de grilles'); ok(await present('Maintenance — prix 40, technique 60'), 'modèle de grille réutilisable enregistré avec version, date d\'effet et auteur'); await capture('modeles-de-grilles');

  titre('Exécution : marché, bon de commande, avenant, reconduction, échéances');
  await aller('/marches', 'Marchés en exécution'); await capture('marches-en-execution');
  await clic('Nouveau marché'); await remplir('Numéro du marché', '2026-M-021'); await remplir('Objet', 'Maintenance des ascenseurs — secteur nord'); await remplir('Titulaire', 'Exemple Jamrosat Ascenseurs'); await remplir('Montant notifié', 98400); await remplir('Montant maximum', 20000); await remplir('Date de début', '2026-12-01'); await remplir('Durée initiale', 24); await remplir('Marché reconductible', true); await remplir('Nombre de reconductions', 1); await remplir('Durée de chaque reconduction', 12);
  await remplir('Part fixe', 0.15); await remplir('Indice de référence', 'Indice de la maintenance (valeurs fictives)'); await remplir('Valeur de l\'indice au mois zéro', 108.2); await remplir('Mois zéro', 'novembre 2026'); await valider(); await attendre('2026-M-021');
  await page.evaluate(() => [...document.querySelectorAll('tr.cliquable')].find(r => r.innerText.includes('2026-M-021')).click()); await attendre('Événements d\'exécution');
  const ev = async (bouton, objet, montant) => { await clic('+ ' + bouton); await remplir('Objet', objet); if (montant != null) await remplir('Montant', montant); await valider(); await attendre(objet); };
  await ev('Ordre de service', 'Démarrage des prestations au 1er décembre 2026'); await ev('Bon de commande', 'Remplacement d\'une carte de commande', 4200); await ev('Avenant', 'Ajout d\'un appareil au périmètre', 3900); await clic('+ Révision de prix'); await remplir('Objet', 'Révision annuelle'); await remplir('Valeur de l\'indice retenue', 112.4); await remplir('Mois de l\'indice', 'novembre 2027'); await remplir('Montant HT soumis', 49200); await valider(); await attendre('Révision annuelle');
  ok(await present('= 1,033') && await present('50 823,60 €') && await present('1 623,60 €'), 'révision des prix par formule : C = 0,15 + 0,85 × 112,4 / 108,2 = 1,033 (millième supérieur) ; 49 200 € révisés à 50 823,60 €, incidence 1 623,60 €');
  ok(await present('102 300,00 €') || await present('102,3 k€'), 'montant actuel recalculé avec l\'avenant (98 400 + 3 900 = 102 300 €)');
  ok(await present('Décision de reconduction à prendre') && await present('01/12/2028'), 'échéances calculées : fin de période au 01/12/2028 et décision de reconduction');
  await capture('marche-suivi-d-execution');

  titre('Fournisseurs et évaluation des titulaires');
  await aller('/fournisseurs', 'Fournisseurs'); await capture('fournisseurs');
  await page.evaluate(() => [...document.querySelectorAll('tr.cliquable')].find(r => r.innerText.includes('Exemple Jamrosat')).click()); await attendre('Historique des candidatures');
  await clic('Ajouter un échange'); await remplir('Nature', 'Échange en cours de marché'); await remplir('Compte rendu factuel', 'Réunion de lancement tenue ; planning des visites remis.'); await valider(); await attendre('Réunion de lancement'); await capture('fiche-fournisseur-historique');
  await aller('/evaluations', 'Évaluations des titulaires'); await clic('Nouvelle évaluation');
  await page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); const s = m.querySelectorAll('select'); const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set(s[0], [...s[0].options].find(o => o.text.includes('2026-M-021')).value); [4, 5, 4, 4, 3, 5].forEach((n, i) => set(s[i + 1], String(n))); const t = m.querySelectorAll('textarea'); const i = m.querySelectorAll('input[type=text]'); set(i[0], 'Premier trimestre d\'exécution'); set(t[1], 'Démarrage conforme.'); });
  await capture('evaluation-d-un-titulaire', { entier: false }); await page.evaluate(() => [...document.querySelectorAll('.modale')].pop().querySelector('button[type=submit]').click()); await attendre('Brouillon');
  await connecter('valideur'); await aller('/evaluations', 'Évaluations des titulaires'); await clic('Valider', { pres: '2026-M-021', dans: 'tr', exact: true }); ok((await dernierMessage()).includes('faits vérifiables'), 'une évaluation sans faits vérifiables ne peut pas être validée');
  await connecter('gestionnaire'); await aller('/evaluations', 'Évaluations des titulaires'); await clic('Modifier', { pres: '2026-M-021', dans: 'tr' });
  await page.evaluate(() => { const m = [...document.querySelectorAll('.modale')].pop(); const t = m.querySelectorAll('textarea')[0]; t.value = 'Ordre de service n° 1 du 1er décembre 2026 ; rapports de visite remis sous 48 heures (contrôle du 15 janvier).'; t.dispatchEvent(new Event('input', { bubbles: true })); m.querySelector('button[type=submit]').click(); }); await pause(900);
  await connecter('valideur'); await aller('/evaluations', 'Évaluations des titulaires'); await clic('Valider', { pres: '2026-M-021', dans: 'tr', exact: true }); await pause(700);
  ok(await page.evaluate(async () => (await D.lister('evaluations')).filter(e => e.statut === 'validee').length === 2), 'évaluation rattachée à des faits, validée par le valideur');
  ok(await page.evaluate(async () => (await D.lister('evaluations')).some(e => e.note_globale === 4.3 && e.criteres.length === 6)), "critère ajouté par l'administrateur (coefficient 2) pris en compte : moyenne pondérée 30 / 7 = 4,3"); await capture('evaluations-des-titulaires');
  await clic('Exporter (XLSX)'); t = await telechargement(); ok(t && t.nom.startsWith('evaluations'), 'historique des évaluations exporté en XLSX');

  titre('Support : demande d\'assistance, criticité, délais contractuels, historique, clôture validée par la collectivité');
  await connecter('prescripteur'); await aller('/support', 'Demandes d\'assistance'); await clic('Nouvelle demande'); await remplir('Objet', 'Erreur à l\'export du rapport en Word');
  await remplir('Criticité', 'P2 — Majeur'); await remplir('Description', 'Depuis l\'onglet Rapport, le bouton « Exporter en Word » affiche une erreur pour le lot 2.'); await valider('Envoyer la demande'); await attendre('Délais contractuels');
  const tk = await page.evaluate(async () => (await D.lister('tickets')).find(t => t.criticite === 'P2'));
  ok(tk && /^T-\d{4}-0002$/.test(tk.numero) && tk.echeances.prise_en_charge && tk.echeances.retablissement, 'demande ' + (tk && tk.numero) + ' créée : numéro unique, horodatage, criticité P2, échéances contractuelles calculées en heures ouvrées');
  await connecter('support'); await aller('/notifications', 'Vos notifications'); ok(await present('Nouvelle demande P2'), "l'équipe support est notifiée de la nouvelle demande");
  await aller('/support/' + tk.id, 'Prendre en charge'); await clic('Prendre en charge'); await remplir('Qualification', 'Incident reproduit sur le lot 2, affecté à un intervenant.'); await valider(); await attendre('Communiquer le diagnostic');
  await clic('Communiquer le diagnostic'); await remplir('Causes probables', 'Caractère non pris en charge dans un intitulé de lot ; correctif en préparation.'); await valider(); await attendre('Proposer la résolution');
  await clic('Proposer la résolution'); await remplir('Solution apportée', 'Correctif appliqué : l\'export Word fonctionne pour tous les lots.'); await valider(); await attendre('Résolu — en attente de validation');
  ok((await tenter("await D.modifier('tickets', '" + tk.id + "', { statut: 'clos' })")).includes('validée par la collectivité'), 'règle vérifiée : le support ne peut pas clore lui-même une demande');
  ok(await present('Respecté'), 'délais contractuels suivis : prise en charge et diagnostic dans les délais'); await capture('demande-d-assistance-suivi-et-delais');
  await connecter('prescripteur'); await aller('/support/' + tk.id, 'Valider et clore'); await clic('Valider et clore'); await remplir('Motif de clôture', 'Export vérifié sur les deux lots.'); await valider(); await attendre('Clôture validée par la collectivité');
  ok(await page.evaluate(async id => (await D.lire('tickets', id)).historique.length === 5, tk.id), 'historique complet de la demande : création, prise en charge, diagnostic, solution, clôture validée');
  await aller('/support', 'Délais de traitement contractuels'); await capture('demandes-d-assistance');

  titre('Reprise de l\'existant et export complet');
  await connecter('gestionnaire'); await aller('/reprise', 'Reprendre un tableau de suivi');
  await (await page.$('#fichier-reprise')).uploadFile(path.join(PLIS, 'marches_existants.csv')); await attendre('Règles de correspondance');
  await clic('Reprise à blanc'); await attendre('Rapport de contrôle');
  ok(await present('3 ligne(s) prête(s) à être reprise(s), 2 ligne(s) en anomalie'), 'reprise à blanc d\'un CSV : 3 lignes prêtes, 2 anomalies détectées (titulaire manquant, montant et date illisibles)');
  await capture('reprise-a-blanc-rapport-de-controle');
  await clic('Reprise définitive de 3 ligne(s)'); await attendre('Historique des reprises'); await pause(800);
  ok(await page.evaluate(async () => (await D.lister('marches')).filter(m => m.reprise_id).length === 3), 'reprise définitive : 3 marchés créés, fichier source conservé');
  await page.evaluate(() => { const s = document.querySelector('#contenu form select'); s.value = [...s.options].find(o => o.text.includes('2023-M-101')).value; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await (await page.$('#contenu form input[type=file]')).uploadFile(CANDIDATS[0].fichiers[0], CANDIDATS[0].fichiers[3]); await clic('Reprendre les documents', { attente: 2500 });
  ok(await page.evaluate(async () => (await D.lister('pieces')).filter(p => p.type_piece === 'Document repris').length === 2), 'reprise de documents PDF et DOCX rattachés à un marché repris');
  await connecter('admin'); await aller('/reprise', 'Export complet des données'); await clic('Générer l\'export complet'); await attendre('Inventaire de contrôle', 60000); t = await telechargement();
  ok(t && t.nom.endsWith('.zip') && t.taille > 200000, 'export complet généré (' + t.taille + ' octets) : tables JSON et CSV, pièces sources, inventaire, dictionnaire'); await capture('export-complet-inventaire');
  const sauvegarde = t.nom;
  const compter = () => page.evaluate(async () => { const r = {}; for (const x of ['besoins', 'consultations', 'lots', 'offres', 'notes', 'pieces', 'marches', 'evenements', 'fournisseurs', 'evaluations', 'tickets', 'documents_dce', 'rapports', 'affectations', 'habilitations']) r[x] = (await D.lister(x)).length; return r; });
  const etatSauvegarde = await compter();
  await clic('Retour arrière', { pres: 'marches_existants.csv', dans: 'tr' }); await clic('Annuler la reprise', { exact: true }); await pause(1200);
  ok(await page.evaluate(async () => (await D.lister('marches')).filter(m => m.reprise_id).length === 0), 'retour arrière : les 3 marchés repris sont supprimés, le rapport de contrôle est conservé');
  titre('Restauration d\'une sauvegarde (export complet)');
  await tenter("await D.creer('besoins', { reference: 'B-TEST', objet: 'Besoin créé après la sauvegarde', service: 'Test', nature: 'services', famille: 'Test', montant_estime: 1000, annee: 2026, statut: 'recense' })");
  ok((await compter()).besoins === etatSauvegarde.besoins + 1 && (await compter()).marches === etatSauvegarde.marches - 3, "état modifié après la sauvegarde (un besoin ajouté, trois marchés retirés)");
  await aller('/reprise', 'Restaurer une sauvegarde'); await (await page.$('#fichier-sauvegarde')).uploadFile(path.join(EXPORTS, sauvegarde)); await attendre('Contrôle de la sauvegarde', 30000);
  ok(await present('Conforme'), "archive contrôlée par rapport à son inventaire avant toute écriture"); await capture('restauration-controle-de-la-sauvegarde', { entier: false });
  await clic('Restaurer cette sauvegarde', { attente: 2500 }); await attendre('Sauvegarde restaurée');
  const apres = await compter();
  ok(JSON.stringify(apres) === JSON.stringify(etatSauvegarde), 'restauration réussie : les ' + Object.keys(apres).length + " tables contrôlées reviennent exactement à l'état de la sauvegarde (" + Object.entries(apres).map(([k, v]) => k + ' ' + v).join(', ') + ')');
  ok(await page.evaluate(async () => { const p = (await D.lister('pieces')).find(x => x.nom_fichier === 'Memoire_technique_Jamrosat.pdf'); const b = p && await D.telecharger(p.chemin); return !!(b && b.size > 1000 && p.pages && p.pages.length === 3); }), 'pièces restaurées : fichier source et texte extrait page par page (mémoire Jamrosat, 3 pages)');
  ok(await page.evaluate(async () => (await D.lister('journal')).some(l => l.action === 'Restauration d\'une sauvegarde')), 'restauration tracée au journal');
  await aller('/journal', 'Journal des actions'); await capture('journal-administrateur');

  /* ---------- Compléments (captures 58 et suivantes : la numérotation 01 à 57 ne bouge pas) ---------- */
  titre('Compléments : journal des calculs, visionneuse PDF, factures et paiements, droits par service');
  ok(await page.evaluate(async id => { const l = (await D.lister('calculs', { consultation_id: id })).sort((a, b) => a.date < b.date ? 1 : -1); return l.length >= 5 && l[0].resultats.some(r => r.rang === 1 && r.total === 75.5); }, cid), 'journal des calculs horodaté : un calcul conservé à chaque validation ; le dernier place Jamrosat en tête avec 75,50');
  await aller('/consultation/' + cid + '/analyse?vue=synthese', 'Journal des calculs');
  await page.evaluate(() => [...document.querySelectorAll('h2')].find(x => x.textContent.startsWith('Journal des calculs')).scrollIntoView()); await capture('journal-des-calculs', { entier: false });
  const oJam = await page.evaluate(async id => (await D.lister('offres', { consultation_id: id })).find(o => o.candidat.includes('Jamrosat')).id, cid);
  await aller('/consultation/' + cid + '/offre/' + oJam, 'Pièces du pli'); await clic('Memoire_technique_Jamrosat.pdf'); await attendre('Voir la mise en page d\'origine');
  await clic('Voir la mise en page d\'origine', { attente: 1500 }); await page.waitForFunction(() => { const c = document.querySelector('.page-pdf'); return c && c.width > 300; }, { timeout: 20000 });
  ok(await present('Page 1 sur 3'), 'visionneuse PDF : pages affichées avec leur mise en page d\'origine (3 pages), navigation et zoom');
  await capture('visionneuse-pdf-mise-en-page-origine', { entier: false }); await fermerModale(); await pause(300); await fermerModale(); await pause(300);
  await aller('/marches', 'Marchés en exécution'); await page.evaluate(() => [...document.querySelectorAll('tr.cliquable')].find(r => r.innerText.includes('2026-M-021')).click()); await attendre('Factures et paiements');
  await clic('Enregistrer une facture'); await remplir('Numéro de la facture', 'F-2026-118'); await remplir('Montant HT', 4100); await remplir('Bon de commande', 'Bon de commande n° 1'); await remplir('Imputation budgétaire', '011-6156-020'); await valider(); await attendre('F-2026-118');
  await clic('Service fait constaté', { pres: 'F-2026-118', dans: 'tr' }); await pause(400); await clic('Mandatée', { pres: 'F-2026-118', dans: 'tr' }); await pause(400); await clic('Payée', { pres: 'F-2026-118', dans: 'tr' }); await pause(500);
  ok(await page.evaluate(async () => { const f = (await D.lister('factures')).find(x => x.numero === 'F-2026-118'); return f && f.statut === 'payee' && f.date_service_fait && f.date_mandatement && f.date_paiement; }), 'facture suivie de la réception au paiement : service fait, mandatement, paiement, avec délai global de 30 jours');
  await clic('Exporter vers le logiciel financier (CSV)'); t = await telechargement(); ok(t && t.nom.startsWith('factures-2026-M-021'), 'export des factures vers le logiciel financier (CSV documenté)');
  await page.evaluate(() => [...document.querySelectorAll('h2')].find(x => x.textContent.startsWith('Factures et paiements')).scrollIntoView()); await capture('marche-factures-et-paiements', { entier: false });
  await clic('Se déconnecter'); await attendre('Connexion');
  await remplir('Adresse électronique', 'morgan.texier@demo.example'); await remplir('Mot de passe', 'Patrimoine-2026-x'); await clic('Se connecter', { attente: 900 }); await attendre('Tableau de bord');
  await aller('/consultations', 'Consultations');
  ok(await present('2026-021') && !(await present('2026-004')) && !(await present('2026-007')), 'droits par service : un prescripteur du service Patrimoine voit les dossiers de son service, et seulement eux, sans affectation nominative');
  await capture('droits-par-service', { entier: false });

  titre('Compléments : lecture d’un règlement, contrôle des déclarations, variantes, paquet de publication');
  const rcTexte = ['RÈGLEMENT DE LA CONSULTATION (fictif) — Maintenance des ascenseurs, lot 2', 'ARTICLE 6 — Critères de jugement des offres', 'Critère n° 1 : Prix des prestations — 45 points',
    'Critère n° 2 : Valeur technique — 50 points', '2.1 Organisation de l’équipe et moyens matériels : 30 points', '2.2 Délais d’intervention : 20 points', 'Critère n° 3 : Démarche environnementale — 5 points'].join('\n');
  fs.writeFileSync(path.join(PLIS, 'Reglement_consultation_lot2.txt'), rcTexte);
  await connecter('gestionnaire');
  const lot2 = await page.evaluate(async id => (await D.lister('lots', { consultation_id: id })).find(l => l.numero === 2).id, cid);
  await aller('/consultation/' + cid + '/analyse?lot=' + lot2 + '&vue=grille', 'Critères, sous-critères et pondérations');
  await (await page.$('#fichier-rc')).uploadFile(path.join(PLIS, 'Reglement_consultation_lot2.txt')); await attendre('Critères lus dans');
  ok(await present('Total de 100 points, sous-critères cohérents'), 'lecture automatique d’un règlement : 5 critères et sous-critères repris avec leurs pondérations (45 + 50 + 5), contrôlés avant reprise');
  await capture('lecture-des-criteres-d-un-reglement', { entier: false }); await clic('Reprendre ces critères'); await attendre('Total des pondérations : 100 / 100');
  ok(await page.evaluate(async l => (await D.lister('criteres', { lot_id: l })).length === 5, lot2), 'critères repris dans la grille du lot 2 après confirmation de l’agent');
  const alertesTest = await page.evaluate(() => Ecrans.alertesOffre({ id: 'x', candidat: 'Exemple Badamier Services', montant_ht: 1000, lot_numero: 1 }, [{ offre_id: 'x', type_piece: 'Acte d\'engagement', lisible: true, pages: ['Le soussigné, société Autre Entreprise, SIRET 732 829 320 00075, s’engage pour un montant de 1 200,00 euros HT, lot 1.'] }], []).map(a => a.texte));
  ok(alertesTest.length === 3 && alertesTest.some(x => x.includes('SIRET')) && alertesTest.some(x => x.includes('ne figure pas')) && alertesTest.some(x => x.includes('diffère du montant')), 'contrôle du contenu des déclarations : nom du candidat absent, clé du SIRET fausse, montant de l’acte d’engagement différent — trois signalements à vérifier');
  const oLetchi = await page.evaluate(async id => (await D.lister('offres', { consultation_id: id })).find(o => o.candidat.includes('Letchi')).id, cid);
  await tenter("await D.modifier('offres', '" + oLetchi + "', { type_offre: 'variante' })");
  const lot1 = await page.evaluate(async id => (await D.lister('lots', { consultation_id: id })).find(l => l.numero === 1).id, cid);
  await aller('/consultation/' + cid + '/analyse?lot=' + lot1 + '&vue=synthese&perimetre=base', 'Périmètre du classement');
  ok(await page.evaluate(() => { const t = document.querySelector('.tableau').innerText; return !t.includes('Letchi') && t.includes('Jamrosat'); }), 'analyse distincte des variantes : classement des seules offres de base, la variante est analysée à part');
  await capture('classement-offres-de-base-et-variantes', { entier: false });
  await aller('/consultation/' + cid + '/dce', 'Paquet de publication'); await clic('Paquet de publication (ZIP)', { attente: 2500 }); t = await telechargement();
  ok(t && t.nom === 'publication-2026-021.zip' && t.taille > 3000, 'paquet de publication : pièces validées en PDF et fiche de l’avis (avis.json) à charger sur le profil d’acheteur');

  /* ---------- Éditeur riche, GED, aide au choix de la procédure (captures 64 à 69 : la numérotation 01 à 63 ne bouge pas) ---------- */
  titre('Éditeur riche du DCE : titres, gras, italique, listes, tableau, assainissement du HTML, export Word et PDF, circuit de validation inchangé');
  const assaini = await page.evaluate(() => Editeur.assainir('<h2 style="color:red" onclick="alert(1)">Titre</h2><p>Texte <strong>fort</strong> <span class="x">et</span> <a href="javascript:alert(1)">lien</a><img src="x" onerror="alert(2)"></p><script>alert(3)</script><iframe src="https://example.org"></iframe><table onmouseover="x()"><tr><td>A</td></tr></table>'));
  ok(!/script|iframe|<img|onclick|onerror|onmouseover|style=|href|<a |<span|class=/i.test(assaini) && assaini.includes('<h2>Titre</h2>') && assaini.includes('<b>fort</b>') && assaini.includes('lien') && assaini.includes('<td>A</td>'),
    'assainissement par liste blanche : script, iframe, image, lien javascript, attributs et styles supprimés ; titres, gras et tableaux conservés');
  await aller('/consultation/' + cid + '/dce', 'Contrôle de complétude du dossier');
  await clic('Nouveau document'); await remplir('Type de document', 'CCTP'); await remplir('Titre', 'CCTP — maintenance des ascenseurs (éditeur riche)'); await valider('Créer'); await attendre('Circuit de validation');
  const didRiche = await page.evaluate(() => location.hash.split('/')[4]);
  await page.click('.editeur-zone');
  for (const [i, l] of ['Objet du marché', 'Le présent cahier décrit la maintenance des ascenseurs de la consultation 2026-021.', 'La sécurité des usagers prime sur toute autre considération.', 'Visites mensuelles', 'Dépannage sous deux heures', 'Rapport annuel d\'activité'].entries()) { if (i) await page.keyboard.press('Enter'); await page.keyboard.type(l); }
  // Sélection d'un passage du texte (de « debut » à « fin » inclus), comme à la souris.
  const selectionner = (debut, fin) => page.evaluate((a, b) => {
    const z = document.querySelector('.editeur-zone'); const w = document.createTreeWalker(z, NodeFilter.SHOW_TEXT); const noeuds = []; while (w.nextNode()) noeuds.push(w.currentNode);
    const ou = (t, apres) => { for (const n of noeuds) { const i = n.nodeValue.indexOf(t); if (i >= 0) return [n, apres ? i + t.length : i]; } return null; };
    const d = ou(a, false), f = ou(b || a, true); const r = document.createRange(); r.setStart(d[0], d[1]); r.setEnd(f[0], f[1]);
    z.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }, debut, fin);
  const outil = async nom => { await pause(150); await page.click('[data-outil="' + nom + '"]'); await pause(250); };
  await selectionner('Objet du marché'); await outil('Titre 1');
  await selectionner('maintenance des ascenseurs'); await outil('Gras');
  await selectionner('La sécurité des usagers', 'considération.'); await outil('Italique');
  await selectionner('Visites mensuelles', 'activité'); await outil('Liste à puces');
  await selectionner('consultation 2026-021.'); await page.evaluate(() => getSelection().collapseToEnd()); await outil('Insérer un tableau');
  await remplir('Nombre de colonnes', 2); await remplir('Nombre de lignes', 3); await valider('Insérer'); await pause(300);
  const cellules = ['Prestation', 'Fréquence', 'Visite préventive', 'Mensuelle', 'Contrôle réglementaire', 'Annuel'];
  for (const [i, sel] of ['th:nth-child(1)', 'th:nth-child(2)', 'tbody tr:nth-child(1) td:nth-child(1)', 'tbody tr:nth-child(1) td:nth-child(2)', 'tbody tr:nth-child(2) td:nth-child(1)', 'tbody tr:nth-child(2) td:nth-child(2)'].entries()) {
    await page.evaluate(s => { const c = document.querySelector('.editeur-zone table ' + s); const r = document.createRange(); r.selectNodeContents(c); const g = getSelection(); g.removeAllRanges(); g.addRange(r); }, sel);
    await page.keyboard.type(cellules[i]); }
  // Collage depuis une source extérieure : le HTML est assaini avant insertion.
  await page.evaluate(() => { const z = document.querySelector('.editeur-zone'); const p = z.querySelector('ul').lastElementChild; const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    const dt = new DataTransfer(); dt.setData('text/html', '<p onclick="alert(1)">Texte collé <script>window.__xss=1<\/script><img src=x onerror="window.__xss=2"><b>en gras</b></p>'); dt.setData('text/plain', 'Texte collé en gras');
    z.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  await pause(300);
  const edite = await page.evaluate(() => { const z = document.querySelector('.editeur-zone'); return { html: z.innerHTML, xss: window.__xss || 0 }; });
  ok(/<h1>Objet du marché<\/h1>/.test(edite.html) && /<b>maintenance des ascenseurs<\/b>/.test(edite.html) && /<i>La sécurité des usagers/.test(edite.html) && /<ul><li>Visites mensuelles/.test(edite.html) && /<table>[\s\S]*<th>Prestation<\/th>[\s\S]*<td>Contrôle réglementaire<\/td>/.test(edite.html),
    'éditeur riche (contenteditable, sans bibliothèque) : titre, gras, italique, liste à puces et tableau 2 × 3 appliqués depuis la barre d\'outils');
  ok(edite.html.includes('Texte collé') && !/script|<img|onclick|onerror/i.test(edite.html) && edite.xss === 0, 'collage depuis une source extérieure : HTML assaini avant insertion (aucun script exécuté, aucun attribut conservé)');
  await capture('dce-editeur-riche-mise-en-forme', { entier: false });
  await clic('Enregistrer (nouvelle version)'); await remplir('Nature des modifications', 'Rédaction du CCTP avec l\'éditeur riche'); await valider(); await attendre('version 2');
  const stocke = await page.evaluate(async id => { const d = await D.lire('documents_dce', id); const v = (await D.lister('documents_versions', { document_id: id })).find(x => x.version === 2); return { d, v }; }, didRiche);
  ok(stocke.d.contenu_html.includes('<h1>Objet du marché</h1>') && stocke.d.contenu_html.includes('<table>') && stocke.d.contenu.includes('- Visites mensuelles') && stocke.d.contenu.includes('Prestation | Fréquence') && stocke.d.contenu.includes('2026-021') && stocke.v && stocke.v.contenu_html === stocke.d.contenu_html,
    'version 2 enregistrée : HTML assaini (contenu_html) et texte brut dérivé (contenu, lu par les contrôles et le circuit) conservés ensemble, y compris dans l\'historique des versions');
  ok(await page.evaluate(() => /<h1>Objet du marché<\/h1>/.test(document.querySelector('.editeur-zone').innerHTML) && document.querySelector('.editeur-zone table') !== null), 'mise en forme restituée à la réouverture du document');
  const fichierExporte = async () => { const x = await telechargement(); const f = path.join(EXPORTS, x.nom); for (let i = 0; i < 40 && !fs.existsSync(f); i++) await pause(250); await pause(300); return Object.assign(x, { f }); };
  await clic('Word'); t = await fichierExporte();
  const JSZipNode = require('jszip'); const xml = await (await JSZipNode.loadAsync(fs.readFileSync(t.f))).file('word/document.xml').async('string');
  ok(t.nom.endsWith('-v2.docx') && xml.includes('<w:tbl>') && /Heading1/.test(xml) && xml.includes('Contrôle réglementaire') && xml.includes('Visites mensuelles') && /<w:numPr>/.test(xml) && /<w:i\/>/.test(xml),
    'export Word du document mis en forme : titre de niveau 1, liste à puces, paragraphe en italique et tableau Word (' + t.taille + ' octets)');
  await clic('PDF'); t = await fichierExporte(); ok(t.nom.endsWith('-v2.pdf') && t.taille > 3000 && fs.readFileSync(t.f).subarray(0, 5).toString() === '%PDF-', 'export PDF du document mis en forme (' + t.taille + ' octets ; contenu du PDF non relu automatiquement)');
  await clic('Voir', { pres: 'Rédaction du CCTP', dans: 'tr' }); await attendre('— version 2'); await capture('dce-editeur-riche-version-mise-en-forme', { entier: false }); await fermerModale(); await pause(300);
  await clic('Soumettre (Relecture)'); await attendre('Soumis à : Relecture');
  ok(await page.evaluate(() => document.querySelector('.editeur-zone').getAttribute('contenteditable') === 'false' && !document.querySelector('.editeur-barre')), 'document soumis : éditeur en lecture seule, barre d\'outils retirée');
  await connecter('valideur'); await aller('/consultation/' + cid + '/dce/' + didRiche, 'Approuver (Relecture)'); await clic('Approuver (Relecture)'); await attendre('Relecture : approuvé');
  await clic('Approuver (Visa juridique)'); await attendre('Visa juridique : approuvé'); await clic('Approuver (Validation)'); await attendre('document validé');
  ok(await page.evaluate(async (id, html) => { const d = await D.lire('documents_dce', id); return d.statut === 'valide' && d.contenu_html === html && (await D.lister('validations', { objet_id: id })).length === 4; }, didRiche, stocke.d.contenu_html),
    'circuit de validation inchangé sur un document mis en forme : soumis, relu, visa, validé (4 étapes tracées), mise en forme intacte');
  await connecter('gestionnaire');

  titre('GED : arborescence libre de dossiers par consultation, rangement des pièces (sélecteur et glisser-déposer)');
  await aller('/consultation/' + cid + '/ged', 'Arborescence');
  ok(await present('Documents (GED)') && await present('Non classées'), 'onglet « Documents (GED) » de la consultation : toutes les pièces du dossier, non classées au départ');
  const nouveauDossier = async (nom, dans) => { await clic(dans ? 'Sous-dossier' : 'Nouveau dossier'); await remplir('Nom du dossier', nom); await valider('Créer'); await attendre(nom); };
  await nouveauDossier('Pièces administratives'); await nouveauDossier('Plans et annexes');
  await clic('Pièces administratives', { exact: false }); await attendre('Pièces administratives — 0 pièce(s)'); await nouveauDossier('Assurances', true);
  await clic('Plans et annexes'); await attendre('Plans et annexes — 0 pièce(s)'); await clic('Renommer ou déplacer'); await remplir('Nouveau nom', 'Plans'); await valider(); await attendre('Plans — 0 pièce(s)');
  ok(await page.evaluate(async id => { const g = (await D.lire('consultations', id)).ged_dossiers; const adm = g.find(x => x.nom === 'Pièces administratives'); return g.length === 3 && g.some(x => x.nom === 'Assurances' && x.parent_id === adm.id) && g.some(x => x.nom === 'Plans') && !g.some(x => x.nom === 'Plans et annexes'); }, cid),
    'dossiers créés, sous-dossier créé, dossier renommé : arborescence enregistrée dans la consultation et tracée au journal');
  await clic('Non classées');  await attendre('Non classées — ');
  const pDc1 = await page.evaluate(() => { const s = [...document.querySelectorAll('select.ged-ranger')].find(x => x.getAttribute('aria-label').includes('DC1_Jamrosat')); const o = [...s.options].find(x => x.text === 'Pièces administratives › Assurances'); s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); return s.dataset.piece; });
  await attendre('Pièce rangée.');
  const pMem = await page.evaluate(() => { const tr = [...document.querySelectorAll('tr.ged-glissable')].find(x => x.innerText.includes('Memoire_technique_Jamrosat')); const cibleNoeud = [...document.querySelectorAll('.ged-noeud')].find(x => x.childNodes[1] && x.childNodes[1].nodeValue === 'Plans');
    const dt = new DataTransfer(); tr.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })); cibleNoeud.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }));
    cibleNoeud.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); cibleNoeud.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); tr.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true })); return tr.dataset.piece; });
  await attendre('rangée dans « Plans »');
  ok(await page.evaluate(async (a, b, id) => { const g = (await D.lire('consultations', id)).ged_dossiers; const pa = await D.lire('pieces', a), pb = await D.lire('pieces', b); return pa.ged_dossier_id === g.find(x => x.nom === 'Assurances').id && pb.ged_dossier_id === g.find(x => x.nom === 'Plans').id; }, pDc1, pMem, cid),
    'pièces rangées : une par le sélecteur « Ranger dans », une par glisser-déposer sur le dossier (événements de glisser-déposer simulés dans le navigateur)');
  await clic('Assurances'); await attendre('Pièces administratives › Assurances — 1 pièce(s)'); await capture('ged-arborescence-et-rangement', { entier: false });
  await clic('Plans'); await attendre('Plans — 1 pièce(s)'); await capture('ged-piece-rangee-par-glisser-deposer', { entier: false });
  await clic('Supprimer le dossier'); await clic('Supprimer le dossier', { exact: true }); await attendre('Dossier supprimé.');
  ok(await page.evaluate(async (b, id) => { const g = (await D.lire('consultations', id)).ged_dossiers; const pb = await D.lire('pieces', b); return g.length === 2 && !g.some(x => x.nom === 'Plans') && !pb.ged_dossier_id && !!pb.chemin; }, pMem, cid),
    'suppression d\'un dossier : aucune pièce supprimée, la pièce remonte dans « Non classées »');
  ok(await page.evaluate(async id => { const j = (await D.lister('journal', { consultation_id: id })).map(l => l.action); return ['Création d\'un dossier (GED)', 'Renommage d\'un dossier (GED)', 'Suppression d\'un dossier (GED)', 'Rangement d\'une pièce (GED)'].every(a => j.includes(a)); }, cid), 'actions de la GED tracées au journal (création, renommage, suppression, rangement)');

  titre('Aide au choix de la procédure : seuils 2026, type d\'acheteur, date de lancement, petits lots');
  const cas = await page.evaluate(() => { const f = (nature, lots, o) => Ecrans.aideProcedure2026(Object.assign({ acheteur: 'collectivite', nature, lots, date: '2026-06-01' }, o || {})).niveau;
    return [f('travaux', [99999]), f('travaux', [100000]), f('fournitures', [50000], { date: '2026-03-15' }), f('fournitures', [50000]), f('services', [215999]), f('services', [216000]), f('services', [140000], { acheteur: 'etat' }), f('services', [431999], { acheteur: 'entite' }), f('travaux', [5403999]), f('travaux', [5404000])].join(','); });
  ok(cas === '1,3,2,1,3,4,4,3,3,4', 'seuils 2026 appliqués : dispense travaux 100 000 € HT (au-delà, MAPA avec avis BOAMP ou JAL puisque 90 000 € sont dépassés), fournitures et services 40 000 € HT avant le 01/04/2026 puis 60 000 € HT, formalisé 216 000 € (collectivités), 140 000 € (État), 432 000 € (entités adjudicatrices), 5 404 000 € HT (travaux) — ' + cas);
  const petits = await page.evaluate(() => { const r = Ecrans.aideProcedure2026({ acheteur: 'collectivite', nature: 'services', lots: [200000, 60000, 30000], date: '2026-06-01' }); return r.niveau + '|' + r.lots.map(l => l.procedure.startsWith('Procédure adaptée') ? 'A' : 'F').join('') + '|' + r.cumulPetitsLots; });
  ok(petits === '4|FFA|30000', 'allotissement : la valeur totale des lots (290 000 € HT) déclenche la procédure formalisée ; dérogation des petits lots proposée pour le seul lot 3 (30 000 € HT, dans la limite de 20 %) — ' + petits);
  ok(await page.evaluate(() => [...document.querySelectorAll('#menu nav a')].some(a => a.textContent === 'Aide au choix de la procédure')), 'entrée de menu « Aide au choix de la procédure »');
  await aller('/procedure?consultation=' + cid, 'Seuils en vigueur et sources');
  ok(await page.evaluate(() => document.querySelectorAll('.proc-lots input').length) === await page.evaluate(async id => (await D.lister('lots', { consultation_id: id })).length, cid), 'aide ouverte depuis la consultation : lots et montants estimés repris');
  await remplir('Nature', 'Services');
  await page.evaluate(() => { const z = document.querySelector('.proc-lots'); while (z.children.length < 3) [...document.querySelectorAll('button')].find(b => b.textContent === 'Ajouter un lot').click();
    [200000, 60000, 30000].forEach((m, i) => { const inp = z.children[i].querySelector('input'); inp.value = m; inp.dispatchEvent(new Event('input', { bubbles: true })); }); });
  await pause(300);
  ok(await page.evaluate(() => document.getElementById('proc-verdict').textContent.startsWith('Procédure formalisée') && /290\s000/.test(document.getElementById('proc-justif').value)), 'écran : procédure formalisée affichée pour 290 000 € HT, justification proposée');
  await capture('aide-procedure-seuils-2026-et-petits-lots', { entier: false });
  await page.evaluate(() => [...document.querySelectorAll('h2')].find(x => x.textContent.startsWith('Seuils en vigueur')).scrollIntoView());
  ok(await present('à vérifier') && await present('Décret n° 2025-1386'), 'seuils affichés avec leur source et leur état (« vérifié » ou « à vérifier »)');
  await capture('aide-procedure-seuils-et-sources', { entier: false });

  titre('Frise du parcours : étape de chaque dossier, pastilles cliquables, vue « Mes dossiers », compteur du tableau de bord');
  // Captures à numéro fixe (78 à 82), hors de la numérotation automatique du scénario.
  const captureN = async (n, nom, options = {}) => { await pause(400); await page.evaluate(() => { const z = document.getElementById('messages'); if (z) z.replaceChildren(); }); const f = n + '-' + nom + '.png'; await page.screenshot({ path: path.join(CAPTURES, f), fullPage: !!options.entier }); console.log('   📷 ' + f); };
  const regles = await page.evaluate(() => {
    const auj = '2026-06-01'; const c = (statut, o) => Object.assign({ id: 'x', statut, procedure: 'Procédure adaptée (MAPA)' }, o || {});
    const lots = [{ id: 'L', consultation_id: 'x' }];
    const e = (cc, d) => Ecrans.etapeConsultation(cc, d || {}, auj);
    const rec = e(c('publiee', { date_limite_offres: '2026-06-06' }));
    const sus = e(c('attribuee', { procedure: 'Appel d\'offres ouvert' }), { lots, rapports: [{ consultation_id: 'x', statut: 'valide', valide_le: '2026-05-28T10:00:00' }] });
    const r = [e(c('preparation')).cle, e(c('preparation'), { documents_dce: [{ consultation_id: 'x', statut: 'valide' }] }).cle, rec.cle, e(c('publiee', { date_limite_offres: '2026-05-30' })).cle,
      e(c('analyse'), { lots }).cle, e(c('analyse'), { lots, analyses: [{ lot_id: 'L', statut: 'validee' }] }).cle, sus.cle,
      e(c('attribuee'), { marches: [{ id: 'M', consultation_id: 'x', statut: 'en_cours', date_debut: '2026-01-01', duree_mois: 12 }] }).cle, e(c('close')).cle];
    return r.join(',') + '|' + rec.etapes[3].rebours + '|' + sus.etapes[6].date + '|' + rec.etapes.filter(x => x.etat === 'courant').length;
  });
  ok(regles === 'dce,publication,reception,analyse,analyse,attribution,notification,execution,cloture|J-5|2026-06-08|1',
    'étape déduite des données : DCE en préparation, DCE validé → publication, offres attendues (J-5), date limite passée → analyse, analyses validées → attribution, attribuée → délai de suspension (fin estimée 11 j après le rapport), marché rattaché → exécution, close → clôture — ' + regles);
  await connecter('gestionnaire');
  await aller('/consultation/c1', 'Parcours du dossier');
  await page.waitForFunction(() => document.querySelectorAll('.frise-etapes > li').length === 9, { timeout: 15000 });
  const frise = await page.evaluate(async () => { const c = await D.lire('consultations', 'c1'); const attendu = Ecrans.etapeConsultation(c, await Ecrans.chargerDonneesFrise('c1')).cle;
    const cour = [...document.querySelectorAll('.frise-etapes [aria-current="step"]')];
    const avantOnglets = !!(document.querySelector('.frise-carte').compareDocumentPosition(document.querySelector('.onglets')) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { n: cour.length, cle: cour[0] && cour[0].dataset.etape, attendu, rang: Ecrans.ETAPES_PARCOURS.findIndex(e => e.cle === attendu), ol: document.querySelector('.frise-etapes').tagName,
      libelles: [...document.querySelectorAll('.frise-libelle')].every(x => x.textContent.trim().length > 3), avantOnglets, faits: document.querySelectorAll('.frise-etape.fait').length, svg: document.querySelectorAll('.frise-etape svg').length >= 9 }; });
  ok(frise.n === 1 && frise.cle === frise.attendu && frise.ol === 'OL' && frise.libelles && frise.avantOnglets && frise.svg && frise.faits === frise.rang,
    'frise en tête de la consultation, au-dessus des onglets : liste ordonnée de 9 étapes avec pictogrammes et libellés, une seule étape aria-current="step" (« ' + frise.cle + ' »), ' + frise.faits + ' étape(s) franchie(s) avant elle');
  await captureN(78, 'frise-parcours-consultation');
  await page.evaluate(() => document.querySelector('.frise-etapes a[data-etape="reception"]').click()); await pause(600);
  await page.waitForFunction(() => document.querySelectorAll('.frise-etapes > li').length === 9, { timeout: 15000 });
  ok(await page.evaluate(() => location.hash === '#/consultation/c1/offres' && document.querySelector('.onglets button.actif').textContent === 'Candidatures et offres'), 'pastille « Questions et réception des offres » cliquée : ouvre l\'onglet Candidatures et offres, frise toujours en tête');
  await page.setViewport({ width: 640, height: 960 }); await aller('/consultation/c1', 'Parcours du dossier'); await page.waitForFunction(() => document.querySelectorAll('.frise-etapes > li').length === 9, { timeout: 15000 });
  ok(await page.evaluate(() => { const li = [...document.querySelectorAll('.frise-etapes > li')].map(x => x.getBoundingClientRect()); return li.every((r, i) => !i || (r.top > li[i - 1].top && Math.abs(r.left - li[0].left) < 2)); }), 'sous 700 px de large, la frise passe à la verticale (étapes empilées)');
  await page.evaluate(() => document.querySelector('.frise-carte').scrollIntoView()); await captureN(79, 'frise-parcours-mobile-verticale');
  await page.setViewport({ width: 1440, height: 960 });
  await page.evaluate(() => { try { localStorage.removeItem('vavang-vue-dossiers'); } catch (e) { /* sans effet */ } });
  await aller('/consultations', 'Où en sont mes dossiers');
  const cartes = await page.evaluate(async () => { const n = (await Ecrans.consultationsVisibles()).length; const k = [...document.querySelectorAll('.dossier-carte')];
    return { n, k: k.length, mini: k.every(x => x.querySelector('.mini-frise') && x.querySelector('.dossier-etape')), bouton: [...document.querySelectorAll('button')].some(b => b.textContent === 'Nouveau dossier') }; });
  ok(cartes.n > 0 && cartes.k === cartes.n && cartes.mini && cartes.bouton, 'vue « Mes dossiers » en cartes : ' + cartes.k + ' dossier(s), chacun avec sa mini-frise et son étape en clair ; bouton « Nouveau dossier »');
  await captureN(80, 'mes-dossiers-cartes-et-mini-frises', { entier: true });
  await page.evaluate(() => document.querySelector('.bascule-vue [data-vue="tableau"]').click()); await pause(300);
  ok(await page.evaluate(() => !!document.querySelector('table') && !document.querySelector('.dossier-carte') && [...document.querySelectorAll('th')].some(x => x.textContent === 'Étape du parcours')), 'bascule « Tableau » : la liste s\'affiche en tableau avec la colonne « Étape du parcours »');
  await page.evaluate(() => document.querySelector('.bascule-vue [data-vue="cartes"]').click()); await pause(300);
  await aller('/', 'Où en sont mes dossiers');
  const compteur = await page.evaluate(async () => { const n = (await Ecrans.consultationsVisibles()).length; const v = [...document.querySelectorAll('.compteur-etapes li')].map(li => Number(li.querySelector('.compteur-nb').textContent));
    const premier = [...document.querySelectorAll('.compteur-etapes li.occupe a')][0]; return { n, total: v.reduce((a, b) => a + b, 0), pastilles: v.length, cle: premier && premier.dataset.etape, nb: premier ? Number(premier.querySelector('.compteur-nb').textContent) : 0 }; });
  ok(compteur.pastilles === 9 && compteur.total === compteur.n && !!compteur.cle, 'tableau de bord « Où en sont mes dossiers » : 9 pastilles, ' + compteur.total + ' dossier(s) répartis par étape');
  await page.evaluate(() => document.querySelector('.compteur-etapes').scrollIntoView({ block: 'center' })); await captureN(81, 'tableau-de-bord-ou-en-sont-mes-dossiers');
  await page.evaluate(k => document.querySelector('.compteur-etapes a[data-etape="' + k + '"]').click(), compteur.cle); await pause(800); await attendre('Filtre : étape');
  ok(await page.evaluate((k, nb) => location.hash === '#/consultations?etape=' + k && [...document.querySelectorAll('.dossier-carte')].length === nb && [...document.querySelectorAll('.dossier-carte')].every(x => x.dataset.etape === k), compteur.cle, compteur.nb),
    'pastille du tableau de bord cliquée : la liste est filtrée sur l\'étape « ' + compteur.cle + ' » (' + compteur.nb + ' dossier(s))');
  await captureN(82, 'mes-dossiers-filtre-par-etape', { entier: true });

  await pause(1500);
  const fichiers = fs.readdirSync(EXPORTS);
  ok(fichiers.some(f => f.endsWith('.pdf')) && fichiers.some(f => f.endsWith('.docx')) && fichiers.some(f => f.endsWith('.zip')), 'fichiers exportés présents sur le disque : ' + fichiers.length + ' fichiers dans captures/exports');
  ok(erreurs.length === 0, 'aucune erreur JavaScript pendant tout le scénario' + (erreurs.length ? ' — ' + erreurs.join(' | ') : ''));
  fs.writeFileSync(path.join(CAPTURES, 'resultat-du-scenario.txt'), 'Scénario joué le ' + new Date().toLocaleString('fr-FR') + ' — mode ' + (await page.evaluate(() => D.mode)) + '\nNavigateur : ' + nav + '\n\n' + constats.map((c, i) => (i + 1) + '. ' + c).join('\n') + '\n');
  console.log('\nSCÉNARIO RÉUSSI — ' + constats.length + ' vérifications, ' + numero + ' captures.');
} catch (e) {
  console.error('\n' + e.message); if (erreurs.length) console.error('Erreurs de la page : ' + erreurs.join(' | '));
  await page.screenshot({ path: path.join(CAPTURES, 'ECHEC.png'), fullPage: true }).catch(() => {}); process.exitCode = 1;
} finally { await navigateur.close(); serveur.close(); }
