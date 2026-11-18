-- Éditeur riche du DCE et GED — complément FACULTATIF au schéma (aucune nouvelle table).
-- ÉTAT : NON EXÉCUTÉ (à exécuter par l'administrateur du projet Supabase, dans l'éditeur SQL).
--
-- Rien ici n'est nécessaire au fonctionnement :
--   - la GED range l'arborescence dans consultations.d->'ged_dossiers' et le rangement dans pieces.d->>'ged_dossier_id' :
--     les règles d'accès existantes s'appliquent (consultations.ecrire pour les dossiers, droits d'écriture des pièces pour le rangement) ;
--   - l'éditeur riche stocke le HTML assaini dans documents_dce.d->>'contenu_html', à côté du texte brut « contenu ».
--
-- Ce que ce fichier ajoute : la règle « document dans le circuit = contenu figé » étendue à la mise en forme.
-- Le déclencheur « garde » existant ne compare que « contenu » (texte brut) ; sans ce complément, un appel direct à l'API
-- pourrait modifier seulement la mise en forme (contenu_html) d'un document en relecture ou validé, sans changer son texte.

create or replace function public.garde_dce_html() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- opérations d'administration (clé de service)
  if old.d->>'statut' <> 'redaction' and old.d->>'statut' = new.d->>'statut' and old.d->'contenu_html' is distinct from new.d->'contenu_html' then
    perform public.refuser('Le document est dans le circuit de validation : il doit revenir en rédaction pour être modifié.');
  end if;
  return new;
end $$;

drop trigger if exists garde_dce_html on public.documents_dce;
create trigger garde_dce_html before update on public.documents_dce for each row execute function public.garde_dce_html();
