# vavang — formats d'import et d'export

Ces formats servent aux échanges par fichiers avec le système d'information de la collectivité. En mode hébergé, une interface de programmation (API REST) est aussi disponible et documentée à part (`API.md`, `openapi.json`).

## 1. Imports

### 1.1 Tableau de marchés (XLSX, XLS, ODS ou CSV)

Première feuille non vide, première ligne = intitulés de colonnes. La correspondance des colonnes est proposée d'après les intitulés, puis modifiable à l'écran.

| Donnée | Obligatoire | Intitulés reconnus automatiquement | Format accepté |
|---|---|---|---|
| Numéro du marché | oui | num, n°, ref | texte |
| Objet | oui | objet, intitulé, libellé | texte |
| Titulaire | oui | titulaire, attributaire, fournisseur, entreprise | texte (la fiche fournisseur est créée si elle n'existe pas) |
| Montant notifié HT | non | montant, prix | nombre, virgule ou point décimal, espaces et « € » tolérés |
| Date de notification | non | notif | JJ/MM/AAAA ou AAAA-MM-JJ |
| Date de début | non | début, démarrage, effet | idem |
| Durée (mois) | non | durée | nombre |
| Service | non | service, direction | texte |

CSV : séparateur point-virgule, encodage UTF-8 (avec ou sans BOM).

### 1.2 Tableau de fournisseurs

Raison sociale (obligatoire), SIRET, adresse, commune, interlocuteur, courriel, téléphone, domaines.

### 1.3 Contrôles appliqués

Données obligatoires manquantes, nombres ou dates illisibles, doublons (même numéro de marché ou même raison sociale). Les lignes en anomalie ne sont pas reprises et figurent au rapport de contrôle.

### 1.4 Documents

PDF, DOCX, ODT, XLSX, XLS, ODS, CSV, TXT : le texte est extrait pour la recherche. Les autres formats sont conservés sans lecture. Un PDF scanné, sans couche texte, est conservé et signalé « texte non lisible » : il n'y a pas de reconnaissance de caractères.

### 1.5 Bordereau de prix d'une offre

Feuille contenant des colonnes « désignation », « quantité » et « prix unitaire » (et, si elle existe, « unité »). Les lignes sans quantité ou sans prix ne sont pas importées : elles sont signalées comme incomplètes, avec les autres contrôles du bordereau (montant de ligne différent de quantité × prix unitaire, ligne absente par rapport aux autres offres, quantité modifiée, total différent du montant déclaré). Ces signalements sont des alertes à vérifier par l'agent, jamais une décision.

## 2. Export complet (archive ZIP)

| Élément | Contenu |
|---|---|
| `donnees/<table>.json` | Une table par fichier, tableau d'objets JSON (UTF-8). |
| `donnees/<table>.csv` | La même table en CSV : séparateur point-virgule, UTF-8 avec BOM, objets imbriqués sérialisés en JSON. |
| `documents/<chemin>` | Fichiers sources déposés, non modifiés. Le chemin figure dans la colonne `chemin` de la table `pieces`. |
| `documents-texte/<id>.txt` | Texte extrait de chaque pièce, pages séparées par `----- page suivante -----`. |
| `inventaire.csv` | Nombre de lignes par table, et nombre de fichiers. Sert au contrôle d'exhaustivité et à la restauration. |
| `dictionnaire-des-donnees.csv` | Pour chaque table : colonnes, type constaté, exemple. |
| `LISEZMOI.txt` | Date de l'export, auteur, description du contenu. |

Tables : profils, habilitations, paramètres, journal, besoins, consultations, affectations, lots, grilles, critères, versions des grilles, modèles de grilles, pièces attendues, offres, pièces, annotations, lignes de prix, notes, historique des notes, demandes aux candidats, analyses, rapports, modèles de documents, documents du DCE, versions des documents, validations, marchés, événements d'exécution, fournisseurs, suivi des fournisseurs, évaluations, reprises, annonces, notifications, demandes d'assistance.

Les identifiants (`id` et colonnes `…_id`) relient les tables entre elles. Les dates sont au format ISO 8601 (heure en UTC pour les horodatages).

**Exclus de l'export** : les mots de passe et les secrets de double authentification. Ils relèvent de l'annuaire d'identités et ne doivent pas circuler dans une archive.

## 3. Exports ponctuels

| Écran | Format |
|---|---|
| Rapport d'analyse | PDF, Word (DOCX) |
| Tableau d'analyse et détail des calculs | XLSX |
| Synthèse par candidat | Word |
| Courriers types | Word, PDF |
| Documents du DCE | Word, PDF |
| Dossier d'audit | PDF, ou ZIP avec les pièces sources |
| Journal | CSV |
| Fournisseurs, évaluations | XLSX |
