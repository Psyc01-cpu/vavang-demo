// Chiffrement des sauvegardes produites par tests/sauvegarde.mjs (CCTP 3.7.6 : sauvegardes chiffrées).
//
// Une sauvegarde (dossier sauvegarde-AAAAMMJJ-HHMM : JSON, fichiers/, SHA256SUMS) est mise dans une archive ZIP,
// puis chiffrée en AES-256-GCM (chiffrement authentifié : une clé fausse ou un octet modifié font échouer le déchiffrement).
// La clé de 256 bits est dérivée de la phrase de passe SAUVEGARDE_CLE par scrypt (N = 2^15, r = 8, p = 1), avec un sel aléatoire
// propre à chaque archive. La phrase de passe ne figure jamais dans l'archive, ni dans le dépôt, ni dans les journaux.
//
// Format du fichier <nom>.vvs :
//   « VVSAUV01 » (8 octets) | sel (16 octets) | vecteur d'initialisation (12 octets) | étiquette GCM (16 octets) | données chiffrées
//
// Utilisation :
//   node tests/chiffrement-sauvegarde.mjs generer-cle                 affiche une phrase de passe aléatoire (à conserver hors du dépôt)
//   node tests/chiffrement-sauvegarde.mjs chiffrer <dossier> [--sortie <dossier>] [--supprimer-clair]
//   node tests/chiffrement-sauvegarde.mjs dechiffrer <fichier.vvs> <dossier de destination>
// La phrase de passe est lue dans la variable d'environnement SAUVEGARDE_CLE (32 caractères au moins).
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { createRequire } from 'node:module';
const JSZip = createRequire(import.meta.url)('jszip');

const MAGIE = Buffer.from('VVSAUV01', 'ascii');
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const EXTENSION = '.vvs';

export function exigerCle(phrase = process.env.SAUVEGARDE_CLE) {
  if (!phrase) throw new Error('Variable SAUVEGARDE_CLE absente : chiffrement impossible.');
  if (String(phrase).length < 32) throw new Error('SAUVEGARDE_CLE trop courte : 32 caractères au moins.');
  return String(phrase);
}
const deriver = (phrase, sel) => crypto.scryptSync(phrase, sel, 32, SCRYPT);

export function chiffrer(donnees, phrase) {
  const sel = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', deriver(exigerCle(phrase), sel), iv);
  const corps = Buffer.concat([c.update(donnees), c.final()]);
  return Buffer.concat([MAGIE, sel, iv, c.getAuthTag(), corps]);
}
export function dechiffrer(contenu, phrase) {
  if (contenu.length < 52 || !contenu.subarray(0, 8).equals(MAGIE)) throw new Error('Fichier non reconnu comme une sauvegarde chiffrée vavang (en-tête VVSAUV01 absent).');
  const sel = contenu.subarray(8, 24), iv = contenu.subarray(24, 36), tag = contenu.subarray(36, 52);
  const d = crypto.createDecipheriv('aes-256-gcm', deriver(exigerCle(phrase), sel), iv); d.setAuthTag(tag);
  try { return Buffer.concat([d.update(contenu.subarray(52)), d.final()]); }
  catch { throw new Error('Déchiffrement refusé : clé incorrecte ou archive altérée.'); }
}

// Liste récursive des fichiers d'un dossier (chemins relatifs, séparateur « / »).
function lister(dossier, base = dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap(e => e.isDirectory() ? lister(path.join(dossier, e.name), base)
    : [path.relative(base, path.join(dossier, e.name)).split(path.sep).join('/')]);
}

export async function chiffrerDossier(dossier, phrase, options = {}) {
  exigerCle(phrase); dossier = path.resolve(dossier); const nom = path.basename(dossier);
  const zip = new JSZip();
  for (const rel of lister(dossier)) zip.file(nom + '/' + rel, fs.readFileSync(path.join(dossier, ...rel.split('/'))));
  const clair = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const sortie = path.resolve(options.sortie || path.dirname(dossier)); fs.mkdirSync(sortie, { recursive: true });
  const fichier = path.join(sortie, nom + EXTENSION), contenu = chiffrer(clair, phrase);
  fs.writeFileSync(fichier, contenu);
  const empreinte = crypto.createHash('sha256').update(contenu).digest('hex');
  fs.writeFileSync(fichier + '.sha256', empreinte + '  ' + path.basename(fichier) + '\n');
  // Contrôle immédiat : l'archive écrite se déchiffre et contient le même nombre de fichiers.
  const relu = await JSZip.loadAsync(dechiffrer(fs.readFileSync(fichier), phrase));
  const nb = Object.values(relu.files).filter(f => !f.dir).length, attendu = lister(dossier).length;
  if (nb !== attendu) throw new Error('Contrôle de l\'archive chiffrée : ' + nb + ' fichier(s) au lieu de ' + attendu + '.');
  if (options.supprimerClair) fs.rmSync(dossier, { recursive: true, force: true });
  return { fichier, empreinte, fichiers: nb, octets_clair: clair.length, octets_chiffres: contenu.length };
}

export async function dechiffrerFichier(fichier, phrase, destination) {
  const zip = await JSZip.loadAsync(dechiffrer(fs.readFileSync(fichier), phrase));
  destination = path.resolve(destination); fs.mkdirSync(destination, { recursive: true });
  let racine = null;
  for (const [nom, f] of Object.entries(zip.files)) {
    const morceaux = nom.split('/');
    // aucun chemin absolu, aucun « .. » : l'archive ne peut rien écrire hors de la destination
    if (morceaux.some(m => m === '..' || /[\\:\0]/.test(m)) || nom.startsWith('/')) throw new Error('Chemin refusé dans l\'archive : ' + nom);
    racine = racine || morceaux[0];
    if (morceaux[0] !== racine) throw new Error('Archive inattendue : plusieurs dossiers racine.');
    const cible = path.join(destination, ...morceaux.filter(Boolean));
    if (f.dir) { fs.mkdirSync(cible, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(cible), { recursive: true }); fs.writeFileSync(cible, await f.async('nodebuffer'));
  }
  return path.join(destination, racine);
}

if (process.argv[1] && /[\\/]chiffrement-sauvegarde\.mjs$/.test(process.argv[1])) {
  const [cmd, ...args] = process.argv.slice(2);
  const option = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  (async () => {
    if (cmd === 'generer-cle') { console.log(crypto.randomBytes(32).toString('base64url')); return; }
    if (cmd === 'chiffrer') { const r = await chiffrerDossier(args[0], process.env.SAUVEGARDE_CLE, { sortie: option('--sortie'), supprimerClair: args.includes('--supprimer-clair') }); console.log(JSON.stringify(r, null, 1));
      if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'archive=' + r.fichier + '\n'); return; }
    if (cmd === 'dechiffrer') { console.log('Sauvegarde déchiffrée dans : ' + await dechiffrerFichier(args[0], process.env.SAUVEGARDE_CLE, args[1] || '.')); return; }
    console.error('Usage : generer-cle | chiffrer <dossier> [--sortie <dossier>] [--supprimer-clair] | dechiffrer <fichier.vvs> <destination>'); process.exit(2);
  })().catch(e => { console.error('ÉCHEC : ' + e.message); process.exit(1); });
}
