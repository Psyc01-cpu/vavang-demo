# vavang — sauvegarde, restauration et plan de reprise

Ce document décrit ce qui est **testé en démonstration locale** (section 1) et **en démonstration en ligne** (section 2, exercice réel du 18/11/2026). Tout ce qui n'a pas été mesuré est indiqué comme tel.

## 1. Ce qui est testé (démonstration locale)

| Fonction | Comment | Preuve |
|---|---|---|
| Export complet | Menu « Reprise, export et sauvegarde » → « Générer l'export complet ». Archive ZIP au format ouvert (voir `FORMATS-ECHANGE.md`). | Scénario automatique ; capture 55 |
| Contrôle de l'archive | Avant toute écriture, l'archive est relue et comparée à son inventaire, table par table. Une archive incomplète ou altérée est refusée. | Capture 56 |
| Restauration | « Restaurer une sauvegarde » : toutes les données et tous les fichiers sont remplacés par ceux de l'archive. | Scénario : après la sauvegarde, un besoin est ajouté et trois marchés retirés. La restauration ramène exactement l'état sauvegardé sur 15 tables contrôlées. Le mémoire technique d'un candidat est rouvert avec son fichier source et ses 3 pages de texte. |
| Traçabilité | L'export et la restauration sont inscrits au journal de sécurité. | Scénario |

Limites de la restauration en local :
- Elle remplace tout : il n'y a pas de restauration partielle (une table, un dossier).
- Les comptes et les mots de passe ne sont pas dans l'export, volontairement : ils sont conservés tels quels lors d'une restauration.
- En mode local, les données vivent dans le navigateur d'un poste. **Ce n'est pas une sauvegarde au sens du CCTP** : si le poste est perdu, seules les archives exportées permettent de reprendre.

## 2. Démonstration hébergée (Supabase) : sauvegarde et restauration sans coût

La démonstration publique (https://psyc01-cpu.github.io/vavang-demo/) fonctionne sur un projet Supabase du **plan gratuit** (région UE, Irlande). Les données y sont fictives. Le dispositif ci-dessous est **installé et exécuté**. Le 18/11/2026, l'action de sauvegarde a été lancée à la main avec succès (1 min 16 s) et un exercice de restauration réel a été fait (section 2.7). Une sauvegarde lancée depuis un poste local prend 24 s.

### 2.1 Ce que fournit l'hébergeur sur le plan gratuit

| Point | Ce que dit Supabase (consulté le 19/11/2026) | Conséquence |
|---|---|---|
| Sauvegardes automatiques | Page de tarifs, colonne Free : « Automatic backups : Not included » ; « Point in time recovery : Not included ». | On ne compte **pas** sur l'hébergeur. Le guide des sauvegardes de Supabase ne précise ni la durée de conservation ni le téléchargement pour le plan gratuit. Il recommande aux projets gratuits d'exporter eux-mêmes leurs données régulièrement et d'en garder une copie ailleurs. L'existence d'une sauvegarde quotidienne non téléchargeable sur le plan gratuit est **à vérifier** : les sources se contredisent. |
| Plans payants (pour mémoire) | Pro : 7 jours de sauvegardes quotidiennes, restaurables depuis le tableau de bord mais non téléchargeables directement. Restauration à un instant donné (PITR) : option payante d'environ 100 $ par mois pour 7 jours. | Hors du principe « zéro euro » ; à chiffrer seulement en cas de marché. |
| Fichiers déposés | Les sauvegardes de base de Supabase ne contiennent pas les fichiers du stockage. | Les fichiers sont copiés par notre propre sauvegarde (voir 2.2). |
| Mise en veille | Plan gratuit : projet mis en pause après 1 semaine d'inactivité. | La sauvegarde toutes les 3 heures sollicite la base. Qu'elle suffise à empêcher la mise en pause est **non vérifié**. |

Sources : https://supabase.com/pricing et https://supabase.com/docs/guides/platform/backups

### 2.2 Notre sauvegarde : une action GitHub planifiée, gratuite et sans secret

| Élément | Dispositif | Fichier |
|---|---|---|
| Déclenchement | Action GitHub planifiée toutes les 3 heures (à la minute 17, UTC) et chaque jour à 02:17 UTC, ou lancée à la main (« Run workflow », avec le choix de l'échéance). Le dépôt `vavang-demo` est public, donc les minutes sont gratuites. Les échéances sont décrites en 2.3. | `.github/workflows/sauvegarde.yml` |
| Connexion | Chrome sans interface ouvre la démo en ligne et se connecte en administrateur par le vrai parcours de l'application : mot de passe, puis code TOTP calculé à partir de `CONFIG.demoMfaSecret`, la clé publique de démonstration. La session obtenue est en aal2. Aucun secret n'est stocké dans GitHub. | `tests/sauvegarde.mjs` |
| Export de la base | La fonction `exporter_sauvegarde()` (security definer) est réservée à un administrateur (`admin.utilisateurs` via `moi()`) dont la session est en aal2. Elle renvoie les **37 tables métier** de `schema.sql`, ligne par ligne (`id, d, cree_le, cree_par, modifie_le`), avec l'inventaire des fichiers. L'export est inscrit au journal. | `supabase/sauvegarde.sql` |
| Fichiers | Tous les fichiers des compartiments `pieces` et `accueil` sont téléchargés, et leur taille est contrôlée. | `tests/sauvegarde.mjs` |
| Intégrité | Le dossier `sauvegarde-AAAAMMJJ-HHMM` (heure UTC) contient : le JSON, le dossier `fichiers/` et `SHA256SUMS`. Ce dernier donne une empreinte SHA-256 par fichier et une pour le JSON. Le JSON contient en plus une empreinte par table et le nombre de lignes de chaque table. L'action vérifie les empreintes (`sha256sum -c`) avant de publier. | — |
| Chiffrement | L'archive `.tar.gz` est chiffrée avec `openssl enc -aes-256-cbc -pbkdf2` (200 000 itérations) si le secret de dépôt `SAUVEGARDE_CLE` existe. **Sans ce secret, elle est publiée en clair** et l'action affiche un avertissement. C'est admissible seulement parce que les données sont fictives. Sur un dépôt public, les artefacts sont téléchargeables par toute personne connectée à GitHub. | `.github/workflows/sauvegarde.yml` |
| Conservation | Rotation à plusieurs échéances (2.3) : courante 3 jours, quotidienne 30 jours, hebdomadaire 90 jours, mensuelle 12 mois si le secret `SAUVEGARDE_CLE` existe. Le tout est hors de la plateforme Supabase, donc séparé de la base. | — |
| Déchiffrement | `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in sauvegarde-….tar.gz.enc -out sauvegarde-….tar.gz` (la phrase de passe est demandée), puis `tar -xzf`. | — |

Limites connues :
- Les **comptes de connexion** (`auth.*` : adresses, mots de passe, facteurs TOTP) ne sont pas sauvegardés, volontairement. Le profil métier de chaque agent l'est, dans la table `profils`.
- La **trace technique** (`trace_technique`), le verrouillage des comptes et le jeu de référence de la démonstration (`demo_seed`) ne sont pas sauvegardés.
- Les horaires de GitHub Actions ne sont pas garantis : une exécution planifiée peut être retardée, voire sautée en cas de forte charge. Sur un dépôt public, GitHub **désactive aussi les planifications après 60 jours sans activité** sur le dépôt. Le RPO réel peut donc dépasser 3 heures.
- **Exigence du CCTP** : perte maximale de 4 heures (3.7.7). La planification `'17 */3 * * *'` (toutes les 3 heures, gratuite sur un dépôt public) vise 3 heures, avec une marge d'une heure pour un retard d'exécution de GitHub. Le RPO réel reste à mesurer sur plusieurs jours (historique des exécutions).
- La sauvegarde est logique (contenu des tables) et non physique : les fonctions, règles d'accès et déclencheurs viennent des fichiers `supabase/*.sql` du dépôt, qu'on rejoue sur un projet neuf.

### 2.3 Plan de sauvegarde à plusieurs échéances (rotation)

L'administrateur dispose de sauvegardes sur plusieurs temporalités. L'échéance est écrite dans le nom de l'artefact : `sauvegarde-<échéance>-AAAAMMJJ-HHMM` (heure UTC). Le dossier contenu dans l'archive garde son nom habituel `sauvegarde-AAAAMMJJ-HHMM` : `tests/restauration.mjs` s'en sert sans changement.

| Échéance | Fréquence | Conservation | Stockage | Chiffrement | Points de reprise disponibles | Perte maximale (RPO) si l'on remonte à cette échéance |
|---|---|---|---|---|---|---|
| Courante | Toutes les 3 h, minute 17 (UTC) | 3 jours | Artefact GitHub Actions | Oui si `SAUVEGARDE_CLE` existe, sinon non (avertissement) | environ 24 | 3 h par conception |
| Quotidienne | Chaque jour à 02:17 UTC (06:17 à La Réunion), sauf le dimanche | 30 jours | Artefact GitHub Actions | idem | environ 26 | 24 h, pour un point de 3 à 30 jours en arrière |
| Hebdomadaire | Le dimanche à 02:17 UTC | 90 jours | Artefact GitHub Actions | idem | environ 13 | 7 jours, pour un point de 30 à 90 jours en arrière |
| Mensuelle | Le premier dimanche du mois (la sauvegarde hebdomadaire de ce jour-là) | 12 mois (les 12 dernières releases ; les plus anciennes sont supprimées automatiquement) | Release GitHub `sauvegarde-mensuelle-AAAAMM` | **Toujours** : la release n'est créée que si `SAUVEGARDE_CLE` existe, et le job refuse de publier une archive en clair | 12 | 1 mois, pour un point de 3 à 12 mois en arrière |

Planification : deux règles seulement, `'17 */3 * * *'` et `'17 2 * * *'`. L'action lit la règle qui l'a déclenchée (`github.event.schedule`) : la première donne une sauvegarde courante ; la seconde une quotidienne, ou une hebdomadaire le dimanche. Ce choix évite de calculer l'échéance d'après l'heure de démarrage, qui varie quand GitHub retarde une exécution. Le créneau de 02:17 n'est pas un multiple de 3 h : il ne fait pas doublon avec les sauvegardes courantes. Lancée à la main, l'action demande l'échéance (courante par défaut).

**Limite de conservation vérifiée** : pour un dépôt public, GitHub permet de conserver artefacts et journaux **de 1 à 90 jours** (400 jours pour un dépôt privé). Source consultée le 19/11/2026 : https://docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization. Une conservation mensuelle sur 12 mois **n'est donc pas possible gratuitement avec les artefacts** d'un dépôt public.

Alternative retenue pour le mensuel : une **release GitHub** n'expire pas. Chaque fichier doit faire moins de 2 Gio, 1 000 fichiers au plus par release (https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases). Mais sur un dépôt public, une release est téléchargeable **par tout le monde, sans compte**. C'est pourquoi le job `mensuelle` ne s'exécute que si l'archive est chiffrée (secret `SAUVEGARDE_CLE` présent) ; il vérifie l'empreinte, refuse toute archive en clair, ne crée qu'une release par mois et garde les 12 plus récentes. Ce job seul reçoit le droit `contents: write`. **À ce jour, le secret n'est pas défini : aucune release n'est publiée.** Le fonctionnement du job `mensuelle` est **non vérifié** (il ne s'est encore jamais exécuté).

Remarques :
- Sur la démonstration, les données sont remises à zéro chaque nuit à 3 h, heure de La Réunion (23:00 UTC). La sauvegarde quotidienne de 02:17 UTC capture donc l'état peu après cette remise à zéro. Pour une collectivité réelle, sans remise à zéro, la question ne se pose pas.
- Le coût reste nul : minutes gratuites sur un dépôt public. Le volume total stocké (environ 63 artefacts à un instant donné) n'a pas été mesuré sur la durée : **non vérifié** au regard des quotas de stockage de GitHub.
- Écran de l'application : menu « Reprise, export et sauvegarde », carte « Plan de sauvegarde ». Elle présente ces échéances, un bouton « Sauvegarder maintenant » (en local : export complet ; en ligne : lien vers « Run workflow ») et les dernières sauvegardes inscrites au journal. La liste des artefacts n'y est pas chargée : la politique de sécurité de l'application (CSP) n'autorise que le serveur Supabase. L'API de GitHub la donnerait sans secret, mais il faudrait élargir la CSP.

### 2.4 Trouver la sauvegarde d'une date donnée

1. Choisir l'échéance selon l'ancienneté : moins de 3 jours → courante ; de 3 à 30 jours → quotidienne ; de 30 à 90 jours → hebdomadaire ; au-delà → mensuelle (si elle existe).
2. **Artefacts** : ouvrir https://github.com/Psyc01-cpu/vavang-demo/actions/workflows/sauvegarde.yml, ouvrir l'exécution réussie la plus proche **avant** la date voulue, et télécharger en bas de page l'artefact `sauvegarde-<échéance>-AAAAMMJJ-HHMM` (connexion à GitHub demandée). L'heure du nom est en UTC : ajouter 4 h pour l'heure de La Réunion. Avec un jeton GitHub, la liste complète se lit aussi par `gh api repos/Psyc01-cpu/vavang-demo/actions/artifacts --paginate --jq '.artifacts[] | select(.name|startswith("sauvegarde-")) | [.name, .created_at, .expires_at] | @tsv'`.
3. **Releases** (mensuelles) : https://github.com/Psyc01-cpu/vavang-demo/releases, étiquette `sauvegarde-mensuelle-AAAAMM`.
4. Contrôler l'empreinte de l'archive (`sha256sum -c *.archive.sha256`), la déchiffrer si elle se termine par `.enc` (commande en 2.2), la décompresser (`tar -xzf`), puis restaurer (2.5).

### 2.5 Restauration et vérification

`node tests/restauration.mjs <dossier ou fichier de sauvegarde> --confirmer` :

0. **Contrôle local**, avant toute connexion : `SHA256SUMS`, puis l'empreinte et le nombre de lignes de chaque table. Une sauvegarde altérée ou incomplète est refusée. Ce contrôle a été essayé hors ligne le 19/11/2026 sur une fausse sauvegarde : intacte, elle est acceptée ; avec un fichier modifié d'un octet, elle est refusée.
1. **Connexion** de l'administrateur (mot de passe et TOTP, session aal2).
2. **Base** : `restaurer_sauvegarde(p)` (security definer, administrateur en aal2). La forme est contrôlée d'abord : version 1, les 37 tables présentes, aucune table inconnue, au moins un administrateur actif. Ensuite, dans **une seule transaction**, les tables métier sont vidées puis réinsérées, et le nombre de lignes est vérifié pour chaque table. Les contrôles métier de `garde()` sont suspendus pour cette seule transaction (indicateur `vavang.restauration`). La numérotation des demandes d'assistance est conservée. La restauration est inscrite au journal. `auth.*` n'est pas touché.
3. **Fichiers** : les fichiers présents dans `pieces` et `accueil` sont supprimés, puis ceux de la sauvegarde sont redéposés. La nouvelle règle de stockage `pieces_restauration` autorise l'administrateur en aal2 à redéposer partout, y compris sous `support/<agent>/`.
4. **Vérification** : un nouvel export est comparé à la sauvegarde. Pour chaque table, le nombre de lignes et le SHA-256 du contenu doivent être identiques. Le journal ne peut contenir en plus que les lignes « Restauration de sauvegarde » et « Sauvegarde exportée ». Chaque fichier est retéléchargé et son SHA-256 comparé. Un fichier manquant ou en trop est signalé.

Le script écrit `restauration-<date>.json` à côté de la sauvegarde, avec la durée de chaque étape. **RTO mesuré = étapes 1 à 4** : connexion, restauration de la base, fichiers et vérification. La décision de restaurer et la récupération de l'artefact ne sont pas comptées : à ajouter dans le compte rendu d'exercice.

Points non vérifiés : délai maximal d'exécution d'une requête du rôle `authenticated` sur Supabase et taille maximale acceptée pour l'appel `restaurer_sauvegarde`. Avec le jeu de démonstration (37 tables, 336 lignes, 14 fichiers), la restauration de la base a pris 1,1 s ; un volume réel n'a pas été essayé.

### 2.6 État par rapport au CCTP

| Exigence du CCTP | Dispositif | Statut |
|---|---|---|
| Sauvegardes automatisées, chiffrées, séparées (3.7.6) | Action GitHub toutes les 3 h, avec rotation quotidienne (30 j), hebdomadaire (90 j) et mensuelle chiffrée (12 mois, si `SAUVEGARDE_CLE`) ; archive chiffrée si `SAUVEGARDE_CLE` est défini ; stockage chez GitHub, hors de Supabase | **Partiel** : exécution manuelle réussie le 18/11/2026 (1 min 16 s ; 37 tables, 336 lignes, 14 fichiers). Secret `SAUVEGARDE_CLE` non défini à ce jour : artefact en clair (données fictives). |
| Perte maximale de 4 heures (RPO, 3.7.7) | Cible : 3 h, dans l'exigence (voir 2.2 et 2.3). PITR payant non retenu. | RPO : **3 h par conception** (fréquence des sauvegardes) ; RPO réel à mesurer (retards possibles de GitHub) |
| Rétablissement en 8 heures (RTO, 3.7.7) | `tests/restauration.mjs` : restauration, vérification et durées mesurées | RTO technique mesuré le 18/11/2026 : **25,8 s** (étapes 1 à 4) ; conforme |
| Tests de restauration réguliers, au moins un exercice par an | Exercice avec compte rendu (date, sauvegarde utilisée, durées, écarts) | **Premier exercice réalisé le 18/11/2026 à 22:40 UTC** : réussi, 0 écart (section 2.7). Régularité à organiser. |
| Journaux conservés 12 mois (3.7.5) | Table `journal` en base, sans suppression, incluse dans chaque sauvegarde. La démo est remise à zéro chaque nuit, donc son journal ne dure pas 12 mois. | Non vérifié |

Mise en service : faite. `supabase/sauvegarde.sql` est exécuté, l'action est poussée sur `vavang-demo` et a été lancée une première fois à la main. Reste à faire : créer le secret de dépôt `SAUVEGARDE_CLE` (Settings → Secrets and variables → Actions) avec une phrase de passe longue, conservée hors de GitHub, pour que les artefacts soient chiffrés.

### 2.7 Exercice de restauration du 18/11/2026

| Élément | Résultat |
|---|---|
| Date | 18/11/2026, 22:40 UTC |
| Outil | `node tests/restauration.mjs <sauvegarde> --confirmer`, sur la démo en ligne |
| Contenu restauré | 37 tables, 336 lignes, 14 fichiers |
| Résultat | **Réussi** : 37 tables sur 37 identiques (SHA-256), 14 fichiers sur 14, **0 écart** |
| Durées | connexion 14,4 s ; base 1,1 s ; fichiers 6,4 s ; vérification 3,9 s |
| **RTO technique mesuré** | **25,8 s** (étapes 1 à 4 de 2.5). Exigence du CCTP : 8 h. Ne comprend ni la décision de restaurer, ni la récupération de l'artefact. |
| **RPO** | **3 h par conception** (une sauvegarde toutes les 3 h). Exigence du CCTP : 4 h. Peut dépasser 3 h si GitHub retarde une exécution planifiée ; non encore mesuré sur la durée. |
| Sauvegarde locale | Lancée depuis un poste : 24 s |
| Rapport de l'exercice | `mesures/restauration-20261118.json` (durées, 37 tables, 14 fichiers, écarts) |
| Remise à zéro de la démo | Chaque nuit à 3 h (heure de La Réunion), par pg_cron. |

## 3. Procédure de reprise après incident

1. **Qualifier** l'incident en P1 dans l'outil de demandes, et informer la collectivité toutes les heures (CCTP 3.3.3).
2. **Choisir le point de reprise** : en général le dernier artefact « sauvegarde-courante-AAAAMMJJ-HHMM » réussi ; pour revenir avant une erreur ancienne, la sauvegarde de la date voulue (procédure en 2.4). La télécharger, la déchiffrer et contrôler les empreintes (`sha256sum -c SHA256SUMS`).
3. **Si le projet Supabase est perdu** : créer un projet dans la même région européenne, rejouer `supabase/schema.sql`, `schema_demo.sql` puis `sauvegarde.sql`, et recréer les comptes de connexion, car `auth.*` n'est pas sauvegardé.
4. **Restaurer** : `node tests/restauration.mjs <dossier> --confirmer`. Si l'adresse change, renseigner `VAVANG_URL` et mettre à jour `config.js`.
5. **Contrôler** le rapport `restauration-….json` : toutes les tables et tous les fichiers doivent être identiques. Vérifier ensuite la connexion, la double authentification et l'accès aux pièces dans l'application.
6. **Rendre compte** sous 5 jours ouvrés : chronologie, cause, impacts, corrections, prévention (CCTP 3.7.9).


## 4. Retour arrière d'une reprise de données

La reprise d'un tableau de marchés ou de fournisseurs peut être annulée : les éléments créés sont supprimés, sauf ceux qui ont déjà servi (événements d'exécution, offres). Le fichier source et le rapport de contrôle sont conservés (capture 54).
