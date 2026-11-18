/* Contenu de démonstration de la page d'accueil — fictif. Modifiable par l'administrateur (menu « Page d'accueil et annonces »). */
(function () {
  'use strict';
  window.PHOTOS_ACCUEIL = {
    'c-analyse': { image: 'img/photos/fournaise-vue-du-ciel.jpg', credit: 'Le Piton de la Fournaise vu du ciel — photo Pouyot, CC BY-SA 4.0', cadrage: 'center 45%' },
    'c-formation': { image: 'img/photos/maido-lever-du-soleil.jpg', credit: 'Lever du soleil sur le Maïdo — photo Rémih, CC BY-SA 4.0', cadrage: 'center 40%' },
    'c-recensement': { image: 'img/photos/le-port-vue-du-ciel.jpg', credit: 'Le Port vu du ciel — photo Ville du Port, CC BY-SA 4.0', cadrage: 'center 55%' },
    'c-seuils': { image: 'img/photos/mafate-depuis-le-grand-benare.jpg', credit: 'Mafate depuis le Grand Bénare — photo Mamphi, CC BY-SA 3.0', cadrage: 'center 40%' }
  };
  window.DemoAccueil = function () {
    const j = n => { const d = new Date(); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    const an = new Date().getFullYear();
    const R = (id, onglet, ordre, titre, resume, contenu) => ({ id, type: 'rubrique', onglet, ordre, titre, resume, contenu, actif: true });
    const rubriques = [
      R('r-preparer', 'solutions', 1, 'Préparer le besoin', 'Recensement, computation des seuils, aide au choix de la procédure.',
        'Chaque service recense ses besoins dans une fiche simple : objet, montant estimé, durée, famille d\'achat.\n\n## Computation des seuils\nL\'outil additionne les besoins d\'une même famille, tous services confondus, et indique la procédure correspondant au montant cumulé.\n\n## Le choix reste humain\nLa procédure suggérée est une aide : l\'acheteur retient la procédure et justifie son choix, qui est tracé.'),
      R('r-dce', 'solutions', 2, 'Rédiger le dossier de consultation', 'Modèles, clauses, versions et circuit de validation.',
        'Les pièces du dossier sont générées à partir de modèles tenus par la direction de la commande publique.\n\n- Les données de la consultation sont reprises automatiquement : référence, objet, lots, critères.\n- Une bibliothèque de clauses s\'insère en un clic.\n- Chaque enregistrement crée une version datée et signée.\n\n## Circuit de validation\nRédaction, relecture, validation, publication : chaque étape est nominative et horodatée.'),
      R('r-analyser', 'solutions', 3, 'Analyser les offres', 'Grille verrouillée, notes justifiées, classement à partir des seules notes validées.',
        '## Une grille fixée avant l\'ouverture des plis\nCritères, sous-critères, pondérations, formule de prix et règle d\'arrondi sont paramétrés, contrôlés (total de 100) puis verrouillés par un valideur.\n\n## Des notes justifiées\nChaque note est rattachée à une appréciation ou à un extrait précis du document du candidat.\n\n## Aucune décision automatique\nL\'outil signale les pièces manquantes et les écarts de prix. Les admissions, les notes et le classement sont validés par un agent habilité.'),
      R('r-executer', 'solutions', 4, 'Suivre l\'exécution', 'Ordres de service, bons de commande, avenants, reconductions, échéances.',
        'Chaque marché a sa fiche de suivi : événements d\'exécution, pièces justificatives, montant actualisé avec les avenants, cumul des bons de commande comparé au montant maximum.\n\nLes échéances de fin de marché et de décision de reconduction remontent dans le tableau de bord.'),
      R('r-piloter', 'solutions', 5, 'Piloter l\'activité', 'Tableau de bord, alertes, évaluation des titulaires.',
        'Le tableau de bord rassemble les consultations en cours, les validations attendues et les échéances.\n\nL\'évaluation des titulaires repose sur des faits vérifiables et n\'entraîne jamais d\'exclusion automatique.'),
      R('r-formations', 'se-former', 1, 'Formations et prises en main', 'Sessions courtes par profil d\'utilisateur.',
        'Trois formats sont proposés :\n\n- Administrateurs : paramétrage, habilitations, modèles, seuils.\n- Gestionnaires de marchés : du besoin au rapport d\'analyse.\n- Prescripteurs, valideurs et lecteurs : les gestes utiles à leur profil.\n\nLes dates des prochaines sessions sont annoncées sur cette page d\'accueil.'),
      R('r-guides', 'se-former', 2, 'Guides pas à pas', 'Les gestes courants, écran par écran.',
        '## Exemples de guides\n- Recenser un besoin et lire la computation des seuils.\n- Paramétrer et verrouiller une grille d\'analyse.\n- Justifier une note par un extrait du mémoire technique.\n- Générer et exporter le rapport d\'analyse.'),
      R('r-faq', 'se-former', 3, 'Questions fréquentes', 'Les réponses aux questions posées au support.',
        '## Puis-je modifier une note validée ?\nNon : elle doit d\'abord être rouverte par un valideur. La réouverture est tracée.\n\n## Qui peut verrouiller une grille ?\nLes profils habilités par l\'administrateur, en général les valideurs.\n\n## J\'ai oublié mon mot de passe\nContactez l\'administrateur de votre collectivité.'),
      R('r-seuils', 's-informer', 1, 'Seuils et procédures', 'Les seuils appliqués par l\'outil.',
        'Les seuils utilisés pour la computation et l\'aide au choix de la procédure sont paramétrés par l\'administrateur, avec leur date d\'effet.\n\nConsultez l\'écran « Besoins et seuils » après connexion pour connaître les valeurs en vigueur.'),
      R('r-veille', 's-informer', 2, 'Veille réglementaire', 'Les évolutions de la commande publique et leur prise en compte.',
        'Les évolutions réglementaires qui touchent l\'outil sont annoncées ici : nature de l\'évolution, date d\'entrée en vigueur, adaptations apportées.'),
      R('r-donnees', 's-informer', 3, 'Données personnelles et sécurité', 'Où sont vos données, qui y accède.',
        'Les données de la collectivité lui appartiennent. Elles ne servent à aucune autre fin et n\'entraînent aucun modèle d\'intelligence artificielle.\n\nUn export complet (tables, documents, journaux) est disponible à tout moment pour l\'administrateur.'),
      R('r-support', 'echanges', 1, 'Contacter le support', 'Une question, un blocage : écrivez-nous.',
        'Le support répond aux agents et aux administrateurs. Indiquez dans votre message l\'écran concerné et, si possible, une capture d\'écran.\n\nLes coordonnées figurent en haut à droite de cette page.'),
      R('r-ameliorations', 'echanges', 2, 'Proposer une amélioration', 'Vos idées font évoluer l\'outil.',
        'Une fonction vous manque, un écran vous semble compliqué ? Décrivez votre besoin au support : chaque proposition reçoit une réponse.'),
      R('r-club', 'echanges', 3, 'Club des utilisateurs', 'Partager les bonnes pratiques entre services.',
        'Une rencontre entre utilisateurs est organisée régulièrement : retours d\'expérience, modèles partagés, priorités d\'évolution.')
    ];
    const C = (id, ordre, theme, surtitre, titre, texte, date_evenement, bouton, lien_rubrique) => ({ id, type: 'carrousel', ordre, theme, surtitre, titre, texte, date_evenement, bouton, lien_rubrique, actif: true });
    const carrousel = [
      C('c-analyse', 1, 'sombre', 'Nouveau', 'L\'analyse des offres, de la grille au rapport', 'Grille verrouillée, notes justifiées par un extrait, classement établi à partir des seules notes validées.', '', 'En savoir plus', 'r-analyser'),
      C('c-formation', 2, 'creme', 'Se former', 'Sessions de prise en main', 'Une demi-journée par profil, dans les locaux de la collectivité, avec des cas pratiques.', 'Du 1er au 12 décembre ' + an, 'Voir le programme', 'r-formations'),
      C('c-recensement', 3, 'braise', 'Collectivité', 'Recensement des besoins ' + (an + 1), 'Saisissez vos besoins de l\'année prochaine pour permettre la computation des seuils.', 'Avant le 15 janvier ' + (an + 1), 'Comment faire', 'r-preparer'),
      C('c-seuils', 4, 'sombre', 'S\'informer', 'Seuils de procédure en vigueur', 'Les seuils appliqués par l\'outil sont tenus à jour par la direction de la commande publique.', '', 'Consulter', 'r-seuils')
    ];
    const A = (id, source, date, titre, texte, contenu) => ({ id, type: 'actualite', source, date, titre, texte, contenu, actif: true });
    const actualites = [
      A('a-recensement', 'collectivite', j(-1), 'Recensement des besoins ' + (an + 1) + ' ouvert', 'Les services prescripteurs saisissent leurs besoins jusqu\'au 15 janvier.', 'Le recensement des besoins de l\'année ' + (an + 1) + ' est ouvert. Chaque service saisit ses besoins dans l\'écran « Besoins et seuils ».\n\nLa direction de la commande publique arrêtera ensuite les procédures à partir de la computation des seuils.'),
      A('a-ccap', 'collectivite', j(-4), 'Nouveau modèle de CCAP « services courants »', 'Le modèle a été mis à jour par la direction de la commande publique.', 'Un nouveau modèle de CCAP pour les services courants est disponible dans la bibliothèque des modèles. Il intègre une clause de révision des prix et une clause environnementale d\'exécution.'),
      A('a-permanence', 'collectivite', j(-9), 'Permanence de la commande publique le jeudi matin', 'Les gestionnaires répondent aux questions des services prescripteurs.', 'Chaque jeudi de 8 h 30 à 12 h, un gestionnaire de la direction de la commande publique répond aux questions des services prescripteurs sur leurs projets d\'achat.'),
      A('a-accueil', 'editeur', j(0), 'Nouveau : page d\'accueil et annonces', 'Les informations utiles défilent dès la connexion ; l\'administrateur les met à jour.', 'La page d\'accueil présente désormais les annonces de la collectivité, les actualités et les rubriques d\'information. L\'administrateur les publie depuis le menu « Page d\'accueil et annonces ».'),
      A('a-comparaison', 'editeur', j(-6), 'Comparer les offres critère par critère', 'Une vue transversale affiche les réponses de tous les candidats sur le même critère.', 'Dans l\'onglet « Analyse », la vue « Par critère » affiche côte à côte les appréciations et les notes de tous les candidats pour un même critère, sans ajout de critère non prévu.'),
      A('a-reprise', 'editeur', j(-12), 'Reprendre vos tableaux de suivi existants', 'Reprise à blanc, rapport de contrôle, puis reprise définitive.', 'Un tableau de suivi des marchés (XLSX, ODS ou CSV) peut être repris : l\'outil propose une correspondance des colonnes, contrôle les données sans rien écrire, puis reprend les lignes valides. Un retour arrière reste possible.')
    ];
    carrousel.forEach(c => Object.assign(c, window.PHOTOS_ACCUEIL[c.id] || {}));
    return carrousel.concat(actualites, rubriques);
  };
})();
