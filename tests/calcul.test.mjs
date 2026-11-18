// Tests des règles de calcul : node tests/calcul.test.mjs
import assert from 'node:assert/strict'; import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../js/calcul.js');
let n = 0; const t = (nom, fn) => { fn(); n++; console.log('ok  ' + nom); };

t('arrondi au plus proche, inférieur, supérieur', () => {
  assert.equal(C.arrondir(26.325, { decimales: 2, mode: 'proche' }), 26.33);
  assert.equal(C.arrondir(26.329, { decimales: 2, mode: 'inferieur' }), 26.32);
  assert.equal(C.arrondir(26.321, { decimales: 2, mode: 'superieur' }), 26.33);
  assert.equal(C.arrondir(1.005, { decimales: 2, mode: 'proche' }), 1.01);
  assert.equal(C.arrondir(12.4, { decimales: 0 }), 12);
});
const grille = [
  { id: 'p', parent_id: null, code: '1', libelle: 'Prix', type: 'prix', ponderation: 30 },
  { id: 't', parent_id: null, code: '2', libelle: 'Technique', type: 'qualitatif', ponderation: 65, bareme: 10 },
  { id: 't1', parent_id: 't', code: '2.1', libelle: 'Fonctionnel', type: 'qualitatif', ponderation: 40, bareme: 10 },
  { id: 't2', parent_id: 't', code: '2.2', libelle: 'Sécurité', type: 'qualitatif', ponderation: 25, bareme: 10 },
  { id: 'e', parent_id: null, code: '3', libelle: 'Environnement', type: 'qualitatif', ponderation: 5, bareme: 5 }];
t('contrôle de cohérence : total 100 et sous-critères', () => {
  assert.equal(C.controleGrille(grille).coherent, true);
  const k = grille.map(x => x.id === 'e' ? { ...x, ponderation: 10 } : x);
  assert.equal(C.controleGrille(k).coherent, false); assert.match(C.controleGrille(k).erreurs[0], /105 au lieu de 100/);
  const k2 = grille.map(x => x.id === 't2' ? { ...x, ponderation: 20 } : x);
  assert.match(C.controleGrille(k2).erreurs.join(' '), /somme des sous-critères fait 60 pour une pondération de 65/);
  assert.equal(C.controleGrille([]).coherent, false);
});
t('formule de prix proportionnelle : N = pondération × Pmin / P', () => {
  assert.equal(C.arrondir(C.notePrix('proportionnelle', 100000, [100000, 125000, 80000], 30), { decimales: 2 }), 24);
  assert.equal(C.notePrix('proportionnelle', 80000, [100000, 125000, 80000], 30), 30);
  assert.equal(C.arrondir(C.notePrix('proportionnelle', 125000, [100000, 125000, 80000], 30), { decimales: 2 }), 19.2);
});
t('formule linéaire bornée à 0 ; offre à 0 € (+1 € à toutes)', () => {
  assert.equal(C.notePrix('lineaire', 250000, [100000, 250000], 40), 0);
  assert.equal(C.notePrix('lineaire', 110000, [100000, 110000], 40), 36);
  assert.equal(C.notePrix('proportionnelle', 0, [0, 99], 30), 30);
  assert.equal(C.arrondir(C.notePrix('proportionnelle', 99, [0, 99], 30), { decimales: 2 }), 0.3);
});
const offres = [{ id: 'a', candidat: 'A', montant_ht: 100000, montant_valide: true }, { id: 'b', candidat: 'B', montant_ht: 80000, montant_valide: true }, { id: 'c', candidat: 'C', montant_ht: 125000, montant_valide: true }];
const N = (o, c, note, statut = 'validee') => ({ offre_id: o, critere_id: c, note, statut });
const g = { formule_prix: 'proportionnelle', arrondi_decimales: 2, arrondi_mode: 'proche' };
t('classement provisoire à partir des seules notes validées', () => {
  const notes = [N('a', 't1', 8), N('a', 't2', 7), N('a', 'e', 4), N('b', 't1', 6), N('b', 't2', 6), N('b', 'e', 3), N('c', 't1', 9), N('c', 't2', 9, 'proposee'), N('c', 'e', 5)];
  const r = C.calculLot(grille, offres, notes, g);
  const A = r.lignes.find(l => l.offre_id === 'a'), B = r.lignes.find(l => l.offre_id === 'b'), Cc = r.lignes.find(l => l.offre_id === 'c');
  assert.equal(A.total, 24 + 32 + 17.5 + 4); assert.equal(B.total, 30 + 24 + 15 + 3);
  assert.equal(A.rang, 1); assert.equal(B.rang, 2);
  assert.equal(Cc.total, null); assert.equal(Cc.rang, null); assert.deepEqual(Cc.manquants, ['2.2']);
  assert.equal(r.classementComplet, false);
  assert.equal(A.sousTotaux.t, 49.5);
});
t('montant non validé : aucune note de prix pour personne', () => {
  const o2 = offres.map(o => o.id === 'c' ? { ...o, montant_valide: false } : o);
  const r = C.calculLot(grille, o2, [], g);
  assert.ok(r.lignes.every(l => l.detail.p.points === null)); assert.equal(r.nbClassees, 0);
});
t('offre écartée par décision : hors du prix le plus bas et non classée', () => {
  const o2 = offres.map(o => o.id === 'b' ? { ...o, ecartee: true } : o);
  const notes = ['a', 'c'].flatMap(o => [N(o, 't1', 8), N(o, 't2', 8), N(o, 'e', 4)]);
  const r = C.calculLot(grille, o2, notes, g);
  assert.equal(r.lignes.find(l => l.offre_id === 'a').detail.p.points, 30);
  assert.equal(r.lignes.find(l => l.offre_id === 'b').rang, null); assert.equal(r.classementComplet, true);
});
t('ex æquo au même rang', () => {
  const o2 = [{ id: 'a', candidat: 'A', montant_ht: 100, montant_valide: true }, { id: 'b', candidat: 'B', montant_ht: 100, montant_valide: true }];
  const notes = ['a', 'b'].flatMap(o => [N(o, 't1', 8), N(o, 't2', 8), N(o, 'e', 4)]);
  const r = C.calculLot(grille, o2, notes, g); assert.deepEqual(r.lignes.map(l => l.rang), [1, 1]);
});
t('indices de prix : signalement sans rejet', () => {
  const r = C.indicesPrix([{ id: 'a', candidat: 'A', montant_ht: 104500 }, { id: 'b', candidat: 'B', montant_ht: 118400 }, { id: 'c', candidat: 'C', montant_ht: 71900, total_lignes: 71900 }, { id: 'd', candidat: 'D', montant_ht: null }], 25, 110000);
  const c = r.find(x => x.offre_id === 'c'); assert.equal(c.signalements.length, 2); assert.match(c.signalements[0].texte, /35,5 %/);
  assert.equal(r.find(x => x.offre_id === 'a').signalements.length, 0); assert.equal(r.find(x => x.offre_id === 'd').signalements[0].type, 'manquant');
  const inc = C.indicesPrix([{ id: 'a', candidat: 'A', montant_ht: 100, total_lignes: 120 }], 25, 0); assert.equal(inc[0].signalements[0].type, 'incoherence');
});
t('computation des seuils par famille homogène', () => {
  const b = [{ annee: 2026, nature: 'fournitures', famille: 'Mobilier', montant_estime: 38000 }, { annee: 2026, nature: 'fournitures', famille: 'Mobilier', montant_estime: 31000 }, { annee: 2026, nature: 'travaux', famille: 'Toiture', montant_estime: 240000 }, { annee: 2026, nature: 'services', famille: 'Nettoyage', montant_estime: 228000 }, { annee: 2026, nature: 'fournitures', famille: 'Papier', montant_estime: 12000, statut: 'abandonne' }];
  const r = C.computation(b, C.SEUILS_DEFAUT);
  const m = r.find(x => x.famille === 'Mobilier'); assert.equal(m.total, 69000); assert.equal(m.niveau, 2);
  assert.equal(r.find(x => x.famille === 'Toiture').niveau, 3); assert.equal(r.find(x => x.famille === 'Nettoyage').niveau, 4);
  assert.equal(r.some(x => x.famille === 'Papier'), false);
  assert.equal(C.aideProcedure('fournitures', 38000, C.SEUILS_DEFAUT).niveau, 1);
});
t('échéances des marchés reconductibles', () => {
  const m = { date_debut: '2025-01-31', duree_mois: 12, reconductible: true, nb_reconductions_max: 2, duree_reconduction_mois: 12, preavis_mois: 3 };
  const e = C.echeancesMarche(m, 0); assert.equal(e.fin, '2026-01-31'); assert.equal(e.echeances[1].date, '2025-10-31'); assert.equal(e.finMax, '2028-01-31');
  assert.equal(C.echeancesMarche(m, 2).echeances.length, 1); assert.equal(C.ajouterMois('2026-01-31', 1), '2026-02-28');
  assert.equal(C.joursAvant('2026-12-01', '2026-11-18'), 13);
});
t('révision des prix par formule, coefficient arrondi au millième supérieur', () => {
  assert.equal(C.revisionPrix(0.15, 112.4, 108.2), 1.033); // 0,15 + 0,85 × 112,4 / 108,2 = 1,03299… arrondi au millième supérieur
  assert.equal(C.revisionPrix(0.15, 112.5, 108.2), 1.034); // 1,03377…
  assert.equal(C.revisionPrix(0.125, 100, 100), 1);
  assert.equal(C.revisionPrix(0.15, 100, 0), null); assert.equal(C.revisionPrix(1.2, 100, 100), null);
});
t('délais de support en heures ouvrées (lundi-vendredi, 8 h-17 h)', () => {
  const ven16 = new Date(2026, 10, 20, 16, 0); // vendredi 20/11/2026 16:00
  const r = C.ajouterHeuresOuvrees(ven16, 4); assert.equal(r.getDay(), 1); assert.equal(r.getHours(), 11); // lundi 11:00
  const sam = new Date(2026, 10, 21, 10, 0); assert.equal(C.ajouterHeuresOuvrees(sam, 1).getHours(), 9); // lundi 9:00
  const e = C.echeancesSupport('P1', new Date(2026, 10, 21, 22, 0)); assert.equal(new Date(e.prise_en_charge).getHours(), 23); // P1 : en continu, la nuit et le week-end
  const p3 = C.echeancesSupport('P3', new Date(2026, 10, 18, 10, 0)); assert.equal(p3.contournement, null); assert.equal(new Date(p3.retablissement).getDate(), 25); // 5 jours ouvrés
});
t('consolidation : moyenne des contributions validées, si la grille le prévoit', () => {
  const gr = [{ id: 'q', parent_id: null, code: '1', libelle: 'Technique', type: 'qualitatif', ponderation: 100, bareme: 10 }];
  const o = [{ id: 'a', candidat: 'A', montant_ht: 1, montant_valide: true }];
  const notes = [N('a', 'q', 6), N('a', 'q', 8), N('a', 'q', 9, 'proposee')];
  assert.equal(C.calculLot(gr, o, notes, { ...g, consolidation: 'moyenne' }).lignes[0].total, 70);
  assert.equal(C.calculLot(gr, o, notes, g).lignes[0].total, 60);
});
t('lecture des critères d’un règlement de consultation', () => {
  const rc = ['ARTICLE 5 — Critères de jugement des offres', 'Critère n° 1 : Prix des prestations — 30 points', 'Critère n° 2 : Valeur technique de l’offre — 65 points',
    '2.1 Adéquation fonctionnelle, paramétrage et ergonomie : 25 points', '2.2 Architecture technique et sécurité : 40 points', 'Critère n° 3 : Performance environnementale — 5 points', 'Le candidat est informé que…'].join('\n');
  const k = C.lireCriteres(rc);
  assert.deepEqual(k.map(x => [x.code, x.ponderation, x.type]), [['1', 30, 'prix'], ['2', 65, 'qualitatif'], ['2.1', 25, 'qualitatif'], ['2.2', 40, 'qualitatif'], ['3', 5, 'qualitatif']]);
  assert.equal(k[0].libelle, 'Prix des prestations');
});
t('contrôle de la clé du SIRET', () => {
  assert.equal(C.siretValide('732 829 320 00074'), true); assert.equal(C.siretValide('73282932000075'), false); assert.equal(C.siretValide('1234'), false);
});
console.log('\n' + n + ' groupes de tests réussis.');
