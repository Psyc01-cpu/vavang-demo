-- Comptes de démonstration partagés (@demo.example) : un visiteur qui y associerait son compte GitHub exposerait
-- son identité (adresse e-mail) aux autres visiteurs. Purge chaque nuit à 23 h 05 UTC (3 h 05 à La Réunion),
-- juste après la remise à zéro de la démo. Exécuté le 19/11/2026.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-identites-demo';
select cron.schedule('purge-identites-demo', '5 23 * * *', $$
  delete from auth.identities i using auth.users u
   where i.user_id = u.id and u.email like '%@demo.example' and i.provider <> 'email'
$$);
-- Purge immédiate
delete from auth.identities i using auth.users u where i.user_id = u.id and u.email like '%@demo.example' and i.provider <> 'email';
select jobname, schedule from cron.job order by jobname;
