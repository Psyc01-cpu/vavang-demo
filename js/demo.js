/* Jeu de données de démonstration — entièrement fictif et anonyme (organisme, agents, entreprises, montants). */
(function () {
  'use strict';
  const MDP = 'Demonstration-2026';
  const COMPTES = [
    { id: 'u-admin', email: 'admin@demo.example', nom: 'Alix Fontaine', role: 'administrateur', service: 'Direction de la commande publique', mot_de_passe: MDP },
    { id: 'u-gest', email: 'gestionnaire@demo.example', nom: 'Camille Morel', role: 'gestionnaire', service: 'Direction de la commande publique', mot_de_passe: MDP },
    { id: 'u-presc', email: 'prescripteur@demo.example', nom: 'Sacha Leroy', role: 'prescripteur', service: 'Direction de l\'environnement', mot_de_passe: MDP },
    { id: 'u-valid', email: 'valideur@demo.example', nom: 'Dominique Vidal', role: 'valideur', service: 'Direction de la commande publique', mot_de_passe: MDP },
    { id: 'u-lect', email: 'lecteur@demo.example', nom: 'Claude Besson', role: 'lecteur', service: 'Contrôle de gestion', mot_de_passe: MDP },
    { id: 'u-support', email: 'support@demo.example', nom: 'Équipe support', role: 'support', service: 'l\'entreprise.ai (éditeur)', mot_de_passe: MDP }];

  // Une demande d'assistance de démonstration, résolue et en attente de validation par la collectivité.
  function ticketsDemo() {
    const il = (j, h) => { const d = new Date(); d.setDate(d.getDate() + j); d.setHours(h, 5, 0, 0); return d.toISOString(); };
    const cree = il(-3, 9);
    return [{ id: 'tk1', numero: 'T-' + new Date().getFullYear() + '-0001', date_creation: cree, demandeur_id: 'u-gest', demandeur_nom: 'Camille Morel', service: 'Direction de la commande publique', objet: 'Ajouter un modèle de lettre de rejet pour les marchés de travaux', criticite: 'P4',
      description: 'Nous souhaitons un modèle de lettre de rejet propre aux marchés de travaux, avec les mentions sur la sous-traitance.', statut: 'resolu', echeances: Calcul.echeancesSupport('P4', cree), intervenant_nom: 'Équipe support', pris_en_charge_le: il(-3, 11), resolu_le: il(-1, 15), pieces_jointes: [],
      historique: [{ date: cree, auteur: 'Camille Morel', type: 'Création', texte: 'Demande créée (P4).' }, { date: il(-3, 11), auteur: 'Équipe support (support)', type: 'Prise en charge', texte: 'Demande de paramétrage prise en charge.' },
        { date: il(-1, 15), auteur: 'Équipe support (support)', type: 'Solution proposée', texte: 'Modèle « Lettre de rejet — travaux » ajouté dans la bibliothèque des courriers. Merci de vérifier et de valider la clôture.' }] }];
  }

  function jour(decalage) { const d = new Date(); d.setDate(d.getDate() + decalage); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function instant(decalage, heure) { const d = new Date(); d.setDate(d.getDate() + decalage); d.setHours(heure || 10, 12, 0, 0); return d.toISOString(); }
  const an = new Date().getFullYear();

  function donnees(D) {
    const T = {};
    T.profils = COMPTES.map(c => ({ id: c.id, email: c.email, nom: c.nom, role: c.role, service: c.service, actif: true }));
    T.comptes_locaux = COMPTES.map(c => ({ id: c.id, email: c.email, mot_de_passe: c.mot_de_passe }));
    T.habilitations = []; for (const r of Object.keys(D.DROITS_DEFAUT)) for (const d of D.DROITS_DEFAUT[r]) T.habilitations.push({ id: r + '|' + d, role: r, droit: d });
    T.parametres = [{ id: 'seuils', valeur: Object.assign({}, Calcul.SEUILS_DEFAUT) }, { id: 'demo_v2', valeur: true }, { id: 'demo_v3', valeur: true }, { id: 'demo_v4', valeur: true }, { id: 'demo_v5', valeur: true }, { id: 'demo_v6', valeur: true }];
    T.tickets = ticketsDemo();
    T.annonces = (window.DemoAccueil ? window.DemoAccueil() : []).filter(a => a.type !== 'rubrique').concat(window.DemoArticles ? window.DemoArticles() : []);
    T.fournisseurs = [
      ['f1', 'Exemple Tamarin Paysage', '000 000 001 00011', 'Commune A', 'Espaces verts, élagage', 'PME', 'Candidature à une consultation'],
      ['f2', 'Exemple Vacoa Environnement', '000 000 002 00012', 'Commune B', 'Espaces verts, propreté', 'PME', 'Rencontre de sourcing'],
      ['f3', 'Exemple Longani Jardins', '000 000 003 00013', 'Commune A', 'Espaces verts', 'TPE', 'Candidature à une consultation'],
      ['f4', 'Exemple Bois-de-Rose Mobilier', '000 000 004 00014', 'Commune C', 'Mobilier de bureau', 'PME', 'Salon professionnel'],
      ['f5', 'Exemple Filaos Informatique', '000 000 005 00015', 'Commune B', 'Matériel et services informatiques', 'PME', 'Titulaire d\'un marché antérieur'],
      ['f6', 'Exemple Corail Propreté', '000 000 006 00016', 'Commune D', 'Nettoyage de locaux', 'ESS', 'Recommandation d\'un service']
    ].map(x => ({ id: x[0], raison_sociale: x[1], siret: x[2], commune: x[3], domaines: x[4], taille: x[5], source: x[6], actif: true, contact: 'Service commercial', email: 'contact@' + x[0] + '.example', qualification: x[0] === 'f1' ? 'Qualification professionnelle déclarée en entretien d\'espaces verts ; certificat de capacité pour l\'usage de produits de biocontrôle.' : '' }));
    T.fournisseur_suivi = [{ id: 'fs1', fournisseur_id: 'f2', date: jour(-70), type: 'Rencontre de sourcing', compte_rendu: 'Présentation des moyens matériels (broyeurs, tondeuses électriques) et des capacités d\'intervention sur les sites en pente. Aucune information sur la consultation à venir n\'a été communiquée.', auteur_nom: 'Camille Morel' }];

    T.besoins = [
      ['b1', 'B-' + an + '-001', 'Entretien des espaces verts des sites communautaires', 'Direction de l\'environnement', 'services', 'Entretien d\'espaces verts', 185000, 36, 'consultation', true],
      ['b2', 'B-' + an + '-002', 'Mobilier de bureau pour le nouveau siège', 'Direction des moyens généraux', 'fournitures', 'Mobilier de bureau', 38000, 6, 'recense', false],
      ['b3', 'B-' + an + '-003', 'Mobilier pour les médiathèques', 'Direction de la culture', 'fournitures', 'Mobilier de bureau', 31000, 6, 'recense', false],
      ['b4', 'B-' + an + '-004', 'Renouvellement de postes informatiques', 'Direction des systèmes d\'information', 'fournitures', 'Matériel informatique', 96000, 12, 'valide', false],
      ['b5', 'B-' + an + '-005', 'Réfection de la toiture du centre technique', 'Direction du patrimoine', 'travaux', 'Opération centre technique', 240000, 5, 'recense', false],
      ['b6', 'B-' + an + '-006', 'Nettoyage des locaux administratifs', 'Direction des moyens généraux', 'services', 'Nettoyage de locaux', 228000, 48, 'recense', true]
    ].map(x => ({ id: x[0], reference: x[1], objet: x[2], service: x[3], nature: x[4], famille: x[5], montant_estime: x[6], duree_mois: x[7], annee: an, statut: x[8], recurrent: x[9], cree_par: 'u-presc', cree_par_nom: 'Sacha Leroy',
      procedure_retenue: x[0] === 'b1' ? 'Procédure adaptée (MAPA)' : x[0] === 'b4' ? 'Procédure adaptée (MAPA)' : null, procedure_decidee_par_nom: ['b1', 'b4'].includes(x[0]) ? 'Dominique Vidal' : null, consultation_id: x[0] === 'b1' ? 'c1' : null,
      type_marche: x[0] === 'b1' ? 'Accord-cadre à bons de commande' : null }));

    T.consultations = [
      { id: 'c1', reference: an + '-004', objet: 'Entretien des espaces verts des sites communautaires', nature: 'services', procedure: 'Procédure adaptée (MAPA)', type_marche: 'Accord-cadre à bons de commande', montant_estime: 185000, statut: 'analyse', date_limite_offres: jour(-12), besoin_id: 'b1', service: 'Direction de l\'environnement', cree_par: 'u-gest', cree_le: instant(-60) },
      { id: 'c2', reference: an + '-007', objet: 'Renouvellement de postes informatiques', nature: 'fournitures', procedure: 'Procédure adaptée (MAPA)', type_marche: 'Marché ordinaire à prix forfaitaire', montant_estime: 96000, statut: 'preparation', date_limite_offres: jour(24), besoin_id: 'b4', service: 'Direction des systèmes d\'information', cree_par: 'u-gest', cree_le: instant(-9) }];
    T.lots = [{ id: 'l1', consultation_id: 'c1', numero: 1, intitule: 'Sites du secteur nord', montant_estime: 110000 }, { id: 'l2', consultation_id: 'c1', numero: 2, intitule: 'Sites du secteur est', montant_estime: 75000 }, { id: 'l3', consultation_id: 'c2', numero: 1, intitule: 'Lot unique', montant_estime: 96000 }];
    T.affectations = [{ id: 'a1', consultation_id: 'c1', profil_id: 'u-presc', fonction: 'analyste' }, { id: 'a2', consultation_id: 'c1', profil_id: 'u-lect', fonction: 'lecteur' }];
    const att = ['Acte d\'engagement', 'DC1 — Lettre de candidature', 'DC2 — Déclaration du candidat', 'Mémoire technique', 'Bordereau de prix / DPGF'];
    T.pieces_attendues = []; ['c1', 'c2'].forEach(c => att.forEach((t, i) => T.pieces_attendues.push({ id: 'pa-' + c + '-' + i, consultation_id: c, type_piece: t, obligatoire: true })));

    const criteres = [['k1', null, '1', 'Prix des prestations', 'prix', 40, null, 'Montant du détail quantitatif estimatif.'], ['k2', null, '2', 'Valeur technique', 'qualitatif', 50, 10, ''],
      ['k21', 'k2', '2.1', 'Moyens humains et matériels affectés', 'qualitatif', 20, 10, 'Composition des équipes, qualifications, matériel dédié au marché.'], ['k22', 'k2', '2.2', 'Méthodologie et organisation des interventions', 'qualitatif', 20, 10, 'Planification, fréquences, contrôle interne, gestion des urgences.'],
      ['k23', 'k2', '2.3', 'Délais d\'intervention', 'qualitatif', 10, 10, 'Délai d\'intervention sur demande et en urgence.'], ['k3', null, '3', 'Performance environnementale', 'qualitatif', 10, 5, 'Gestion des déchets verts, matériel électrique, produits utilisés.']];
    T.criteres = criteres.map(k => ({ id: k[0], lot_id: 'l1', consultation_id: 'c1', parent_id: k[1], code: k[2], libelle: k[3], type: k[4], ponderation: k[5], bareme: k[6], description: k[7] }));
    const contenuGrille = { formule_prix: 'proportionnelle', arrondi_decimales: 2, arrondi_mode: 'proche', seuil_alerte_prix: 25, criteres: T.criteres.map(k => ({ id: k.id, parent_id: k.parent_id, code: k.code, libelle: k.libelle, type: k.type, ponderation: k.ponderation, bareme: k.bareme, description: k.description })) };
    T.grilles = [{ id: 'g1', lot_id: 'l1', consultation_id: 'c1', statut: 'verrouillee', formule_prix: 'proportionnelle', arrondi_decimales: 2, arrondi_mode: 'proche', seuil_alerte_prix: 25, version: 1, verrouillee_par_nom: 'Dominique Vidal', verrouillee_le: instant(-30, 15), modele_id: 'mg1' }];
    T.grille_versions = [{ id: 'gv1', lot_id: 'l1', consultation_id: 'c1', version: 1, date: instant(-30, 15), auteur_nom: 'Dominique Vidal', motif: 'Verrouillage après validation', contenu: contenuGrille }];
    T.modeles_grille = [{ id: 'mg1', nom: 'Services courants — prix 40, technique 50, environnement 10', version: 1, date_effet: jour(-200), auteur_nom: 'Alix Fontaine', actif: true, contenu: contenuGrille }];

    const offres = [['o1', 'f1', 'Exemple Tamarin Paysage', 104500, true], ['o2', 'f2', 'Exemple Vacoa Environnement', 118400, true], ['o3', 'f3', 'Exemple Longani Jardins', 71900, false]];
    T.offres = offres.map((o, i) => ({ id: o[0], consultation_id: 'c1', lot_id: 'l1', fournisseur_id: o[1], candidat: o[2], type_offre: 'base', date_depot: jour(-13 - i), montant_ht: o[3], montant_valide: o[4], montant_valide_par_nom: o[4] ? 'Dominique Vidal' : null, montant_valide_le: o[4] ? instant(-6, 9) : null,
      candidature_statut: i < 2 ? 'admise' : 'a_completer', candidature_constat: i < 2 ? 'complete' : 'a_completer', candidature_decision_par_nom: i < 2 ? 'Dominique Vidal' : null, candidature_decision_le: i < 2 ? instant(-8, 11) : null, candidature_motif: i === 2 ? 'DC2 absent du pli.' : null, ecartee: false }));
    const memoire = (nom, equipe, delai, env) => ['MÉMOIRE TECHNIQUE — ' + nom + '\nConsultation ' + an + '-004 — Entretien des espaces verts — Lot 1\n\n1. Moyens humains et matériels\n' + equipe,
      '2. Méthodologie et organisation des interventions\nUn planning annuel est remis dans les quinze jours suivant la notification. Chaque site fait l\'objet d\'une fiche d\'intervention signée par le chef d\'équipe et transmise au pouvoir adjudicateur chaque semaine. Un contrôle interne mensuel est réalisé par le conducteur de travaux.\n\n3. Délais d\'intervention\n' + delai,
      '4. Performance environnementale\n' + env];
    const textes = {
      o1: memoire('Exemple Tamarin Paysage', 'Deux équipes de trois agents sont affectées au lot, encadrées par un chef d\'équipe titulaire d\'un brevet professionnel en aménagements paysagers. Le matériel dédié comprend deux tondeuses autoportées, quatre débroussailleuses électriques et un broyeur de végétaux.', 'Intervention sur demande sous 48 heures ouvrées. Intervention d\'urgence (chute d\'arbre, obstruction) sous 4 heures, 7 jours sur 7, par une astreinte dédiée.', 'Les déchets verts sont broyés sur place et valorisés en paillage. 60 % du petit matériel est électrique. Aucun produit phytosanitaire de synthèse n\'est utilisé.'),
      o2: memoire('Exemple Vacoa Environnement', 'Une équipe de quatre agents polyvalents intervient sur le lot, renforcée en saison des pluies par deux agents supplémentaires. Le matériel comprend une tondeuse autoportée, trois débroussailleuses thermiques et un camion benne.', 'Intervention sur demande sous 72 heures ouvrées. Intervention d\'urgence sous 8 heures les jours ouvrés.', 'Les déchets verts sont évacués vers la plateforme de compostage agréée. Le renouvellement du parc vers du matériel électrique est prévu au cours du marché.'),
      o3: memoire('Exemple Longani Jardins', 'Une équipe de deux agents intervient sur l\'ensemble des sites. Le matériel comprend deux débroussailleuses et une tondeuse tractée.', 'Intervention sur demande sous cinq jours ouvrés.', 'Les déchets verts sont évacués en déchetterie.')
    };
    T.pieces = []; T.lignes_prix = []; const fichiers = [];
    const bordereau = { o1: [[52, 950], [24, 1400], [12, 1850]], o2: [[52, 1100], [24, 1500], [12, 2100]], o3: [[52, 650], [24, 980], [12, 1215]] };
    for (const o of T.offres) {
      const types = o.id === 'o3' ? ['Acte d\'engagement', 'DC1 — Lettre de candidature', 'Mémoire technique', 'Bordereau de prix / DPGF'] : att;
      types.forEach((t, i) => {
        const estMemoire = t === 'Mémoire technique';
        const pages = estMemoire ? textes[o.id] : [t + ' — ' + o.candidat + '\nConsultation ' + an + '-004, lot 1.\n' + (t === 'Acte d\'engagement' ? 'Le candidat s\'engage sur un montant de ' + Calcul.euros(o.montant_ht) + ' HT pour la durée du marché.' : 'Document de candidature fictif établi pour la démonstration.')];
        const nom = (estMemoire ? 'Memoire_technique' : t.replace(/ —.*/, '').replace(/[^A-Za-z0-9]+/g, '_')) + '_' + o.candidat.split(' ')[1] + '.txt';
        const chemin = 'c1/demo-' + o.id + '-' + i + '.txt';
        fichiers.push([chemin, new Blob([pages.join('\n\n')], { type: 'text/plain' })]);
        T.pieces.push({ id: 'p-' + o.id + '-' + i, consultation_id: 'c1', lot_id: 'l1', offre_id: o.id, type_piece: t, nom_fichier: nom, chemin, taille: pages.join('').length, mime: 'text/plain', pages, nb_pages: pages.length, lisible: true, controle: i < 2 ? 'conforme' : 'non_controlee', version: 1, depose_par_nom: 'Camille Morel', depose_le: instant(-11, 14) });
      });
      [['Tonte et débroussaillage hebdomadaires', 'passage'], ['Taille des haies et massifs', 'intervention'], ['Élagage et abattage sur demande', 'journée']].forEach((l, i) => T.lignes_prix.push({ id: 'lp-' + o.id + '-' + i, offre_id: o.id, ordre: i + 1, designation: l[0], unite: l[1], quantite: bordereau[o.id][i][0], prix_unitaire: bordereau[o.id][i][1] }));
    }
    const N = (id, o, k, note, statut, app, extrait, page) => ({ id, lot_id: 'l1', consultation_id: 'c1', offre_id: o, critere_id: k, analyste_id: 'u-gest', analyste_nom: 'Camille Morel', note, appreciation: app, points_forts: '', points_faibles: '', reserves: '', piece_id: extrait ? 'p-' + o + (o === 'o3' ? '-2' : '-3') : null, page: page || null, extrait: extrait || '', statut,
      validee_par: statut === 'validee' ? 'u-valid' : null, validee_par_nom: statut === 'validee' ? 'Dominique Vidal' : null, validee_le: statut === 'validee' ? instant(-5, 16) : null, modifie_le: instant(-7, 11) });
    T.notes = [
      N('n1', 'o1', 'k21', 8, 'validee', 'Moyens dimensionnés et qualifiés, matériel dédié clairement identifié.', 'Deux équipes de trois agents sont affectées au lot', 1),
      N('n2', 'o1', 'k22', 8, 'validee', 'Organisation claire : planning annuel, fiches d\'intervention hebdomadaires, contrôle interne mensuel.', 'Un contrôle interne mensuel est réalisé par le conducteur de travaux', 2),
      N('n3', 'o1', 'k23', 9, 'validee', 'Délais courts et astreinte dédiée pour les urgences.', 'Intervention d\'urgence (chute d\'arbre, obstruction) sous 4 heures, 7 jours sur 7', 2),
      N('n4', 'o1', 'k3', 4, 'validee', 'Valorisation sur place et part importante de matériel électrique.', '60 % du petit matériel est électrique', 3),
      N('n5', 'o2', 'k21', 7, 'validee', 'Équipe suffisante avec renfort saisonnier ; matériel majoritairement thermique.', 'Une équipe de quatre agents polyvalents intervient sur le lot', 1),
      N('n6', 'o2', 'k22', 7, 'validee', 'Méthodologie conforme, sans élément distinctif.', '', null),
      N('n7', 'o2', 'k23', 6, 'proposee', 'Délais plus longs que ceux des autres offres ; urgence limitée aux jours ouvrés.', 'Intervention d\'urgence sous 8 heures les jours ouvrés', 2),
      N('n8', 'o2', 'k3', 3, 'proposee', 'Évacuation vers une plateforme de compostage ; électrification seulement annoncée.', '', null),
      N('n9', 'o3', 'k21', 4, 'brouillon', 'Équipe réduite au regard du nombre de sites.', 'Une équipe de deux agents intervient sur l\'ensemble des sites', 1)];
    T.demandes = [{ id: 'd1', consultation_id: 'c1', lot_id: 'l1', offre_id: 'o3', type: 'justification_prix', objet: 'Justifier le prix proposé, inférieur de plus de 25 % à la moyenne des autres offres : sous-détail des prix, temps passés, coûts de main-d\'œuvre.', date_envoi: jour(-6), echeance: jour(-1), statut: 'envoyee' },
      { id: 'd2', consultation_id: 'c1', lot_id: 'l1', offre_id: 'o3', type: 'complement', objet: 'Produire le formulaire DC2, absent du pli.', date_envoi: jour(-9), echeance: jour(-4), reponse: 'DC2 transmis par le candidat.', date_reponse: jour(-5), statut: 'reponse_recue' }];

    const RC = 'RÈGLEMENT DE LA CONSULTATION\n{{organisme}}\nConsultation {{reference}} — {{objet}}\n\nARTICLE 1 — Objet de la consultation\nLa présente consultation a pour objet : {{objet}}.\nNature des prestations : {{nature}}. Forme du marché : {{type_marche}}.\n\nARTICLE 2 — Procédure\nLa consultation est passée selon la procédure suivante : {{procedure}}.\n\nARTICLE 3 — Allotissement\n{{lots}}\n\nARTICLE 4 — Remise des offres\nLes offres sont remises par voie dématérialisée avant le {{date_limite}} à 12 h 00 (heure de La Réunion).\n\nARTICLE 5 — Critères de jugement des offres\n{{criteres}}\n\nARTICLE 6 — Renseignements complémentaires\n[à compléter : modalités de questions et de réponses]';
    const M = (id, type, cat, nom, contenu) => ({ id, type, categorie: cat, nom, contenu, version: 1, actif: true, auteur_nom: 'Alix Fontaine', modifie_le: instant(-150) });
    T.modeles_document = [
      M('md1', 'dce', 'Règlement de la consultation', 'Règlement de la consultation — procédure adaptée', RC),
      M('md2', 'dce', 'CCAP', 'CCAP — services courants', 'CAHIER DES CLAUSES ADMINISTRATIVES PARTICULIÈRES\n{{organisme}}\nConsultation {{reference}} — {{objet}}\n\nARTICLE 1 — Objet et forme du marché\n{{objet}}. Forme : {{type_marche}}.\n\nARTICLE 2 — Durée\n[à compléter : durée et reconductions]\n\nARTICLE 3 — Prix et règlement\nLes prix sont réputés établis sur la base des conditions économiques du mois de remise des offres. Le délai global de paiement est de trente jours.\n\nARTICLE 4 — Pénalités\n[à compléter]\n\nARTICLE 5 — Document de référence\nLe cahier des clauses administratives générales applicable est celui des marchés de fournitures courantes et de services.'),
      M('md3', 'dce', 'Acte d\'engagement', 'Acte d\'engagement simplifié', 'ACTE D\'ENGAGEMENT\n{{organisme}}\nConsultation {{reference}} — {{objet}}\n\nARTICLE 1 — Contractant\n[à compléter par le candidat : dénomination, adresse, SIRET]\n\nARTICLE 2 — Prix\nMontant hors taxes : [à compléter par le candidat]\n\nARTICLE 3 — Durée\n[à compléter]\n\nARTICLE 4 — Signature\nFait à ............, le ............'),
      M('mc1', 'clause', 'CCAP', 'Clause de révision des prix', 'Les prix sont révisables annuellement à la date anniversaire de la notification, par application de la formule : P = P0 × (0,15 + 0,85 × I / I0), où I est la dernière valeur connue de l\'indice de référence et I0 sa valeur au mois d\'établissement des prix.'),
      M('mc2', 'clause', 'CCAP', 'Clause environnementale d\'exécution', 'Le titulaire transmet chaque année un bilan des actions environnementales mises en œuvre dans l\'exécution du marché : gestion des déchets, consommations, déplacements. Ce bilan est présenté lors de la réunion annuelle de suivi.'),
      M('mc3', 'clause', 'Règlement de la consultation', 'Clause sur les offres anormalement basses', 'Lorsqu\'une offre paraît anormalement basse, l\'acheteur demande par écrit au candidat les précisions et justifications qu\'il juge utiles. L\'offre n\'est rejetée, par décision motivée, que si les éléments fournis ne justifient pas de manière satisfaisante le bas niveau du prix.'),
      M('mk1', 'courrier', 'Demande de justification du prix', 'Demande de justification du prix', '{{organisme}}\nLe {{date}}\n\nObjet : consultation {{reference}} — {{objet}} — {{lot}}\nDemande de justification du prix\n\nMadame, Monsieur,\n\nVotre société, {{candidat}}, a remis une offre d\'un montant de {{montant}} HT. Ce montant paraît bas au regard des autres offres reçues et de l\'estimation de l\'acheteur.\n\nJe vous demande de bien vouloir me transmettre, avant le [date à compléter], toute précision et justification utile sur la composition de votre prix : sous-détail des prix, temps passés, coûts de main-d\'œuvre, solutions techniques retenues.\n\nÀ défaut de réponse ou si les éléments fournis ne justifient pas le niveau du prix, votre offre pourra être rejetée par décision motivée.\n\nJe vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.\n\n{{agent}}'),
      M('mk2', 'courrier', 'Demande de précisions', 'Demande de précisions sur l\'offre', '{{organisme}}\nLe {{date}}\n\nObjet : consultation {{reference}} — {{objet}} — {{lot}}\nDemande de précisions\n\nMadame, Monsieur,\n\nDans le cadre de l\'analyse de l\'offre remise par {{candidat}}, je vous remercie de préciser le point suivant, sans modifier votre offre : [point à préciser].\n\nVotre réponse est attendue avant le [date à compléter].\n\nJe vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.\n\n{{agent}}'),
      M('mk3', 'courrier', 'Lettre de rejet', 'Information du candidat non retenu', '{{organisme}}\nLe {{date}}\n\nObjet : consultation {{reference}} — {{objet}} — {{lot}}\nInformation sur le rejet de votre offre\n\nMadame, Monsieur,\n\nJ\'ai le regret de vous informer que l\'offre de {{candidat}} n\'a pas été retenue.\n\nVotre offre a obtenu la note de {{note_totale}} sur 100 et a été classée au rang {{rang}}.\nLe marché est attribué à {{attributaire}}, dont l\'offre a obtenu la note de {{note_attributaire}} sur 100.\n\nMotifs détaillés : [à compléter à partir du rapport d\'analyse].\n\nLe marché ne sera pas signé avant l\'expiration du délai applicable à compter de l\'envoi de la présente.\n\nJe vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.\n\n{{agent}}'),
      M('mk4', 'courrier', 'Notification', 'Notification du marché', '{{organisme}}\nLe {{date}}\n\nObjet : consultation {{reference}} — {{objet}} — {{lot}}\nNotification du marché\n\nMadame, Monsieur,\n\nJ\'ai le plaisir de vous notifier le marché cité en objet, attribué à {{candidat}} pour un montant de {{montant}} HT.\n\nVous trouverez ci-joint l\'acte d\'engagement signé. L\'exécution des prestations débutera à réception de l\'ordre de service.\n\nJe vous prie d\'agréer, Madame, Monsieur, l\'expression de mes salutations distinguées.\n\n{{agent}}')];
    const v = { organisme: window.CONFIG.organisme || '', reference: an + '-007', objet: 'Renouvellement de postes informatiques', nature: 'Fournitures', type_marche: 'Marché ordinaire à prix forfaitaire', procedure: 'Procédure adaptée (MAPA)', lots: 'Lot 1 — Lot unique', date_limite: new Date(jour(24) + 'T00:00:00').toLocaleDateString('fr-FR') };
    const rc = RC.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] || m);
    T.documents_dce = [{ id: 'dd1', consultation_id: 'c2', type_piece: 'Règlement de la consultation', titre: 'Règlement de la consultation — ' + an + '-007', contenu: rc, version: 2, statut: 'relecture', modele_id: 'md1', redacteur_nom: 'Camille Morel', modifie_le: instant(-2, 15) },
      { id: 'dd2', consultation_id: 'c2', type_piece: 'CCTP', titre: 'CCTP — ' + an + '-007', contenu: 'CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES\nConsultation ' + an + '-007 — Renouvellement de postes informatiques\n\nARTICLE 1 — Objet\nFourniture de 80 postes de travail fixes et de 40 ordinateurs portables, avec leur garantie de trois ans sur site.\n\nARTICLE 2 — Caractéristiques minimales\nProcesseur récent, 16 Go de mémoire, stockage de 512 Go, écran de 24 pouces pour les postes fixes.\n\nARTICLE 3 — Livraison\nLivraison et mise en service sur les sites de l\'acheteur dans un délai de six semaines à compter de la commande.\n\nARTICLE 4 — Reprise des anciens matériels\nLe titulaire reprend les matériels remplacés et justifie de leur réemploi ou de leur recyclage.', version: 1, statut: 'redaction', redacteur_nom: 'Sacha Leroy', modifie_le: instant(-4, 10) }];
    T.documents_versions = [{ id: 'dv1', document_id: 'dd1', consultation_id: 'c2', version: 1, contenu: RC, auteur_nom: 'Camille Morel', date: instant(-5, 9), commentaire: 'Création depuis le modèle « Règlement de la consultation — procédure adaptée » version 1' },
      { id: 'dv2', document_id: 'dd1', consultation_id: 'c2', version: 2, contenu: rc, auteur_nom: 'Camille Morel', date: instant(-2, 15), commentaire: 'Renseignement des données de la consultation' },
      { id: 'dv3', document_id: 'dd2', consultation_id: 'c2', version: 1, contenu: T.documents_dce[1].contenu, auteur_nom: 'Sacha Leroy', date: instant(-4, 10), commentaire: 'Création' }];
    T.validations = [{ id: 'va1', objet_type: 'documents_dce', objet_id: 'dd1', consultation_id: 'c2', etape: 'Soumis à la relecture', decision: 'soumis', commentaire: '', version: 2, auteur_id: 'u-gest', auteur_nom: 'Camille Morel', date: instant(-2, 16) }];

    T.marches = [
      { id: 'm1', numero: (an - 1) + '-M-031', objet: 'Maintenance du parc informatique', fournisseur_id: 'f5', titulaire: 'Exemple Filaos Informatique', forme: 'mixte', montant_notifie: 84000, montant_max: 40000, date_notification: jour(-330), date_debut: jour(-320), duree_mois: 12, reconductible: true, nb_reconductions_max: 2, duree_reconduction_mois: 12, preavis_mois: 3, statut: 'en_cours', service: 'Direction des systèmes d\'information' },
      { id: 'm2', numero: (an - 2) + '-M-012', objet: 'Nettoyage des locaux du siège', fournisseur_id: 'f6', titulaire: 'Exemple Corail Propreté', forme: 'forfait', montant_notifie: 156000, date_notification: jour(-700), date_debut: jour(-690), duree_mois: 24, reconductible: false, statut: 'en_cours', service: 'Direction des moyens généraux' },
      { id: 'm3', numero: an + '-M-004', objet: 'Fourniture de mobilier pour les accueils', fournisseur_id: 'f4', titulaire: 'Exemple Bois-de-Rose Mobilier', forme: 'bons', montant_notifie: 0, montant_max: 60000, date_notification: jour(-150), date_debut: jour(-140), duree_mois: 24, reconductible: false, statut: 'en_cours', service: 'Direction des moyens généraux' }];
    const Ev = (id, m, type, num, d, objet, montant, statut) => ({ id, marche_id: m, type, numero: num, date: jour(d), objet, montant, statut, cree_par_nom: 'Camille Morel' });
    T.evenements = [Ev('e1', 'm1', 'ordre_service', '1', -320, 'Démarrage des prestations', null, 'notifie'), Ev('e2', 'm1', 'bon_commande', '1', -250, 'Remplacement de 12 écrans', 9600, 'execute'), Ev('e3', 'm1', 'bon_commande', '2', -120, 'Extension de garantie des serveurs', 14500, 'execute'),
      Ev('e4', 'm1', 'bon_commande', '3', -40, 'Postes pour le nouveau service', 11200, 'notifie'), Ev('e5', 'm1', 'avenant', '1', -200, 'Ajout d\'un site au périmètre de maintenance', 6200, 'notifie'),
      Ev('e6', 'm2', 'ordre_service', '1', -690, 'Démarrage des prestations', null, 'notifie'), Ev('e7', 'm2', 'revision_prix', '1', -325, 'Révision annuelle des prix (+2,1 %)', 3276, 'notifie'),
      Ev('e8', 'm3', 'bon_commande', '1', -100, 'Banques d\'accueil — site A', 21500, 'execute'), Ev('e9', 'm3', 'bon_commande', '2', -30, 'Sièges visiteurs — sites B et C', 18900, 'notifie')];
    T.evaluations = [{ id: 'ev1', marche_id: 'm2', fournisseur_id: 'f6', date: jour(-90), periode: '1er semestre ' + an, criteres: [['Qualité des prestations', 4, 'Contrôles contradictoires satisfaisants sur 5 sites sur 6.'], ['Respect des délais', 4, ''], ['Respect des obligations administratives', 5, 'Attestations semestrielles transmises dans les délais.'], ['Relation et réactivité', 4, ''], ['Respect des engagements environnementaux et sociaux', 3, 'Bilan annuel transmis avec deux mois de retard.']].map(c => ({ libelle: c[0], note: c[1], commentaire: c[2] })),
      note_globale: 4, faits: 'Procès-verbaux des contrôles contradictoires des 14 mars et 12 juin ; courrier de relance du 2 mai sur le bilan environnemental.', appreciation: 'Exécution satisfaisante. Point d\'attention sur le respect des échéances de transmission des bilans.', statut: 'validee', auteur_nom: 'Camille Morel', validee_par_nom: 'Dominique Vidal', validee_le: instant(-85, 11) }];

    const J = (d, hh, u, action, type, id, lib, c) => { const p = COMPTES.find(x => x.id === u); return { id: 'j' + Math.random().toString(36).slice(2), date: instant(d, hh), auteur_id: u, auteur_nom: p.nom, auteur_role: p.role, action, objet_type: type, objet_id: id, objet_libelle: lib, detail: null, consultation_id: c || null, resultat: 'réussi', origine: 'navigateur' }; };
    T.journal = [J(-60, 9, 'u-gest', 'Création de la consultation', 'consultations', 'c1', an + '-004 — Entretien des espaces verts des sites communautaires', 'c1'), J(-31, 10, 'u-gest', 'Application du modèle de grille « Services courants » (version 1)', 'grilles', 'g1', an + '-004 — lot 1', 'c1'),
      J(-30, 15, 'u-valid', 'Verrouillage de la grille (version 1)', 'grilles', 'g1', an + '-004 — lot 1', 'c1'), J(-11, 14, 'u-gest', 'Enregistrement d\'une offre', 'offres', 'o1', 'Exemple Tamarin Paysage — ' + an + '-004', 'c1'),
      J(-11, 14, 'u-gest', 'Enregistrement d\'une offre', 'offres', 'o2', 'Exemple Vacoa Environnement — ' + an + '-004', 'c1'), J(-11, 15, 'u-gest', 'Enregistrement d\'une offre', 'offres', 'o3', 'Exemple Longani Jardins — ' + an + '-004', 'c1'),
      J(-8, 11, 'u-valid', 'Décision sur la candidature', 'offres', 'o1', 'Exemple Tamarin Paysage — ' + an + '-004', 'c1'), J(-7, 11, 'u-gest', 'Note proposée à la validation', 'notes', 'n1', 'Exemple Tamarin Paysage — critère 2.1 (' + an + '-004, lot 1)', 'c1'),
      J(-6, 9, 'u-valid', 'Validation du montant de l\'offre', 'offres', 'o1', 'Exemple Tamarin Paysage — ' + an + '-004', 'c1'), J(-6, 10, 'u-gest', 'Demande au candidat : Demande de justification du prix', 'demandes', 'd1', 'Exemple Longani Jardins — ' + an + '-004', 'c1'),
      J(-5, 16, 'u-valid', 'Validation d\'une note', 'notes', 'n1', 'Exemple Tamarin Paysage — critère 2.1 (' + an + '-004, lot 1)', 'c1'), J(-2, 16, 'u-gest', 'Soumis à la relecture', 'documents_dce', 'dd1', 'Règlement de la consultation — ' + an + '-007', 'c2')];
    return { T, fichiers };
  }

  async function installer(D) {
    const { T, fichiers } = donnees(D);
    for (const t of Object.keys(T)) await D._installerLocal(t, T[t]);
    for (const f of fichiers) await D._fichierLocal(f[0], f[1]);
  }
  // Mise à niveau d'une base de démonstration créée avant la page d'accueil (version 2).
  async function completer(D, cache) {
    const fait = id => cache.parametres.some(p => p.id === id);
    if (!fait('demo_v2')) {
      if (!cache.annonces.length && window.DemoAccueil) await D._installerLocal('annonces', window.DemoAccueil());
      const h = ['administrateur', 'gestionnaire'].map(r => ({ id: r + '|accueil.ecrire', role: r, droit: 'accueil.ecrire' })).filter(x => !cache.habilitations.some(y => y.id === x.id));
      if (h.length) await D._installerLocal('habilitations', h);
      await D._installerLocal('parametres', [{ id: 'demo_v2', valeur: true }]);
    }
    if (!fait('demo_v3')) { // version 3 : photos de La Réunion sur les annonces
      for (const id of Object.keys(window.PHOTOS_ACCUEIL || {})) { const a = cache.annonces.find(x => x.id === id); if (a && !a.image && !a.image_chemin) await D._majLocal('annonces', id, window.PHOTOS_ACCUEIL[id]); }
      await D._installerLocal('parametres', [{ id: 'demo_v3', valeur: true }]);
    }
    if (!fait('demo_v4')) { // version 4 : compte du support éditeur, droits de déclaration, demande d'assistance
      const s = COMPTES.find(c => c.id === 'u-support');
      if (!cache.profils.some(p => p.id === s.id)) { await D._installerLocal('profils', [{ id: s.id, email: s.email, nom: s.nom, role: s.role, service: s.service, actif: true }]); await D._installerLocal('comptes_locaux', [{ id: s.id, email: s.email, mot_de_passe: s.mot_de_passe }]); }
      const h = [];
      for (const r of Object.keys(D.DROITS_DEFAUT)) for (const d of D.DROITS_DEFAUT[r]) if (d.startsWith('support.') && !cache.habilitations.some(x => x.id === r + '|' + d)) h.push({ id: r + '|' + d, role: r, droit: d });
      if (h.length) await D._installerLocal('habilitations', h);
      if (!cache.tickets.length) await D._installerLocal('tickets', ticketsDemo());
      await D._installerLocal('parametres', [{ id: 'demo_v4', valeur: true }]);
    }
    if (!fait('demo_v5') && window.DemoArticles) { // version 5 : articles réécrits, avec photo de couverture
      for (const a of window.DemoArticles()) { if (cache.annonces.some(x => x.id === a.id)) await D._majLocal('annonces', a.id, a); else await D._installerLocal('annonces', [a]); }
      await D._installerLocal('parametres', [{ id: 'demo_v5', valeur: true }]);
    }
    if (!fait('demo_v6')) { // version 6 : droit « voir les dossiers de son service » pour les prescripteurs
      if (!cache.habilitations.some(x => x.id === 'prescripteur|consultations.service')) await D._installerLocal('habilitations', [{ id: 'prescripteur|consultations.service', role: 'prescripteur', droit: 'consultations.service' }]);
      await D._installerLocal('parametres', [{ id: 'demo_v6', valeur: true }]);
    }
  }
  window.Demo = { COMPTES, donnees, installer, completer };
})();
