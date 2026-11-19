/* Page d'accueil publique (avant connexion) : en-tête, onglets d'information, annonces qui défilent,
   connexion avec aide, actualités de la collectivité et de l'éditeur. Écran d'administration des annonces. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans, CFG = window.CONFIG;
  const ONGLETS = [['solutions', 'Solutions'], ['se-former', 'Se former'], ['s-informer', 'S\'informer'], ['echanges', 'Échanges']];
  const THEMES = [['sombre', 'Vert lontan'], ['creme', 'Crème'], ['braise', 'Braise'], ['brique', 'Rouge brique']];
  const SOURCES = { collectivite: 'Collectivité', editeur: 'Nouveautés de l\'outil' };
  const DUREE = (CFG.carrousel && CFG.carrousel.duree_ms) || 6500;
  const FONDU = (CFG.carrousel && CFG.carrousel.fondu_ms != null) ? CFG.carrousel.fondu_ms : 120;
  const PHOTOS = [['img/photos/fournaise-vue-du-ciel.jpg', 'Le Piton de la Fournaise vu du ciel', 'photo Pouyot, CC BY-SA 4.0'], ['img/photos/maido-lever-du-soleil.jpg', 'Lever du soleil sur le Maïdo', 'photo Rémih, CC BY-SA 4.0'],
    ['img/photos/le-port-vue-du-ciel.jpg', 'Le Port vu du ciel', 'photo Ville du Port, CC BY-SA 4.0'], ['img/photos/mafate-depuis-le-grand-benare.jpg', 'Mafate depuis le Grand Bénare', 'photo Mamphi, CC BY-SA 3.0']];
  const CADRAGES = [['center 25%', 'Haut de la photo'], ['center 45%', 'Centre'], ['center 70%', 'Bas de la photo']];
  // En ligne, les photos des annonces sont dans le compartiment public 'accueil' : lues par adresse publique, sans connexion.
  const urlPublique = chemin => D.mode === 'supabase' && /^accueil\//.test(chemin || '') && D.urlPublique ? D.urlPublique(chemin) : null;
  async function sourceImage(d) {
    if (urlPublique(d.image_chemin)) return urlPublique(d.image_chemin);
    if (d.image_chemin) { try { const b = await D.telecharger(d.image_chemin); return b ? URL.createObjectURL(b) : null; } catch (e) { return null; } }
    return d.image || null;
  }

  /* ---------- Identité ---------- */
  E.logo = function (variante) {
    const nom = CFG.nomLogiciel || 'Marchés publics';
    const i = nom.lastIndexOf('.');
    const mot = i > 0 ? [nom.slice(0, i), h('i', nom.slice(i))] : [nom, h('i', '.')];
    return h('span.logo' + (variante === 'clair' ? '.clair' : ''),
      h('img', { src: variante === 'clair' ? 'img/vavang-clair.svg' : 'img/vavang.svg', alt: '' }),
      h('span.logo-texte', h('b', mot), h('small', 'par ' + (CFG.editeur || 'l\'entreprise.ai'))));
  };
  document.title = (CFG.nomLogiciel || 'Gestion des marchés publics') + ' — gestion des marchés publics';

  const aujourdhui = () => D.aujourdhui();
  const visible = a => a.actif !== false && (!a.debut || a.debut <= aujourdhui()) && (!a.fin || a.fin >= aujourdhui());
  async function annonces(type, toutes) {
    const l = await D.lister('annonces', { type });
    return (toutes ? l : l.filter(visible)).sort((a, b) => type === 'actualite' ? String(b.date).localeCompare(String(a.date)) : (a.ordre || 0) - (b.ordre || 0));
  }

  // Texte enrichi très simple : « ## » titre, « - » liste, ligne vide = nouveau paragraphe.
  // Typographie française : apostrophe courbe, espaces insécables avant : ; ? ! et entre nombre et unité.
  E.typo = t => String(t == null ? '' : t).replace(/'/g, '’').replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0').replace(/(\d) (€|%|h\b|min\b|jours?\b|mois\b|ans?\b)/g, '$1\u00a0$2');
  const enLigne = t => E.typo(t).split(/\*\*(.+?)\*\*/).map((m, i) => i % 2 ? h('strong', m) : m);
  // Texte enrichi : « ## » intertitre, « - » liste, « 1. » étapes, « > » encadré à retenir, **gras**.
  E.texteRiche = function (texte) {
    const blocs = []; let liste = null, para = [], encadre = [];
    const fermer = () => {
      if (para.length) { blocs.push(h('p', enLigne(para.join(' ')))); para = []; }
      if (liste) { blocs.push(liste); liste = null; }
      if (encadre.length) { blocs.push(h('aside.a-retenir', h('b', 'À retenir'), h('p', enLigne(encadre.join(' '))))); encadre = []; }
    };
    for (const brut of String(texte || '').split('\n')) {
      const l = brut.trim();
      if (!l) { fermer(); continue; }
      if (l.startsWith('## ')) { fermer(); blocs.push(h('h2', enLigne(l.slice(3)))); }
      else if (l.startsWith('> ')) { if (para.length || liste) { const e = encadre; encadre = []; fermer(); encadre = e; } encadre.push(l.slice(2)); }
      else if (/^(- |\d+\. )/.test(l)) {
        const num = /^\d+\. /.test(l);
        if (para.length) { blocs.push(h('p', enLigne(para.join(' ')))); para = []; }
        if (liste && (liste.tagName === 'OL') !== num) { blocs.push(liste); liste = null; }
        liste = liste || h(num ? 'ol' : 'ul'); liste.appendChild(h('li', enLigne(l.replace(/^(- |\d+\. )/, ''))));
      }
      else { if (liste) { blocs.push(liste); liste = null; } para.push(l); }
    }
    fermer();
    return h('div.texte-riche', blocs);
  };

  /* ---------- Support et pied de page ---------- */
  // Pas de ligne directe : le contact avec le support passe toujours par le guichet de demandes (rappel aux horaires du guichet).
  E.contacterSupport = () => U.aller('/guichet');
  const PIED = {
    'Accessibilité': 'La conformité aux règles d\'accessibilité numérique n\'a pas encore été évaluée : aucun audit n\'a été réalisé à ce jour. Signalez au support toute difficulté d\'accès.',
    'Mentions légales': () => 'Éditeur : ' + (CFG.editeur || 'l\'entreprise.ai') + ', entreprise individuelle, Saint-Paul (La Réunion).\nContact : ' + ((CFG.support || {}).email || '') + '.\nVersion de démonstration : les données affichées sont fictives.',
    'Données personnelles': 'Les données saisies appartiennent à la collectivité. Elles ne sont utilisées pour aucune autre fin et ne servent à entraîner aucun modèle d\'intelligence artificielle. L\'administrateur peut en obtenir l\'export complet à tout moment.',
    'Cookies': 'Ce site ne dépose aucun cookie de mesure d\'audience ni de publicité. La session de connexion est conservée dans le stockage de votre navigateur.'
  };
  function pied() {
    return [h('div.frise.accueil-pied-frise', { 'aria-hidden': 'true' }), h('footer.accueil-pied', h('a.lien', { href: '#/guichet' }, 'Contacter le support'), h('a.lien', { href: '#/info/credits-photos' }, 'Crédits photos'), Object.keys(PIED).map(k => h('button.lien', { type: 'button', onclick: () => U.modale(k, E.texteRiche(typeof PIED[k] === 'function' ? PIED[k]() : PIED[k])) }, k)),
      h('span', '© ' + new Date().getFullYear() + ' ' + (CFG.nomLogiciel ? CFG.nomLogiciel + ', une solution de ' : ''), h('a.lien-editeur', { href: CFG.siteEditeur || 'https://lentreprise.ai/', target: '_blank', rel: 'noopener' }, CFG.editeur || 'l\'entreprise.ai')))];
  }

  /* ---------- En-tête et onglets ---------- */
  // La rubrique « Contacter le support » de l'onglet Échanges est remplacée par un lien fixe vers le guichet de demandes,
  // en local comme en ligne (sans dépendre du contenu des annonces en base).
  const estRubriqueSupport = x => x.id === 'r-support' || /^contacter le support$/i.test(String(x.titre || '').trim());
  async function entete(ongletActif) {
    const rubriques = await annonces('rubrique');
    const sousBarre = h('nav.sous-onglets', { 'aria-label': 'Rubriques' });
    const onglets = h('div.onglets-site', { role: 'tablist', 'aria-label': 'Rubriques du site' });
    // Le survol colore l'onglet (CSS) sans le changer ; il change au clic, ou au clavier (flèches, Début, Fin), et reste sélectionné.
    const choisir = cle => {
      onglets.querySelectorAll('button').forEach(b => { const on = b.dataset.cle === cle; b.classList.toggle('actif', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
      let r = rubriques.filter(x => x.onglet === cle).concat(cle === 's-informer' ? [{ id: 'credits-photos', titre: 'Crédits photographiques' }] : []);
      if (cle === 'echanges') r = [{ lien: '#/guichet', titre: 'Contacter le support' }].concat(r.filter(x => !estRubriqueSupport(x)));
      sousBarre.replaceChildren(...(r.length ? r.map((x, i) => [i ? h('span.point', '•') : null, h('a', { href: x.lien || '#/info/' + x.id }, x.titre)]).flat().filter(Boolean) : [h('span.aide', 'Aucune rubrique publiée.')]));
    };
    const auClavier = e => {
      const b = [...onglets.querySelectorAll('button')]; const k = b.indexOf(e.currentTarget);
      const n = { ArrowRight: k + 1, ArrowLeft: k - 1, Home: 0, End: b.length - 1 }[e.key]; if (n === undefined) return;
      e.preventDefault(); const c = b[(n + b.length) % b.length]; choisir(c.dataset.cle); c.focus();
    };
    ONGLETS.forEach(o => onglets.appendChild(h('button', { type: 'button', role: 'tab', id: 'onglet-' + o[0], 'data-cle': o[0], onclick: () => choisir(o[0]), onkeydown: auClavier }, o[1])));
    choisir(ongletActif || 'solutions');
    return h('header.accueil-tete',
      h('div.accueil-haut', await E.blocMarques()),
      h('div.barre-onglets', onglets, sousBarre));
  }
  E.enteteAccueil = entete; E.piedAccueil = pied;

  /* ---------- Carrousel d'annonces ---------- */
  let minuteur = null;
  E.arreterCarrousel = () => { if (minuteur) clearInterval(minuteur); minuteur = null; };
  function decor(theme) {
    // Motif graphique propre à la marque : silhouette de piton, soleil et lignes de niveau.
    const c = { sombre: ['#E8871E', '#2E7352', '#F6F1E4'], creme: ['#E8871E', '#DCD3BE', '#1F5B3F'], braise: ['#1F5B3F', '#F2A65A', '#F6F1E4'], brique: ['#E8871E', '#C8613F', '#F6F1E4'] }[theme] || ['#E8871E', '#2E7352', '#F6F1E4'];
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 400 300'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'decor');
    svg.innerHTML = '<circle cx="270" cy="105" r="58" fill="' + c[0] + '" opacity=".9"/>'
      + [0, 1, 2, 3, 4].map(i => '<path d="M0 ' + (215 + i * 18) + ' Q 200 ' + (195 + i * 18) + ' 400 ' + (215 + i * 18) + '" stroke="' + c[1] + '" stroke-width="2" fill="none"/>').join('')
      + '<path d="M40 300 L170 120 L205 165 L240 95 L360 300 Z" fill="' + c[1] + '"/>'
      + '<path d="M240 95 L262 128 L250 124 L240 140 L228 122 L222 126 Z" fill="' + c[2] + '" opacity=".55"/>';
    return svg;
  }
  async function carrousel(rubriques) {
    const diapos = await annonces('carrousel');
    if (!diapos.length) return h('div.carrousel.vide', h('p', 'Aucune annonce publiée pour le moment.'));
    let i = 0;
    const piste = h('div.piste', { 'aria-live': 'polite' });
    const points = h('div.points', { role: 'tablist', 'aria-label': 'Annonces' });
    const montrer = n => {
      i = (n + diapos.length) % diapos.length;
      piste.querySelectorAll('.diapo').forEach((d, k) => { d.classList.toggle('active', k === i); d.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
      points.querySelectorAll('button').forEach((b, k) => { b.classList.toggle('actif', k === i); b.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
      compteur.textContent = (i + 1) + ' / ' + diapos.length;
    };
    const sources = await Promise.all(diapos.map(sourceImage));
    diapos.forEach((d, k) => {
      const r = rubriques.find(x => x.id === d.lien_rubrique);
      const cible = r ? '#/info/' + r.id : (d.lien_externe || null);
      const src = sources[k];
      piste.appendChild(h('article.diapo.' + (d.theme || 'sombre') + (src ? '.photo' : ''), { 'aria-hidden': k !== 0 ? 'true' : 'false', style: src ? { backgroundImage: 'url("' + src + '")', backgroundPosition: d.cadrage || 'center 45%' } : null },
        h('div.diapo-texte',
          d.surtitre ? h('p.surtitre', d.surtitre) : null, h('h2', d.titre), d.texte ? h('p.diapo-desc', d.texte) : null,
          d.date_evenement ? h('p.date-pastille', d.date_evenement) : null,
          cible && d.bouton ? h('a.bouton-diapo', Object.assign({ href: cible }, d.lien_externe && !r ? { target: '_blank', rel: 'noopener' } : {}), d.bouton + ' →') : null),
        src ? null : h('div.diapo-visuel', decor(d.theme))));
      points.appendChild(h('button', { type: 'button', role: 'tab', 'aria-label': 'Annonce ' + (k + 1) + ' : ' + d.titre, onclick: () => { montrer(k); relancer(); } }, String(k + 1)));
    });
    const compteur = h('span.compteur');
    const precedent = h('button.fleche-cote.gauche', { type: 'button', 'aria-label': 'Annonce précédente', onclick: () => { montrer(i - 1); relancer(); } }, '‹');
    const suivant = h('button.fleche-cote.droite', { type: 'button', 'aria-label': 'Annonce suivante', onclick: () => { montrer(i + 1); relancer(); } }, '›');
    const pause = h('button.bouton-pause', { type: 'button', 'aria-label': 'Mettre en pause le défilement', 'aria-pressed': 'false', onclick: () => { arrete = !arrete; pause.setAttribute('aria-pressed', String(arrete)); pause.textContent = arrete ? '▶' : '❚❚'; relancer(); } }, '❚❚');
    let arrete = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, survol = false;
    if (arrete) { pause.textContent = '▶'; pause.setAttribute('aria-pressed', 'true'); }
    const relancer = () => {
      E.arreterCarrousel();
      if (arrete || diapos.length < 2) return;
      minuteur = setInterval(() => { if (!document.body.contains(piste)) return E.arreterCarrousel(); if (!survol && !document.hidden) montrer(i + 1); }, DUREE);
    };
    const bloc = h('section.carrousel', { style: { '--fondu': FONDU + 'ms' }, 'aria-roledescription': 'carrousel', 'aria-label': 'Annonces', onmouseenter: () => { survol = true; }, onmouseleave: () => { survol = false; }, onfocusin: () => { survol = true; }, onfocusout: () => { survol = false; } },
      piste, diapos.length > 1 ? [precedent, suivant, pause] : null);
    montrer(0); relancer();
    return bloc;
  }

  /* ---------- Actualités ---------- */
  function ouvrirActu(a) {
    U.modale(a.titre, [h('p.aide', SOURCES[a.source] + ' — ' + U.date(a.date)), E.texteRiche(a.contenu || a.texte)]);
  }
  function blocActus(titre, liste, ton, sousTitre) {
    return h('section.cadre-actus' + (ton ? '.' + ton : ''),
      h('h2', h('span.pastille'), titre), sousTitre ? h('p.sous-actus', sousTitre) : null,
      liste.length ? h('ul.liste-actus', liste.slice(0, 3).map(a => h('li',
        h('button.lien-actu', { type: 'button', onclick: () => ouvrirActu(a) }, h('span.date-actu', U.date(a.date).slice(0, 5)), h('b', a.titre)),
        a.texte ? h('p', a.texte) : null))) : h('p.vide', 'Aucune actualité.'),
      liste.length > 3 ? h('button.bouton.secondaire.petit', { type: 'button', onclick: () => U.modale(titre, h('ul.liste-actus', liste.map(a => h('li', h('button.lien-actu', { type: 'button', onclick: () => ouvrirActu(a) }, h('span.date-actu', U.date(a.date)), h('b', a.titre)), a.texte ? h('p', a.texte) : null)))) }, 'Toutes les actualités') : null);
  }

  /* ---------- Connexion ---------- */
  // Clé de double authentification de l'administrateur de démonstration (en ligne) : volontairement publique.
  function blocMfaDemo() {
    const admin = (window.Demo.COMPTES || []).find(c => c.role === 'administrateur');
    const cle = String(CFG.demoMfaSecret).replace(/\s+/g, '').toUpperCase();
    const uri = 'otpauth://totp/' + encodeURIComponent((CFG.nomLogiciel || 'vavang') + ':' + (admin ? admin.email : 'administrateur')) + '?secret=' + cle + '&issuer=' + encodeURIComponent(CFG.nomLogiciel || 'vavang') + '&algorithm=SHA1&digits=6&period=30';
    const qr = h('div', { role: 'img', 'aria-label': 'Code QR de la clé de démonstration de l\'administrateur' });
    D.chargerScript('vendor/qrcode.js').then(() => { const q = qrcode(0, 'M'); q.addData(uri); q.make(); qr.innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: false }); }).catch(() => {});
    return h('div.mfa-demo', h('p.aide-sous', h('b', 'Administrateur : '), 'double authentification réelle, clé volontairement publique pour la démo. Scannez ce code avec votre application d\'authentification, ou saisissez la clé, puis entrez le code à 6 chiffres à la connexion.'),
      qr, h('p', 'Clé : ', h('code', cle.replace(/(.{4})/g, '$1 ').trim())));
  }
  function blocConnexion() {
    // En ligne : mot de passe déjà vérifié, il ne manque que le code de double authentification (session en attente).
    const enAttente = D.mode === 'supabase' && !!D.mfaEnAttente;
    const f = U.formulaire([
      { nom: 'email', libelle: 'Adresse électronique', type: 'email', requis: !enAttente },
      { nom: 'mdp', libelle: 'Mot de passe', type: 'motdepasse', requis: !enAttente },
      { nom: 'code', libelle: 'Code de vérification', aide: 'Les 6 chiffres affichés par votre application d\'authentification.' }
    ], {}, async v => {
      if (enAttente && !v.code) throw new Error('Saisissez le code à 6 chiffres affiché par votre application d\'authentification.');
      try { await D.connexion(v.email, v.mdp, v.code); }
      catch (e) { if (e.mfa) { champCode.hidden = false; f.controles.code.focus(); } throw e; }
      if (D.mode === 'supabase' && E.viderIdentite) E.viderIdentite();
      location.hash = '/'; E.menu(); U.rafraichir();
    }, { libelle: 'Se connecter' });
    const champCode = f.controles.code.closest('.champ'); champCode.hidden = !enAttente;
    if (enAttente) {
      f.controles.email.closest('.champ').hidden = true; f.controles.mdp.closest('.champ').hidden = true;
      f.prepend(h('p.note-info.plein', 'Mot de passe vérifié. Saisissez le code de double authentification pour terminer la connexion. ',
        h('button.lien', { type: 'button', onclick: U.agir(async () => { await D.deconnexion(); D.mfaEnAttente = false; U.rafraichir(); }) }, 'Changer de compte')));
    }
    f.controles.code.setAttribute('inputmode', 'numeric'); f.controles.code.setAttribute('autocomplete', 'one-time-code');
    // Connexion unique (SSO) : compte externe déjà associé à un compte vavang dans « Ma sécurité ».
    const NOMS_SSO = { github: 'GitHub', google: 'Google', azure: 'Microsoft' };
    if (!enAttente && D.ssoFournisseurs && D.ssoFournisseurs().length) {
      f.append(h('div.sso', h('p.aide-sous', 'ou'),
        ...D.ssoFournisseurs().map(p => U.bouton('Se connecter avec ' + (NOMS_SSO[p] || p), () => D.connexionSso(p), 'secondaire')),
        h('p.aide', 'Connexion unique de test : le compte externe doit d\'abord être associé à un compte vavang (Ma sécurité). Un compte externe inconnu est refusé.')));
    }
    if (D.erreurSso) { f.prepend(h('p.note-info.alerte.plein', { role: 'alert' }, D.erreurSso)); D.erreurSso = null; }
    const demo = CFG.afficherComptesDemo && window.Demo;
    const aide = h('div.aide-connexion', { id: 'aide-connexion', hidden: true, role: 'dialog', 'aria-label': 'Aide à la connexion' },
      h('div.aide-tete', h('b', 'Aide à la connexion'), h('button.lien', { type: 'button', 'aria-label': 'Fermer l\'aide', onclick: () => basculer(false) }, '✕')),
      h('p', 'Connectez-vous avec l\'adresse et le mot de passe remis par l\'administrateur de votre collectivité.'),
      h('p', h('b', 'Mot de passe oublié ? '), 'Adressez-vous à l\'administrateur, qui le réinitialise.'),
      h('p', h('b', 'Un blocage ? '), 'Déposez une demande au ', h('a', { href: '#/guichet' }, 'guichet du support'), ' : l\'équipe vous rappelle aux horaires du guichet.'),
      demo ? [h('p.aide-sous', 'Comptes de démonstration — données fictives. Cliquez sur un profil :'),
        h('div.profils-demo', window.Demo.COMPTES.map(c => h('button', { type: 'button', onclick: () => { f.controles.email.value = c.email; f.controles.mdp.value = c.mot_de_passe; basculer(false); f.controles.mdp.focus(); } }, h('b', D.ROLES[c.role]), h('span', c.nom)))),
        D.mode === 'supabase' ? h('p.aide-sous', 'Comptes partagés entre les visiteurs, remis à zéro chaque nuit à 3 h (heure de La Réunion).') : null,
        D.mode === 'supabase' && CFG.demoMfaSecret ? blocMfaDemo() : null] : null);
    const rond = h('button.aide-rond', { type: 'button', 'aria-label': 'Aide à la connexion', 'aria-expanded': 'false', 'aria-controls': 'aide-connexion', onclick: () => basculer(aide.hidden) }, '?');
    const basculer = ouvrir => { aide.hidden = !ouvrir; rond.setAttribute('aria-expanded', String(ouvrir)); };
    return h('section.cadre-connexion', h('div.connexion-tete', h('h2', 'Connexion'), rond), aide,
      h('p.aide', 'Espace réservé aux agents habilités.'), f,
      D.mode === 'local' ? h('p.aide.mode', 'Démonstration : les données restent dans ce navigateur.') : null);
  }

  /* ---------- Pages publiques ---------- */
  // Crédits des photos des annonces, regroupés dans une section à part (exigés par les licences Creative Commons).
  // Crédits des photos (annonces et articles), sur une page à part rangée sous « S'informer » et liée depuis le pied de page.
  async function pageCredits() {
    const photos = (await annonces('carrousel')).concat(await annonces('rubrique')).filter(d => d.credit && (d.image || d.image_chemin));
    const credits = Array.from(new Set(photos.map(d => d.credit)));
    return h('div.accueil', await entete('s-informer'),
      h('main.article-page',
        h('nav.fil', { 'aria-label': 'Fil d\'Ariane' }, h('a', { href: '#/' }, 'Accueil'), ' › ', h('span', 'S’informer'), ' › ', h('span', 'Crédits photographiques')),
        h('header.article-tete', h('div.article-meta', U.badge('S’informer', 'info')), h('h1', 'Crédits photographiques'),
          h('p.chapeau', E.typo('Les photos de La Réunion qui illustrent ce site, leurs auteurs et leurs licences.'))),
        h('div.article-corps', h('div.texte-riche',
          credits.length ? h('ul', credits.map(t => h('li', E.typo(t)))) : h('p', 'Aucune photo sous licence n’est publiée pour le moment.'),
          h('p', E.typo('Les photos de la bibliothèque proviennent de Wikimedia Commons. Elles sont publiées sous licence Creative Commons « Attribution — Partage dans les mêmes conditions » (CC BY-SA), dans la version indiquée pour chacune : réutilisation libre, à condition de citer l’auteur et la licence.')))),
        h('div.article-pied', h('a', { href: '#/' }, '← Retour à l\'accueil'))),
      pied());
  }
  async function pageAccueil() {
    const [rubriques, actus] = await Promise.all([annonces('rubrique'), annonces('actualite')]);
    return h('div.accueil', await entete(),
      h('main.accueil-corps', await carrousel(rubriques),
        h('div.accueil-bas',
          blocActus('À la une', actus.filter(a => a.source === 'collectivite'), 'vert', CFG.organisme || 'La collectivité'),
          blocActus('Actualités de l\'outil', actus.filter(a => a.source !== 'collectivite'), 'braise', 'Nouveautés, guides et rendez-vous'),
          blocConnexion())),
      pied());
  }
  async function sourcePhoto(d) { if (!d) return null; if (urlPublique(d.image_chemin)) return urlPublique(d.image_chemin); if (d.image_chemin) { try { const b = await D.telecharger(d.image_chemin); return b ? URL.createObjectURL(b) : null; } catch (e) { return null; } } return d.image || null; }
  async function pageRubrique(id) {
    const r = (await D.lister('annonces', { id }))[0];
    if (!r || r.type !== 'rubrique' || !visible(r)) return h('div.accueil', await entete(), h('main.article-page', h('h1', 'Page introuvable'), h('p', h('a', { href: '#/' }, 'Revenir à l\'accueil'))), pied());
    const toutes = await annonces('rubrique');
    const onglet = (ONGLETS.find(o => o[0] === r.onglet) || [])[1];
    const candidats = toutes.filter(x => x.id !== r.id && x.onglet === r.onglet).slice(0, 1).concat(toutes.filter(x => x.onglet !== r.onglet));
    const vues = new Set([r.image || r.image_chemin]); const autres = [];
    for (const x of candidats) { const cle = x.image || x.image_chemin; if (autres.length < 3 && !vues.has(cle)) { autres.push(x); vues.add(cle); } }
    for (const x of candidats) if (autres.length < 3 && !autres.includes(x)) autres.push(x);
    const couverture = await sourcePhoto(r);
    const vignettes = await Promise.all(autres.map(sourcePhoto));
    const mots = String(r.contenu || '').split(/\s+/).length;
    const lecture = r.lecture_min || Math.max(1, Math.round(mots / 200));
    return h('div.accueil', await entete(r.onglet),
      h('main.article-page',
        h('nav.fil', { 'aria-label': 'Fil d\'Ariane' }, h('a', { href: '#/' }, 'Accueil'), ' › ', h('span', onglet), ' › ', h('span', E.typo(r.titre))),
        h('header.article-tete',
          h('div.article-meta', U.badge(onglet, 'info'), r.mis_a_jour ? h('span', 'Mis à jour le ' + U.date(r.mis_a_jour)) : null, h('span', lecture + '\u00a0min de lecture')),
          h('h1', E.typo(r.titre)), r.resume ? h('p.chapeau', E.typo(r.resume)) : null),
        couverture ? h('figure.article-couverture', h('img', { src: couverture, alt: '', style: { objectPosition: r.cadrage || 'center 45%' } }), r.credit ? h('figcaption', E.typo(r.credit)) : null) : null,
        h('div.article-corps', E.texteRiche(r.contenu)),
        autres.length ? h('section.a-lire-aussi', h('h2', 'À lire aussi'), h('div.cartes-articles', autres.map((x, k) => h('a.carte-article', { href: '#/info/' + x.id },
          vignettes[k] ? h('img', { src: vignettes[k], alt: '', loading: 'lazy', style: { objectPosition: x.cadrage || 'center 45%' } }) : h('div.vignette-vide'),
          h('div', h('span.carte-onglet', (ONGLETS.find(o => o[0] === x.onglet) || [])[1]), h('b', E.typo(x.titre)), x.resume ? h('p', E.typo(x.resume)) : null))))) : null,
        h('div.article-pied', h('a', { href: '#/' }, '← Retour à l\'accueil'), h('a', { href: '#/' }, 'Se connecter à l\'espace marchés publics'))),
      pied());
  }
  E.public = async function (chemin) {
    document.getElementById('menu').hidden = true; document.body.classList.add('public'); E.arreterCarrousel();
    const m = (chemin || '').match(/^\/info\/([^/?]+)/);
    // Guichet de demandes : route publique, et ancienne rubrique « Contacter le support » redirigée vers lui.
    const guichet = /^\/guichet(\/|\?|$)/.test(chemin || '') || (m && decodeURIComponent(m[1]) === 'r-support');
    const zone = document.getElementById('contenu');
    try { zone.replaceChildren(guichet ? await E.pageGuichet() : m ? (m[1] === 'credits-photos' ? await pageCredits() : await pageRubrique(decodeURIComponent(m[1]))) : await pageAccueil()); window.scrollTo(0, 0); }
    catch (e) { console.warn(e); zone.replaceChildren(h('div.carte', h('h2', 'Page indisponible'), h('p', e.message))); }
  };
  E.connexion = () => E.public((location.hash || '#/').slice(1));

  // Une fois connecté, les rubriques restent consultables dans l'application.
  U.route('/info/:id', async id => {
    const r = (await D.lister('annonces', { id }))[0];
    if (!r || r.type !== 'rubrique') throw new Error('Rubrique introuvable.');
    return h('div', U.titrePage(r.titre, r.resume), U.carte(null, E.texteRiche(r.contenu)));
  });

  /* ---------- Administration de la page d'accueil ---------- */
  E.accueilAdmin = async function () {
    D.exiger('accueil.ecrire');
    const type = U.param('type') || 'carrousel';
    const toutes = await annonces(type, true);
    const rubriques = await annonces('rubrique', true);
    const tr = (action, a) => ({ action, libelle: ({ carrousel: 'Annonce', actualite: 'Actualité', rubrique: 'Rubrique' })[a.type] + ' — ' + a.titre });
    const periode = [{ nom: 'debut', libelle: 'Publier à partir du', type: 'date' }, { nom: 'fin', libelle: 'Retirer après le', type: 'date' }, { nom: 'actif', libelle: 'Publiée', type: 'case', defaut: true }];
    const champs = {
      carrousel: [{ nom: 'surtitre', libelle: 'Surtitre', aide: 'Un mot : Nouveau, Collectivité, Se former…' }, { nom: 'theme', libelle: 'Couleur', type: 'choix', vide: false, options: THEMES },
        { nom: 'titre', libelle: 'Titre', requis: true, large: true }, { nom: 'texte', libelle: 'Texte (deux lignes au plus)', type: 'long', lignes: 2 },
        { nom: 'date_evenement', libelle: 'Date ou période affichée', aide: 'Texte libre, par exemple « Du 1er au 12 décembre »' }, { nom: 'bouton', libelle: 'Libellé du bouton', defaut: 'En savoir plus' },
        { nom: 'lien_rubrique', libelle: 'Le bouton ouvre la rubrique', type: 'choix', options: rubriques.map(r => [r.id, (ONGLETS.find(o => o[0] === r.onglet) || [, ''])[1] + ' › ' + r.titre]) },
        { nom: 'lien_externe', libelle: 'ou une adresse internet', aide: 'Utilisée seulement si aucune rubrique n\'est choisie.' },
        { titre: 'Photo de fond' },
        { nom: 'image', libelle: 'Photo de la bibliothèque', type: 'choix', options: PHOTOS.map(p => [p[0], p[1]]), aide: 'Laisser vide pour le dessin du piton.' },
        { nom: 'photo_fichier', libelle: 'ou votre propre photo (JPG, PNG, WEBP)', type: 'fichier', accept: 'image/jpeg,image/png,image/webp', aide: 'Elle remplace la photo de la bibliothèque. Vérifiez que vous avez le droit de la diffuser.' },
        { nom: 'cadrage', libelle: 'Partie de la photo à montrer', type: 'choix', vide: false, options: CADRAGES },
        { nom: 'credit', libelle: 'Crédit de la photo', large: true, aide: 'Affiché dans la section « Crédits photographiques » en bas de la page d\'accueil. Obligatoire pour les photos sous licence libre : sujet, auteur, licence.' }].concat(periode),
      actualite: [{ nom: 'source', libelle: 'Bloc', type: 'choix', vide: false, options: Object.entries(SOURCES) }, { nom: 'date', libelle: 'Date', type: 'date', requis: true, defaut: aujourdhui() },
        { nom: 'titre', libelle: 'Titre', requis: true, large: true }, { nom: 'texte', libelle: 'Résumé (affiché sur l\'accueil)', type: 'long', lignes: 2 },
        { nom: 'contenu', libelle: 'Texte complet', type: 'long', lignes: 8, aide: '« ## » en début de ligne pour un intertitre, « - » pour une liste.' }].concat(periode),
      rubrique: [{ nom: 'onglet', libelle: 'Onglet', type: 'choix', vide: false, options: ONGLETS }, { nom: 'titre', libelle: 'Titre', requis: true }, { nom: 'resume', libelle: 'Chapeau', large: true },
        { nom: 'contenu', libelle: 'Contenu', type: 'long', lignes: 12, aide: '« ## » en début de ligne pour un intertitre, « - » pour une liste, une ligne vide pour un nouveau paragraphe.' }, { titre: 'Photo de couverture' }, { nom: 'image', libelle: 'Photo de la bibliothèque', type: 'choix', options: PHOTOS.map(p => [p[0], p[1]]) },
        { nom: 'photo_fichier', libelle: 'ou votre propre photo (JPG, PNG, WEBP)', type: 'fichier', accept: 'image/jpeg,image/png,image/webp' }, { nom: 'cadrage', libelle: 'Partie de la photo à montrer', type: 'choix', vide: false, options: CADRAGES },
        { nom: 'credit', libelle: 'Crédit de la photo', large: true }, { nom: 'lecture_min', libelle: 'Temps de lecture (minutes)', type: 'nombre' }, { nom: 'actif', libelle: 'Publiée', type: 'case', defaut: true }]
    }[type];
    const memeGroupe = a => toutes.filter(x => type !== 'rubrique' || x.onglet === a.onglet);
    const deplacer = async (a, sens) => {
      const g = memeGroupe(a); const k = g.findIndex(x => x.id === a.id); const b = g[k + sens]; if (!b) return;
      await D.modifier('annonces', a.id, { ordre: b.ordre }, false); await D.modifier('annonces', b.id, { ordre: a.ordre === b.ordre ? a.ordre + sens : a.ordre }, false);
      await D.journal('Changement d\'ordre sur la page d\'accueil', 'annonces', a.id, a.titre); U.recharger();
    };
    const etat = a => !a.actif ? U.badge('Non publiée', 'neutre') : visible(a) ? U.badge('En ligne', 'ok') : U.badge(a.debut > aujourdhui() ? 'Programmée' : 'Expirée', 'alerte');
    const colonnes = (type === 'actualite' ? [{ titre: 'Date', classe: 'etroit', valeur: a => U.date(a.date) }, { titre: 'Bloc', valeur: a => SOURCES[a.source] }] : [{ titre: 'Ordre', classe: 'etroit', valeur: a => [U.bouton('↑', () => deplacer(a, -1), 'secondaire.petit', { 'aria-label': 'Monter' }), ' ', U.bouton('↓', () => deplacer(a, 1), 'secondaire.petit', { 'aria-label': 'Descendre' })] }])
      .concat(type === 'rubrique' ? [{ titre: 'Onglet', valeur: a => (ONGLETS.find(o => o[0] === a.onglet) || [, ''])[1] }] : [])
      .concat([{ titre: 'Titre', valeur: a => [h('b', a.titre), a.texte || a.resume ? h('div.aide', a.texte || a.resume) : null] },
        type === 'carrousel' ? { titre: 'Couleur', valeur: a => (THEMES.find(t => t[0] === a.theme) || [, ''])[1] } : null,
        { titre: 'Période', valeur: a => a.debut || a.fin ? (a.debut ? 'du ' + U.date(a.debut) + ' ' : '') + (a.fin ? 'au ' + U.date(a.fin) : '') : '—' },
        { titre: 'État', valeur: etat },
        type !== 'actualite' ? { titre: 'Photo', valeur: a => a.image_chemin ? 'Photo déposée' : a.image ? (PHOTOS.find(p => p[0] === a.image) || [, 'Bibliothèque'])[1] : 'Dessin' } : null,
        { titre: '', classe: 'etroit', valeur: a => [U.bouton('Modifier', () => U.editer('Modifier', champs, a, async v => D.modifier('annonces', a.id, await preparerPhoto(v, a), tr('Modification de la page d\'accueil', a)), { large: true }), 'secondaire.petit'), ' ',
          U.bouton(a.actif ? 'Retirer' : 'Publier', async () => { await D.modifier('annonces', a.id, { actif: !a.actif }, tr(a.actif ? 'Retrait de la page d\'accueil' : 'Publication sur la page d\'accueil', a)); U.recharger(); }, 'secondaire.petit'), ' ',
          U.bouton('Supprimer', async () => { if (await U.confirmer('Supprimer', 'Supprimer « ' + a.titre + ' » ?', 'Supprimer')) { await D.supprimer('annonces', a.id, tr('Suppression d\'un élément de la page d\'accueil', a)); U.recharger(); } }, 'danger.petit')] }].filter(Boolean));
    // Photo : choix dans la bibliothèque, ou dépôt d'un fichier conservé dans le stockage de l'application.
    async function preparerPhoto(v, avant) {
      const f = (v.photo_fichier || [])[0]; delete v.photo_fichier;
      if (type === 'actualite') return v;
      if (f) { if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error('Format de photo non accepté : JPG, PNG ou WEBP.'); if (f.size > 4 * 1024 * 1024) throw new Error('Photo trop lourde : 4 Mo au plus.'); v.image_chemin = await D.deposer(f, 'accueil'); v.image = null; }
      else if (v.image && avant && avant.image_chemin) v.image_chemin = null;
      if (v.image && !v.credit) { const p = PHOTOS.find(x => x[0] === v.image); if (p) v.credit = p[1] + ' — ' + p[2]; }
      return v;
    }
    const nouveau = () => U.editer({ carrousel: 'Nouvelle annonce', actualite: 'Nouvelle actualité', rubrique: 'Nouvelle rubrique' }[type], champs, { theme: 'sombre', source: 'collectivite', cadrage: 'center 45%' }, async v => {
      v = await preparerPhoto(v, null);
      const max = Math.max(0, ...memeGroupe(v).map(x => x.ordre || 0));
      return D.creer('annonces', Object.assign({ type, ordre: max + 1, auteur_nom: D.utilisateur.nom }, v), tr('Ajout sur la page d\'accueil', Object.assign({ type }, v)));
    }, { large: true });
    const apercu = async () => { const m = U.modale('Aperçu de la page d\'accueil', h('div.apercu-accueil', await pageAccueil()), { large: true, surFermeture: E.arreterCarrousel }); m.element.classList.add('tres-large'); };
    return h('div', U.titrePage('Page d\'accueil et annonces', 'Ce que voient les agents avant de se connecter. Chaque modification est tracée au journal.', [U.bouton('Aperçu de la page d\'accueil', apercu, 'secondaire')]),
      U.onglets([['carrousel', 'Annonces qui défilent'], ['actualite', 'Actualités'], ['rubrique', 'Rubriques des onglets']], type, t => U.aller('/accueil-admin?type=' + t)),
      U.carte(null, [type === 'carrousel' ? h('p.aide', 'Les annonces publiées défilent toutes les ' + (DUREE / 1000) + ' secondes, dans l\'ordre ci-dessous. Une période de publication les retire automatiquement.') : null,
        type === 'actualite' ? h('p.aide', 'Les trois actualités les plus récentes de chaque bloc s\'affichent sous les annonces ; les autres restent accessibles par « Toutes les actualités ».') : null,
        type === 'rubrique' ? h('p.aide', 'Les rubriques apparaissent sous les onglets Solutions, Se former, S\'informer et Échanges.') : null,
        U.tableau(colonnes, toutes, { vide: 'Rien de publié pour le moment.' })], [U.bouton({ carrousel: 'Nouvelle annonce', actualite: 'Nouvelle actualité', rubrique: 'Nouvelle rubrique' }[type], nouveau, 'accent')]));
  };
  U.route('/accueil-admin', E.accueilAdmin);
})();
