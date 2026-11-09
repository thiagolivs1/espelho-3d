// Edge Function: gerente ou admin cria a conta de um corretor (e-mail + senha provisória) e a ativa.
// A chave de serviço vem do ambiente da função (SUPABASE_SERVICE_ROLE_KEY) e nunca do repositório.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGENS = ['https://thiagolivs1.github.io', 'http://localhost:8080'];

function cors(req: Request) {
  const origem = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENS.includes(origem) ? origem : ORIGENS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const resposta = (req: Request, status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return resposta(req, 405, { erro: 'Use POST.' });

  const auth = req.headers.get('Authorization');
  if (!auth) return resposta(req, 401, { erro: 'Entre na sua conta para criar corretores.' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const pessoa = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: papel, error: erroPapel } = await pessoa.rpc('my_role');
  if (erroPapel || !['admin', 'gerente'].includes(papel ?? '')) {
    return resposta(req, 403, { erro: 'Só gerentes podem criar contas de corretor.' });
  }

  let corpo: { email?: string; senha?: string };
  try { corpo = await req.json(); } catch { return resposta(req, 400, { erro: 'Envie e-mail e senha.' }); }
  const email = String(corpo.email ?? '').trim().toLowerCase();
  const senha = String(corpo.senha ?? '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta(req, 400, { erro: 'Digite um e-mail válido.' });
  if (senha.length < 8) return resposta(req, 400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
  if (error || !data.user) {
    const jaExiste = /already|registered|exists/i.test(error?.message ?? '');
    return resposta(req, 400, { erro: jaExiste ? 'Este e-mail já tem conta.' : 'Não foi possível criar a conta.' });
  }
  const { error: erroPerfil } = await admin.from('profiles').update({ role: 'corretor', ativo: true }).eq('id', data.user.id);
  if (erroPerfil) return resposta(req, 500, { erro: 'Conta criada, mas não foi possível ativá-la. Ative pela lista.' });
  return resposta(req, 200, { id: data.user.id });
});
