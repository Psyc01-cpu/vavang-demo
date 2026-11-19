/* Articles des onglets de la page d'accueil (rubriques), écrits dans le ton du blog de l'entreprise.ai :
   court, direct, le bénéfice avant la fonction. Contenu de démonstration, modifiable par l'administrateur. */
(function () {
  'use strict';
  const P = {
    solutions: { image: 'img/photos/fournaise-vue-du-ciel.jpg', credit: 'Le Piton de la Fournaise vu du ciel — photo Pouyot, CC BY-SA 4.0', cadrage: 'center 45%' },
    'se-former': { image: 'img/photos/maido-lever-du-soleil.jpg', credit: 'Lever du soleil sur le Maïdo — photo Rémih, CC BY-SA 4.0', cadrage: 'center 35%' },
    's-informer': { image: 'img/photos/mafate-depuis-le-grand-benare.jpg', credit: 'Mafate depuis le Grand Bénare — photo Mamphi, CC BY-SA 3.0', cadrage: 'center 45%' },
    echanges: { image: 'img/photos/le-port-vue-du-ciel.jpg', credit: 'Le Port vu du ciel — photo Ville du Port, CC BY-SA 4.0', cadrage: 'center 55%' }
  };
  const A = (id, onglet, ordre, titre, resume, contenu, lecture) => Object.assign({ id, type: 'rubrique', onglet, ordre, titre, resume, contenu, lecture_min: lecture, actif: true, mis_a_jour: '2026-11-18' }, P[onglet]);
  window.DemoArticles = () => [
    A('r-preparer', 'solutions', 1, 'Préparer le besoin sans rien oublier', 'Un tableur par service, des besoins éparpillés, un seuil franchi sans le voir. vavang additionne pour vous et vous dit quelle procédure s’impose.', `
Chaque année, c’est la même course. Les services envoient leurs besoins par courriel, chacun dans son format. Personne ne voit que trois achats de mobilier, mis bout à bout, dépassent le seuil de publicité.

## Ce qui change
- **Un formulaire unique** pour tous les services : objet, montant, durée, famille d’achat.
- **Le cumul se fait tout seul**, par famille homogène et tous services confondus.
- **La procédure s’affiche** à côté du montant cumulé, avec l’explication du seuil en jeu.

## En trois gestes
1. Le service prescripteur recense son besoin.
2. La direction de la commande publique lit la computation des seuils.
3. Elle arrête la procédure, la justifie, et crée la consultation en un clic.

> La procédure suggérée reste une aide. Le choix final, et sa justification, reviennent à l’acheteur. Tout est tracé.`, 2),
    A('r-dce', 'solutions', 2, 'Un DCE prêt en une matinée, validé sans allers-retours', 'Les modèles se remplissent seuls, les clauses s’insèrent en un clic, et le circuit de validation suit le document jusqu’à la publication.', `
Rédiger un dossier de consultation, c’est souvent copier l’ancien, chercher les références à changer, puis attendre trois signatures par courriel.

## Des modèles qui se remplissent
La référence, l’objet, les lots, la date limite et les critères de la grille sont repris dans le document. Il reste à écrire ce qui est propre au marché.

## Une bibliothèque de clauses
Révision des prix, clause environnementale, offres anormalement basses : les clauses validées par la direction s’insèrent là où se trouve le curseur.

## Un circuit qui s’adapte à votre organisation
Relecture, visa juridique, validation : c’est l’administrateur qui choisit les étapes et qui peut les approuver. Chaque passage est daté et signé.

> Chaque enregistrement crée une version. On sait toujours qui a changé quoi, et quand.`, 2),
    A('r-analyser', 'solutions', 3, 'Analyser les offres : chaque note a sa preuve', 'Grille verrouillée avant l’ouverture des plis, note justifiée par un extrait du mémoire, classement établi à partir des seules notes validées.', `
Une analyse se conteste rarement sur les chiffres. Elle se conteste sur la justification. vavang vous oblige à l’écrire au moment où vous notez.

## Avant les plis : une grille figée
Critères, sous-critères, pondérations, formule de prix, règle d’arrondi. L’outil vérifie que le total fait 100. Un valideur verrouille la grille : elle ne bouge plus.

## Pendant : une note, une preuve
Vous sélectionnez la phrase du mémoire technique qui justifie la note. Elle est citée avec le nom du fichier et la page. **Une note sans justification ne peut pas être validée.**

## Après : un classement que personne ne fabrique
- Les montants sont validés par un agent habilité.
- Chaque note est validée par un autre agent que celui qui l’a saisie.
- Le classement provisoire ne retient que les notes validées.

> L’outil signale les pièces manquantes et les prix anormalement bas. Il ne rejette rien, ne note rien, ne classe rien tout seul.`, 3),
    A('r-executer', 'solutions', 4, 'Suivre l’exécution sans tableur à côté', 'Ordres de service, bons de commande, avenants, révisions de prix : tout est rattaché au marché, avec ses pièces et ses échéances.', `
Un marché notifié, c’est le début du travail. Les bons de commande s’accumulent, un avenant passe, la reconduction arrive sans prévenir.

## Tout sur une seule fiche
- **Le montant actuel**, avenants compris.
- **Le cumul des bons de commande**, comparé au montant maximum.
- **La révision des prix calculée** : saisissez l’indice, vavang applique la formule du marché et arrondit le coefficient.

## Les échéances qui remontent
La fin de période et la date de décision de reconduction s’affichent dans le tableau de bord, 120 jours avant.

> Chaque événement garde sa pièce justificative : l’ordre de service, le bon de commande, l’avenant signé.`, 2),
    A('r-piloter', 'solutions', 5, 'Piloter l’activité d’un coup d’œil', 'Consultations en cours, validations en attente, échéances, alertes : le tableau de bord et les notifications vous disent quoi faire aujourd’hui.', `
Le matin, une question : qu’est-ce qui m’attend ? vavang y répond en une page.

## Le tableau de bord
Consultations par étape, analyses à valider, marchés en cours, montant notifié, alertes à traiter.

## Les notifications
Une note renvoyée, une analyse à valider, un document à relire, une réponse du support : vous êtes prévenu dans l’application, avec le lien direct.

## L’évaluation des titulaires
Des critères définis par la collectivité, une note de 1 à 5, et toujours des faits vérifiables à l’appui.

> Une évaluation n’exclut jamais automatiquement une entreprise. Elle sert à piloter, pas à sanctionner.`, 2),
    A('r-formations', 'se-former', 1, 'Prise en main : une demi-journée suffit', 'Des sessions courtes, par profil, dans vos locaux, sur vos propres dossiers. On repart en sachant faire, pas en ayant écouté.', `
On n’apprend pas un logiciel en regardant quelqu’un cliquer. Chaque session se passe sur le poste de l’agent, avec un dossier réel ou fictif.

## Trois formats
- **Administrateurs** : une journée. Comptes, habilitations, circuits, modèles, seuils, sécurité.
- **Gestionnaires de marchés** : une journée. Du recensement du besoin au rapport d’analyse.
- **Prescripteurs, valideurs, lecteurs** : une demi-journée. Les gestes de leur profil, rien de plus.

## Comment ça se passe
1. Présentation courte des écrans utiles.
2. Démonstration sur un dossier complet.
3. Cas pratiques, puis questions.
4. Une évaluation rapide de ce qui est acquis.

> Chaque participant repart avec une fiche pratique d’une page pour son profil.`, 2),
    A('r-guides', 'se-former', 2, 'Guides pas à pas', 'Les gestes courants, écran par écran, en moins de cinq minutes chacun.', `
Un doute au moment d’agir ? Les guides répondent à une seule question à la fois.

## Les plus consultés
- Recenser un besoin et lire la computation des seuils.
- Paramétrer et verrouiller une grille d’analyse.
- Justifier une note par un extrait du mémoire technique.
- Valider une analyse et générer le rapport.
- Activer la double authentification.

> Le guide utilisateur et le guide administrateur complets sont remis au format numérique, et tenus à jour à chaque version.`, 1),
    A('r-faq', 'se-former', 3, 'Questions fréquentes', 'Les réponses aux questions qu’on nous pose le plus.', `
## Puis-je modifier une note validée ?
Non. Un valideur doit d’abord la rouvrir. La réouverture est tracée au journal.

## Qui peut verrouiller une grille ?
Les profils habilités par l’administrateur, en général les valideurs.

## J’ai oublié mon mot de passe.
Contactez l’administrateur de votre collectivité : il le réinitialise.

## Mon compte est verrouillé.
Après cinq essais infructueux, le compte se bloque quinze minutes. L’administrateur peut le débloquer tout de suite.

## J’ai changé de téléphone.
Demandez à l’administrateur de réinitialiser votre double authentification, puis activez-la de nouveau.`, 2),
    A('r-seuils', 's-informer', 1, 'Seuils et procédures : ce que l’outil applique', 'Les seuils utilisés pour la computation sont tenus par la direction de la commande publique, avec leur date d’effet.', `
Les seuils changent : seuils européens tous les deux ans, décrets nationaux entre-temps. vavang ne les fige pas.

## Qui les tient à jour ?
L’administrateur, depuis l’écran des paramètres. Chaque modification est datée, signée et tracée.

## Où les voir ?
Une fois connecté, dans « Besoins et seuils ». Les valeurs en vigueur s’affichent au-dessus de la computation.

> L’aide au choix de la procédure s’appuie sur ces valeurs. Vérifiez-les à chaque évolution réglementaire.`, 1),
    A('r-veille', 's-informer', 2, 'Veille réglementaire', 'Ce qui change dans la commande publique, et ce que vavang adapte en conséquence.', `
Chaque évolution qui touche l’outil est annoncée ici, avant son entrée en vigueur.

## Pour chaque évolution
- La nature du changement et le texte concerné.
- La date d’entrée en vigueur.
- Ce qui change dans vavang, et la date de mise à disposition.

> Les adaptations réglementaires font partie du service. Elles ne sont jamais facturées en plus.`, 1),
    A('r-donnees', 's-informer', 3, 'Vos données restent les vôtres', 'Où sont vos données, qui y accède, comment les récupérer. Sans petites lignes.', `
## Elles ne servent qu’à vous
Aucune autre finalité. Aucun entraînement de modèle d’intelligence artificielle. vavang n’utilise d’ailleurs aucune IA.

## Vous les récupérez quand vous voulez
L’administrateur exporte tout en une archive : données en JSON et en CSV, documents d’origine, journaux, inventaire et dictionnaire des données. Aucun format propriétaire.

## Chaque accès laisse une trace
Connexions, échecs, changements de droits, exports : tout est inscrit au journal de sécurité, qui ne se modifie pas.

> La double authentification est obligatoire pour les administrateurs.`, 1),
    A('r-support', 'echanges', 1, 'Contacter le support', 'Pas de ligne directe : un guichet de demandes, et l’équipe support vous rappelle.', `
## Le guichet du support
Onglet « Échanges », puis « Contacter le support ». Choisissez le type de panne, écrivez un commentaire, laissez le numéro où vous joindre.

## Ce qui se passe ensuite
- Un numéro de demande, avec la date et l’heure du dépôt.
- L’équipe support traite votre demande et vous rappelle aux horaires du guichet.
- Chaque rappel et chaque échange sont datés dans l’historique de la demande.

> Une fois connecté, vous suivez aussi vos demandes dans le menu « Demandes d’assistance ».`, 1),
    A('r-ameliorations', 'echanges', 2, 'Proposer une amélioration', 'Une fonction vous manque, un écran vous semble compliqué ? Dites-le. Chaque proposition reçoit une réponse.', `
Les meilleures évolutions viennent de ceux qui utilisent l’outil tous les jours.

## Comment proposer
Déclarez une demande d’assistance en criticité P4, avec le mot « évolution » dans l’objet. Décrivez le besoin, pas la solution : on cherchera la bonne ensemble.

> Chaque proposition reçoit une réponse argumentée : retenue, à l’étude, ou non retenue et pourquoi.`, 1),
    A('r-club', 'echanges', 3, 'Le club des utilisateurs', 'Des agents de plusieurs services qui partagent leurs modèles et leurs astuces. Une rencontre par trimestre.', `
## Pourquoi un club
Un modèle de lettre de rejet bien fait sert à tout le monde. Une astuce de paramétrage aussi.

## Ce qu’on y fait
- Des retours d’expérience, sans jargon.
- Des modèles partagés entre services.
- Les priorités d’évolution, votées par ceux qui utilisent l’outil.`, 1)
  ];
  window.PHOTOS_ONGLETS = P;
})();
