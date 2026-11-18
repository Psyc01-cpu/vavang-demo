// Essai rapide du mode supabase (vraie base) depuis le serveur local, sous un nom d'hôte non local.
import puppeteer from 'puppeteer-core';
const URL = process.argv[2] || 'http://vavang.localhost:4173/';
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--host-resolver-rules=MAP vavang.localhost 127.0.0.1'] });
const p = await b.newPage(); await p.setViewport({ width: 1366, height: 900 });
const erreurs = []; p.on('pageerror', e => erreurs.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') erreurs.push('console ' + m.text()); });
await p.goto(URL, { waitUntil: 'networkidle0' });
await p.screenshot({ path: process.argv[3] || 'captures/_essai.png' }); console.log('mode', await p.evaluate(() => D.mode), '| org', await p.evaluate(() => CONFIG.organisme));
for (const profil of ['gestionnaire', 'lecteur', 'prescripteur', 'valideur', 'support']) {
  const r = await p.evaluate(async pr => { try { await D.connexion(pr + '@demo.example', 'Demonstration-2026'); const c = await D.lister('consultations'); const o = await D.lister('offres'); const n = await D.lister('notes'); const j = await D.lister('journal').catch(e => 'ERR ' + e.message);
    const res = { u: D.utilisateur && D.utilisateur.nom, role: D.utilisateur && D.utilisateur.role, droits: D.droits.size, consult: c.length, offres: o.length, notes: n.length, journal: Array.isArray(j) ? j.length : j }; await D.deconnexion(); return res; } catch (e) { return 'ERREUR ' + e.message; } }, profil);
  console.log(profil, JSON.stringify(r));
}
const a = await p.evaluate(async () => { try { await D.connexion('admin@demo.example', 'Demonstration-2026'); return 'connecte sans code ?! droits=' + D.droits.size; } catch (e) { return 'admin sans code : ' + (e.mfa ? 'code demandé (mfa)' : e.message) + ' | mfaEnAttente=' + D.mfaEnAttente; } });
console.log(a);
const f = await p.evaluate(async () => { try { await D.deconnexion(); } catch {} try { await D.connexion('lecteur@demo.example', 'mauvais'); } catch (e) { return 'mauvais mdp : ' + e.message; } });
console.log(f);
console.log('erreurs JS :', erreurs.length ? erreurs.join('\n') : 'aucune');
await b.close();
