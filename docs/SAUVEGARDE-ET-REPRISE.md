# vavang — sauvegarde, restauration et plan de reprise

Ce document distingue ce qui est **réellement testé**, dans le prototype en démonstration locale, de ce qui **ne le serait qu'en hébergement** et n'a donc pas été vérifié.

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

## 2. Ce qui ne serait vérifiable qu'en hébergement (non testé)

Le mode hébergé (Supabase, région de l'Union européenne) est écrit (`supabase/schema.sql`) mais n'a jamais été installé : la décision du 18 novembre 2026 est de ne rien engager tant que le marché n'est pas obtenu. Les éléments ci-dessous décrivent donc le **dispositif prévu**, pas un dispositif vérifié.

| Exigence du CCTP | Dispositif prévu | Statut |
|---|---|---|
| Sauvegardes automatisées, chiffrées, séparées (3.7.6) | Sauvegarde quotidienne de la base, gérée et chiffrée par l'hébergeur ; export complet hebdomadaire, conservé hors de la plateforme | Non testé |
| Perte maximale de 4 heures (RPO, 3.7.7) | La sauvegarde quotidienne ne suffit pas : il faut l'option de restauration à un instant donné de l'hébergeur, payante, dont le prix est à intégrer au chiffrage | Non testé, coût à chiffrer |
| Rétablissement en 8 heures (RTO, 3.7.7) | Restauration de la base dans un nouveau projet, redéploiement du site statique (quelques minutes), bascule de l'adresse | Non testé |
| Tests de restauration réguliers, au moins un exercice par an | Restauration trimestrielle dans un environnement de test, avec un compte rendu | Non réalisé |
| Journaux conservés 12 mois (3.7.5) | Table du journal en base, sans suppression ; journaux techniques de l'hébergeur | Non testé |

## 3. Procédure de reprise après incident (prévue)

1. **Qualifier** l'incident en P1 dans l'outil de demandes, et informer la collectivité toutes les heures (CCTP 3.3.3).
2. **Choisir le point de reprise** : dernière sauvegarde de l'hébergeur, ou restauration à un instant donné si l'option est souscrite.
3. **Restaurer** dans un nouveau projet de la même région européenne ; contrôler le nombre de lignes par table par rapport au dernier inventaire d'export.
4. **Redéployer** le site statique pointant vers la base restaurée ; vérifier la connexion, la double authentification et l'accès aux pièces.
5. **Rejouer** le scénario de vérification sur un dossier de test.
6. **Rendre compte** sous 5 jours ouvrés : chronologie, cause, impacts, corrections, prévention (CCTP 3.7.9).

## 4. Retour arrière d'une reprise de données

La reprise d'un tableau de marchés ou de fournisseurs peut être annulée : les éléments créés sont supprimés, sauf ceux qui ont déjà servi (événements d'exécution, offres). Le fichier source et le rapport de contrôle sont conservés (capture 54).
