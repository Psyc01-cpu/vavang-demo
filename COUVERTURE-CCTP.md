# Couverture du CCTP — vavang

État au 18 novembre 2026. Tableau établi pour le mémoire technique : il ne marque « disponible » que ce qui a été vu fonctionner.

## À lire avant d'utiliser ce tableau

1. **Ce qui a été vérifié.** Le scénario complet a été joué dans un vrai navigateur (Chrome sans interface), avec six comptes de profils différents : administrateur, gestionnaire, prescripteur, valideur, lecteur et support éditeur. Résultat : **95 vérifications réussies, 57 captures d'écran, 10 fichiers exportés, aucune erreur**. Le détail est dans `captures/resultat-du-scenario.txt` ; le scénario se rejoue par `npm run scenario`. Les règles de calcul ont en plus 13 groupes de tests (`npm test`).
2. **Dans quel mode.** Cette vérification a été faite en **mode démonstration locale** : les données sont enregistrées dans le navigateur de l'utilisateur. Les habilitations et les règles y sont appliquées par l'application elle-même, sur un seul poste.
3. **Ce qui n'est pas vérifié.** Le mode hébergé (Postgres, authentification et stockage Supabase en région UE, règles d'accès imposées par le serveur) est **écrit mais n'a jamais été exécuté**. Décision du 18/11/2026 : aucun euro engagé, aucune mise en ligne. On ne peut donc pas écrire que la solution est un service en ligne multi-utilisateur opérationnel. Les statuts « disponible » valent **pour le mode local**.
4. **Numéros de captures** : ceux du dossier `captures/` (01 à 57). Documentation : dossier `docs/`.

Légende : **disponible** = fonctionne et a été vérifié · **partiel** = une partie seulement fonctionne, précisée · **absent** = n'existe pas.

## Article 2.1.3 — Fonctions attendues

| Fonction du CCTP | État | Ce qui fonctionne réellement — limites | Preuve |
|---|---|---|---|
| **Expression du besoin** — recensement | disponible | Fiche de besoin : référence, objet, service, nature, famille homogène ou opération, montant, durée, année, récurrence. | capture 13 |
| Caractérisation | disponible | Champ libre de caractérisation (contexte, exigences, allotissement envisagé). Pas de questionnaire guidé. | capture 13 |
| Computation des seuils | disponible | Cumul par année, nature et famille homogène, tous services confondus. Seuils paramétrables, avec date d'effet et trace. **Valeurs par défaut à vérifier** (voir fin de document). | captures 06, 13 ; tests |
| Aide au choix de la procédure | disponible | Procédure suggérée et expliquée, au niveau de la famille et du besoin seul. Le choix final est saisi et justifié par l'agent. | capture 14 |
| Aide au choix du type de marché | partiel | Simple indication selon que le besoin est récurrent ou ponctuel. | capture 14 |
| **DCE** — modèles | disponible | Bibliothèque de modèles par type de pièce, avec variables remplies depuis la consultation (référence, objet, procédure, lots, date limite, critères de la grille). | captures 41, 44 |
| Contrôle de complétude | disponible | Pièces attendues selon la procédure, avec l'état de chacune. Liste non paramétrable à l'écran. | capture 43 |
| Rédaction assistée | partiel | Préremplissage par variables et insertion de clauses. Éditeur de texte simple, sans mise en forme riche. Aucune rédaction générée. | captures 40, 41 |
| Versioning | disponible | Version numérotée, datée, signée, avec la nature des modifications ; toute version reste consultable. | capture 41 |
| GED intégrée ou connectable | partiel | Dépôt, classement par type, versions, recherche plein texte, fichier source conservé. Pas d'arborescence libre, pas de connecteur vers une GED tierce. | captures 19, 21 |
| Assistance avancée — suggestion de clauses | partiel | Clauses du type de document proposées en premier. Pas de suggestion selon le contenu. | capture 40 |
| Assistance avancée — contrôle de cohérence et de conformité | partiel | Signalements simples : variables non renseignées, passages « à compléter », référence absente, date limite différente de la fiche, plusieurs dates. Pas de contrôle de conformité réglementaire. | capture 41 |
| **Workflow** — rédaction → relecture → validation → publication | disponible | Approbation ou renvoi motivé en rédaction à chaque étape ; document figé hors rédaction. | captures 41, 42 ; scénario |
| Circuits paramétrables | **disponible** | L'administrateur ajoute, renomme, réordonne ou retire les étapes et choisit l'habilitation exigée pour chacune. Testé avec une étape « Visa juridique » ajoutée. Une étape qui a des documents en attente ne peut pas être retirée. **Limite** : un seul circuit, celui du DCE ; le circuit de l'analyse reste fixe (analyste → valideur). | captures 39, 42 ; scénario |
| Traçabilité des validations | disponible | Chaque étape : auteur, date, heure, version concernée, commentaire. | captures 41, 42 |
| Publication | partiel | Marquage « publié » seulement. Aucun envoi vers un profil d'acheteur. | — |
| **Analyse** — grilles, notes, contrôle des prix bas, rapports, courriers types | disponible | Voir l'article 2.1.4. | captures 16 à 37 |
| Outils d'assistance documentaire | **disponible** | Sans intelligence artificielle : lecture du texte des pièces, recherche plein texte, comparaison transversale par critère, détection de pièces manquantes, d'écarts de prix et d'incohérences de totaux, **synthèse par candidat assemblée à partir des appréciations validées**. Aucune note, aucun classement, aucune décision produits par l'outil. | captures 20, 21, 24, 25, 32 |
| **Suivi d'exécution** — ordres de service, bons de commande, avenants, reconductions | disponible | Enregistrement numéroté, daté, avec montant, état et pièce justificative. Cumul des bons de commande comparé au montant maximum ; montant du marché recalculé avec les avenants. | capture 47 |
| Révisions de prix | **disponible** | Formule P = P0 × (a + (1 − a) × I / I0) paramétrée dans le marché (part fixe, indice, I0, mois zéro). La valeur de l'indice est saisie à la main, et le coefficient arrondi au millième supérieur. Vérifié : 0,15 + 0,85 × 112,4 / 108,2 = 1,033 ; 49 200 € révisés à 50 823,60 €. **Limite** : un seul indice par formule, et aucune récupération automatique des indices publiés. | capture 47 ; tests |
| Suivi des états, pièces justificatives | disponible | État du marché et de chaque événement, pièces rattachées. | capture 47 |
| Suivi financier | partiel | Cumuls des bons de commande, des avenants et des révisions. Pas de factures, de paiements ni de lien avec le logiciel financier. | capture 47 |
| **Pilotage** — tableaux de bord, indicateurs | disponible | Tableau de bord : cinq indicateurs, répartition par étape, dossiers en cours. Indicateurs fixes. | captures 12, 27 |
| Échéances et alertes | **disponible** | Alertes calculées (fin de marché, reconduction, plafond des bons de commande, validations attendues, réponses en retard, pièces absentes, seuils) et **centre de notifications intégré** : note à revoir, analyse à valider ou validée, document à traiter à chaque étape du circuit, demandes d'assistance. Compteur de non lues dans le menu. **Limite** : aucun envoi par courriel. | captures 12, 31 ; scénario |
| **Sourcing** — fiches, qualification, historique, suivi, exports | disponible | Fiche d'identification, source, domaines, qualifications déclarées ; échanges datés ; historique des candidatures, marchés et évaluations ; export XLSX. | captures 48, 49 |
| Identification des opérateurs | partiel | Saisie manuelle, création automatique à la candidature, ou import d'un tableur. Aucune source de données externe. | capture 54 |
| **Évaluation des titulaires** — critères | **disponible** | Critères et coefficients paramétrés par l'administrateur ; note globale en moyenne pondérée. Vérifié avec un critère ajouté de coefficient 2 : 30 / 7 = 4,3. Une évaluation garde les critères de sa date. | captures 39, 50, 51 ; scénario |
| Historique, export | disponible | Historique par marché et par fournisseur, export XLSX. Validation réservée au valideur, refusée sans faits vérifiables. | capture 51 ; scénario |

## Article 2.1.4 — Module d'analyse des candidatures et des offres

| Fonction du CCTP | État | Ce qui fonctionne réellement — limites | Preuve |
|---|---|---|---|
| **Préparation** — analyse par consultation et par lot | disponible | Une grille et une analyse par lot. | captures 15, 17 |
| Variante, prestation supplémentaire, offre négociée | partiel | Le type de l'offre est enregistré et l'offre est classée avec les autres. Pas d'analyse distincte par variante. | — |
| Import ou reprise des données du DCE, du règlement, des critères | partiel | Application d'un modèle de grille ; critères repris dans le règlement généré. Pas de lecture automatique d'un règlement existant. | capture 45 |
| Critères, sous-critères, pondérations, barèmes, formules, arrondi, contrôle du total | disponible | Deux niveaux de critères ; barème par critère ; trois formules de prix ; arrondi de 0 à 3 décimales, au plus proche, à l'inférieur ou au supérieur ; verrouillage impossible si le total n'est pas 100. | captures 16, 17 ; tests |
| Modèles de grilles réutilisables, versions, date d'effet, auteur | disponible | | capture 45 |
| Rôles et habilitations par consultation | disponible | Affectation nominative avec une fonction (analyste, valideur, lecteur) ; un agent non affecté ne voit pas le dossier. | capture 15 ; scénario |
| Rôles par lot | **disponible** | Une habilitation sur dossier peut être limitée à un lot : l'agent ne voit et ne note que ce lot, et toute saisie sur un autre lot est refusée. | captures 15, 38 ; scénario |
| Rôles par service | partiel | Le service est une donnée du compte, sans effet sur les droits. | — |
| Verrouillage de la grille après validation | disponible | Réservé au profil habilité ; déverrouillage motivé et conservé dans l'historique. | capture 18 ; scénario |
| **Gestion documentaire** — dépôt, classement, consultation des pièces | disponible | Type de pièce proposé d'après le nom du fichier, corrigeable. | capture 19 |
| Formats courants, document source conservé, identification de la pièce | disponible | Texte lu pour PDF, DOCX, ODT, XLSX, XLS, ODS, CSV, TXT. **Pas de reconnaissance de caractères** : un PDF scanné est conservé et signalé « texte non lisible ». | captures 19, 20 |
| Recherche plein texte | disponible | Sur toutes les pièces du dossier, avec passage et page. | capture 21 |
| Navigation dans les pièces | partiel | Lecture du texte extrait, page par page. Pour la mise en page d'origine, il faut télécharger le fichier source. | capture 22 |
| Annotation, commentaire interne, signet, renvoi vers la source | disponible | Annotation et signet sur un passage sélectionné, avec auteur, date et page. | capture 22 ; scénario |
| Détection des pièces absentes | disponible | | captures 20, 21 |
| Détection des pièces illisibles | disponible | Absence de texte lisible et fichiers vides. | capture 20 |
| Détection des pièces incomplètes ou incohérentes | partiel | Écart entre le total recalculé et le montant déclaré. Le reste est constaté par l'agent. | capture 20 |
| Association d'une note à un extrait d'un document ou à une justification | disponible | Extrait sélectionné dans la pièce, avec fichier et page ; une note sans justification ne peut être ni proposée ni validée. | captures 22, 23 |
| **Candidatures** — vérification de la présence des justificatifs | partiel | Présence des pièces attendues. Le contenu des déclarations n'est pas vérifié. | capture 21 |
| Suivi des demandes de compléments, échéances, réponses, décision | disponible | | capture 28 |
| Tableau comparatif distinguant constats, alertes et décisions | disponible | | capture 21 |
| **Analyse technique** — par candidat, lot, critère, sous-critère | disponible | | capture 23 |
| Appréciations, points forts, points faibles, réserves | disponible | | capture 23 |
| Comparaison transversale sans critère ajouté | disponible | | capture 24 |
| Calcul des notes à partir des valeurs validées | disponible | Totaux vérifiés par un calcul à la main (75,50 – 67,50 – 61,46). | capture 32 ; tests |
| Plusieurs contributeurs, consolidation, conservation des contributions | partiel | Chaque analyste saisit sa contribution ; le valideur en retient une par critère ; les autres sont conservées. **Vérifié avec un seul analyste.** Pas de moyenne automatique ; non désactivable. | — |
| Circuit de relecture et de validation | disponible | Soumission, renvoi motivé d'une note, validation note par note, validation de l'analyse, réouverture motivée. Nul ne valide sa propre note. Notifications dans l'application à chaque étape. | captures 29 à 32 |
| **Analyse financière** — import ou saisie des prix et quantités | disponible | Lecture d'un bordereau XLSX, ODS ou CSV ; sinon saisie. | capture 19 |
| Comparaison, totaux, écarts, incohérences, données manquantes | disponible | | captures 20, 25 |
| Formule de prix appliquée sans modification automatique | disponible | | capture 25 |
| Signalement des offres potentiellement anormalement basses, sans rejet | disponible | Seuil d'alerte paramétrable ; écart à la moyenne des autres offres et à l'estimation. Écarter une offre reste une décision motivée du valideur. | capture 25 |
| Demandes de précisions, de justification, de régularisation, négociation | partiel | Suivi et trace des demandes, réponses et décisions. La négociation n'est qu'un type de demande. | capture 28 |
| **Synthèse** — tableau d'analyse détaillé | disponible | Avec le contrôle des calculs : valeur validée, règle, auteur de la saisie et de la validation. | capture 32 |
| Classement provisoire à partir des seules notes validées | disponible | Une offre dont une note ou le montant n'est pas validé n'est pas classée. | captures 26, 30, 32 |
| Projet de rapport modifiable avant validation | disponible | Sections modifiables, versions, validation qui fige. Structure du rapport fixe. | captures 33, 35 |
| Tableaux comparatifs, demandes de précisions, courriers, notification depuis des modèles | disponible | Quatre modèles de courriers fournis, modifiables et extensibles. | capture 34 |
| Synthèses générées | **disponible** | Synthèse par candidat **assemblée sans IA** : rang provisoire, prix et signalements, points forts, points faibles, réserves, sources citées, chacun renvoyant au critère et à la note validée. Aucun texte inventé. Export Word. **Limite** : c'est un assemblage, pas une rédaction en langage naturel. | capture 32 ; scénario |
| Export en PDF et en formats bureautiques modifiables | disponible | PDF, Word (DOCX), tableur (XLSX). Exemples dans `captures/exports`. | scénario |
| **Traçabilité** — journal des imports, consultations, annotations, modifications, validations, exports, changements de statut | disponible | Journal en ajout seul, consultable, filtrable, exportable en CSV ; vue « journal de sécurité ». | captures 11, 37, 57 |
| Journal des calculs | partiel | Calculs refaits à chaque affichage et restitués en détail, pas journalisés un par un. | capture 32 |
| Historique des versions de la grille, des notes, des rapports | disponible | | captures 18, 36 |
| Auteur, date et heure de chaque action | disponible | En mode local, l'heure est celle du poste. | capture 37 |
| Dossier d'audit | disponible | PDF, et archive avec les pièces sources, les notes, les versions et le journal. | capture 36 ; scénario |
| Séparation des droits, accès aux seuls dossiers autorisés | partiel | Vérifiée dans l'application (boutons absents, écritures refusées, lots non affectés invisibles). **Application par le serveur non vérifiée.** | scénario |
| **Intelligence artificielle** | absent | Aucune fonction d'IA ; aucune donnée transmise à un service tiers. | — |
| **Preuves** | disponible | Données fictives et anonymes. | dossier `captures` |

## Titre 3 du CCTP — niveaux de service, sécurité, support, réversibilité

| Exigence | Article | État | Ce qui fonctionne réellement — limites | Preuve |
|---|---|---|---|---|
| Interface web, sans client lourd ni extension | 3.1 | disponible | Chrome, Edge ou Firefox, aucune installation. Testé dans Chrome uniquement. | — |
| Authentification par l'annuaire de la collectivité (Active Directory, Entra ID, SAML, OpenID Connect), authentification unique | 3.1, 3.7.3 | absent | Comptes propres à l'application. | — |
| Authentification multifacteur, au minimum pour les administrateurs | 3.1, 3.7.3 | **disponible (local)** | Code TOTP compatible avec les applications d'authentification courantes ; activation par code QR et confirmation ; **obligatoire pour les administrateurs** (paramètre) ; code faux refusé ; réinitialisation par l'administrateur. En hébergement, elle reposerait sur l'authentification multifacteur de Supabase : **non écrit, non testé**. | captures 04, 08, 10 ; scénario |
| Comptes nominatifs, désactivation rapide | 3.1 | disponible | Création, désactivation, réactivation, réinitialisation du mot de passe. | capture 05 |
| Révocation des sessions actives | 3.1 | partiel | Un compte désactivé ne peut plus se connecter ; une session déjà ouverte sur un autre poste n'est pas coupée à distance (sans objet en mode local). | — |
| Durée de session paramétrable, verrouillage après inactivité | 3.1 | **disponible** | Déconnexion automatique après une durée d'inactivité paramétrable (15 minutes par défaut), tracée. **Limite** : pas de durée maximale de session indépendante de l'activité. | captures 11, 39 ; scénario |
| Verrouillage après plusieurs échecs de connexion | 3.7 | **disponible** | Seuil et durée paramétrables (5 échecs, 15 minutes) ; le bon mot de passe est refusé pendant le verrouillage ; déverrouillage par l'administrateur. | captures 09, 10 ; scénario |
| Gestion des rôles, séparation des privilèges, revue des habilitations | 3.7.3 | disponible | 6 profils, matrice de 27 actions, habilitations par dossier et par lot. Revue : écran unique des comptes et des droits, sans campagne de revue périodique. | captures 05, 15, 38 |
| Comptes de secours | 3.1 | absent | — | — |
| Journalisation : connexions et échecs, comptes, habilitations, actions administratives, données, validations, exports, événements de sécurité | 3.7.5 | **disponible (local)** | Date et heure, utilisateur, profil, action, objet, résultat, origine (navigateur). Filtre « journal de sécurité ». Export CSV. Conservation illimitée en local. **Limite** : l'adresse IP n'est pas relevée en mode local. | captures 11, 37, 57 |
| Hébergement et administration des données dans l'EEE | 3.7.2 | absent | Prévu sur Supabase, région UE (Irlande). **Non mis en place.** | — |
| Chiffrement des échanges et des données stockées | 3.7.4 | absent | Sans objet en local ; serait assuré par l'hébergeur (HTTPS, chiffrement au repos). Non vérifié. | — |
| Sauvegardes automatisées, chiffrées, testées | 3.7.6 | absent | Voir `docs/SAUVEGARDE-ET-REPRISE.md` : dispositif prévu, non testé. | — |
| Restauration | 3.7.6 | **disponible (local)** | Restauration d'un export complet : archive contrôlée par rapport à son inventaire avant écriture, puis remplacement de toutes les données et de tous les fichiers. Testé : 15 tables reviennent exactement à l'état sauvegardé, pièces et texte compris. **Limite** : restauration totale uniquement. | capture 56 ; scénario |
| Plan de continuité et de reprise (RTO 8 h, RPO 4 h) | 3.7.7 | partiel | Procédure écrite (`docs/SAUVEGARDE-ET-REPRISE.md`) ; **aucun exercice réalisé**. Le RPO de 4 h suppose une option payante de l'hébergeur. | — |
| Supervision, disponibilité 99,5 %, rapport mensuel de service | 3.2, 3.3.1 | absent | — | — |
| Outil de ticketing : numéro unique, horodatage, demandeur, service, description, criticité, intervenant, statut, historique, délais applicables, date et motif de clôture | 3.3.4 | **disponible** | Module « Demandes d'assistance » : tous ces champs, criticité P1 à P4 avec les délais du CCTP (P1 en continu, P2 à P4 en heures ou jours ouvrés, 8 h-17 h heure de La Réunion), situation de chaque délai (respecté, en retard), historique des échanges, notifications. La clôture est validée par la collectivité ; le support ne peut pas clore lui-même. Délai de clôture tacite de 5 jours ouvrés affiché, non automatisé. **Limites** : jours fériés non déduits, pas de déclaration par courriel ni par téléphone. | captures 52, 53 ; tests ; scénario |
| Consultation de l'état et de l'historique des tickets par la collectivité | 3.3.4 | disponible | Chaque agent voit ses demandes ; l'administrateur les voit toutes. | capture 53 |
| Documentation utilisateur, administrateur, formats d'échange, sauvegarde et reprise | 3.10 | **partiel** | `docs/GUIDE-UTILISATEUR.md`, `docs/GUIDE-ADMINISTRATEUR.md`, `docs/FORMATS-ECHANGE.md`, `docs/SAUVEGARDE-ET-REPRISE.md`. Manquent : documentation d'architecture, d'interfaces (API), procédure de support, notes de version, liste des sous-traitants. | dossier `docs` |
| Accessibilité numérique | 3.1 | partiel | Navigation au clavier, libellés des champs, contrastes de la charte, pause du défilement des annonces. **Aucun audit réalisé.** | — |
| Test d'intrusion, gestion des vulnérabilités | 3.7.4 | absent | — | — |
| Export complet dans un format ouvert, documenté | 2.6, 3.11 | disponible | Archive ZIP : tables en JSON et CSV, fichiers sources, texte extrait, journal, utilisateurs et habilitations, inventaire, dictionnaire des données. Formats décrits dans `docs/FORMATS-ECHANGE.md`. Mots de passe et secrets exclus. | capture 55 |
| Interfaces de programmation (API) documentées | 2.6 | absent | Échanges par fichiers ouverts uniquement. | — |

## Reprise des données (CCTP 2.5)

| Fonction | État | Limites |
|---|---|---|
| Reprise d'un tableur de marchés ou de fournisseurs (XLSX, XLS, ODS, CSV) | disponible | Correspondance des colonnes, reprise à blanc, rapport de contrôle, reprise définitive, retour arrière (capture 54). Autres données : non reprises. |
| Reprise de documents (PDF, DOCX, ODT, XLSX, ODS, CSV) | disponible | Rattachement manuel à un marché ou à une consultation, un envoi à la fois. Pas de reprise en masse d'une arborescence de 650 dossiers. |

## Environnement (critère 3)

Mesures dans `docs/MESURES-ENVIRONNEMENT.md`. Avec le chargement des bibliothèques à la demande, chaque écran passe de **4,5 Mo à 0,43 Mo** transférés (−90 %) et la mémoire JavaScript de **26,5 Mo à 2,8 Mo** (−89 %). Aucune ressource tierce, aucune IA. Poids mesurés sans compression : ce sont des majorants.

## Points à vérifier avant de les écrire dans le mémoire

- **Seuils par défaut** : 60 000 € HT (dispense, fournitures et services), 100 000 € HT (dispense, travaux), 90 000 € HT (publicité), 216 000 € HT et 5 404 000 € HT (procédure formalisée). Saisis de mémoire, non contrôlés sur les textes en vigueur.
- **Sauvegardes** : le CCTP demande une perte de données maximale de quatre heures. L'offre Supabase de base sauvegarde une fois par jour ; atteindre quatre heures suppose une option payante de restauration à un instant donné, dont le prix est à vérifier.
