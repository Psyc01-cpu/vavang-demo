# vavang — coût d'hébergement en production

Étude du 19 novembre 2026. Montants **hors taxes, en euros**. Les chiffres sources, les URL et les calculs sont dans `mesures/couts-cloud.json`.

Taux de change utilisé pour les prix en dollars : **1 € = 1,1014 $** (Banque de France, 16/11/2026). Supabase et UptimeRobot facturent en dollars.

Ce qui n'a pas pu être vérifié sur la page officielle du fournisseur est marqué **« à vérifier »**.

## 1. Cas chiffré

Collectivité type : intercommunalité de 5 communes, 20 à 60 agents, environ 150 consultations par an, 5 à 20 Go de pièces par an.

| Hypothèse | Valeur retenue | Statut |
|---|---|---|
| Fichiers au bout de 3 ans (durée du marché) | 60 Go au plus | calcul : 3 × 20 Go |
| Taille de la base (35 tables, données en JSON) | moins de 2 Go | hypothèse, non mesurée |
| Données téléchargées par les agents | 100 Go par an | hypothèse |
| Courriels de notification | 1 500 par mois | hypothèse (60 agents) |
| Sauvegardes conservées 12 mois hors du fournisseur principal | 300 Go au plus | hypothèse haute |
| Perte de données maximale (RPO) | 4 h | exigence du CCTP 3.7.7 (`docs/SAUVEGARDE-ET-REPRISE.md`) |

## 2. Pourquoi la démo à 0 € ne suffit pas pour la production

La démo tourne sur l'offre gratuite de Supabase et sur GitHub Pages. Ces offres ne conviennent pas à une exploitation réelle :

- **Supabase Free** : un projet est mis en pause après une semaine d'inactivité ; pas de sauvegardes automatiques ; pas d'engagement de disponibilité ; 500 Mo de base et 1 Go de fichiers ; journaux conservés 1 jour. Source : https://supabase.com/pricing (consulté le 19/11/2026).
- **GitHub Pages** : pas d'engagement de disponibilité indiqué. GitHub précise que le service n'est pas fait pour servir d'hébergement gratuit à une activité commerciale. Limite de 100 Go de bande passante par mois, sans garantie. Source : https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits (consulté le 19/11/2026).
- Les sauvegardes de la démo passent par une tâche planifiée GitHub Actions, sans garantie d'horaire : GitHub indique que ces tâches peuvent être retardées, voire abandonnées, en période de forte charge. GitHub les désactive aussi après 60 jours sans activité sur un dépôt public. Sources : https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows et https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow (consultées le 19/11/2026).

## 3. Scénario A — Supabase Pro, région UE

L'application est déjà écrite et testée pour Supabase : c'est le scénario qui demande le moins de travail.

### 3.1 Prix relevés (19/11/2026)

| Élément | Prix | Source |
|---|---|---|
| Offre Pro (par organisation) | 25 $/mois, crédit de calcul de 10 $ inclus | supabase.com/pricing |
| Taille de calcul | Micro (1 Go) 10 $ · **Small (2 Go) 15 $** · Medium (4 Go) 60 $ · Large (8 Go) 110 $ par mois | docs « compute-and-disk » |
| Base | 8 Go inclus, puis 0,125 $/Go/mois | supabase.com/pricing |
| Fichiers | 100 Go inclus, puis 0,0213 $/Go/mois | supabase.com/pricing |
| Bande passante sortante | 250 Go inclus, puis 0,09 $/Go | supabase.com/pricing |
| Sauvegardes quotidiennes | incluses : 7 jours en Pro, 14 jours en Team, 30 jours en Enterprise. **Les fichiers déposés ne sont pas dans ces sauvegardes.** | docs « backups » |
| Restauration à un instant donné (PITR) | 100 $/mois (7 jours), 200 $ (14 jours), 400 $ (28 jours). Archivage du journal toutes les 2 minutes, donc perte maximale d'environ 2 minutes. | docs « point-in-time-recovery » et « backups » |
| Connexion SSO SAML des agents | incluse en Pro : 50 utilisateurs actifs par mois, puis 0,015 $ par utilisateur | supabase.com/pricing |
| Domaine personnalisé pour l'API | 10 $/mois par projet | supabase.com/pricing |
| Offre Team | 599 $/mois (SSO de la console d'administration, rapports SOC 2 et ISO 27001) | supabase.com/pricing |
| Régions UE | Irlande, Paris, Francfort, Stockholm (sur AWS) | docs « regions » |

Points à retenir :
- **Aucune offre Pro ou Team ne comporte d'engagement de disponibilité.** Supabase ne le propose qu'en Enterprise, sur devis.
- Taille de calcul retenue : **Small**. 2 Go de mémoire suffisent largement pour 60 agents. Micro (1 Go) est juste. Coût net : 15 $ − 10 $ de crédit = 5 $/mois.
- Pour 60 agents, le SSO SAML coûte environ 0,15 $/mois : l'offre Team n'est pas nécessaire pour lui.
- Les volumes de la collectivité type restent dans les quotas inclus (100 Go de fichiers, 250 Go sortants par mois). Il n'y a pas de dépassement à prévoir sur 3 ans.
- Taille de calcul minimale pour activer la PITR : la documentation officielle (page « backups », relue le 19/11/2026) indique que la PITR est disponible sur toutes les tailles de calcul ; un ancien article de blog Supabase disait au moins Small. La documentation fait foi. Small est retenu dans tous les cas.
- Région conseillée : **Paris (eu-west-3)**, au lieu de l'Irlande utilisée par la démo.
- Supabase est hébergé sur AWS, y compris dans les régions UE (docs « regions »). Supabase est une société américaine (non vérifié ici sur un document officiel). L'exposition aux lois extraterritoriales américaines est à présenter honnêtement à l'acheteur.

### 3.2 Pages statiques, domaine, certificat

- **Scaleway Object Storage + Edge Services Starter** (Paris) : 0,99 €/mois. Il comprend 100 Go de cache, la sortie sans frais et un certificat Let's Encrypt gratuit ; le domaine personnalisé est « facturé par Secret Manager » (montant **à vérifier**). Le pare-feu applicatif (WAF) est en option à 4 €/mois. Source : https://www.scaleway.com/en/pricing/network/
- Le stockage de l'application (quelques dizaines de Mo) est négligeable. Les 75 premiers Go sortants de chaque mois sont gratuits.
- **Cloudflare Pages** n'est pas retenu : le réseau est mondial, et la localisation des données dans l'UE (Data Localization Suite) est une option payante réservée aux clients Enterprise (https://developers.cloudflare.com/data-localization/, consulté le 19/11/2026).
- **Nom de domaine** : un sous-domaine de la collectivité ne coûte rien, c'est la solution à privilégier. Sinon, un .fr chez OVHcloud coûte 4,99 € HT la première année puis 7,79 € HT/an au renouvellement (https://www.ovhcloud.com/fr/domains/tld/, consulté le 19/11/2026).
- **Certificat** : Let's Encrypt, gratuit, chez Scaleway comme chez Supabase.

### 3.3 Deux variantes

- **A1 — sans PITR** : la perte maximale de 4 heures est tenue par nos propres sauvegardes. Un export complet de la base et des fichiers est fait toutes les 3 heures, comme aujourd'hui (`docs/SAUVEGARDE-ET-REPRISE.md`). En production, il est lancé depuis une petite instance Scaleway et non plus depuis GitHub Actions.
- **A2 — avec PITR 7 jours** : perte maximale d'environ 2 minutes pour la base, gérée par l'hébergeur. L'export toutes les 3 heures reste nécessaire pour les fichiers et pour la copie conservée 12 mois.

## 4. Scénario B — hébergement français

### 4.1 B1 — Scaleway (Paris), Supabase auto-hébergé

Supabase est un logiciel libre : sa pile (Postgres, authentification, API, stockage) s'installe sur une instance. Ce montage est **non testé** avec vavang. Il faut vérifier notamment la fonction serveur `gerer-compte` et la double authentification.

| Élément | Prix (Paris, 19/11/2026) | Source |
|---|---|---|
| Instance PRO2-XXS (2 vCPU, 8 Go) | 40,95 €/mois | scaleway.com/en/pricing/virtual-instances |
| Adresse IPv4 | 0,005 €/h, soit 3,65 €/mois | scaleway.com/en/pricing/network |
| Disque bloc 5K, 100 Go | 0,000130 €/Go/h, soit 9,49 €/mois | scaleway.com/en/pricing/storage |
| Stockage objet multi-zone (fichiers) | 0,01606 €/Go/mois ; une zone : 0,00803 € ; Glacier : 0,00246 € | scaleway.com/en/pricing/storage |
| Variante : base gérée DB-DEV-S | 0,0156 €/h (environ 11,39 €/mois), plus disque 0,0993 €/Go/mois et sauvegardes 0,03 €/Go/mois | scaleway.com/en/pricing/managed-databases |

- La compatibilité de la base gérée Scaleway avec Supabase auto-hébergé, qui exige des rôles et des extensions propres, est **à vérifier**. La PITR de cette base gérée n'est pas documentée dans ce que nous avons lu : **à vérifier**.
- Dans B1, nous devenons responsables des mises à jour du système, de Postgres et de Supabase, et de la PITR (archivage du journal vers le stockage objet). Le temps de maintenance double.
- L'engagement de disponibilité de l'instance est **à vérifier** sur la page SLA de Scaleway.

### 4.2 SecNumCloud

Selon le catalogue de l'ANSSI mis à jour le 18/11/2026 (§ 3.3, https://messervices.cyber.gouv.fr/visas/catalogue-produits-services-profils-de-protection-sites-certifies-qualifies-agrees-anssi.pdf) :
- **Scaleway et Clever Cloud ne figurent pas** parmi les services qualifiés SecNumCloud.
- Sont qualifiés, entre autres : OVH (SNC Cloud Platform, du 31/07/2026 au 31/07/2029 ; Bare Metal Pod ; Hosted Private Cloud powered by VMware, qualification jusqu'au 29/12/2026, renouvellement à vérifier), Outscale (IaaS Cloud on Demand, qualification jusqu'au 30/11/2026 ; renouvellement à vérifier), Cloud Temple, Orange Business Services (Cloud Avenue SecNum), Cegedim, Ecritel, Numspot, Worldline et S3NS (Thales).
- La qualification porte sur l'infrastructure. **vavang lui-même ne serait pas qualifié** pour autant.

**B2 — OVHcloud SNC Cloud Platform** (grille du 30/09/2026) : instance b3-8 (2 vCPU, 8 Go) à 66,67 €/mois ; disque 0,1047 €/Gio/mois ; stockage objet 0,0234 €/Gio/mois ; bloc d'adresses IPv4 /28 à 35,66 €/mois. Le **support Business est obligatoire** (« niveau de support minimum requis », grille SNC) : 10 % de la facture mensuelle, au minimum 250 € HT/mois (https://www.ovhcloud.com/fr/support-levels/business/, consulté le 19/11/2026). Le réseau privé sécurisé SPN coûte 1 120 €/mois ; la grille ne dit pas s'il est obligatoire : **à vérifier**. La nécessité du bloc IPv4 /28 (seule offre d'adresse IPv4 de la grille) est aussi **à vérifier**. Si le SPN est obligatoire, B2 passe à environ 18 000 €/an avant marge (22 480 € avec la marge de 25 %).

Pour une intercommunalité et ce type de données (marchés publics, sans données de santé ni données classifiées), nous n'avons pas identifié d'obligation générale d'hébergement SecNumCloud. **Non vérifié juridiquement.** À regarder au cas par cas, selon le CCTP.

## 5. Coûts annexes

| Poste | Choix | Coût | Source |
|---|---|---|---|
| Courriels de notification | Scaleway Transactional Email, Paris | 300 gratuits par mois, puis 0,25 € les 1 000. Pour 1 500 par mois : 0,30 €, budgété 1 €/mois. Engagement de disponibilité seulement avec l'offre Scale (80 €/mois, 99,9 %). | scaleway.com/en/pricing/managed-services |
| Supervision externe | UptimeRobot Solo (10 sondes, contrôle toutes les 60 s) | 9 $/mois en paiement annuel (108 $/an), soit 8,17 €/mois | uptimerobot.com/pricing |
| Sauvegardes conservées 12 mois hors du fournisseur principal | Stockage objet multi-zone Scaleway, 300 Go | 4,82 €/mois. Pour B1, la copie doit aller chez un autre fournisseur : prix **à vérifier**, ordre de grandeur comparable. | scaleway.com/en/pricing/storage |
| Tâche de sauvegarde (scénario A) | Instance DEV1-S + IPv4 + disque système | 6,55 € + 3,65 € = 10,20 €/mois, plus une provision de 0,95 €/mois pour un disque bloc 5K de 10 Go (besoin réel **à vérifier**). | scaleway.com/en/pricing/virtual-instances, /network, /storage |
| Test d'intrusion | Application web, 6 profils, API exposée, boîte grise | Ordres de grandeur 2026 (HT) : application simple à 1 rôle 4 000 à 6 000 € ; application métier à 2-3 rôles 6 000 à 10 000 € ; application avec API REST exposée 8 000 à 12 000 € (6 à 8 jours) ; test annuel suivant, architecture inchangée, 5 000 à 7 000 €. Taux journalier 900 à 1 200 € (non qualifié), 1 200 à 1 500 € (PASSI). **Budget retenu : 10 000 € avant ouverture, 7 000 € par an ensuite** (hypothèses : vavang a 6 profils et expose l'API Supabase). Source commerciale, à confirmer par devis. | kolonell.com (blog d'un prestataire, 01/10/2026) |
| Maintenance et MCO | voir § 6 | heures × **taux à fixer** | estimation de L'entreprise.ai |

L'outil UptimeRobot est américain. La supervision actuelle par GitHub Actions peut rester en complément gratuit.

## 6. Temps de maintenance estimé (à valoriser, taux à fixer)

| Tâche | A | B1 | B2 |
|---|---|---|---|
| **Mise en service** : projet, schéma, domaine, SSO, courriels, sauvegardes, exercice de restauration, documentation | 32 h | 48 h | 64 h |
| Mises à jour de sécurité (bibliothèques, client Supabase) : 2 h/mois | 24 h | 24 h | 24 h |
| Mises à jour du système, de Postgres et de Supabase auto-hébergé : 4 h/mois | — | 48 h | 48 h |
| Exercice de restauration trimestriel | 8 h | 8 h | 12 h |
| Supervision, incidents, contrôle des sauvegardes et des coûts | 18 h | 18 h | 28 h |
| Suivi des correctifs du test d'intrusion | 8 h | 8 h | 8 h |
| **Total récurrent par an** | **58 h** | **106 h** | **120 h** |

Ces heures sont des estimations, non mesurées.

## 7. Tableau récapitulatif

Coûts cloud et services, hors heures et hors test d'intrusion. Domaine .fr inclus (7,79 €/an, prix de renouvellement). Totaux recalculés le 19/11/2026 par la relecture contradictoire.

| Scénario | Par mois | Par an | Par an avec marge de 25 % | Perte maximale de données | Engagement de disponibilité |
|---|---|---|---|---|---|
| **A1** Supabase Pro, sans PITR | 62,45 € | 757,19 € | 946,49 € | 3 h, par nos exports | aucun |
| **A2** Supabase Pro, PITR 7 jours | 153,24 € | 1 846,67 € | **2 308,34 €** | environ 2 min (base), 3 h (fichiers) | aucun |
| **B1** Scaleway, Supabase auto-hébergé | 69,04 € | 836,27 € | 1 045,34 € | selon notre montage (non testé) | à vérifier |
| **B2** OVHcloud SNC (SecNumCloud), sans SPN | 378,19 € | 4 546,07 € | 5 682,59 € | selon notre montage (non testé) | à vérifier |

Détail ligne par ligne : `mesures/couts-cloud.json`, clé `scenarios`.

Pour chaque scénario s'ajoutent :
- à la mise en service (une fois) : les heures du § 6 × taux, et un **test d'intrusion avant ouverture (10 000 €, hypothèse)** ;
- chaque année : un **test d'intrusion annuel (7 000 €, hypothèse)**, à partir de la deuxième année, et les heures de MCO × taux.

## 8. Recommandation

**Scénario A2 : Supabase Pro, région Paris, calcul Small, PITR 7 jours**, avec les pages statiques et les sauvegardes conservées 12 mois chez Scaleway.
- C'est la configuration déjà écrite et testée sur la démo. Elle demande le moins de maintenance.
- La PITR tient l'exigence des 4 heures côté hébergeur, sans dépendre de notre tâche planifiée. Le surcoût est d'environ 1 090 €/an par rapport à A1.
- A1 reste possible si le prix doit baisser. La perte maximale de 3 heures repose alors entièrement sur nos exports.
- Si l'acheteur exige un hébergeur français, proposer **B1** en variante, après un essai réel du montage auto-hébergé. Il faut compter environ 50 h de maintenance de plus par an.
- Si l'acheteur exige SecNumCloud, proposer **B2** sur devis OVHcloud, ou un autre service du catalogue de l'ANSSI. Il faut confirmer le support et le réseau SPN avant de chiffrer.

**Marge de sécurité proposée : 25 %** sur les coûts cloud. Elle couvre :
- le change : environ 88 % du coût A2 est payé en dollars (135,28 € sur 153,24 € par mois). D'après la presse financière (Test-Achats, 12/11/2026, non vérifié), l'euro est passé sous 1,11 $ en novembre 2026, une première depuis avril 2025. Une baisse de 10 % de l'euro ajoute environ 10 % au coût ;
- des volumes plus élevés que prévu (base non mesurée, téléchargements) ;
- les hausses de tarif en cours de marché (les variations de prix d'UptimeRobot en 2026 citées par des comparatifs tiers sont non vérifiées) ;
- les postes encore « à vérifier ».

Pas de marge sur le test d'intrusion : il sera chiffré sur devis.

### Montant à intégrer au prix (scénario A2)

| | Montant HT |
|---|---|
| **Mise en service (une fois)** | 10 000 € (test d'intrusion avant ouverture, hypothèse) + 32 h × taux à fixer |
| **Récurrent annuel** | **2 310 €** d'hébergement et services (1 846,67 € + 25 % = 2 308,34 €, arrondi) + 7 000 € de test d'intrusion annuel (à partir de la 2ᵉ année, hypothèse) + 58 h × taux à fixer |

### Montants pour les autres scénarios (même méthode, HT)

| Scénario | Mise en service (une fois) | Récurrent annuel |
|---|---|---|
| A1 | 10 000 € + 32 h × taux | 950 € (946,49 € arrondi) + 7 000 € dès la 2ᵉ année + 58 h × taux |
| B1 | 10 000 € + 48 h × taux | 1 050 € (1 045,34 € arrondi) + 7 000 € dès la 2ᵉ année + 106 h × taux |
| B2 | 10 000 € + 64 h × taux | 5 690 € (5 682,59 € arrondi) + 7 000 € dès la 2ᵉ année + 120 h × taux ; environ 22 480 € si le SPN est obligatoire (à vérifier) |

Rien n'est souscrit à ce jour : aucun contrat, aucun projet payant (décision du 18/11/2026, `docs/SOUS-TRAITANTS.md`). Les prix sont à reconfirmer à la date de remise de l'offre.
