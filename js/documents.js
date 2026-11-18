/* Documents : lecture du texte des pièces déposées, lecture des tableurs, exports PDF / Word / tableur / archive. */
(function () {
  'use strict';
  const Docs = {};
  const ext = nom => (String(nom).split('.').pop() || '').toLowerCase();
  Docs.FORMATS = ['pdf', 'docx', 'odt', 'xlsx', 'xls', 'ods', 'csv', 'txt'];

  /* ---------- Extraction du texte, page par page ---------- */
  // Bibliothèques lourdes chargées seulement au moment où elles servent (export, import, lecture d'une pièce).
  const LIBS = { jszip: ['vendor/jszip.min.js'], xlsx: ['vendor/xlsx.full.min.js'], pdfjs: ['vendor/pdf.min.js'], pdfmake: ['vendor/pdfmake.min.js', 'vendor/vfs_fonts.js'], docx: ['vendor/docx.js'] };
  Docs.charger = async function () { for (const n of arguments) for (const src of LIBS[n]) await D.chargerScript(src); };

  Docs.extraire = async function (fichier) {
    const e = ext(fichier.name);
    const lib = e === 'pdf' ? 'pdfjs' : (e === 'docx' || e === 'odt') ? 'jszip' : ['xlsx', 'xls', 'ods', 'csv'].includes(e) ? 'xlsx' : null;
    if (lib) await Docs.charger(lib);
    try {
      if (e === 'pdf') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ isEvalSupported: false, data: new Uint8Array(await fichier.arrayBuffer()) }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const c = await (await pdf.getPage(i)).getTextContent();
          let t = '', y = null;
          for (const it of c.items) { if (y !== null && Math.abs(it.transform[5] - y) > 2) t += '\n'; else if (t && !t.endsWith(' ')) t += ' '; t += it.str; y = it.transform[5]; }
          pages.push(t.replace(/[ \t]+/g, ' ').trim());
        }
        return { pages, nb_pages: pdf.numPages, lisible: pages.some(p => p.length > 20) };
      }
      if (e === 'docx' || e === 'odt') {
        const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
        const f = zip.file(e === 'docx' ? 'word/document.xml' : 'content.xml');
        if (!f) return { pages: [], nb_pages: 0, lisible: false };
        let x = await f.async('string');
        x = x.replace(/<\/w:p>|<\/text:p>|<\/text:h>/g, '\n').replace(/<w:tab\/>|<text:tab\/>/g, '\t').replace(/<\/w:tc>|<\/table:table-cell>/g, ' | ').replace(/<[^>]+>/g, '');
        const d = document.createElement('textarea'); d.innerHTML = x; const texte = d.value.replace(/\n{3,}/g, '\n\n').trim();
        // un document bureautique n'a pas de pages fixes : on découpe en sections d'environ 2 500 caractères
        const pages = []; let courant = '';
        for (const par of texte.split('\n')) { if (courant.length + par.length > 2500 && courant) { pages.push(courant.trim()); courant = ''; } courant += par + '\n'; }
        if (courant.trim()) pages.push(courant.trim());
        return { pages, nb_pages: pages.length, lisible: texte.length > 20, sections: true };
      }
      if (['xlsx', 'xls', 'ods', 'csv'].includes(e)) {
        const wb = XLSX.read(await fichier.arrayBuffer(), { type: 'array' });
        const pages = wb.SheetNames.map(n => 'Feuille « ' + n + ' »\n' + XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ' | ', blankrows: false }));
        return { pages, nb_pages: pages.length, lisible: pages.join('').length > 20, sections: true };
      }
      if (e === 'txt') { const t = await fichier.text(); return { pages: [t], nb_pages: 1, lisible: t.trim().length > 0 }; }
    } catch (err) { console.warn('extraction', fichier.name, err); return { pages: [], nb_pages: 0, lisible: false, erreur: String(err.message || err) }; }
    return { pages: [], nb_pages: 0, lisible: false, nonPrisEnCharge: true };
  };

  /* ---------- Lecture d'un tableur : tableau de lignes ---------- */
  Docs.lireTableur = async function (fichier) {
    await Docs.charger('xlsx');
    const wb = XLSX.read(await fichier.arrayBuffer(), { type: 'array', cellDates: true });
    return wb.SheetNames.map(n => ({ nom: n, lignes: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false, defval: '', raw: true }) }));
  };
  // repère les colonnes désignation / unité / quantité / prix unitaire dans un bordereau
  Docs.lireBordereau = function (feuilles) {
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const f of feuilles) {
      for (let i = 0; i < Math.min(f.lignes.length, 30); i++) {
        const l = f.lignes[i].map(norm);
        const cd = l.findIndex(x => /designation|libelle|prestation|description/.test(x));
        const cq = l.findIndex(x => /^(qte|quantite)/.test(x) || x === 'q');
        const cp = l.findIndex(x => /prix unitaire|p\.?u\.?|unitaire/.test(x));
        if (cd >= 0 && cq >= 0 && cp >= 0) {
          const cu = l.findIndex(x => /^unite|^u$/.test(x));
          const lignes = [];
          for (const r of f.lignes.slice(i + 1)) {
            const q = Number(String(r[cq]).replace(',', '.')), pu = Number(String(r[cp]).replace(/\s/g, '').replace(',', '.'));
            if (!String(r[cd]).trim() || isNaN(q) || isNaN(pu) || r[cq] === '' || r[cp] === '') continue;
            lignes.push({ designation: String(r[cd]).trim(), unite: cu >= 0 ? String(r[cu]).trim() : '', quantite: q, prix_unitaire: pu });
          }
          return { feuille: f.nom, lignes };
        }
      }
    }
    return null;
  };

  /* ---------- Modèle commun de document ----------
     doc = { titre, sousTitre, pied, paysage, blocs: [ {type:'titre', niveau, texte} | {type:'p', texte, gras, italique}
            | {type:'tableau', entetes:[], lignes:[[]], largeurs:[]} | {type:'liste', elements:[]} | {type:'saut'} ] } */
  Docs.pdf = async function (doc) {
    await Docs.charger('pdfmake');
    const contenu = [{ text: doc.titre, style: 't0' }];
    if (doc.sousTitre) contenu.push({ text: doc.sousTitre, style: 'sous' });
    for (const b of doc.blocs) {
      if (b.type === 'titre') contenu.push({ text: b.texte, style: 't' + (b.niveau || 1) });
      else if (b.type === 'p') String(b.texte || '').split('\n').forEach(t => contenu.push({ text: t || ' ', style: 'p', bold: !!b.gras, italics: !!b.italique }));
      else if (b.type === 'liste') contenu.push({ ul: b.elements.map(String), style: 'p' });
      else if (b.type === 'saut') contenu.push({ text: '', pageBreak: 'after' });
      else if (b.type === 'tableau') contenu.push({ style: 'tab', table: { headerRows: 1, widths: b.largeurs || (() => { const lg = b.entetes.map((e, i) => Math.max(String(e).length, ...b.lignes.map(l => String(l[i] == null ? '' : l[i]).length))); const large = lg.indexOf(Math.max(...lg)); return b.entetes.map((_, i) => i === large ? '*' : 'auto'); })(),
        body: [b.entetes.map(t => ({ text: String(t), style: 'th' }))].concat(b.lignes.map(l => l.map(c => ({ text: c == null ? '' : String(c) })))) },
        layout: { hLineColor: () => '#C9BEA4', vLineColor: () => '#C9BEA4', hLineWidth: () => 0.5, vLineWidth: () => 0.5, fillColor: i => i === 0 ? '#EFE7D3' : null } });
    }
    const dd = { pageSize: 'A4', pageOrientation: doc.paysage ? 'landscape' : 'portrait', pageMargins: [40, 46, 40, 50], content: contenu,
      footer: (page, total) => ({ columns: [{ text: (doc.pied || '') + ((window.CONFIG || {}).nomLogiciel ? '  ·  ' + window.CONFIG.nomLogiciel : '') + ((window.CONFIG || {}).maquette ? '  ·  ' + window.CONFIG.maquette : ''), fontSize: 7, color: '#5B5246' }, { text: 'Page ' + page + ' / ' + total, alignment: 'right', fontSize: 7, color: '#666' }], margin: [40, 18, 40, 0] }),
      defaultStyle: { fontSize: 9, lineHeight: 1.25 },
      styles: { t0: { fontSize: 17, bold: true, margin: [0, 0, 0, 4] }, sous: { fontSize: 10, color: '#555', margin: [0, 0, 0, 12] },
        t1: { fontSize: 13, bold: true, margin: [0, 14, 0, 6], color: '#1F5B3F' }, t2: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] }, t3: { fontSize: 9.5, bold: true, margin: [0, 6, 0, 3] },
        p: { margin: [0, 0, 0, 5] }, th: { bold: true, fontSize: 8.5 }, tab: { margin: [0, 4, 0, 10], fontSize: 8.5 } } };
    return new Promise((ok, ko) => { try { const r = pdfMake.createPdf(dd).getBlob(ok); if (r && r.then) r.then(ok, ko); } catch (e) { ko(e); } });
  };

  Docs.word = async function (doc) {
    await Docs.charger('docx');
    const X = window.docx;
    const P = (texte, o) => new X.Paragraph(Object.assign({ children: [new X.TextRun(Object.assign({ text: String(texte == null ? '' : texte), font: 'Calibri', size: 21 }, o && o.run))], spacing: { after: 110 } }, o && o.par));
    const enfants = [new X.Paragraph({ text: doc.titre, heading: X.HeadingLevel.TITLE })];
    if (doc.sousTitre) enfants.push(P(doc.sousTitre, { run: { color: '555555' } }));
    for (const b of doc.blocs) {
      if (b.type === 'titre') enfants.push(new X.Paragraph({ text: b.texte, heading: [X.HeadingLevel.HEADING_1, X.HeadingLevel.HEADING_2, X.HeadingLevel.HEADING_3][(b.niveau || 1) - 1], spacing: { before: 240, after: 120 } }));
      else if (b.type === 'p') String(b.texte || '').split('\n').forEach(t => enfants.push(P(t, { run: { bold: !!b.gras, italics: !!b.italique } })));
      else if (b.type === 'liste') b.elements.forEach(t => enfants.push(P(t, { par: { bullet: { level: 0 } } })));
      else if (b.type === 'saut') enfants.push(new X.Paragraph({ children: [new X.PageBreak()] }));
      else if (b.type === 'tableau') {
        const cell = (t, entete) => new X.TableCell({ children: [new X.Paragraph({ children: [new X.TextRun({ text: t == null ? '' : String(t), bold: !!entete, font: 'Calibri', size: 18 })] })],
          shading: entete ? { fill: 'EFE7D3' } : undefined, margins: { top: 50, bottom: 50, left: 80, right: 80 } });
        enfants.push(new X.Table({ width: { size: 100, type: X.WidthType.PERCENTAGE },
          rows: [new X.TableRow({ tableHeader: true, children: b.entetes.map(t => cell(t, true)) })].concat(b.lignes.map(l => new X.TableRow({ children: l.map(c => cell(c)) }))) }));
        enfants.push(P(''));
      }
    }
    const d = new X.Document({ creator: 'l\'entreprise.ai — gestion des marchés publics', title: doc.titre,
      sections: [{ properties: { page: { size: { orientation: doc.paysage ? X.PageOrientation.LANDSCAPE : X.PageOrientation.PORTRAIT } } },
        footers: { default: new X.Footer({ children: [P(doc.pied || '', { run: { size: 15, color: '666666' } })] }) }, children: enfants }] });
    return X.Packer.toBlob(d);
  };

  /* ---------- Tableur et CSV ---------- */
  Docs.csv = function (lignes) {
    const cols = Array.from(lignes.reduce((s, l) => { Object.keys(l).forEach(k => s.add(k)); return s; }, new Set()));
    const c = v => { if (v === null || v === undefined) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [cols.join(';')].concat(lignes.map(l => cols.map(k => c(l[k])).join(';'))).join('\r\n');
  };
  Docs.xlsx = async function (feuilles) { // [{nom, lignes:[[...]]}]
    await Docs.charger('xlsx');
    const wb = XLSX.utils.book_new();
    feuilles.forEach(f => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(f.lignes), f.nom.slice(0, 31)));
    return new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  /* ---------- Export complet (réversibilité) ---------- */
  Docs.exportComplet = async function (surEtape) {
    await Docs.charger('jszip');
    D.exiger('export.complet');
    const zip = new JSZip(); const inventaire = []; const dictionnaire = [];
    for (const t of Object.keys(D.TABLES)) {
      if (surEtape) surEtape('Données : ' + D.TABLES[t]);
      let lignes = await D.lister(t);
      if (t === 'pieces') lignes = lignes.map(l => Object.assign({}, l, { pages: undefined, texte_extrait: l.pages ? 'documents-texte/' + l.id + '.txt' : null }));
      zip.file('donnees/' + t + '.json', JSON.stringify(lignes, null, 1));
      zip.file('donnees/' + t + '.csv', Docs.csv(lignes));
      inventaire.push({ table: t, libelle: D.TABLES[t], nombre_de_lignes: lignes.length, fichiers: 'donnees/' + t + '.json ; donnees/' + t + '.csv' });
      const cols = Array.from(lignes.reduce((s, l) => { Object.keys(l).forEach(k => s.add(k)); return s; }, new Set()));
      cols.forEach(c => { const ex = lignes.find(l => l[c] != null && l[c] !== ''); dictionnaire.push({ table: t, libelle_table: D.TABLES[t], colonne: c, type_constate: ex ? (Array.isArray(ex[c]) ? 'liste' : typeof ex[c] === 'object' ? 'objet' : typeof ex[c] === 'number' ? 'nombre' : typeof ex[c] === 'boolean' ? 'oui/non' : 'texte') : 'vide', exemple: ex ? String(typeof ex[c] === 'object' ? JSON.stringify(ex[c]) : ex[c]).slice(0, 60) : '' }); });
    }
    const pieces = await D.lister('pieces'); let nbFichiers = 0, nbManquants = 0;
    for (const p of pieces) {
      if (surEtape) surEtape('Document : ' + p.nom_fichier);
      if (p.pages) zip.file('documents-texte/' + p.id + '.txt', (p.pages || []).join('\n\n----- page suivante -----\n\n'));
      if (!p.chemin) continue;
      try { const b = await D.telecharger(p.chemin); if (b) { zip.file('documents/' + p.chemin, b); nbFichiers++; } else nbManquants++; } catch (e) { nbManquants++; }
    }
    inventaire.push({ table: '(documents)', libelle: 'Fichiers sources déposés', nombre_de_lignes: nbFichiers, fichiers: 'documents/ — fichiers introuvables : ' + nbManquants });
    // En ligne, les règles d'accès du serveur s'appliquent à l'export : on le signale dans l'inventaire et dans le LISEZMOI.
    const limite = D.mode === 'supabase' ? 'Contenu limité aux droits de l\'auteur de l\'export (règles d\'accès du serveur), sans les comptes de connexion ni le journal technique.' : null;
    if (limite) inventaire.push({ table: '(perimetre)', libelle: 'Périmètre de l\'export', nombre_de_lignes: 0, fichiers: limite });
    zip.file('inventaire.csv', Docs.csv(inventaire));
    zip.file('dictionnaire-des-donnees.csv', Docs.csv(dictionnaire));
    zip.file('LISEZMOI.txt', ['EXPORT COMPLET — gestion des marchés publics (l\'entreprise.ai)', 'Date de l\'export : ' + U.dateHeure(D.maintenant()), 'Réalisé par : ' + D.utilisateur.nom, '',
      'Contenu de l\'archive', '- donnees/ : une table par fichier, en JSON (UTF-8) et en CSV (séparateur point-virgule, UTF-8 avec BOM, lisible dans un tableur).',
      '- documents/ : les fichiers sources déposés, non modifiés. Le chemin de chaque fichier figure dans la colonne « chemin » de la table pieces.',
      '- documents-texte/ : le texte extrait de chaque pièce, page par page.', '- inventaire.csv : nombre de lignes par table, pour contrôler l\'exhaustivité.',
      '- dictionnaire-des-donnees.csv : liste des colonnes de chaque table, avec un exemple.', '',
      'Les identifiants (colonnes « id » et « ..._id ») relient les tables entre elles. Aucun format propriétaire n\'est utilisé.'].concat(limite ? ['', 'Périmètre : ' + limite] : []).join('\r\n'));
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    await D.journal('Export complet des données', 'export', null, 'Archive de ' + inventaire.reduce((a, b) => a + b.nombre_de_lignes, 0) + ' éléments', { tables: inventaire.length - 1, fichiers: nbFichiers });
    return { blob, inventaire };
  };

  /* ---------- Restauration d'un export complet (sauvegarde) ---------- */
  // Contrôle l'archive (inventaire, tables, fichiers) avant d'écrire quoi que ce soit ; renvoie le rapport de contrôle.
  Docs.analyserSauvegarde = async function (fichier) {
    await Docs.charger('jszip');
    const zip = await JSZip.loadAsync(await fichier.arrayBuffer());
    const inv = zip.file('inventaire.csv'); if (!inv) throw new Error('Ce fichier n\'est pas un export complet : inventaire.csv absent.');
    const lignesInv = (await inv.async('string')).replace(/^\ufeff/, '').split(/\r?\n/).slice(1).filter(Boolean).map(l => l.split(';'));
    const attendus = Object.fromEntries(lignesInv.filter(l => !l[0].startsWith('(')).map(l => [l[0], Number(l[2])]));
    const tables = {}, ecarts = [];
    for (const t of Object.keys(D.TABLES)) {
      const f = zip.file('donnees/' + t + '.json');
      tables[t] = f ? JSON.parse(await f.async('string')) : [];
      if (attendus[t] != null && attendus[t] !== tables[t].length) ecarts.push(D.TABLES[t] + ' : ' + tables[t].length + ' lignes lues pour ' + attendus[t] + ' annoncées');
      if (!f && attendus[t]) ecarts.push(D.TABLES[t] + ' : fichier absent');
    }
    for (const p of tables.pieces) { // le texte extrait est rangé à part dans l'export
      const tx = zip.file('documents-texte/' + p.id + '.txt');
      p.pages = tx ? (await tx.async('string')).split('\n\n----- page suivante -----\n\n') : (p.pages || []);
      delete p.texte_extrait;
    }
    const fichiers = []; let manquants = 0;
    for (const p of tables.pieces.concat(tables.reprises || [])) {
      if (!p.chemin) continue; const f = zip.file('documents/' + p.chemin);
      if (f) fichiers.push([p.chemin, await f.async('blob')]); else manquants++;
    }
    return { tables, fichiers, ecarts, manquants, total: Object.values(tables).reduce((a, l) => a + l.length, 0), date: (await (zip.file('LISEZMOI.txt') || { async: async () => '' }).async('string')).match(/Date de l'export : (.*)/) };
  };
  Docs.restaurer = async function (analyse) {
    // La restauration remplace toute la base : réservée à la version installée sur un poste (mode local).
    if (D.mode !== 'local') throw new Error('La restauration d\'une sauvegarde n\'est pas disponible dans la version en ligne.');
    D.exiger('export.complet');
    if (analyse.ecarts.length) throw new Error('Restauration refusée : l\'archive ne correspond pas à son inventaire (' + analyse.ecarts[0] + ').');
    const avant = D.utilisateur;
    await D._restaurerLocal(analyse.tables, analyse.fichiers);
    if (!D.utilisateur) D.utilisateur = avant;
    await D.journal('Restauration d\'une sauvegarde', 'securite', null, analyse.total + ' éléments et ' + analyse.fichiers.length + ' fichiers restaurés', { fichiers_absents: analyse.manquants });
  };

  window.Docs = Docs;
})();
