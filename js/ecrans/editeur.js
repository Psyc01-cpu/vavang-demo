/* Éditeur riche des documents du DCE, sans dépendance externe : contenteditable + document.execCommand,
   assainissement du HTML par liste blanche de balises (aucun attribut conservé), conversion texte ⇄ HTML ⇄ blocs d'export.

   Stockage (compatible avec l'existant) :
   - documents_dce.contenu      : texte brut, une ligne par paragraphe (inchangé : contrôles automatiques, lecture des critères,
                                  ancien export et circuit de validation continuent de s'appuyer dessus) ;
   - documents_dce.contenu_html : HTML assaini (nouveau, facultatif) ; s'il manque, il est déduit du texte.
   Texte dérivé du HTML : titres et paragraphes = une ligne ; puce = « - texte » ; liste numérotée = « 1. texte » ;
   ligne de tableau = cellules séparées par « | ». */
(function () {
  'use strict';
  const h = U.h;

  // Liste blanche : seules ces balises sont conservées, sans aucun attribut. strong/em sont ramenés à b/i.
  const PERMISES = new Set(['H1', 'H2', 'H3', 'P', 'BR', 'B', 'I', 'U', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  const RENOMMER = { STRONG: 'B', EM: 'I', DIV: 'P', H4: 'H3', H5: 'H3', H6: 'H3' };
  // Balises supprimées avec tout leur contenu.
  const INTERDITES = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'LINK', 'META', 'HEAD', 'TITLE', 'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS']);
  const BLOCS = new Set(['H1', 'H2', 'H3', 'P', 'UL', 'OL', 'TABLE']);

  function assainir(html) {
    // Le contenu d'un <template> est inerte : aucun script exécuté, aucune image chargée, aucun gestionnaire déclenché.
    // (DOMParser ne suffit pas : Chrome y tente le chargement des images et donc leurs « onerror ».)
    // Les attributs « on… » sont d'abord neutralisés dans le texte : Chrome signale (et bloque, grâce à la CSP) tout gestionnaire
    // en ligne dès l'analyse, même dans un fragment inerte. La liste blanche ci-dessous retire de toute façon tous les attributs.
    let brut = String(html || ''), avant;
    do { avant = brut; brut = brut.replace(/(<[^>]*?[\s/"'])on([a-z]+\s*=)/gi, '$1data-neutralise-$2'); } while (brut !== avant);
    const modele = document.createElement('template'); modele.innerHTML = brut;
    const doc = { body: modele.content };
    const sortie = document.createElement('div');
    const copier = (source, cible) => {
      for (const n of Array.from(source.childNodes)) {
        if (n.nodeType === 3) { cible.appendChild(document.createTextNode(n.nodeValue)); continue; }
        if (n.nodeType !== 1) continue; // commentaires, instructions : ignorés
        const tag = RENOMMER[n.tagName] || n.tagName;
        if (INTERDITES.has(n.tagName)) continue;
        if (PERMISES.has(tag)) { const e = document.createElement(tag); cible.appendChild(e); copier(n, e); }
        else copier(n, cible); // balise inconnue (span, a, font…) : on garde le texte, pas la balise
      }
    };
    copier(doc.body, sortie);
    // Normalisation : le texte et les éléments en ligne laissés au premier niveau sont regroupés en paragraphes.
    const finale = document.createElement('div'); let courant = null;
    for (const n of Array.from(sortie.childNodes)) {
      if (n.nodeType === 1 && BLOCS.has(n.tagName)) { courant = null; finale.appendChild(n); continue; }
      if (n.nodeType === 1 && n.tagName === 'BR') { courant = null; continue; }
      if (n.nodeType === 3 && !n.nodeValue.trim() && !courant) continue;
      if (!courant) { courant = document.createElement('p'); finale.appendChild(courant); }
      courant.appendChild(n);
    }
    // Un élément de liste hors liste, une cellule hors tableau : ramenés à un paragraphe.
    finale.querySelectorAll('li').forEach(li => { if (!li.parentElement || !/^(UL|OL)$/.test(li.parentElement.tagName)) { const p = document.createElement('p'); p.append(...li.childNodes); li.replaceWith(p); } });
    finale.querySelectorAll('td,th').forEach(td => { if (!td.parentElement || td.parentElement.tagName !== 'TR') { const p = document.createElement('p'); p.append(...td.childNodes); td.replaceWith(p); } });
    finale.querySelectorAll('tr').forEach(tr => { if (!tr.closest('table')) tr.replaceWith(...Array.from(tr.childNodes)); });
    return finale.innerHTML;
  }

  const echapper = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const texteDe = el => (el.textContent || '').replace(/ /g, ' ').replace(/\n/g, ' ');
  // Un bloc de premier niveau → ses lignes de texte brut.
  function lignesDe(el) {
    const t = el.tagName;
    if (t === 'UL') return Array.from(el.children).map(li => '- ' + texteDe(li));
    if (t === 'OL') return Array.from(el.children).map((li, i) => (i + 1) + '. ' + texteDe(li));
    if (t === 'TABLE') return Array.from(el.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(c => texteDe(c).trim()).join(' | '));
    return [texteDe(el)];
  }
  function blocsHtml(html) {
    const div = document.createElement('div'); div.innerHTML = assainir(html);
    return Array.from(div.children).map(el => ({ el, lignes: lignesDe(el), html: el.outerHTML }));
  }
  const texteDepuis = html => blocsHtml(html).map(b => b.lignes.join('\n')).join('\n');

  const TITRE = /^(ARTICLE|TITRE|CHAPITRE)\b/i;
  // Texte brut → HTML. Les lignes « ARTICLE / TITRE / CHAPITRE » deviennent des titres (même règle que l'export existant),
  // les lignes « - » des puces ; les autres des paragraphes. Le passage aller-retour restitue le texte à l'identique.
  function htmlDepuisTexte(texte) {
    const lignes = String(texte || '').replace(/\r/g, '').split('\n'); let html = '', liste = null;
    for (const l of lignes) {
      if (/^- /.test(l)) { liste = (liste || []).concat('<li>' + echapper(l.slice(2)) + '</li>'); continue; }
      if (liste) { html += '<ul>' + liste.join('') + '</ul>'; liste = null; }
      html += TITRE.test(l.trim()) && l === l.trim() ? '<h2>' + echapper(l) + '</h2>' : l === '' ? '<p><br></p>' : '<p>' + echapper(l) + '</p>';
    }
    if (liste) html += '<ul>' + liste.join('') + '</ul>';
    return html;
  }

  // Le texte a été modifié en dehors de l'éditeur (texte brut, import) : on reconstruit le HTML en reprenant
  // tels quels les blocs mis en forme dont le texte n'a pas changé ; seules les lignes nouvelles ou modifiées sont recréées.
  function reconstruire(texte, ancienHtml) {
    if (!ancienHtml) return htmlDepuisTexte(texte);
    if (texteDepuis(ancienHtml) === texte) return assainir(ancienHtml);
    const anciens = blocsHtml(ancienHtml).map(b => Object.assign(b, { pris: false }));
    const lignes = String(texte || '').replace(/\r/g, '').split('\n'); let html = '', i = 0, nouvelles = [];
    const vider = () => { if (nouvelles.length) { html += htmlDepuisTexte(nouvelles.join('\n')); nouvelles = []; } };
    while (i < lignes.length) {
      const b = anciens.find(x => !x.pris && x.lignes.length && x.lignes.every((l, k) => lignes[i + k] === l));
      if (b) { vider(); html += b.html; b.pris = true; i += b.lignes.length; } else { nouvelles.push(lignes[i]); i++; }
    }
    vider();
    return html;
  }

  // HTML → blocs du modèle commun de Docs.pdf / Docs.word (titre, p, liste, tableau).
  // Limite connue : Docs.pdf et Docs.word ne gèrent le gras et l'italique qu'au niveau du paragraphe entier ;
  // un mot en gras au milieu d'une phrase est exporté sans gras.
  function blocsExport(html) {
    const sortie = [];
    for (const b of blocsHtml(html)) {
      const el = b.el, t = el.tagName;
      if (/^H[1-3]$/.test(t)) sortie.push({ type: 'titre', niveau: Number(t[1]), texte: texteDe(el).trim() });
      else if (t === 'UL') sortie.push({ type: 'liste', elements: Array.from(el.children).map(texteDe) });
      else if (t === 'OL') sortie.push({ type: 'liste', elements: Array.from(el.children).map((li, i) => (i + 1) + '. ' + texteDe(li)) });
      else if (t === 'TABLE') {
        const rangs = Array.from(el.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(c => texteDe(c).trim()));
        if (!rangs.length) continue; const n = Math.max(...rangs.map(r => r.length));
        const pad = r => r.concat(Array(n - r.length).fill(''));
        sortie.push({ type: 'tableau', entetes: pad(rangs[0]), lignes: rangs.slice(1).map(pad) });
      } else {
        const texte = texteDe(el);
        // Gras / italique retenus quand tout le texte du paragraphe l'est.
        const tout = sel => { const x = Array.from(el.querySelectorAll(sel)).map(texteDe).join(''); return !!texte.trim() && x.replace(/\s/g, '') === texte.replace(/\s/g, ''); };
        sortie.push({ type: 'p', texte, gras: tout('b'), italique: tout('i') });
      }
    }
    return sortie;
  }

  /* ---------- Composant ---------- */
  // Editeur.creer({ html, texte, lectureSeule, surChangement }) → { element, zone, textarea, html(), texte(), inserer(texte), modifie() }
  // Le textarea « Texte brut » reste disponible (masqué par défaut) : saisie brute, copier-coller, outils d'accessibilité.
  function creer(o) {
    o = o || {};
    let html = o.html ? reconstruire(o.texte != null ? o.texte : texteDepuis(o.html), o.html) : htmlDepuisTexte(o.texte || '');
    const zone = h('div.editeur-zone', { contenteditable: o.lectureSeule ? 'false' : 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Contenu du document (mise en forme)', spellcheck: 'true', html });
    let synchro = texteDepuis(html);
    const brut = h('textarea.saisie.editeur-brut', { rows: 26, value: synchro, disabled: !!o.lectureSeule, 'aria-label': 'Contenu du document (texte brut)', hidden: true });
    let plage = null;
    const garder = () => { const s = window.getSelection(); if (s.rangeCount && zone.contains(s.anchorNode)) plage = s.getRangeAt(0).cloneRange(); };
    document.addEventListener('selectionchange', garder);
    const maj = () => { synchro = texteDepuis(zone.innerHTML); brut.value = synchro; if (o.surChangement) o.surChangement(); };
    zone.addEventListener('input', maj);
    zone.addEventListener('blur', maj);
    // Collage : le HTML venu d'ailleurs (Word, page web) est assaini avant insertion.
    zone.addEventListener('paste', e => {
      const cd = e.clipboardData; if (!cd) return; e.preventDefault();
      const riche = cd.getData('text/html'); const net = riche ? assainir(riche) : htmlDepuisTexte(cd.getData('text/plain'));
      document.execCommand('insertHTML', false, net); maj();
    });
    zone.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.types.includes('text/html')) { e.preventDefault(); } });
    brut.addEventListener('input', () => { if (o.surChangement) o.surChangement(); });
    const restaurer = () => { zone.focus(); if (plage && zone.contains(plage.startContainer)) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(plage); } };
    // Les commandes du navigateur agissent sur la zone ; le HTML est assaini à chaque lecture (html()) et au collage.
    const cmd = (c, v) => { restaurer(); document.execCommand(c, false, v); maj(); };
    const outil = (libelle, titre, action, extra) => h('button.outil' + (extra || ''), { type: 'button', title: titre, 'aria-label': titre, 'data-outil': titre,
      onmousedown: e => e.preventDefault(), onclick: U.agir(action) }, libelle);
    // Fenêtre sans rafraîchissement de la page (U.editer rechargerait l'écran et perdrait la saisie en cours).
    const insererTableau = () => { let m; const f = U.formulaire([{ nom: 'colonnes', libelle: 'Nombre de colonnes', type: 'nombre', requis: true, defaut: 3, min: 1, max: 8 },
      { nom: 'lignes', libelle: 'Nombre de lignes (en-tête compris)', type: 'nombre', requis: true, defaut: 3, min: 2, max: 40 }], {}, v => {
      const nc = Math.max(1, Math.min(8, v.colonnes | 0)), nl = Math.max(2, Math.min(40, v.lignes | 0));
      const ligne = (balise, i) => '<tr>' + Array.from({ length: nc }, (_, k) => '<' + balise + '>' + (balise === 'th' ? 'Colonne ' + (k + 1) : '&nbsp;') + '</' + balise + '>').join('') + '</tr>';
      m.fermer(); cmd('insertHTML', '<table><thead>' + ligne('th') + '</thead><tbody>' + Array.from({ length: nl - 1 }, (_, i) => ligne('td', i)).join('') + '</tbody></table><p><br></p>');
    }, { libelle: 'Insérer', surAnnulation: () => m.fermer() }); m = U.modale('Insérer un tableau', f); };
    const ajouterLigne = () => {
      restaurer(); const s = window.getSelection(); const n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
      const tr = n && n.closest && n.closest('tr'); if (!tr || !zone.contains(tr)) throw new Error('Placez le curseur dans une ligne du tableau.');
      const neuf = document.createElement('tr'); for (let k = 0; k < tr.children.length; k++) neuf.appendChild(document.createElement('td')).innerHTML = '<br>';
      (tr.parentElement.tagName === 'THEAD' ? tr.closest('table').querySelector('tbody') || tr.closest('table').appendChild(document.createElement('tbody')) : tr.parentElement).appendChild(neuf); maj();
    };
    const vueBrute = h('label.editeur-bascule', h('input', { type: 'checkbox', onchange: e => {
      if (e.target.checked) { maj(); brut.hidden = false; zone.hidden = true; barre.querySelectorAll('button').forEach(b => { b.disabled = true; }); }
      else { zone.innerHTML = reconstruire(brut.value, zone.innerHTML); maj(); brut.hidden = true; zone.hidden = false; barre.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    } }), ' Texte brut');
    const barre = h('div.editeur-barre', { role: 'toolbar', 'aria-label': 'Mise en forme' },
      outil('T1', 'Titre 1', () => cmd('formatBlock', '<h1>')), outil('T2', 'Titre 2', () => cmd('formatBlock', '<h2>')), outil('T3', 'Titre 3', () => cmd('formatBlock', '<h3>')),
      outil('¶', 'Paragraphe', () => cmd('formatBlock', '<p>')), h('span.sep'),
      outil('G', 'Gras', () => cmd('bold'), '.gras'), outil('I', 'Italique', () => cmd('italic'), '.italique'), outil('S', 'Souligné', () => cmd('underline'), '.souligne'), h('span.sep'),
      outil('• Liste', 'Liste à puces', () => cmd('insertUnorderedList')), outil('1. Liste', 'Liste numérotée', () => cmd('insertOrderedList')), h('span.sep'),
      outil('Tableau', 'Insérer un tableau', insererTableau), outil('+ Ligne', 'Ajouter une ligne au tableau', ajouterLigne), h('span.sep'),
      outil('↶', 'Annuler', () => cmd('undo')), outil('↷', 'Rétablir', () => cmd('redo')));
    const element = h('div.editeur' + (o.lectureSeule ? '.lecture' : ''), o.lectureSeule ? null : h('div.editeur-tete', barre, vueBrute), zone, brut);
    // Le texte brut a-t-il été modifié sans passer par l'éditeur (saisie brute ou script) ? On repart alors du texte.
    const etat = () => { if (!brut.hidden || brut.value !== synchro) { const n = reconstruire(brut.value, zone.innerHTML); if (n !== zone.innerHTML) zone.innerHTML = n; synchro = texteDepuis(zone.innerHTML); } return zone.innerHTML; };
    const api = {
      element, zone, textarea: brut,
      html: () => assainir(etat()),
      texte: () => { etat(); return brut.value; },
      // Insertion au curseur (clauses) : le texte est converti en paragraphes.
      inserer: texte => { if (!brut.hidden) { const p = brut.selectionStart || brut.value.length; brut.value = brut.value.slice(0, p) + '\n' + texte + '\n' + brut.value.slice(p); return; }
        if (plage && zone.contains(plage.startContainer)) cmd('insertHTML', htmlDepuisTexte(texte)); else { zone.insertAdjacentHTML('beforeend', htmlDepuisTexte(texte)); maj(); } },
      detruire: () => document.removeEventListener('selectionchange', garder)
    };
    element.editeur = api;
    return api;
  }

  window.Editeur = { creer, assainir, texteDepuis, htmlDepuisTexte, reconstruire, blocsExport, PERMISES };
})();
