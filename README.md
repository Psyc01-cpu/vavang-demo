# vavang — gestion des marchés publics côté acheteur (prototype)

Prototype de l'entreprise.ai. Données de démonstration entièrement fictives.

Nom et identité : **vavang** (du créole « vavanguer », faire le tour : le marché public de bout en bout). Direction artistique « case créole » : vert lontan #1F5B3F, crème #F6F1E4, rouge brique #B4472B, accent braise #E8871E, titres en serif, frise de lambrequins (`css/app.css`, classe `.frise`), logo `img/vavang.svg` et `img/vavang-clair.svg`. Le nom se change dans `config.js`.

## Lancer la démonstration locale

```
npm install
npm run servir
```

Puis ouvrir http://127.0.0.1:4173 dans Chrome, Edge ou Firefox. Les cinq comptes de démonstration sont proposés sur l'écran de connexion (administrateur, gestionnaire, prescripteur, valideur, lecteur). Les données restent dans le navigateur ; le menu « Paramètres » de l'administrateur permet de les réinitialiser.

## Vérifier

- `npm test` : règles de calcul (arrondi, formules de prix, classement, signalement des prix bas, seuils, échéances).
- `npm run scenario` : joue le scénario complet dans Chrome sans interface, avec quatre profils, refait les captures de `captures/` et écrit `captures/resultat-du-scenario.txt`. Les plis fictifs sont fabriqués dans `demo/plis/`.

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
| `supabase/` | Schéma, règles d'accès et fonction serveur du mode hébergé. **Écrits, jamais exécutés.** |
| `tests/` | Tests de calcul, scénario complet, petit serveur local. |
| `captures/` | Captures d'écran et fichiers exportés par le scénario. |
| `COUVERTURE-CCTP.md` | Tableau de couverture, fonction par fonction. |
| `js/ecrans/accueil.js`, `css/accueil.css`, `js/demo-accueil.js` | Page d'accueil publique (onglets, annonces qui défilent, connexion, actualités) et son écran d'administration. |
| `img/photos/` | Photos de La Réunion des annonces (licences libres CC BY-SA, crédits dans `img/photos/CREDITS.md`, affichés sur chaque annonce). |

## Mode hébergé : ce qui reste à faire

1. Créer le projet Supabase en région UE (environ 10 $ par mois en plus de l'offre Pro ; décision du 18/11/2026 : non créé, on reste en local).
2. Exécuter `supabase/schema.sql`, déployer `supabase/functions/gerer-compte`.
3. Créer les comptes et charger le jeu de données fictif (script à écrire).
4. Renseigner `config.js` (`mode: 'supabase'`, adresse et clé publique), déployer le site statique.
5. Rejouer le scénario sur ce mode et corriger ce qu'il révèle.

## Bibliothèques embarquées

supabase-js (client), pdf.js 3.11 (lecture des PDF), pdfmake (export PDF), docx (export Word), SheetJS (tableurs), JSZip (archives). Toutes sous licence libre ; versions dans `package-lock.json`.

## Ajouts du 18 novembre 2026 (chantier mémoire CINOR, gratuit et local)

| Fichier | Contenu |
|---|---|
| `js/totp.js`, `js/ecrans/securite.js` | Double authentification TOTP, déconnexion après inactivité, verrouillage après échecs, journal de sécurité, paramètres de sécurité. |
| `js/ecrans/complements.js` | Centre de notifications, circuit du DCE paramétrable, critères d'évaluation paramétrables, synthèse par candidat sans IA, révision des prix par formule. |
| `js/ecrans/support.js` | Demandes d'assistance : numéro, criticité P1 à P4, délais du CCTP en heures ouvrées, historique, clôture validée par la collectivité. |
| `docs/` | Guides utilisateur et administrateur, formats d'échange, sauvegarde et reprise, mesures environnementales. |
| `tests/mesures.mjs`, `mesures/` | Mesures de sobriété (poids, requêtes, mémoire), avant et après le chargement des bibliothèques à la demande. |

Compte de démonstration ajouté : `support@demo.example` (profil « Support éditeur »). L'administrateur doit activer la double authentification à sa première connexion.
