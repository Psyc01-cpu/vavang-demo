// Génère le jeu de démonstration du mode Supabase à partir du générateur du mode local (js/demo.js).
//   node tests/generer-seed.mjs
// Produit : supabase/seed/seed.json, supabase/seed/fichiers/<chemin> (pièces à déposer dans le compartiment « pieces »)
// et supabase/seed/charger.sql (comptes Auth à UUID fixes, jeu de référence, puis remise à zéro), à exécuter après schema_demo.sql.
import puppeteer from 'puppeteer-core'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { demarrer } from './serveur.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(racine, 'supabase', 'seed'), FICHIERS = path.join(SORTIE, 'fichiers');
const PORT = 4177, URL = 'http://127.0.0.1:' + PORT + '/';
const nav = (process.env.NAVIGATEUR ? [process.env.NAVIGATEUR] : ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']).find(p => fs.existsSync(p));
// Identifiants du jeu local → UUID fixes des comptes Auth de démonstration.
const MAP = { 'u-admin': 1, 'u-gest': 2, 'u-presc': 3, 'u-valid': 4, 'u-lect': 5, 'u-support': 6 };
const uuid = n => '00000000-0000-4000-a000-00000000000' + n;
const ORGANISME_FICTIF = 'Communauté d\'agglomération de démonstration';

const serveur = await demarrer(PORT);
const navigateur = await puppeteer.launch({ executablePath: nav, headless: true, args: ['--lang=fr-FR'] });
try {
  const page = await navigateur.newPage();
  page.on('pageerror', e => console.warn('page :', e.message));
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.Demo && window.D && window.D.DROITS_DEFAUT && window.Calcul, { timeout: 30000 });
  const r = await page.evaluate(async (orgFictif) => {
    // Le nom de l'organisme est figé dans le contenu des documents du DCE : jamais un organisme réel dans la démo publique.
    if (!window.CONFIG.organisme || /cinor/i.test(window.CONFIG.organisme)) window.CONFIG.organisme = orgFictif;
    const { T, fichiers } = window.Demo.donnees(window.D);
    delete T.comptes_locaux;
    T.journal.forEach((j, i) => { j.id = 'j' + String(i + 1).padStart(2, '0'); });
    T.lignes_prix.forEach(l => { const o = T.offres.find(x => x.id === l.offre_id); l.consultation_id = o.consultation_id; l.lot_id = o.lot_id; });
    if (!T.parametres.some(p => p.id === 'securite')) T.parametres.push({ id: 'securite', valeur: Object.assign({}, window.D.SECURITE_DEFAUT) });
    if (!T.parametres.some(p => p.id === 'circuit_dce')) T.parametres.push({ id: 'circuit_dce', valeur: window.D.CIRCUIT_DCE_DEFAUT });
    const f = await Promise.all(fichiers.map(async ([chemin, b]) => ({ chemin, texte: await b.text(), type: b.type })));
    return { T, fichiers: f, comptes: window.Demo.COMPTES.map(c => ({ id: c.id, email: c.email })), mdp: window.Demo.COMPTES[0].mot_de_passe,
      date: window.D.aujourdhui(), organisme: window.CONFIG.organisme };
  }, ORGANISME_FICTIF);

  // Correspondance des identifiants (valeurs JSON exactes uniquement).
  let s = JSON.stringify(r.T);
  for (const [k, n] of Object.entries(MAP)) s = s.split('"' + k + '"').join('"' + uuid(n) + '"');
  const reste = s.match(/"u-(admin|gest|presc|valid|lect|support)"/); if (reste) throw new Error('Identifiant non converti : ' + reste[0]);
  if (s.includes('$seed$')) throw new Error('Le jeu contient le délimiteur $seed$.');
  for (const c of r.comptes) if (!MAP[c.id]) throw new Error('Compte de démonstration inattendu : ' + c.id);

  fs.rmSync(SORTIE, { recursive: true, force: true }); fs.mkdirSync(FICHIERS, { recursive: true });
  fs.writeFileSync(path.join(SORTIE, 'seed.json'), s);
  for (const f of r.fichiers) { const cible = path.join(FICHIERS, ...f.chemin.split('/')); fs.mkdirSync(path.dirname(cible), { recursive: true }); fs.writeFileSync(cible, f.texte, 'utf8'); }
  fs.writeFileSync(path.join(FICHIERS, 'liste.json'), JSON.stringify(r.fichiers.map(f => ({ chemin: f.chemin, type: 'text/plain;charset=utf-8', octets: Buffer.byteLength(f.texte) })), null, 1));

  const q = v => '\'' + String(v).replace(/'/g, '\'\'') + '\'';
  const valeursComptes = r.comptes.map(c => '(' + q(uuid(MAP[c.id])) + '::uuid, ' + q(c.email) + ')').join(',\n  ');
  const date = s => `case when e->>'${s}' ~ '^\\d{4}-\\d{2}-\\d{2}' then (e->>'${s}')::timestamptz end`;
  const sql = `-- vavang — chargement du jeu de démonstration (généré par tests/generer-seed.mjs le ${r.date}, ne pas modifier à la main).
-- À exécuter d'un bloc dans l'éditeur SQL, APRÈS schema.sql et schema_demo.sql. Rejouable.
-- Organisme fictif : ${r.organisme}. Mot de passe des 6 comptes partagés : public par nature (affiché sur la page d'accueil).
-- Les pièces de supabase/seed/fichiers/ sont à déposer à part dans le compartiment « pieces », aux mêmes chemins (text/plain;charset=utf-8).

-- 1. Comptes Auth à UUID fixes (colonnes de jetons à '' et jamais NULL)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated', c.email, extensions.crypt(${q(r.mdp)}, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', ''
from (values
  ${valeursComptes}) c(id, email)
on conflict (id) do nothing;
-- la colonne email de auth.identities est générée : ne pas l'insérer
insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u where u.id::text like '00000000-0000-4000-a000-00000000000_'
on conflict (provider_id, provider) do nothing;

-- 2. Jeu de référence
delete from public.demo_seed;
insert into public.demo_seed (table_nom, id, d, cree_le)
select t.key, e->>'id', e - 'id', coalesce(${date('cree_le')}, ${date('date_creation')}, ${date('date')}, ${date('date_depot')}, now())
from jsonb_each($seed$${s}$seed$::jsonb) t, jsonb_array_elements(t.value) e;

insert into public.demo_meta (cle, valeur) values ('date_generation', to_jsonb(${q(r.date)}::text)), ('mot_de_passe', to_jsonb(${q(r.mdp)}::text))
on conflict (cle) do update set valeur = excluded.valeur;

-- 3. Mise en place (dates décalées au jour courant, comptes remis à l'état initial)
select public.reinitialiser_demo();
`;
  fs.writeFileSync(path.join(SORTIE, 'charger.sql'), sql, 'utf8');
  const ko = n => (n / 1024).toFixed(1) + ' ko';
  console.log('Tables : ' + Object.keys(r.T).length + ' — lignes : ' + Object.values(r.T).reduce((a, x) => a + x.length, 0));
  console.log('Fichiers : ' + r.fichiers.length + ' — seed.json ' + ko(Buffer.byteLength(s)) + ' — charger.sql ' + ko(Buffer.byteLength(sql)));
} finally { await navigateur.close(); serveur.close(); }
