# vavang — sauvegarde, restauration et plan de reprise

Ce document distingue ce qui est **réellement testé** (démonstration locale, section 1), de ce qui est **écrit pour la démonstration hébergée mais pas encore exécuté** (sections 2 et 3). Tout ce qui n'a pas été mesuré est indiqué comme tel.

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

La démonstration publique (https://psyc01-cpu.github.io/vavang-demo/) fonctionne sur un projet Supabase du **plan gratuit** (région UE, Irlande). Les données y sont fictives. Le dispositif ci-dessous est **écrit mais pas encore exécuté** : la partie SQL (`supabase/sauvegarde.sql`) reste à installer, puis l'exercice de restauration reste à faire. Aucune durée n'est donc mesurée à ce jour.

### 2.1 Ce que fournit l'hébergeur sur le plan gratuit

| Point | Ce que dit Supabase (consulté le 19/11/2026) | Conséquence |
|---|---|---|
| Sauvegardes automatiques | Page de tarifs, colonne Free : « Automatic backups : Not included » ; « Point in time recovery : Not included ». | On ne compte **pas** sur l'hébergeur. Le guide des sauvegardes de Supabase ne précise ni la durée de conservation ni le téléchargement pour le plan gratuit. Il recommande aux projets gratuits d'exporter eux-mêmes leurs données régulièrement et d'en garder une copie ailleurs. L'existence d'une sauvegarde quotidienne non téléchargeable sur le plan gratuit est **à vérifier** : les sources se contredisent. |
| Plans payants (pour mémoire) | Pro : 7 jours de sauvegardes quotidiennes, restaurables depuis le tableau de bord mais non téléchargeables directement. Restauration à un instant donné (PITR) : option payante d'environ 100 $ par mois pour 7 jours. | Hors du principe « zéro euro » ; à chiffrer seulement en cas de marché. |
| Fichiers déposés | Les sauvegardes de base de Supabase ne contiennent pas les fichiers du stockage. | Les fichiers sont copiés par notre propre sauvegarde (voir 2.2). |
| Mise en veille | Plan gratuit : projet mis en pause après 1 semaine d'inactivité. | La sauvegarde toutes les 6 heures sollicite la base. Qu'elle suffise à empêcher la mise en pause est **non vérifié**. |

Sources : https://supabase.com/pricing et https://supabase.com/docs/guides/platform/backups

### 2.2 Notre sauvegarde : une action GitHub planifiée, gratuite et sans secret

| Élément | Dispositif | Fichier |
|---|---|---|
| Déclenchement | Action GitHub planifiée toutes les 6 heures (00:17, 06:17, 12:17 et 18:17 UTC), ou lancée à la main (« Run workflow »). Le dépôt `vavang-demo` est public, donc les minutes sont gratuites. | `.github/workflows/sauvegarde.yml` |
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
- Les horaires de GitHub Actions ne sont pas garantis : une exécution planifiée peut être retardée, voire sautée en cas de forte charge. Sur un dépôt public, GitHub **désactive aussi les planifications après 60 jours sans activité** sur le dépôt. Le RPO réel peut donc dépasser 6 heures.
- **Écart avec le CCTP** : il demande une perte maximale de 4 heures (3.7.7), alors que la cible retenue ici est de 6 heures. Pour s'en approcher, il suffit de passer à `'17 */3 * * *'` (toutes les 3 heures). Cela reste gratuit sur un dépôt public, mais le retard possible des exécutions planifiées demeure.
- La sauvegarde est logique (contenu des tables) et non physique : les fonctions, règles d'accès et déclencheurs viennent des fichiers `supabase/*.sql` du dépôt, qu'on rejoue sur un projet neuf.

### 2.3 Restauration et vérification

`node tests/restauration.mjs <dossier ou fichier de sauvegarde> --confirmer` :

0. **Contrôle local**, avant toute connexion : `SHA256SUMS`, puis l'empreinte et le nombre de lignes de chaque table. Une sauvegarde altérée ou incomplète est refusée. Ce contrôle a été essayé hors ligne le 19/11/2026 sur une fausse sauvegarde : intacte, elle est acceptée ; avec un fichier modifié d'un octet, elle est refusée.
1. **Connexion** de l'administrateur (mot de passe et TOTP, session aal2).
2. **Base** : `restaurer_sauvegarde(p)` (security definer, administrateur en aal2). La forme est contrôlée d'abord : version 1, les 37 tables présentes, aucune table inconnue, au moins un administrateur actif. Ensuite, dans **une seule transaction**, les tables métier sont vidées puis réinsérées, et le nombre de lignes est vérifié pour chaque table. Les contrôles métier de `garde()` sont suspendus pour cette seule transaction (indicateur `vavang.restauration`). La numérotation des demandes d'assistance est conservée. La restauration est inscrite au journal. `auth.*` n'est pas touché.
3. **Fichiers** : les fichiers présents dans `pieces` et `accueil` sont supprimés, puis ceux de la sauvegarde sont redéposés. La nouvelle règle de stockage `pieces_restauration` autorise l'administrateur en aal2 à redéposer partout, y compris sous `support/<agent>/`.
4. **Vérification** : un nouvel export est comparé à la sauvegarde. Pour chaque table, le nombre de lignes et le SHA-256 du contenu doivent être identiques. Le journal ne peut contenir en plus que les lignes « Restauration de sauvegarde » et « Sauvegarde exportée ». Chaque fichier est retéléchargé et son SHA-256 comparé. Un fichier manquant ou en trop est signalé.

Le script écrit `restauration-<date>.json` à côté de la sauvegarde, avec la durée de chaque étape. **RTO mesuré = étapes 1 à 4** : connexion, restauration de la base, fichiers et vérification. La décision de restaurer et la récupération de l'artefact ne sont pas comptées : à ajouter dans le compte rendu d'exercice.

Points non vérifiés : délai maximal d'exécution d'une requête du rôle `authenticated` sur Supabase (quelques secondes par défaut), taille maximale acceptée pour l'appel `restaurer_sauvegarde` et comportement des deux fonctions SQL. Rien de cela n'est mesuré, car le SQL n'est pas encore exécuté.

### 2.4 État par rapport au CCTP

| Exigence du CCTP | Dispositif | Statut |
|---|---|---|
| Sauvegardes automatisées, chiffrées, séparées (3.7.6) | Action GitHub toutes les 6 h ; archive chiffrée si `SAUVEGARDE_CLE` est défini ; stockage chez GitHub, hors de Supabase | Écrit, non exécuté |
| Perte maximale de 4 heures (RPO, 3.7.7) | Cible : 6 h, soit **au-delà de l'exigence** (voir 2.2). PITR payant non retenu. | RPO mesuré : **à mesurer** |
| Rétablissement en 8 heures (RTO, 3.7.7) | `tests/restauration.mjs` : restauration, vérification et durées mesurées | RTO mesuré : **à mesurer** |
| Tests de restauration réguliers, au moins un exercice par an | Exercice avec compte rendu (date, sauvegarde utilisée, durées, écarts) | Non réalisé : premier exercice à faire |
| Journaux conservés 12 mois (3.7.5) | Table `journal` en base, sans suppression, incluse dans chaque sauvegarde. La démo est remise à zéro chaque nuit, donc son journal ne dure pas 12 mois. | Non vérifié |

Mise en service (à faire une fois) :
1. Exécuter `supabase/sauvegarde.sql` dans l'éditeur SQL du projet, après `schema.sql` et `schema_demo.sql`.
2. Facultatif mais recommandé : créer le secret de dépôt `SAUVEGARDE_CLE` (Settings → Secrets and variables → Actions) avec une phrase de passe longue, conservée hors de GitHub.
3. Pousser `.github/workflows/sauvegarde.yml` sur la branche par défaut de `vavang-demo`, puis lancer l'action à la main une première fois.
4. Faire l'exercice de restauration et reporter les durées dans le tableau ci-dessus.

## 3. Procédure de reprise après incident

1. **Qualifier** l'incident en P1 dans l'outil de demandes, et informer la collectivité toutes les heures (CCTP 3.3.3).
2. **Choisir le point de reprise** : le dernier artefact « sauvegarde-AAAAMMJJ-HHMM » réussi de l'action GitHub. Le télécharger, le déchiffrer et contrôler les empreintes (`sha256sum -c SHA256SUMS`).
3. **Si le projet Supabase est perdu** : créer un projet dans la même région européenne, rejouer `supabase/schema.sql`, `schema_demo.sql` puis `sauvegarde.sql`, et recréer les comptes de connexion, car `auth.*` n'est pas sauvegardé.
4. **Restaurer** : `node tests/restauration.mjs <dossier> --confirmer`. Si l'adresse change, renseigner `VAVANG_URL` et mettre à jour `config.js`.
5. **Contrôler** le rapport `restauration-….json` : toutes les tables et tous les fichiers doivent être identiques. Vérifier ensuite la connexion, la double authentification et l'accès aux pièces dans l'application.
6. **Rendre compte** sous 5 jours ouvrés : chronologie, cause, impacts, corrections, prévention (CCTP 3.7.9).


## 4. Retour arrière d'une reprise de données

La reprise d'un tableau de marchés ou de fournisseurs peut être annulée : les éléments créés sont supprimés, sauf ceux qui ont déjà servi (événements d'exécution, offres). Le fichier source et le rapport de contrôle sont conservés (capture 54).
