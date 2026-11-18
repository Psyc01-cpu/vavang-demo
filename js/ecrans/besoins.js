/* Expression du besoin : recensement, caractérisation, computation des seuils, aide au choix de la procédure et du type de marché. */
(function () {
  'use strict';
  const h = U.h, E = window.Ecrans;

  E.besoins = async function () {
    const [besoins, params] = await Promise.all([D.lister('besoins', {}, { ordre: 'cree_le', desc: true }), D.lister('parametres')]);
    const seuils = Object.assign({}, Calcul.SEUILS_DEFAUT, (params.find(p => p.id === 'seuils') || {}).valeur);
    const annee = Number(U.param('annee')) || new Date().getFullYear();
    const annees = Array.from(new Set(besoins.map(b => b.annee).concat([annee]))).sort();
    const duAnnee = besoins.filter(b => b.annee === annee);
    const groupes = Calcul.computation(duAnnee, seuils);
    const familles = Array.from(new Set(besoins.map(b => b.famille).filter(Boolean))).sort();
    const peut = D.peut('besoins.ecrire'), arreter = D.peut('besoins.valider') || D.peut('consultations.ecrire');
    const champs = [
      { nom: 'reference', libelle: 'Référence', requis: true }, { nom: 'service', libelle: 'Service prescripteur', requis: true },
      { nom: 'objet', libelle: 'Objet du besoin', requis: true, large: true },
      { nom: 'nature', libelle: 'Nature', type: 'choix', requis: true, options: Object.entries(E.L.nature) },
      { nom: 'famille', libelle: 'Famille homogène ou opération', requis: true, aide: 'Les besoins d\'une même famille (fournitures, services) ou d\'une même opération (travaux) sont additionnés pour apprécier les seuils. Familles déjà utilisées : ' + (familles.join(', ') || 'aucune') + '.' },
      { nom: 'montant_estime', libelle: 'Montant estimé (€ HT, sur la durée totale)', type: 'nombre', requis: true }, { nom: 'duree_mois', libelle: 'Durée (mois, reconductions comprises)', type: 'nombre' },
      { nom: 'annee', libelle: 'Année de lancement', type: 'nombre', requis: true, defaut: annee }, { nom: 'recurrent', libelle: 'Besoin récurrent', type: 'case' },
      { nom: 'description', libelle: 'Caractérisation du besoin (contexte, exigences, contraintes, allotissement envisagé)', type: 'long' }];
    const groupeDe = b => groupes.find(g => g.besoins.some(x => x.id === b.id));
    const choisirProcedure = b => { const g = groupeDe(b); const propre = Calcul.aideProcedure(b.nature, Number(b.montant_estime) || 0, seuils);
      U.editer('Choix de la procédure — ' + b.reference, [
        { nom: 'procedure_retenue', libelle: 'Procédure retenue', type: 'choix', requis: true, large: true, options: E.PROCEDURES.map(p => [p, p]) },
        { nom: 'type_marche', libelle: 'Type de marché', type: 'choix', large: true, options: E.TYPES_MARCHE.map(p => [p, p]), aide: b.recurrent ? 'Besoin récurrent : un accord-cadre à bons de commande est souvent adapté lorsque les quantités ne sont pas connues à l\'avance.' : 'Besoin ponctuel et défini : un marché ordinaire est souvent adapté.' },
        { nom: 'justification_procedure', libelle: 'Justification du choix', type: 'long', requis: true }],
        Object.assign({ justification_procedure: 'Computation : ' + U.euros(g.total) + ' HT cumulés pour la famille « ' + g.famille + ' » en ' + g.annee + ' (' + g.besoins.length + ' besoin(s)). ' + g.explication }, b),
        v => D.modifier('besoins', b.id, Object.assign(v, { statut: b.statut === 'consultation' ? 'consultation' : 'valide', procedure_decidee_par_nom: D.utilisateur.nom, procedure_decidee_le: D.maintenant() }), { action: 'Choix de la procédure', libelle: b.reference + ' — ' + v.procedure_retenue }),
        { large: true, boutons: h('span.aide', { style: { flexBasis: '100%' } }, 'Aide (à confirmer par l\'agent) — au niveau de la famille : ' + g.procedure_suggeree + '. Pour ce seul besoin : ' + propre.procedure_suggeree + '.') }); };
    const creerConsultation = b => U.editer('Créer la consultation — ' + b.reference, E.champsConsultation(), { reference: b.reference.replace(/^B-?/i, ''), objet: b.objet, nature: b.nature, procedure: b.procedure_retenue, type_marche: b.type_marche, montant_estime: b.montant_estime, service: b.service }, async v => {
      const c = await E.creerConsultation(v, b); await D.modifier('besoins', b.id, { statut: 'consultation', consultation_id: c.id }, false); setTimeout(() => U.aller('/consultation/' + c.id), 30); }, { libelle: 'Créer la consultation' });
    return h('div', U.titrePage('Besoins et seuils', 'Recensement des besoins, computation des seuils et aide au choix de la procédure.',
      [h('label', 'Année ', h('select.saisie', { style: { width: 'auto' }, onchange: e => U.aller('/besoins?annee=' + e.target.value) }, annees.map(a => h('option', { selected: a === annee }, a)))),
        peut ? U.bouton('Recenser un besoin', () => U.editer('Nouveau besoin', champs, { reference: 'B-' + annee + '-' + String(besoins.length + 1).padStart(3, '0'), service: D.utilisateur.service }, v => D.creer('besoins', Object.assign({ statut: 'recense', cree_par: D.utilisateur.id, cree_par_nom: D.utilisateur.nom }, v), { action: 'Recensement d\'un besoin', libelle: v.reference + ' — ' + v.objet }), { large: true }), 'accent') : null]),
      U.carte('Computation des seuils — ' + annee, [
        h('p.aide', 'Seuils appliqués (paramétrables par l\'administrateur, en vigueur depuis le ' + U.date(seuils.date_effet) + ') : dispense de publicité et de mise en concurrence sous ' + U.euros(seuils.dispense_fournitures_services) + ' HT (fournitures et services) et ' + U.euros(seuils.dispense_travaux) + ' HT (travaux) ; publicité BOAMP ou JAL à partir de ' + U.euros(seuils.publicite_obligatoire) + ' HT ; procédure formalisée à partir de ' + U.euros(seuils.formalise_fournitures_services) + ' HT (fournitures et services) et ' + U.euros(seuils.formalise_travaux) + ' HT (travaux).'),
        U.tableau([{ titre: 'Famille homogène / opération', valeur: g => h('b', g.famille) }, { titre: 'Nature', valeur: g => E.L.nature[g.nature] }, { titre: 'Besoins', num: true, valeur: g => g.besoins.length },
          { titre: 'Services', valeur: g => Array.from(new Set(g.besoins.map(b => b.service))).join(', ') }, { titre: 'Montant cumulé HT', num: true, valeur: g => h('b', U.euros(g.total)) },
          { titre: 'Procédure suggérée', valeur: g => [U.badge(g.procedure_suggeree, ['neutre', 'ok', 'info', 'alerte', 'danger'][g.niveau]), h('div.aide', g.explication)] }], groupes, { vide: 'Aucun besoin recensé pour ' + annee + '.' }),
        h('div.note-info', { style: { marginTop: '10px' } }, 'Aide à la décision : la procédure suggérée découle du seul montant cumulé. Le choix final revient à l\'acheteur, qui le justifie (urgence, objet, exceptions prévues par le code de la commande publique).')]),
      U.carte('Besoins recensés — ' + annee, U.tableau([
        { titre: 'Référence', valeur: b => h('b', b.reference) }, { titre: 'Objet', valeur: b => [b.objet, b.description ? h('div.aide', b.description.slice(0, 140)) : null] }, { titre: 'Service', valeur: b => b.service },
        { titre: 'Famille', valeur: b => b.famille }, { titre: 'Montant HT', num: true, valeur: b => U.euros(b.montant_estime) },
        { titre: 'Procédure', valeur: b => b.procedure_retenue ? [b.procedure_retenue, h('div.aide', 'arrêtée par ' + b.procedure_decidee_par_nom)] : h('span.aide', 'Suggestion : ' + groupeDe(b).procedure_suggeree) },
        { titre: 'État', valeur: b => E.badge('besoin', b.statut) },
        { titre: '', classe: 'etroit', valeur: b => [peut && b.statut !== 'consultation' ? U.bouton('Modifier', () => U.editer('Modifier le besoin', champs, b, v => D.modifier('besoins', b.id, v, { action: 'Modification d\'un besoin', libelle: v.reference }), { large: true }), 'secondaire.petit') : null, ' ',
          arreter && b.statut !== 'consultation' ? U.bouton(b.procedure_retenue ? 'Revoir la procédure' : 'Choisir la procédure', () => choisirProcedure(b), 'secondaire.petit') : null, ' ',
          b.statut === 'valide' && D.peut('consultations.ecrire') ? U.bouton('Créer la consultation', () => creerConsultation(b), 'accent.petit') : null,
          b.consultation_id ? h('a', { href: '#/consultation/' + b.consultation_id }, 'Voir la consultation') : null] }], duAnnee, { vide: 'Aucun besoin recensé pour ' + annee + '.' })));
  };
  U.route('/besoins', E.besoins);
})();
