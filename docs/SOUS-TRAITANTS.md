# vavang — sous-traitants, composants et services tiers

Version du prototype du 19 novembre 2026. Éditeur : l’entreprise.ai, Saint-Paul, La Réunion.

## 1. Synthèse

| Catégorie | Tiers | Traite des données de la collectivité ? | État |
|---|---|---|---|
| Hébergement de la base, de l’authentification et des fichiers | Supabase, région UE (Irlande) | Oui | **Prévu, non contractualisé** |
| Hébergement du site statique | Offre gratuite, prestataire non choisi | Non (fichiers de l’application seulement) | **Prévu, non contractualisé** |
| Bibliothèques embarquées | 7 bibliothèques libres (§ 3) | Non : elles s’exécutent dans le navigateur de l’agent | En place dans le prototype |
| Photos de la page d’accueil | Auteurs de Wikimedia Commons (§ 4) | Non | En place dans le prototype |
| Intelligence artificielle | Aucune | — | — |
| Mesure d’audience, publicité, polices web | Aucune | — | — |
| Envoi de courriels | Aucun | — | — |

Aujourd’hui, en mode local, **aucun tiers ne reçoit de données**. Tout reste dans le navigateur du poste.

## 2. Hébergement (mode hébergé)

### 2.1 Supabase — prévu, non contractualisé

- **Rôle** : base Postgres, authentification des comptes, stockage des pièces déposées, fonction serveur `gerer-compte`.
- **Localisation prévue** : région de l’Union européenne, Irlande.
- **Données concernées** : toutes les données de l’application (tables, pièces, journal), les comptes et leurs mots de passe.
- **État** : aucun projet créé, aucun contrat, aucune donnée transmise. Décision du 18 novembre 2026 : rien n’est engagé tant que le marché n’est pas obtenu.
- **Coût prévu** : offre payante de l’hébergeur, plus l’option de restauration à un instant donné nécessaire pour une perte de données maximale de 4 heures. Prix à confirmer.
- **À obtenir avant signature** : accord de traitement des données (article 28 du RGPD), liste des sous-traitants ultérieurs de Supabase, en particulier l’infrastructure en nuage sous-jacente, localisation effective des sauvegardes, garanties de chiffrement, certifications éventuelles. Rien de cela n’a encore été vérifié par l’entreprise.ai.

### 2.2 Site statique — prévu, non contractualisé

- **Rôle** : servir les fichiers HTML, CSS, JavaScript et images. Aucune donnée de la collectivité n’y est stockée.
- **Choix** : une offre gratuite d’hébergement de site statique. Le prestataire n’est pas choisi définitivement.
- **Critères de choix** : HTTPS, compression, localisation dans l’Union européenne si possible, absence de mesure d’audience imposée.
- **À noter** : le prestataire voit les adresses IP et les journaux d’accès des agents qui chargent l’application. Il sera ajouté à cette liste, avec sa localisation, une fois choisi.

### 2.3 Point d’attention

La fonction serveur `gerer-compte` importe son client depuis le site `esm.sh`. Avant tout déploiement, ce client sera embarqué ou figé à une version précise, pour ne dépendre d’aucun site tiers à l’exécution.

## 3. Bibliothèques embarquées

Elles sont copiées dans `vendor/` et servies avec l’application. Le navigateur ne les télécharge jamais depuis un site tiers. Elles ne transmettent aucune donnée. Versions lues dans `package-lock.json`.

| Bibliothèque | Version | Licence | Auteur ou projet | Rôle dans vavang |
|---|---|---|---|---|
| supabase-js | 2.119.0 | MIT | Supabase | Client du mode hébergé. Chargé seulement dans ce mode. |
| pdf.js (pdfjs-dist) | 3.11.174 | Apache 2.0 | Fondation Mozilla | Lecture du texte des PDF déposés. |
| pdfmake | 0.3.14 | MIT | Projet pdfmake | Export PDF (rapports, courriers, dossier d’audit). Polices Roboto embarquées, licence Apache 2.0. |
| docx | 9.15.4 | MIT | Projet docx | Export Word. |
| SheetJS (xlsx) | 0.18.5 | Apache 2.0 | SheetJS | Lecture des tableurs (reprise, bordereaux de prix), export XLSX. |
| JSZip | 3.10.2 | MIT ou GPL 3.0, au choix (utilisée sous MIT) | Stuart Knightley et contributeurs | Archive d’export complet, lecture des fichiers DOCX et ODT. Inclut pako, licence MIT. |
| qrcode-generator | 1.4.4 | MIT | Kazuhiko Arase | Code QR d’activation de la double authentification. |

Mises à jour prévues avant tout usage réel : SheetJS (version 0.20.2 ou plus, diffusée par SheetJS) et pdf.js (voir `NOTES-DE-VERSION.md`, anomalies connues).

Outil de développement, **non livré** : puppeteer-core 25.18.1 (Apache 2.0), qui pilote Chrome pour le scénario de test.

## 4. Photos

Quatre photos de La Réunion, issues de Wikimedia Commons, redimensionnées et servies avec l’application. Le crédit de l’auteur et la licence s’affichent avec chaque photo et sur la page « Crédits photographiques ». Détail dans `img/photos/CREDITS.md`.

| Photo | Auteur | Licence |
|---|---|---|
| Le Piton de la Fournaise vu du ciel | Pouyot | CC BY-SA 4.0 |
| Lever du soleil sur les remparts du Maïdo | Rémih | CC BY-SA 4.0 |
| Le Port vu du ciel | Ville du Port | CC BY-SA 4.0 |
| Le cirque de Mafate depuis le Grand Bénare | Mamphi | CC BY-SA 3.0 |

Aucun appel n’est fait à Wikimedia lors de l’affichage.

## 5. Ce que vavang n’utilise pas

- **Aucune intelligence artificielle** : pas de modèle local, pas d’appel à un service d’IA. Aucune donnée n’est transmise à un tel service.
- **Aucun service d’audience** : pas d’outil de statistiques, pas de cookie de mesure, pas de publicité.
- **Aucune police web externe**, aucun réseau de diffusion de contenu tiers.
- **Aucun service de courriel** : les notifications restent dans l’application.

## 6. Mise à jour de cette liste

Cette liste sera mise à jour, et communiquée à la collectivité, avant tout ajout ou changement de sous-traitant traitant ses données. Le premier ajout attendu est le prestataire d’hébergement du site statique.
