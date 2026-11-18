# vavang — mesures de sobriété numérique

Mesures prises le 18 novembre 2026 avec Chrome sans interface (`node tests/mesures.mjs`), cache désactivé, sur un serveur local **sans compression**. Les poids sont donc des majorants : un hébergement qui compresse les fichiers (gzip ou brotli) transférerait nettement moins. Les résultats bruts sont dans `mesures/avant.json` et `mesures/apres.json`.

## 1. Avant / après le chargement à la demande des bibliothèques

Jusqu'ici, chaque ouverture d'écran chargeait toutes les bibliothèques d'export et de lecture (PDF, Word, tableur, archives), même quand elles ne servaient pas. Elles ne sont plus chargées qu'au moment de l'export, de l'import ou de la lecture d'une pièce.

| Écran (chargement à froid) | Requêtes avant | Poids avant | Requêtes après | Poids après | Mémoire JavaScript avant | Mémoire JavaScript après |
|---|---|---|---|---|---|---|
| Page d'accueil (avec une photo) | 34 | 4 672 Ko | 31 | 566 Ko | 26,5 Mo | 2,7 Mo |
| Tableau de bord | 32 | 4 534 Ko | 29 | 429 Ko | 26,5 Mo | 2,8 Mo |
| Analyse d'une consultation | 32 | 4 534 Ko | 29 | 429 Ko | 26,6 Mo | 3,0 Mo |
| Fiche d'une offre | 32 | 4 534 Ko | 29 | 429 Ko | 26,5 Mo | 2,8 Mo |

**Gain : environ −90 % de données transférées par écran, et −89 % de mémoire JavaScript.**

## 2. Éléments vérifiables

- **Pas de cadriciel ni d'étape de construction** : HTML, CSS et JavaScript directement servis. Code applicatif : 22 fichiers JavaScript et 2 feuilles de style, environ 440 Ko non compressés, chargés à chaque ouverture.
- **Aucune ressource tierce** : ni police web, ni outil de mesure d'audience, ni publicité, ni appel à un service extérieur. Toutes les bibliothèques sont hébergées avec l'application (`vendor/`), sous licence libre.
- **Aucun cookie de mesure d'audience** ; la session est conservée dans le stockage du navigateur.
- **Pas de serveur applicatif permanent** : site statique, et une base de données mutualisée en mode hébergé.
- **Photos** : 4 photos de 140 à 560 Ko, une seule chargée à l'ouverture de la page d'accueil. Les autres ne servent qu'à l'affichage de leur annonce.
- **Aucune intelligence artificielle** : aucun calcul sur processeur graphique, aucun appel à un modèle distant.
- **Documents générés dans le navigateur** (PDF, Word, tableur) : aucun aller-retour vers un serveur pour produire un export.
- **Bibliothèques à la demande** : pdf.js (lecture des PDF, 1,4 Mo), pdfmake (export PDF, 1,7 Mo avec les polices), docx (export Word, 1,0 Mo), SheetJS (tableurs, 0,9 Mo), JSZip (archives, 0,1 Mo), code QR (0,06 Mo, uniquement à l'activation de la double authentification), client Supabase (0,2 Mo, uniquement en mode hébergé).

## 3. Pistes non réalisées

- Regrouper et minifier les 23 scripts de l'application (dont la configuration) : moins de requêtes, et un poids réduit d'environ la moitié.
- Servir les photos en WebP ou AVIF, en deux tailles (ordinateur et téléphone).
- Mesurer la consommation côté hébergement : impossible tant que le service n'est pas hébergé.
