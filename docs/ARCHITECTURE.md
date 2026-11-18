# vavang — documentation d’architecture

Version du prototype du 19 novembre 2026. Éditeur : l’entreprise.ai, Saint-Paul, La Réunion.

## 0. À lire d’abord : vérifié ou seulement écrit

| Partie | État | Preuve |
|---|---|---|
| Application dans le navigateur, **mode local** (données dans IndexedDB) | **Vérifiée** | Scénario automatique `tests/scenario.mjs` : 95 vérifications réussies, 57 captures, aucune erreur JavaScript (`captures/resultat-du-scenario.txt`). Règles de calcul : `npm test`. |
| **Mode hébergé** (Supabase : Postgres, authentification, stockage) | **Écrit, jamais exécuté** | `supabase/schema.sql` et `supabase/functions/gerer-compte/index.ts`. Aucun projet créé, aucun déploiement. |

Tout ce qui est dit du mode hébergé décrit donc un **dispositif prévu**. Rien n’y a été testé.

## 1. Vue d’ensemble

```
                    POSTE DE L’AGENT (Edge, Chrome, Firefox)
  ┌──────────────────────────────────────────────────────────────────┐
  │  index.html + css/ + js/   (aucune étape de construction)        │
  │                                                                  │
  │  écrans (js/ecrans/*)  ──►  noyau d’interface (js/noyau.js)       │
  │          │                                                       │
  │          ▼                                                       │
  │  accès aux données, habilitations, journal (js/donnees.js)        │
  │          │                         │                             │
  │  calculs purs (js/calcul.js)   documents (js/documents.js)        │
  │  double auth. (js/totp.js)     └─► vendor/ chargé à la demande   │
  │          │                                                       │
  └──────────┼───────────────────────────────────────────────────────┘
             │ config.js : mode
     ┌───────┴────────────────────┐
     ▼                            ▼
  MODE « local »              MODE « supabase »  (écrit, non déployé)
  IndexedDB du navigateur     HTTPS ──► Supabase, région UE (Irlande)
  - magasin « lignes »          - Postgres : une table par objet, colonne JSON « d »
  - magasin « fichiers »        - règles d’accès par ligne + déclencheur « garde »
  un seul poste                 - authentification Supabase
  VÉRIFIÉ                       - stockage privé « pieces »
                                - fonction serveur « gerer-compte »
```

Aucun serveur applicatif permanent. Le site est statique. En mode hébergé, la seule logique côté serveur est dans la base (règles et déclencheurs) et dans une fonction serveur.

## 2. Composants

### 2.1 Front statique

- `index.html` charge `config.js`, puis les scripts de `js/` dans un ordre fixe. Pas de cadriciel, pas de compilation.
- `css/app.css` (application) et `css/accueil.css` (page d’accueil).
- `img/` : logos vavang, logo de la collectivité (marque blanche), photos de la page d’accueil.
- `config.js` : mode de données (`local` ou `supabase`), adresse et clé publique Supabase, nom du logiciel, collectivité affichée, coordonnées du support.

### 2.2 Modules `js/`

| Fichier | Rôle |
|---|---|
| `calcul.js` | Fonctions pures : arrondis, formules de prix, notes et classement, signalement des prix bas, seuils et computation, échéances, révision des prix, heures ouvrées, délais du support. Utilisé aussi par les tests Node. |
| `totp.js` | Double authentification TOTP (RFC 6238), calculée avec l’API cryptographique du navigateur. |
| `donnees.js` | Accès aux données dans les deux modes, avec la même interface. Habilitations, règles métier, journal, comptes et sécurité des accès. |
| `noyau.js` | Interface : création d’éléments, navigation, formulaires, tableaux, fenêtres, messages. |
| `documents.js` | Lecture du texte des pièces, lecture des tableurs, exports PDF, Word, tableur et archive. |
| `demo.js`, `demo-accueil.js`, `demo-articles.js` | Jeu de données fictif, contenu fictif de la page d’accueil et articles des rubriques. |

### 2.3 Écrans `js/ecrans/`

| Fichier | Domaine |
|---|---|
| `base.js` | Connexion, menu, tableau de bord, journal. |
| `accueil.js` | Page d’accueil publique et son administration. |
| `securite.js` | Double authentification, inactivité, verrouillage, journal de sécurité. |
| `administration.js` | Utilisateurs, habilitations par profil, paramètres. |
| `besoins.js` | Recensement, computation des seuils, aide au choix de la procédure. |
| `consultations.js` | Consultations, lots, habilitations par dossier, pièces attendues. |
| `dce.js` | Documents du DCE, modèles, versions, circuit de validation. |
| `offres.js` | Dépôt des plis, pièces, complétude, lecture, recherche, demandes aux candidats. |
| `analyse.js` | Grille, notation, contrôle des prix, synthèse et classement. |
| `rapport.js` | Rapport d’analyse, courriers types, dossier d’audit. |
| `execution.js` | Marchés, ordres de service, bons de commande, avenants, reconductions, révisions. |
| `fournisseurs.js` | Fiches fournisseurs, évaluations des titulaires. |
| `complements.js` | Notifications, circuit du DCE et critères d’évaluation paramétrables, synthèse par candidat sans IA, révision des prix. |
| `reprise.js` | Reprise de l’existant, export complet, restauration. |
| `support.js` | Demandes d’assistance (voir `PROCEDURE-SUPPORT.md`). |

### 2.4 Bibliothèques embarquées (`vendor/`)

Toutes sont servies avec l’application. Aucune n’est appelée depuis un site tiers. Versions lues dans `package-lock.json`.

| Bibliothèque | Version | Licence | Fichier(s) | Usage | Chargement |
|---|---|---|---|---|---|
| supabase-js | 2.119.0 | MIT | `supabase.js` | Client du mode hébergé | Seulement en mode `supabase` |
| pdf.js (pdfjs-dist) | 3.11.174 | Apache 2.0 | `pdf.min.js`, `pdf.worker.min.js` | Lecture du texte des PDF | À la lecture d’une pièce |
| pdfmake | 0.3.14 | MIT | `pdfmake.min.js`, `vfs_fonts.js` (polices Roboto, Apache 2.0) | Export PDF | À l’export |
| docx | 9.15.4 | MIT | `docx.js` | Export Word | À l’export |
| SheetJS (xlsx) | 0.18.5 | Apache 2.0 | `xlsx.full.min.js` | Lecture et export de tableurs | À l’import ou à l’export |
| JSZip | 3.10.2 | MIT ou GPL 3.0 (au choix) | `jszip.min.js` | Archives, lecture DOCX et ODT | À l’export ou à la lecture |
| qrcode-generator | 1.4.4 | MIT | `qrcode.js` | Code QR d’activation de la double authentification | À l’activation |

Outil de test seulement, non livré : puppeteer-core 25.18.1 (Apache 2.0), qui pilote Chrome pour le scénario.

### 2.5 Chargement à la demande

`D.chargerScript` ajoute un script au moment où il sert, une seule fois. `Docs.charger('pdfjs' | 'xlsx' | 'docx' | 'pdfmake' | 'jszip')` regroupe les bibliothèques lourdes. Effet mesuré : de 4,5 Mo à 0,43 Mo transférés par écran, et de 26,5 Mo à 2,8 Mo de mémoire JavaScript (`MESURES-ENVIRONNEMENT.md`).

## 3. Modèle de données

### 3.1 Principe

Une table par objet métier. Chaque ligne porte un identifiant et un document JSON. Le même document circule dans les trois formes :

- **mode local** : objet stocké dans le magasin IndexedDB `lignes`, avec la clé `<table>|<id>` ; fichiers dans le magasin `fichiers` ;
- **mode hébergé** : colonnes `id` (texte), `d` (jsonb, les données métier), `cree_le`, `cree_par`, `modifie_le` ;
- **export complet** : `donnees/<table>.json` et `.csv` (voir `FORMATS-ECHANGE.md`).

Ce choix garde un seul format de données pour l’écran, la base et la réversibilité. En contrepartie, les contrôles de structure sont faits par l’application et par les déclencheurs, pas par des colonnes typées.

### 3.2 Tables (d’après `D.TABLES` dans `js/donnees.js`)

| Domaine | Tables |
|---|---|
| Comptes et administration | `profils`, `habilitations`, `parametres`, `journal` |
| Besoins et consultations | `besoins`, `consultations`, `affectations` (habilitations par dossier, éventuellement par lot), `lots`, `pieces_attendues` |
| Grilles | `grilles`, `criteres`, `grille_versions`, `modeles_grille` |
| Offres et analyse | `offres`, `pieces`, `annotations`, `lignes_prix`, `notes`, `notes_historique`, `demandes`, `analyses` |
| Rapports et DCE | `rapports`, `modeles_document`, `documents_dce`, `documents_versions`, `validations` |
| Exécution et fournisseurs | `marches`, `evenements`, `fournisseurs`, `fournisseur_suivi`, `evaluations` |
| Divers | `reprises`, `annonces`, `notifications`, `tickets` |

35 tables au total. En mode local s’ajoute `comptes_locaux` (adresse, mot de passe, secret TOTP, état de verrouillage), qui n’est jamais exportée. En mode hébergé s’ajoute `trace_technique`, alimentée par déclencheur.

Index prévus côté Postgres : `d->>'consultation_id'` sur chaque table, `notes.d->>'lot_id'`, `pieces.d->>'offre_id'`, `journal.cree_le`.

### 3.3 Fichiers

- Mode local : magasin IndexedDB `fichiers`.
- Mode hébergé : compartiment de stockage privé `pieces`, avec un dossier par consultation.

## 4. Sécurité

### 4.1 Habilitations

Trois niveaux, cumulés :

1. **Profil** : 6 profils (administrateur, gestionnaire, prescripteur, valideur, lecteur, support éditeur). Chacun reçoit des droits parmi 27 actions (`D.DROITS`). La matrice se modifie à l’écran.
2. **Dossier** : sans le droit `consultations.toutes`, un agent ne voit que les consultations qu’il a créées ou auxquelles il est affecté (table `affectations`, fonction analyste, valideur ou lecteur).
3. **Lot** : une affectation peut viser un seul lot. L’agent ne voit et ne note alors que ce lot.

Règles métier vérifiées par `donnees.js` dans les deux modes : grille verrouillée avant notation, nul ne valide sa propre note, note validée non modifiable, décisions motivées, historiques et journal en ajout seul.

### 4.2 Règles imposées par le serveur (mode hébergé, écrites, non exécutées)

Dans `supabase/schema.sql` :

- **Règles d’accès par ligne** activées sur toutes les tables. Lecture : `voit_dossier(consultation_id)`. Écriture : `droit_ecriture(table)` et `voit_dossier`.
- Fonctions `moi()`, `a_droit(droit)`, `voit_dossier(cid)`, `droit_ecriture(table)`, en `security definer`.
- Règles particulières : notifications lues par leur seul destinataire ; demandes d’assistance lues par le demandeur, le support et l’administrateur ; journal lu avec le droit `journal.lire` et jamais écrit directement (fonction `journaliser`) ; annonces actives lisibles avant connexion.
- **Déclencheur `garde`** sur chaque table : trace technique de chaque écriture, puis refus de ce qui viole une règle (historiques non modifiables, grille verrouillée, validation par un autre agent habilité, justification obligatoire, rapport et évaluation figés après validation, circuit du DCE paramétré, interdiction de modifier son propre profil).
- **Stockage** : compartiment privé ; lecture si l’agent voit le dossier ; suppression réservée à l’administrateur.
- **Fonction serveur `gerer-compte`** : création de compte et changement de mot de passe, après contrôle du droit `admin.utilisateurs` ; mot de passe de 12 caractères au moins.

Limites connues du schéma :
- L’habilitation **limitée à un lot** n’y est pas reprise : la règle travaille au niveau du dossier. Elle n’est appliquée que par l’application.
- La **double authentification** en hébergement reposerait sur celle de Supabase (niveau `aal2` exigé pour les administrateurs). **Non écrit.**
- La fonction `gerer-compte` importe son client depuis `esm.sh` : à figer ou à embarquer avant tout déploiement.

### 4.3 Double authentification (TOTP)

- Secret de 20 octets, code QR et clé texte, confirmation par un premier code à 6 chiffres.
- Compatible avec les applications d’authentification courantes. Calcul local, sans service extérieur.
- Obligatoire pour les administrateurs (paramètre activé par défaut), proposée aux autres profils.
- Réinitialisation par l’administrateur, tracée.
- Verrouillage après 5 échecs pendant 15 minutes, déconnexion après 15 minutes d’inactivité (valeurs paramétrables).

Vérifié en mode local par le scénario : code faux refusé, verrouillage, déverrouillage, déconnexion pour inactivité.

### 4.4 Journal

- Chaque création, modification ou suppression passe par `donnees.js`, qui écrit au journal : date, auteur, profil, action, objet, résultat, origine (navigateur).
- Vue « journal de sécurité » : connexions, échecs, verrouillages, double authentification, comptes, habilitations, paramètres, restaurations.
- En ajout seul. Export CSV.
- Limite en mode local : l’heure est celle du poste, l’adresse IP n’est pas relevée.

## 5. Les deux modes

| | Mode local | Mode hébergé |
|---|---|---|
| Réglage | `config.js` : `mode: 'local'` | `mode: 'supabase'`, adresse et clé publique |
| Données | IndexedDB du navigateur, un seul poste | Postgres Supabase, région UE (Irlande) |
| Fichiers | IndexedDB | Stockage privé `pieces` |
| Comptes | `comptes_locaux` dans le navigateur | Authentification Supabase |
| Règles | Appliquées par l’application | Appliquées par l’application **et** par la base |
| Usage | Démonstration, développement, tests | Cible d’exploitation |
| État | **Vérifié** | **Écrit, non déployé** |

Le mode local n’est pas un mode d’exploitation : un utilisateur qui maîtrise son navigateur peut lire ou modifier ses propres données locales, et les mots de passe de démonstration y sont stockés en clair.

Étapes restantes pour le mode hébergé : voir `README.md`, section « Mode hébergé : ce qui reste à faire ».

## 6. Flux

### 6.1 Ouverture

1. Le navigateur charge le site statique.
2. `D.init()` ouvre IndexedDB (local) ou crée le client Supabase (hébergé), puis recharge la session.
3. Le profil, ses droits et ses affectations sont chargés. Le menu n’affiche que ce que le profil permet.

### 6.2 Écriture d’une donnée

```
écran ──► D.creer / D.modifier / D.supprimer
             │ 1. contrôle du droit (D.exiger) et des règles métier
             │ 2. écriture : IndexedDB  |  Postgres (règles d’accès + déclencheur « garde »)
             └ 3. D.journal(...)        |  fonction journaliser()
```

### 6.3 Dépôt et lecture d’une pièce

Fichier choisi par l’agent → stocké tel quel → texte extrait dans le navigateur (pdf.js, JSZip, SheetJS) → texte conservé page par page pour la recherche. Pas de reconnaissance de caractères.

### 6.4 Exports

Produits dans le navigateur (pdfmake, docx, SheetJS, JSZip). Aucun aller-retour vers un serveur.

### 6.5 Sauvegarde et restauration

Export complet ZIP → contrôle de l’archive par rapport à son inventaire → remplacement de toutes les données. Voir `SAUVEGARDE-ET-REPRISE.md`.

### 6.6 Échanges avec l’extérieur

Aucun en mode local. En mode hébergé : uniquement le navigateur vers Supabase, en HTTPS. Pas de courriel, pas d’API publique, pas d’IA, pas de mesure d’audience.

## 7. Vérification

- `npm test` : 13 groupes de tests sur `calcul.js`.
- `npm run scenario` : scénario complet dans Chrome sans interface, six profils, captures et exports.
- `node tests/mesures.mjs` : poids, requêtes, mémoire.

Ces trois vérifications portent sur le **mode local** uniquement.
