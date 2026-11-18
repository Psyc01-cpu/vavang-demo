/* Suivi financier d'un marché : factures, service fait, mandatement, paiement, délai global de paiement,
   export vers le logiciel financier (fichier CSV documenté). */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;
  const STATUTS = { recue: ['Reçue', 'info'], service_fait: ['Service fait constaté', 'alerte'], mandatee: ['Mandatée', 'alerte'], payee: ['Payée', 'ok'], rejetee: ['Rejetée', 'danger'] };
  const DGP = 30; // délai global de paiement des collectivités territoriales, en jours
  const echeance = f => f.date_reception ? Calcul.ajouterMois(f.date_reception, 0) && new Date(new Date(f.date_reception + 'T00:00:00').getTime() + DGP * 86400000).toISOString().slice(0, 10) : null;
  const retard = f => { const e = echeance(f); if (!e) return null; const fin = f.date_paiement || D.aujourdhui(); const j = Calcul.joursAvant(e, fin) * -1; return j > 0 ? j : 0; };

  E.carteFactures = async function (m) {
    const factures = await D.lister('factures', { marche_id: m.id }, { ordre: 'date_reception' });
    const evenements = await D.lister('evenements', { marche_id: m.id });
    const peut = D.peut('execution.ecrire');
    const tr = (action, f) => ({ action, libelle: 'Facture ' + f.numero + ' — marché ' + m.numero });
    const champs = [
      { nom: 'numero', libelle: 'Numéro de la facture', requis: true }, { nom: 'date_reception', libelle: 'Date de réception', type: 'date', requis: true, defaut: D.aujourdhui() },
      { nom: 'montant_ht', libelle: 'Montant HT (€)', type: 'nombre', requis: true }, { nom: 'taux_tva', libelle: 'Taux de TVA (%)', type: 'nombre', defaut: 8.5, aide: '8,5 % : taux normal à La Réunion.' },
      { nom: 'bon_commande', libelle: 'Bon de commande ou ordre de service', type: 'choix', options: evenements.filter(e => ['bon_commande', 'ordre_service'].includes(e.type)).map(e => [E.L.evenement[e.type] + ' n° ' + e.numero, E.L.evenement[e.type] + ' n° ' + e.numero + ' — ' + e.objet]) },
      { nom: 'imputation', libelle: 'Imputation budgétaire', aide: 'Par exemple : 011-6156-020' }, { nom: 'objet', libelle: 'Objet', large: true }];
    const ttc = f => Calcul.arrondir((Number(f.montant_ht) || 0) * (1 + (Number(f.taux_tva) || 0) / 100), { decimales: 2 });
    const etape = (f, statut, champ, action) => U.bouton(STATUTS[statut][0], async () => { await D.modifier('factures', f.id, { statut, [champ]: D.aujourdhui(), [champ + '_par']: D.utilisateur.nom }, tr(action, f)); U.recharger(); }, 'secondaire.petit');
    const total = k => Calcul.somme(factures.filter(f => f.statut !== 'rejetee').map(k));
    const montantActuel = (Number(m.montant_notifie) || 0) + Calcul.somme(evenements.filter(e => e.type === 'avenant' && e.statut !== 'projet').map(e => e.montant));
    const exporter = async () => {
      const lignes = factures.filter(f => ['service_fait', 'mandatee', 'payee'].includes(f.statut)).map(f => ({ numero_marche: m.numero, numero_facture: f.numero, tiers: m.titulaire, date_reception: f.date_reception, date_service_fait: f.date_service_fait || '', montant_ht: f.montant_ht, taux_tva: f.taux_tva, montant_tva: Calcul.arrondir(ttc(f) - f.montant_ht, { decimales: 2 }), montant_ttc: ttc(f), imputation: f.imputation || '', bon_commande: f.bon_commande || '', echeance_paiement: echeance(f), statut: STATUTS[f.statut][0] }));
      if (!lignes.length) throw new Error('Aucune facture avec service fait constaté à transmettre.');
      U.telechargerBlob(new Blob([Docs.csv(lignes)], { type: 'text/csv' }), 'factures-' + m.numero + '-' + D.aujourdhui() + '.csv');
      await D.journal('Export des factures vers le logiciel financier', 'factures', null, 'Marché ' + m.numero + ' — ' + lignes.length + ' facture(s)');
    };
    return U.carte('Factures et paiements', [
      h('div.indicateurs', h('div.indicateur', h('b', U.euros(total(f => f.montant_ht))), h('span', 'facturé HT sur ' + U.euros(montantActuel) + ' (' + (montantActuel ? U.nombre(total(f => f.montant_ht) / montantActuel * 100, 0) : '—') + ' %)')),
        h('div.indicateur', h('b', U.euros(Calcul.somme(factures.filter(f => f.statut === 'payee').map(ttc)))), h('span', 'payé TTC')),
        h('div.indicateur' + (factures.some(f => retard(f) > 0 && f.statut !== 'payee') ? '.accent' : ''), h('b', factures.filter(f => f.statut !== 'payee' && f.statut !== 'rejetee' && retard(f) > 0).length), h('span', 'facture(s) au-delà du délai de ' + DGP + ' jours'))),
      U.tableau([{ titre: 'Facture', valeur: f => [h('b', f.numero), h('div.aide', [f.bon_commande, f.imputation].filter(Boolean).join(' · '))] }, { titre: 'Reçue le', valeur: f => U.date(f.date_reception) },
        { titre: 'HT', num: true, valeur: f => U.euros(f.montant_ht) }, { titre: 'TTC', num: true, valeur: f => U.euros(ttc(f)) },
        { titre: 'À payer avant le', valeur: f => [U.date(echeance(f)), f.statut !== 'payee' && retard(f) > 0 ? [' ', U.badge('Retard ' + retard(f) + ' j — intérêts moratoires dus', 'danger')] : (f.statut === 'payee' && retard(f) > 0 ? [' ', U.badge('Payée avec ' + retard(f) + ' j de retard', 'alerte')] : null)] },
        { titre: 'État', valeur: f => [U.badge(STATUTS[f.statut][0], STATUTS[f.statut][1]), h('div.aide', [f.date_service_fait ? 'service fait ' + U.date(f.date_service_fait) : '', f.date_mandatement ? 'mandatée ' + U.date(f.date_mandatement) : '', f.date_paiement ? 'payée ' + U.date(f.date_paiement) : ''].filter(Boolean).join(' · '))] },
        { titre: '', classe: 'etroit', valeur: f => peut ? ({ recue: [etape(f, 'service_fait', 'date_service_fait', 'Constatation du service fait'), ' ', U.bouton('Rejeter', () => U.editer('Rejeter la facture', [{ nom: 'motif_rejet', libelle: 'Motif', type: 'long', requis: true }], {}, v => D.modifier('factures', f.id, Object.assign(v, { statut: 'rejetee' }), tr('Rejet d\'une facture', f))), 'danger.petit')],
          service_fait: etape(f, 'mandatee', 'date_mandatement', 'Mandatement de la facture'), mandatee: etape(f, 'payee', 'date_paiement', 'Paiement de la facture') })[f.statut] || null : null }], factures, { vide: 'Aucune facture enregistrée.' })],
      [peut ? U.bouton('Enregistrer une facture', () => U.editer('Nouvelle facture', champs, {}, v => D.creer('factures', Object.assign({ marche_id: m.id, statut: 'recue' }, v), tr('Enregistrement d\'une facture', v)), { large: true }), 'accent') : null,
        U.bouton('Exporter vers le logiciel financier (CSV)', exporter, 'secondaire')]);
  };
})();
