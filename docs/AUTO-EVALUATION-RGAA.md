# vavang — auto-évaluation RGAA 4.1

État au 19 novembre 2026. **Auto-évaluation** menée par l'éditeur, et non audit de conformité par un auditeur indépendant. Elle ne vaut pas déclaration d'accessibilité.

## 1. Périmètre et méthode

**Échantillon** (mode démonstration locale, données fictives, Chrome 1366 × 900) :

| Page | Adresse | Profil |
|---|---|---|
| Accueil public | `#/` | non connecté |
| Connexion (formulaire de la page d'accueil) | `#/` | non connecté |
| Tableau de bord | `#/` | gestionnaire |
| Analyse des offres, saisie des notes | `#/consultation/c1/analyse?vue=notation` | gestionnaire |
| Analyse des offres, synthèse et classement | `#/consultation/c1/analyse?vue=synthese` | gestionnaire |
| Paramètres | `#/parametres` | administrateur |

**Sources de chaque statut** :
- **audit automatique** axe-core 4.10.2 (règles WCAG 2.1 A et AA, `tests/accessibilite.mjs`, `mesures/accessibilite.json`) : 0 violation sur 11 écrans, dont les 6 de l'échantillon ;
- **vérifications par script** (puppeteer, mode local, exécutées le 19/11/2026) : langue, titre de page, hiérarchie des titres, zones (header, nav, main, footer), images et alternatives, liens et boutons sans intitulé, étiquettes et `autocomplete` des champs, tableaux, 50 tabulations par page avec contrôle du contour de focus, zoom 200 % (fenêtre de 683 px CSS), affichage à 320 px de large, espacement du texte (critère 10.12), comportement d'une fenêtre modale au clavier, titre de la page après changement d'écran ;
- **lecture du code** des écrans (`js/noyau.js`, `js/ecrans/base.js`, `accueil.js`, `analyse.js`, `securite.js`, `css/app.css`) ;
- **calcul de contraste** (formule WCAG) pour les éléments non textuels.

**Non testé** : aucune restitution avec un lecteur d'écran réel (NVDA, JAWS, VoiceOver). Les critères qui en dépendent sont jugés sur le code et le notent. Aucun validateur HTML (W3C) n'a été lancé. Les documents téléchargeables (DOCX, PDF, XLSX générés) n'ont pas été examinés.

**Agrégation** : un critère est **NC** s'il est non conforme sur au moins une page de l'échantillon, **C** s'il est conforme sur toutes les pages où il s'applique, **NA** s'il ne s'applique à aucune. Les critères **NT** (non testés) sont exclus du calcul et signalés à part.

## 2. Résultat

| | Nombre |
|---|---|
| Conformes (C) | **44** |
| Non conformes (NC) | **18** |
| Non applicables (NA) | 39 |
| Non testés (NT) | 5 |
| Total | 106 |

**Taux de conformité (méthode RGAA : critères conformes / critères applicables) : 44 / 62 = 71,0 %.**

Fourchette si l'on intègre les 5 critères non testés : de 65,7 % (tous non conformes, 44 / 67) à 73,1 % (tous conformes, 49 / 67). Le taux par page (moyenne des taux de chaque page) n'a pas été calculé.

En l'état, la mention possible serait « **partiellement conforme** » (taux entre 50 % et 100 %), sous réserve d'un audit réel.

## 3. Non-conformités et corrections proposées

| Critère | Constat (mesuré ou lu dans le code) | Correction proposée |
|---|---|---|
| 3.3 | Bordure des champs `#a9a495` : contraste 2,49:1 sur blanc, 2,21:1 sur crème. Contour de focus braise `#E8871E` : 2,65:1 sur blanc, 2,35:1 sur crème (3,01:1 sur le menu vert). Seuil : 3:1. | Bordure des champs vers `#8a8577` ou plus foncé ; contour de focus en `--braise-fonce` (`#A85A07`) ou double contour. |
| 5.4, 5.5 | Tableaux de données sans `caption` ; l'intitulé visible (h2) n'est pas associé ; la zone défilante porte le nom générique « Tableau ». | Passer `legende` à `U.tableau` partout (crée le `caption` et nomme la zone). |
| 5.6 | Les en-têtes de ligne (nom du candidat, de la consultation) sont des `td`. | Option `entete: true` sur la première colonne pour produire `th scope="row"`. |
| 7.1 | Onglets `role="tab"` sans `tabpanel` ni `aria-controls`, sans flèches clavier. Fenêtre modale : le focus n'y entre pas quand elle ne contient aucun champ, la tabulation en sort (6 tabulations sur 6 hors de la fenêtre lors de l'essai), le focus ne revient pas au bouton d'origine à la fermeture. | Soit retirer les rôles d'onglet (boutons simples avec `aria-current`), soit appliquer le motif ARIA complet. Modale : focus sur le titre à l'ouverture, boucle de tabulation, retour au déclencheur. |
| 8.2 | Page d'accueil : un `main` (`.accueil-corps`) imbriqué dans `main#contenu`, ce qui est invalide en HTML. Validateur W3C non lancé : d'autres erreurs sont possibles. | Remplacer le `main` intérieur par un `div`. |
| 8.6 | Le titre de la page reste « vavang — gestion des marchés publics » sur tous les écrans (vérifié sur 4 écrans). | Mettre à jour `document.title` dans `U.rafraichir` avec le titre de l'écran. |
| 9.1 | Page d'accueil sans titre `h1` ; saisie des notes : passage de `h1` à `h3`. | Ajouter un `h1` sur l'accueil ; titres de critère en `h2`. |
| 9.2 | `main` en double sur l'accueil (cf. 8.2). | Idem 8.2. |
| 9.3 | Le menu principal est une suite de liens sans liste `ul`/`li`. | Structurer chaque groupe du menu en liste. |
| 10.11 | À 320 px de large, défilement horizontal : 484 à 624 px de contenu sur les pages connectées (menu latéral fixe) ; 324 px sur l'accueil (frise). | Menu repliable sous 700 px, grilles en une colonne. |
| 11.5, 11.6 | Saisie des notes : les 5 champs de chaque critère ne sont pas regroupés (`fieldset`/`legend` ou `role="group"` nommé) ; plusieurs champs portent la même étiquette « Note sur 10 ». | Un `fieldset` par critère, `legend` = intitulé du critère. |
| 11.10 | Le caractère obligatoire est indiqué par « * » (et l'attribut `required`), mais le sens de l'astérisque n'est expliqué nulle part dans la page. | Phrase « Les champs marqués * sont obligatoires » en tête de formulaire. |
| 11.13 | Connexion : champs adresse et mot de passe sans `autocomplete` (`username`, `current-password`). | Ajouter les attributs. |
| 12.1 | Un seul système de navigation (menu) : ni plan du site, ni moteur de recherche global. | Page « Plan du site » reliée dans le pied de page, ou recherche globale. |
| 12.8 | Ordre de tabulation incohérent avec une fenêtre modale ouverte (cf. 7.1). | Idem 7.1. |
| 13.1 | Déconnexion automatique après 15 minutes d'inactivité, sans avertissement ni possibilité de prolonger. | Avertir 2 minutes avant, bouton « Rester connecté ». |

## 4. Grille critère par critère

Statuts : C conforme, NC non conforme, NA non applicable, NT non testé.

### 1. Images
| Critère | Statut | Justification |
|---|---|---|
| 1.1 Image porteuse d'information : alternative | C | Logo de la collectivité : `alt="Logo — CINOR"` ; code QR de démonstration `role="img"` avec `aria-label` (lecture du code). |
| 1.2 Image de décoration ignorée | C | Logo vavang `alt=""` à côté de son nom en texte ; photos d'accueil en image de fond CSS. 0 `svg` sans statut. |
| 1.3 Alternative pertinente | C | « Logo — CINOR » dans un lien « Accueil — CINOR ». |
| 1.4 CAPTCHA ou image-test | NA | Aucun CAPTCHA. |
| 1.5 CAPTCHA : autre accès | NA | Aucun CAPTCHA. |
| 1.6 Description détaillée | NA | Aucune image complexe (graphique, schéma) dans l'échantillon. |
| 1.7 Description détaillée pertinente | NA | Idem 1.6. |
| 1.8 Image texte | C | Seul le logo de la collectivité contient du texte (logotype, exempté). |
| 1.9 Légende d'image | NA | Aucune image légendée dans l'échantillon (crédits photos sur une page à part). |

### 2. Cadres
| Critère | Statut | Justification |
|---|---|---|
| 2.1 Cadre titré | NA | Aucun `iframe` dans l'échantillon (la visionneuse PDF n'en fait pas partie). |
| 2.2 Titre de cadre pertinent | NA | Idem. |

### 3. Couleurs
| Critère | Statut | Justification |
|---|---|---|
| 3.1 Information pas donnée par la couleur seule | C | États (badges) et alertes portent un texte ; liens soulignés. |
| 3.2 Contraste du texte | NT | axe-core : 0 erreur de contraste sur 11 écrans. Mais le texte posé sur les photos du carrousel d'accueil n'est pas mesurable par axe-core et n'a pas été mesuré. |
| 3.3 Contraste des composants (3:1) | NC | Bordure des champs 2,49:1 ; contour de focus 2,35 à 2,65:1 sur fonds clairs (calcul). |

### 4. Multimédia
| Critère | Statut | Justification |
|---|---|---|
| 4.1 à 4.13 (13 critères) | NA | Aucun média temporel (vidéo, son) ni non temporel (`object`, `embed`, `canvas`) : 0 relevé par script sur les 6 pages. |

### 5. Tableaux
| Critère | Statut | Justification |
|---|---|---|
| 5.1 Tableau complexe : résumé | NA | Tableaux à une seule ligne d'en-têtes : tableaux simples. |
| 5.2 Résumé pertinent | NA | Idem. |
| 5.3 Tableau de mise en forme linéarisable | NA | Aucun tableau de mise en forme. |
| 5.4 Titre associé | NC | Aucun `caption` (tableau de bord : 2 tableaux, synthèse : 2, paramètres : 2) ; l'intitulé h2 qui précède n'est pas associé. |
| 5.5 Titre pertinent | NC | La zone qui contient le tableau est nommée « Tableau », sans précision. |
| 5.6 En-têtes déclarés | NC | En-têtes de colonne : `th scope="col"` (100 %). En-têtes de ligne en `td`. |
| 5.7 Technique d'association | C | `scope="col"` sur tous les `th`. |
| 5.8 Tableau de mise en forme sans éléments de données | NA | Aucun tableau de mise en forme. |

### 6. Liens
| Critère | Statut | Justification |
|---|---|---|
| 6.1 Lien explicite | C | Intitulés relevés par script (alertes, menu, actualités), explicites seuls ou par leur contexte (cellule, carte). « En savoir plus → » est placé dans la carte de son annonce. |
| 6.2 Lien avec intitulé | C | 0 lien sans intitulé sur les 6 pages. |

### 7. Scripts
| Critère | Statut | Justification |
|---|---|---|
| 7.1 Compatible avec les technologies d'assistance | NC | Onglets ARIA incomplets (4 sur l'accueil, 10 à 12 sur l'analyse, 0 `tabpanel`) ; modale sans gestion du focus (essai par script). Restitution par lecteur d'écran non testée. |
| 7.2 Alternative au script | NA | Application qui exige JavaScript ; pas d'alternative prévue ni requise par ce critère. |
| 7.3 Contrôlable au clavier | C | 50 tabulations par page sans élément inatteignable relevé ; lignes cliquables avec `tabindex` et touche Entrée (code) ; carrousel avec boutons précédent, suivant et pause. |
| 7.4 Changement de contexte annoncé | C | Aucun changement de contexte sans action explicite (code). |
| 7.5 Messages de statut | C | Zone `role="status" aria-live="polite"` pour les messages ; erreurs de formulaire en `role="alert"` (code). Restitution vocale non testée. |

### 8. Éléments obligatoires
| Critère | Statut | Justification |
|---|---|---|
| 8.1 Type de document | C | `<!doctype html>`. |
| 8.2 Code valide | NC | `main` imbriqué dans `main` sur l'accueil. Validateur W3C non lancé. |
| 8.3 Langue par défaut | C | `lang="fr"`. |
| 8.4 Langue pertinente | C | Contenu en français. |
| 8.5 Titre de page | C | `title` présent. |
| 8.6 Titre pertinent | NC | Titre identique sur tous les écrans (4 vérifiés). |
| 8.7 Changement de langue | C | Aucun passage en langue étrangère relevé à la lecture des 6 pages (relecture non exhaustive) ; « vavang » est un nom de produit. |
| 8.8 Code de langue valide | C | `fr`. |
| 8.9 Balises pas utilisées pour la présentation | C | Pas d'usage détourné relevé (code). |
| 8.10 Sens de lecture | NA | Aucun texte de droite à gauche. |

### 9. Structuration
| Critère | Statut | Justification |
|---|---|---|
| 9.1 Titres | NC | Accueil sans `h1` ; saisie des notes : `h1` puis `h3`. Autres pages : hiérarchie correcte. |
| 9.2 Structure du document | NC | Accueil : 1 `header`, 1 `nav`, **2 `main`**, 1 `footer`. Pages connectées : `nav` et `main` uniques. |
| 9.3 Listes | NC | Menu principal (17 liens au plus) sans structure de liste. |
| 9.4 Citations | NA | Aucune citation. |

### 10. Présentation
| Critère | Statut | Justification |
|---|---|---|
| 10.1 Présentation par CSS | C | Feuilles de style `app.css` et `accueil.css` ; attributs `style` limités au positionnement. |
| 10.2 Contenu visible sans CSS | NT | Non testé (désactivation des styles). |
| 10.3 Information compréhensible sans CSS | NT | Non testé. |
| 10.4 Texte agrandi à 200 % | C | Fenêtre de 683 px CSS (zoom 200 %) : aucun défilement horizontal sur les 6 pages ; 0 texte coupé. |
| 10.5 Couleurs de fond et de texte déclarées ensemble | C | `body` : `color` et `background` déclarés (`app.css`). |
| 10.6 Liens visibles dans le texte | C | Liens soulignés par défaut et colorés. |
| 10.7 Focus visible | C | `:focus-visible` : contour de 3 px ; contour présent sur 100 % des éléments atteints (environ 300 tabulations) ; champ de date : surlignage natif. Contraste du contour traité en 3.3. |
| 10.8 Contenus cachés | C | Attribut `hidden` pour l'aide de connexion et le champ de code (code). |
| 10.9 Information pas donnée par la forme ou la position seule | C | Rien de tel relevé. |
| 10.10 Idem, implémentation | C | Idem. |
| 10.11 Reflow à 320 px | NC | Défilement horizontal à 320 px : 324 (accueil), 624 (tableau de bord), 484 et 536 (analyse), 538 (paramètres) px de contenu. |
| 10.12 Espacement du texte | C | Interligne 1,5, lettres 0,12 em, mots 0,16 em, paragraphes 2 em : 0 texte coupé (script, 6 pages). |
| 10.13 Contenus au survol ou au focus | NA | Aucun contenu additionnel au survol autre que l'info-bulle native `title`. |
| 10.14 Contenus révélés par CSS au survol | NA | Aucun. |

### 11. Formulaires
| Critère | Statut | Justification |
|---|---|---|
| 11.1 Étiquette | C | Tous les champs visibles ont une étiquette reliée (`label for`) ; axe-core : 0 erreur. |
| 11.2 Étiquette pertinente | C | Étiquettes explicites ; la répétition de « Note sur 10 » relève de 11.5 et 11.6. |
| 11.3 Étiquettes cohérentes | C | Mêmes étiquettes pour les mêmes fonctions. |
| 11.4 Étiquette accolée | C | Étiquette au-dessus du champ (`.champ`). |
| 11.5 Champs regroupés | NC | Saisie des notes : 4 critères × 5 champs sans regroupement ; 0 `fieldset` dans l'application. |
| 11.6 Regroupement avec légende | NC | Aucune légende de regroupement. |
| 11.7 Légende pertinente | NA | Aucune légende (cf. 11.6). |
| 11.8 Options de liste regroupées | NA | Pas de liste d'options à regrouper dans l'échantillon. |
| 11.9 Intitulé de bouton pertinent | C | 0 bouton sans intitulé ; boutons à symbole du carrousel nommés par `aria-label`. |
| 11.10 Contrôle de saisie | NC | Obligation signalée par « * » sans explication ; messages d'erreur explicites et nommant le champ, focus sur le champ (code). |
| 11.11 Suggestions de correction | C | Ex. « La note doit être comprise entre 0 et 10 ». |
| 11.12 Données juridiques ou financières : contrôle | C | Notes en brouillon puis proposées, validation par un tiers ; suppression précédée d'une confirmation (code). |
| 11.13 Remplissage automatique | NC | Connexion : `autocomplete` absent sur l'adresse et le mot de passe (présent sur le code TOTP). |

### 12. Navigation
| Critère | Statut | Justification |
|---|---|---|
| 12.1 Deux systèmes de navigation | NC | Menu seul ; fil d'Ariane, mais ni plan du site ni recherche globale. |
| 12.2 Menu à la même place | C | Menu latéral identique sur toutes les pages connectées. |
| 12.3 Plan du site pertinent | NA | Pas de plan du site. |
| 12.4 Plan du site atteignable | NA | Idem. |
| 12.5 Moteur de recherche atteignable | NA | Pas de moteur de recherche global. |
| 12.6 Zones identifiables ou évitables | C | `header`, `nav` nommée « Menu principal », `main`, `footer` (accueil) ; lien d'évitement. |
| 12.7 Lien d'évitement | C | « Aller au contenu », premier élément tabulable, vers `main#contenu` (`tabindex="-1"`). |
| 12.8 Ordre de tabulation cohérent | NC | Ordre logique sur les pages ; incohérent dès qu'une fenêtre modale est ouverte (essai). |
| 12.9 Pas de piège au clavier | C | 0 piège sur 50 tabulations par page ; Échap ferme les fenêtres. |
| 12.10 Raccourcis à une touche | NA | Aucun raccourci à une touche (code : seules Échap et Entrée sont utilisées). |
| 12.11 Contenus additionnels atteignables au clavier | C | Aide à la connexion et fenêtres ouvertes par des boutons. |

### 13. Consultation
| Critère | Statut | Justification |
|---|---|---|
| 13.1 Limite de temps contrôlable | NC | Déconnexion après 15 minutes d'inactivité, réglable par l'administrateur seulement, sans avertissement ni prolongation (`securite.js`). |
| 13.2 Pas de nouvelle fenêtre sans action | C | Seuls des liens externes cliqués ouvrent un onglet. |
| 13.3 Document bureautique accessible | NT | Exports DOCX, PDF et XLSX non examinés ; les PDF produits par pdfmake ne sont, a priori, pas balisés (non vérifié). |
| 13.4 Version accessible pertinente | NT | Idem. |
| 13.5 Contenu cryptique | NA | Symboles (❚❚, ▶, ‹, ›) tous doublés d'un `aria-label`. |
| 13.6 Alternative au contenu cryptique pertinente | NA | Idem. |
| 13.7 Clignotements | C | Aucun clignotement ; fondu de 700 ms. |
| 13.8 Contenu en mouvement contrôlable | C | Carrousel : bouton pause, arrêt au survol et au focus, arrêt si l'utilisateur a réduit les animations. |
| 13.9 Toutes orientations | C | Aucun verrouillage d'orientation. |
| 13.10 Gestes complexes | NA | Aucun glisser-déposer ni geste multipoint. |
| 13.11 Actions au pointeur annulables | C | Actions déclenchées au clic (relâchement). |
| 13.12 Mouvements de l'appareil | NA | Aucun. |

## 5. Reste à faire avant toute déclaration

1. Corriger les 18 non-conformités (section 3) ; les plus rapides : 8.6, 11.13, 11.10, 8.2/9.2, 9.1, 5.4.
2. Tester avec NVDA et Firefox (et VoiceOver sur mobile) : menu, connexion, saisie des notes, modales, messages de statut.
3. Passer le validateur HTML W3C sur le DOM rendu.
4. Mesurer le contraste du texte sur les photos d'accueil (3.2), tester l'affichage sans CSS (10.2, 10.3), examiner les documents exportés (13.3, 13.4).
5. Faire réaliser l'audit par un auditeur indépendant, puis publier la déclaration d'accessibilité et le schéma pluriannuel.
