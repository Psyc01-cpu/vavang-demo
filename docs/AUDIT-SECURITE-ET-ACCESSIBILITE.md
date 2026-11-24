# vavang — audit de sécurité et d'accessibilité

État au 19 novembre 2026, sur la démonstration locale et sur la **démo publique en ligne** (https://psyc01-cpu.github.io/vavang-demo/, GitHub Pages, base Supabase). Ce document distingue ce qui a été **mesuré** de ce qui **reste à faire**.

## 1. Dépendances (npm audit)

| | Avant | Après |
|---|---|---|
| Vulnérabilités signalées | 4 (1 critique, 3 élevées) | 3 (1 critique, 2 élevées) |

Corrections apportées :
- **SheetJS** (lecture et écriture des tableurs) : passage de la version 0.18.5, vulnérable (pollution de prototype, déni de service par expression régulière), à la **version 0.20.3**, diffusée par l'éditeur et corrigée.
- **pdf.js** (lecture des PDF) : la faille CVE-2024-4367 permet l'exécution de code par une police piégée dans un PDF. Elle est neutralisée par l'option `isEvalSupported: false`, qui est le contournement officiel, appliqué à toutes les ouvertures de PDF : extraction du texte et visionneuse.

Reste signalé, avec l'analyse :
- **pdfjs-dist** : l'alerte porte sur la version installée. La faille est neutralisée par l'option ci-dessus. Le passage à la version 4 (modules ES) est à planifier.
- **tar** et **@mapbox/node-pre-gyp** : dépendances de développement facultatives de pdfjs-dist, qui servent au rendu côté serveur. Elles ne sont **jamais livrées au navigateur** : aucun impact sur l'application.

## 2. Mesures de sécurité ajoutées

- **Mots de passe en mode local** : plus aucun mot de passe en clair. Empreinte PBKDF2-SHA-256, sel aléatoire par compte, 120 000 itérations. Les comptes déjà créés sont convertis au démarrage. En mode hébergé, les mots de passe relèvent de l'authentification Supabase (bcrypt).
- **Fonction serveur** `gerer-compte` : client Supabase en version figée (2.119.0), chargé depuis le registre npm, et non plus depuis un service tiers de distribution.
- **Report de la double authentification** : possible uniquement en démonstration locale explicite (paramètre `reportMfaDemoLocale` et adresse locale 127.0.0.1). Impossible en ligne.
- **Rappel des mesures existantes** : double authentification TOTP obligatoire pour les administrateurs, verrouillage après 5 échecs, déconnexion après 15 minutes d'inactivité, journal de sécurité non modifiable, habilitations par profil, par service, par dossier et par lot.

## 3. Contrôle de la version en ligne

**Scan OWASP ZAP non réalisé, remplacé par un contrôle passif.** ZAP n'est pas installé et Docker est absent du poste (`docker --version` : commande introuvable). Le contrôle passif maison `node tests/scan-securite.mjs` (résultats : `mesures/scan-securite.json`) n'envoie aucune écriture à la base : lectures, appels de fonctions en lecture seule sous le rôle anonyme, et requêtes de méthodes HTTP vers le serveur de fichiers. Exécuté le 19/11/2026 : **17 points conformes, 3 à corriger, 3 faibles, 16 pour information, aucun critique**.

### 3.1 Transport (HTTPS)

| Contrôle | Résultat |
|---|---|
| http:// vers https:// | redirection 301 |
| TLS de la page et de l'API | TLS 1.3, certificats valides (page : jusqu'au 29/12/2026, API : jusqu'au 22/01/2027, renouvelés automatiquement par les hébergeurs) |
| HSTS | page : `max-age=31556952` ; API : `max-age=31536000; includeSubDomains; preload` |
| Contenu mixte | aucune ressource chargée en http:// ; la CSP n'autorise que le site et le serveur Supabase (https et wss) |

### 3.2 En-têtes et code servi

- **CSP** : présente en balise `meta` : `script-src 'self'` (aucun script en ligne), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Point faible : `style-src 'unsafe-inline'` (attributs de style posés par l'interface).
- **À corriger, mais impossible sur GitHub Pages**, qui ne permet pas d'ajouter d'en-têtes : `X-Content-Type-Options`, `X-Frame-Options` (ou `frame-ancestors`, sans effet en balise meta) absents. La page peut donc être intégrée dans un cadre d'un site tiers (risque de détournement de clic). `Referrer-Policy` et `Permissions-Policy` absents (faible). Ces en-têtes seront posés par l'hébergement de production (proxy ou hébergeur qui les accepte).
- **Cookies** : aucun déposé par la page. L'API dépose seulement le cookie technique `__cf_bm` de son fournisseur réseau (Cloudflare) ; la session est portée par un jeton dans l'en-tête `Authorization`, pas par un cookie.
- **Secrets** : 39 fichiers texte servis (HTML, JS, CSS, dont les bibliothèques) analysés : **aucun** `service_role`, `sb_secret_`, clé privée, jeton JWT, clé AWS, GitHub, Stripe ou Google. Les seules valeurs sensibles en apparence sont **publiques par choix** : clé « publishable » Supabase, mot de passe des comptes de démonstration et clé TOTP de l'administrateur de démonstration.
- **Méthodes HTTP** sur la page : OPTIONS, PUT, DELETE et POST refusées (405). TRACE non testée (refusée par le client Node).
- **Fichiers** : `.git/config`, `.env` et `node_modules/` introuvables (404). `package.json`, `supabase/schema.sql` et les tests sont servis, mais le dépôt est public : aucun secret, contenu déjà visible sur GitHub.
- **Bibliothèques servies** (version lue dans le fichier, ou déduite quand le fichier est identique au paquet npm) : SheetJS 0.20.3, pdf.js 3.11.174 (faille CVE-2024-4367 neutralisée par `isEvalSupported: false`), JSZip 3.10.2, pdfmake 0.3.14, supabase-js 2.119.0, docx 9.15.4, qrcode-generator 1.4.4. Non confrontées à une base CVE en ligne.

### 3.3 Base de données : politiques d'accès (RLS) testées

**Sans connexion (rôle anonyme)**, mesuré par `tests/scan-securite.mjs` :
- **38 tables** interrogées : **aucune ligne** renvoyée, sauf les **annonces actives** de la page d'accueil (24), publiques par conception (politique `accueil_public`). Aucune annonce inactive n'est visible.
- Fonctions `moi`, `mon_profil`, `etat_securite_comptes` : **refusées (401)**.
- Schéma de l'API (OpenAPI) : non lisible (401). Stockage : aucun compartiment listable.
- **Inscription libre désactivée** : seul l'administrateur crée des comptes.
- CORS : l'API répond à toute origine (comportement standard de Supabase) ; la protection repose sur le jeton et les politiques RLS.

**Par profil connecté**, mesuré par `tests/_essai-en-ligne.mjs` (lecture seule, base réelle) :

| Profil | Droits | Consultations | Offres | Notes | Journal |
|---|---|---|---|---|---|
| Gestionnaire | 16 | 2 | 3 | 9 | 39 |
| Valideur | 10 | 2 | 3 | 9 | 45 |
| Prescripteur | 6 | 1 | 3 | 9 | 0 |
| Lecteur / auditeur | 2 | 1 | 3 | 9 | 40 |
| Support éditeur | 2 | 0 | 0 | 0 | 0 |

Le support ne voit aucune donnée métier ; le prescripteur ne lit pas le journal. L'administrateur sans code : **code de double authentification exigé**. Mauvais mot de passe : refusé. Un message de console « 400 » a été relevé pendant l'essai, origine non analysée.

**Non testé** : écritures par un profil non habilité ou sans connexion (volontairement, pour ne rien écrire en base), contournement par requêtes forgées, injections.

### 3.4 Tests non réalisés à ce jour

- **Scan dynamique actif (OWASP ZAP ou équivalent)** : non réalisé. À lancer depuis un poste équipé de Docker : `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://psyc01-cpu.github.io/vavang-demo/ -J rapport.json`.
- **Test d'intrusion par une entité indépendante** (CCTP 3.7.4) : non réalisé.

### 3.5 npm audit

- `npm audit --omit=dev` : **0 vulnérabilité**, mais ce résultat n'a pas de portée : toutes les bibliothèques sont des dépendances de développement, copiées dans `vendor/`. Ce sont les versions de la section 3.2 qui comptent.
- `npm audit` complet : 3 (1 critique, 2 élevées) : `tar`, `@mapbox/node-pre-gyp`, `pdfjs-dist`, analysées en section 1.

## 4. Accessibilité

**Audit automatique** : axe-core 4.10.2, règles WCAG 2.1 niveaux A et AA, sur 11 écrans (`node tests/accessibilite.mjs`, résultats dans `mesures/accessibilite.json`) :
- page d'accueil et article ;
- tableau de bord, consultations ;
- candidatures et offres, saisie des notes, synthèse et classement ;
- fiche d'un marché, demandes d'assistance, notifications, paramètres.

| | Premier passage | Après corrections |
|---|---|---|
| Écrans sans violation | 4 sur 11 | **11 sur 11** |
| Violations | contrastes insuffisants (badges verts, étapes), 20 champs de saisie de note sans libellé associé, zone de tableau défilante inaccessible au clavier | aucune |

Corrections apportées :
- vert des états foncé, pour atteindre un contraste de 4,5 pour 1 ;
- libellés reliés à leurs champs ;
- zones de tableau atteignables au clavier.

Autres points déjà en place :
- navigation au clavier et lien d'évitement « Aller au contenu » ;
- défilement des annonces avec pause, et désactivé si l'utilisateur a réduit les animations ;
- textes alternatifs sur les logos.

**Limite** : un outil automatique ne vérifie qu'une partie des critères RGAA, de l'ordre d'un tiers selon les référentiels.

**Auto-évaluation RGAA 4.1** (détail : `docs/AUTO-EVALUATION-RGAA.md`) : les 106 critères, sur 6 pages (accueil, connexion, tableau de bord, analyse des offres en saisie et en synthèse, paramètres), à partir d'axe-core, de vérifications par script (tabulation, focus, zoom 200 %, affichage à 320 px, espacement du texte, titres, modale) et de la lecture du code.

| Conformes | Non conformes | Non applicables | Non testés |
|---|---|---|---|
| 44 | 18 | 39 | 5 |

**Taux de conformité : 44 / 62 = 71,0 %** (65,7 % à 73,1 % selon le sort des 5 critères non testés). Principales non-conformités : titre de page identique sur tous les écrans, affichage à 320 px avec défilement horizontal, fenêtres modales et onglets sans gestion complète du clavier et d'ARIA, contraste des bordures de champ et du contour de focus (2,2 à 2,7:1 pour 3:1 exigé), tableaux sans titre associé, déconnexion après inactivité sans avertissement.

**Ce n'est pas un audit de conformité** : aucun test avec un lecteur d'écran réel (NVDA), validateur HTML non lancé, documents exportés non examinés. Un audit indépendant reste nécessaire avant toute déclaration d'accessibilité.
