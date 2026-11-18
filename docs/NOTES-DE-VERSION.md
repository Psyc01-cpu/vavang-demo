# vavang — notes de version

Éditeur : l’entreprise.ai, Saint-Paul, La Réunion.

## Avertissement

- vavang est un **prototype**. Aucune version n’est en service chez une collectivité. Toutes les données sont fictives.
- Les versions 0.1 à 0.4 ont été **reconstituées après coup**, d’après `README.md` et `COUVERTURE-CCTP.md`. Le dépôt Git n’existe que depuis la mise en ligne (version 0.5) ; aucune étiquette de version. Seules les dates écrites dans ces documents sont reprises ; les autres ne sont pas connues.
- Le numéro de `package.json` est resté à `0.1.0`. Il sera aligné à la prochaine livraison.
- Jusqu’à la version 0.4, les vérifications citées portent sur le **mode local** (données dans le navigateur). À partir de la version 0.5, la démo en ligne (mode hébergé, données fictives) est aussi vérifiée côté serveur.

## Méthode de mise à jour (toutes versions)

Le site est statique : une mise à jour remplace des fichiers. Il n’y a pas de migration de base en mode local ; le format JSON des tables est conservé d’une version à l’autre, et les données de démonstration manquantes sont complétées au démarrage.

**Retour arrière, procédure commune :**
1. Avant la mise à jour : export complet (menu « Reprise, export et sauvegarde ») et copie du dossier de l’application.
2. Pour revenir : remettre en place la copie des fichiers précédents.
3. Si les données ont été modifiées par la nouvelle version : restaurer l’export complet pris à l’étape 1.

En mode hébergé, la même logique s’appliquerait au site statique. Le retour arrière du schéma Postgres n’est pas écrit.

---

## Version 0.5 — démo en ligne et preuves côté serveur (19 novembre 2026)

Objectif : mettre en ligne une démo gratuite, hébergée dans l’UE, et vérifier côté serveur ce qui ne l’était qu’en local.

### Évolutions
- **Démo en ligne** : https://psyc01-cpu.github.io/vavang-demo/ (GitHub Pages, HTTPS, HSTS) ; base, authentification et fichiers sur Supabase, offre gratuite, région eu-west-1 (Irlande). Organisme fictif « Agglo Démo ». Comptes de démonstration documentés dans `README.md`. Remise à zéro chaque nuit à 3 h (heure de La Réunion).
- **Sécurité côté serveur** : règles d’accès par ligne ; double authentification de l’administrateur exigée par le serveur (session aal2) ; verrouillage et déverrouillage des comptes ; fermeture des sessions à distance ; règle empêchant de retirer le dernier administrateur.
- **Connexion par un fournisseur externe** : OAuth GitHub de test (association dans « Ma sécurité », refus d’un compte non associé). Aller-retour réel avec GitHub à vérifier.
- **Sauvegarde** toutes les 3 h par action GitHub, export complet avec empreintes SHA-256, chiffrement possible par secret ; **restauration** vérifiée table par table et fichier par fichier.
- **Supervision** toutes les 15 minutes, page d’état publique `statut.html`, modèle de rapport mensuel.
- **API REST** documentée : `docs/API.md` et `docs/openapi.json` (51 chemins).
- **Éditeur riche du DCE** : titres, gras, italique, listes, tableaux ; collage assaini ; mise en forme reprise dans les exports Word et PDF.
- **GED** : arborescence libre de dossiers, rangement par glisser-déposer.
- **Aide au choix de la procédure** renforcée : seuils 2026 avec leur source et leur état, valeur totale des lots, dérogation des petits lots.
- **Documentation** : architecture, API, supervision, procédure de support, sous-traitants, audit de sécurité et d’accessibilité, auto-évaluation RGAA, notes de version.

### Corrections
- **F1** (stockage) et **F3** (données générales lisibles par le support) : failles trouvées par les tests en ligne, corrigées par `supabase/correctifs.sql`, puis revérifiées.
- **F2** (un tiers anonyme peut verrouiller un compte non administrateur) : atténuée (10 signalements par poste et par 15 minutes, jamais de verrouillage automatique d’un administrateur). Correction complète impossible sur l’offre gratuite.

### Vérifications
- Scénario local : 125 vérifications, 69 captures, aucune erreur JavaScript.
- Tests de calcul : 16 groupes réussis.
- Tests en ligne (`mesures/en-ligne.json`) : 93 contrôles, 90 conformes, 1 non conforme (F2), 2 limites (pas d’en-tête anti-cadre sur GitHub Pages ; un seul administrateur en démo). Captures 70 à 76.
- Exercice de restauration le 18/11/2026 à 22:40 UTC (`mesures/restauration-20261118.json`) : 37 tables sur 37 et 14 fichiers sur 14 identiques, 0 écart, RTO technique 25,8 s. RPO par conception : 3 h (exigence CCTP : 4 h).
- Accessibilité : axe-core, 11 écrans sur 11 sans violation ; auto-évaluation RGAA 4.1 à 71,0 %.
- Contrôle de sécurité passif (`mesures/scan-securite.json`) : 17 conformes, 3 à corriger (en-têtes), 3 faibles, 0 critique. Pas de scan OWASP ZAP.

### Impacts
- Administrateurs : la double authentification est imposée par le serveur en ligne.
- Données : nouvelles fonctions SQL `exporter_sauvegarde` et `restaurer_sauvegarde` ; tâche de remise à zéro nocturne.
- Exploitation : secret `SAUVEGARDE_CLE` à créer pour chiffrer les sauvegardes (non défini à ce jour, artefacts en clair, données fictives).

### Anomalies connues
- Voir la liste commune.

### Retour arrière
- Site : remettre en place les fichiers de la version précédente sur GitHub Pages.
- Base : restaurer la dernière sauvegarde par `tests/restauration.mjs`. Le retour arrière du schéma SQL n’est pas écrit.

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
- **Mode local** : les données et les comptes vivent dans le navigateur d’un poste (mots de passe en empreinte PBKDF2). Le mode local ne doit servir qu’à la démonstration.
- **SheetJS** : passé de 0.18.5 (vulnérable) à 0.20.3, version corrigée diffusée par l’éditeur (voir `docs/AUDIT-SECURITE-ET-ACCESSIBILITE.md`).
- **pdf.js 3.11.174** : faille CVE-2024-4367 neutralisée par `isEvalSupported: false` (`js/documents.js`, `js/ecrans/visionneuse.js`). Passage à la version 4 à planifier.
- **Fonction `gerer-compte`** : client Supabase figé en version 2.119.0, chargé depuis le registre npm.
- Faille F2 en ligne : un tiers anonyme peut verrouiller un compte non administrateur. Atténuée ; correction complète réservée à une offre Supabase payante.
- L’habilitation limitée à un lot n’est pas contrôlée par les tests en ligne.
- Pas d’en-têtes de sécurité personnalisés (anti-cadre notamment) sur GitHub Pages.
- Un seul administrateur dans la démo en ligne.
- Pas de durée maximale de session indépendante de l’activité.
- Adresse IP non relevée au journal en mode local.

### Fonctions
- Testé dans Chrome uniquement.
- Seuils de procédure : certains restent marqués « à vérifier » dans l’application, à contrôler sur les textes en vigueur.
- Plusieurs analystes : moyenne des contributions vérifiée par un test de calcul ; le scénario dans le navigateur n’en joue qu’un.
- Jours fériés non déduits des délais du support.
- Restauration totale uniquement.
- Pas de reconnaissance de caractères sur les PDF scannés.
- Pas d’envoi de courriel.
- Pas d’IA.
- Connexion par GitHub : aller-retour réel à vérifier ; pas de SAML.

### Exploitation
- Sauvegardes publiées en clair tant que le secret `SAUVEGARDE_CLE` n’est pas défini.
- RPO réel non encore mesuré sur la durée (cible 3 h ; exécutions planifiées GitHub non garanties à l'heure).
- Disponibilité de 99,5 % ni mesurée sur un mois ni garantie (offres gratuites).
- Artefacts de sauvegarde et pages statiques chez GitHub, sans garantie de localisation dans l’UE.
