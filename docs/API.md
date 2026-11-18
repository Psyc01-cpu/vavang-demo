# API — accès programmatique aux données

vavang n'a pas d'API maison : l'interface et les programmes tiers parlent au **même** serveur, l'API REST de **PostgREST** fournie par Supabase, et au service d'authentification **GoTrue** (Supabase Auth). Les droits ne sont pas vérifiés par l'interface mais **par la base** (règles RLS et déclencheurs de `supabase/schema.sql` et `supabase/schema_demo.sql`) : un programme qui appelle l'API directement a exactement les droits du compte avec lequel il s'est connecté, ni plus ni moins.

- Adresse de base (démo publique, données fictives) : `https://talremuridyehynsnfzv.supabase.co`
- API REST : `/rest/v1/<table>` et `/rest/v1/rpc/<fonction>`
- Authentification : `/auth/v1/...`
- Description OpenAPI : [`docs/openapi.json`](openapi.json) — **rédigée à la main** (voir § 6).

## 1. Authentification

Chaque requête porte l'en-tête `apikey` avec la **clé publishable** du projet. Elle est publique par nature (elle figure dans `config.js`) et ne donne que les droits « anonyme ».

```
apikey: sb_publishable_ATRXpDWTix3eGwKSKTBhHw_PkvFfC5W
```

| Appelant | En-têtes | Ce qu'il voit |
|---|---|---|
| Anonyme | `apikey` seul | Annonces actives de la page d'accueil, ligne `identite` des paramètres. Toute autre table renvoie une **liste vide** (pas une erreur). |
| Utilisateur connecté | `apikey` + `Authorization: Bearer <access_token>` | Ce que son profil, son service et ses affectations lui permettent (mêmes règles que dans l'interface). |

**Connexion** : `POST /auth/v1/token?grant_type=password` avec l'adresse et le mot de passe. La réponse contient :

- `access_token` : jeton **JWT** valable **900 secondes (15 minutes)** (`expires_in: 900`, mesuré le 19/11/2026) ;
- `refresh_token` : à échanger contre un nouveau couple par `POST /auth/v1/token?grant_type=refresh_token` (essayé : 200, nouveau jeton de 900 s et nouveau refresh token ; l'ancien refresh token est alors consommé) ;
- `user` : identité du compte.

**Double authentification** : pour les profils qui l'exigent (administrateur), le jeton obtenu par mot de passe est de niveau `aal1` ; la base refuse alors tout accès aux données (`moi()` renvoie null) tant que le code TOTP n'a pas été vérifié par `POST /auth/v1/factors/<id>/challenge` puis `POST /auth/v1/factors/<id>/verify`, qui renvoie un jeton `aal2`. Cette séquence est celle utilisée par l'interface (`js/donnees.js`, via la bibliothèque supabase-js) ; elle **n'a pas été rejouée en curl** (non vérifié en curl).

**Déconnexion** : `POST /auth/v1/logout?scope=local` avec le jeton (essayé : 204). Une session révoquée par l'administrateur (`revoquer_sessions`) rend aussitôt le jeton inutilisable côté données, même avant son expiration, car `moi()` vérifie l'existence de la session.

## 2. Droits appliqués par la base (RLS)

- **Lecture** : chaque table a une règle `lecture` ; un dossier n'est visible que si le profil a le droit « toutes les consultations », ou le droit « consultations du service » et le même service, ou s'il a créé le dossier, ou s'il y est affecté (`voit_dossier`). Les tables rattachées à un dossier (lots, offres, notes, pièces…) suivent le dossier par `d->>consultation_id`.
- **Écriture** : règle `modification` = droit d'écriture du profil sur la table (`droit_ecriture`) **et** visibilité du dossier. Une modification non autorisée **ne lève pas d'erreur** : elle touche 0 ligne (voir § 3.4).
- **Règles métier** (déclencheur `garde`) : grille verrouillée, validation par un autre agent habilité, historiques et journal non modifiables… Un refus renvoie une erreur dont le message commence par `REGLE:`.
- **Fonctions (RPC)** : réservées aux utilisateurs connectés, sauf `signaler_echec_connexion` (ouverte à l'anonyme). Les fonctions d'administration vérifient en plus le profil administrateur.

## 3. Exemples curl — exécutés réellement le 19/11/2026

Variables (shell bash) :

```bash
U=https://talremuridyehynsnfzv.supabase.co
K=sb_publishable_ATRXpDWTix3eGwKSKTBhHw_PkvFfC5W
```

### 3.1 Connexion (compte de démonstration « gestionnaire »)

```bash
curl -s -X POST "$U/auth/v1/token?grant_type=password" \
  -H "apikey: $K" -H "Content-Type: application/json" \
  -d '{"email":"gestionnaire@demo.example","password":"Demonstration-2026"}'
```

Résultat (tronqué ; jetons remplacés par `…`) :

```json
{"access_token":"eyJhbGciOi…","token_type":"bearer","expires_in":900,"expires_at":1795040165,
 "refresh_token":"…","user":{"id":"00000000-0000-4000-a000-000000000002","email":"gestionnaire@demo.example", …}, …}
```

Contenu décodé du jeton (extrait) : `"aud":"authenticated"`, `"role":"authenticated"`, `"aal":"aal1"`, `"session_id":"…"`, `exp − iat = 900`.

```bash
T=<access_token reçu>
```

### 3.2 Lecture des consultations

```bash
curl -s "$U/rest/v1/consultations?select=id,objet:d->>objet,statut:d->>statut&order=id&limit=3" \
  -H "apikey: $K" -H "Authorization: Bearer $T"
```

Résultat :

```json
[{"id":"c1","objet":"Entretien des espaces verts des sites communautaires","statut":"analyse"},
 {"id":"c2","objet":"Renouvellement de postes informatiques","statut":"preparation"}]
```

Avec `-H "Prefer: count=exact"`, l'en-tête de réponse donne le total : `Content-Range: 0-1/2` (HTTP 200, 0,41 s).

La même requête **sans** jeton (anonyme) renvoie `[]` (HTTP 200) : la règle RLS masque les dossiers.

### 3.3 Appel d'une fonction (RPC)

```bash
curl -s -X POST "$U/rest/v1/rpc/mon_profil" \
  -H "apikey: $K" -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{}'
```

Résultat (HTTP 200, profil fictif de démonstration) :

```json
{"id":"00000000-0000-4000-a000-000000000002","aal":"aal1","nom":"Camille Morel","role":"gestionnaire","actif":true,
 "email":"gestionnaire@demo.example","service":"Direction de la commande publique","mfa_requis":false}
```

### 3.4 Écriture refusée par la base (compte « lecteur »)

```bash
curl -s -X PATCH "$U/rest/v1/consultations?id=eq.c1" \
  -H "apikey: $K" -H "Authorization: Bearer $L" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" -d '{"modifie_le":"2026-11-19T00:00:00Z"}'
```

Résultat : `[]`, HTTP 200 — aucune ligne modifiée. **Pour un programme, il faut donc contrôler le nombre de lignes renvoyées** (`Prefer: return=representation`) et non seulement le code HTTP.

### 3.5 Filtres utiles (syntaxe PostgREST, non rejoués un par un)

- Offres d'un dossier : `GET /rest/v1/offres?d->>consultation_id=eq.c1`
- Journal récent : `GET /rest/v1/journal?order=cree_le.desc&limit=50`
- Pagination : `limit` et `offset`, ou en-tête `Range: 0-49`.

## 4. Formats

Toutes les tables ont la même forme : `id` (texte), `d` (document JSON des données métier, au même format que l'export du mode local, voir `docs/FORMATS-ECHANGE.md`), `cree_le`, `cree_par`, `modifie_le`. On extrait un champ par `d->>champ` (texte) ou `d->champ` (JSON), et on le renomme par `alias:d->>champ`.

## 5. Limites

| Point | État |
|---|---|
| Jetons d'API **longue durée** pour un logiciel tiers (compte de service, clé par application, révocable) | **Partiel** : pas de jeton longue durée. Un programme se connecte avec un compte utilisateur dédié et renouvelle son jeton toutes les 15 minutes par le refresh token. La clé « secret » du projet donnerait un accès complet sans RLS : elle ne doit **jamais** être remise à un tiers. |
| Description OpenAPI automatique | **Non disponible avec la clé publique** : `GET /rest/v1/` avec `Accept: application/openapi+json` répond 401 `{"message":"Secret API key required"}` (essayé avec la clé publishable seule, avec `Authorization: Bearer` de la clé, et avec un jeton utilisateur). `docs/openapi.json` est donc rédigé à la main d'après le schéma. |
| Limitation de débit, quotas | Ceux de Supabase gratuit (non mesurés ici). |
| Webhooks / notifications sortantes vers un tiers | Non fournis. |
| Versionnement de l'API | Aucun : l'API suit le schéma de la base ; un changement de schéma peut casser un client. |
| Double authentification en curl | Séquence décrite au § 1, non rejouée en curl. |

## 6. docs/openapi.json

Fichier OpenAPI 3.0.3 : 37 tables (lecture, création, modification, suppression) et 14 fonctions RPC, avec les schémas de sécurité `apikey` et `Bearer`. Il a été **rédigé à la main** (généré par un petit script à partir de la liste des tables et des fonctions du schéma) parce que la description automatique est refusée avec la clé publique. Les règles réelles restent celles de la base ; seules les requêtes du § 3 ont été vérifiées.
