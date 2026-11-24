# vavang — guide de l'administrateur

Version du 19 novembre 2026, mode démonstration locale (la section 6 décrit aussi la version en ligne).

## 1. Comptes et profils

**Utilisateurs et habilitations** (capture 05) :
- « Nouvel utilisateur » : nom, adresse, profil, service, mot de passe initial de 12 caractères au moins.
- Modifier le profil, désactiver ou réactiver un compte, réinitialiser un mot de passe. Vous ne pouvez ni désactiver votre propre compte, ni changer votre propre profil.
- La colonne **Sécurité** (capture 10) indique si la double authentification est active, et si le compte est verrouillé. Elle permet de **déverrouiller** un compte et de **réinitialiser la double authentification** quand un agent a perdu son téléphone.

Profils fournis : administrateur, gestionnaire de marchés, service prescripteur, valideur, lecteur ou auditeur, support éditeur. La **matrice des habilitations** (même écran) se coche profil par profil, action par action, sur 27 actions.

**Habilitation sur un dossier** : dans la fiche d'une consultation, « Affecter un agent » donne à un agent l'accès à ce dossier avec une fonction (analyste, valideur, lecteur). Le **périmètre** permet de limiter l'accès à un seul lot : l'agent ne voit et ne note alors que ce lot (capture 38).

## 2. Paramètres

Menu **Paramètres** (capture 39) :
- **Seuils de procédure**, avec leur date d'effet. Ils sont à tenir à jour à chaque évolution réglementaire.
- **Circuit de validation du dossier de consultation** : ajoutez, renommez, réordonnez ou retirez les étapes entre la rédaction et la validation (par exemple Relecture, Visa juridique, Validation). Chaque étape est rattachée à l'habilitation exigée pour l'approuver. Une étape qui a des documents en attente ne peut pas être retirée.
- **Critères d'évaluation des titulaires** et leurs coefficients. Les évaluations déjà saisies gardent les critères de leur date.
- **Sécurité des accès** : durée d'inactivité avant déconnexion (15 minutes par défaut), nombre d'échecs avant verrouillage (5), durée du verrouillage (15 minutes), double authentification obligatoire pour les administrateurs (activée par défaut).

Chaque modification est tracée au journal.

## 3. Double authentification

À sa première connexion, un administrateur est conduit à l'écran « Ma sécurité » : il scanne le code QR avec une application d'authentification, puis confirme avec un code à 6 chiffres (capture 04). Il ne peut pas utiliser l'application tant que ce n'est pas fait. Les autres profils peuvent l'activer de la même façon.

## 4. Page d'accueil

**Page d'accueil et annonces** (capture 07) : les annonces qui défilent, avec une photo de la bibliothèque ou une photo déposée (et son crédit), les actualités de la collectivité et de l'outil, et les rubriques des onglets. Chaque élément peut être programmé (dates de publication), retiré ou réordonné.

## 5. Journal

**Journal des actions** : qui a fait quoi, quand, sur quel objet, avec quel résultat. Il est filtrable par texte, auteur et période, et exportable en CSV. La case « Journal de sécurité uniquement » ne garde que les connexions, les échecs, les verrouillages, la double authentification, les changements de comptes, d'habilitations et de paramètres, et les restaurations (capture 11). Le journal ne peut être ni modifié ni supprimé.

## 6. Reprise, export, sauvegarde

Menu **Reprise, export et sauvegarde**, carte **Plan de sauvegarde** :
- **Les échéances** de la version en ligne, avec leur fréquence, leur durée de conservation, leur lieu de stockage et leur chiffrement :

| Échéance | Fréquence | Conservée | Perte maximale si l'on y remonte |
|---|---|---|---|
| Courante | toutes les 3 h | 3 jours | 3 h |
| Quotidienne | chaque jour à 02:17 UTC (06:17 à La Réunion) | 30 jours | 24 h |
| Hebdomadaire | le dimanche à 02:17 UTC | 90 jours (maximum de GitHub pour un dépôt public) | 7 jours |
| Mensuelle | le premier dimanche du mois, **seulement si le secret `SAUVEGARDE_CLE` existe** (archive chiffrée en release GitHub) | 12 mois | 1 mois |

- **Sauvegarder maintenant** : en version locale, produit l'export complet (archive ZIP) à ranger hors du poste. En version en ligne, ouvre la page de l'action GitHub : « Run workflow », choisir l'échéance, confirmer (droits d'écriture sur le dépôt nécessaires). Environ une minute et demie.
- **Dernières sauvegardes** : celles inscrites au journal de l'application, et les liens vers les exécutions (artefacts) et les releases GitHub.

**Retrouver la sauvegarde d'un jour donné** : moins de 3 jours → courante ; 3 à 30 jours → quotidienne ; 30 à 90 jours → hebdomadaire ; au-delà → mensuelle. Sur la page des exécutions de l'action, prendre l'exécution réussie la plus proche avant la date voulue et télécharger l'artefact `sauvegarde-<échéance>-AAAAMMJJ-HHMM` (heure UTC, ajouter 4 h pour La Réunion).

**Restaurer** : en version locale, carte « Restaurer une sauvegarde » (archive ZIP). En version en ligne, la restauration se fait hors de l'application, par `node tests/restauration.mjs <dossier> --confirmer`.

À faire pour chiffrer : créer le secret de dépôt `SAUVEGARDE_CLE` (Settings → Secrets and variables → Actions), avec une phrase de passe longue conservée hors de GitHub. Sans lui, les artefacts sont en clair (admis seulement pour des données fictives) et aucune copie mensuelle n'est publiée.

Le détail (procédure pas à pas, RPO, RTO mesuré, limites) est dans `SAUVEGARDE-ET-REPRISE.md` ; les formats dans `FORMATS-ECHANGE.md`.

## 7. Demandes d'assistance

L'administrateur voit toutes les demandes de la collectivité et peut valider une clôture à la place du demandeur. Le profil « Support éditeur » est réservé à l'équipe de L'entreprise.ai : il prend en charge les demandes, communique le diagnostic, propose une solution, mais ne peut pas clore une demande à la place de la collectivité.
