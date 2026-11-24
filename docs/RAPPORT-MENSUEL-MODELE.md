# Rapport mensuel de service — modèle

> Modèle à remplir chaque mois. Les zones `[…]` sont à compléter ; toute valeur qui n'a pas pu être mesurée est écrite **« non mesuré »** et toute affirmation non contrôlée **« non vérifié »**. Sources indiquées pour chaque rubrique.

---

**Logiciel** : vavang — gestion des marchés publics côté acheteur
**Collectivité** : [nom de la collectivité]
**Éditeur** : L'entreprise.ai
**Période** : du [01/MM/AAAA] au [JJ/MM/AAAA]
**Rédigé le** : [JJ/MM/AAAA] — **par** : [fonction du rédacteur]
**Version en service à la fin du mois** : [x.y.z]

## 1. Synthèse

| Indicateur | Engagement | Mesuré | Respecté |
|---|---|---|---|
| Disponibilité du service (heures ouvrées) | [ex. 99,5 %] | [… %] | [oui / non] |
| Disponibilité du service (24 h/24) | [ex. 99 %] | [… %] | [oui / non] |
| Incidents bloquants | [0] | [n] | [oui / non] |
| Demandes d'assistance traitées dans les délais | [ex. 95 %] | [… %] | [oui / non] |
| Sauvegardes réussies | [100 %] | [n réussies / n prévues] | [oui / non] |
| Exercice de restauration | [1 par trimestre] | [fait le … / non fait] | [oui / non] |

Faits marquants du mois : [2 à 4 lignes].

## 2. Disponibilité mesurée

Source : `statut/historique.json` (contrôle toutes les 15 minutes, page d'état `statut.html`), voir `docs/SUPERVISION.md`.

| Service | Contrôles effectués | Contrôles réussis | Disponibilité | Temps de réponse moyen |
|---|---|---|---|---|
| Page de l'application | [n] | [n] | [… %] | [… ms] |
| API de données | [n] | [n] | [… %] | [… ms] |
| Authentification | [n] | [n] | [… %] | [… ms] |
| **Ensemble (3 services à 200)** | [n] | [n] | **[… %]** | — |

Contrôles prévus sur le mois : [jours × 96] ; contrôles effectués : [n] ; trous de mesure : [n] (une absence de mesure n'est comptée ni disponible ni indisponible).
Maintenances programmées (annoncées au moins [5 jours ouvrés] avant) : [date, durée, objet] ou « aucune ».

## 3. Incidents

| N° | Début | Fin | Durée | Services touchés | Gravité | Cause | Action corrective | Clos |
|---|---|---|---|---|---|---|---|---|
| [1] | [JJ/MM hh:mm] | [JJ/MM hh:mm] | [… min] | [API / page / auth] | [bloquant / majeur / mineur] | [cause établie ou « en cours d'analyse »] | [action] | [oui / non] |

Gravité : **bloquant** = service inaccessible ou perte de données ; **majeur** = fonction importante indisponible, contournement possible ; **mineur** = gêne sans blocage.
Incidents de sécurité : voir § 7.

## 4. Demandes d'assistance

Source : module Assistance (table `tickets`) et courriels reçus sur [adresse du support].

| Catégorie | Reçues | Clôturées | Délai de prise en charge — engagement | Délai de prise en charge — médian / max mesuré | Délai de résolution — engagement | Délai de résolution — médian / max mesuré | Hors délai |
|---|---|---|---|---|---|---|---|
| Bloquant | [n] | [n] | [ex. 2 h ouvrées] | [… / …] | [ex. 1 jour ouvré] | [… / …] | [n] |
| Majeur | [n] | [n] | [ex. 4 h ouvrées] | [… / …] | [ex. 3 jours ouvrés] | [… / …] | [n] |
| Mineur / question | [n] | [n] | [ex. 1 jour ouvré] | [… / …] | [ex. 5 jours ouvrés] | [… / …] | [n] |
| Demande d'évolution | [n] | [n] | [ex. réponse sous 10 jours ouvrés] | [… / …] | — | — | [n] |

Demandes hors délai : [n° de ticket, motif du dépassement]. Demandes encore ouvertes en fin de mois : [n] (la plus ancienne : [date]).
Heures ouvrées de référence : du lundi au vendredi, de 8 h à 17 h (heure de La Réunion), hors jours fériés.

## 5. Sauvegardes et restauration

Source : procédure `docs/SAUVEGARDE-ET-REPRISE.md` et journaux de sauvegarde.

| Type | Fréquence prévue | Prévues | Réussies | Échecs (date, cause, rattrapage) | Dernière sauvegarde réussie |
|---|---|---|---|---|---|
| Base de données | [quotidienne] | [n] | [n] | [… ou « aucun »] | [JJ/MM hh:mm] |
| Pièces déposées (stockage) | [quotidienne] | [n] | [n] | [… ou « aucun »] | [JJ/MM hh:mm] |
| Export de réversibilité | [mensuelle] | [1] | [0 / 1] | [… ] | [JJ/MM] |

**Exercice de restauration** : [fait le JJ/MM / non fait ce mois]. Périmètre restauré : [base complète / un dossier]. Durée mesurée : [… min] (objectif de reprise : [… h]). Perte de données constatée : [aucune / …] (objectif de perte maximale : [… h]). Contrôles après restauration : [nombre de dossiers, pièces, entrées du journal comparés]. Résultat : [conforme / écarts : …].

## 6. Évolutions livrées

| Version | Date de mise en service | Contenu | Demandée par | Notes de version |
|---|---|---|---|---|
| [x.y.z] | [JJ/MM] | [résumé] | [collectivité / éditeur / correctif] | `docs/NOTES-DE-VERSION.md` |

Correctifs de sécurité appliqués (bibliothèques, hébergeur) : [liste ou « aucun »].
Évolutions prévues le mois prochain : [liste].

## 7. Sécurité

Sources : journal de sécurité de l'application, écran Administration > Sécurité, alertes de l'hébergeur.

| Indicateur | Valeur du mois |
|---|---|
| Connexions réussies | [n] |
| Échecs de connexion | [n] |
| Comptes verrouillés après échecs | [n] (dont déverrouillés par l'administrateur : [n]) |
| Comptes administrateurs sans double authentification | [0 attendu] |
| Comptes créés / désactivés | [n] / [n] |
| Révocations de sessions | [n] |
| Revue des habilitations faite | [oui le JJ/MM / non] |
| Incidents de sécurité (accès non autorisé, fuite, compromission) | [aucun / description, date de notification à la collectivité, notification CNIL le cas échéant] |
| Vulnérabilités signalées / corrigées | [n] / [n] |
| Sous-traitants modifiés | [aucun / voir `docs/SOUS-TRAITANTS.md`] |

## 8. Pénalités et actions

Engagements non respectés ce mois : [liste ou « aucun »]. Pénalités applicables selon le contrat : [montant ou « sans objet »].
Plan d'action : [action, responsable (fonction), échéance].

## 9. Annexes

- Export de la page d'état au dernier jour du mois (`statut.html`) ou extrait de `statut/historique.json`.
- Liste des tickets du mois (export du module Assistance).
- Compte rendu de l'exercice de restauration.

---

*Ce modèle décrit ce qui peut être mesuré avec l'outillage actuel : disponibilité et incidents (supervision automatique), tickets (module Assistance), sécurité (journal). Les sauvegardes et la restauration sont renseignées à partir de la procédure, sans relevé automatique à ce jour. Les engagements chiffrés entre crochets sont des exemples à remplacer par ceux du contrat.*
