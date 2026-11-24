/* Configuration du déploiement.
   mode « local »    : données enregistrées dans le navigateur (démonstration, développement).
   mode « supabase » : données hébergées (Postgres, authentification, stockage) — renseigner l'adresse et la clé publique. */
(function () {
  // Adresse locale (poste de développement, fichier ouvert directement) : mode local ; partout ailleurs : mode hébergé.
  const hote = (typeof location !== 'undefined' && location.hostname) || '';
  const local = /^(127\.0\.0\.1|localhost|\[::1\]|)$/.test(hote);
window.CONFIG = {
  mode: local ? 'local' : 'supabase',
  // Vrai quand l'application est servie en ligne (démo publique hébergée).
  enLigne: !local,
  supabaseUrl: 'https://talremuridyehynsnfzv.supabase.co',
  // Clé « publishable » : publique par nature, les droits sont imposés par les politiques d'accès du serveur.
  supabaseCle: 'sb_publishable_ATRXpDWTix3eGwKSKTBhHw_PkvFfC5W',
  // Nom du logiciel (vavang, du créole « vavanguer » : faire le tour). Sans point, un point braise est ajouté au logo.
  nomLogiciel: 'vavang',
  accroche: 'Le marché public, de bout en bout',
  editeur: 'L\'entreprise.ai',
  siteEditeur: 'https://lentreprise.ai/',
  // Collectivité affichée en premier (marque blanche). Le logo peut aussi être déposé par l'administrateur (Paramètres).
  // En ligne (démo publique), organisme fictif, identique au jeu de référence (supabase/seed) ; le nom réel reste réservé au poste local.
  organisme: local ? 'CINOR' : 'Agglo Démo',
  organismeComplet: local ? 'Communauté intercommunale du Nord de La Réunion' : 'Communauté d\'agglomération de démonstration',
  logoOrganisme: local ? 'img/organismes/cinor.png' : 'img/organismes/agglo-demo.svg',
  logoContientNom: true,
  // Mention affichée tant que l'outil n'est pas en service chez la collectivité (données fictives).
  maquette: 'Maquette de démonstration — données fictives',
  // Support : sur les pages publiques (accueil, guichet), pas de ligne directe : tout passe par le guichet de demandes (#/guichet).
  // Dans l'application, les agents connectés disposent de trois canaux (CCTP 3.3.4) : le portail (Demandes d'assistance),
  // le courriel ci-dessous (chaque courriel reçu est enregistré par le support dans l'outil, délais comptés depuis la réception)
  // et, pour les incidents critiques (P1), la ligne d'astreinte téléphonique : numéro à renseigner à la mise en service de l'instance
  // (laissé vide tant qu'aucun numéro n'est attribué ; l'écran indique alors qu'il est communiqué au lancement).
  // email : adresse de l'éditeur (mentions légales, obligation LCEN), également utilisée comme adresse de déclaration des demandes.
  support: { email: 'contact@lentreprise.ai', courrielDemandes: 'contact@lentreprise.ai', telephoneAstreinte: '', horaires: 'du lundi au vendredi, de 8 h à 17 h (heure de La Réunion)' },
  // Annonces qui défilent : durée d'affichage de chaque annonce et durée du fondu entre deux annonces (millisecondes).
  carrousel: { duree_ms: 6500, fondu_ms: 700 },
  afficherComptesDemo: true,
  // Permet de reporter la double authentification de l'administrateur, uniquement sur ce poste (adresse locale). Toujours false en ligne.
  reportMfaDemoLocale: true,
  // Clé TOTP (base32) du compte administrateur de démonstration en ligne, volontairement publique ; affichée seulement si afficherComptesDemo.
  // Connexion unique (SSO) de test proposée en ligne : fournisseurs activés dans Supabase (Authentication > Providers).
  sso: local ? [] : ['github'],
  demoMfaSecret: 'IRPRVHTGYYKXLIWJ4WSVHIEMRDXGJID6'
};
})();
