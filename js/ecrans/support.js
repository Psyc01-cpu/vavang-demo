/* Demandes d'assistance (outil de tickets) : numéro unique, criticité P1 à P4, délais contractuels du CCTP,
   statut, intervenant, historique des échanges, clôture validée par la collectivité. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const STATUTS = { nouveau: ['Nouveau', 'info'], pris_en_charge: ['Pris en charge', 'info'], en_cours: ['Diagnostic en cours', 'alerte'], contourne: ['Contournement en place', 'alerte'],
    resolu: ['Résolu — en attente de validation', 'ok'], clos: ['Clos', 'neutre'] };
  const ETAPES = [['prise_en_charge', 'Prise en charge', 'pris_en_charge_le'], ['diagnostic', 'Diagnostic initial', 'diagnostic_le'], ['contournement', 'Contournement', 'contournement_le'], ['retablissement', 'Rétablissement', 'resolu_le']];
  const CRIT = Object.entries(Calcul.DELAIS_SUPPORT).map(([k, v]) => [k, v.libelle]);
  const DEFINITIONS = { P1: 'Indisponibilité totale, perte de données, incident de sécurité majeur, fonction essentielle bloquée sans contournement. Délais courus 24 h/24, 7 j/7.',
    P2: 'Fonction essentielle en panne pour plusieurs utilisateurs, sans contournement acceptable.', P3: 'Anomalie non bloquante, avec contournement.', P4: 'Question, demande d\'assistance, de paramétrage ou d\'évolution.' };
  const delaiTexte = v => !v ? 'Sans objet' : v[0] + ' ' + (v[1] === 'h' ? 'heure' + (v[0] > 1 ? 's' : '') : v[1] === 'ho' ? 'heures ouvrées' : 'jour' + (v[0] > 1 ? 's' : '') + ' ouvré' + (v[0] > 1 ? 's' : ''));
  const voitTout = () => D.peut('support.traiter') || D.peut('admin.utilisateurs');

  function etatDelai(t, k, champ) {
    const ech = t.echeances && t.echeances[k]; if (!ech) return { texte: 'Sans objet', ton: 'neutre' };
    const fait = t[champ] || (k === 'contournement' && t.resolu_le);
    if (fait) return fait <= ech ? { texte: 'Respecté (' + U.dateHeure(fait) + ')', ton: 'ok' } : { texte: 'Dépassé (' + U.dateHeure(fait) + ')', ton: 'danger' };
    if (t.statut === 'clos') return { texte: '—', ton: 'neutre' };
    return D.maintenant() > ech ? { texte: 'En retard depuis le ' + U.dateHeure(ech), ton: 'danger' } : { texte: 'Avant le ' + U.dateHeure(ech), ton: 'info' };
  }

  E.tickets = async function () {
    const tous = await D.lister('tickets', {}, { ordre: 'date_creation', desc: true });
    const liste = voitTout() ? tous : tous.filter(t => t.demandeur_id === D.utilisateur.id);
    const nouveau = () => U.editer('Nouvelle demande d\'assistance', [
      { nom: 'objet', libelle: 'Objet', requis: true, large: true },
      { nom: 'criticite', libelle: 'Criticité', type: 'choix', requis: true, vide: false, options: CRIT, defaut: 'P4', aide: 'P1 : ' + DEFINITIONS.P1 + ' P2 : ' + DEFINITIONS.P2 + ' P3 : ' + DEFINITIONS.P3 + ' P4 : ' + DEFINITIONS.P4 },
      { nom: 'description', libelle: 'Description (écran concerné, ce que vous faisiez, ce qui s\'est passé)', type: 'long', requis: true, lignes: 6 },
      { nom: 'fichiers', libelle: 'Capture d\'écran ou pièce jointe', type: 'fichier', multiple: true, large: true }], { }, async v => {
      const fichiers = v.fichiers || []; delete v.fichiers;
      // En ligne, le numéro est attribué par le serveur (séquence unique) : le demandeur ne voit que ses tickets, un calcul local créerait des doublons.
      const enLigne = D.mode === 'supabase';
      const an = new Date().getFullYear(); const n = enLigne ? 0 : tous.filter(t => String(t.numero).startsWith('T-' + an)).length + 1;
      const maintenant = D.maintenant();
      // En ligne, les pièces jointes vont dans support/<identifiant du déclarant> (seuls lui, le support et l'administrateur les lisent).
      const pj = []; for (const f of fichiers) pj.push({ nom: f.name, chemin: await D.deposer(f, enLigne ? 'support/' + D.utilisateur.id : 'support'), taille: f.size });
      const ligne = Object.assign(v, enLigne ? {} : { numero: 'T-' + an + '-' + String(n).padStart(4, '0') }, { date_creation: maintenant, demandeur_id: D.utilisateur.id, demandeur_nom: D.utilisateur.nom, service: D.utilisateur.service || '',
        statut: 'nouveau', echeances: Calcul.echeancesSupport(v.criticite, maintenant), pieces_jointes: pj,
        historique: [{ date: maintenant, auteur: D.utilisateur.nom, type: 'Création', texte: 'Demande créée (' + v.criticite + ').' }] });
      let t;
      try { t = await D.creer('tickets', ligne, { action: 'Déclaration d\'une demande d\'assistance', libelle: v.objet }); }
      catch (e) { if (enLigne) for (const p of pj) await D.supprimerFichier(p.chemin).catch(() => {}); throw e; }
      if (enLigne) { const t2 = await D.lire('tickets', t.id); if (t2 && t2.numero) { t = t2; U.message('Demande ' + t.numero + ' enregistrée.'); } }
      await E.notifierDroit('support.traiter', 'Nouvelle demande ' + (enLigne && t.numero ? t.numero + ' ' : '') + v.criticite + ' : ' + v.objet, '/support/' + t.id);
      setTimeout(() => U.aller('/support/' + t.id), 30);
    }, { large: true, libelle: 'Envoyer la demande' });
    const enRetard = t => ETAPES.some(e => etatDelai(t, e[0], e[2]).ton === 'danger');
    return h('div', U.titrePage('Demandes d\'assistance', voitTout() ? 'Toutes les demandes de la collectivité.' : 'Vos demandes au support.', D.peut('support.declarer') ? [U.bouton('Nouvelle demande', nouveau, 'accent')] : null),
      h('div.indicateurs',
        h('div.indicateur', h('b', liste.filter(t => t.statut !== 'clos').length), h('span', 'demandes ouvertes')),
        h('div.indicateur.accent', h('b', liste.filter(t => t.statut !== 'clos' && ['P1', 'P2'].includes(t.criticite)).length), h('span', 'ouvertes en P1 ou P2')),
        h('div.indicateur', h('b', liste.filter(t => t.statut === 'resolu').length), h('span', 'à valider par la collectivité')),
        h('div.indicateur', h('b', liste.filter(enRetard).length), h('span', 'avec un délai dépassé'))),
      U.carte(null, U.tableau([{ titre: 'Numéro', classe: 'etroit', valeur: t => h('b', t.numero) }, { titre: 'Criticité', classe: 'etroit', valeur: t => U.badge(t.criticite, { P1: 'danger', P2: 'alerte', P3: 'info', P4: 'neutre' }[t.criticite]) },
        { titre: 'Objet', valeur: t => [t.objet, h('div.aide', t.demandeur_nom + (t.service ? ' · ' + t.service : '') + ' · ' + U.dateHeure(t.date_creation))] },
        { titre: 'Intervenant', valeur: t => t.intervenant_nom || '—' }, { titre: 'Statut', valeur: t => U.badge(STATUTS[t.statut][0], STATUTS[t.statut][1]) },
        { titre: 'Délais', valeur: t => enRetard(t) ? U.badge('Délai dépassé', 'danger') : U.badge('Dans les délais', 'ok') }], liste, { surClic: t => U.aller('/support/' + t.id), vide: 'Aucune demande.' })),
      U.carte('Délais de traitement contractuels', U.tableau([{ titre: 'Criticité', valeur: k => h('b', Calcul.DELAIS_SUPPORT[k].libelle) }, { titre: 'Définition', valeur: k => DEFINITIONS[k] }]
        .concat(ETAPES.map(e => ({ titre: e[1], valeur: k => delaiTexte(Calcul.DELAIS_SUPPORT[k][e[0]]) }))), Object.keys(Calcul.DELAIS_SUPPORT)), [h('span.aide', 'Heures ouvrées : du lundi au vendredi, de 8 h à 17 h, heure de La Réunion (jours fériés non déduits par le calcul).')]));
  };
  U.route('/support', E.tickets);

  E.ticket = async function (id) {
    const t = await D.lire('tickets', id); if (!t) throw new Error('Demande introuvable.');
    if (!voitTout() && t.demandeur_id !== D.utilisateur.id) throw new Error('Cette demande ne vous concerne pas.');
    const support = D.peut('support.traiter'), demandeur = t.demandeur_id === D.utilisateur.id, admin = D.peut('admin.utilisateurs');
    const ajouter = async (patch, type, texte, notifier) => {
      const ent = { date: D.maintenant(), auteur: D.utilisateur.nom + (support ? ' (support)' : ''), type, texte };
      await D.modifier('tickets', id, Object.assign(patch, { historique: (t.historique || []).concat([ent]) }), { action: 'Demande d\'assistance ' + t.numero + ' : ' + type, libelle: t.objet, detail: { statut: patch.statut || t.statut } });
      if (notifier === 'demandeur') await E.notifier([t.demandeur_id], t.numero + ' — ' + type + ' : ' + t.objet, '/support/' + id);
      if (notifier === 'support') await E.notifierDroit('support.traiter', t.numero + ' — ' + type + ' : ' + t.objet, '/support/' + id);
      U.recharger();
    };
    const avecTexte = (titre, libelle, fn, requis) => U.editer(titre, [{ nom: 'texte', libelle, type: 'long', requis: requis !== false }], {}, v => fn(v.texte), { libelle: 'Enregistrer' });
    const actions = [];
    if (support && t.statut === 'nouveau') actions.push(U.bouton('Prendre en charge', () => avecTexte('Prise en charge', 'Qualification et premier retour au demandeur', x => ajouter({ statut: 'pris_en_charge', pris_en_charge_le: D.maintenant(), intervenant_nom: D.utilisateur.nom }, 'Prise en charge', x, 'demandeur')), 'accent'));
    if (support && ['pris_en_charge'].includes(t.statut)) actions.push(U.bouton('Communiquer le diagnostic', () => avecTexte('Diagnostic initial', 'Causes probables et plan d\'action', x => ajouter({ statut: 'en_cours', diagnostic_le: D.maintenant() }, 'Diagnostic initial', x, 'demandeur')), 'accent'));
    if (support && ['pris_en_charge', 'en_cours'].includes(t.statut) && t.echeances.contournement) actions.push(U.bouton('Contournement en place', () => avecTexte('Contournement', 'Solution temporaire proposée', x => ajouter({ statut: 'contourne', contournement_le: D.maintenant() }, 'Contournement', x, 'demandeur')), 'secondaire'));
    if (support && ['pris_en_charge', 'en_cours', 'contourne'].includes(t.statut)) actions.push(U.bouton('Proposer la résolution', () => avecTexte('Résolution', 'Solution apportée', x => ajouter({ statut: 'resolu', resolu_le: D.maintenant() }, 'Solution proposée', x, 'demandeur')), 'accent'));
    if ((demandeur || admin) && t.statut === 'resolu') {
      actions.push(U.bouton('Valider et clore', () => avecTexte('Clôture', 'Motif de clôture', x => ajouter({ statut: 'clos', clos_le: D.maintenant(), motif_cloture: x, cloture_validee_par: D.utilisateur.nom }, 'Clôture validée par la collectivité', x, 'support')), 'accent'));
      actions.push(U.bouton('Le problème persiste', () => avecTexte('Réouverture', 'Ce qui ne fonctionne toujours pas', x => ajouter({ statut: 'en_cours' }, 'Réouverture par la collectivité', x, 'support')), 'secondaire'));
    }
    if (t.statut !== 'clos') actions.push(U.bouton('Ajouter un message', () => avecTexte('Message', 'Message', x => ajouter({}, 'Message', x, support ? 'demandeur' : 'support')), 'secondaire'));
    const cloturePossible = t.statut === 'resolu' && t.resolu_le ? Calcul.ajouterHeuresOuvrees(t.resolu_le, 45) : null;
    return h('div', U.fil([['Demandes d\'assistance', '/support'], [t.numero]]),
      U.titrePage(t.numero + ' — ' + t.objet, 'Déclarée par ' + t.demandeur_nom + (t.service ? ' (' + t.service + ')' : '') + ' le ' + U.dateHeure(t.date_creation), [U.badge(t.criticite, { P1: 'danger', P2: 'alerte', P3: 'info', P4: 'neutre' }[t.criticite]), U.badge(STATUTS[t.statut][0], STATUTS[t.statut][1])]),
      cloturePossible ? h('div.note-info', 'Solution proposée le ' + U.dateHeure(t.resolu_le) + '. Sans réponse de la collectivité, la demande pourra être close après relance, à partir du ' + U.dateHeure(cloturePossible.toISOString()) + ' (cinq jours ouvrés, CCTP 3.3.4).') : null,
      h('div.grille2',
        U.carte('Demande', [U.definition([['Numéro', t.numero], ['Créée le', U.dateHeure(t.date_creation)], ['Demandeur', t.demandeur_nom], ['Service', t.service], ['Criticité', Calcul.DELAIS_SUPPORT[t.criticite].libelle], ['Intervenant', t.intervenant_nom || 'Non affecté'],
          ['Statut', STATUTS[t.statut][0]], t.clos_le ? ['Clôture', U.dateHeure(t.clos_le) + ' — ' + t.motif_cloture + ' (validée par ' + t.cloture_validee_par + ')'] : null]), h('p', { style: { whiteSpace: 'pre-wrap', marginTop: '10px' } }, t.description),
          (t.pieces_jointes || []).length ? h('p', 'Pièces jointes : ', t.pieces_jointes.map(p => [h('button.lien', { type: 'button', onclick: U.agir(async () => U.telechargerBlob(await D.telecharger(p.chemin), p.nom)) }, p.nom), ' '])) : null], actions),
        U.carte('Délais contractuels', U.tableau([{ titre: 'Étape', valeur: e => e[1] }, { titre: 'Délai', valeur: e => delaiTexte(Calcul.DELAIS_SUPPORT[t.criticite][e[0]]) },
          { titre: 'Situation', valeur: e => { const s = etatDelai(t, e[0], e[2]); return U.badge(s.texte, s.ton); } }], ETAPES))),
      U.carte('Historique des actions et des échanges', U.tableau([{ titre: 'Date et heure', classe: 'etroit', valeur: x => U.dateHeure(x.date) }, { titre: 'Auteur', valeur: x => x.auteur }, { titre: 'Action', valeur: x => h('b', x.type) }, { titre: 'Contenu', valeur: x => h('span', { style: { whiteSpace: 'pre-wrap' } }, x.texte) }], t.historique || [])));
  };
  U.route('/support/:id', E.ticket);
})();
