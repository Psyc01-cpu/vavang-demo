// Essai local du chiffrement des sauvegardes, sans aucun service en ligne :
//   1. fabrique une sauvegarde au format exact de tests/sauvegarde.mjs à partir du jeu de démonstration (supabase/seed) ;
//   2. génère une clé de test aléatoire, gardée en mémoire et transmise aux commandes par variable d'environnement (jamais écrite) ;
//   3. chiffre la sauvegarde (tests/chiffrement-sauvegarde.mjs chiffrer --supprimer-clair) ;
//   4. contrôle l'archive : aucune donnée lisible en clair, aucun dossier en clair restant ;
//   5. déchiffre et contrôle l'intégrité par l'outil de restauration (tests/restauration.mjs --controle-seul) ;
//   6. vérifie les refus : clé fausse, archive modifiée d'un octet, clé absente, sauvegarde refusée sans clé en mode « obligatoire » ;
//   7. déchiffre dans un dossier et compare chaque fichier à l'original (SHA-256).
// Rapport : mesures/chiffrement-sauvegarde-AAAAMMJJ.json.   node tests/essai-chiffrement.mjs
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const empreinteTable = lignes => sha256(JSON.stringify(lignes));
const constats = []; const ok = (c, t) => { if (!c) throw new Error('ÉCHEC — ' + t); constats.push(t); console.log('   ✓ ' + t); };
const node = (args, env) => { const r = spawnSync(process.execPath, args, { cwd: racine, encoding: 'utf8', env: Object.assign({}, process.env, { SAUVEGARDE_CLE: '', SAUVEGARDE_CHIFFREMENT: '' }, env) }); return { code: r.status, sortie: (r.stdout || '') + (r.stderr || '') }; };
const lister = (d, b = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? lister(path.join(d, e.name), b) : [path.relative(b, path.join(d, e.name)).split(path.sep).join('/')]);

const travail = fs.mkdtempSync(path.join(os.tmpdir(), 'vavang-essai-chiffrement-'));
try {
  // 1. sauvegarde au format de tests/sauvegarde.mjs, depuis le jeu de démonstration
  const seed = JSON.parse(fs.readFileSync(path.join(racine, 'supabase', 'seed', 'seed.json'), 'utf8'));
  const liste = JSON.parse(fs.readFileSync(path.join(racine, 'supabase', 'seed', 'fichiers', 'liste.json'), 'utf8'));
  const date = new Date().toISOString(), nom = 'sauvegarde-' + date.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  const dossier = path.join(travail, nom); fs.mkdirSync(path.join(dossier, 'fichiers'), { recursive: true });
  const tables = {}; for (const [t, lignes] of Object.entries(seed)) tables[t] = lignes.map(l => { const { id, ...d } = l; return { id, d, cree_le: date, cree_par: null, modifie_le: null }; }).sort((a, b) => a.id < b.id ? -1 : 1);
  const empreintes = { tables: {}, fichiers: {} }, comptes = {}; const sommes = [];
  for (const [t, l] of Object.entries(tables)) { empreintes.tables[t] = empreinteTable(l); comptes[t] = l.length; }
  const fichiers = liste.map(f => ({ compartiment: 'pieces', chemin: f.chemin, taille: f.octets, type: f.type }));
  for (const f of fichiers) { const c = fs.readFileSync(path.join(racine, 'supabase', 'seed', 'fichiers', ...f.chemin.split('/'))); const cible = path.join(dossier, 'fichiers', 'pieces', ...f.chemin.split('/'));
    fs.mkdirSync(path.dirname(cible), { recursive: true }); fs.writeFileSync(cible, c); empreintes.fichiers['pieces/' + f.chemin] = sha256(c); sommes.push(sha256(c) + '  fichiers/pieces/' + f.chemin); }
  const texte = JSON.stringify({ version: 1, logiciel: 'vavang', date, lignes: Object.values(comptes).reduce((a, b) => a + b, 0), tables, fichiers, comptes, empreintes, source: 'jeu de démonstration local (supabase/seed)' }, null, 1);
  fs.writeFileSync(path.join(dossier, nom + '.json'), texte); sommes.unshift(sha256(texte) + '  ' + nom + '.json');
  fs.writeFileSync(path.join(dossier, 'SHA256SUMS'), sommes.join('\n') + '\n');
  const originaux = Object.fromEntries(lister(dossier).map(r => [r, sha256(fs.readFileSync(path.join(dossier, ...r.split('/'))))]));
  console.log('1. Sauvegarde de test : ' + Object.keys(tables).length + ' tables, ' + Object.values(comptes).reduce((a, b) => a + b, 0) + ' lignes, ' + fichiers.length + ' fichiers');

  // 2. clé de test aléatoire (mémoire seulement)
  const CLE = crypto.randomBytes(32).toString('base64url');

  // 3. chiffrement
  console.log('2. Chiffrement');
  let r = node(['tests/chiffrement-sauvegarde.mjs', 'chiffrer', dossier, '--supprimer-clair'], { SAUVEGARDE_CLE: CLE });
  ok(r.code === 0, 'chiffrement de la sauvegarde (AES-256-GCM, clé dérivée par scrypt) : commande réussie');
  const res = JSON.parse(r.sortie.slice(r.sortie.indexOf('{')));
  const archive = path.join(travail, nom + '.vvs');
  ok(fs.existsSync(archive) && !fs.existsSync(dossier), 'archive ' + path.basename(archive) + ' écrite (' + res.octets_chiffres + ' octets) ; dossier en clair supprimé');
  const brut = fs.readFileSync(archive);
  ok(brut.subarray(0, 8).toString() === 'VVSAUV01' && !brut.includes(Buffer.from('Exemple Tamarin Paysage')) && !brut.includes(Buffer.from('"tables"')), 'aucune donnée lisible dans l\'archive (nom de candidat et structure JSON introuvables)');
  ok(fs.readFileSync(archive + '.sha256', 'utf8').startsWith(sha256(brut)), 'empreinte SHA-256 de l\'archive chiffrée écrite à côté');

  // 4-5. déchiffrement et contrôle d'intégrité par l'outil de restauration
  console.log('3. Déchiffrement et contrôle par l\'outil de restauration');
  r = node(['tests/restauration.mjs', archive, '--controle-seul'], { SAUVEGARDE_CLE: CLE });
  ok(r.code === 0 && /"controle": "réussi"/.test(r.sortie) && /"chiffree": true/.test(r.sortie), 'restauration.mjs --controle-seul : archive déchiffrée, SHA256SUMS et empreintes des ' + Object.keys(tables).length + ' tables conformes');
  const ctl = JSON.parse(r.sortie.slice(r.sortie.indexOf('{')));
  ok(ctl.lignes === Object.values(comptes).reduce((a, b) => a + b, 0) && ctl.fichiers === fichiers.length, 'contenu retrouvé : ' + ctl.lignes + ' lignes et ' + ctl.fichiers + ' fichiers, comme à la sauvegarde');
  const restes = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('vavang-restauration-'));
  ok(restes.length === 0, 'aucune copie déchiffrée laissée dans le dossier temporaire après le contrôle');

  console.log('4. Refus attendus');
  r = node(['tests/restauration.mjs', archive, '--controle-seul'], { SAUVEGARDE_CLE: crypto.randomBytes(32).toString('base64url') });
  ok(r.code !== 0 && /clé incorrecte ou archive altérée/.test(r.sortie), 'clé fausse : déchiffrement refusé');
  const altere = Buffer.from(brut); altere[200] ^= 1; const fAltere = path.join(travail, 'altere.vvs'); fs.writeFileSync(fAltere, altere);
  r = node(['tests/restauration.mjs', fAltere, '--controle-seul'], { SAUVEGARDE_CLE: CLE });
  ok(r.code !== 0 && /clé incorrecte ou archive altérée/.test(r.sortie), 'archive modifiée d\'un seul octet : déchiffrement refusé (chiffrement authentifié)');
  r = node(['tests/restauration.mjs', archive, '--controle-seul'], {});
  ok(r.code !== 0 && /SAUVEGARDE_CLE absente/.test(r.sortie), 'clé absente : déchiffrement refusé');
  r = node(['tests/sauvegarde.mjs', path.join(travail, 'refus')], { SAUVEGARDE_CHIFFREMENT: 'obligatoire' });
  ok(r.code !== 0 && /SAUVEGARDE_CLE absente/.test(r.sortie) && !fs.existsSync(path.join(travail, 'refus')), 'mode « obligatoire » sans clé : sauvegarde refusée avant toute connexion, rien n\'est écrit');
  r = node(['tests/chiffrement-sauvegarde.mjs', 'chiffrer', archive], { SAUVEGARDE_CLE: 'trop-courte' });
  ok(r.code !== 0 && /trop courte/.test(r.sortie), 'phrase de passe de moins de 32 caractères refusée');

  console.log('5. Restitution complète');
  const dest = path.join(travail, 'restitution');
  r = node(['tests/chiffrement-sauvegarde.mjs', 'dechiffrer', archive, dest], { SAUVEGARDE_CLE: CLE });
  const dossierRestitue = path.join(dest, nom);
  const identiques = Object.entries(originaux).filter(([rel, h]) => fs.existsSync(path.join(dossierRestitue, ...rel.split('/'))) && sha256(fs.readFileSync(path.join(dossierRestitue, ...rel.split('/')))) === h).length;
  ok(r.code === 0 && identiques === Object.keys(originaux).length && lister(dossierRestitue).length === identiques, 'archive déchiffrée : ' + identiques + ' fichiers sur ' + Object.keys(originaux).length + ' identiques à l\'original (SHA-256)');

  const rapport = { date: new Date().toISOString(), outil: 'tests/essai-chiffrement.mjs', algorithme: 'AES-256-GCM ; clé dérivée de SAUVEGARDE_CLE par scrypt (N=32768, r=8, p=1), sel aléatoire par archive',
    cle: 'clé de test aléatoire de 256 bits, générée en mémoire pour l\'essai, jamais écrite ni publiée', source: 'jeu de démonstration local (supabase/seed), au format de tests/sauvegarde.mjs',
    sauvegarde: { tables: Object.keys(tables).length, lignes: ctl.lignes, fichiers: fichiers.length, octets_zip: res.octets_clair, octets_chiffres: res.octets_chiffres },
    limites: 'Essai local. La restauration en base (étapes 1 à 4 de tests/restauration.mjs) n\'a pas été rejouée : elle écrirait sur la démo en ligne. Le chiffrement n\'est pas activé sur la démo en ligne (aucun secret créé sur GitHub).',
    constats };
  const sortie = path.join(racine, 'mesures', 'chiffrement-sauvegarde-' + rapport.date.slice(0, 10).replace(/-/g, '') + '.json');
  fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
  console.log('\n' + constats.length + ' vérifications réussies. Rapport : ' + path.relative(racine, sortie));
} catch (e) { console.error('\n' + e.message); process.exitCode = 1; }
finally { fs.rmSync(travail, { recursive: true, force: true }); }
