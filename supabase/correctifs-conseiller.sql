-- Correctifs issus du conseiller de sécurité Supabase (splinter), exécutés le 19/11/2026.
-- 1. search_path figé sur les fonctions qui n'en avaient pas.
alter function public.refuser(text) set search_path = public, pg_temp;
alter function public.decaler_dates(jsonb, interval) set search_path = public, pg_temp;
-- 2. Compartiment public « accueil » : les images restent servies par leur URL publique,
--    mais seule une personne habilitée à modifier l'accueil peut lister le contenu du compartiment.
drop policy if exists accueil_lecture on storage.objects;
create policy accueil_lecture on storage.objects for select to authenticated
  using (bucket_id = 'accueil' and (public.a_droit('accueil.ecrire') or public.a_droit('admin.parametres')));
-- 3. Fonction technique créée par Supabase (activation automatique de la RLS) : non appelable sans connexion.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
-- 4. Fonctions internes : réservées aux politiques et aux autres fonctions, pas appelables directement en RPC.
revoke execute on function public.exiger_admin() from public, anon, authenticated;
