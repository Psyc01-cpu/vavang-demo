// Restauration d'une sauvegarde produite par tests/sauvegarde.mjs, puis vérification et mesure des durées (RTO mesuré).
// ATTENTION : remplace TOUTES les données métier et TOUS les fichiers (compartiments pieces et accueil) de la base visée.
// Les comptes de connexion (auth.*) ne sont pas touchés.
//
//   node tests/restauration.mjs <dossier de sauvegarde | fichier sauvegarde-AAAAMMJJ-HHMM.json> --confirmer
// Mêmes variables d'environnement que tests/sauvegarde.mjs (VAVANG_URL, CHROME, CHROME_ARGS, VAVANG_ADMIN, VAVANG_MDP, VAVANG_TOTP).
//
// Étapes chronométrées :
//   0. contrôle d'intégrité local (SHA256SUMS + empreintes internes)  — avant toute connexion
//   1. connexion de l'administrateur (mot de passe + TOTP)
//   2. restaurer_sauvegarde(p) : tables vidées et réinsérées en une transaction
//   3. fichiers : suppression des fichiers présents, redépôt de ceux de la sauvegarde
//   4. vérification : nouvel export, comparaison table par table (nombre de lignes + SHA-256), fichiers retéléchargés et comparés
// RTO mesuré = durée totale des étapes 1 à 4 (la décision de restaurer et le choix de la sauvegarde ne sont pas comptés).
// Un rapport restauration-<date>.json est écrit à côté de la sauvegarde ; code de sortie 1 au moindre écart.
import fs from 'node:fs'; import path from 'node:path';
import { connecter, client, sha256, empreinteTable, cheminSur, maintenant, secondes } from './sauvegarde.mjs';

// Lignes du journal ajoutées par la restauration et les exports de vérification eux-mêmes : seules différences admises.
const ACTIONS_ADMISES = new Set(['Restauration de sauvegarde', 'Sauvegarde exportée']);

function lireSauvegarde(cible) {
  if (!cible) throw new Error('Usage : node tests/restauration.mjs <dossier ou fichier de sauvegarde> --confirmer');
  let dossier = path.resolve(cible), fichier;
  if (fs.statSync(dossier).isDirectory()) {
    fichier = fs.readdirSync(dossier).find(f => /^sauvegarde-\d{8}-\d{4}\.json$/.test(f));
    if (!fichier) throw new Error('Aucun fichier sauvegarde-AAAAMMJJ-HHMM.json dans ' + dossier);
  } else { fichier = path.basename(dossier); dossier = path.dirname(dossier); }
  const texte = fs.readFileSync(path.join(dossier, fichier));
  const ecarts = [];
  // 1) SHA256SUMS : le fichier JSON et chaque fichier copié
  const sommes = path.join(dossier, 'SHA256SUMS');
  if (fs.existsSync(sommes)) {
    for (const ligne of fs.readFileSync(sommes, 'utf8').split('\n').filter(Boolean)) {
      const [h, rel] = [ligne.slice(0, 64), ligne.slice(66)];
      const f = path.join(dossier, ...rel.split('/'));
      if (!fs.existsSync(f)) ecarts.push('absent : ' + rel); else if (sha256(fs.readFileSync(f)) !== h) ecarts.push('empreinte différente : ' + rel);
    }
  } else ecarts.push('SHA256SUMS absent');
  const s = JSON.parse(texte);
  if (s.version !== 1 || !s.tables) throw new Error('Fichier non reconnu comme une sauvegarde vavang (version 1).');
  // 2) empreintes internes des tables
  for (const [table, lignes] of Object.entries(s.tables)) {
    if (s.empreintes && s.empreintes.tables[table] !== empreinteTable(lignes)) ecarts.push('empreinte de table différente : ' + table);
    if (s.comptes && s.comptes[table] !== lignes.length) ecarts.push('nombre de lignes différent : ' + table);
  }
  if (ecarts.length) throw new Error('Sauvegarde altérée ou incomplète, restauration refusée :\n  ' + ecarts.join('\n  '));
  return { s, dossier, fichier, sha256: sha256(texte) };
}

async function restaurer(cible) {
  const rapport = { debut: new Date().toISOString(), durees: {}, verification: {} }, d = rapport.durees;
  let t = maintenant();
  const { s, dossier, fichier, sha256: hJson } = lireSauvegarde(cible);
  d.controle_local_s = secondes(maintenant() - t);
  Object.assign(rapport, { sauvegarde: fichier, sha256_sauvegarde: hJson, date_sauvegarde: s.date, lignes_sauvegarde: s.lignes, fichiers_sauvegarde: (s.fichiers || []).length });

  const t0 = maintenant(); t = t0;
  const c = await connecter(); const api = client(c); rapport.base = c.url;
  d.connexion_s = secondes(maintenant() - t);
  try {
    // 2. base
    t = maintenant();
    const r = await api.rpc('restaurer_sauvegarde', { p: { version: s.version, date: s.date, tables: s.tables } });
    d.restauration_base_s = secondes(maintenant() - t);
    rapport.lignes_restaurees = r.lignes;

    // 3. fichiers : l'inventaire courant vient d'un export (lui-même tracé au journal)
    t = maintenant();
    const avant = await api.rpc('exporter_sauvegarde');
    for (const compartiment of ['pieces', 'accueil']) {
      const chemins = (avant.fichiers || []).filter(f => f.compartiment === compartiment).map(f => f.chemin);
      for (let i = 0; i < chemins.length; i += 100) await api.supprimer(compartiment, chemins.slice(i, i + 100));
    }
    rapport.fichiers_supprimes = (avant.fichiers || []).length;
    let deposes = 0;
    for (const f of s.fichiers || []) {
      const contenu = fs.readFileSync(path.join(dossier, 'fichiers', cheminSur(f.compartiment, f.chemin)));
      await api.deposer(f.compartiment, f.chemin, contenu, f.type); deposes++;
    }
    rapport.fichiers_deposes = deposes;
    d.restauration_fichiers_s = secondes(maintenant() - t);

    // 4. vérification
    t = maintenant();
    const apres = await api.rpc('exporter_sauvegarde');
    const v = rapport.verification, ecarts = [];
    v.tables = {};
    for (const [table, lignes] of Object.entries(s.tables)) {
      let obtenues = apres.tables[table] || [];
      if (table === 'journal') { // retirer les seules lignes ajoutées par cette restauration et ses exports
        const ids = new Set(lignes.map(l => l.id));
        const ajout = obtenues.filter(l => !ids.has(l.id));
        const inattendues = ajout.filter(l => !ACTIONS_ADMISES.has(l.d && l.d.action));
        if (inattendues.length) ecarts.push('journal : ' + inattendues.length + ' ligne(s) inattendue(s)');
        v.journal_lignes_ajoutees = ajout.length;
        obtenues = obtenues.filter(l => ids.has(l.id));
      }
      const ok = obtenues.length === lignes.length && empreinteTable(obtenues) === empreinteTable(lignes);
      v.tables[table] = { attendu: lignes.length, obtenu: obtenues.length, identique: ok };
      if (!ok) ecarts.push(table + ' : ' + obtenues.length + ' ligne(s) au lieu de ' + lignes.length + (obtenues.length === lignes.length ? ' (contenu différent)' : ''));
    }
    for (const table of Object.keys(apres.tables)) if (!(table in s.tables)) ecarts.push('table absente de la sauvegarde : ' + table);
    const cle = f => f.compartiment + '/' + f.chemin;
    const attendus = new Map((s.fichiers || []).map(f => [cle(f), f])), presents = new Map((apres.fichiers || []).map(f => [cle(f), f]));
    let fichiersOk = 0;
    for (const [k, f] of attendus) {
      if (!presents.has(k)) { ecarts.push('fichier manquant : ' + k); continue; }
      const h = sha256(await api.telecharger(f.compartiment, f.chemin));
      const attendu = s.empreintes && s.empreintes.fichiers[k];
      if (h !== attendu) ecarts.push('fichier différent : ' + k); else fichiersOk++;
    }
    for (const k of presents.keys()) if (!attendus.has(k)) ecarts.push('fichier en trop : ' + k);
    v.fichiers_identiques = fichiersOk + '/' + attendus.size;
    v.ecarts = ecarts; v.reussie = ecarts.length === 0;
    d.verification_s = secondes(maintenant() - t);
    d.rto_mesure_s = secondes(maintenant() - t0);
  } finally { await api.deconnecter(); await c.navigateur.close(); }

  rapport.fin = new Date().toISOString();
  const sortie = path.join(dossier, 'restauration-' + rapport.fin.replace(/[-:]/g, '').replace('T', '-').slice(0, 15) + '.json');
  fs.writeFileSync(sortie, JSON.stringify(rapport, null, 1));
  const tables = Object.values(rapport.verification.tables);
  console.log(JSON.stringify({ rapport: sortie, reussie: rapport.verification.reussie, tables_identiques: tables.filter(x => x.identique).length + '/' + tables.length,
    lignes: rapport.lignes_restaurees, fichiers: rapport.verification.fichiers_identiques, durees: d, ecarts: rapport.verification.ecarts }, null, 1));
  if (!rapport.verification.reussie) process.exit(1);
}

const args = process.argv.slice(2);
if (!args.includes('--confirmer')) {
  console.error('Cette commande REMPLACE toutes les données et tous les fichiers de ' + (process.env.VAVANG_URL || 'la démonstration en ligne') + '.\n'
    + 'Relancer avec --confirmer : node tests/restauration.mjs <dossier ou fichier> --confirmer');
  process.exit(2);
}
restaurer(args.find(a => a !== '--confirmer')).catch(e => { console.error('ÉCHEC de la restauration : ' + e.message); process.exit(1); });
