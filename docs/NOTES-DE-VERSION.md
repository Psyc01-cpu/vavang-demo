# vavang — notes de version

Éditeur : l’entreprise.ai, Saint-Paul, La Réunion.

## Avertissement

- vavang est un **prototype**. Aucune version n’est en service chez une collectivité. Toutes les données sont fictives.
- Les versions 0.1 à 0.4 ont été **reconstituées après coup**, d’après `README.md` et `COUVERTURE-CCTP.md`. Le projet n’est pas encore sous gestion de versions (pas de dépôt Git, pas d’étiquettes). Seules les dates écrites dans ces documents sont reprises ; les autres ne sont pas connues.
- Le numéro de `package.json` est resté à `0.1.0`. Il sera aligné à la prochaine livraison.
- Toutes les vérifications citées portent sur le **mode local** (données dans le navigateur). Le mode hébergé est écrit, jamais exécuté.

## Méthode de mise à jour (toutes versions)

Le site est statique : une mise à jour remplace des fichiers. Il n’y a pas de migration de base en mode local ; le format JSON des tables est conservé d’une version à l’autre, et les données de démonstration manquantes sont complétées au démarrage.

**Retour arrière, procédure commune :**
1. Avant la mise à jour : export complet (menu « Reprise, export et sauvegarde ») et copie du dossier de l’application.
2. Pour revenir : remettre en place la copie des fichiers précédents.
3. Si les données ont été modifiées par la nouvelle version : restaurer l’export complet pris à l’étape 1.

En mode hébergé, la même logique s’appliquerait au site statique. Le retour arrière du schéma Postgres n’est pas écrit.

---

## Version 0.4 — rubriques de la page d’accueil et double marque

### Évolutions
- **Articles des rubriques** de la page d’accueil (`js/demo-articles.js`) : textes courts par onglet (Solutions, Se former, S’informer, Échanges), chacun avec sa photo et son crédit. Modifiables par l’administrateur.
- **Double marque** : le logo et le nom de la collectivité s’affichent avec ceux de vavang (`config.js` : `organisme`, `logoOrganisme`). L’administrateur peut déposer un autre logo dans les Paramètres.
- Mention « Maquette de démonstration — données fictives » tant que l’outil n’est pas en service.

### Corrections
- Aucune correction consignée.

### Impacts
- Utilisateurs : aucun changement dans les écrans métier.
- Administrateur : contenu des rubriques et logo de la collectivité à vérifier avant toute présentation.
- Données : les articles sont stockés dans la table `annonces`.

### Anomalies connues
- Voir la liste commune en fin de document.

### Retour arrière
- Procédure commune. Les articles déjà enregistrés restent dans `annonces` et sont ignorés par une version antérieure qui ne les affiche pas.

---

## Version 0.3 — chantier « 4 critères » (18 novembre 2026)

Objectif : combler les manques relevés dans la couverture du CCTP, sans coût et en local.

### Évolutions
- **Circuits paramétrables** : l’administrateur ajoute, renomme, réordonne ou retire les étapes du circuit de validation du DCE, chacune liée à une habilitation. Une étape qui a des documents en attente ne peut pas être retirée.
- **Habilitation par lot** : une affectation peut être limitée à un lot ; l’agent ne voit et ne note que ce lot.
- **Centre de notifications** dans l’application, avec compteur de non lues. Pas de courriel.
- **Révision des prix** par formule P = P0 × (a + (1 − a) × I / I0), coefficient arrondi au millième supérieur.
- **Critères d’évaluation des titulaires** paramétrables, avec coefficients ; une évaluation garde les critères de sa date.
- **Synthèse par candidat sans IA** : assemblage des appréciations validées, avec critère et source. Export Word.
- **Sécurité** : double authentification TOTP (obligatoire pour les administrateurs), verrouillage après 5 échecs pendant 15 minutes, déconnexion après 15 minutes d’inactivité, journal de sécurité, paramètres de sécurité.
- **Restauration** d’un export complet, avec contrôle de l’archive par rapport à son inventaire avant toute écriture.
- **Demandes d’assistance** : numéro unique, criticité P1 à P4, délais du CCTP, historique, clôture validée par la collectivité. Nouveau profil « Support éditeur ».
- **Sobriété** : bibliothèques lourdes chargées à la demande. De 4,5 Mo à 0,43 Mo transférés par écran, de 26,5 Mo à 2,8 Mo de mémoire JavaScript.
- **Documentation** : guides utilisateur et administrateur, formats d’échange, sauvegarde et reprise, mesures environnementales.

### Corrections
- Le chargement systématique de toutes les bibliothèques à chaque écran est supprimé.

### Impacts
- **Administrateurs** : doivent activer la double authentification à leur première connexion.
- Nouvelles tables : `notifications`, `tickets`. Nouveaux paramètres : `circuit_dce`, `criteres_evaluation`, `securite`.
- La matrice des habilitations compte désormais 27 actions, dont « déclarer » et « traiter » une demande d’assistance.
- Vérification : 95 vérifications réussies, 57 captures, aucune erreur JavaScript.

### Anomalies connues
- Voir la liste commune.

### Retour arrière
- Procédure commune. Une version antérieure ignore les nouvelles tables et les nouveaux paramètres. Les comptes qui ont activé la double authentification gardent leur secret ; une version antérieure ne le demande pas.

---

## Version 0.2 — page d’accueil et identité vavang

### Évolutions
- **Nom et identité** : vavang, du créole « vavanguer ». Direction artistique « case créole » : vert lontan, crème, rouge brique, accent braise, frise de lambrequins, logo clair et foncé.
- **Page d’accueil publique**, avant connexion : onglets d’information, annonces qui défilent (avec pause), connexion avec aide, actualités de la collectivité et de l’éditeur.
- **Administration de la page d’accueil** : annonces programmables, photos de la bibliothèque ou déposées, avec crédit.
- **Photos** de La Réunion sous licence libre, crédits affichés (`img/photos/CREDITS.md`).

### Corrections
- Aucune correction consignée.

### Impacts
- Le nom du logiciel se change dans `config.js`.
- Nouvelle table `annonces`, lisible sans connexion en mode hébergé (annonces actives seulement).

### Anomalies connues
- Accessibilité : aucun audit réalisé.

### Retour arrière
- Procédure commune.

---

## Version 0.1 — socle et analyse des offres

### Évolutions
- **Socle** : site statique sans étape de construction, deux modes de données (local et hébergé) derrière une même interface, 5 profils (administrateur, gestionnaire, prescripteur, valideur, lecteur), habilitations par profil et par dossier, journal en ajout seul.
- **Besoins** : recensement, computation des seuils, aide au choix de la procédure.
- **Consultations et DCE** : lots, modèles, versions, contrôle de complétude, circuit de validation fixe.
- **Analyse des offres** : dépôt des plis, lecture du texte des pièces, recherche plein texte, annotations, grille à deux niveaux, formules de prix, arrondis, verrouillage, notes justifiées par un extrait, validation par un autre agent, signalement des offres anormalement basses, classement provisoire.
- **Rapport** modifiable puis figé, courriers types, dossier d’audit.
- **Exécution** : ordres de service, bons de commande, avenants, reconductions.
- **Fournisseurs** et évaluations des titulaires.
- **Reprise** de tableurs, export complet ZIP en format ouvert.
- **Mode hébergé écrit** : `supabase/schema.sql` (règles d’accès par ligne, déclencheurs) et fonction `gerer-compte`. Non exécuté.

### Corrections
- Sans objet (première version).

### Impacts
- Première version.

### Anomalies connues
- Voir la liste commune.

### Retour arrière
- Sans objet.

---

## Anomalies et limites connues (état au 19 novembre 2026)

### Sécurité
- **Mode local** : les mots de passe de démonstration sont stockés en clair dans le navigateur. Le mode local ne doit servir qu’à la démonstration.
- **SheetJS 0.18.5** (version du registre npm) : des vulnérabilités publiques concernent la lecture de fichiers piégés (CVE-2023-30533, CVE-2024-22363). À remplacer par la version diffusée par SheetJS (0.20.2 ou plus) avant tout usage réel.
- **pdf.js 3.11.174** : version concernée par CVE-2024-4367 tant que l’option `isEvalSupported` n’est pas désactivée, ce qui est le cas dans `js/documents.js`. À corriger (option désactivée ou mise à jour).
- **Fonction `gerer-compte`** : son client est importé depuis `esm.sh` sans version figée. À embarquer ou à figer avant déploiement.
- L’habilitation limitée à un lot n’est pas reprise dans les règles serveur de `schema.sql`.
- Double authentification du mode hébergé : non écrite.
- Pas de durée maximale de session indépendante de l’activité. Une session ouverte n’est pas coupée à distance.
- Adresse IP non relevée au journal en mode local.

### Fonctions
- Testé dans Chrome uniquement.
- Seuils de procédure par défaut saisis de mémoire, à vérifier sur les textes en vigueur.
- Contributions de plusieurs analystes vérifiées avec un seul analyste.
- Jours fériés non déduits des délais du support.
- Restauration totale uniquement.
- Pas de reconnaissance de caractères sur les PDF scannés.
- Pas d’envoi de courriel.

### Exploitation
- Mode hébergé jamais déployé : sauvegardes, chiffrement, supervision, disponibilité et plan de reprise ne sont pas vérifiés.
