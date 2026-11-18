-- vavang — compléments pour la démonstration publique en mode Supabase.
-- À exécuter d'un bloc dans l'éditeur SQL (rôle postgres), APRÈS schema.sql. Rejouable sans dommage :
-- create or replace, if not exists, drop policy if exists.
--
-- Contenu : niveau de session (aal2 des administrateurs, révocation effective), comptes sans fonction Edge,
-- verrouillage après échecs, journal durci, invariants métier et cloisonnement, stockage, remise à zéro nocturne.
-- Les comptes de démonstration ont des UUID fixes 00000000-0000-4000-a000-00000000000N (N = 1 à 6) et une adresse @demo.example.

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

/* =====================================================================================================
   B. Niveau de session
   ===================================================================================================== */
-- Double authentification exigée pour ce profil (paramètres « securite » réglés par l'administrateur).
create or replace function public.mfa_requis(p_role text) returns boolean language sql stable security definer set search_path = public as $$
  select (p_role = 'administrateur' and coalesce((select (d->'valeur'->>'mfa_admin')::boolean from public.parametres where id = 'securite'), true))
    or coalesce((select (d->'valeur'->>'mfa_tous')::boolean from public.parametres where id = 'securite'), false)
$$;

-- Profil de l'agent connecté : compte actif, session encore présente côté serveur, aal2 si la double authentification est requise.
-- Toutes les règles d'accès passent par moi() : un administrateur en aal1 ou une session révoquée n'a plus aucun droit.
create or replace function public.moi() returns jsonb language sql stable security definer set search_path = public, auth as $$
  select p.d || jsonb_build_object('id', p.id) from public.profils p
   where p.id = auth.uid()::text and coalesce((p.d->>'actif')::boolean, true)
     and (not public.mfa_requis(p.d->>'role') or coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2')
     and exists (select 1 from auth.sessions s where s.id = nullif(auth.jwt()->>'session_id', '')::uuid)
$$;

-- Seule lecture possible avant l'aal2 : le profil (sans condition d'aal) et l'indication « double authentification requise ».
create or replace function public.mon_profil() returns jsonb language sql stable security definer set search_path = public, auth as $$
  select p.d || jsonb_build_object('id', p.id, 'mfa_requis', public.mfa_requis(p.d->>'role'), 'aal', coalesce(auth.jwt()->>'aal', 'aal1'))
    from public.profils p
   where p.id = auth.uid()::text and coalesce((p.d->>'actif')::boolean, true)
     and exists (select 1 from auth.sessions s where s.id = nullif(auth.jwt()->>'session_id', '')::uuid)
$$;

-- Accès au dossier : la colonne cree_par compte aussi (consultations créées en ligne).
create or replace function public.voit_dossier(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select public.moi() is not null and (cid is null or public.a_droit('consultations.toutes')
    or exists (select 1 from consultations c where c.id = cid and (c.d->>'cree_par' = auth.uid()::text or c.cree_par = auth.uid()))
    or (public.a_droit('consultations.service') and exists (select 1 from consultations c where c.id = cid and c.d->>'service' = public.moi()->>'service'))
    or exists (select 1 from affectations a where a.d->>'consultation_id' = cid and a.d->>'profil_id' = auth.uid()::text))
$$;

/* =====================================================================================================
   Journal écrit par le serveur (fonctions des sections C et D) — non appelable par les clients
   ===================================================================================================== */
create or replace function public.journal_serveur(p_action text, p_objet_type text, p_objet_id text, p_libelle text,
  p_detail jsonb default null, p_resultat text default 'réussi') returns void language plpgsql security definer set search_path = public as $$
declare m jsonb := (select d from public.profils where id = auth.uid()::text);
begin
  insert into public.journal (d) values (jsonb_build_object('date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'auteur_id', auth.uid()::text, 'auteur_nom', coalesce(m->>'nom', 'Non connecté'), 'auteur_role', m->>'role', 'action', p_action, 'objet_type', p_objet_type,
    'objet_id', p_objet_id, 'objet_libelle', p_libelle, 'detail', p_detail, 'consultation_id', null, 'resultat', p_resultat, 'origine', 'serveur'));
end $$;

-- Comptes partagés de la démonstration (UUID fixes ou adresse @demo.example) : protégés des actions destructrices.
create or replace function public.est_compte_demo(p_id uuid) returns boolean language sql stable security definer set search_path = public, auth as $$
  select p_id::text like '00000000-0000-4000-a000-00000000000_' or exists (select 1 from auth.users u where u.id = p_id and u.email like '%@demo.example')
$$;

create or replace function public.exiger_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.a_droit('admin.utilisateurs') then raise exception 'REGLE: Action réservée à l''administrateur.'; end if;
end $$;

/* =====================================================================================================
   C. Comptes (sans fonction Edge)
   ===================================================================================================== */
create or replace function public.creer_compte(p_email text, p_mdp text, p_nom text, p_role text, p_service text default '') returns text
language plpgsql security definer set search_path = public, extensions, auth, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_id uuid := gen_random_uuid();
begin
  perform public.exiger_admin();
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'REGLE: Adresse électronique invalide.'; end if;
  if v_email like '%@demo.example' then raise exception 'REGLE: Le domaine demo.example est réservé aux comptes de démonstration.'; end if;
  if length(coalesce(p_mdp, '')) < 12 then raise exception 'REGLE: Le mot de passe doit compter au moins 12 caractères.'; end if;
  if coalesce(btrim(p_nom), '') = '' or length(p_nom) > 120 then raise exception 'REGLE: Le nom est obligatoire (120 caractères au plus).'; end if;
  if not exists (select 1 from public.habilitations h where h.d->>'role' = p_role) then raise exception 'REGLE: Profil inconnu.'; end if;
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then raise exception 'REGLE: Un compte existe déjà avec cette adresse.'; end if;
  if (select count(*) from auth.users u where coalesce(u.email, '') not like '%@demo.example') >= 20 then
    raise exception 'REGLE: Démonstration : 20 comptes au plus peuvent être créés (remise à zéro chaque nuit).'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email, extensions.crypt(p_mdp, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"vavang_visiteur":true}', '{}', now(), now(), '', '', '', '', '', '');
  -- la colonne email de auth.identities est générée : ne pas l'insérer
  insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (v_id, v_id::text, 'email', jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now(), now());
  insert into public.profils (id, d) values (v_id::text, jsonb_build_object('email', v_email, 'nom', btrim(p_nom), 'role', p_role, 'service', coalesce(p_service, ''), 'actif', true));
  perform public.journal_serveur('Création d''un compte', 'profils', v_id::text, btrim(p_nom) || ' (' || p_role || ')');
  return v_id::text;
end $$;

create or replace function public.definir_mot_de_passe(p_id uuid, p_mdp text) returns void
language plpgsql security definer set search_path = public, extensions, auth, pg_temp as $$
begin
  perform public.exiger_admin();
  if length(coalesce(p_mdp, '')) < 12 then raise exception 'REGLE: Le mot de passe doit compter au moins 12 caractères.'; end if;
  if public.est_compte_demo(p_id) then raise exception 'REGLE: Le mot de passe des comptes de démonstration partagés ne peut pas être changé.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_mdp, extensions.gen_salt('bf')), updated_at = now() where id = p_id;
  if not found then raise exception 'REGLE: Compte introuvable.'; end if;
  delete from auth.sessions where user_id = p_id;
  perform public.journal_serveur('Réinitialisation du mot de passe', 'profils', p_id::text, (select d->>'nom' from public.profils where id = p_id::text));
end $$;

create or replace function public.revoquer_sessions(p_id uuid) returns integer
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare n integer;
begin
  perform public.exiger_admin();
  delete from auth.sessions where user_id = p_id; -- les jetons de rafraîchissement suivent par cascade
  get diagnostics n = row_count;
  perform public.journal_serveur('Fermeture des sessions d''un compte', 'securite', p_id::text, (select d->>'nom' from public.profils where id = p_id::text), jsonb_build_object('sessions', n));
  return n;
end $$;

create or replace function public.reinitialiser_mfa(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  perform public.exiger_admin();
  if p_id = auth.uid() then raise exception 'REGLE: Vous ne pouvez pas réinitialiser votre propre double authentification.'; end if;
  if p_id = '00000000-0000-4000-a000-000000000001'::uuid then raise exception 'REGLE: La double authentification de l''administrateur de démonstration est conservée.'; end if;
  delete from auth.mfa_factors where user_id = p_id;
  delete from auth.sessions where user_id = p_id;
  perform public.journal_serveur('Réinitialisation de la double authentification', 'securite', p_id::text, (select d->>'nom' from public.profils where id = p_id::text));
end $$;

create or replace function public.etat_securite_comptes() returns table(id text, mfa boolean, verrouille_jusqua timestamptz, derniere_connexion timestamptz, sessions int)
language plpgsql stable security definer set search_path = public, auth, pg_temp as $$
begin
  perform public.exiger_admin();
  return query select u.id::text,
    exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    case when u.banned_until > now() then u.banned_until end,
    u.last_sign_in_at,
    (select count(*)::int from auth.sessions s where s.user_id = u.id)
  from auth.users u;
end $$;

-- Désactivation d'un compte : ses sessions sont fermées aussitôt.
create or replace function public.fin_sessions() returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce((new.d->>'actif')::boolean, true) = false and coalesce((old.d->>'actif')::boolean, true) = true
     and new.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    delete from auth.sessions where user_id = new.id::uuid;
  end if;
  return new;
end $$;
drop trigger if exists fin_sessions on public.profils;
create trigger fin_sessions after update on public.profils for each row execute function public.fin_sessions();

/* =====================================================================================================
   D. Verrouillage après échecs de connexion
   ===================================================================================================== */
create table if not exists public.verrous_connexion (email text primary key, echecs int not null default 0, dernier_echec timestamptz, verrouille_jusqua timestamptz);
alter table public.verrous_connexion enable row level security;
revoke all on public.verrous_connexion from anon, authenticated;

create or replace function public.signaler_echec_connexion(p_email text) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_max int; v_duree int; v_echecs int; v_dernier timestamptz; v_uid uuid;
begin
  if v_email = '' or length(v_email) > 254 then return; end if;
  select coalesce((d->'valeur'->>'echecs_max')::int, 5), coalesce((d->'valeur'->>'verrouillage_minutes')::int, 15) into v_max, v_duree from public.parametres where id = 'securite';
  v_max := coalesce(v_max, 5); v_duree := coalesce(v_duree, 15);
  delete from public.verrous_connexion where dernier_echec < now() - interval '1 day';
  insert into public.verrous_connexion (email, echecs, dernier_echec) values (v_email, 0, now()) on conflict (email) do nothing;
  select echecs, dernier_echec into v_echecs, v_dernier from public.verrous_connexion where email = v_email for update;
  if v_dernier < now() - make_interval(mins => v_duree) then v_echecs := 0; end if;
  v_echecs := v_echecs + 1;
  if v_echecs <= v_max + 2 then perform public.journal_serveur('Échec de connexion', 'session', null, v_email, null, 'échec'); end if;
  if v_echecs >= v_max then
    select u.id into v_uid from auth.users u where lower(u.email) = v_email;
    if v_uid is not null then
      if public.est_compte_demo(v_uid) then v_duree := least(v_duree, 2); end if; -- comptes partagés : 2 minutes au plus
      update auth.users set banned_until = now() + make_interval(mins => v_duree) where id = v_uid;
      update public.verrous_connexion set echecs = 0, dernier_echec = now(), verrouille_jusqua = now() + make_interval(mins => v_duree) where email = v_email;
      perform public.journal_serveur('Compte verrouillé après ' || v_max || ' échecs de connexion', 'securite', v_uid::text, v_email, jsonb_build_object('minutes', v_duree), 'refusé');
      return; -- rien n'est renvoyé : l'existence du compte n'est pas révélée
    end if;
  end if;
  update public.verrous_connexion set echecs = v_echecs, dernier_echec = now() where email = v_email;
end $$;

create or replace function public.connexion_reussie() returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_session text := auth.jwt()->>'session_id'; v_aal text := coalesce(auth.jwt()->>'aal', 'aal1');
begin
  if auth.uid() is null then return; end if;
  delete from public.verrous_connexion where email = lower(auth.email());
  -- une seule entrée par session et par niveau, pour éviter l'inondation du journal
  if exists (select 1 from public.journal j where j.d->>'auteur_id' = auth.uid()::text and j.d->>'action' = 'Connexion'
             and j.d->'detail'->>'session_id' = v_session and j.d->'detail'->>'aal' = v_aal) then return; end if;
  perform public.journal_serveur('Connexion', 'session', auth.uid()::text, (select d->>'nom' from public.profils where id = auth.uid()::text),
    jsonb_build_object('aal', v_aal, 'double_authentification', v_aal = 'aal2', 'session_id', v_session));
end $$;

create or replace function public.deverrouiller_compte(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
begin
  perform public.exiger_admin();
  update auth.users set banned_until = null where id = p_id;
  delete from public.verrous_connexion where email = (select lower(email) from auth.users where id = p_id);
  perform public.journal_serveur('Déverrouillage d''un compte', 'securite', p_id::text, (select d->>'nom' from public.profils where id = p_id::text));
end $$;

/* =====================================================================================================
   E. Journal
   ===================================================================================================== */
create or replace function public.journaliser(p_action text, p_objet_type text default null, p_objet_id text default null, p_objet_libelle text default null,
  p_detail jsonb default null, p_consultation_id text default null, p_resultat text default 'réussi', p_origine text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
declare m jsonb; v_action text := left(coalesce(p_action, ''), 300);
begin
  if auth.uid() is null then raise exception 'REGLE: Vous devez être connecté.'; end if;
  if v_action = '' then raise exception 'REGLE: Action du journal manquante.'; end if;
  if p_detail is not null and octet_length(p_detail::text) > 8192 then raise exception 'REGLE: Détail du journal trop volumineux (8 ko au plus).'; end if;
  -- événements de sécurité écrits par le serveur uniquement
  if v_action ~* '^(connexion|[eéÉ]chec de connexion|compte verrouill|cr[eéÉ]ation d.un compte|r[eéÉ]initialisation (du mot de passe|de la double)|d[eéÉ]verrouillage d.un compte|fermeture des sessions)' then
    raise exception 'REGLE: Cet événement est enregistré par le serveur.'; end if;
  -- l'activation de la double authentification n'est acceptée que si elle est réelle (facteur vérifié et session aal2)
  if v_action ~* '^activation de la double' and not (coalesce(auth.jwt()->>'aal', '') = 'aal2'
      and exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')) then
    raise exception 'REGLE: Double authentification non activée.'; end if;
  m := (select d from public.profils where id = auth.uid()::text);
  insert into public.journal (d) values (jsonb_build_object('date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'auteur_id', auth.uid()::text, 'auteur_nom', coalesce(m->>'nom', 'Non connecté'), 'auteur_role', m->>'role', 'action', v_action, 'objet_type', left(p_objet_type, 60),
    'objet_id', left(p_objet_id, 120), 'objet_libelle', left(p_objet_libelle, 300), 'detail', p_detail, 'consultation_id', left(p_consultation_id, 120),
    'resultat', left(p_resultat, 30), 'origine', left(p_origine, 200)));
end $$;

-- Événements de sécurité de l'agent connecté (écran « Ma sécurité »), quel que soit son profil.
create or replace function public.mes_evenements_securite(p_limite int default 12) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select j.d || jsonb_build_object('id', j.id, 'cree_le', j.cree_le) from public.journal j
   where auth.uid() is not null
     and (j.d->>'auteur_id' = auth.uid()::text or j.d->>'objet_id' = auth.uid()::text)
     and j.d->>'objet_type' in ('session', 'securite', 'profils')
     and (j.d->>'objet_type' <> 'profils' or j.d->>'objet_id' = auth.uid()::text)
   order by j.cree_le desc limit least(greatest(coalesce(p_limite, 12), 1), 100)
$$;

/* =====================================================================================================
   F. Invariants métier et cloisonnement — garde() réécrite en entier (reprend schema.sql)
   ===================================================================================================== */
create or replace function public.garde() returns trigger language plpgsql security definer set search_path = public as $$
declare n jsonb := case when tg_op = 'DELETE' then null else new.d end; o jsonb := case when tg_op = 'INSERT' then null else old.d end; l jsonb := coalesce(n, o);
  uid text := auth.uid()::text; verrou boolean; valide boolean; demandeur boolean;
begin
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

-- Numéro des demandes d'assistance : attribué par le serveur, sans collision (le demandeur ne voit que les siennes).
create sequence if not exists public.tickets_seq;
create or replace function public.numeroter_ticket() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null or coalesce(new.d->>'numero', '') = '' then
    new.d := jsonb_set(new.d, '{numero}', to_jsonb('T-' || extract(year from now())::int || '-' || lpad(nextval('public.tickets_seq')::text, 4, '0')));
  end if;
  return new;
end $$;
drop trigger if exists numero on public.tickets;
create trigger numero before insert on public.tickets for each row execute function public.numeroter_ticket();
select setval('public.tickets_seq', greatest(coalesce((select max(substring(d->>'numero' from '(\d+)$')::int) from public.tickets), 0), 1),
  exists (select 1 from public.tickets where d->>'numero' ~ '\d+$'));
create unique index if not exists tickets_numero on public.tickets ((d->>'numero'));

-- Lignes de prix existantes : rattachement au dossier de leur offre.
update public.lignes_prix lp set d = lp.d || jsonb_build_object('consultation_id', o.d->>'consultation_id', 'lot_id', o.d->>'lot_id')
  from public.offres o where o.id = lp.d->>'offre_id' and coalesce(lp.d->>'consultation_id', '') = '';

-- Modification : la ligne modifiée doit rester dans un dossier visible (WITH CHECK).
do $$
declare t text;
begin
  foreach t in array array['besoins','affectations','lots','grilles','criteres','grille_versions','modeles_grille','pieces_attendues','offres','pieces','annotations',
    'lignes_prix','notes','notes_historique','demandes','analyses','rapports','modeles_document','documents_dce','documents_versions','validations','marches',
    'evenements','fournisseurs','fournisseur_suivi','evaluations','reprises','habilitations','parametres','profils','annonces','tickets','factures','calculs']
  loop
    execute format('drop policy if exists modification on public.%I', t);
    execute format('create policy modification on public.%I for update to authenticated using (public.droit_ecriture(%L) and public.voit_dossier(d->>''consultation_id'')) with check (public.droit_ecriture(%L) and public.voit_dossier(d->>''consultation_id''))', t, t, t);
  end loop;
end $$;
-- Lectures sans dossier : elles exigent elles aussi une session valide (moi() non nul).
drop policy if exists lecture on public.consultations;
create policy lecture on public.consultations for select to authenticated using (public.voit_dossier(id) or (public.moi() is not null and (d->>'cree_par' = auth.uid()::text or cree_par = auth.uid())));
drop policy if exists modification on public.consultations;
create policy modification on public.consultations for update to authenticated using (public.droit_ecriture('consultations') and public.voit_dossier(id)) with check (public.droit_ecriture('consultations'));
drop policy if exists lecture on public.tickets;
create policy lecture on public.tickets for select to authenticated using (public.moi() is not null and (d->>'demandeur_id' = auth.uid()::text or public.a_droit('support.traiter') or public.a_droit('admin.utilisateurs')));
drop policy if exists lecture on public.notifications; drop policy if exists modification on public.notifications;
create policy lecture on public.notifications for select to authenticated using (d->>'destinataire_id' = auth.uid()::text and public.moi() is not null);
create policy modification on public.notifications for update to authenticated using (d->>'destinataire_id' = auth.uid()::text and public.moi() is not null);

-- Page publique : identité de l'organisme et annonces actives lisibles sans connexion (et avant l'aal2).
grant select on public.parametres, public.annonces to anon;
drop policy if exists identite_publique on public.parametres;
create policy identite_publique on public.parametres for select to anon, authenticated using (id = 'identite');
drop policy if exists accueil_public on public.annonces;
create policy accueil_public on public.annonces for select to anon, authenticated using (coalesce((d->>'actif')::boolean, false));

/* =====================================================================================================
   G. Stockage
   ===================================================================================================== */
update storage.buckets set file_size_limit = 10485760 where id = 'pieces';
-- Compartiment public de la page d'accueil (photos des annonces, logo). 4 Mo : même plafond que l'écran d'édition.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accueil', 'accueil', true, 4194304, '{image/jpeg,image/png,image/webp}')
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists accueil_lecture on storage.objects; drop policy if exists accueil_depot on storage.objects;
drop policy if exists accueil_maj on storage.objects; drop policy if exists accueil_suppression on storage.objects;
create policy accueil_lecture on storage.objects for select to authenticated using (bucket_id = 'accueil');
create policy accueil_depot on storage.objects for insert to authenticated with check (bucket_id = 'accueil' and (public.a_droit('accueil.ecrire') or public.a_droit('admin.parametres')));
create policy accueil_maj on storage.objects for update to authenticated using (bucket_id = 'accueil' and (public.a_droit('accueil.ecrire') or public.a_droit('admin.parametres')));
create policy accueil_suppression on storage.objects for delete to authenticated using (bucket_id = 'accueil' and (public.a_droit('accueil.ecrire') or public.a_droit('admin.parametres')));

-- Pièces : 1er dossier = consultation (accès au dossier), « support/<uid> » (déposant, support, administrateur), sinon dossier libre.
drop policy if exists pieces_lecture on storage.objects; drop policy if exists pieces_depot on storage.objects; drop policy if exists pieces_suppression on storage.objects;
create policy pieces_depot on storage.objects for insert to authenticated with check (bucket_id = 'pieces' and public.moi() is not null and (
  (exists (select 1 from public.consultations c where c.id = (storage.foldername(name))[1]) and public.voit_dossier((storage.foldername(name))[1]) and public.droit_ecriture('pieces'))
  or ((storage.foldername(name))[1] = 'support' and (storage.foldername(name))[2] = auth.uid()::text and (public.a_droit('support.declarer') or public.a_droit('support.traiter')))
  or (coalesce((storage.foldername(name))[1], '') <> 'support' and not exists (select 1 from public.consultations c where c.id = (storage.foldername(name))[1]) and public.droit_ecriture('pieces'))));
create policy pieces_lecture on storage.objects for select to authenticated using (bucket_id = 'pieces' and public.moi() is not null and (
  (exists (select 1 from public.consultations c where c.id = (storage.foldername(name))[1]) and public.voit_dossier((storage.foldername(name))[1]))
  or ((storage.foldername(name))[1] = 'support' and ((storage.foldername(name))[2] = auth.uid()::text or public.a_droit('support.traiter') or public.a_droit('admin.utilisateurs')))
  or (coalesce((storage.foldername(name))[1], '') <> 'support' and not exists (select 1 from public.consultations c where c.id = (storage.foldername(name))[1]))));
create policy pieces_suppression on storage.objects for delete to authenticated using (bucket_id = 'pieces' and public.moi() is not null
  and (public.a_droit('admin.utilisateurs') or owner_id = auth.uid()::text));

/* =====================================================================================================
   H. Remise à zéro de la démonstration (chaque nuit à 23 h UTC, 3 h à La Réunion)
   ===================================================================================================== */
create table if not exists public.demo_seed (table_nom text not null, id text not null, d jsonb not null, cree_le timestamptz not null default now(), primary key (table_nom, id));
create table if not exists public.demo_meta (cle text primary key, valeur jsonb);
alter table public.demo_seed enable row level security; alter table public.demo_meta enable row level security;
revoke all on public.demo_seed, public.demo_meta from anon, authenticated;

-- Décale toutes les dates du jeu (« AAAA-MM-JJ » ou instant ISO) pour que la démonstration reste d'actualité.
create or replace function public.decaler_dates(j jsonb, delta interval) returns jsonb language plpgsql immutable as $$
declare s text; r jsonb;
begin
  case jsonb_typeof(j)
    when 'object' then select coalesce(jsonb_object_agg(e.key, public.decaler_dates(e.value, delta)), '{}'::jsonb) into r from jsonb_each(j) e; return r;
    when 'array' then select coalesce(jsonb_agg(public.decaler_dates(e.value, delta) order by e.ord), '[]'::jsonb) into r from jsonb_array_elements(j) with ordinality e(value, ord); return r;
    when 'string' then
      s := j #>> '{}';
      if s ~ '^\d{4}-\d{2}-\d{2}$' then return to_jsonb(to_char(s::date + delta, 'YYYY-MM-DD')); end if;
      if s ~ '^\d{4}-\d{2}-\d{2}T[\d:.]+Z$' then return to_jsonb(to_char((s::timestamptz + delta) at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')); end if;
      if s ~ '^\d{4}-\d{2}-\d{2}T[\d:.]+$' then return to_jsonb(to_char(s::timestamp + delta, 'YYYY-MM-DD"T"HH24:MI:SS')); end if;
      return j;
    else return j;
  end case;
end $$;

create or replace function public.reinitialiser_demo() returns void
language plpgsql security definer set search_path = public, extensions, auth, pg_temp as $$
declare t text; v_delta interval; v_mdp text; v_facteur jsonb; v_fid uuid;
  v_tables text[] := array['profils','habilitations','parametres','journal','besoins','consultations','affectations','lots','grilles','criteres',
    'grille_versions','modeles_grille','pieces_attendues','offres','pieces','annotations','lignes_prix','notes','notes_historique','demandes',
    'analyses','rapports','modeles_document','documents_dce','documents_versions','validations','marches','evenements','fournisseurs',
    'fournisseur_suivi','evaluations','reprises','annonces','notifications','tickets','factures','calculs'];
  v_demo uuid[] := array['00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000004','00000000-0000-4000-a000-000000000005','00000000-0000-4000-a000-000000000006']::uuid[];
begin
  if auth.uid() is not null then raise exception 'REGLE: Remise à zéro réservée au serveur.'; end if;
  select make_interval(days => current_date - (valeur #>> '{}')::date) into v_delta from public.demo_meta where cle = 'date_generation';
  if v_delta is null then raise exception 'Jeu de démonstration absent (demo_meta.date_generation) : exécuter supabase/seed/charger.sql.'; end if;

  -- 1. données métier
  execute 'truncate ' || (select string_agg(format('public.%I', x), ', ') from unnest(v_tables) x) || ', public.verrous_connexion';
  -- 2. jeu de référence, dates décalées au jour courant
  foreach t in array v_tables loop
    execute format('insert into public.%I (id, d, cree_le, cree_par) select s.id, public.decaler_dates(s.d, $1), s.cree_le + $1,
      case when s.d->>''cree_par'' ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'' then (s.d->>''cree_par'')::uuid end
      from public.demo_seed s where s.table_nom = %L', t, t) using v_delta;
  end loop;
  truncate public.trace_technique;

  -- 3. comptes : mot de passe et adresse d'origine, déverrouillage, sessions fermées, facteurs ajoutés par les visiteurs supprimés
  v_mdp := coalesce((select valeur #>> '{}' from public.demo_meta where cle = 'mot_de_passe'), 'Demonstration-2026');
  update auth.users u set encrypted_password = extensions.crypt(v_mdp, extensions.gen_salt('bf')), banned_until = null, updated_at = now(),
    email = coalesce((select s.d->>'email' from public.demo_seed s where s.table_nom = 'profils' and s.id = u.id::text), u.email),
    email_change = '', email_change_token_new = '', email_change_token_current = '', recovery_token = ''
   where u.id = any(v_demo);
  v_facteur := (select valeur from public.demo_meta where cle = 'facteur_admin');
  v_fid := nullif(v_facteur->>'id', '')::uuid;
  delete from auth.mfa_factors f where f.user_id = any(v_demo)
    and (f.user_id <> v_demo[1] or (v_fid is not null and f.id <> v_fid));
  if v_fid is not null and not exists (select 1 from auth.mfa_factors where id = v_fid) then
    insert into auth.mfa_factors select * from jsonb_populate_record(null::auth.mfa_factors, v_facteur);
  end if;
  delete from auth.sessions where user_id = any(v_demo);
  -- comptes créés par les visiteurs (marqués par creer_compte) ; identités et sessions suivent par cascade
  delete from auth.users where raw_app_meta_data->>'vavang_visiteur' = 'true' and not (id = any(v_demo));

  -- 4. numérotation des demandes d'assistance
  perform setval('public.tickets_seq', greatest(coalesce((select max(substring(d->>'numero' from '(\d+)$')::int) from public.tickets), 0), 1),
    exists (select 1 from public.tickets where d->>'numero' ~ '\d+$'));
end $$;

do $$ begin perform cron.unschedule('reinit-demo'); exception when others then null; end $$;
select cron.schedule('reinit-demo', '0 23 * * *', 'select public.reinitialiser_demo()');

/* =====================================================================================================
   Droits d'exécution : rien pour anon, sauf le signalement d'échec de connexion
   ===================================================================================================== */
revoke execute on function public.moi(), public.a_droit(text), public.voit_dossier(text), public.droit_ecriture(text), public.refuser(text),
  public.mfa_requis(text), public.mon_profil(), public.exiger_admin() from public, anon;
grant execute on function public.moi(), public.a_droit(text), public.voit_dossier(text), public.droit_ecriture(text), public.refuser(text),
  public.mfa_requis(text), public.mon_profil(), public.exiger_admin() to authenticated;

revoke execute on function public.journaliser(text, text, text, text, jsonb, text, text, text) from public, anon;
grant execute on function public.journaliser(text, text, text, text, jsonb, text, text, text) to authenticated;

revoke execute on function public.creer_compte(text, text, text, text, text), public.definir_mot_de_passe(uuid, text), public.revoquer_sessions(uuid),
  public.reinitialiser_mfa(uuid), public.etat_securite_comptes(), public.connexion_reussie(), public.deverrouiller_compte(uuid),
  public.mes_evenements_securite(int) from public, anon;
grant execute on function public.creer_compte(text, text, text, text, text), public.definir_mot_de_passe(uuid, text), public.revoquer_sessions(uuid),
  public.reinitialiser_mfa(uuid), public.etat_securite_comptes(), public.connexion_reussie(), public.deverrouiller_compte(uuid),
  public.mes_evenements_securite(int) to authenticated;

revoke execute on function public.signaler_echec_connexion(text) from public;
grant execute on function public.signaler_echec_connexion(text) to anon, authenticated;

-- Fonctions internes : ni anon ni authenticated (déclencheurs, journal serveur, remise à zéro).
revoke execute on function public.journal_serveur(text, text, text, text, jsonb, text), public.est_compte_demo(uuid), public.reinitialiser_demo(),
  public.decaler_dates(jsonb, interval), public.garde(), public.fin_sessions(), public.numeroter_ticket() from public, anon, authenticated;
