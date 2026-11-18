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

La démonstration publique (https://psyc01-cpu.github.io/vavang-demo/) fonctionne sur un projet Supabase du **plan gratuit** (région UE, Irlande). Les données y sont fictives. Le dispositif ci-dessous est **installé et exécuté**. Le 18/11/2026, l'action de sauvegarde a été lancée à la main avec succès (1 min 16 s) et un exercice de restauration réel a été fait (section 2.5). Une sauvegarde lancée depuis un poste local prend 24 s.

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
| Déclenchement | Action GitHub planifiée toutes les 3 heures (à la minute 17, UTC), ou lancée à la main (« Run workflow »). Le dépôt `vavang-demo` est public, donc les minutes sont gratuites. | `.github/workflows/sauvegarde.yml` |
| Connexion | Chrome sans interface ouvre la démo en ligne et se connecte en administrateur par le vrai parcours de l'application : mot de passe, puis code TOTP calculé à partir de `CONFIG.demoMfaSecret`, la clé publique de démonstration. La session obtenue est en aal2. Aucun secret n'est stocké dans GitHub. | `tests/sauvegarde.mjs` |
| Export de la base | La fonction `exporter_sauvegarde()` (security definer) est réservée à un administrateur (`admin.utilisateurs` via `moi()`) dont la session est en aal2. Elle renvoie les **37 tables métier** de `schema.sql`, ligne par ligne (`id, d, cree_le, cree_par, modifie_le`), avec l'inventaire des fichiers. L'export est inscrit au journal. | `supabase/sauvegarde.sql` |
| Fichiers | Tous les fichiers des compartiments `pieces` et `accueil` sont téléchargés, et leur taille est contrôlée. | `tests/sauvegarde.mjs` |
| Intégrité | Le dossier `sauvegarde-AAAAMMJJ-HHMM` (heure UTC) contient : le JSON, le dossier `fichiers/` et `SHA256SUMS`. Ce dernier donne une empreinte SHA-256 par fichier et une pour le JSON. Le JSON contient en plus une empreinte par table et le nombre de lignes de chaque table. L'action vérifie les empreintes (`sha256sum -c`) avant de publier. | — |
| Chiffrement | L'archive `.tar.gz` est chiffrée avec `openssl enc -aes-256-cbc -pbkdf2` (200 000 itérations) si le secret de dépôt `SAUVEGARDE_CLE` existe. **Sans ce secret, elle est publiée en clair** et l'action affiche un avertissement. C'est admissible seulement parce que les données sont fictives. Sur un dépôt public, les artefacts sont téléchargeables par toute personne connectée à GitHub. | `.github/workflows/sauvegarde.yml` |
| Conservation | Artefact GitHub conservé 30 jours, soit environ 120 points de reprise. Il est hors de la plateforme Supabase, donc séparé de la base. | — |
| Déchiffrement | `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in sauvegarde-….tar.gz.enc -out sauvegarde-….tar.gz` (la phrase de passe est demandée), puis `tar -xzf`. | — |

Limites connues :
- Les **comptes de connexion** (`auth.*` : adresses, mots de passe, facteurs TOTP) ne sont pas sauvegardés, volontairement. Le profil métier de chaque agent l'est, dans la table `profils`.
- La **trace technique** (`trace_technique`), le verrouillage des comptes et le jeu de référence de la démonstration (`demo_seed`) ne sont pas sauvegardés.
- Les horaires de GitHub Actions ne sont pas garantis : une exécution planifiée peut être retardée, voire sautée en cas de forte charge. Sur un dépôt public, GitHub **désactive aussi les planifications après 60 jours sans activité** sur le dépôt. Le RPO réel peut donc dépasser 3 heures.
- **Exigence du CCTP** : perte maximale de 4 heures (3.7.7). La planification `'17 */3 * * *'` (toutes les 3 heures, gratuite sur un dépôt public) vise 3 heures, avec une marge d'une heure pour un retard d'exécution de GitHub. Le RPO réel reste à mesurer sur plusieurs jours (historique des exécutions).
- La sauvegarde est logique (contenu des tables) et non physique : les fonctions, règles d'accès et déclencheurs viennent des fichiers `supabase/*.sql` du dépôt, qu'on rejoue sur un projet neuf.

### 2.3 Restauration et vérification

`node tests/restauration.mjs <dossier ou fichier de sauvegarde> --confirmer` :

0. **Contrôle local**, avant toute connexion : `SHA256SUMS`, puis l'empreinte et le nombre de lignes de chaque table. Une sauvegarde altérée ou incomplète est refusée. Ce contrôle a été essayé hors ligne le 19/11/2026 sur une fausse sauvegarde : intacte, elle est acceptée ; avec un fichier modifié d'un octet, elle est refusée.
1. **Connexion** de l'administrateur (mot de passe et TOTP, session aal2).
2. **Base** : `restaurer_sauvegarde(p)` (security definer, administrateur en aal2). La forme est contrôlée d'abord : version 1, les 37 tables présentes, aucune table inconnue, au moins un administrateur actif. Ensuite, dans **une seule transaction**, les tables métier sont vidées puis réinsérées, et le nombre de lignes est vérifié pour chaque table. Les contrôles métier de `garde()` sont suspendus pour cette seule transaction (indicateur `vavang.restauration`). La numérotation des demandes d'assistance est conservée. La restauration est inscrite au journal. `auth.*` n'est pas touché.
3. **Fichiers** : les fichiers présents dans `pieces` et `accueil` sont supprimés, puis ceux de la sauvegarde sont redéposés. La nouvelle règle de stockage `pieces_restauration` autorise l'administrateur en aal2 à redéposer partout, y compris sous `support/<agent>/`.
4. **Vérification** : un nouvel export est comparé à la sauvegarde. Pour chaque table, le nombre de lignes et le SHA-256 du contenu doivent être identiques. Le journal ne peut contenir en plus que les lignes « Restauration de sauvegarde » et « Sauvegarde exportée ». Chaque fichier est retéléchargé et son SHA-256 comparé. Un fichier manquant ou en trop est signalé.

Le script écrit `restauration-<date>.json` à côté de la sauvegarde, avec la durée de chaque étape. **RTO mesuré = étapes 1 à 4** : connexion, restauration de la base, fichiers et vérification. La décision de restaurer et la récupération de l'artefact ne sont pas comptées : à ajouter dans le compte rendu d'exercice.

Points non vérifiés : délai maximal d'exécution d'une requête du rôle `authenticated` sur Supabase et taille maximale acceptée pour l'appel `restaurer_sauvegarde`. Avec le jeu de démonstration (37 tables, 336 lignes, 14 fichiers), la restauration de la base a pris 1,1 s ; un volume réel n'a pas été essayé.

### 2.4 État par rapport au CCTP

| Exigence du CCTP | Dispositif | Statut |
|---|---|---|
| Sauvegardes automatisées, chiffrées, séparées (3.7.6) | Action GitHub toutes les 3 h ; archive chiffrée si `SAUVEGARDE_CLE` est défini ; stockage chez GitHub, hors de Supabase | **Partiel** : exécution manuelle réussie le 18/11/2026 (1 min 16 s ; 37 tables, 336 lignes, 14 fichiers). Secret `SAUVEGARDE_CLE` non défini à ce jour : artefact en clair (données fictives). |
| Perte maximale de 4 heures (RPO, 3.7.7) | Cible : 3 h, dans l'exigence (voir 2.2). PITR payant non retenu. | RPO : **3 h par conception** (fréquence des sauvegardes) ; RPO réel à mesurer (retards possibles de GitHub) |
| Rétablissement en 8 heures (RTO, 3.7.7) | `tests/restauration.mjs` : restauration, vérification et durées mesurées | RTO technique mesuré le 18/11/2026 : **25,8 s** (étapes 1 à 4) ; conforme |
| Tests de restauration réguliers, au moins un exercice par an | Exercice avec compte rendu (date, sauvegarde utilisée, durées, écarts) | **Premier exercice réalisé le 18/11/2026 à 22:40 UTC** : réussi, 0 écart (section 2.5). Régularité à organiser. |
| Journaux conservés 12 mois (3.7.5) | Table `journal` en base, sans suppression, incluse dans chaque sauvegarde. La démo est remise à zéro chaque nuit, donc son journal ne dure pas 12 mois. | Non vérifié |

Mise en service : faite. `supabase/sauvegarde.sql` est exécuté, l'action est poussée sur `vavang-demo` et a été lancée une première fois à la main. Reste à faire : créer le secret de dépôt `SAUVEGARDE_CLE` (Settings → Secrets and variables → Actions) avec une phrase de passe longue, conservée hors de GitHub, pour que les artefacts soient chiffrés.

### 2.5 Exercice de restauration du 18/11/2026

| Élément | Résultat |
|---|---|
| Date | 18/11/2026, 22:40 UTC |
| Outil | `node tests/restauration.mjs <sauvegarde> --confirmer`, sur la démo en ligne |
| Contenu restauré | 37 tables, 336 lignes, 14 fichiers |
| Résultat | **Réussi** : 37 tables sur 37 identiques (SHA-256), 14 fichiers sur 14, **0 écart** |
| Durées | connexion 14,4 s ; base 1,1 s ; fichiers 6,4 s ; vérification 3,9 s |
| **RTO technique mesuré** | **25,8 s** (étapes 1 à 4 de 2.3). Exigence du CCTP : 8 h. Ne comprend ni la décision de restaurer, ni la récupération de l'artefact. |
| **RPO** | **3 h par conception** (une sauvegarde toutes les 3 h). Exigence du CCTP : 4 h. Peut dépasser 3 h si GitHub retarde une exécution planifiée ; non encore mesuré sur la durée. |
| Sauvegarde locale | Lancée depuis un poste : 24 s |
| Rapport de l'exercice | `mesures/restauration-20261118.json` (durées, 37 tables, 14 fichiers, écarts) |
| Remise à zéro de la démo | Chaque nuit à 3 h (heure de La Réunion), par pg_cron. |

## 3. Procédure de reprise après incident

1. **Qualifier** l'incident en P1 dans l'outil de demandes, et informer la collectivité toutes les heures (CCTP 3.3.3).
2. **Choisir le point de reprise** : le dernier artefact « sauvegarde-AAAAMMJJ-HHMM » réussi de l'action GitHub. Le télécharger, le déchiffrer et contrôler les empreintes (`sha256sum -c SHA256SUMS`).
3. **Si le projet Supabase est perdu** : créer un projet dans la même région européenne, rejouer `supabase/schema.sql`, `schema_demo.sql` puis `sauvegarde.sql`, et recréer les comptes de connexion, car `auth.*` n'est pas sauvegardé.
4. **Restaurer** : `node tests/restauration.mjs <dossier> --confirmer`. Si l'adresse change, renseigner `VAVANG_URL` et mettre à jour `config.js`.
5. **Contrôler** le rapport `restauration-….json` : toutes les tables et tous les fichiers doivent être identiques. Vérifier ensuite la connexion, la double authentification et l'accès aux pièces dans l'application.
6. **Rendre compte** sous 5 jours ouvrés : chronologie, cause, impacts, corrections, prévention (CCTP 3.7.9).


## 4. Retour arrière d'une reprise de données

La reprise d'un tableau de marchés ou de fournisseurs peut être annulée : les éléments créés sont supprimés, sauf ceux qui ont déjà servi (événements d'exécution, offres). Le fichier source et le rapport de contrôle sont conservés (capture 54).
