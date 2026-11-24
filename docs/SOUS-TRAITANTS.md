# vavang — sous-traitants, composants et services tiers

Version du 24 novembre 2026. Éditeur : L’entreprise.ai, Saint-Paul, La Réunion.

Deux environnements sont à distinguer : la **démonstration en ligne** (données fictives, remises à zéro chaque nuit) et l’**instance de production** d’une collectivité, installation séparée créée au déploiement. Aucun client n’est en exploitation à ce jour : aucun contrat d’hébergement de production n’est souscrit.

## 1. Synthèse

| Catégorie | Démonstration en ligne (aujourd’hui) | Instance de production d’une collectivité (prévu) | Données de la collectivité ? |
|---|---|---|---|
| Base de données, authentification, stockage des pièces | Supabase, offre gratuite, région UE (Irlande) | Supabase, offre payante, région de l’Union européenne (Paris prévue) ; contrat souscrit à la notification du marché | Oui, toutes |
| Pages de l’application (fichiers statiques) | GitHub Pages | Scaleway, France (Paris) ; contrat souscrit à la notification | Non (adresses IP des agents dans les journaux d’accès) |
| Sauvegardes | Artefacts GitHub Actions, en clair (données fictives) | Serveur et stockage Scaleway, France (Paris), sauvegardes chiffrées (AES-256-GCM) | Oui, chiffrées |
| Messagerie de support (réception des demandes par courriel) | IONOS (adresse contact@lentreprise.ai) | Idem ; localisation des serveurs à confirmer dans l’UE avant signature | Oui (contenu des courriels des agents) |
| Bibliothèques embarquées | 7 bibliothèques libres (§ 3) | Idem | Non : elles s’exécutent dans le navigateur de l’agent |
| Photos de la page d’accueil | Auteurs de Wikimedia Commons (§ 4) | Idem | Non |
| Intelligence artificielle, mesure d’audience, publicité, polices web | Aucune | Aucune | — |
| Envoi automatique de courriels par l’application | Aucun | Aucun | — |

En mode local (démonstration sur poste), **aucun tiers ne reçoit de données** : tout reste dans le navigateur du poste.

## 2. Hébergement de l’instance de production

### 2.1 Supabase — prévu, contrat à la notification

- **Rôle** : base Postgres, authentification des comptes, stockage des pièces déposées, fonction serveur `gerer-compte`.
- **Localisation prévue** : région de l’Union européenne (Paris prévue). La démonstration utilise aujourd’hui la région Irlande.
- **Données concernées** : toutes les données de l’application (tables, pièces, journal), les comptes et leurs mots de passe.
- **État** : la démonstration en ligne fonctionne sur un projet Supabase gratuit (données fictives). Pour la production, aucun contrat n’est souscrit à ce jour : il le sera à la notification d’un marché.
- **Coût** : offre payante de l’hébergeur, avec l’option de restauration à un instant donné.
- **À obtenir avant la mise en production** : accord de traitement des données (article 28 du RGPD), liste des sous-traitants ultérieurs de Supabase, en particulier l’infrastructure en nuage sous-jacente (Amazon Web Services), lieux d’accès du support de Supabase et garanties applicables, garanties de chiffrement, certificat ISO/IEC 27001 et rapport SOC 2 Type II (ou preuves équivalentes). Ces éléments seront remis à la collectivité.
- **Certifications déclarées** (relevé du 24/11/2026) : Supabase annonce un rapport **SOC 2 Type II** (évaluation annuelle) et une certification **ISO/IEC 27001:2022** (annonce d'avril 2026, périmètre : base de données, authentification, stockage, fonctions, API). Le rapport et le certificat ne sont téléchargeables qu'à partir des offres Team et Enterprise. Sources : https://supabase.com/docs/guides/security/soc-2-compliance et https://supabase.com/blog/supabase-is-now-iso-27001-certified.
- **Redondance** : offre Pro = une instance de base unique, sans bascule automatique sur une seconde instance ; la redondance repose sur la restauration à un instant donné (7 jours) et sur les exports chiffrés conservés chez Scaleway, restaurables sur une nouvelle instance dans une autre région de l'Union européenne (Francfort ou Irlande). Supabase est une société basée aux États-Unis : aucun transfert de données hors de l’EEE n’est prévu, et tout accès depuis un pays hors EEE serait soumis à l’autorisation préalable de la collectivité.

### 2.2 Scaleway — pages de l’application et sauvegardes, prévu

- **Rôle** : servir les fichiers HTML, CSS, JavaScript et images ; héberger le serveur qui lance les sauvegardes et stocker les sauvegardes chiffrées, hors de l’hébergeur principal.
- **Localisation prévue** : France (Paris).
- **Données concernées** : pages : aucune donnée de la collectivité, mais le prestataire voit les adresses IP et les journaux d’accès des agents ; sauvegardes : toutes les données, chiffrées avant de quitter le serveur.
- **Certifications déclarées** (relevé du 24/11/2026, annuaire de l'organisme certificateur BSI) : **ISO/IEC 27001:2022** (certificat IS 787020, sites de Paris) et **HDS** (certificat 809731). La date d'échéance affichée pour l'ISO 27001 (05/12/2026) est à revérifier avant signature. Qualification SecNumCloud : en cours d'évaluation selon Scaleway, non obtenue.
- **Redondance** : stockage objet de classe Standard Multi-AZ (données réparties sur plusieurs zones de disponibilité de la région Paris), verrouillage des objets en mode conformité pour les sauvegardes.
- **État** : recommandation de `COUT-HEBERGEMENT.md` ; aucun contrat souscrit à ce jour.

### 2.3 Messagerie de support

- **Rôle** : réception des demandes envoyées par courriel ; le support les enregistre dans l’outil de demandes.
- **Prestataire** : IONOS (serveurs de messagerie `mx00.ionos.fr` et `mx01.ionos.fr`, relevés le 24/11/2026). Localisation exacte des serveurs : **à confirmer** dans l’Union européenne avant signature.

### 2.4 Point d’attention

La fonction serveur `gerer-compte` importe son client depuis le site `esm.sh`. Avant la mise en production, ce client sera embarqué ou figé à une version précise, pour ne dépendre d’aucun site tiers à l’exécution.

## 3. Bibliothèques embarquées

Elles sont copiées dans `vendor/` et servies avec l’application. Le navigateur ne les télécharge jamais depuis un site tiers. Elles ne transmettent aucune donnée. Versions lues dans `package-lock.json`.

| Bibliothèque | Version | Licence | Auteur ou projet | Rôle dans vavang |
|---|---|---|---|---|
| supabase-js | 2.119.0 | MIT | Supabase | Client du mode hébergé. Chargé seulement dans ce mode. |
| pdf.js (pdfjs-dist) | 3.11.174 | Apache 2.0 | Fondation Mozilla | Lecture du texte des PDF déposés. |
| pdfmake | 0.3.14 | MIT | Projet pdfmake | Export PDF (rapports, courriers, dossier d’audit). Polices Roboto embarquées, licence Apache 2.0. |
| docx | 9.15.4 | MIT | Projet docx | Export Word. |
| SheetJS (xlsx) | 0.20.3 (diffusée par SheetJS) | Apache 2.0 | SheetJS | Lecture des tableurs (reprise, bordereaux de prix), export XLSX. |
| JSZip | 3.10.2 | MIT ou GPL 3.0, au choix (utilisée sous MIT) | Stuart Knightley et contributeurs | Archive d’export complet, lecture des fichiers DOCX et ODT. Inclut pako, licence MIT. |
| qrcode-generator | 1.4.4 | MIT | Kazuhiko Arase | Code QR d’activation de la double authentification. |

Mise à jour prévue : pdf.js en version 4 (la faille CVE-2024-4367 est déjà neutralisée ; voir `NOTES-DE-VERSION.md`, anomalies connues).

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
- **Aucun envoi automatique de courriel par l’application** : les notifications restent dans l’application. Les demandes de support reçues par courriel arrivent dans la messagerie de L’entreprise.ai (§ 2.3).

## 6. Mise à jour de cette liste

Cette liste sera mise à jour, et communiquée à la collectivité, avant tout ajout ou changement de sous-traitant traitant ses données. Les contrats de production (Supabase, Scaleway) seront souscrits à la notification d’un marché ; la liste à jour, avec les accords de traitement, sera alors remise à la collectivité.
