-- vavang — correctifs proposés après la batterie de tests côté serveur (tests/en-ligne.mjs, 19/11/2026).
-- ÉTAT : NON EXÉCUTÉ. À relire puis exécuter d'un bloc dans l'éditeur SQL (rôle postgres), APRÈS schema.sql et schema_demo.sql.
-- Rejouable : create or replace, drop policy if exists. Après exécution, rejouer : node tests/en-ligne.mjs
--
-- Failles constatées sur la vraie base (résultats chiffrés dans mesures/en-ligne.json) :
--   F1. Stockage « pieces » : le test d'existence de la consultation est évalué AVEC les règles d'accès de l'appelant.
--       Pour un agent qui ne voit pas la consultation, « exists (select … from consultations) » est faux, et la 3e branche
--       (« dossier libre ») s'applique : il lit, liste et dépose dans le dossier d'une consultation qu'il ne voit pas.
--       Constaté : le support télécharge c1/demo-o1-0.txt et liste les 14 fichiers de c1 ; le prescripteur dépose un fichier dans c2.
--   F2. Verrouillage : signaler_echec_connexion(adresse) est appelable par anon sans aucune tentative de connexion.
--       Constaté : 5 appels anonymes suffisent à bloquer un compte (connexion refusée avec le bon mot de passe, « user_banned »).
--       N'importe qui connaissant une adresse peut donc bloquer ce compte, y compris le seul administrateur, en boucle.
--   F3. Données sans dossier de consultation (marchés, fournisseurs, évaluations, événements d'exécution…) : voit_dossier(null)
--       est vrai pour tout compte actif. Constaté : le support éditeur lit 3/3 marchés, 6/6 fournisseurs, 1/1 évaluation,
--       9/9 événements. (Choix de conception à confirmer ; correctif proposé ci-dessous.)

/* =====================================================================================================
   F1. Stockage : existence de la consultation lue sans les règles d'accès de l'appelant
   ===================================================================================================== */
-- Données générales (F3) : un profil dont les seuls droits sont « support.* » ne lit pas les données métier sans dossier.
create or replace function public.voit_donnees_generales() returns boolean language sql stable security definer set search_path = public as $$
  select public.moi() is not null and exists (select 1 from public.habilitations h where h.d->>'role' = public.moi()->>'role' and h.d->>'droit' not like 'support.%')
$$;
revoke execute on function public.voit_donnees_generales() from public, anon;
grant execute on function public.voit_donnees_generales() to authenticated;

create or replace function public.consultation_existe(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select cid is not null and exists (select 1 from public.consultations c where c.id = cid)
$$;
revoke execute on function public.consultation_existe(text) from public, anon;
grant execute on function public.consultation_existe(text) to authenticated;

drop policy if exists pieces_lecture on storage.objects; drop policy if exists pieces_depot on storage.objects;
create policy pieces_depot on storage.objects for insert to authenticated with check (bucket_id = 'pieces' and public.moi() is not null and (
  (public.consultation_existe((storage.foldername(name))[1]) and public.voit_dossier((storage.foldername(name))[1]) and public.droit_ecriture('pieces'))
  or ((storage.foldername(name))[1] = 'support' and (storage.foldername(name))[2] = auth.uid()::text and (public.a_droit('support.declarer') or public.a_droit('support.traiter')))
  or (coalesce((storage.foldername(name))[1], '') <> 'support' and not public.consultation_existe((storage.foldername(name))[1]) and public.droit_ecriture('pieces'))));
create policy pieces_lecture on storage.objects for select to authenticated using (bucket_id = 'pieces' and public.moi() is not null and (
  (public.consultation_existe((storage.foldername(name))[1]) and public.voit_dossier((storage.foldername(name))[1]))
  or ((storage.foldername(name))[1] = 'support' and ((storage.foldername(name))[2] = auth.uid()::text or public.a_droit('support.traiter') or public.a_droit('admin.utilisateurs')))
  or (coalesce((storage.foldername(name))[1], '') <> 'support' and not public.consultation_existe((storage.foldername(name))[1]) and public.voit_donnees_generales())));

/* =====================================================================================================
   F3. Données générales (sans dossier) : réservées aux profils ayant au moins un droit métier
   ===================================================================================================== */
-- Un profil dont les seuls droits sont « support.* » (support éditeur) ne lit pas les données métier sans dossier.
-- Les tables de fonctionnement (profils, habilitations, parametres, notifications, tickets, annonces) ne sont pas concernées :
-- l'application en a besoin pour tous les profils (noms des agents, réglages de sécurité, demandes d'assistance).

do $$
declare t text;
begin
  foreach t in array array['besoins','marches','evenements','factures','fournisseurs','fournisseur_suivi','evaluations','reprises','modeles_grille','modeles_document',
    'pieces','annotations','calculs','documents_dce','documents_versions','validations']
  loop
    execute format('drop policy if exists lecture on public.%I', t);
    execute format('create policy lecture on public.%I for select to authenticated using (case when coalesce(d->>''consultation_id'', '''') = '''' then public.voit_donnees_generales() else public.voit_dossier(d->>''consultation_id'') end)', t);
  end loop;
end $$;

/* =====================================================================================================
   F2. Verrouillage déclenchable par un tiers : atténuation
   ===================================================================================================== */
-- Limite de fond : sans « hook » de vérification de mot de passe côté service d'authentification (offre Supabase payante
-- d'après la documentation consultée — non vérifié), le serveur SQL ne peut pas savoir qu'une vraie tentative a échoué.
-- Atténuations proposées, à coût nul :
--   a) un même poste (adresse IP de la requête) ne compte que 10 signalements par quart d'heure, toutes adresses confondues ;
--   b) les comptes administrateurs ne sont jamais bannis automatiquement (l'échec reste journalisé et alerte) :
--      sinon un tiers peut bloquer en boucle le seul administrateur (un seul administrateur actif en démonstration).
-- L'en-tête d'adresse IP transmis par la passerelle Supabase (x-forwarded-for / cf-connecting-ip) est à confirmer — non vérifié.
create table if not exists public.signalements_poste (ip text not null, date timestamptz not null default now());
create index if not exists signalements_poste_ip on public.signalements_poste (ip, date);
alter table public.signalements_poste enable row level security;
revoke all on public.signalements_poste from anon, authenticated;

create or replace function public.signaler_echec_connexion(p_email text) returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_max int; v_duree int; v_echecs int; v_dernier timestamptz; v_uid uuid; v_role text;
  v_entetes json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(btrim(split_part(coalesce(v_entetes->>'x-forwarded-for', ''), ',', 1)), '');
begin
  if v_email = '' or length(v_email) > 254 then return; end if;
  if v_ip = '' then v_ip := coalesce(v_entetes->>'cf-connecting-ip', 'inconnue'); end if;
  -- a) plafond par poste
  delete from public.signalements_poste where date < now() - interval '1 hour';
  if (select count(*) from public.signalements_poste where ip = v_ip and date > now() - interval '15 minutes') >= 10 then
    perform public.journal_serveur('Signalements d''échec ignorés (plafond par poste atteint)', 'securite', null, v_email, jsonb_build_object('ip', v_ip), 'refusé');
    return;
  end if;
  insert into public.signalements_poste (ip) values (v_ip);

  select coalesce((d->'valeur'->>'echecs_max')::int, 5), coalesce((d->'valeur'->>'verrouillage_minutes')::int, 15) into v_max, v_duree from public.parametres where id = 'securite';
  v_max := coalesce(v_max, 5); v_duree := coalesce(v_duree, 15);
  delete from public.verrous_connexion where dernier_echec < now() - interval '1 day';
  insert into public.verrous_connexion (email, echecs, dernier_echec) values (v_email, 0, now()) on conflict (email) do nothing;
  select echecs, dernier_echec into v_echecs, v_dernier from public.verrous_connexion where email = v_email for update;
  if v_dernier < now() - make_interval(mins => v_duree) then v_echecs := 0; end if;
  v_echecs := v_echecs + 1;
  if v_echecs <= v_max + 2 then perform public.journal_serveur('Échec de connexion', 'session', null, v_email, jsonb_build_object('ip', v_ip), 'échec'); end if;
  if v_echecs >= v_max then
    select u.id into v_uid from auth.users u where lower(u.email) = v_email;
    if v_uid is not null then
      select d->>'role' into v_role from public.profils where id = v_uid::text;
      -- b) jamais de bannissement automatique d'un administrateur : alerte au journal seulement
      if v_role = 'administrateur' then
        perform public.journal_serveur('Échecs répétés sur un compte administrateur (non verrouillé)', 'securite', v_uid::text, v_email, jsonb_build_object('echecs', v_echecs, 'ip', v_ip), 'alerte');
        update public.verrous_connexion set echecs = 0, dernier_echec = now() where email = v_email;
        return;
      end if;
      if public.est_compte_demo(v_uid) then v_duree := least(v_duree, 2); end if;
      update auth.users set banned_until = now() + make_interval(mins => v_duree) where id = v_uid;
      update public.verrous_connexion set echecs = 0, dernier_echec = now(), verrouille_jusqua = now() + make_interval(mins => v_duree) where email = v_email;
      perform public.journal_serveur('Compte verrouillé après ' || v_max || ' échecs de connexion', 'securite', v_uid::text, v_email, jsonb_build_object('minutes', v_duree, 'ip', v_ip), 'refusé');
      return;
    end if;
  end if;
  update public.verrous_connexion set echecs = v_echecs, dernier_echec = now() where email = v_email;
end $$;
revoke execute on function public.signaler_echec_connexion(text) from public;
grant execute on function public.signaler_echec_connexion(text) to anon, authenticated;
-- Remise à zéro nocturne : vider aussi public.signalements_poste (à ajouter dans reinitialiser_demo, ligne « truncate … verrous_connexion »).
--
-- Effet attendu après exécution (NON VÉRIFIÉ tant que tests/en-ligne.mjs n'a pas été rejoué) : F1 et F3 conformes ; F2 reste NON CONFORME pour un compte non
-- administrateur (atténué seulement : 10 signalements par poste et par quart d'heure suffisent encore à verrouiller 2 comptes).
-- Correction complète : vérification de la tentative par le service d'authentification (hook) ou verrouillage par poste
-- plutôt que par compte — à décider.
