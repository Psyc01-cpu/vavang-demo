/* Démarrage de l'application : chargement des données puis premier affichage.
   Fichier séparé (et non script en ligne) pour que la politique de sécurité du contenu puisse interdire tout script en ligne. */
(function () {
  'use strict';
  D.init().then(() => U.rafraichir()).catch(e => { document.getElementById('contenu').textContent = 'Démarrage impossible : ' + e.message; console.error(e); });
})();
