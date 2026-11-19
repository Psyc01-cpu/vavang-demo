-- vavang — guichet du support : dépôt d'une demande SANS connexion (pas de ligne directe, rappel par l'équipe support).
-- ÉTAT : écrit le 19/11/2026, NON EXÉCUTÉ. À exécuter d'un bloc dans l'éditeur SQL (rôle postgres), APRÈS schema.sql,
-- schema_demo.sql (et sauvegarde.sql s'il a été joué). Rejouable sans dommage (create or replace).
--
-- Pourquoi une fonction : le visiteur n'est pas connecté (rôle « anon ») et la table tickets n'accepte aucune écriture
-- de « anon » (règles d'accès par ligne). La fonction, exécutée avec les droits de son propriétaire, contrôle tout
-- (valeurs autorisées, longueurs, numéro de rappel, courriel, plafonds anti-abus) puis insère UNE ligne dans tickets.
--
-- Déclencheurs existants, vérifiés :
--   - garde() : laisse passer quand auth.uid() est nul (« opérations d'administration ») → le dépôt anonyme n'est pas refusé ;
--     si un agent connecté dépose au guichet, garde() pose demandeur_id = son identifiant (il retrouve la demande dans « Mes demandes »).
--   - numeroter_ticket() : numéro T-AAAA-NNNN tiré de la séquence tickets_seq quand le numéro est vide → même format que les autres tickets.
-- Lecture par l'équipe : la règle « lecture » de tickets (schema_demo.sql) autorise support.traiter et admin.utilisateurs : rien à changer.
-- Mise à jour par le support (prise en charge, rappel effectué…) : règles existantes inchangées ; la clôture reste validée
-- par la collectivité (administrateur), le demandeur du guichet n'ayant pas de compte.

create or replace function public.deposer_demande_guichet(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_type text := btrim(coalesce(p->>'type_demande', ''));
  v_commentaire text := btrim(coalesce(p->>'commentaire', ''));
  v_nom text := btrim(coalesce(p->>'nom', ''));
  v_collectivite text := btrim(coalesce(p->>'collectivite', ''));
  v_tel text := btrim(coalesce(p->>'telephone', ''));
  v_courriel text := lower(btrim(coalesce(p->>'courriel', '')));
  v_profil text := coalesce(nullif(btrim(coalesce(p->>'profil', '')), ''), 'agent');
  v_creneau text := coalesce(nullif(btrim(coalesce(p->>'creneau', '')), ''), 'des_que_possible');
  v_urgence text := btrim(coalesce(p->>'urgence', ''));
  v_tel_cle text; v_type_lib text; v_urgence_lib text; v_creneau_lib text; v_criticite text;
  v_maintenant text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_id text := gen_random_uuid()::text; v_numero text; v_d jsonb;
begin
  -- Champ piège invisible : rempli uniquement par un robot.
  if coalesce(btrim(p->>'site_web'), '') <> '' then raise exception 'REGLE: Demande refusée.'; end if;

  v_type_lib := case v_type
    when 'connexion' then 'Je n''arrive pas à me connecter' when 'compte' then 'Compte bloqué / mot de passe'
    when 'ecran' then 'Un écran ne s''affiche pas ou une erreur apparaît' when 'lenteur' then 'Lenteur'
    when 'fichiers' then 'Import / export de fichiers' when 'documents' then 'Document ou modèle (DCE, rapport)'
    when 'analyse' then 'Analyse des offres / calculs' when 'droits' then 'Droits et habilitations'
    when 'evolution' then 'Demande d''évolution' when 'autre' then 'Autre question' end;
  if v_type_lib is null then raise exception 'REGLE: Choisissez le type de panne ou de demande.'; end if;
  if v_commentaire = '' then raise exception 'REGLE: Décrivez votre demande dans le commentaire.'; end if;
  if v_nom = '' then raise exception 'REGLE: Indiquez vos nom et prénom.'; end if;
  if v_collectivite = '' then raise exception 'REGLE: Indiquez votre collectivité et votre service.'; end if;
  if v_tel = '' then raise exception 'REGLE: Indiquez le numéro auquel l''équipe support peut vous rappeler.'; end if;
  if length(v_nom) > 120 or length(v_collectivite) > 160 or length(v_tel) > 30 or length(v_courriel) > 160 or length(v_commentaire) > 3000 then
    raise exception 'REGLE: Texte trop long (nom 120, collectivité 160, téléphone 30, courriel 160, commentaire 3000 caractères au plus).'; end if;
  v_tel_cle := regexp_replace(v_tel, '\D', '', 'g');
  if v_tel !~ '^[0-9+ .()-]+$' or length(v_tel_cle) < 6 or length(v_tel_cle) > 15 then
    raise exception 'REGLE: Numéro de rappel invalide : chiffres, espaces, points ou tirets (6 à 15 chiffres).'; end if;
  if v_courriel <> '' and v_courriel !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'REGLE: Adresse électronique invalide.'; end if;
  if v_profil not in ('agent', 'referent', 'autre') then raise exception 'REGLE: Profil inconnu.'; end if;
  v_creneau_lib := case v_creneau when 'des_que_possible' then 'dès que possible, aux horaires du guichet' when 'matin' then 'le matin (8 h – 12 h)' when 'apres_midi' then 'l''après-midi (12 h – 17 h)' end;
  if v_creneau_lib is null then raise exception 'REGLE: Créneau de rappel inconnu.'; end if;
  select x.lib, x.crit into v_urgence_lib, v_criticite from (values
    ('bloquant', 'Bloquant — je ne peux plus travailler', 'P2'),
    ('genant', 'Gênant — je contourne, mais cela me ralentit', 'P3'),
    ('sans_urgence', 'Sans urgence — une question, une idée', 'P4')) as x(cle, lib, crit) where x.cle = v_urgence;
  if v_criticite is null then raise exception 'REGLE: Indiquez l''urgence de la demande.'; end if;
  if coalesce(p->>'consentement', 'false') <> 'true' then raise exception 'REGLE: Cochez la case d''accord sur le traitement de vos coordonnées.'; end if;

  -- Plafonds anti-abus (dépôts de la dernière heure), sérialisés par un verrou de transaction.
  perform pg_advisory_xact_lock(hashtext('vavang.guichet'));
  if (select count(*) from tickets where d->>'origine' = 'guichet' and cree_le > now() - interval '1 hour') >= 30
     or (select count(*) from tickets where d->>'origine' = 'guichet' and cree_le > now() - interval '1 hour'
           and regexp_replace(coalesce(d->'demandeur'->>'telephone', ''), '\D', '', 'g') = v_tel_cle) >= 5
     or (v_courriel <> '' and (select count(*) from tickets where d->>'origine' = 'guichet' and cree_le > now() - interval '1 hour'
           and d->'demandeur'->>'courriel' = v_courriel) >= 5) then
    -- (pas de trace au journal ici : l'exception annule toute la transaction, journal compris)
    raise exception 'REGLE: Trop de demandes déposées en peu de temps : réessayez dans une heure.';
  end if;

  v_d := jsonb_build_object(
    'origine', 'guichet', 'type_demande', v_type, 'type_libelle', v_type_lib, 'objet', v_type_lib, 'description', v_commentaire,
    'criticite', v_criticite, 'urgence', v_urgence, 'demandeur_id', null, 'demandeur_nom', v_nom, 'service', v_collectivite,
    'demandeur', jsonb_build_object('nom', v_nom, 'collectivite', v_collectivite, 'telephone', v_tel, 'courriel', v_courriel, 'profil', v_profil),
    'rappel', jsonb_build_object('creneau', v_creneau), 'consentement', true,
    'date_depot', v_maintenant, 'date_creation', v_maintenant, 'cree_le', v_maintenant, 'statut', 'nouveau',
    'pieces_jointes', '[]'::jsonb, 'rappels', '[]'::jsonb,
    'historique', jsonb_build_array(jsonb_build_object('date', v_maintenant, 'auteur', v_nom || ' (guichet)', 'type', 'Dépôt au guichet',
      'texte', 'Demande déposée au guichet (' || v_urgence_lib || '). Rappel souhaité : ' || v_creneau_lib || '.')));
  -- Numéro attribué par le déclencheur numeroter_ticket() (séquence tickets_seq).
  insert into tickets (id, d) values (v_id, v_d) returning d->>'numero' into v_numero;

  -- Notification de l'équipe support (profils actifs détenant support.traiter).
  insert into notifications (d)
  select jsonb_build_object('destinataire_id', pr.id, 'texte', 'Nouvelle demande au guichet ' || v_numero || ' (' || v_criticite || ') : ' || v_type_lib,
    'lien', '/support/' || v_id, 'lu', false, 'date', v_maintenant, 'emetteur_nom', 'Guichet')
    from profils pr
   where coalesce((pr.d->>'actif')::boolean, true)
     and exists (select 1 from habilitations hb where hb.d->>'role' = pr.d->>'role' and hb.d->>'droit' = 'support.traiter');

  perform public.journal_serveur('Dépôt d''une demande au guichet', 'tickets', v_id, v_numero || ' — ' || v_type_lib,
    jsonb_build_object('urgence', v_urgence, 'criticite', v_criticite));
  return jsonb_build_object('id', v_id, 'numero', v_numero, 'date_depot', v_maintenant);
end $$;

revoke all on function public.deposer_demande_guichet(jsonb) from public;
grant execute on function public.deposer_demande_guichet(jsonb) to anon, authenticated;

-- Contrôle après exécution (facultatif) :
--   select public.deposer_demande_guichet('{"type_demande":"lenteur","commentaire":"Essai","nom":"Agent Essai","collectivite":"Agglo Démo — DCP",
--     "telephone":"0262 00 00 00","urgence":"sans_urgence","consentement":true}'::jsonb);
--   (à jouer depuis l'API en rôle anon ; dans l'éditeur SQL, le rôle postgres n'a pas d'auth.uid() et passe de la même façon.)
