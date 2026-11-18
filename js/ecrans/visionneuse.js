/* Visionneuse PDF : affiche les pages avec leur mise en page d'origine (rendu pdf.js), page par page. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  E.visionneusePdf = async function (piece, pageDepart) {
    await Docs.charger('pdfjs'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const blob = await D.telecharger(piece.chemin); if (!blob) throw new Error('Fichier source introuvable.');
    const pdf = await pdfjsLib.getDocument({ isEvalSupported: false, data: new Uint8Array(await blob.arrayBuffer()) }).promise;
    let n = Math.min(Math.max(1, pageDepart || 1), pdf.numPages), zoom = 1.3;
    const toile = h('canvas.page-pdf'); const etat = h('span.aide');
    const dessiner = async () => {
      const page = await pdf.getPage(n); const vue = page.getViewport({ scale: zoom * (window.devicePixelRatio || 1) });
      toile.width = vue.width; toile.height = vue.height; toile.style.width = (vue.width / (window.devicePixelRatio || 1)) + 'px';
      await page.render({ canvasContext: toile.getContext('2d'), viewport: vue }).promise;
      etat.textContent = 'Page ' + n + ' sur ' + pdf.numPages;
    };
    const barre = h('div.actions', U.bouton('‹ Page précédente', async () => { if (n > 1) { n--; await dessiner(); } }, 'secondaire.petit'), etat,
      U.bouton('Page suivante ›', async () => { if (n < pdf.numPages) { n++; await dessiner(); } }, 'secondaire.petit'),
      U.bouton('−', async () => { zoom = Math.max(.6, zoom - .2); await dessiner(); }, 'secondaire.petit', { 'aria-label': 'Réduire' }), U.bouton('+', async () => { zoom = Math.min(3, zoom + .2); await dessiner(); }, 'secondaire.petit', { 'aria-label': 'Agrandir' }));
    U.modale(piece.nom_fichier + ' — mise en page d\'origine', h('div.visionneuse', barre, h('div.zone-pdf', toile)), { large: true });
    await dessiner();
    await D.journal('Consultation d\'une pièce (mise en page d\'origine)', 'pieces', piece.id, piece.nom_fichier, null, piece.consultation_id);
  };
})();
