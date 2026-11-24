/* Compléments : centre de notifications, circuit du DCE et critères d'évaluation paramétrables,
   synthèse par candidat (assemblée sans IA), révision des prix par formule. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  /* ================= Centre de notifications ================= */
  E.notifier = async function (ids, texte, lien, cid) {
    const moi = D.utilisateur && D.utilisateur.id;
    for (const id of Array.from(new Set(ids)).filter(x => x && x !== moi))
      await D.creer('notifications', { destinataire_id: id, texte, lien: lien || null, consultation_id: cid || null, lu: false, date: D.maintenant(), emetteur_nom: D.utilisateur ? D.utilisateur.nom : '' }, false);
    E.majCloche();
  };
  // Notifie les agents qui détiennent un droit (et qui voient le dossier, s'il y en a un).
  E.notifierDroit = async function (droit, texte, lien, cid) {
    const [profils, hab, aff, cons] = await Promise.all([D.lister('profils'), D.lister('habilitations'), cid ? D.lister('affectations', { consultation_id: cid }) : [], cid ? D.lire('consultations', cid) : null]);
    const roles = r => hab.filter(x => x.role === r).map(x => x.droit);
    const ids = profils.filter(p => p.actif !== false && roles(p.role).includes(droit) && (!cid || roles(p.role).includes('consultations.toutes') || aff.some(a => a.profil_id === p.id) || (cons && cons.cree_par === p.id))).map(p => p.id);
    await E.notifier(ids, texte, lien, cid);
  };
  // Notifications déclenchées par les actions tracées au journal.
  const journalOrigine = D.journal;
  D.journal = async function (action, type, id, libelle, detail, cid) {
    await journalOrigine.apply(this, arguments);
    try {
      if (!D.utilisateur || !action) return;
      if (/^(Renvoi d'une note à l'analyste|Réouverture d'une note validée)/.test(action)) {
        const n = await D.lire('notes', id); if (n) await E.notifier([n.analyste_id], 'Note à revoir — ' + libelle, '/consultation/' + cid + '/analyse?lot=' + n.lot_id + '&vue=notation&offre=' + n.offre_id, cid);
      } else if (/^(Analyse soumise à la relecture|Analyse renvoyée|Analyse validée|Réouverture de l'analyse)/.test(action)) {
        const a = await D.lire('analyses', id); const lien = '/consultation/' + cid + '/analyse?lot=' + (a ? a.lot_id : '') + '&vue=synthese';
        if (action.startsWith('Analyse soumise') || action.startsWith('Réouverture')) await E.notifierDroit('analyse.valider', 'Analyse à valider — ' + libelle, lien, cid);
        else if (action.startsWith('Analyse renvoyée')) await E.notifierDroit('analyse.saisir', 'Analyse renvoyée par le valideur — ' + libelle, lien, cid);
        else await E.notifierDroit('rapport.rediger', 'Analyse validée, rapport à rédiger — ' + libelle, '/consultation/' + cid + '/rapport?lot=' + (a ? a.lot_id : ''), cid);
      }
      // Journal des calculs : chaque événement qui change une note ou un montant pris en compte relance le calcul, horodaté.
      if (/^(Verrouillage de la grille|Validation d'une note|Réouverture d'une note validée|Validation du montant|Réouverture du montant|Décision d'écarter|Réintégration de l'offre|Analyse validée)/.test(action) && cid) {
        let lotId = null;
        if (type === 'notes') lotId = (await D.lire('notes', id) || {}).lot_id;
        else if (type === 'offres') lotId = (await D.lire('offres', id) || {}).lot_id;
        else if (type === 'analyses') lotId = (await D.lire('analyses', id) || {}).lot_id;
        else if (type === 'grilles') lotId = (await D.lire('grilles', id) || {}).lot_id;
        if (lotId) await E.enregistrerCalcul(lotId, action);
      }
      if (/^Validation du rapport d'analyse/.test(action)) {
        await E.notifierDroit('rapport.rediger', 'Rapport d\'analyse validé — ' + libelle, '/consultation/' + cid + '/rapport', cid);
      }
    } catch (e) { console.warn('notification', e); }
  };
  E.enregistrerCalcul = async function (lotId, declencheur) {
    const lot = await D.lire('lots', lotId); if (!lot) return;
    const d = await E.donneesLot(lot);
    const resultats = d.calcul.lignes.map(l => ({ candidat: l.candidat, total: l.total, rang: l.rang, complet: l.complet, manquants: l.manquants }));
    await D.creer('calculs', { consultation_id: lot.consultation_id, lot_id: lotId, date: D.maintenant(), auteur_nom: D.utilisateur.nom, declencheur,
      regles: { formule_prix: d.grille.formule_prix, arrondi: d.grille.arrondi_decimales + ' décimale(s), ' + d.grille.arrondi_mode, consolidation: d.grille.consolidation || 'retenue', version_grille: d.grille.version },
      notes_validees: d.notes.filter(n => n.statut === 'validee').length, montants_valides: d.offres.filter(o => o.montant_valide).length, resultats }, false);
  };
  E.carteJournalCalculs = async function (c, d) {
    const l = await D.lister('calculs', { lot_id: d.lot.id }, { ordre: 'date', desc: true });
    return U.carte('Journal des calculs (' + l.length + ')', [h('p.aide', 'Chaque validation ou réouverture d\'une note ou d\'un montant relance le calcul. Le résultat est horodaté et conservé ; il ne peut pas être modifié.'),
      U.tableau([{ titre: 'Date et heure', classe: 'etroit', valeur: x => U.dateHeure(x.date) }, { titre: 'Déclencheur', valeur: x => [x.declencheur, h('div.aide', x.auteur_nom)] },
        { titre: 'Éléments validés', valeur: x => x.notes_validees + ' note(s), ' + x.montants_valides + ' montant(s)' },
        { titre: 'Résultat', valeur: x => x.resultats.filter(r => r.complet).sort((a, b) => a.rang - b.rang).map(r => r.rang + '. ' + r.candidat + ' — ' + U.nombre(r.total, 2)).join(' · ') || 'Aucune offre classée' }], l.slice(0, 30), { vide: 'Aucun calcul enregistré.' })]);
  };
  E.majCloche = async function () {
    const a = document.querySelector('#menu a[data-chemin="/notifications"]'); if (!a || !D.utilisateur) return;
    const n = (await D.lister('notifications', { destinataire_id: D.utilisateur.id })).filter(x => !x.lu).length;
    a.replaceChildren(...['Notifications', n ? h('span.cloche', { 'aria-label': n + ' non lue(s)' }, String(n)) : null].filter(Boolean));
  };
  E.notifications = async function () {
    const [mes, r] = await Promise.all([D.lister('notifications', { destinataire_id: D.utilisateur.id }, { ordre: 'date', desc: true }), E.alertes()]);
    const ouvrir = async n => { if (!n.lu) await D.modifier('notifications', n.id, { lu: true, lu_le: D.maintenant() }, false); U.aller(n.lien || '/notifications'); };
    const ordreTon = { danger: 0, alerte: 1, info: 2 }; r.alertes.sort((a, b) => ordreTon[a.ton] - ordreTon[b.ton]);
    const nonLues = mes.filter(n => !n.lu).length;
    return h('div', U.titrePage('Notifications', 'Ce qui vous est adressé, et les alertes et échéances de vos dossiers. Aucun courriel n\'est envoyé : tout se lit ici.'),
      U.carte('Vos notifications (' + nonLues + ' non lue' + (nonLues > 1 ? 's' : '') + ')', U.tableau([
        { titre: '', classe: 'etroit', valeur: n => n.lu ? U.badge('Lue', 'neutre') : U.badge('Nouvelle', 'info') },
        { titre: 'Date', classe: 'etroit', valeur: n => U.dateHeure(n.date) },
        { titre: 'Message', valeur: n => [n.lu ? n.texte : h('b', n.texte), n.emetteur_nom ? h('div.aide', 'à la suite d\'une action de ' + n.emetteur_nom) : null] },
        { titre: '', classe: 'etroit', valeur: n => U.bouton('Ouvrir', () => ouvrir(n), 'secondaire.petit') }], mes, { vide: 'Aucune notification.' }),
        nonLues ? [U.bouton('Tout marquer comme lu', async () => { for (const n of mes.filter(x => !x.lu)) await D.modifier('notifications', n.id, { lu: true, lu_le: D.maintenant() }, false); U.recharger(); }, 'secondaire')] : null),
      U.carte('Alertes et échéances de vos dossiers', U.tableau([
        { titre: 'Niveau', classe: 'etroit', valeur: a => U.badge({ danger: 'Urgent', alerte: 'À traiter', info: 'Information' }[a.ton], a.ton) },
        { titre: 'Objet', valeur: a => h('a', { href: '#' + a.lien }, a.texte) }], r.alertes, { vide: 'Aucune alerte.' })));
  };
  U.route('/notifications', E.notifications);

  /* ================= Paramétrage : circuit du DCE et critères d'évaluation ================= */
  async function enregistrerParam(id, valeur, trace) {
    const l = (await D.lister('parametres', { id }))[0];
    if (l) await D.modifier('parametres', id, { valeur }, trace); else await D.creer('parametres', { id, valeur }, trace);
  }
  E.carteCircuit = async function () {
    const circuit = await D.circuitDce(); const docs = await D.lister('documents_dce');
    const droits = Object.entries(D.DROITS);
    const sauver = (nv, action, lib) => enregistrerParam('circuit_dce', nv, { action, libelle: lib, detail: { etapes: nv.map(e => e.libelle + ' (' + e.droit + ')') } }).then(() => { U.message('Circuit enregistré.'); U.recharger(); });
    const enCours = e => docs.filter(d => d.statut === e.id).length;
    const champs = [{ nom: 'libelle', libelle: 'Nom de l\'étape', requis: true, aide: 'Par exemple : Relecture, Visa juridique, Validation de l\'élu' }, { nom: 'droit', libelle: 'Habilitation requise pour approuver', type: 'choix', requis: true, options: droits }];
    const deplacer = (k, s) => { const nv = circuit.slice(); const [x] = nv.splice(k, 1); nv.splice(k + s, 0, x); return sauver(nv, 'Modification du circuit de validation du DCE', 'Ordre des étapes'); };
    return U.carte('Circuit de validation du dossier de consultation', [
      h('p.aide', 'Étapes entre la rédaction et la validation finale, dans l\'ordre. Chaque étape est approuvée par un agent qui détient l\'habilitation indiquée ; il peut aussi renvoyer le document en rédaction. La publication suit la dernière étape.'),
      h('div.etapes', h('span.fait', 'Rédaction'), circuit.map(e => h('span.courant', e.libelle)), h('span.fait', 'Validé'), h('span.fait', 'Publié')),
      U.tableau([{ titre: 'Ordre', classe: 'etroit', valeur: e => { const k = circuit.indexOf(e); return [k > 0 ? U.bouton('↑', () => deplacer(k, -1), 'secondaire.petit', { 'aria-label': 'Monter' }) : null, ' ', k < circuit.length - 1 ? U.bouton('↓', () => deplacer(k, 1), 'secondaire.petit', { 'aria-label': 'Descendre' }) : null]; } },
        { titre: 'Étape', valeur: e => h('b', e.libelle) }, { titre: 'Habilitation requise', valeur: e => D.DROITS[e.droit] || e.droit }, { titre: 'Documents en attente', num: true, valeur: e => enCours(e) },
        { titre: '', classe: 'etroit', valeur: e => [U.bouton('Modifier', () => U.editer('Modifier l\'étape', champs, e, v => sauver(circuit.map(x => x.id === e.id ? Object.assign({}, x, v) : x), 'Modification du circuit de validation du DCE', 'Étape « ' + v.libelle + ' »')), 'secondaire.petit'), ' ',
          U.bouton('Retirer', async () => { if (circuit.length < 2) throw new Error('Le circuit doit garder au moins une étape.'); if (enCours(e)) throw new Error(enCours(e) + ' document(s) attendent cette étape : traitez-les ou renvoyez-les en rédaction avant de la retirer.'); if (await U.confirmer('Retirer l\'étape', 'Retirer l\'étape « ' + e.libelle + ' » du circuit ?', 'Retirer')) await sauver(circuit.filter(x => x.id !== e.id), 'Retrait d\'une étape du circuit de validation du DCE', e.libelle); }, 'danger.petit')] }], circuit)],
      [U.bouton('Ajouter une étape', () => U.editer('Nouvelle étape', champs.concat([{ nom: 'position', libelle: 'Position', type: 'choix', vide: false, options: circuit.map((e, k) => [String(k), 'Avant « ' + e.libelle + ' »']).concat([[String(circuit.length), 'En dernier']]), defaut: String(circuit.length) }]), {}, v => {
        const nv = circuit.slice(); nv.splice(Number(v.position), 0, { id: 'e-' + Math.random().toString(36).slice(2, 8), libelle: v.libelle, droit: v.droit });
        return sauver(nv, 'Ajout d\'une étape au circuit de validation du DCE', v.libelle);
      }), 'accent')]);
  };

  const CRITERES_DEFAUT = ['Qualité des prestations', 'Respect des délais', 'Respect des obligations administratives', 'Relation et réactivité', 'Respect des engagements environnementaux et sociaux'].map(l => ({ libelle: l, poids: 1 }));
  E.criteresEvaluation = async () => { const p = (await D.lister('parametres', { id: 'criteres_evaluation' }))[0]; return p && Array.isArray(p.valeur) && p.valeur.length ? p.valeur : CRITERES_DEFAUT; };
  E.carteCriteresEvaluation = async function () {
    const liste = await E.criteresEvaluation();
    const sauver = (nv, action, lib) => enregistrerParam('criteres_evaluation', nv, { action, libelle: lib, detail: { criteres: nv.map(c => c.libelle + ' ×' + c.poids) } }).then(() => { U.message('Critères enregistrés.'); U.recharger(); });
    const champs = [{ nom: 'libelle', libelle: 'Critère', requis: true, large: true }, { nom: 'poids', libelle: 'Coefficient', type: 'nombre', requis: true, min: 0.5, max: 5, pas: 0.5, defaut: 1 }];
    const total = Calcul.somme(liste.map(c => c.poids));
    return U.carte('Critères d\'évaluation des titulaires', [h('p.aide', 'Notés de 1 à 5. La note globale est la moyenne pondérée par les coefficients. Une évaluation garde les critères en vigueur le jour où elle a été saisie.'),
      U.tableau([{ titre: 'Critère', valeur: c => c.libelle }, { titre: 'Coefficient', num: true, valeur: c => U.nombre(c.poids) }, { titre: 'Part', num: true, valeur: c => U.nombre(c.poids / total * 100, 0) + ' %' },
        { titre: '', classe: 'etroit', valeur: c => [U.bouton('Modifier', () => U.editer('Modifier le critère', champs, c, v => sauver(liste.map(x => x === c ? v : x), 'Modification des critères d\'évaluation des titulaires', v.libelle)), 'secondaire.petit'), ' ',
          U.bouton('Retirer', async () => { if (liste.length < 2) throw new Error('Gardez au moins un critère.'); await sauver(liste.filter(x => x !== c), 'Retrait d\'un critère d\'évaluation des titulaires', c.libelle); }, 'danger.petit')] }], liste)],
      [U.bouton('Ajouter un critère', () => U.editer('Nouveau critère', champs, {}, v => sauver(liste.concat([v]), 'Ajout d\'un critère d\'évaluation des titulaires', v.libelle)), 'accent')]);
  };
  /* ================= Identité de la collectivité (marque blanche) ================= */
  let identiteCache = null, identiteUid = null;
  // Vide le cache à la connexion et à la déconnexion (en ligne, ce qui est lisible change avec la session).
  E.viderIdentite = () => { identiteCache = null; identiteUid = null; };
  window.addEventListener('vavang:utilisateur', E.viderIdentite); // émis par D.connexion et D.deconnexion
  E.identite = async function () {
    const uid = D.utilisateur ? D.utilisateur.id : null;
    if (identiteCache && (D.mode !== 'supabase' || identiteUid === uid)) return identiteCache;
    const p = (await D.lister('parametres', { id: 'identite' }))[0]; const v = Object.assign({ nom: window.CONFIG.organisme || 'La collectivité', sigle: '', logo_chemin: null }, p && p.valeur);
    if (!v.sigle) v.sigle = v.nom.split(/[\s'’-]+/).filter(m => m.length > 2 && !['des', 'les', 'pour', 'aux', 'sur'].includes(m.toLowerCase())).map(m => m[0].toUpperCase()).join('').slice(0, 4) || v.nom.slice(0, 2).toUpperCase();
    v.logo = null;
    // En ligne, le logo est dans le compartiment public 'accueil' : adresse publique, visible avant connexion.
    if (D.mode === 'supabase' && /^accueil\//.test(v.logo_chemin || '') && D.urlPublique) v.logo = D.urlPublique(v.logo_chemin);
    else if (v.logo_chemin) { try { const b = await D.telecharger(v.logo_chemin); if (b) v.logo = URL.createObjectURL(b); } catch (e) { } }
    if (!v.logo && window.CONFIG.logoOrganisme) { v.logo = window.CONFIG.logoOrganisme; v.logoDefaut = true; }
    identiteCache = v; identiteUid = uid; return v;
  };
  // La collectivité en premier, vavang plus petit à côté : convention des logiciels publics en marque blanche.
  E.blocMarques = async function (variante) {
    const id = await E.identite(); const clair = variante === 'clair';
    return h('div.marques' + (clair ? '.clair' : ''),
      h('a.marque-organisme', { href: '#/', 'aria-label': 'Accueil — ' + id.nom }, id.logo ? h('img.logo-organisme', { src: id.logo, alt: 'Logo — ' + id.nom }) : h('span.sigle-organisme', id.sigle),
        h('span.nom-organisme', id.logo && (window.CONFIG.logoContientNom && id.logoDefaut) ? null : h('b', id.nom), h('small', 'Espace marchés publics'), window.CONFIG.maquette ? h('span.mention-maquette', window.CONFIG.maquette) : null)),
      h('span.separateur-marques', { 'aria-hidden': 'true' }),
      h('span.marque-vavang', h('img', { src: clair ? 'img/vavang-clair.svg' : 'img/vavang.svg', alt: '' }), h('span', h('b', window.CONFIG.nomLogiciel || 'vavang', h('i', '.')), h('small', 'par ' + (window.CONFIG.editeur || 'L\'entreprise.ai')))));
  };
  E.majIdentiteMenu = async function () { const z = document.getElementById('identite-menu'); if (z) z.replaceChildren(await E.blocMarques('clair')); };
  E.carteIdentite = async function () {
    const id = await E.identite(); const ligne = (await D.lister('parametres', { id: 'identite' }))[0];
    const f = U.formulaire([{ nom: 'nom', libelle: 'Nom de la collectivité', requis: true, large: true }, { nom: 'sigle', libelle: 'Sigle (affiché si aucun logo)', aide: '4 lettres au plus' },
      { nom: 'logo', libelle: 'Logo (PNG, SVG, JPG ou WEBP, 1 Mo au plus)', type: 'fichier', accept: 'image/png,image/svg+xml,image/jpeg,image/webp', aide: 'Fond transparent de préférence. Il s\'affiche en premier, avant vavang, sur la page d\'accueil et dans le menu.' }],
      { nom: id.nom, sigle: (ligne && ligne.valeur && ligne.valeur.sigle) || '' }, async v => {
        const fichier = (v.logo || [])[0]; const val = { nom: v.nom, sigle: String(v.sigle || '').slice(0, 4).toUpperCase(), logo_chemin: ligne && ligne.valeur ? ligne.valeur.logo_chemin : null };
        if (fichier) { if (!/^image\/(png|svg\+xml|jpeg|webp)$/.test(fichier.type)) throw new Error('Format non accepté : PNG, SVG, JPG ou WEBP.'); if (fichier.size > 1048576) throw new Error('Logo trop lourd : 1 Mo au plus.');
          // En ligne, le compartiment public « accueil » n'admet pas le SVG (risque de script dans l'image).
          if (D.mode === 'supabase' && fichier.type === 'image/svg+xml') throw new Error('En ligne, le logo SVG n\'est pas accepté : PNG, JPG ou WEBP.');
          val.logo_chemin = await D.deposer(fichier, D.mode === 'supabase' ? 'accueil/identite' : 'identite'); }
        await enregistrerParam('identite', val, { action: 'Modification de l\'identité de la collectivité', libelle: val.nom + (fichier ? ' (nouveau logo)' : '') });
        identiteCache = null; E.menu(); U.message('Identité enregistrée.'); U.recharger();
      });
    return U.carte('Identité de la collectivité', [h('div.apercu-marques', await E.blocMarques()), f],
      id.logo_chemin ? [U.bouton('Retirer le logo', async () => { const v = Object.assign({}, (ligne || {}).valeur, { logo_chemin: null }); await enregistrerParam('identite', v, { action: 'Retrait du logo de la collectivité', libelle: v.nom }); identiteCache = null; E.menu(); U.recharger(); }, 'secondaire')] : null);
  };
  E.cartesParametres = async () => h('div', await E.carteIdentite(), await E.carteCircuit(), await E.carteCriteresEvaluation(), E.carteSecurite ? await E.carteSecurite() : null);

  /* ================= Synthèse par candidat, assemblée sans IA ================= */
  E.syntheseCandidat = function (d, ligne, pieces) {
    const o = d.offres.find(x => x.id === ligne.offre_id);
    const fs = E.ordonnerCriteres(d.criteres).filter(x => x.type !== 'prix' && !d.criteres.some(y => y.parent_id === x.id));
    const prixCr = d.criteres.find(x => x.type === 'prix'); const ind = d.indices.find(i => i.offre_id === o.id) || { signalements: [] };
    const elem = { forts: [], faibles: [], reserves: [], apprec: [], sources: [] };
    for (const cr of fs) {
      const n = d.notes.find(x => x.offre_id === o.id && x.critere_id === cr.id && x.statut === 'validee'); if (!n) continue;
      const ref = cr.code + ' — ' + U.nombre(n.note) + '/' + U.nombre(cr.bareme);
      if (n.points_forts) elem.forts.push([n.points_forts, ref]); if (n.points_faibles) elem.faibles.push([n.points_faibles, ref]); if (n.reserves) elem.reserves.push([n.reserves, ref]);
      if (n.appreciation) elem.apprec.push([n.appreciation, cr.code + ' ' + cr.libelle + ' — ' + U.nombre(n.note) + '/' + U.nombre(cr.bareme)]);
      if (n.extrait) { const p = pieces.find(x => x.id === n.piece_id); elem.sources.push(['« ' + n.extrait.slice(0, 160) + (n.extrait.length > 160 ? '…' : '') + ' »', (p ? p.nom_fichier : 'pièce') + (n.page ? ', page ' + n.page : '') + ' — critère ' + cr.code]); }
    }
    const nonValides = fs.filter(cr => !d.notes.some(x => x.offre_id === o.id && x.critere_id === cr.id && x.statut === 'validee')).map(cr => cr.code);
    return { o, ligne, elem, nonValides, prix: prixCr ? ligne.detail[prixCr.id] : null, prixCr, signalements: ind.signalements };
  };
  E.carteSyntheses = async function (c, d) {
    if (!d.verrouillee || !d.offres.length) return null;
    const pieces = await D.lister('pieces', { lot_id: d.lot.id });
    const lignes = d.calcul.lignes.slice().sort((a, b) => (a.rang || 99) - (b.rang || 99));
    const syntheses = lignes.map(l => E.syntheseCandidat(d, l, pieces));
    const liste = (titre, items) => items.length ? [h('h4.synth-titre', titre), h('ul.synth', items.map(i => h('li', i[0], h('span.synth-ref', ' (' + i[1] + ')'))))] : null;
    const bloc = s => h('article.bloc-critere',
      h('header', h('h3', s.o.candidat), h('span', s.ligne.rang ? U.badge('Rang provisoire ' + s.ligne.rang + ' — ' + U.nombre(s.ligne.total, d.grille.arrondi_decimales) + ' / 100', 'ok') : U.badge('Non classé : notes à valider (' + s.ligne.manquants.join(', ') + ')', 'alerte'))),
      h('p', h('b', 'Prix : '), U.euros(s.o.montant_ht) + ' HT' + (s.prix && s.prix.points != null ? ' — ' + U.nombre(s.prix.points, d.grille.arrondi_decimales) + ' / ' + U.nombre(s.prixCr.ponderation) + ' points' : ' — note de prix non établie') + (s.signalements.length ? ' — ' + s.signalements.length + ' signalement(s) à vérifier' : '')),
      liste('Points forts relevés', s.elem.forts), liste('Points faibles relevés', s.elem.faibles), liste('Réserves et points de vigilance', s.elem.reserves),
      !s.elem.forts.length && !s.elem.faibles.length ? liste('Appréciations validées', s.elem.apprec) : null,
      liste('Sources citées', s.elem.sources),
      s.nonValides.length ? h('p.aide', 'Critères sans note validée, non repris : ' + s.nonValides.join(', ') + '.') : null);
    const exporter = async () => {
      const blocs = [{ type: 'p', italique: true, texte: 'Synthèse assemblée automatiquement à partir des seules appréciations validées par les agents habilités, sans intelligence artificielle. Chaque élément renvoie au critère et à la note dont il provient.' }];
      for (const s of syntheses) {
        blocs.push({ type: 'titre', niveau: 2, texte: s.o.candidat + (s.ligne.rang ? ' — rang provisoire ' + s.ligne.rang + ' (' + U.nombre(s.ligne.total, 2) + ' / 100)' : ' — non classé') });
        blocs.push({ type: 'p', texte: 'Prix : ' + U.euros(s.o.montant_ht) + ' HT.' + (s.signalements.length ? ' Signalements à vérifier : ' + s.signalements.map(x => x.texte).join(' ') : '') });
        for (const [t, l] of [['Points forts', s.elem.forts], ['Points faibles', s.elem.faibles], ['Réserves', s.elem.reserves], ['Sources citées', s.elem.sources]]) if (l.length) { blocs.push({ type: 'titre', niveau: 3, texte: t }); blocs.push({ type: 'liste', elements: l.map(i => i[0] + ' (' + i[1] + ')') }); }
      }
      await Docs.charger('docx');
      U.telechargerBlob(await Docs.word({ titre: 'Synthèse par candidat', sousTitre: (window.CONFIG.organisme || '') + ' — ' + c.reference + ' — lot ' + d.lot.numero, blocs, pied: 'Synthèse sans IA — ' + c.reference }), 'synthese-candidats-' + c.reference + '-lot' + d.lot.numero + '.docx');
      await D.journal('Export de la synthèse par candidat (Word)', 'analyses', d.lot.id, c.reference + ' — lot ' + d.lot.numero, null, c.id);
    };
    return U.carte('Synthèse par candidat', [h('div.note-info', 'Assemblée automatiquement à partir des seules appréciations validées, sans intelligence artificielle : aucun texte n\'est inventé, chaque élément renvoie au critère, à la note et au document cité.'), syntheses.map(bloc)],
      [U.bouton('Exporter les synthèses (Word)', exporter, 'secondaire')]);
  };

  /* ================= Révision des prix par formule ================= */
  E.texteRevision = m => m.revision_partfixe != null && m.revision_i0 ? 'P = P0 × (' + U.nombre(m.revision_partfixe, 3) + ' + ' + U.nombre(1 - m.revision_partfixe, 3) + ' × I / I0) — indice « ' + (m.revision_indice || 'de référence') + ' », I0 = ' + U.nombre(m.revision_i0) + (m.revision_mois0 ? ' (' + m.revision_mois0 + ')' : '') + ' ; coefficient arrondi au millième supérieur' : 'Prix fermes ou formule non renseignée';
  E.champsRevisionMarche = () => [{ titre: 'Révision des prix (facultatif)' },
    { nom: 'revision_partfixe', libelle: 'Part fixe a (entre 0 et 1, par exemple 0,15)', type: 'nombre', pas: 0.005 }, { nom: 'revision_indice', libelle: 'Indice de référence (libellé)' },
    { nom: 'revision_i0', libelle: 'Valeur de l\'indice au mois zéro (I0)', type: 'nombre' }, { nom: 'revision_mois0', libelle: 'Mois zéro', aide: 'Par exemple : mai 2026' }];
  E.champsRevision = (type, m) => type !== 'revision_prix' ? [] : [{ titre: 'Calcul de la révision' },
    { nom: 'indice_valeur', libelle: 'Valeur de l\'indice retenue (I)', type: 'nombre', aide: m.revision_i0 ? 'I0 = ' + U.nombre(m.revision_i0) + ' — ' + (m.revision_indice || '') : 'Renseignez d\'abord la formule dans la fiche du marché.' },
    { nom: 'indice_mois', libelle: 'Mois de l\'indice' }, { nom: 'montant_base', libelle: 'Montant HT soumis à révision (P0)', type: 'nombre' }];
  E.calculerRevision = function (v, m) {
    if (v.type !== 'revision_prix' || v.indice_valeur == null || v.montant_base == null) return;
    const coef = Calcul.revisionPrix(m.revision_partfixe, v.indice_valeur, m.revision_i0);
    if (coef == null) throw new Error('Calcul impossible : vérifiez la formule du marché (part fixe entre 0 et 1, I0 renseigné) et la valeur de l\'indice.');
    const revise = Calcul.arrondir(v.montant_base * coef, { decimales: 2 });
    v.coefficient = coef; v.montant_revise = revise; v.montant = Calcul.arrondir(revise - v.montant_base, { decimales: 2 });
    v.calcul = 'C = ' + U.nombre(m.revision_partfixe, 3) + ' + ' + U.nombre(1 - m.revision_partfixe, 3) + ' × ' + U.nombre(v.indice_valeur) + ' / ' + U.nombre(m.revision_i0) + ' = ' + U.nombre(coef, 3) + ' ; ' + U.euros(v.montant_base) + ' × ' + U.nombre(coef, 3) + ' = ' + U.euros(revise) + ' (incidence ' + U.euros(v.montant) + ')';
    v.commentaire = [v.calcul, v.commentaire].filter(Boolean).join('\n');
  };
})();
