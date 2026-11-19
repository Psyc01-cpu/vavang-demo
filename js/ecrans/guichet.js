/* Guichet du support : pas de ligne directe affichée aux agents (canal d'urgence remis aux seuls référents, hors application).
   Le demandeur choisit un type de panne, écrit un commentaire, laisse son numéro de rappel ; un ticket est créé
   (numéro, date et heure de dépôt) et l'équipe support le rappelle aux horaires du guichet. Accessible sans connexion. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans, CFG = window.CONFIG, G = D.GUICHET;
  const HORAIRES = (CFG.support && CFG.support.horaires) || 'du lundi au vendredi, de 8 h à 17 h (heure de La Réunion)';
  const lib = (liste, cle) => (liste.find(x => x[0] === cle) || [])[1] || '';
  // Pictogrammes simples (trait), un par type de panne.
  const PICTOS = {
    connexion: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><path d="M12 15v2"/>',
    compte: '<circle cx="10" cy="8" r="4"/><path d="M3 21c0-4 3-6 7-6 1.4 0 2.6.2 3.6.7"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M16.5 16v-1.5a1.5 1.5 0 0 1 3 0V16"/>',
    ecran: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M12 7.5v4M12 13.5v.2"/>',
    lenteur: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>',
    fichiers: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l3-3 3 3M12 10v8"/>',
    documents: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    analyse: '<path d="M3 21h18M6 17v-5M11 17V7M16 17v-8M20 17v-3"/>',
    droits: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    evolution: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
    autre: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.5M12 16.8v.2"/>'
  };
  const picto = cle => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false'); s.innerHTML = PICTOS[cle] || PICTOS.autre; return s; };
  const delai = v => E.delaiSupport ? E.delaiSupport(v) : '';

  function contenuGuichet() {
    const zone = h('div.guichet-zone');
    const etapes = h('ol.guichet-etapes', ['Type de demande', 'Votre demande', 'Accusé de réception'].map((t, i) => h('li', { 'data-n': i + 1 }, h('span.guichet-num', String(i + 1)), t)));
    const marquer = n => etapes.querySelectorAll('li').forEach((li, i) => { li.classList.toggle('courant', i === n - 1); li.classList.toggle('fait', i < n - 1); if (i === n - 1) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    const focaliser = el => setTimeout(() => { el.tabIndex = -1; el.focus(); }, 30);

    // Étape 1 : grille des types de panne et de demande.
    function etapeTypes() {
      marquer(1);
      const titre = h('h2', 'De quoi s\'agit-il ?');
      zone.replaceChildren(titre, h('p.aide', 'Choisissez ce qui ressemble le plus à votre situation. Vous préciserez ensuite dans un commentaire.'),
        h('ul.guichet-types', G.types.map(t => h('li', h('button.guichet-type', { type: 'button', 'data-type': t[0], onclick: () => etapeDemande(t[0]) }, picto(t[0]), h('span', t[1]))))));
      return titre;
    }

    // Étape 2 : commentaire, urgence, coordonnées de rappel.
    function etapeDemande(type) {
      marquer(2);
      const u = D.utilisateur;
      const f = U.formulaire([
        { nom: 'commentaire', libelle: 'Votre commentaire : ce que vous faisiez, ce qui se passe, l\'écran concerné', type: 'long', requis: true, lignes: 5 },
        { nom: 'urgence', libelle: 'Urgence', type: 'choix', requis: true, options: G.urgences.map(x => [x[0], x[1]]) },
        { titre: 'Pour vous rappeler' },
        { nom: 'nom', libelle: 'Nom et prénom', requis: true, defaut: u ? u.nom : '' },
        { nom: 'collectivite', libelle: 'Collectivité et service', requis: true, defaut: u ? [CFG.organisme, u.service].filter(Boolean).join(' — ') : '' },
        { nom: 'telephone', libelle: 'Téléphone de rappel', requis: true, aide: 'Votre numéro : l\'équipe support vous rappelle à ce numéro.' },
        { nom: 'courriel', libelle: 'Adresse électronique (facultatif)', type: 'email', defaut: u ? u.email || '' : '' },
        { nom: 'profil', libelle: 'Vous êtes', type: 'choix', vide: false, options: G.profils },
        { nom: 'creneau', libelle: 'Créneau de rappel souhaité', type: 'choix', vide: false, options: G.creneaux, aide: 'Horaires du guichet : ' + HORAIRES + '.' },
        { nom: 'consentement', libelle: 'J\'accepte que ces coordonnées servent uniquement à traiter ma demande et à me rappeler.', type: 'case', large: true,
          aide: 'Elles sont conservées le temps du traitement, puis 12 mois après la clôture de la demande. Pour les consulter, les corriger ou les faire effacer : demandez-le lors du rappel, ou au référent de votre collectivité.' }
      ], {}, async v => {
        const r = await D.deposerDemandeGuichet(Object.assign(v, { type_demande: type, site_web: piege.value }));
        etapeAccuse(r, Object.assign({ type_demande: type }, v));
      }, { libelle: 'Envoyer ma demande', boutons: [h('button.bouton.secondaire', { type: 'button', onclick: () => focaliser(etapeTypes()) }, 'Changer de type')] });
      const L = G.limites; for (const k of Object.keys(L)) if (f.controles[k]) f.controles[k].maxLength = L[k];
      f.controles.telephone.setAttribute('inputmode', 'tel'); f.controles.telephone.setAttribute('autocomplete', 'tel'); f.controles.nom.setAttribute('autocomplete', 'name'); f.controles.courriel.setAttribute('autocomplete', 'email');
      // Champ piège invisible (anti-robots) : laissé vide par une personne, la demande est refusée s'il est rempli.
      const piege = h('input', { type: 'text', id: 'guichet-site-web', name: 'site_web', tabindex: '-1', autocomplete: 'off' });
      f.prepend(h('div.piege', { 'aria-hidden': 'true' }, h('label', { for: 'guichet-site-web' }, 'Ne pas remplir ce champ'), piege));
      const titre = h('h2', 'Votre demande');
      zone.replaceChildren(titre, h('div.guichet-choix', picto(type), h('div', h('span.aide', 'Type de demande'), h('b', lib(G.types, type)))), f);
      return focaliser(titre);
    }

    // Étape 3 : accusé de réception.
    function etapeAccuse(r, v) {
      marquer(3);
      const urg = G.urgences.find(x => x[0] === v.urgence); const crit = urg[2]; const dl = Calcul.DELAIS_SUPPORT[crit];
      const ech = Calcul.echeancesSupport(crit, r.date_depot);
      const resume = String(v.commentaire || ''); const court = resume.length > 280 ? resume.slice(0, 280) + '…' : resume;
      const titre = h('h2', 'Demande enregistrée');
      zone.replaceChildren(h('section.guichet-accuse', { 'aria-labelledby': 'guichet-accuse-titre' },
        Object.assign(titre, { id: 'guichet-accuse-titre' }),
        h('p.guichet-numero', 'Numéro de votre demande : ', h('b', r.numero)),
        U.definition([['Déposée le', U.dateHeure(r.date_depot)], ['Type de demande', lib(G.types, v.type_demande)], ['Urgence', urg[1]], ['Votre commentaire', court],
          ['Rappel au', v.telephone], ['Créneau souhaité', lib(G.creneaux, v.creneau)], v.courriel ? ['Adresse électronique', v.courriel] : null]),
        h('h3', 'Délais de prise en charge'),
        h('ul', h('li', 'Prise en charge et rappel : sous ' + delai(dl.prise_en_charge) + (ech.prise_en_charge ? ', au plus tard le ' + U.dateHeure(ech.prise_en_charge) : '') + '.'),
          dl.retablissement ? h('li', 'Rétablissement visé : sous ' + delai(dl.retablissement) + '.') : null,
          h('li.aide', 'Heures et jours ouvrés : ' + HORAIRES + '. L\'équipe support peut requalifier l\'urgence après échange avec vous.')),
        h('p.note-info.ok', 'Pas de ligne directe : l\'équipe support traite votre demande et vous rappelle aux horaires du guichet, ou contacte le référent de votre collectivité. Notez votre numéro de demande ', h('b', r.numero), ' : il vous sera rappelé.'),
        h('div.actions', U.bouton('Déposer une autre demande', () => focaliser(etapeTypes()), 'secondaire'), h('a.bouton', { href: '#/' }, D.utilisateur ? 'Retour au tableau de bord' : 'Retour à l\'accueil'))));
      U.message('Demande ' + r.numero + ' enregistrée.');
      focaliser(titre);
    }

    etapeTypes();
    return h('div.guichet',
      h('header.guichet-tete', h('h1', 'Contacter le support'),
        h('p.chapeau', E.typo ? E.typo('Pas de ligne directe : l\'équipe support traite votre demande et vous rappelle aux horaires du guichet.') : ''),
        h('p.guichet-horaires', h('b', 'Horaires du guichet : '), HORAIRES)),
      etapes, zone);
  }

  // Page publique (sans connexion), dans le cadre de la page d'accueil.
  E.pageGuichet = async function () {
    return h('div.accueil', await E.enteteAccueil('echanges'),
      h('main.article-page.guichet-page',
        h('nav.fil', { 'aria-label': 'Fil d\'Ariane' }, h('a', { href: '#/' }, 'Accueil'), ' › ', h('span', 'Échanges'), ' › ', h('span', 'Contacter le support')),
        contenuGuichet()),
      E.piedAccueil());
  };
  // Une fois connecté, le guichet reste accessible dans l'application (coordonnées préremplies).
  U.route('/guichet', async () => h('div.guichet-app', contenuGuichet()));
})();
