/* Page d'état publique : lit statut/historique.json (alimenté par .github/workflows/supervision.yml) et calcule
   disponibilité 24 h / 7 j / 30 j, dernier contrôle, temps de réponse moyens et incidents. Aucune dépendance. */
(function () {
  'use strict';
  const SERVICES = [
    { cle: 'page', nom: 'Page publique (GitHub Pages)' },
    { cle: 'rest', nom: 'API de données (REST Supabase)' },
    { cle: 'auth', nom: 'Connexion (Auth Supabase)' }
  ];
  const H = 3600e3, J = 24 * H;
  const RETARD_MAX = 60 * 60e3; // au-delà d'une heure sans contrôle, la supervision elle-même est signalée en retard
  const $ = id => document.getElementById(id);
  const fmtDate = t => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtJour = t => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  const fmtPct = v => v == null ? '—' : (v === 1 ? '100' : (Math.floor(v * 10000) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + ' %';
  const fmtMs = v => v == null ? '—' : Math.round(v).toLocaleString('fr-FR') + ' ms';
  function fmtDuree(ms) {
    const m = Math.max(1, Math.round(ms / 60e3)); if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60; if (h < 48) return h + ' h' + (r ? ' ' + String(r).padStart(2, '0') : '');
    return Math.round(h / 24) + ' j';
  }
  function el(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else e.setAttribute(k, v); }
    for (const c of enfants) if (c != null) e.append(c instanceof Node ? c : String(c));
    return e;
  }
  const okService = (l, cle) => !!(l[cle] && l[cle].ok);

  function dispo(lignes, depuis, cle) {
    const p = lignes.filter(l => l.ts >= depuis); if (!p.length) return null;
    return p.filter(l => cle ? okService(l, cle) : l.ok).length / p.length;
  }
  function moyenne(lignes, depuis, cle) {
    const v = lignes.filter(l => l.ts >= depuis && okService(l, cle) && typeof l[cle].ms === 'number').map(l => l[cle].ms);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  function incidents(lignes) {
    const res = []; let cour = null;
    for (const l of lignes) {
      if (!l.ok) {
        if (!cour) { cour = { debut: l.ts, fin: null, dernierEchec: l.ts, services: new Set(), details: new Set(), controles: 0 }; res.push(cour); }
        cour.dernierEchec = l.ts; cour.controles++;
        for (const s of SERVICES) if (!okService(l, s.cle)) {
          cour.services.add(s.nom);
          const d = l[s.cle] || {}; cour.details.add(s.cle + ' : ' + (d.code ? 'HTTP ' + d.code : (d.erreur || 'pas de réponse')));
        }
      } else if (cour) { cour.fin = l.ts; cour = null; }
    }
    return res.reverse();
  }

  function afficher(brut) {
    const lignes = (Array.isArray(brut) ? brut : []).filter(l => l && l.t && !isNaN(Date.parse(l.t)))
      .map(l => Object.assign({}, l, { ts: Date.parse(l.t) })).sort((a, b) => a.ts - b.ts);
    const maintenant = Date.now();
    const dernier = lignes[lignes.length - 1];

    // Bandeau
    const pastille = $('pastille'), etat = $('etat-general'), sous = $('dernier-controle'), alerte = $('alerte-retard');
    alerte.replaceChildren();
    if (!dernier) {
      etat.textContent = 'Aucune mesure enregistrée pour l\'instant';
      sous.textContent = 'La première mesure apparaîtra après le premier passage de la tâche de supervision.';
    } else {
      const retard = maintenant - dernier.ts > RETARD_MAX;
      pastille.className = 'pastille ' + (dernier.ok ? (retard ? 'retard' : 'ok') : 'ko');
      const enPanne = SERVICES.filter(s => !okService(dernier, s.cle)).map(s => s.nom);
      etat.textContent = dernier.ok ? 'Tous les services répondaient au dernier contrôle' : 'Service perturbé : ' + enPanne.join(', ');
      sous.textContent = 'Dernier contrôle : ' + fmtDate(dernier.ts) + ' (il y a ' + fmtDuree(maintenant - dernier.ts) + ') · ' + lignes.length.toLocaleString('fr-FR') + ' contrôles sur la période';
      if (retard) alerte.append(el('div', { class: 'alerte' }, 'Aucun contrôle depuis plus d\'une heure : la tâche de supervision est en retard ou désactivée. L\'état affiché n\'est plus à jour.'));
    }

    // Indicateurs globaux
    const ind = $('indicateurs'); ind.replaceChildren();
    const periodes = [['24 h', J], ['7 jours', 7 * J], ['30 jours', 30 * J]];
    for (const [nom, d] of periodes) {
      const n = lignes.filter(l => l.ts >= maintenant - d).length;
      ind.append(el('div', { class: 'indicateur' }, el('b', null, fmtPct(dispo(lignes, maintenant - d))), el('span', null, 'Disponibilité ' + nom + ' (' + n.toLocaleString('fr-FR') + ' contrôles)')));
    }
    const moyRest = moyenne(lignes, maintenant - 7 * J, 'rest');
    ind.append(el('div', { class: 'indicateur' }, el('b', null, fmtMs(moyRest)), el('span', null, 'Temps de réponse moyen de l\'API, 7 jours')));
    const nbInc = incidents(lignes.filter(l => l.ts >= maintenant - 30 * J)).length;
    ind.append(el('div', { class: 'indicateur' }, el('b', null, String(nbInc)), el('span', null, 'Incident' + (nbInc > 1 ? 's' : '') + ' sur 30 jours')));

    // Barres journalières
    const jours = $('jours'); jours.replaceChildren();
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const deb = auj.getTime() - i * J, fin = deb + J;
      const p = lignes.filter(l => l.ts >= deb && l.ts < fin);
      const v = p.length ? p.filter(l => l.ok).length / p.length : null;
      const cls = v == null ? '' : v === 1 ? 'ok' : v >= .99 ? 'moyen' : 'ko';
      jours.append(el('span', { class: cls, title: fmtJour(deb) + ' : ' + (v == null ? 'aucune mesure' : fmtPct(v) + ' (' + p.length + ' contrôles)') }));
    }
    $('jour-debut').textContent = fmtJour(auj.getTime() - 29 * J);

    // Tableau par service
    const tb = $('services'); tb.replaceChildren();
    for (const s of SERVICES) {
      const d = dernier && dernier[s.cle];
      const etiquette = !d ? el('span', { class: 'etiquette nd' }, 'non mesuré')
        : el('span', { class: 'etiquette ' + (d.ok ? 'ok' : 'ko') }, d.ok ? 'disponible' : 'indisponible' + (d.code ? ' (HTTP ' + d.code + ')' : ''));
      tb.append(el('tr', null, el('td', null, s.nom), el('td', null, etiquette),
        el('td', { class: 'n' }, fmtPct(dispo(lignes, maintenant - J, s.cle))), el('td', { class: 'n' }, fmtPct(dispo(lignes, maintenant - 7 * J, s.cle))),
        el('td', { class: 'n' }, fmtPct(dispo(lignes, maintenant - 30 * J, s.cle))),
        el('td', { class: 'n' }, fmtMs(moyenne(lignes, maintenant - J, s.cle))), el('td', { class: 'n' }, fmtMs(moyenne(lignes, maintenant - 7 * J, s.cle)))));
    }

    // Incidents
    const ti = $('incidents'); ti.replaceChildren();
    const liste = incidents(lignes);
    if (!liste.length) ti.append(el('tr', null, el('td', { colspan: '5', class: 'vide' }, lignes.length ? 'Aucun incident mesuré sur la période.' : 'Aucune mesure pour l\'instant.')));
    for (const i of liste.slice(0, 50)) {
      const fin = i.fin == null ? 'en cours' : fmtDate(i.fin);
      const duree = i.fin == null ? 'depuis ' + fmtDuree(maintenant - i.debut) : fmtDuree(i.fin - i.debut);
      ti.append(el('tr', null, el('td', null, fmtDate(i.debut)), el('td', null, fin), el('td', { class: 'n' }, duree),
        el('td', null, [...i.services].join(', ')), el('td', null, [...i.details].join(' ; ') + ' — ' + i.controles + ' contrôle' + (i.controles > 1 ? 's' : '') + ' en échec')));
    }
  }

  async function charger() {
    try {
      const r = await fetch('statut/historique.json?_=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      afficher(await r.json());
    } catch (e) {
      $('pastille').className = 'pastille';
      $('etat-general').textContent = 'Historique des mesures illisible';
      $('dernier-controle').textContent = 'Impossible de lire statut/historique.json (' + e.message + ').';
    }
  }
  window.STATUT = { afficher, incidents, dispo }; // exposé pour les essais automatisés
  charger();
  setInterval(charger, 5 * 60e3);
})();
