// Acesso ao Supabase (só navegador). Preços são públicos; situação e histórico exigem login ativo.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { unitKey } from './units.js';
import { aplicarEmLotes } from './model.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true } });

const LIMITE_MS = 8000;
const comLimite = p => Promise.race([
  p, new Promise((_, rej) => setTimeout(() => rej(new Error('O servidor demorou para responder.')), LIMITE_MS)),
]);
const ok = ({ data, error }) => { if (error) throw error; return data; };

export async function signIn(email, senha) {
  try {
    const { error } = await comLimite(supabase.auth.signInWithPassword({ email: email.trim(), password: senha }));
    if (!error) return { ok: true };
    return { ok: false, erro: /invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar. Tente de novo.' };
  } catch {
    return { ok: false, erro: 'Sem conexão com o servidor. Tente de novo em instantes.' };
  }
}

export const signOut = () => supabase.auth.signOut();

export async function currentSession() {
  return (await supabase.auth.getSession()).data.session;
}

export async function currentRole() {
  if (!(await currentSession())) return null;
  return ok(await comLimite(supabase.rpc('my_role'))) || null;
}

export async function fetchPrices(slug) {
  const rows = ok(await comLimite(supabase.from('unit_prices').select('torre,unidade,venda,avaliacao').eq('empreendimento', slug)));
  return new Map(rows.map(r => [unitKey(r.torre, r.unidade), {
    venda: Number(r.venda), avaliacao: r.avaliacao === null ? null : Number(r.avaliacao),
  }]));
}

export async function fetchStatuses(slug) {
  const rows = ok(await comLimite(supabase.from('unit_status').select('torre,unidade,status').eq('empreendimento', slug)));
  return new Map(rows.map(r => [unitKey(r.torre, r.unidade), r.status.trim()]));
}

export async function fetchLastUpdate(slug) {
  const rows = ok(await comLimite(supabase.rpc('ultima_atualizacao', { p_emp: slug })));
  return rows && rows.length ? { em: new Date(rows[0].em), por: rows[0].por || null } : null;
}

// ---------- equipe ----------
export async function listarEquipe() {
  const rows = ok(await comLimite(supabase.from('profiles').select('id,email,role,ativo').order('email')));
  return rows;
}

export async function definirAcesso(id, ativo, role = null) {
  ok(await comLimite(supabase.rpc('definir_acesso', { p_id: id, p_ativo: ativo, p_role: role })));
}

export async function criarCorretor(email, senha) {
  const { data, error } = await comLimite(supabase.functions.invoke('criar-corretor', { body: { email, senha } }));
  if (error) {
    let msg = 'Não foi possível criar a conta.';
    try { msg = (await error.context.json()).erro || msg; } catch { /* resposta sem corpo */ }
    throw new Error(msg);
  }
  return data;
}

export async function trocarSenha(nova) {
  ok(await comLimite(supabase.auth.updateUser({ password: nova })));
}

// Gerente confirma que conferiu a disponibilidade hoje, sem mudanças (conta como atualização).
export async function registrarConferencia(slug) {
  ok(await comLimite(supabase.from('conferencias').insert({ empreendimento: slug })));
}

// Recebe a saída de diffChanges: atualiza só os campos que mudaram, unidade por unidade,
// com até 6 unidades em paralelo. aoProgredir(feitas, total) acompanha importações grandes.
export async function saveChanges(slug, mudancas, aoProgredir) {
  const gravar = async m => {
    const alvo = q => q.eq('empreendimento', slug).eq('torre', m.torre).eq('unidade', m.unidade).select('unidade');
    if (m.status !== undefined) {
      const rows = ok(await comLimite(alvo(supabase.from('unit_status').update({ status: m.status }))));
      if (!rows.length) throw new Error(`Sem permissão para alterar a situação da unidade ${m.unidade} da Torre ${m.torre}.`);
    }
    if (m.venda !== undefined) {
      const rows = ok(await comLimite(alvo(supabase.from('unit_prices').update({ venda: m.venda }))));
      if (!rows.length) throw new Error(`Sem permissão para alterar o preço da unidade ${m.unidade} da Torre ${m.torre}.`);
    }
  };
  return aplicarEmLotes(mudancas, gravar, { concorrencia: 6, aoProgredir });
}
