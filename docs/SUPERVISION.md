# Supervision et page d'état

Supervision **à zéro euro, sans compte tiers** de la démonstration en ligne : une tâche planifiée GitHub Actions contrôle le service toutes les 15 minutes, conserve l'historique dans le dépôt, et une page publique (`statut.html`) en affiche la disponibilité.

## 1. Ce qui est contrôlé

| Contrôle | Requête | Réussi si |
|---|---|---|
| Page publique | `GET https://psyc01-cpu.github.io/vavang-demo/` | HTTP 200 |
| API de données | `GET https://talremuridyehynsnfzv.supabase.co/rest/v1/annonces?select=id&limit=1`, en-tête `apikey` (clé publishable) | HTTP 200 |
| Authentification | `GET https://talremuridyehynsnfzv.supabase.co/auth/v1/health`, en-tête `apikey` | HTTP 200 |

- Délai maximal par requête : 20 s. Un service en échec est recontrôlé **une fois après 10 s** ; seul un second échec compte (une micro-coupure réseau ne crée pas d'incident).
- Le temps de réponse (ms) est mesuré pour chaque requête, depuis les serveurs de GitHub (hors de La Réunion : il ne reflète pas exactement le temps vu par un agent sur place).
- Un contrôle est **disponible** si les trois services répondent 200.

## 2. Fonctionnement

Fichier : `.github/workflows/supervision.yml`.

1. Déclenchement : `cron: '*/15 * * * *'` (et lancement manuel possible : onglet *Actions* > *Supervision* > *Run workflow*).
2. Un script Node (inclus dans le fichier, sans dépendance) effectue les trois contrôles et ajoute une ligne à `statut/historique.json` ; les lignes de plus de 30 jours sont supprimées.
3. Le fichier est commité dans le dépôt avec le `GITHUB_TOKEN` fourni par GitHub (`permissions: contents: write`) : **aucun secret à créer**.
4. Si un service est indisponible, la ligne est d'abord enregistrée, puis l'Action **échoue** : GitHub envoie un courriel au propriétaire du dépôt.

Format d'une ligne (une par contrôle, environ 2 900 lignes et 450 Ko pour 30 jours) :

```json
{"t":"2026-11-18T22:02:30.908Z","ok":true,"page":{"code":200,"ms":999,"ok":true},"rest":{"code":200,"ms":735,"ok":true},"auth":{"code":200,"ms":298,"ok":true}}
```

En cas d'erreur réseau : `"code":0` et `"erreur":"délai dépassé (20 s)"` (ou le message reçu) ; `"reessai":true` signale un service rétabli au second essai.

**Effet secondaire utile** : l'appel régulier à l'API Supabase évite la mise en pause du projet gratuit pour inactivité (Supabase met en pause un projet gratuit sans activité pendant 7 jours ; le seuil exact et le fait qu'une simple lecture REST suffise sont **non vérifiés** ici — à confirmer après une semaine de fonctionnement).

## 3. Page d'état

`statut.html` + `js/statut.js` : page autonome (aucune bibliothèque, mêmes couleurs et titres serif que l'application), publiée à l'adresse `https://psyc01-cpu.github.io/vavang-demo/statut.html` après envoi du dépôt. Elle lit `statut/historique.json` (rechargé toutes les 5 minutes) et affiche :

- l'état au dernier contrôle, sa date et son ancienneté ; une alerte si aucun contrôle depuis plus d'une heure (supervision elle-même en retard ou désactivée) ;
- la disponibilité sur **24 h, 7 jours, 30 jours** (contrôles réussis ÷ contrôles effectués) ;
- une barre par jour sur 30 jours ;
- par service : dernier état, disponibilité 24 h / 7 j / 30 j, temps de réponse moyen 24 h et 7 j ;
- la liste des **incidents** (contrôles en échec consécutifs regroupés), avec début, fin, durée observée, services touchés et codes d'erreur.

## 4. Vérifications effectuées le 19/11/2026

| Vérification | Résultat |
|---|---|
| Les trois requêtes depuis ce poste (Node) | page 200 (≈ 0,7 à 1,0 s), REST 200 (≈ 0,3 à 0,7 s), Auth 200 (≈ 0,25 à 0,3 s) |
| Script de contrôle extrait du fichier YAML et exécuté localement, 2 passages réels | 2 lignes `ok:true` écrites, JSON valide |
| Même script avec une page inexistante et une clé invalide | ligne `ok:false` (page 404, REST 401, Auth 401), sortie `ok=false` |
| Fichier YAML relu par un analyseur YAML | déclencheurs `schedule` + `workflow_dispatch`, 4 étapes |
| `statut.html` dans Chrome sans interface, historique vide | « Aucune mesure enregistrée pour l'instant », aucune erreur JavaScript |
| `statut.html` avec 30 jours synthétiques (2 880 contrôles, 2 pannes injectées) | 24 h 100 %, 7 j 99,55 %, 30 j 99,86 %, 2 incidents (45 min et 15 min) correctement regroupés ; pas de défilement horizontal à 375 px |

**Non vérifié** (ne peut l'être qu'après envoi du dépôt sur GitHub) : exécution réelle de l'Action par GitHub, commit par le `GITHUB_TOKEN`, courriel d'échec, régularité réelle de la planification, publication de `statut.html` par GitHub Pages.

## 5. Réglages à faire par le propriétaire du dépôt

1. Envoyer le dépôt (le fichier `.github/workflows/supervision.yml` exige un jeton ou une connexion ayant le droit `workflow`).
2. *Settings > Actions > General > Workflow permissions* : si le dépôt est réglé en « Read repository contents », l'option `permissions: contents: write` du fichier suffit normalement ; si l'organisation bloque l'écriture, choisir « Read and write permissions ».
3. Lancer une première fois à la main (*Actions > Supervision > Run workflow*) et vérifier qu'un commit « Supervision : contrôle du … » apparaît.
4. Vérifier que les notifications d'échec des Actions arrivent par courriel (*Settings* du compte > *Notifications* > *Actions*).

## 6. Limites connues

- **Planification « au mieux »** : GitHub peut retarder une exécution planifiée de plusieurs minutes, voire en sauter aux heures chargées. Les taux sont calculés sur les contrôles réellement effectués ; un trou de mesure n'est compté ni comme disponible ni comme indisponible.
- **Dépôt sans activité** : GitHub désactive les tâches planifiées d'un dépôt public après 60 jours sans activité. Les commits de la supervision devraient compter comme activité (**non vérifié**) ; en cas de désactivation, la page d'état l'affiche (alerte « aucun contrôle depuis plus d'une heure ») et il suffit de réactiver la tâche dans l'onglet *Actions*.
- **Commits fréquents** : 96 commits par jour dans l'historique du dépôt. Chaque commit sur `main` relance la publication GitHub Pages (4 par heure, sous la limite indicative de 10 par heure). Si cela gêne, une évolution possible est d'écrire l'historique sur une branche dédiée ; non fait.
- **Point de vue unique** : les contrôles partent des serveurs de GitHub ; une panne d'accès propre à La Réunion (opérateur, câble sous-marin) n'est pas détectée.
- **Ce n'est pas un engagement de service** : la démo tourne sur des offres gratuites (GitHub Pages, Supabase gratuit) sans garantie de disponibilité.
- La supervision ne contrôle pas les sauvegardes (voir `docs/SAUVEGARDE-ET-REPRISE.md`) ni le fonctionnement métier (connexion d'un compte, lecture d'un dossier) : seuls la page, l'API et le service d'authentification répondent-ils.
