-- vavang — sauvegarde et restauration logiques de la base hébergée (Supabase), sans service payant.
-- ÉTAT : écrit le 19/11/2026, NON EXÉCUTÉ. À exécuter d'un bloc dans l'éditeur SQL (rôle postgres), APRÈS schema.sql et schema_demo.sql.
-- Rejouable sans dommage (create or replace, drop policy if exists).
--
-- Contenu :
--   1. garde() : reprise EXACTE de la version de schema_demo.sql, avec une seule ligne ajoutée en tête qui laisse passer
--      les écritures pendant une restauration (indicateur de transaction « vavang.restauration »).
--   2. numeroter_ticket() : même indicateur, pour que la restauration conserve les numéros des demandes d'assistance.
--   3. exporter_sauvegarde()   : toutes les tables métier + inventaire des fichiers (compartiments pieces et accueil).
--   4. restaurer_sauvegarde(p) : vide les tables métier et réinsère le contenu de la sauvegarde, sans toucher auth.*.
--   5. Politique de stockage : l'administrateur en aal2 peut redéposer un fichier n'importe où dans « pieces » (réimport).
--
-- Sécurité de l'indicateur : il est posé par set_config(..., true), donc limité à la transaction de restaurer_sauvegarde().
-- Un client ne peut pas le poser lui-même : set_config (schéma pg_catalog) n'est pas exposé par l'API REST, et PostgREST
-- ne transmet comme paramètres de session que les variables « request.* ». Les deux fonctions exigent un administrateur en aal2.
--
-- ATTENTION : si garde() est de nouveau modifiée dans schema_demo.sql, reporter la modification ici (ou rejouer ce fichier
-- après schema_demo.sql) : le dernier fichier exécuté l'emporte.

/* =====================================================================================================
   1. garde() — copie exacte de schema_demo.sql (section F) + indicateur de restauration en tête
   ===================================================================================================== */
create or replace function public.garde() returns trigger language plpgsql security definer set search_path = public as $$
declare n jsonb := case when tg_op = 'DELETE' then null else new.d end; o jsonb := case when tg_op = 'INSERT' then null else old.d end; l jsonb := coalesce(n, o);
  uid text := auth.uid()::text; verrou boolean; valide boolean; demandeur boolean;
begin
  if current_setting('vavang.restauration', true) = 'on' then return coalesce(new, old); end if; -- restauration d'une sauvegarde (restaurer_sauvegarde)
  insert into trace_technique (table_nom, operation, ligne_id) values (tg_table_name, tg_op, coalesce(new.id, old.id));
  if uid is null then return coalesce(new, old); end if; -- opérations d'administration (éditeur SQL, remise à zéro) : non soumises aux règles
  if tg_op = 'UPDATE' then new.modifie_le := now(); end if;

  if tg_table_name in ('journal', 'notes_historique', 'documents_versions', 'validations', 'grille_versions', 'calculs') and tg_op <> 'INSERT' then
    perform refuser('Les historiques et le journal ne peuvent être ni modifiés ni supprimés.');
  end if;

  -- Rattachement obligatoire au dossier : sans lui, la ligne serait visible de tous.
  if tg_op = 'INSERT' and tg_table_name in ('lots', 'affectations', 'grilles', 'criteres', 'grille_versions', 'offres', 'lignes_prix', 'notes', 'notes_historique',
      'demandes', 'analyses', 'rapports', 'pieces_attendues') and coalesce(n->>'consultation_id', '') = '' then
    perform refuser('Cet élément doit être rattaché à un dossier de consultation.');
  end if;

  if tg_table_name = 'criteres' then
    select g.d->>'statut' = 'verrouillee' into verrou from grilles g where g.d->>'lot_id' = l->>'lot_id' limit 1;
    if coalesce(verrou, false) then perform refuser('La grille est verrouillée : les critères et les pondérations ne peuvent plus être modifiés.'); end if;
  end if;

  if tg_table_name = 'grilles' and tg_op = 'UPDATE' then
    if o->>'statut' is distinct from n->>'statut' then
      if not a_droit('analyse.verrouiller') then perform refuser('Le verrouillage de la grille revient à un utilisateur habilité.'); end if;
    elsif o->>'statut' = 'verrouillee' then perform refuser('La grille est verrouillée : la méthode de notation ne peut plus être modifiée.');
    end if;
  end if;
  if tg_table_name = 'grilles' and tg_op = 'DELETE' and o->>'statut' = 'verrouillee' then perform refuser('Une grille verrouillée ne peut pas être supprimée.'); end if;

  if tg_table_name = 'notes' then
    select a.d->>'statut' = 'validee' into valide from analyses a where a.d->>'lot_id' = l->>'lot_id' limit 1;
    if coalesce(valide, false) then perform refuser('L''analyse de ce lot est validée : les notes ne peuvent plus être modifiées.'); end if;
    if tg_op = 'DELETE' then
      if o->>'statut' = 'validee' or o->>'analyste_id' <> uid then perform refuser('Seul l''auteur peut supprimer sa contribution, tant qu''elle n''est pas validée.'); end if;
    else
      select g.d->>'statut' = 'verrouillee' into verrou from grilles g where g.d->>'lot_id' = n->>'lot_id' limit 1;
      if not coalesce(verrou, false) then perform refuser('La grille doit être verrouillée avant toute saisie de note.'); end if;
      if n->>'statut' = 'validee' or o->>'statut' = 'validee' or (n->>'statut' = 'a_revoir' and o->>'statut' is distinct from 'a_revoir') then
        if not a_droit('analyse.valider') then perform refuser('La validation des notes revient à un utilisateur habilité.'); end if;
        if n->>'statut' = 'validee' and o->>'statut' is distinct from 'validee' then
          if n->>'analyste_id' = uid then perform refuser('Vous ne pouvez pas valider votre propre contribution.'); end if;
          if n->>'note' is null or (coalesce(btrim(n->>'appreciation'), '') = '' and coalesce(btrim(n->>'extrait'), '') = '') then perform refuser('Une note ne peut être validée sans valeur ni justification.'); end if;
          -- consolidation « moyenne » : plusieurs contributions validées sont admises pour un même critère
          if (select g.d->>'consolidation' from grilles g where g.d->>'lot_id' = n->>'lot_id' limit 1) is distinct from 'moyenne'
             and exists (select 1 from notes x where x.id <> new.id and x.d->>'offre_id' = n->>'offre_id' and x.d->>'critere_id' = n->>'critere_id' and x.d->>'statut' = 'validee') then
            perform refuser('Une autre contribution est déjà validée pour ce critère.'); end if;
        end if;
        if o->>'statut' = 'validee' and n->>'statut' = 'validee' and (o->'note' is distinct from n->'note' or o->'appreciation' is distinct from n->'appreciation' or o->'extrait' is distinct from n->'extrait') then
          perform refuser('Une note validée ne peut pas être modifiée : elle doit d''abord être rouverte par un valideur.'); end if;
      else
        if not a_droit('analyse.saisir') or n->>'analyste_id' <> uid or (o is not null and o->>'analyste_id' <> uid) then perform refuser('Une contribution est saisie et modifiée par son seul auteur.'); end if;
      end if;
    end if;
  end if;

  if tg_table_name = 'offres' and tg_op = 'UPDATE' then
    if (o->'montant_valide' is distinct from n->'montant_valide' or o->'ecartee' is distinct from n->'ecartee'
        or ((n->>'candidature_statut' in ('admise', 'non_admise') or o->>'candidature_statut' in ('admise', 'non_admise')) and o->>'candidature_statut' is distinct from n->>'candidature_statut'))
       and not a_droit('analyse.valider') then perform refuser('Les décisions sur une candidature ou une offre reviennent à un utilisateur habilité.'); end if;
    if coalesce((n->>'ecartee')::boolean, false) and coalesce(btrim(n->>'ecartee_motif'), '') = '' then perform refuser('Une décision d''écarter une offre doit être motivée.'); end if;
    if n->>'candidature_statut' = 'non_admise' and coalesce(btrim(n->>'candidature_motif'), '') = '' then perform refuser('Une décision de non-admission doit être motivée.'); end if;
    if coalesce((o->>'montant_valide')::boolean, false) and coalesce((n->>'montant_valide')::boolean, false) and o->'montant_ht' is distinct from n->'montant_ht' then perform refuser('Le montant est validé : il doit être rouvert avant correction.'); end if;
  end if;

  if tg_table_name = 'analyses' and tg_op = 'UPDATE' and o->>'statut' is distinct from n->>'statut' then
    if (n->>'statut' = 'validee' or o->>'statut' = 'validee' or (o->>'statut' = 'en_relecture' and n->>'statut' = 'en_cours')) and not a_droit('analyse.valider') then perform refuser('La validation de l''analyse revient à un utilisateur habilité.'); end if;
  end if;

  if tg_table_name = 'rapports' then
    if tg_op <> 'INSERT' and o->>'statut' = 'valide' then perform refuser('Un rapport validé est figé.'); end if;
    if n->>'statut' = 'valide' and not a_droit('rapport.valider') then perform refuser('La validation du rapport revient à un utilisateur habilité.'); end if;
  end if;

  if tg_table_name = 'documents_dce' and tg_op = 'UPDATE' and o->>'statut' is distinct from n->>'statut' then
    -- circuit paramétrable (parametres.circuit_dce) : l'étape quittée exige l'habilitation qui lui est attachée
    if o->>'statut' = 'redaction' and not a_droit('dce.rediger') then perform refuser('La soumission revient au rédacteur.'); end if;
    if exists (select 1 from parametres p, jsonb_array_elements(p.d->'valeur') e where p.id = 'circuit_dce' and e->>'id' = o->>'statut' and not a_droit(e->>'droit'))
      or (o->>'statut' in ('relecture', 'validation') and not exists (select 1 from parametres where id = 'circuit_dce') and not a_droit(case o->>'statut' when 'relecture' then 'dce.relire' else 'dce.valider' end))
      or (n->>'statut' = 'publie' and not a_droit('dce.publier')) then
      perform refuser('Cette étape du circuit de validation ne relève pas de votre profil.'); end if;
  end if;
  if tg_table_name = 'documents_dce' and tg_op = 'UPDATE' and o->>'statut' <> 'redaction' and o->>'statut' = n->>'statut' and o->'contenu' is distinct from n->'contenu' then perform refuser('Le document est dans le circuit de validation : il doit revenir en rédaction pour être modifié.'); end if;

  if tg_table_name = 'evaluations' then
    if tg_op <> 'INSERT' and o->>'statut' = 'validee' then perform refuser('Une évaluation validée est figée.'); end if;
    if n->>'statut' = 'validee' and (not a_droit('evaluations.valider') or coalesce(btrim(n->>'faits'), '') = '') then perform refuser('La validation exige un profil habilité et des faits vérifiables.'); end if;
  end if;

  -- Habilitations : l'administrateur garde toujours la gestion des utilisateurs.
  if tg_table_name = 'habilitations' and tg_op <> 'INSERT' and old.id = 'administrateur|admin.utilisateurs' then
    perform refuser('Le profil administrateur conserve toujours la gestion des utilisateurs.'); end if;

  if tg_table_name = 'profils' and tg_op = 'UPDATE' and old.id = uid and (o->>'role' is distinct from n->>'role' or n->>'actif' = 'false') then perform refuser('Vous ne pouvez pas modifier votre propre profil ni désactiver votre propre compte.'); end if;
  if tg_table_name = 'profils' and tg_op <> 'INSERT' then
    -- dernier administrateur actif
    if o->>'role' = 'administrateur' and coalesce((o->>'actif')::boolean, true)
       and (tg_op = 'DELETE' or n->>'role' is distinct from 'administrateur' or not coalesce((n->>'actif')::boolean, true))
       and not exists (select 1 from profils p where p.id <> old.id and p.d->>'role' = 'administrateur' and coalesce((p.d->>'actif')::boolean, true)) then
      perform refuser('Il doit rester au moins un administrateur actif.'); end if;
    -- comptes partagés de la démonstration
    if coalesce(o->>'email', '') like '%@demo.example' and (tg_op = 'DELETE' or o->>'role' is distinct from n->>'role' or o->>'email' is distinct from n->>'email'
       or coalesce((o->>'actif')::boolean, true) <> coalesce((n->>'actif')::boolean, true)) then
      perform refuser('Les comptes de démonstration partagés ne peuvent être ni désactivés, ni supprimés, ni changés de profil.'); end if;
  end if;

  -- Demandes d'assistance : jamais supprimées ; étapes réservées selon le profil.
  if tg_table_name = 'tickets' then
    if tg_op = 'DELETE' then perform refuser('Une demande d''assistance ne peut pas être supprimée : elle reste dans l''historique.'); end if;
    if tg_op = 'INSERT' and not a_droit('support.traiter') then
      new.d := new.d || jsonb_build_object('demandeur_id', uid); n := new.d;
    end if;
    if tg_op = 'UPDATE' then
      demandeur := o->>'demandeur_id' = uid;
      if not demandeur and not a_droit('support.traiter') and not a_droit('admin.utilisateurs') then perform refuser('Seuls le demandeur, l''administrateur et le support interviennent sur cette demande.'); end if;
      if n->>'statut' = 'clos' and o->>'statut' is distinct from 'clos' and not demandeur and not a_droit('admin.utilisateurs') then
        perform refuser('La clôture est validée par la collectivité (le demandeur ou l''administrateur), pas par le support.'); end if;
      if n->>'statut' in ('pris_en_charge', 'en_cours', 'contourne', 'resolu') and o->>'statut' is distinct from n->>'statut' and not a_droit('support.traiter') then
        perform refuser('Cette étape relève de l''équipe support.'); end if;
      new.d := new.d || jsonb_build_object('numero', o->'numero', 'demandeur_id', o->'demandeur_id'); n := new.d; -- numéro et demandeur figés
    end if;
  end if;

  -- Notifications : émetteur posé par le serveur ; le destinataire ne change que l'état « lu ».
  if tg_table_name = 'notifications' then
    if tg_op = 'INSERT' then
      if n->>'type' = 'mfa' and not a_droit('admin.utilisateurs') then perform refuser('Seul l''administrateur propose l''activation de la double authentification.'); end if;
      if not exists (select 1 from profils p where p.id = n->>'destinataire_id') then perform refuser('Destinataire inconnu.'); end if;
      new.d := new.d || jsonb_build_object('emetteur_id', uid, 'emetteur_nom', coalesce(moi()->>'nom', '')); n := new.d;
    elsif tg_op = 'UPDATE' and (o - 'lu' - 'lu_le') is distinct from (n - 'lu' - 'lu_le') then
      perform refuser('Seul l''état de lecture d''une notification peut changer.');
    end if;
  end if;
  return coalesce(new, old);
end $$;

/* =====================================================================================================
   2. Numérotation des demandes d'assistance : la restauration garde les numéros sauvegardés
   ===================================================================================================== */
create or replace function public.numeroter_ticket() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_setting('vavang.restauration', true) = 'on' and coalesce(new.d->>'numero', '') <> '' then return new; end if;
  if auth.uid() is not null or coalesce(new.d->>'numero', '') = '' then
    new.d := jsonb_set(new.d, '{numero}', to_jsonb('T-' || extract(year from now())::int || '-' || lpad(nextval('public.tickets_seq')::text, 4, '0')));
  end if;
  return new;
end $$;

/* =====================================================================================================
   3. Liste des tables métier (identique à schema.sql) et contrôle d'accès commun
   ===================================================================================================== */
create or replace function public.tables_sauvegarde() returns text[] language sql immutable as $$
  select array['profils','habilitations','parametres','journal','besoins','consultations','affectations','lots','grilles','criteres',
    'grille_versions','modeles_grille','pieces_attendues','offres','pieces','annotations','lignes_prix','notes','notes_historique','demandes',
    'analyses','rapports','modeles_document','documents_dce','documents_versions','validations','marches','evenements','fournisseurs',
    'fournisseur_suivi','evaluations','reprises','annonces','notifications','tickets','factures','calculs']
$$;

-- Administrateur (admin.utilisateurs, via moi()) ET session en aal2 (double authentification vérifiée).
create or replace function public.exiger_admin_aal2() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.moi() is null or not public.a_droit('admin.utilisateurs') then
    raise exception 'REGLE: Sauvegarde et restauration réservées à l''administrateur.'; end if;
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'REGLE: La double authentification est exigée pour la sauvegarde et la restauration.'; end if;
end $$;

/* =====================================================================================================
   4. Export : { version, logiciel, date, lignes, tables: { nom: [ {id, d, cree_le, cree_par, modifie_le} ] }, fichiers: [...] }
   ===================================================================================================== */
create or replace function public.exporter_sauvegarde() returns jsonb
language plpgsql volatile security definer set search_path = public, storage as $$
declare t text; v_tables jsonb := '{}'::jsonb; v_lignes jsonb; v_fichiers jsonb; v_total int := 0;
begin
  perform public.exiger_admin_aal2();
  -- l'export est tracé avant la lecture : il figure donc dans la sauvegarde elle-même
  perform public.journal_serveur('Sauvegarde exportée', 'securite', null, 'Sauvegarde complète de la base', null);
  foreach t in array public.tables_sauvegarde() loop
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'', x.id, ''d'', x.d, ''cree_le'', x.cree_le, ''cree_par'', x.cree_par, ''modifie_le'', x.modifie_le) order by x.id), ''[]''::jsonb) from public.%I x', t)
      into v_lignes;
    v_tables := v_tables || jsonb_build_object(t, v_lignes);
    v_total := v_total + jsonb_array_length(v_lignes);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('compartiment', o.bucket_id, 'chemin', o.name,
           'taille', (o.metadata->>'size')::bigint, 'type', o.metadata->>'mimetype', 'modifie_le', o.updated_at) order by o.bucket_id, o.name), '[]'::jsonb)
    into v_fichiers
    from storage.objects o where o.bucket_id in ('pieces', 'accueil') and o.name not like '%.emptyFolderPlaceholder';
  return jsonb_build_object('version', 1, 'logiciel', 'vavang', 'date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lignes', v_total, 'tables', v_tables, 'fichiers', v_fichiers);
end $$;

/* =====================================================================================================
   5. Restauration : remplace TOUTES les tables métier par le contenu de la sauvegarde, en une seule transaction
      (toute erreur annule l'ensemble). Ne touche pas : comptes de connexion (auth.*), verrous_connexion,
      trace_technique, demo_seed / demo_meta. Les fichiers sont réimportés par tests/restauration.mjs (API de stockage).
   ===================================================================================================== */
create or replace function public.restaurer_sauvegarde(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare t text; v_attendu int; v_obtenu int; v_bilan jsonb := '{}'::jsonb; v_total int := 0; v_inconnues text;
begin
  perform public.exiger_admin_aal2();
  -- contrôles de forme avant toute écriture
  if p is null or jsonb_typeof(p->'tables') is distinct from 'object' then raise exception 'REGLE: Sauvegarde illisible (champ « tables » absent).'; end if;
  if coalesce(p->>'version', '') <> '1' then raise exception 'REGLE: Version de sauvegarde non prise en charge : %.', coalesce(p->>'version', 'absente'); end if;
  select string_agg(k, ', ') into v_inconnues from jsonb_object_keys(p->'tables') k where not (k = any(public.tables_sauvegarde()));
  if v_inconnues is not null then raise exception 'REGLE: Tables inconnues dans la sauvegarde : %.', v_inconnues; end if;
  foreach t in array public.tables_sauvegarde() loop
    if jsonb_typeof(p->'tables'->t) is distinct from 'array' then raise exception 'REGLE: Table absente de la sauvegarde : %.', t; end if;
  end loop;
  -- garde-fou : la base restaurée doit garder au moins un administrateur actif
  if not exists (select 1 from jsonb_array_elements(p->'tables'->'profils') e
                  where e->'d'->>'role' = 'administrateur' and coalesce((e->'d'->>'actif')::boolean, true)) then
    raise exception 'REGLE: La sauvegarde ne contient aucun administrateur actif : restauration refusée.'; end if;

  perform set_config('vavang.restauration', 'on', true);  -- garde() et numeroter_ticket() laissent passer (cette transaction seulement)
  execute 'truncate ' || (select string_agg(format('public.%I', x), ', ') from unnest(public.tables_sauvegarde()) x);
  foreach t in array public.tables_sauvegarde() loop
    execute format('insert into public.%I (id, d, cree_le, cree_par, modifie_le)
      select r.id, coalesce(r.d, ''{}''::jsonb), coalesce(r.cree_le, now()), r.cree_par, r.modifie_le
        from jsonb_to_recordset($1) as r(id text, d jsonb, cree_le timestamptz, cree_par uuid, modifie_le timestamptz)', t)
      using p->'tables'->t;
    get diagnostics v_obtenu = row_count;
    v_attendu := jsonb_array_length(p->'tables'->t);
    if v_obtenu <> v_attendu then raise exception 'Restauration interrompue : % lignes attendues dans %, % insérées.', v_attendu, t, v_obtenu; end if;
    v_bilan := v_bilan || jsonb_build_object(t, v_obtenu); v_total := v_total + v_obtenu;
  end loop;
  perform set_config('vavang.restauration', 'off', true);

  perform setval('public.tickets_seq', greatest(coalesce((select max(substring(d->>'numero' from '(\d+)$')::int) from public.tickets), 0), 1),
    exists (select 1 from public.tickets where d->>'numero' ~ '\d+$'));
  perform public.journal_serveur('Restauration de sauvegarde', 'securite', null, 'Sauvegarde du ' || coalesce(p->>'date', 'date inconnue'),
    jsonb_build_object('date_sauvegarde', p->>'date', 'lignes', v_total));
  return jsonb_build_object('lignes', v_total, 'tables', v_bilan);
end $$;

/* =====================================================================================================
   6. Stockage : réimport des fichiers par l'administrateur en aal2, y compris sous « support/<autre agent>/ »
      (que la politique pieces_depot refuse). Pas de politique de mise à jour : le script supprime puis redépose.
   ===================================================================================================== */
drop policy if exists pieces_restauration on storage.objects;
create policy pieces_restauration on storage.objects for insert to authenticated with check (bucket_id = 'pieces' and public.moi() is not null
  and public.a_droit('admin.utilisateurs') and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2');

/* =====================================================================================================
   Droits d'exécution
   ===================================================================================================== */
revoke execute on function public.exporter_sauvegarde(), public.restaurer_sauvegarde(jsonb), public.exiger_admin_aal2(), public.tables_sauvegarde() from public, anon;
grant execute on function public.exporter_sauvegarde(), public.restaurer_sauvegarde(jsonb), public.exiger_admin_aal2(), public.tables_sauvegarde() to authenticated;
revoke execute on function public.garde(), public.numeroter_ticket() from public, anon, authenticated;
