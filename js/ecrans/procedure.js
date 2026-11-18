/* Aide au choix de la procédure (renforcée) : type d'acheteur, nature, allotissement, dérogation des « petits lots »,
   date de lancement, publicité et profil d'acheteur. Aide à la décision seulement : le choix revient à l'acheteur.

   Seuils au 1er janvier 2026 — sources consultées le 19/11/2026 :
   - Seuils de procédure formalisée 2026-2027 (règlements délégués (UE) 2025/2150, 2025/2151 et 2025/2152 du 22/10/2025 ;
     avis NOR ECOM2600976V, JORF n° 0010 du 13/01/2026, annexe 2 du code de la commande publique) :
     fournitures et services 140 000 € HT (autorités publiques centrales), 216 000 € HT (autres pouvoirs adjudicateurs, dont
     collectivités territoriales), 432 000 € HT (entités adjudicatrices, défense et sécurité) ; travaux 5 404 000 € HT.
     Source : https://www.marche-public.fr/contrats-publics/CCP-publication-nouveaux-seuils-2026.htm
     (les valeurs 221 000 € et 5 538 000 € étaient celles de 2024-2025).
   - Décret n° 2025-1386 du 29/12/2025 : dispense de publicité et de mise en concurrence pour les travaux à 100 000 € HT,
     pérennisée à compter du 01/01/2026 ; pour les fournitures et services, 40 000 € → 60 000 € HT à compter du 01/04/2026
     (art. R. 2122-8) ; mise à disposition du DCE sur le profil d'acheteur à partir de 60 000 € HT (art. R. 2132-2).
     Sources : https://www.seban-associes.avocat.fr/marches-publics-simplification-clarification-et-modification-de-certains-seuils-par-deux-decrets-du-29-decembre-2025/
               https://www.weka.fr/actualite/commande-publique/article/deux-decrets-de-fin-d-annee-modifient-le-code-de-la-commande-publique-208887/
   - Publicité au BOAMP ou dans un JAL à partir de 90 000 € HT en procédure adaptée : repris de sources secondaires, texte non relu → « à vérifier ».
   - Dérogation des petits lots (lots < 80 000 € HT en fournitures et services, < 1 000 000 € HT en travaux, dans la limite
     de 20 % de la valeur totale) : non vérifiée dans les sources consultées → « à vérifier ».
   Toutes ces valeurs sont paramétrables (Paramètres › Seuils de procédure, pour celles qui y figurent). */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  const SEUILS_2026 = {
    date_effet: '2026-01-01',
    dispense_travaux: 100000,
    dispense_fournitures_services: 60000, dispense_fournitures_services_avant: 40000, dispense_fournitures_services_depuis: '2026-04-01',
    publicite_obligatoire: 90000, profil_acheteur: 60000,
    formalise_fournitures_services: 216000, formalise_fs_etat: 140000, formalise_fs_ea_defense: 432000, formalise_travaux: 5404000,
    petits_lots_fs: 80000, petits_lots_travaux: 1000000, petits_lots_part: 0.2
  };
  // Statut de vérification de chaque valeur par défaut (affiché tel quel).
  const VERIF = {
    dispense_travaux: ['vérifié', 'Décret n° 2025-1386 du 29/12/2025 (pérennisation au 01/01/2026)'],
    dispense_fournitures_services: ['vérifié', 'Décret n° 2025-1386 du 29/12/2025, art. R. 2122-8 : 60 000 € HT à compter du 01/04/2026 (40 000 € HT avant)'],
    profil_acheteur: ['vérifié', 'Décret n° 2025-1386, art. R. 2132-2'],
    publicite_obligatoire: ['à vérifier', 'Seuil de publicité au BOAMP ou dans un JAL (art. R. 2131-12) : non relu dans le texte officiel'],
    formalise_fs_etat: ['vérifié', 'Règlement délégué (UE) 2025/2152 ; avis JORF du 13/01/2026'],
    formalise_fournitures_services: ['vérifié', 'Règlement délégué (UE) 2025/2152 ; avis JORF du 13/01/2026'],
    formalise_fs_ea_defense: ['vérifié', 'Règlement délégué (UE) 2025/2150 ; avis JORF du 13/01/2026'],
    formalise_travaux: ['vérifié', 'Règlements délégués (UE) 2025/2150 et 2025/2152 ; avis JORF du 13/01/2026'],
    petits_lots_fs: ['à vérifier', 'Dérogation des petits lots (art. R. 2123-1, 2°) : non vérifiée dans les sources consultées'],
    petits_lots_travaux: ['à vérifier', 'Idem'], petits_lots_part: ['à vérifier', 'Idem']
  };
  const ACHETEURS = { collectivite: 'Collectivité territoriale ou autre pouvoir adjudicateur', etat: 'État et ses établissements publics (autorités publiques centrales)', entite: 'Entité adjudicatrice (opérateur de réseau)', defense: 'Marché de défense ou de sécurité' };

  // Calcul pur, testable : { acheteur, nature, lots: [montants HT], date (AAAA-MM-JJ), urgence, infructueux } × seuils.
  function aide(entree, seuilsParam) {
    const s = Object.assign({}, SEUILS_2026, seuilsParam || {});
    const travaux = entree.nature === 'travaux';
    const lots = (entree.lots || []).map(Number).filter(x => x > 0);
    const total = Calcul.somme(lots);
    const date = entree.date || D.aujourdhui();
    const dispense = travaux ? s.dispense_travaux : (date < s.dispense_fournitures_services_depuis ? s.dispense_fournitures_services_avant : s.dispense_fournitures_services);
    const formalise = travaux ? s.formalise_travaux : ({ etat: s.formalise_fs_etat, entite: s.formalise_fs_ea_defense, defense: s.formalise_fs_ea_defense }[entree.acheteur] || s.formalise_fournitures_services);
    const r = { total, dispense, formalise, seuils: s, lots: [], notes: [] };
    const eur = Calcul.euros;
    if (total < dispense) { r.niveau = 1; r.procedure = 'Marché sans publicité ni mise en concurrence préalables'; r.publicite = 'Aucune obligatoire';
      r.explication = 'Valeur totale ' + eur(total) + ' HT, sous le seuil de dispense de ' + eur(dispense) + ' HT' + (travaux ? ' (travaux)' : ' (fournitures et services' + (date < s.dispense_fournitures_services_depuis ? ', seuil applicable avant le 01/04/2026' : '') + ')') + '. Choisir une offre pertinente, bien utiliser les deniers publics, ne pas contracter systématiquement avec le même opérateur.'; }
    else if (total < formalise) { r.niveau = total < s.publicite_obligatoire ? 2 : 3; r.procedure = 'Procédure adaptée (MAPA)';
      r.publicite = total < s.publicite_obligatoire ? 'Publicité adaptée, librement choisie' : 'Avis au BOAMP ou dans un journal d\'annonces légales (seuil de ' + eur(s.publicite_obligatoire) + ' HT, à vérifier)';
      r.explication = 'Valeur totale ' + eur(total) + ' HT, entre le seuil de dispense (' + eur(dispense) + ') et le seuil européen (' + eur(formalise) + ' HT).'; }
    else { r.niveau = 4; r.procedure = 'Procédure formalisée (appel d\'offres ouvert ou restreint, ou autre procédure formalisée si ses conditions sont réunies)'; r.publicite = 'Avis au BOAMP et au JOUE';
      r.explication = 'Valeur totale ' + eur(total) + ' HT, au moins égale au seuil européen de ' + eur(formalise) + ' HT applicable à ce type d\'acheteur.'; }
    r.profil = total >= s.profil_acheteur ? 'DCE mis à disposition gratuitement sur le profil d\'acheteur (à partir de ' + eur(s.profil_acheteur) + ' HT)' : 'Pas d\'obligation de profil d\'acheteur à ce montant';
    // Petits lots : seulement si la valeur totale atteint le seuil formalisé et qu'il y a plusieurs lots.
    const plafondLot = travaux ? s.petits_lots_travaux : s.petits_lots_fs, plafondCumul = s.petits_lots_part * total;
    let cumul = 0; const ordre = lots.map((m, i) => ({ i, m })).sort((a, b) => a.m - b.m);
    const eligibles = new Set();
    if (r.niveau === 4 && lots.length > 1) for (const x of ordre) if (x.m < plafondLot && cumul + x.m <= plafondCumul) { cumul += x.m; eligibles.add(x.i); }
    r.lots = lots.map((m, i) => ({ numero: i + 1, montant: m, procedure: r.niveau < 4 ? r.procedure : eligibles.has(i) ? 'Procédure adaptée possible (dérogation des petits lots, à vérifier)' : 'Procédure formalisée' }));
    r.cumulPetitsLots = cumul;
    if (r.niveau === 4 && lots.length > 1) r.notes.push('Dérogation des petits lots (à vérifier) : lots de moins de ' + eur(plafondLot) + ' HT, dans la limite de ' + Math.round(s.petits_lots_part * 100) + ' % de la valeur totale (' + eur(plafondCumul) + ' HT) — ' + eligibles.size + ' lot(s) retenu(s) pour ' + eur(cumul) + ' HT.');
    r.notes.push('La valeur prise en compte est la valeur totale estimée de tous les lots, sur toute la durée du marché, reconductions et options comprises.');
    if (entree.urgence) r.notes.push('Urgence impérieuse résultant de circonstances extérieures et imprévisibles : un marché sans publicité ni mise en concurrence peut être envisagé (art. R. 2122-1) — conditions strictes, à justifier.');
    if (entree.infructueux) r.notes.push('Après un appel d\'offres infructueux (aucune offre, ou seulement des offres inappropriées), une procédure sans publicité ni mise en concurrence est possible sans modifier substantiellement les conditions initiales (art. R. 2122-2) — à vérifier au cas par cas.');
    r.justification = 'Valeur totale estimée : ' + eur(total) + ' HT (' + lots.length + ' lot(s), ' + (E.L.nature[entree.nature] || entree.nature).toLowerCase() + ', ' + (ACHETEURS[entree.acheteur] || '').toLowerCase() + '). '
      + r.explication + ' Procédure envisagée : ' + r.procedure + '. Publicité : ' + r.publicite + '. Seuils au ' + U.date(s.date_effet) + ', date de lancement ' + U.date(date) + '.';
    return r;
  }
  E.SEUILS_2026 = SEUILS_2026; E.aideProcedure2026 = aide;

  E.ecranProcedure = async function () {
    const params = await D.lister('parametres');
    const ligne = params.find(p => p.id === 'seuils');
    // Paramètres de l'administrateur (seuils de base) prioritaires ; les seuils propres à cet écran restent ceux de 2026.
    const seuils = Object.assign({}, SEUILS_2026, ligne && ligne.valeur);
    const parametres = !!(ligne && ligne.valeur);
    const cid = U.param('consultation'); let c = null, lotsC = [];
    if (cid) { c = await D.lire('consultations', cid); if (c && D.voitConsultation(c)) lotsC = await D.lister('lots', { consultation_id: cid }, { ordre: 'numero' }); else c = null; }
    const resultat = h('div', { id: 'resultat-procedure', 'aria-live': 'polite' });
    const ligneLot = m => h('div.proc-lot', h('input.saisie', { type: 'number', min: 0, step: 'any', value: m == null ? '' : m, 'aria-label': 'Montant estimé du lot (€ HT)', oninput: () => calculer() }),
      h('button.lien', { type: 'button', 'aria-label': 'Retirer ce lot', onclick: e => { const z = e.currentTarget.parentElement; if (zoneLots.children.length > 1) { z.remove(); renumeroter(); calculer(); } } }, 'Retirer'));
    const zoneLots = h('div.proc-lots');
    const renumeroter = () => Array.from(zoneLots.children).forEach((z, i) => z.setAttribute('data-lot', 'Lot ' + (i + 1)));
    const initiaux = lotsC.length ? lotsC.map(l => l.montant_estime || null) : [c && c.montant_estime ? c.montant_estime : 120000];
    initiaux.forEach(m => zoneLots.appendChild(ligneLot(m))); renumeroter();
    const choix = (id, options, val) => h('select.saisie', { id, onchange: () => calculer() }, Object.entries(options).map(([k, v]) => h('option', { value: k, selected: k === val }, v)));
    const fAcheteur = choix('proc-acheteur', ACHETEURS, 'collectivite');
    const fNature = choix('proc-nature', E.L.nature, c ? c.nature : 'fournitures');
    const fDate = h('input.saisie', { id: 'proc-date', type: 'date', value: D.aujourdhui(), onchange: () => calculer() });
    const fUrgence = h('input', { type: 'checkbox', id: 'proc-urgence', onchange: () => calculer() });
    const fInfruct = h('input', { type: 'checkbox', id: 'proc-infructueux', onchange: () => calculer() });
    const champ = (libelle, ctl, idc) => h('div.champ', h('label', { for: idc }, libelle), ctl);
    function calculer() {
      const r = aide({ acheteur: fAcheteur.value, nature: fNature.value, date: fDate.value, urgence: fUrgence.checked, infructueux: fInfruct.checked,
        lots: Array.from(zoneLots.querySelectorAll('input')).map(i => Number(i.value) || 0) }, seuils);
      const ton = ['neutre', 'ok', 'info', 'alerte', 'danger'][r.niveau];
      resultat.replaceChildren(
        h('div.proc-verdict.' + ton, h('span', 'Procédure suggérée (aide, à confirmer par l\'acheteur)'), h('b', { id: 'proc-verdict' }, r.procedure), h('p', r.explication)),
        U.definition([['Valeur totale estimée', h('b', U.euros(r.total) + ' HT')], ['Seuil de dispense appliqué', U.euros(r.dispense) + ' HT'], ['Seuil européen appliqué', U.euros(r.formalise) + ' HT'], ['Publicité', r.publicite], ['Profil d\'acheteur', r.profil]]),
        r.lots.length > 1 ? U.tableau([{ titre: 'Lot', classe: 'etroit', valeur: l => 'Lot ' + l.numero }, { titre: 'Montant HT', num: true, valeur: l => U.euros(l.montant) }, { titre: 'Procédure pour ce lot', valeur: l => l.procedure }], r.lots) : null,
        h('ul.proc-notes', r.notes.map(n => h('li', n))),
        h('div.champ', h('label', { for: 'proc-justif' }, 'Justification proposée (à reprendre dans la fiche du besoin ou le rapport de présentation)'), h('textarea.saisie', { id: 'proc-justif', rows: 4, readOnly: true, value: r.justification })));
      return r;
    }
    const tableSeuils = U.tableau([{ titre: 'Seuil', valeur: x => x[0] }, { titre: 'Valeur', num: true, valeur: x => h('b', U.euros(x[1]) + ' HT') },
      { titre: 'État', valeur: x => { const v = VERIF[x[2]] || ['à vérifier', '']; const perso = parametres && ligne.valeur[x[2]] != null && Number(ligne.valeur[x[2]]) !== SEUILS_2026[x[2]]; return [U.badge(perso ? 'paramétré par l\'administrateur' : v[0], perso ? 'info' : v[0] === 'vérifié' ? 'ok' : 'alerte'), h('div.aide', v[1])]; } }],
      [['Dispense de procédure — travaux', seuils.dispense_travaux, 'dispense_travaux'], ['Dispense de procédure — fournitures et services (depuis le 01/04/2026)', seuils.dispense_fournitures_services, 'dispense_fournitures_services'],
        ['Profil d\'acheteur (DCE en ligne)', seuils.profil_acheteur, 'profil_acheteur'], ['Publicité BOAMP ou JAL (procédure adaptée)', seuils.publicite_obligatoire, 'publicite_obligatoire'],
        ['Procédure formalisée — fournitures et services, État', seuils.formalise_fs_etat, 'formalise_fs_etat'], ['Procédure formalisée — fournitures et services, collectivités', seuils.formalise_fournitures_services, 'formalise_fournitures_services'],
        ['Procédure formalisée — fournitures et services, entités adjudicatrices, défense', seuils.formalise_fs_ea_defense, 'formalise_fs_ea_defense'], ['Procédure formalisée — travaux', seuils.formalise_travaux, 'formalise_travaux'],
        ['Petits lots — fournitures et services', seuils.petits_lots_fs, 'petits_lots_fs'], ['Petits lots — travaux', seuils.petits_lots_travaux, 'petits_lots_travaux']], { legende: 'Seuils appliqués' });
    const page = h('div', U.titrePage('Aide au choix de la procédure', 'Seuils 2026, allotissement, petits lots, publicité. Aide à la décision : le choix et sa justification reviennent à l\'acheteur.',
      c ? [h('a.bouton.secondaire', { href: '#/consultation/' + c.id + '/dce' }, 'Revenir à ' + c.reference)] : null),
      h('div.grille2',
        U.carte('Le besoin' + (c ? ' — ' + c.reference : ''), [
          h('div.formulaire', champ('Type d\'acheteur', fAcheteur, 'proc-acheteur'), champ('Nature', fNature, 'proc-nature'), champ('Date de lancement envisagée', fDate, 'proc-date'),
            h('div.champ.plein', h('label', 'Montant estimé de chaque lot (€ HT, toute durée, reconductions comprises)'), zoneLots,
              h('button.bouton.secondaire.petit', { type: 'button', style: { marginTop: '6px' }, onclick: () => { zoneLots.appendChild(ligneLot(null)); renumeroter(); zoneLots.lastChild.querySelector('input').focus(); } }, 'Ajouter un lot')),
            h('div.champ.case.plein', fUrgence, h('label', { for: 'proc-urgence' }, 'Urgence impérieuse (circonstances extérieures et imprévisibles)')),
            h('div.champ.case.plein', fInfruct, h('label', { for: 'proc-infructueux' }, 'Fait suite à un appel d\'offres infructueux')))]),
        U.carte('Résultat', resultat)),
      U.carte('Seuils en vigueur et sources', [h('div.note-info.alerte', 'Valeurs au 1er janvier 2026, vérifiées le 19/11/2026 sur des sources publiques (marche-public.fr, Seban Avocats, WEKA). Celles marquées « à vérifier » n\'ont pas été relues dans le texte officiel. ' + (parametres ? 'Les seuils de base paramétrés par l\'administrateur sont appliqués.' : 'Seuils de base non paramétrés : valeurs par défaut.')), tableSeuils],
        D.peut('admin.parametres') ? [h('a.bouton.secondaire.petit', { href: '#/parametres' }, 'Paramétrer les seuils')] : null));
    calculer();
    return page;
  };
  U.route('/procedure', E.ecranProcedure);
})();
