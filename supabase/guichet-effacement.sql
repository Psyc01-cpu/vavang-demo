-- Guichet : effacement des coordonnées des demandeurs 12 mois après la clôture de la demande (engagement du mémoire technique).
-- Tâche pg_cron mensuelle (le 1er du mois à 22 h 30 UTC, 2 h 30 à La Réunion). Exécuté le 19/11/2026. Rejouable.
create or replace function public.effacer_coordonnees_guichet() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update public.tickets t
     set d = (t.d - 'demandeur' - 'demandeur_nom' - 'rappels')
             || jsonb_build_object('demandeur', jsonb_build_object('efface', true), 'demandeur_nom', 'Demandeur (coordonnées effacées)',
                                   'coordonnees_effacees_le', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
   where t.d->>'origine' = 'guichet' and t.d->>'statut' = 'clos'
     and nullif(t.d->>'clos_le', '')::timestamptz < now() - interval '12 months'
     and coalesce((t.d->'demandeur'->>'efface')::boolean, false) = false;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.effacer_coordonnees_guichet() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'effacement-guichet';
select cron.schedule('effacement-guichet', '30 22 1 * *', 'select public.effacer_coordonnees_guichet()');
select public.effacer_coordonnees_guichet() as effacees_maintenant, (select count(*) from cron.job where jobname = 'effacement-guichet') as tache;
