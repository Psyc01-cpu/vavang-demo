# vavang — audit de sécurité et d'accessibilité

État au 19 novembre 2026, sur le prototype en démonstration locale. Ce document distingue ce qui a été **mesuré** de ce qui **reste à faire**.

## 1. Dépendances (npm audit)

| | Avant | Après |
|---|---|---|
| Vulnérabilités signalées | 4 (1 critique, 3 élevées) | 3 (1 critique, 2 élevées) |

Corrections apportées :
- **SheetJS** (lecture et écriture des tableurs) : passage de la version 0.18.5, vulnérable (pollution de prototype, déni de service par expression régulière), à la **version 0.20.3**, diffusée par l'éditeur et corrigée.
- **pdf.js** (lecture des PDF) : la faille CVE-2024-4367 permet l'exécution de code par une police piégée dans un PDF. Elle est neutralisée par l'option `isEvalSupported: false`, qui est le contournement officiel, appliqué à toutes les ouvertures de PDF : extraction du texte et visionneuse.

Reste signalé, avec l'analyse :
- **pdfjs-dist** : l'alerte porte sur la version installée. La faille est neutralisée par l'option ci-dessus. Le passage à la version 4 (modules ES) est à planifier.
- **tar** et **@mapbox/node-pre-gyp** : dépendances de développement facultatives de pdfjs-dist, qui servent au rendu côté serveur. Elles ne sont **jamais livrées au navigateur** : aucun impact sur l'application.

## 2. Mesures de sécurité ajoutées

- **Mots de passe en mode local** : plus aucun mot de passe en clair. Empreinte PBKDF2-SHA-256, sel aléatoire par compte, 120 000 itérations. Les comptes déjà créés sont convertis au démarrage. En mode hébergé, les mots de passe relèvent de l'authentification Supabase (bcrypt).
- **Fonction serveur** `gerer-compte` : client Supabase en version figée (2.119.0), chargé depuis le registre npm, et non plus depuis un service tiers de distribution.
- **Report de la double authentification** : possible uniquement en démonstration locale explicite (paramètre `reportMfaDemoLocale` et adresse locale 127.0.0.1). Impossible en ligne.
- **Rappel des mesures existantes** : double authentification TOTP obligatoire pour les administrateurs, verrouillage après 5 échecs, déconnexion après 15 minutes d'inactivité, journal de sécurité non modifiable, habilitations par profil, par service, par dossier et par lot.

## 3. Tests non réalisés à ce jour

- **Scan dynamique (OWASP ZAP)** : à lancer sur la version en ligne, une fois celle-ci publiée. Il n'a pas de sens sur un serveur de fichiers local.
- **Test d'intrusion par une entité indépendante** (CCTP 3.7.4) : non réalisé.

## 4. Accessibilité

**Audit automatique** : axe-core 4.10.2, règles WCAG 2.1 niveaux A et AA, sur 11 écrans (`node tests/accessibilite.mjs`, résultats dans `mesures/accessibilite.json`) :
- page d'accueil et article ;
- tableau de bord, consultations ;
- candidatures et offres, saisie des notes, synthèse et classement ;
- fiche d'un marché, demandes d'assistance, notifications, paramètres.

| | Premier passage | Après corrections |
|---|---|---|
| Écrans sans violation | 4 sur 11 | **11 sur 11** |
| Violations | contrastes insuffisants (badges verts, étapes), 20 champs de saisie de note sans libellé associé, zone de tableau défilante inaccessible au clavier | aucune |

Corrections apportées :
- vert des états foncé, pour atteindre un contraste de 4,5 pour 1 ;
- libellés reliés à leurs champs ;
- zones de tableau atteignables au clavier.

Autres points déjà en place :
- navigation au clavier et lien d'évitement « Aller au contenu » ;
- défilement des annonces avec pause, et désactivé si l'utilisateur a réduit les animations ;
- textes alternatifs sur les logos.

**Limite** : un outil automatique ne vérifie qu'une partie des critères RGAA, de l'ordre d'un tiers selon les référentiels. **L'auto-évaluation complète du RGAA 4.1, critère par critère, n'est pas faite** ; elle reste à mener, avec un lecteur d'écran (NVDA), avant toute déclaration de conformité.
