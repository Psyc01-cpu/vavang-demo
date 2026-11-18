-- Gestion des marchés publics côté acheteur — schéma Supabase (Postgres), région UE.
-- ÉTAT : exécuté le 19/11/2026 sur le projet de démonstration (Supabase gratuit, région eu-west-1 Irlande).
--
-- Modèle : chaque table porte un identifiant, un document JSON « d » (les données métier, identiques à celles du
-- mode local et de l'export) et des colonnes techniques. Les règles d'accès par ligne et les déclencheurs ci-dessous
-- imposent côté serveur ce que l'interface vérifie déjà : habilitations par profil, accès par dossier,
-- grille verrouillée, validation par un autre agent habilité, historiques et journal non modifiables.

create extension if not exists pgcrypto;

do $$
declare t text;
begin
  foreach t in array array['profils','habilitations','parametres','journal','besoins','consultations','affectations','lots','grilles','criteres',
    'grille_versions','modeles_grille','pieces_attendues','offres','pieces','annotations','lignes_prix','notes','notes_historique','demandes',
    'analyses','rapports','modeles_document','documents_dce','documents_versions','validations','marches','evenements','fournisseurs',
    'fournisseur_suivi','evaluations','reprises','annonces','notifications','tickets','factures','calculs']
  loop
    execute format('create table if not exists public.%I (
      id text primary key default gen_random_uuid()::text,
      d jsonb not null default ''{}''::jsonb,
      cree_le timestamptz not null default now(),
      cree_par uuid default auth.uid(),
      modifie_le timestamptz)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create index if not exists %I on public.%I ((d->>''consultation_id''))', t || '_dossier', t);
  end loop;
end $$;
create index if not exists notes_lot on public.notes ((d->>'lot_id'));
create index if not exists pieces_offre on public.pieces ((d->>'offre_id'));
create index if not exists journal_date on public.journal (cree_le desc);

-- Trace technique : alimentée par déclencheur sur toutes les tables, inaccessible en écriture aux utilisateurs.
create table if not exists public.trace_technique (
  id bigint generated always as identity primary key, date timestamptz not null default now(),
  auteur uuid default auth.uid(), table_nom text not null, operation text not null, ligne_id text);
alter table public.trace_technique enable row level security;

/* ---------- Fonctions d'habilitation ---------- */
-- (la page d'accueil est lue avant connexion : voir la règle « accueil_public » plus bas)
create or replace function public.moi() returns jsonb language sql stable security definer set search_path = public as $$
  select d || jsonb_build_object('id', id) from profils where id = auth.uid()::text and coalesce((d->>'actif')::boolean, true)
$$;
create or replace function public.a_droit(droit text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from habilitations h where h.d->>'role' = public.moi()->>'role' and h.d->>'droit' = droit)
$$;
create or replace function public.voit_dossier(cid text) returns boolean language sql stable security definer set search_path = public as $$
  select public.moi() is not null and (cid is null or public.a_droit('consultations.toutes')
    or exists (select 1 from consultations c where c.id = cid and c.d->>'cree_par' = auth.uid()::text)
    or (public.a_droit('consultations.service') and exists (select 1 from consultations c where c.id = cid and c.d->>'service' = public.moi()->>'service'))
    or exists (select 1 from affectations a where a.d->>'consultation_id' = cid and a.d->>'profil_id' = auth.uid()::text))
$$;
create or replace function public.droit_ecriture(tbl text) returns boolean language sql stable security definer set search_path = public as $$
  select case tbl
    when 'besoins' then a_droit('besoins.ecrire') or a_droit('besoins.valider')
    when 'consultations' then a_droit('consultations.ecrire')
    when 'lots' then a_droit('consultations.ecrire')
    when 'affectations' then a_droit('consultations.ecrire')
    when 'pieces_attendues' then a_droit('consultations.ecrire')
    when 'grilles' then a_droit('analyse.parametrer') or a_droit('analyse.verrouiller')
    when 'criteres' then a_droit('analyse.parametrer')
    when 'grille_versions' then a_droit('analyse.verrouiller')
    when 'modeles_grille' then a_droit('modeles.ecrire')
    when 'modeles_document' then a_droit('modeles.ecrire')
    when 'offres' then a_droit('analyse.saisir') or a_droit('analyse.valider')
    when 'lignes_prix' then a_droit('analyse.saisir')
    when 'pieces' then a_droit('analyse.saisir') or a_droit('analyse.valider') or a_droit('dce.rediger') or a_droit('execution.ecrire') or a_droit('reprise.importer')
    when 'annotations' then moi() is not null
    when 'notes' then a_droit('analyse.saisir') or a_droit('analyse.valider')
    when 'notes_historique' then a_droit('analyse.saisir')
    when 'demandes' then a_droit('analyse.saisir') or a_droit('analyse.valider')
    when 'analyses' then a_droit('analyse.saisir') or a_droit('analyse.valider')
    when 'rapports' then a_droit('rapport.rediger') or a_droit('rapport.valider')
    when 'documents_dce' then a_droit('dce.rediger') or a_droit('dce.relire') or a_droit('dce.valider') or a_droit('dce.publier')
    when 'documents_versions' then a_droit('dce.rediger')
    when 'validations' then a_droit('dce.rediger') or a_droit('dce.relire') or a_droit('dce.valider') or a_droit('dce.publier') or a_droit('analyse.saisir') or a_droit('analyse.valider')
    when 'marches' then a_droit('execution.ecrire') or a_droit('reprise.importer')
    when 'evenements' then a_droit('execution.ecrire')
    when 'fournisseurs' then a_droit('fournisseurs.ecrire') or a_droit('reprise.importer')
    when 'fournisseur_suivi' then a_droit('fournisseurs.ecrire')
    when 'evaluations' then a_droit('evaluations.ecrire') or a_droit('evaluations.valider')
    when 'reprises' then a_droit('reprise.importer')
    when 'habilitations' then a_droit('admin.utilisateurs')
    when 'profils' then a_droit('admin.utilisateurs')
    when 'parametres' then a_droit('admin.parametres')
    when 'annonces' then a_droit('accueil.ecrire')
    when 'tickets' then a_droit('support.declarer') or a_droit('support.traiter')
    when 'factures' then a_droit('execution.ecrire')
    when 'calculs' then a_droit('analyse.saisir') or a_droit('analyse.valider')
    else false end
$$;

/* ---------- Règles d'accès par ligne ---------- */
do $$
declare t text;
begin
  foreach t in array array['besoins','affectations','lots','grilles','criteres','grille_versions','modeles_grille','pieces_attendues','offres','pieces','annotations',
    'lignes_prix','notes','notes_historique','demandes','analyses','rapports','modeles_document','documents_dce','documents_versions','validations','marches',
    'evenements','fournisseurs','fournisseur_suivi','evaluations','reprises','habilitations','parametres','profils','annonces','tickets','factures','calculs']
  loop
    execute format('drop policy if exists lecture on public.%I', t);
    execute format('drop policy if exists ajout on public.%I', t);
    execute format('drop policy if exists modification on public.%I', t);
    execute format('drop policy if exists suppression on public.%I', t);
    execute format('create policy lecture on public.%I for select to authenticated using (public.voit_dossier(d->>''consultation_id''))', t);
    execute format('create policy ajout on public.%I for insert to authenticated with check (public.droit_ecriture(%L) and public.voit_dossier(d->>''consultation_id''))', t, t);
    execute format('create policy modification on public.%I for update to authenticated using (public.droit_ecriture(%L) and public.voit_dossier(d->>''consultation_id'')) with check (public.droit_ecriture(%L))', t, t, t);
    execute format('create policy suppression on public.%I for delete to authenticated using (public.droit_ecriture(%L) and public.voit_dossier(d->>''consultation_id''))', t, t);
  end loop;
end $$;
-- Consultations : visibles si l'agent voit le dossier.
drop policy if exists lecture on public.consultations; drop policy if exists ajout on public.consultations; drop policy if exists modification on public.consultations; drop policy if exists suppression on public.consultations;
create policy lecture on public.consultations for select to authenticated using (public.voit_dossier(id) or d->>'cree_par' = auth.uid()::text);
create policy ajout on public.consultations for insert to authenticated with check (public.droit_ecriture('consultations'));
create policy modification on public.consultations for update to authenticated using (public.droit_ecriture('consultations') and public.voit_dossier(id));
create policy suppression on public.consultations for delete to authenticated using (public.droit_ecriture('consultations') and public.voit_dossier(id));
-- Journal : lecture réservée aux profils habilités ; aucune écriture directe (uniquement par la fonction journaliser).
drop policy if exists lecture on public.journal;
create policy lecture on public.journal for select to authenticated using (public.a_droit('journal.lire') and public.voit_dossier(d->>'consultation_id'));
drop policy if exists lecture on public.trace_technique;
create policy lecture on public.trace_technique for select to authenticated using (public.a_droit('journal.lire'));

-- Notifications : chacun ne lit et ne modifie que les siennes.
drop policy if exists lecture on public.notifications; drop policy if exists ajout on public.notifications; drop policy if exists modification on public.notifications;
create policy lecture on public.notifications for select to authenticated using (d->>'destinataire_id' = auth.uid()::text);
create policy ajout on public.notifications for insert to authenticated with check (public.moi() is not null);
create policy modification on public.notifications for update to authenticated using (d->>'destinataire_id' = auth.uid()::text);
-- Demandes d'assistance : le demandeur voit les siennes, le support et l'administrateur voient tout.
drop policy if exists lecture on public.tickets;
create policy lecture on public.tickets for select to authenticated using (d->>'demandeur_id' = auth.uid()::text or public.a_droit('support.traiter') or public.a_droit('admin.utilisateurs'));
-- Double authentification en hébergement : utiliser l'authentification multifacteur native de Supabase (TOTP),
-- en exigeant le niveau aal2 pour les administrateurs dans les règles d'accès (non écrit à ce stade).

-- Page d'accueil : les annonces actives sont lisibles sans connexion.
drop policy if exists accueil_public on public.annonces;
create policy accueil_public on public.annonces for select to anon using (coalesce((d->>'actif')::boolean, false));

create or replace function public.journaliser(p_action text, p_objet_type text default null, p_objet_id text default null, p_objet_libelle text default null,
  p_detail jsonb default null, p_consultation_id text default null, p_resultat text default 'réussi', p_origine text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m jsonb := public.moi();
begin
  insert into journal (d) values (jsonb_build_object('date', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'auteur_id', auth.uid()::text, 'auteur_nom', coalesce(m->>'nom', 'Non connecté'), 'auteur_role', m->>'role', 'action', p_action, 'objet_type', p_objet_type,
    'objet_id', p_objet_id, 'objet_libelle', p_objet_libelle, 'detail', p_detail, 'consultation_id', p_consultation_id, 'resultat', p_resultat, 'origine', p_origine));
end $$;
grant execute on function public.journaliser to anon, authenticated; -- « anon » : pour tracer les échecs de connexion

/* ---------- Déclencheurs : invariants métier ---------- */
create or replace function public.refuser(message text) returns void language plpgsql as $$ begin raise exception 'REGLE: %', message; end $$;

create or replace function public.garde() returns trigger language plpgsql security definer set search_path = public as $$
declare n jsonb := case when tg_op = 'DELETE' then null else new.d end; o jsonb := case when tg_op = 'INSERT' then null else old.d end; l jsonb := coalesce(n, o);
  uid text := auth.uid()::text; verrou boolean; valide boolean;
begin
  insert into trace_technique (table_nom, operation, ligne_id) values (tg_table_name, tg_op, coalesce(new.id, old.id));
  if uid is null then return coalesce(new, old); end if; -- opérations d'administration (clé de service) : non soumises aux règles
  if tg_op = 'UPDATE' then new.modifie_le := now(); end if;

  if tg_table_name in ('journal', 'notes_historique', 'documents_versions', 'validations', 'grille_versions') and tg_op <> 'INSERT' then
    perform refuser('Les historiques et le journal ne peuvent être ni modifiés ni supprimés.');
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
          if exists (select 1 from notes x where x.id <> new.id and x.d->>'offre_id' = n->>'offre_id' and x.d->>'critere_id' = n->>'critere_id' and x.d->>'statut' = 'validee') then perform refuser('Une autre contribution est déjà validée pour ce critère.'); end if;
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

  if tg_table_name = 'profils' and tg_op = 'UPDATE' and old.id = uid and (o->>'role' is distinct from n->>'role' or n->>'actif' = 'false') then perform refuser('Vous ne pouvez pas modifier votre propre profil ni désactiver votre propre compte.'); end if;
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['profils','habilitations','parametres','journal','besoins','consultations','affectations','lots','grilles','criteres','grille_versions','modeles_grille',
    'pieces_attendues','offres','pieces','annotations','lignes_prix','notes','notes_historique','demandes','analyses','rapports','modeles_document','documents_dce',
    'documents_versions','validations','marches','evenements','fournisseurs','fournisseur_suivi','evaluations','reprises','annonces','notifications','tickets','factures','calculs']
  loop
    execute format('drop trigger if exists garde on public.%I', t);
    execute format('create trigger garde before insert or update or delete on public.%I for each row execute function public.garde()', t);
  end loop;
end $$;

/* ---------- Stockage des fichiers : compartiment privé ---------- */
insert into storage.buckets (id, name, public) values ('pieces', 'pieces', false) on conflict (id) do nothing;
drop policy if exists pieces_lecture on storage.objects; drop policy if exists pieces_depot on storage.objects; drop policy if exists pieces_suppression on storage.objects;
create policy pieces_lecture on storage.objects for select to authenticated using (bucket_id = 'pieces' and public.moi() is not null
  and (not exists (select 1 from public.consultations c where c.id = (storage.foldername(name))[1]) or public.voit_dossier((storage.foldername(name))[1])));
create policy pieces_depot on storage.objects for insert to authenticated with check (bucket_id = 'pieces' and public.droit_ecriture('pieces'));
create policy pieces_suppression on storage.objects for delete to authenticated using (bucket_id = 'pieces' and public.a_droit('admin.utilisateurs'));
