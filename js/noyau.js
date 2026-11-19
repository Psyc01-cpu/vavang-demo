/* Noyau d'interface : création d'éléments, navigation, formulaires, tableaux, fenêtres, messages. */
(function () {
  'use strict';
  const U = {};

  // h('div.classe', {attributs}, enfants...)
  U.h = function (sel, attrs) {
    const parts = sel.split('.'); const el = document.createElement(parts[0] || 'div');
    if (parts.length > 1) el.className = parts.slice(1).join(' ');
    let i = 1;
    if (attrs && typeof attrs === 'object' && !(attrs instanceof Node) && !Array.isArray(attrs)) {
      i = 2;
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'readOnly') el[k] = !!v;
        else if (k === 'style' && typeof v === 'object') { for (const p of Object.keys(v)) { if (p.startsWith('--')) el.style.setProperty(p, v[p]); else el.style[p] = v[p]; } }
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (; i < arguments.length; i++) ajouter(el, arguments[i]);
    return el;
  };
  function ajouter(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(x => ajouter(el, x));
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  const h = U.h;

  /* ---------- Formats ---------- */
  U.date = v => v ? new Date(String(v).length <= 10 ? v + 'T00:00:00' : v).toLocaleDateString('fr-FR') : '—';
  U.dateHeure = v => v ? new Date(v).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
  U.euros = v => Calcul.euros(v);
  U.nombre = (v, d) => Calcul.nombre(v, d);
  U.taille = o => o == null ? '' : o < 1024 ? o + ' o' : o < 1048576 ? Math.round(o / 1024) + ' Ko' : (o / 1048576).toFixed(1).replace('.', ',') + ' Mo';
  U.badge = (texte, ton) => h('span.badge.' + (ton || 'neutre'), texte);
  U.vide = texte => h('p.vide', texte);

  /* ---------- Messages ---------- */
  U.message = function (texte, ton) {
    let zone = document.getElementById('messages');
    if (!zone) { zone = h('div', { id: 'messages', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(zone); }
    const m = h('div.message.' + (ton || 'ok'), texte); zone.appendChild(m);
    setTimeout(() => m.remove(), ton === 'erreur' ? 9000 : 4000);
  };
  U.erreur = e => { console.warn(e); U.message((e && e.message) || String(e), 'erreur'); };
  // enveloppe un gestionnaire asynchrone : affiche l'erreur au lieu de la perdre
  U.agir = fn => async function (ev) {
    const b = ev && ev.currentTarget && ev.currentTarget.tagName === 'BUTTON' ? ev.currentTarget : null;
    if (b) b.disabled = true;
    try { await fn.apply(this, arguments); } catch (e) { U.erreur(e); } finally { if (b) b.disabled = false; }
  };

  /* ---------- Fenêtre modale ---------- */
  U.modale = function (titre, contenu, options) {
    options = options || {};
    const fond = h('div.modale-fond', { role: 'dialog', 'aria-modal': 'true', 'aria-label': titre });
    const fermer = () => { fond.remove(); document.removeEventListener('keydown', surTouche); if (options.surFermeture) options.surFermeture(); };
    const surTouche = e => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', surTouche);
    const boite = h('div.modale' + (options.large ? '.large' : ''),
      h('div.modale-tete', h('h2', titre), h('button.lien', { type: 'button', 'aria-label': 'Fermer', onclick: fermer }, 'Fermer ✕')),
      h('div.modale-corps', contenu));
    fond.appendChild(boite); document.body.appendChild(fond);
    const premier = boite.querySelector('input,select,textarea'); if (premier) premier.focus();
    return { fermer, element: boite };
  };
  U.confirmer = function (titre, texte, libelleBouton) {
    return new Promise(ok => {
      let reponse = false;
      const m = U.modale(titre, [h('p', texte), h('div.actions',
        h('button.bouton', { type: 'button', onclick: () => { reponse = true; m.fermer(); } }, libelleBouton || 'Confirmer'),
        h('button.bouton.secondaire', { type: 'button', onclick: () => m.fermer() }, 'Annuler'))], { surFermeture: () => ok(reponse) });
    });
  };

  /* ---------- Formulaire ----------
     champs : [{nom, libelle, type:'texte'|'nombre'|'date'|'long'|'choix'|'case'|'fichier', options:[[valeur, libellé]], requis, aide, large}] */
  U.formulaire = function (champs, valeurs, surValidation, options) {
    options = options || {}; valeurs = valeurs || {};
    const f = h('form.formulaire', { novalidate: true });
    const controles = {};
    for (const c of champs) {
      if (c.titre) { f.appendChild(h('h3.plein', c.titre)); continue; }
      const idc = 'c-' + c.nom + '-' + Math.random().toString(36).slice(2, 7);
      const v = valeurs[c.nom] != null ? valeurs[c.nom] : (c.defaut != null ? c.defaut : '');
      let ctl;
      if (c.type === 'long') ctl = h('textarea', { id: idc, rows: c.lignes || 4, value: v });
      else if (c.type === 'choix') ctl = h('select', { id: idc }, (c.vide === false ? [] : [h('option', { value: '' }, '— choisir —')]).concat(c.options.map(o => h('option', { value: o[0], selected: String(o[0]) === String(v) }, o[1]))));
      else if (c.type === 'case') ctl = h('input', { id: idc, type: 'checkbox', checked: !!v });
      else if (c.type === 'fichier') ctl = h('input', { id: idc, type: 'file', multiple: c.multiple, accept: c.accept });
      else ctl = h('input', { id: idc, type: c.type === 'nombre' ? 'number' : c.type === 'date' ? 'date' : c.type === 'dateheure' ? 'datetime-local' : c.type === 'motdepasse' ? 'password' : c.type === 'email' ? 'email' : 'text', step: c.type === 'nombre' ? (c.pas || 'any') : null, value: v, min: c.min, max: c.max });
      if (c.requis) ctl.required = true;
      if (c.lectureSeule) ctl.disabled = true;
      ctl.name = c.nom; controles[c.nom] = ctl;
      f.appendChild(h('div.champ' + (c.large || c.type === 'long' ? '.plein' : '') + (c.type === 'case' ? '.case' : ''),
        c.type === 'case' ? [ctl, h('label', { for: idc }, c.libelle)] : [h('label', { for: idc }, c.libelle, c.requis ? h('span.requis', { title: 'Obligatoire' }, ' *') : null), ctl],
        c.aide ? h('p.aide', c.aide) : null));
    }
    const lire = () => {
      const r = {};
      for (const c of champs) {
        if (c.titre || c.lectureSeule) continue; const ctl = controles[c.nom];
        if (c.type === 'case') r[c.nom] = ctl.checked;
        else if (c.type === 'fichier') r[c.nom] = Array.from(ctl.files);
        else if (c.type === 'nombre') r[c.nom] = ctl.value === '' ? null : Number(ctl.value);
        else r[c.nom] = ctl.value === '' && (c.type === 'date' || c.type === 'dateheure' || c.type === 'choix') ? null : (typeof ctl.value === 'string' ? ctl.value.trim() : ctl.value);
      }
      return r;
    };
    const erreurZone = h('p.erreur-formulaire', { role: 'alert' });
    f.appendChild(erreurZone);
    if (surValidation) {
      f.appendChild(h('div.actions.plein', h('button.bouton', { type: 'submit' }, options.libelle || 'Enregistrer'),
        options.surAnnulation ? h('button.bouton.secondaire', { type: 'button', onclick: options.surAnnulation }, 'Annuler') : null, options.boutons || null));
      f.addEventListener('submit', async e => {
        e.preventDefault(); erreurZone.textContent = '';
        for (const c of champs) if (c.requis) { const ctl = controles[c.nom]; const videC = c.type === 'fichier' ? !ctl.files.length : !String(ctl.value).trim(); if (videC) { erreurZone.textContent = 'Le champ « ' + c.libelle + ' » est obligatoire.'; ctl.focus(); return; } }
        const b = f.querySelector('button[type=submit]'); b.disabled = true;
        try { await surValidation(lire()); } catch (err) { console.warn(err); erreurZone.textContent = err.message || String(err); } finally { b.disabled = false; }
      });
    }
    f.lire = lire; f.controles = controles;
    return f;
  };
  // ouvre un formulaire dans une fenêtre ; ferme et rafraîchit après enregistrement
  U.editer = function (titre, champs, valeurs, enregistrer, options) {
    let m;
    const f = U.formulaire(champs, valeurs, async v => { await enregistrer(v); m.fermer(); U.message('Enregistré.'); U.rafraichir(); }, Object.assign({ surAnnulation: () => m.fermer() }, options));
    m = U.modale(titre, f, options);
    return m;
  };

  /* ---------- Tableau ----------
     colonnes : [{titre, valeur: ligne => contenu, classe, num:true}] */
  U.tableau = function (colonnes, lignes, options) {
    options = options || {};
    if (!lignes.length) return U.vide(options.vide || 'Aucun élément pour le moment.');
    const t = h('table.tableau',
      options.legende ? h('caption', options.legende) : null,
      h('thead', h('tr', colonnes.map(c => h('th' + (c.num ? '.num' : ''), { scope: 'col' }, c.titre)))),
      h('tbody', lignes.map(l => {
        const tr = h('tr' + (options.classeLigne ? '.' + (options.classeLigne(l) || 'x') : ''), colonnes.map(c => h('td' + (c.num ? '.num' : '') + (c.classe ? '.' + c.classe : ''), c.valeur(l))));
        if (options.surClic) { tr.classList.add('cliquable'); tr.tabIndex = 0; tr.addEventListener('click', e => { if (!e.target.closest('button,a,input,select')) options.surClic(l); }); tr.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target === tr) options.surClic(l); }); }
        return tr;
      })));
    return h('div.tableau-zone', { tabindex: 0, role: 'region', 'aria-label': options.legende || 'Tableau' }, t);
  };

  U.onglets = function (liste, actif, surChoix) {
    return h('div.onglets', { role: 'tablist' }, liste.map(o => h('button' + (o[0] === actif ? '.actif' : ''), { type: 'button', role: 'tab', 'aria-selected': o[0] === actif ? 'true' : 'false', onclick: () => surChoix(o[0]) }, o[1])));
  };
  U.carte = function (titre, contenu, actions) {
    return h('section.carte', (titre || actions) ? h('div.carte-tete', titre ? h('h2', titre) : h('span'), actions ? h('div.actions', actions) : null) : null, contenu);
  };
  U.bouton = (libelle, action, classe, attrs) => h('button.bouton' + (classe ? '.' + classe : ''), Object.assign({ type: 'button', onclick: U.agir(action) }, attrs || {}), libelle);
  U.definition = paires => h('dl.fiche', paires.filter(Boolean).map(p => [h('dt', p[0]), h('dd', p[1] == null || p[1] === '' ? '—' : p[1])]));

  U.telechargerBlob = function (blob, nom) {
    const a = h('a', { href: URL.createObjectURL(blob), download: nom }); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    window.__dernierTelechargement = { nom, taille: blob.size, type: blob.type };
  };

  /* ---------- Navigation ---------- */
  const routes = [];
  U.route = (motif, ecran) => routes.push({ motif: new RegExp('^' + motif.replace(/:\w+/g, '([^/]+)') + '$'), ecran });
  U.aller = chemin => { if (location.hash === '#' + chemin) U.rafraichir(); else location.hash = chemin; };
  let jeton = 0;
  U.rafraichir = async function () {
    const chemin = (location.hash || '#/').slice(1).split('?')[0] || '/';
    const moi = ++jeton;
    const zone = document.getElementById('contenu');
    if (!D.utilisateur) { if (window.Ecrans) window.Ecrans.connexion(); return; }
    for (const r of routes) {
      const m = chemin.match(r.motif);
      if (m) {
        try {
          const y = window.scrollY;
          const noeud = await r.ecran.apply(null, m.slice(1).map(decodeURIComponent));
          if (moi !== jeton) return;
          zone.replaceChildren(noeud); window.scrollTo(0, U._garderDefilement ? y : 0); U._garderDefilement = false;
          if (window.Ecrans) window.Ecrans.majMenu(chemin);
        } catch (e) { console.warn(e); zone.replaceChildren(h('div.carte', h('h2', 'Action impossible'), h('p', e.message || String(e)))); }
        return;
      }
    }
    zone.replaceChildren(h('div.carte', h('h2', 'Page introuvable'), h('p', h('a', { href: '#/' }, 'Revenir au tableau de bord'))));
  };
  // rafraîchit sans remonter en haut de page
  U.recharger = () => { U._garderDefilement = true; return U.rafraichir(); };
  window.addEventListener('hashchange', () => U.rafraichir());

  U.param = cle => new URLSearchParams((location.hash.split('?')[1] || '')).get(cle);
  U.titrePage = (titre, sousTitre, actions) => h('header.titre-page', h('div', h('h1', titre), sousTitre ? h('p.sous-titre', sousTitre) : null), actions ? h('div.actions', actions) : null);
  U.fil = elements => h('nav.fil', { 'aria-label': 'Fil d\'Ariane' }, elements.map((e, i) => [i ? ' › ' : null, e[1] ? h('a', { href: '#' + e[1] }, e[0]) : h('span', e[0])]));

  window.U = U;
})();
