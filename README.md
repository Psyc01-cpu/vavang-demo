# vavang — gestion des marchés publics côté acheteur (prototype)

Prototype de l'entreprise.ai. Données de démonstration entièrement fictives.

Nom et identité : **vavang** (du créole « vavanguer », faire le tour : le marché public de bout en bout). Direction artistique « case créole » : vert lontan #1F5B3F, crème #F6F1E4, rouge brique #B4472B, accent braise #E8871E, titres en serif, frise de lambrequins (`css/app.css`, classe `.frise`), logo `img/vavang.svg` et `img/vavang-clair.svg`. Le nom se change dans `config.js`.

## Démo en ligne

- Adresse : https://psyc01-cpu.github.io/vavang-demo/ — page d'état : https://psyc01-cpu.github.io/vavang-demo/statut.html
- Hébergement gratuit : pages statiques sur GitHub Pages (HTTPS) ; base, authentification et fichiers sur Supabase, offre gratuite, région eu-west-1 (Irlande, UE). Aucune offre payante.
- Organisme fictif (« Agglo Démo ») et données fictives. Remise à zéro chaque nuit à 3 h (heure de La Réunion).
- Comptes de démonstration (mot de passe public commun : `Demonstration-2026`) :

| Profil | Adresse |
|---|---|
| Administrateur | `admin@demo.example` |
| Gestionnaire | `gestionnaire@demo.example` |
| Prescripteur | `prescripteur@demo.example` |
| Valideur | `valideur@demo.example` |
| Lecteur | `lecteur@demo.example` |
| Support éditeur | `support@demo.example` |

- L'administrateur a une double authentification réelle, exigée par le serveur. Sa clé de démonstration est publique **volontairement** : `CONFIG.demoMfaSecret` dans `config.js`.
- Tests de la démo en ligne : `node tests/en-ligne.mjs` → `mesures/en-ligne.json` (93 contrôles le 18/11/2026 : 90 conformes, 1 non conforme, 2 limites). Détail dans `COUVERTURE-CCTP.md`.

## Lancer la démonstration locale

```
npm install
npm run servir
```

Puis ouvrir http://127.0.0.1:4173 dans Chrome, Edge ou Firefox. Les six comptes de démonstration sont proposés sur l'écran de connexion (administrateur, gestionnaire, prescripteur, valideur, lecteur, support éditeur). Les données restent dans le navigateur ; le menu « Paramètres » de l'administrateur permet de les réinitialiser.

## Vérifier

- `npm test` : règles de calcul (16 groupes : arrondi, formules de prix, classement, consolidation, signalement des prix bas, seuils, échéances).
- `npm run scenario` : joue le scénario complet dans Chrome sans interface, avec six profils, refait les captures de `captures/` et écrit `captures/resultat-du-scenario.txt` (19/11/2026 : 125 vérifications, 69 captures, 0 erreur JavaScript). Les plis fictifs sont fabriqués dans `demo/plis/`.
- `node tests/en-ligne.mjs` : contrôles de sécurité et de droits sur la démo en ligne → `mesures/en-ligne.json`.
- `node tests/restauration.mjs` : exercice de restauration de la démo en ligne (voir `docs/SAUVEGARDE-ET-REPRISE.md` ; rapport du 18/11/2026 : `mesures/restauration-20261118.json`).
- `node tests/accessibilite.mjs` et `node tests/scan-securite.mjs` : accessibilité (axe-core) et contrôle de sécurité passif → `mesures/`.

## Organisation

| Dossier ou fichier | Contenu |
|---|---|
| `index.html`, `css/`, `js/` | L'application (aucune étape de construction). |
| `js/calcul.js` | Règles de calcul, sans accès aux données. |
| `js/donnees.js` | Accès aux données (mode local ou hébergé), habilitations, règles métier, journal. |
| `js/documents.js` | Lecture du texte des pièces, exports PDF, Word, tableur, archive. |
| `js/ecrans/` | Un fichier par domaine : besoins, consultations, DCE, offres, analyse, rapport, exécution, fournisseurs, administration, reprise. |
| `js/demo.js` | Jeu de données fictif. |
| `vendor/` | Bibliothèques embarquées (aucun appel à un service extérieur). |
| `supabase/` | Schéma, règles d'accès, correctifs (`correctifs.sql`), sauvegarde et restauration (`sauvegarde.sql`) du mode hébergé. Exécutés sur la démo en ligne. |
| `tests/` | Tests de calcul, scénario complet, petit serveur local. |
| `captures/` | Captures d'écran et fichiers exportés par le scénario. |
| `COUVERTURE-CCTP.md` | Tableau de couverture, fonction par fonction. |
| `js/ecrans/accueil.js`, `css/accueil.css`, `js/demo-accueil.js` | Page d'accueil publique (onglets, annonces qui défilent, connexion, actualités) et son écran d'administration. |
| `img/photos/` | Photos de La Réunion des annonces (licences libres CC BY-SA, crédits dans `img/photos/CREDITS.md`, affichés sur chaque annonce). |

## Mode hébergé : état au 19/11/2026

Déployé sur la démo en ligne, sans coût (voir « Démo en ligne »). Restent ouverts :
1. Faille F2 (un tiers peut verrouiller un compte non administrateur) : atténuée ; la correction complète exige une offre Supabase payante.
2. Secret `SAUVEGARDE_CLE` à créer pour chiffrer les artefacts de sauvegarde.
3. Aller-retour réel de la connexion par GitHub (OAuth de test) à vérifier.
4. Pas d'envoi de courriels, pas d'IA.

## Documentation

| Fichier | Contenu |
|---|---|
| `COUVERTURE-CCTP.md` | Couverture du CCTP, exigence par exigence, avec preuves. |
| `docs/GUIDE-UTILISATEUR.md` | Guide utilisateur. |
| `docs/GUIDE-ADMINISTRATEUR.md` | Guide administrateur. |
| `docs/ARCHITECTURE.md` | Architecture technique. |
| `docs/API.md`, `docs/openapi.json` | API REST (51 chemins, description rédigée à la main). |
| `docs/FORMATS-ECHANGE.md` | Formats d'export et d'import. |
| `docs/SAUVEGARDE-ET-REPRISE.md` | Sauvegarde, restauration, plan de reprise, exercice du 18/11/2026. |
| `docs/SUPERVISION.md` | Supervision et page d'état. |
| `docs/RAPPORT-MENSUEL-MODELE.md` | Modèle de rapport mensuel de service. |
| `docs/PROCEDURE-SUPPORT.md` | Procédure de support. |
| `docs/SOUS-TRAITANTS.md` | Liste des sous-traitants. |
| `docs/AUDIT-SECURITE-ET-ACCESSIBILITE.md` | Contrôles de sécurité et d'accessibilité. |
| `docs/AUTO-EVALUATION-RGAA.md` | Auto-évaluation RGAA 4.1. |
| `docs/MESURES-ENVIRONNEMENT.md` | Mesures de sobriété. |
| `docs/NOTES-DE-VERSION.md` | Notes de version. |

## Bibliothèques embarquées

supabase-js (client), pdf.js 3.11 (lecture des PDF), pdfmake (export PDF), docx (export Word), SheetJS (tableurs), JSZip (archives). Toutes sous licence libre ; versions dans `package-lock.json`.

## Ajouts du 18 novembre 2026 (chantier mémoire, gratuit et local)

| Fichier | Contenu |
|---|---|
| `js/totp.js`, `js/ecrans/securite.js` | Double authentification TOTP, déconnexion après inactivité, verrouillage après échecs, journal de sécurité, paramètres de sécurité. |
| `js/ecrans/complements.js` | Centre de notifications, circuit du DCE paramétrable, critères d'évaluation paramétrables, synthèse par candidat sans IA, révision des prix par formule. |
| `js/ecrans/support.js` | Demandes d'assistance : numéro, criticité P1 à P4, délais du CCTP en heures ouvrées, historique, clôture validée par la collectivité. Demandes du guichet : badge « Guichet », numéro à rappeler, action « Rappel effectué ». |
| `js/ecrans/guichet.js`, `supabase/guichet.sql` | Guichet du support sans connexion (`#/guichet`) : pas de ligne directe ; type de panne, commentaire, numéro de rappel, accusé de réception (numéro, date et heure). En ligne, dépôt par la fonction serveur `deposer_demande_guichet` (à exécuter). |
| `docs/` | Guides utilisateur et administrateur, formats d'échange, sauvegarde et reprise, mesures environnementales. |
| `tests/mesures.mjs`, `mesures/` | Mesures de sobriété (poids, requêtes, mémoire), avant et après le chargement des bibliothèques à la demande. |

Compte de démonstration ajouté : `support@demo.example` (profil « Support éditeur »). L'administrateur doit activer la double authentification à sa première connexion.
