# vavang — procédure de support

Version du prototype du 19 novembre 2026. Éditeur : l’entreprise.ai, Saint-Paul, La Réunion.

Ce document décrit le support **prévu** pour l’exploitation de vavang. L’outil de déclaration existe et a été vérifié dans le prototype (mode local). L’organisation humaine décrite ici (horaires, astreinte, escalade) est l’**engagement prévu** : elle n’est pas encore en service, faute de collectivité utilisatrice. Aucun délai n’a encore été mesuré en conditions réelles.

## 1. Déclarer une demande

### 1.1 Dans l’application (voie normale)

Menu **Demandes d’assistance** → « Nouvelle demande » (`js/ecrans/support.js`, captures 52 et 53).

1. **Objet** : une phrase.
2. **Criticité** : P1 à P4 (voir § 2). Les définitions s’affichent dans le formulaire.
3. **Description** : écran concerné, ce que vous faisiez, ce qui s’est passé.
4. **Capture d’écran ou pièce jointe** si possible.
5. « Envoyer la demande ».

L’outil attribue un **numéro unique** (`T-AAAA-NNNN`), horodate la demande, enregistre le demandeur et son service, calcule les échéances de chaque délai et notifie l’équipe support.

Qui peut déclarer : gestionnaire, prescripteur, valideur, lecteur, administrateur. Chaque agent voit ses demandes. L’administrateur voit toutes celles de la collectivité.

### 1.2 Sans connexion : le guichet du support

Il n’y a **pas de ligne directe** (ni courriel ni téléphone du support). Si vous ne pouvez pas vous connecter, ou sans compte, passez par le **guichet** : page d’accueil, onglet « Échanges », « Contacter le support » (adresse `#/guichet`).

1. Choisissez le **type de panne** dans la grille (connexion, compte bloqué, écran en erreur, lenteur, fichiers, documents, analyse, droits, évolution, autre).
2. Écrivez votre **commentaire**, indiquez l’**urgence** (bloquant, gênant, sans urgence) et le **numéro où vous rappeler** (obligatoire), votre courriel si vous le souhaitez, et le créneau de rappel souhaité.
3. Un **accusé de réception** affiche le numéro de la demande, la date et l’heure du dépôt et le délai de prise en charge.

L’équipe support traite la demande et **rappelle** le demandeur aux horaires du guichet (du lundi au vendredi, de 8 h à 17 h, heure de La Réunion), ou contacte le référent de la collectivité. Chaque rappel est consigné dans la demande (« Rappel effectué » : date, heure, issue, compte rendu). Urgence → criticité : bloquant = P2, gênant = P3, sans urgence = P4 ; le support peut requalifier.

## 2. Criticités et délais

Délais repris de l’article 3.3.3 du CCTP et codés dans `Calcul.DELAIS_SUPPORT` (`js/calcul.js`).

| Criticité | Définition | Prise en charge | Diagnostic initial | Contournement | Rétablissement |
|---|---|---|---|---|---|
| **P1 — Critique** | Indisponibilité totale, perte de données, incident de sécurité majeur, fonction essentielle bloquée sans contournement | 1 heure | 2 heures | 4 heures | 8 heures |
| **P2 — Majeur** | Fonction essentielle en panne pour plusieurs utilisateurs, sans contournement acceptable | 4 heures ouvrées | 1 jour ouvré | 1 jour ouvré | 2 jours ouvrés |
| **P3 — Mineur** | Anomalie non bloquante, avec contournement | 1 jour ouvré | 3 jours ouvrés | sans objet | 5 jours ouvrés |
| **P4 — Demande** | Question, assistance, paramétrage, évolution | 1 jour ouvré | sans objet | sans objet | sans objet |

Règles de calcul :
- **P1** : heures continues, 24 h/24, 7 j/7.
- **P2 à P4** : heures ouvrées, du lundi au vendredi, de 8 h à 17 h, heure de La Réunion. Un jour ouvré compte 9 heures ouvrées.
- Pour chaque étape, l’outil affiche : avant l’échéance, respecté, dépassé, ou en retard.
- Limite connue : les jours fériés ne sont pas déduits par le calcul. Le support les déduit à la main.

Le support peut proposer de requalifier une criticité. Il l’écrit dans l’historique, avec le motif. Limite : l’outil ne permet pas encore de modifier la criticité enregistrée, ni les échéances calculées.

## 3. Heures de support

- **Support courant** : du lundi au vendredi, de 8 h à 17 h, heure de La Réunion.
- **Astreinte P1** : engagement prévu de traiter les P1 24 h/24, 7 j/7, dès la mise en service. Elle n’existe pas aujourd’hui. Ses modalités (numéro d’astreinte, rotation) seront communiquées à la collectivité avant la mise en service.

## 4. Traitement d’une demande

| Étape | Qui | Action dans l’outil | Statut |
|---|---|---|---|
| 1. Prise en charge | Support (niveau 1) | « Prendre en charge » : qualification, premier retour | Pris en charge |
| 2. Diagnostic initial | Support | « Communiquer le diagnostic » : causes probables, plan d’action | Diagnostic en cours |
| 3. Contournement (P1, P2) | Support | « Contournement en place » : solution temporaire | Contournement en place |
| 4. Résolution | Support | « Proposer la résolution » : solution apportée | Résolu, en attente de validation |
| 5. Clôture | **Collectivité** | « Valider et clore » avec un motif, ou « Le problème persiste » | Clos, ou retour en diagnostic |

Chaque action est datée, signée et notifiée à l’autre partie. Les échanges libres passent par « Ajouter un message ». Tout est conservé dans l’historique de la demande et au journal.

## 5. Escalade

Les niveaux désignent des **fonctions**. Le nom des titulaires est communiqué à la collectivité à la notification du marché, puis à chaque changement.

### 5.1 Côté l’entreprise.ai

| Niveau | Fonction | Rôle | Quand |
|---|---|---|---|
| **1** | Support applicatif (profil « Support éditeur ») | Prise en charge, qualification, réponses d’usage et de paramétrage, contournements connus | Toute demande |
| **2** | Responsable technique de la solution | Diagnostic approfondi, correction, restauration, lien avec l’hébergeur | Pas de solution au niveau 1 ; P1 dès la prise en charge ; délai de diagnostic menacé |
| **3** | Direction de l’entreprise.ai, responsable du contrat | Arbitrage, moyens supplémentaires, communication officielle, pénalités | P1 non rétabli dans les 8 heures ; délai dépassé en P2 ; incident de sécurité ; désaccord persistant |

### 5.2 Côté collectivité

| Niveau | Fonction |
|---|---|
| 1 | Agent demandeur |
| 2 | Administrateur fonctionnel de vavang |
| 3 | Responsable du marché à la collectivité |

La collectivité peut demander l’escalade à tout moment, par un message dans la demande. Le support y donne suite et l’écrit dans l’historique.

## 6. Pendant un P1

1. Prise en charge dans l’heure, escalade immédiate au niveau 2.
2. **Point d’avancement toutes les heures** à l’administrateur fonctionnel, jusqu’au rétablissement : état, actions en cours, prochaine échéance. Dans l’outil si possible, sinon par courriel ou téléphone.
3. Contournement visé sous 4 heures, rétablissement sous 8 heures.
4. Si une restauration est nécessaire : procédure de `SAUVEGARDE-ET-REPRISE.md`, § 3.
5. Incident de sécurité : information immédiate de la collectivité, qui garde la main sur ses propres obligations de notification.

## 7. Rapport d’incident

Pour chaque P1, et pour tout P2 si la collectivité le demande : rapport sous **5 jours ouvrés** après le rétablissement.

Contenu :
- chronologie horodatée, de la détection à la clôture ;
- cause identifiée ;
- impacts : utilisateurs, fonctions, données ;
- actions de correction ;
- mesures de prévention, avec une échéance ;
- respect ou non de chaque délai, d’après l’outil.

Le rapport est transmis par courriel à l’administrateur fonctionnel, et son envoi est noté dans l’historique de la demande. Limite : l’outil n’accepte des pièces jointes qu’à la création de la demande.

## 8. Clôture

- Le support **ne peut pas clore** une demande. Il propose une résolution.
- La clôture est **validée par la collectivité** : le demandeur, ou l’administrateur à sa place. Elle porte une date, un motif et le nom de la personne qui valide.
- « Le problème persiste » rouvre la demande, en diagnostic.
- Sans réponse de la collectivité, la demande peut être close **après relance**, à partir de 5 jours ouvrés après la proposition de résolution (CCTP 3.3.4). L’outil affiche cette date. La clôture tacite n’est pas automatique.

## 9. Limites actuelles

- Outil vérifié en mode local uniquement (scénario automatique). En mode local, support et collectivité doivent partager le même poste : l’outil ne devient utilisable à distance qu’en mode hébergé.
- Pas de déclaration par courriel ou par téléphone dans l’outil : la saisie est faite par le support.
- Jours fériés non déduits du calcul des délais.
- Pas de rapport mensuel de service automatique.
