// Fonction serveur (Supabase Edge Function) : création d'un compte et réinitialisation d'un mot de passe.
// Réservée aux utilisateurs dont le profil porte l'habilitation « admin.utilisateurs ».
// ÉTAT : écrite, pas encore déployée (en attente de l'accord sur l'hébergement).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const entetes = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const reponse = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: entetes });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: entetes });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const appelant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: droit, error: e1 } = await appelant.rpc('a_droit', { droit: 'admin.utilisateurs' });
    if (e1 || droit !== true) return reponse({ erreur: 'Action réservée aux administrateurs.' }, 403);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const c = await req.json();
    if (typeof c.mot_de_passe !== 'string' || c.mot_de_passe.length < 12) return reponse({ erreur: 'Le mot de passe doit compter au moins 12 caractères.' }, 400);

    if (c.operation === 'creer') {
      const { data, error } = await admin.auth.admin.createUser({ email: c.email, password: c.mot_de_passe, email_confirm: true });
      if (error) return reponse({ erreur: error.message }, 400);
      const { error: e2 } = await admin.from('profils').insert({ id: data.user.id, d: { email: c.email, nom: c.nom, role: c.role, service: c.service ?? '', actif: true } });
      if (e2) return reponse({ erreur: e2.message }, 400);
      return reponse({ id: data.user.id });
    }
    if (c.operation === 'mot_de_passe') {
      const { error } = await admin.auth.admin.updateUserById(c.id, { password: c.mot_de_passe });
      if (error) return reponse({ erreur: error.message }, 400);
      return reponse({ ok: true });
    }
    return reponse({ erreur: 'Opération inconnue.' }, 400);
  } catch (e) {
    return reponse({ erreur: String((e as Error).message ?? e) }, 500);
  }
});
