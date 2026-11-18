# Couverture du CCTP — vavang

État au 19 novembre 2026. Tableau établi pour le mémoire technique. Il ne marque « disponible » que ce qui a été vu fonctionner, avec la preuve citée.

## Démo en ligne

- **Adresse** : https://psyc01-cpu.github.io/vavang-demo/ — page d'état : https://psyc01-cpu.github.io/vavang-demo/statut.html
- **Hébergement gratuit, sans aucun coût** : pages statiques sur GitHub Pages (HTTPS, http redirigé en 301 vers https, HSTS) ; base, authentification et fichiers sur Supabase, offre gratuite, région eu-west-1 (Irlande, UE). Aucune carte bancaire, aucune offre payante.
- **Données fictives.** L'organisme affiché en ligne est fictif (« Agglo Démo »). Le nom d'une collectivité réelle n'apparaît qu'en local.
- **Comptes de démonstration** : adresses en `@demo.example` et mot de passe public, écrits sur la page de connexion et dans `README.md` (section « Démo en ligne »). La clé de double authentification de l'administrateur est publique **volontairement**, pour la démo : elle est dans `config.js` (`CONFIG.demoMfaSecret`).
- **Remise à zéro** chaque nuit à 3 h (heure de La Réunion), par une tâche planifiée de la base (pg_cron).

## Récapitulatif

| Partie | Disponible | Partiel | Absent | Total |
|---|---|---|---|---|
| Article 2.1.3 — Fonctions attendues | 23 | 5 | 0 | 28 |
| Article 2.1.4 — Module d'analyse | 42 | 3 | 1 | 46 |
| Titre 3 — niveaux de service, sécurité, support, réversibilité | 12 | 11 | 0 | 23 |
| Reprise des données (2.5) | 2 | 0 | 0 | 2 |
| **Total** | **79** | **19** | **1** | **99** |

La seule ligne « absent » est l'intelligence artificielle, écartée volontairement. Deux autres fonctions sont absentes mais apparaissent comme limites dans des lignes partielles : l'envoi de courriels et l'authentification SAML.

## À lire avant d'utiliser ce tableau

1. **Mode local, vérifié par le scénario.** Le scénario complet est joué dans un vrai navigateur (Chrome sans interface), avec six profils : administrateur, gestionnaire, prescripteur, valideur, lecteur et support éditeur. Dernier passage le 19/11/2026 : **125 vérifications réussies, 69 captures, 14 fichiers exportés, aucune erreur JavaScript**. Détail : `captures/resultat-du-scenario.txt` ; il se rejoue par `npm run scenario`. Les règles de calcul ont 16 groupes de tests (`npm test`), tous réussis.
2. **Mode en ligne, vérifié côté serveur.** `tests/en-ligne.mjs` interroge la démo publique avec les vrais comptes et enregistre `mesures/en-ligne.json` (18/11/2026, 22:40 UTC) : **93 contrôles, 90 conformes, 1 non conforme, 2 limites**. Le non-conforme (F2) est décrit à la ligne « Verrouillage après plusieurs échecs ». Deux autres failles (F1 sur le stockage, F3 sur les données générales lisibles par le support) ont été trouvées, **corrigées** (`supabase/correctifs.sql`), puis revérifiées.
3. **Numéros de captures** : dossier `captures/`. 01 à 69 : mode local. 70 à 76 : démo en ligne. Documentation : dossier `docs/`.
4. **Ce qui n'est pas vérifié** est écrit dans la colonne des limites. Aucun audit par un tiers, aucun test avec un lecteur d'écran réel, aucun scan OWASP ZAP.

Légende : **disponible** = fonctionne et a été vérifié · **partiel** = une partie seulement fonctionne, précisée · **absent** = n'existe pas.

## Article 2.1.3 — Fonctions attendues

| Fonction du CCTP | État | Ce qui fonctionne réellement — limites | Preuve |
|---|---|---|---|
| **Expression du besoin** — recensement | disponible | Fiche de besoin : référence, objet, service, nature, famille homogène ou opération, montant, durée, année, récurrence. | capture 13 |
| Caractérisation | disponible | Champ libre de caractérisation (contexte, exigences, allotissement envisagé). Pas de questionnaire guidé. | capture 13 |
| Computation des seuils | disponible | Cumul par année, nature et famille homogène, tous services confondus. Seuils paramétrables, avec date d'effet, source et trace. Certains seuils restent marqués « à vérifier » dans l'application (voir fin de document). | captures 06, 13, 68, 69 ; tests |
| Aide au choix de la procédure | disponible | Procédure suggérée et expliquée, au niveau de la famille, du besoin et de la consultation. Seuils 2026 affichés avec leur source et leur état (« vérifié » ou « à vérifier »). Valeur totale des lots prise en compte ; dérogation des petits lots proposée. Le choix final est saisi et justifié par l'agent. | captures 14, 68, 69 ; scénario (vérifications 118 à 123) |
| Aide au choix du type de marché | partiel | Simple indication selon que le besoin est récurrent ou ponctuel. Raison : pas d'aide au choix entre accord-cadre, marché à tranches, etc. | capture 14 |
| **DCE** — modèles | disponible | Bibliothèque de modèles par type de pièce, avec variables remplies depuis la consultation (référence, objet, procédure, lots, date limite, critères de la grille). | captures 41, 44 |
| Contrôle de complétude | disponible | Pièces attendues selon la procédure, avec l'état de chacune. Liste non paramétrable à l'écran. | capture 43 |
| Rédaction assistée | **disponible** | Préremplissage par variables, insertion de clauses, **éditeur riche** (titres, gras, italique, listes, tableaux), collage assaini (aucun script conservé), mise en forme reprise dans les exports Word et PDF. **Limite** : aucune rédaction générée (pas d'IA). | captures 40, 41, 64, 65 ; scénario (104 à 112) |
| Versioning | disponible | Version numérotée, datée, signée, avec la nature des modifications ; toute version reste consultable, mise en forme comprise. | captures 41, 65 |
| GED intégrée ou connectable | **disponible** | GED intégrée : dépôt, classement par type, **arborescence libre** (dossiers, sous-dossiers, renommage, rangement par glisser-déposer), versions, recherche plein texte, fichier source conservé, actions tracées. **Limite** : pas de connecteur vers une GED tierce. | captures 19, 21, 66, 67 ; scénario (113 à 117) |
| Assistance avancée — suggestion de clauses | partiel | Clauses du type de document proposées en premier. Raison : pas de suggestion selon le contenu du document. | capture 40 |
| Assistance avancée — contrôle de cohérence et de conformité | partiel | Signalements simples : variables non renseignées, passages « à compléter », référence absente, date limite différente de la fiche, plusieurs dates. Raison : pas de contrôle de conformité réglementaire. | capture 41 |
| **Workflow** — rédaction → relecture → validation → publication | disponible | Approbation ou renvoi motivé en rédaction à chaque étape ; document figé hors rédaction. | captures 41, 42 ; scénario |
| Circuits paramétrables | disponible | L'administrateur ajoute, renomme, réordonne ou retire les étapes et choisit l'habilitation exigée pour chacune. Testé avec une étape « Visa juridique » ajoutée. **Limite** : un seul circuit paramétrable, celui du DCE ; le circuit de l'analyse reste fixe (analyste → valideur). | captures 39, 42 ; scénario |
| Traçabilité des validations | disponible | Chaque étape : auteur, date, heure, version concernée, commentaire. | captures 41, 42 |
| Publication | partiel | Paquet de publication : pièces validées en PDF et fiche de l'avis (`avis.json`) à charger sur le profil d'acheteur. Raison : aucun envoi direct vers un profil d'acheteur. | scénario (103) |
| **Analyse** — grilles, notes, contrôle des prix bas, rapports, courriers types | disponible | Voir l'article 2.1.4. | captures 16 à 37 |
| Outils d'assistance documentaire | disponible | Sans intelligence artificielle : lecture du texte des pièces, visionneuse PDF, recherche plein texte, comparaison transversale par critère, détection de pièces manquantes, d'écarts de prix et d'incohérences de totaux, synthèse par candidat assemblée à partir des appréciations validées. Aucune note, aucun classement, aucune décision produits par l'outil. | captures 20, 21, 24, 25, 32, 59 |
| **Suivi d'exécution** — ordres de service, bons de commande, avenants, reconductions | disponible | Enregistrement numéroté, daté, avec montant, état et pièce justificative. Cumul des bons de commande comparé au montant maximum ; montant du marché recalculé avec les avenants. | capture 47 |
| Révisions de prix | disponible | Formule P = P0 × (a + (1 − a) × I / I0). Vérifié : 0,15 + 0,85 × 112,4 / 108,2 = 1,033 ; 49 200 € révisés à 50 823,60 €. **Limite** : un seul indice par formule, valeur de l'indice saisie à la main. | capture 47 ; tests ; scénario |
| Suivi des états, pièces justificatives | disponible | État du marché et de chaque événement, pièces rattachées. | capture 47 |
| Suivi financier | **disponible** | Cumuls des bons de commande, des avenants et des révisions. **Factures** suivies de la réception au paiement (service fait, mandatement, paiement), avec le délai global de paiement de 30 jours. Export CSV documenté vers le logiciel financier. **Limite** : échange par fichier, pas de connexion directe au logiciel financier. | capture 60 ; scénario (96, 97) |
| **Pilotage** — tableaux de bord, indicateurs | disponible | Tableau de bord : cinq indicateurs, répartition par étape, dossiers en cours. Indicateurs fixes. | captures 12, 27 |
| Échéances et alertes | disponible | Alertes calculées (fin de marché, reconduction, plafond des bons de commande, validations attendues, réponses en retard, pièces absentes, seuils) et centre de notifications dans l'application. **Limite** : aucune notification par courriel (pas de service d'envoi gratuit configuré sans compte tiers). | captures 12, 31 ; scénario |
| **Sourcing** — fiches, qualification, historique, suivi, exports | disponible | Fiche d'identification, source, domaines, qualifications déclarées ; échanges datés ; historique des candidatures, marchés et évaluations ; export XLSX. | captures 48, 49 |
| Identification des opérateurs | partiel | Saisie manuelle, création automatique à la candidature, ou import d'un tableur. Raison : aucune source de données externe (annuaire des entreprises). | capture 54 |
| **Évaluation des titulaires** — critères | disponible | Critères et coefficients paramétrés par l'administrateur ; note globale en moyenne pondérée. Vérifié : critère ajouté de coefficient 2, 30 / 7 = 4,3. | captures 39, 50, 51 ; scénario |
| Historique, export | disponible | Historique par marché et par fournisseur, export XLSX. Validation réservée au valideur, refusée sans faits vérifiables. | capture 51 ; scénario |

## Article 2.1.4 — Module d'analyse des candidatures et des offres

| Fonction du CCTP | État | Ce qui fonctionne réellement — limites | Preuve |
|---|---|---|---|
| **Préparation** — analyse par consultation et par lot | disponible | Une grille et une analyse par lot. | captures 15, 17 |
| Variante, prestation supplémentaire, offre négociée | **disponible** | Le type de l'offre est enregistré. **Analyse distincte des variantes** : le classement porte sur les seules offres de base, chaque variante est analysée à part. | capture 63 ; scénario (102) |
| Import ou reprise des données du DCE, du règlement, des critères | **disponible** | Application d'un modèle de grille ; **lecture des critères d'un règlement de consultation existant** : critères, sous-critères et pondérations repris, contrôlés, puis confirmés par l'agent. **Limite** : seuls les critères sont lus dans le règlement. | captures 45, 62 ; scénario (99, 100) |
| Critères, sous-critères, pondérations, barèmes, formules, arrondi, contrôle du total | disponible | Deux niveaux de critères ; barème par critère ; trois formules de prix ; arrondi de 0 à 3 décimales ; verrouillage impossible si le total n'est pas 100. | captures 16, 17 ; tests |
| Modèles de grilles réutilisables, versions, date d'effet, auteur | disponible | | capture 45 |
| Rôles et habilitations par consultation | disponible | Affectation nominative avec une fonction (analyste, valideur, lecteur) ; un agent non affecté ne voit pas le dossier. **En ligne, appliqué par le serveur** : prescripteur et lecteur limités à leur dossier. | capture 15 ; scénario ; `mesures/en-ligne.json` |
| Rôles par lot | disponible | Une habilitation sur dossier peut être limitée à un lot : l'agent ne voit et ne note que ce lot. **Limite** : vérifié en mode local ; non contrôlé par les tests en ligne. | captures 15, 38 ; scénario |
| Rôles par service | **disponible** | Droits par service : un prescripteur voit les dossiers de son service, et seulement eux, sans affectation nominative. **Limite** : vérifié en mode local. | capture 61 ; scénario (98) |
| Verrouillage de la grille après validation | disponible | Réservé au profil habilité ; déverrouillage motivé et conservé dans l'historique. | capture 18 ; scénario |
| **Gestion documentaire** — dépôt, classement, consultation des pièces | disponible | Type de pièce proposé d'après le nom du fichier, corrigeable. | capture 19 |
| Formats courants, document source conservé, identification de la pièce | disponible | Texte lu pour PDF, DOCX, ODT, XLSX, XLS, ODS, CSV, TXT. **Limite** : pas de reconnaissance de caractères ; un PDF scanné est conservé et signalé « texte non lisible ». | captures 19, 20 |
| Recherche plein texte | disponible | Sur toutes les pièces du dossier, avec passage et page. | capture 21 |
| Navigation dans les pièces | **disponible** | **Visionneuse PDF** : pages avec leur mise en page d'origine, navigation et zoom. Autres formats : texte extrait page par page. **Limite** : la mise en page d'origine n'est affichée que pour les PDF. | captures 22, 59 ; scénario (95) |
| Annotation, commentaire interne, signet, renvoi vers la source | disponible | Annotation et signet sur un passage sélectionné, avec auteur, date et page. | capture 22 ; scénario |
| Détection des pièces absentes | disponible | | captures 20, 21 |
| Détection des pièces illisibles | disponible | Absence de texte lisible et fichiers vides. | capture 20 |
| Détection des pièces incomplètes ou incohérentes | partiel | Écart entre le total recalculé et le montant déclaré ; contrôle du contenu des déclarations (nom du candidat, clé du SIRET, montant de l'acte d'engagement). Raison : les autres incohérences restent constatées par l'agent. | capture 20 ; scénario (101) |
| Association d'une note à un extrait d'un document ou à une justification | disponible | Extrait sélectionné dans la pièce, avec fichier et page ; une note sans justification ne peut être ni proposée ni validée. | captures 22, 23 |
| **Candidatures** — vérification de la présence des justificatifs | **disponible** | Présence des pièces attendues, et **contrôle du contenu des déclarations** : nom du candidat absent, clé du SIRET fausse, montant de l'acte d'engagement différent, signalés pour vérification. | capture 21 ; scénario (101) |
| Suivi des demandes de compléments, échéances, réponses, décision | disponible | | capture 28 |
| Tableau comparatif distinguant constats, alertes et décisions | disponible | | capture 21 |
| **Analyse technique** — par candidat, lot, critère, sous-critère | disponible | | capture 23 |
| Appréciations, points forts, points faibles, réserves | disponible | | capture 23 |
| Comparaison transversale sans critère ajouté | disponible | | capture 24 |
| Calcul des notes à partir des valeurs validées | disponible | Totaux vérifiés par un calcul à la main (75,50 – 67,50 – 61,46). | capture 32 ; tests |
| Plusieurs contributeurs, consolidation, conservation des contributions | partiel | Chaque analyste saisit sa contribution ; le valideur en retient une par critère, ou la grille fait la **moyenne des contributions validées** (option désactivable, vérifiée par un test de calcul). Raison : le scénario dans le navigateur n'est joué qu'avec un seul analyste. | tests (groupe « consolidation ») |
| Circuit de relecture et de validation | disponible | Soumission, renvoi motivé, validation note par note, validation de l'analyse, réouverture motivée. Nul ne valide sa propre note ; en ligne, l'auto-validation est refusée par le serveur. | captures 29 à 32 ; `mesures/en-ligne.json` |
| **Analyse financière** — import ou saisie des prix et quantités | disponible | Lecture d'un bordereau XLSX, ODS ou CSV ; sinon saisie. | capture 19 |
| Comparaison, totaux, écarts, incohérences, données manquantes | disponible | | captures 20, 25 |
| Formule de prix appliquée sans modification automatique | disponible | | capture 25 |
| Signalement des offres potentiellement anormalement basses, sans rejet | disponible | Seuil d'alerte paramétrable ; écart à la moyenne des autres offres et à l'estimation. Écarter une offre reste une décision motivée du valideur. | capture 25 |
| Demandes de précisions, de justification, de régularisation, négociation | partiel | Suivi et trace des demandes, réponses et décisions. Raison : la négociation n'est qu'un type de demande, sans module dédié. | capture 28 |
| **Synthèse** — tableau d'analyse détaillé | disponible | Avec le contrôle des calculs : valeur validée, règle, auteur de la saisie et de la validation. | capture 32 |
| Classement provisoire à partir des seules notes validées | disponible | Une offre dont une note ou le montant n'est pas validé n'est pas classée. | captures 26, 30, 32 |
| Projet de rapport modifiable avant validation | disponible | Sections modifiables, versions, validation qui fige. Structure du rapport fixe. | captures 33, 35 |
| Tableaux comparatifs, demandes de précisions, courriers, notification depuis des modèles | disponible | Quatre modèles de courriers fournis, modifiables et extensibles. | capture 34 |
| Synthèses générées | disponible | Synthèse par candidat **assemblée sans IA** à partir des notes validées, sources citées. Export Word. **Limite** : assemblage, pas de rédaction en langage naturel. | capture 32 ; scénario |
| Export en PDF et en formats bureautiques modifiables | disponible | PDF, Word (DOCX), tableur (XLSX). Exemples dans `captures/exports`. | scénario |
| **Traçabilité** — journal des imports, consultations, annotations, modifications, validations, exports, changements de statut | disponible | Journal en ajout seul, consultable, filtrable, exportable en CSV ; vue « journal de sécurité ». En ligne, le journal ne peut pas être modifié (refus vérifié côté serveur). | captures 11, 37, 57 ; `mesures/en-ligne.json` |
| Journal des calculs | **disponible** | Journal des calculs horodaté : un calcul conservé à chaque validation, consultable. | capture 58 ; scénario (94) |
| Historique des versions de la grille, des notes, des rapports | disponible | | captures 18, 36 |
| Auteur, date et heure de chaque action | disponible | En mode local, l'heure est celle du poste ; en ligne, celle du serveur. | capture 37 |
| Dossier d'audit | disponible | PDF, et archive avec les pièces sources, les notes, les versions et le journal. | capture 36 ; scénario |
| Séparation des droits, accès aux seuls dossiers autorisés | **disponible** | **Appliquée par le serveur** (règles d'accès par ligne), testée en ligne : le support ne lit aucune consultation, offre, note, pièce ni fichier ; prescripteur et lecteur limités à leur dossier ; un anonyme ne lit que les annonces actives ; écritures directes refusées. | captures 75, 76 ; `mesures/en-ligne.json` |
| **Intelligence artificielle** | absent | Aucune IA gratuite ne garantit l'absence de sortie des données hors de l'UE. Aucune donnée transmise à un service d'IA. | — |
| **Preuves** | disponible | Données fictives et anonymes. | dossier `captures` |

## Titre 3 du CCTP — niveaux de service, sécurité, support, réversibilité

| Exigence | Article | État | Ce qui fonctionne réellement — limites | Preuve |
|---|---|---|---|---|
| Interface web, sans client lourd ni extension | 3.1 | disponible | Chrome, Edge ou Firefox, aucune installation. Démo en ligne en HTTPS. **Limite** : testé dans Chrome uniquement. | capture 70 ; démo en ligne |
| Authentification par l'annuaire de la collectivité (Active Directory, Entra ID, SAML, OpenID Connect), authentification unique | 3.1, 3.7.3 | **partiel** | Connexion unique par un fournisseur externe (application OAuth GitHub de test, gratuite) **vérifiée de bout en bout le 19/11/2026** sur la démo en ligne : association du compte dans « Ma sécurité » (autorisation accordée sur GitHub), puis connexion par « Se connecter avec GitHub » sans mot de passe vavang, session ouverte avec les seuls droits du profil (lecteur, 2 droits) ; un compte externe non associé est refusé (inscriptions publiques fermées). L'association de test a ensuite été retirée, et les identités externes des comptes de démo partagés sont purgées chaque nuit. Raison du « partiel » : OAuth GitHub n'est pas de l'OpenID Connect strict ni un annuaire de collectivité (Entra ID non testé) ; SAML absent (payant chez Supabase). | capture 77 ; `js/donnees.js`, `js/ecrans/securite.js` ; `supabase/purge-identites-demo.sql` |
| Authentification multifacteur, au minimum pour les administrateurs | 3.1, 3.7.3 | **disponible** | Code TOTP ; obligatoire pour les administrateurs. **En ligne, exigée par le serveur** : les actions d'administration demandent une session de niveau aal2. Code faux refusé. La clé de l'administrateur de démo est volontairement publique. | captures 04, 08, 10, 71, 72 ; `mesures/en-ligne.json` |
| Comptes nominatifs, désactivation rapide | 3.1 | disponible | En ligne : création, changement du mot de passe (qui ferme les sessions) et désactivation vérifiés. En local : création vérifiée, désactivation de son propre compte refusée. **Limite** : la réactivation existe dans l'écran d'administration mais n'est contrôlée par aucun test. | capture 05 ; scénario (3, 4) ; `mesures/en-ligne.json` |
| Révocation des sessions actives | 3.1 | **disponible** | En ligne : l'administrateur ferme les sessions d'un compte à distance ; la requête suivante est refusée et le jeton de renouvellement aussi. | capture 74 ; `mesures/en-ligne.json` |
| Durée de session paramétrable, verrouillage après inactivité | 3.1 | disponible | Déconnexion après une inactivité paramétrable (15 minutes par défaut), tracée. En ligne, jetons de 15 minutes renouvelés. **Limite** : pas de durée maximale de session indépendante de l'activité. | captures 11, 39 ; scénario |
| Verrouillage après plusieurs échecs de connexion | 3.7 | **partiel** | Seuil et durée paramétrables ; verrouillage et déverrouillage par l'administrateur vérifiés en ligne. Raison : faille F2, un tiers anonyme peut verrouiller un compte non administrateur (atténuée : 10 signalements par poste et par 15 minutes, jamais de verrouillage automatique d'un administrateur) ; la correction complète exige l'offre Supabase Team ou Enterprise. | captures 09, 10, 73 ; `mesures/en-ligne.json` (seul contrôle non conforme) |
| Gestion des rôles, séparation des privilèges, revue des habilitations | 3.7.3 | disponible | 6 profils, matrice de 27 actions, habilitations par dossier, par lot et par service. Refus vérifiés côté serveur. Revue : écran unique des comptes et des droits, sans campagne de revue périodique. | captures 05, 15, 38, 61, 75, 76 |
| Comptes de secours | 3.1 | **partiel** | Le seul administrateur de la démo ne peut pas se retirer son profil : refus vérifié en ligne (c'est la règle « pas de modification de son propre profil » qui a répondu). Une règle du serveur exige en plus au moins un administrateur actif (`supabase/schema_demo.sql`), sans test dédié. Raison : un seul administrateur dans la démo. | `mesures/en-ligne.json` (section 8) |
| Journalisation : connexions et échecs, comptes, habilitations, actions administratives, données, validations, exports, événements de sécurité | 3.7.5 | **disponible** | Date et heure, utilisateur, profil, action, objet, résultat. Filtre « journal de sécurité ». Export CSV. En ligne, journal non modifiable (vérifié). **Limites** : adresse IP non relevée en local ; conservation de 12 mois non démontrable sur la démo, remise à zéro chaque nuit. | captures 11, 37, 57 ; `mesures/en-ligne.json` |
| Hébergement et administration des données dans l'EEE | 3.7.2 | **partiel** | Base, authentification et fichiers chez Supabase, région eu-west-1 (Irlande). Raison : les pages statiques (sans données) sont servies par GitHub Pages et les artefacts de sauvegarde sont stockés chez GitHub, sans garantie de localisation dans l'UE. | `docs/SOUS-TRAITANTS.md` ; `docs/ARCHITECTURE.md` |
| Chiffrement des échanges et des données stockées | 3.7.4 | **partiel** | Échanges : HTTPS, redirection 301 de http vers https et HSTS, vérifiés. Au repos : chiffrement des disques AES-256 **déclaré par l'hébergeur** (documentation Supabase), non vérifiable par nous. Raison : les sauvegardes sont aujourd'hui publiées en clair (secret `SAUVEGARDE_CLE` non défini ; données fictives). | `mesures/en-ligne.json` ; `docs/SAUVEGARDE-ET-REPRISE.md` |
| Sauvegardes automatisées, chiffrées, testées | 3.7.6 | **partiel** | Action GitHub toutes les 3 h ; exécution manuelle réussie le 18/11/2026 en 1 min 16 s ; export complet (37 tables, 336 lignes, 14 fichiers, empreintes SHA-256) ; conservation 30 jours ; restauration testée. Raison : chiffrement prévu mais pas encore activé (secret non défini). | `.github/workflows/sauvegarde.yml` ; `docs/SAUVEGARDE-ET-REPRISE.md` |
| Restauration | 3.7.6 | **disponible** | En local : restauration d'un export complet, contrôlée. **En ligne** : exercice réel le 18/11/2026 à 22:40 UTC, 37 tables sur 37 identiques (SHA-256), 14 fichiers sur 14, aucun écart. **Limite** : restauration totale uniquement. | capture 56 ; `mesures/restauration-20261118.json` ; `tests/restauration.mjs` ; `docs/SAUVEGARDE-ET-REPRISE.md` |
| Plan de continuité et de reprise (RTO 8 h, RPO 4 h) | 3.7.7 | partiel | Procédure écrite et exercée. RTO technique mesuré : 25,8 s (exigence : 8 h). RPO de 3 h par conception (une sauvegarde toutes les 3 h), dans l'exigence de 4 h. Raison du « partiel » : les exécutions planifiées de GitHub ne sont pas garanties à l'heure ; le RPO réel n'a pas encore été mesuré sur plusieurs jours. | `mesures/restauration-20261118.json` ; `docs/SAUVEGARDE-ET-REPRISE.md` |
| Supervision, disponibilité 99,5 %, rapport mensuel de service | 3.2, 3.3.1 | **partiel** | Sonde (action GitHub) toutes les 15 minutes, exécution réussie en 14 s, historique conservé (`statut/historique.json`) ; page d'état publique ; modèle de rapport mensuel. Raison : la disponibilité de 99,5 % n'est ni mesurée sur un mois ni garantie (offres gratuites sans engagement de service). | `statut.html` ; `docs/SUPERVISION.md` ; `docs/RAPPORT-MENSUEL-MODELE.md` |
| Outil de ticketing : numéro unique, horodatage, demandeur, service, description, criticité, intervenant, statut, historique, délais applicables, date et motif de clôture | 3.3.4 | disponible | Tous ces champs, criticité P1 à P4 avec les délais du CCTP, situation de chaque délai, historique, notifications. Le support ne peut pas clore lui-même. **Limites** : jours fériés non déduits, pas de déclaration par courriel ni par téléphone. | captures 52, 53 ; tests ; scénario |
| Consultation de l'état et de l'historique des tickets par la collectivité | 3.3.4 | disponible | Chaque agent voit ses demandes ; l'administrateur les voit toutes. | capture 53 |
| Documentation utilisateur, administrateur, formats d'échange, sauvegarde et reprise | 3.10 | **disponible** | Guides utilisateur et administrateur, formats d'échange, sauvegarde et reprise, architecture, API, procédure de support, notes de version, sous-traitants, supervision, modèle de rapport mensuel. | dossier `docs` |
| Accessibilité numérique | 3.1 | partiel | axe-core : 11 écrans sur 11 sans violation (WCAG 2.1 A et AA). Auto-évaluation RGAA 4.1 : 44 critères conformes sur 62 applicables, **71,0 %** (« partiellement conforme ») ; 5 critères non testés. Raison : 18 non-conformités relevées (dont défilement horizontal à 320 px) et aucun test avec un lecteur d'écran réel. | `mesures/accessibilite.json` ; `docs/AUTO-EVALUATION-RGAA.md` |
| Test d'intrusion, gestion des vulnérabilités | 3.7.4 | **partiel** | Tests de sécurité en ligne : 93 contrôles, failles F1 et F3 corrigées et revérifiées, F2 atténuée. Contrôle passif : 17 conformes, 3 à corriger (en-têtes non configurables sur GitHub Pages), 3 faibles, 0 critique, aucun secret dans les fichiers servis. npm audit : 3 alertes dans des dépendances de développement non livrées ou neutralisées. Raison : pas de scan OWASP ZAP (Docker absent) ni de test d'intrusion par un tiers. | `mesures/en-ligne.json` ; `mesures/scan-securite.json` ; `docs/AUDIT-SECURITE-ET-ACCESSIBILITE.md` |
| Export complet dans un format ouvert, documenté | 2.6, 3.11 | disponible | Archive ZIP : tables en JSON et CSV, fichiers sources, texte extrait, journal, utilisateurs et habilitations, inventaire, dictionnaire des données. En ligne : export complet par `exporter_sauvegarde` (administrateur en aal2). Mots de passe et secrets exclus. | capture 55 ; `docs/FORMATS-ECHANGE.md` |
| Interfaces de programmation (API) documentées | 2.6 | **partiel** | API REST (PostgREST/Supabase) documentée : `docs/API.md` et `docs/openapi.json` (51 chemins, rédigé à la main) ; jetons JWT de 15 minutes et renouvellement ; exemples curl réellement exécutés. Raison : pas de jetons d'API de longue durée pour un logiciel tiers. | `docs/API.md` ; `docs/openapi.json` |

## Reprise des données (CCTP 2.5)

| Fonction | État | Limites |
|---|---|---|
| Reprise d'un tableur de marchés ou de fournisseurs (XLSX, XLS, ODS, CSV) | disponible | Correspondance des colonnes, reprise à blanc, rapport de contrôle, reprise définitive, retour arrière (capture 54). Autres données : non reprises. |
| Reprise de documents (PDF, DOCX, ODT, XLSX, ODS, CSV) | disponible | Rattachement manuel à un marché ou à une consultation, un envoi à la fois. Pas de reprise en masse d'une arborescence de 650 dossiers. |

## Environnement (critère 3)

Mesures dans `docs/MESURES-ENVIRONNEMENT.md`. Avec le chargement des bibliothèques à la demande, chaque écran passe de **4,5 Mo à 0,43 Mo** transférés (−90 %) et la mémoire JavaScript de **26,5 Mo à 2,8 Mo** (−89 %). Aucune ressource tierce, aucune IA. Poids mesurés sans compression : ce sont des majorants.

## Points à vérifier avant de les écrire dans le mémoire

- **Seuils** : l'aide au choix affiche chaque seuil avec sa source et son état. Ceux marqués « à vérifier » dans l'application (capture 69) doivent être contrôlés sur les textes en vigueur avant d'être cités.
- **Sauvegardes** : le CCTP demande une perte de données maximale de 4 heures. Le dispositif gratuit sauvegarde toutes les 3 heures ; les exécutions planifiées de GitHub peuvent toutefois être retardées, d'où le statut partiel tant que le RPO réel n'est pas mesuré.
- **Authentification unique** : l'aller-retour réel avec GitHub reste à vérifier avant d'écrire « disponible ».
- **Chiffrement au repos** : à citer comme « déclaré par l'hébergeur », avec la documentation Supabase en source.
