// Regras puras do modelo de dados: juntar arquivo + banco, resumir, filtrar, comparar.
import { unitKey } from './units.js';

// Situações null ou vazias = desconhecidas (falha de rede, acesso desativado). Nunca viram "disponível".
export function mergeUnits(units, prices, statuses) {
  const st = statuses && statuses.size ? statuses : null;
  return units.map(u => {
    const key = unitKey(u.torre, u.unidade);
    const p = prices && prices.get(key);
    return {
      ...u, key,
      venda: p ? p.venda : u.venda,
      avaliacao: p ? p.avaliacao : u.avaliacao,
      precoFonte: p ? 'banco' : 'arquivo',
      status: (st && st.get(key)) || null,
    };
  });
}

const menorPreco = views => Math.min(...views.map(u => u.venda));

export function summarize(views, logado) {
  const conhecido = logado && views.length > 0 && views.every(u => u.status !== null);
  if (!conhecido) return { total: views.length, disponiveis: null, pctVendido: null, aPartirDe: menorPreco(views) };
  const disp = views.filter(u => u.status === 'D');
  return {
    total: views.length,
    disponiveis: disp.length,
    pctVendido: views.filter(u => u.status === 'V').length / views.length,
    aPartirDe: menorPreco(disp.length ? disp : views),
  };
}

export function filterUnits(views, { tipologia = 'all', soDisponiveis = false } = {}) {
  return views.filter(u => {
    if (tipologia === '2q' && u.quartos !== 2) return false;
    if (tipologia === '3q' && u.quartos !== 3) return false;
    if (tipologia === 'garden' && !u.tipologia.endsWith('Garden')) return false;
    if (soDisponiveis && u.status !== 'D') return false;
    return true;
  });
}

// America/Fortaleza = UTC−3 fixo (sem horário de verão).
const OFFSET_MS = 3 * 3600 * 1000;
const DIA_MS = 24 * 3600 * 1000;

export function isStale(updatedAt, now) {
  const local = new Date(now.getTime() - OFFSET_MS);              // relógio de Fortaleza lido em UTC
  let dia = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - DIA_MS;
  while ([0, 6].includes(new Date(dia).getUTCDay())) dia -= DIA_MS; // último dia útil antes de hoje
  return updatedAt.getTime() < dia + OFFSET_MS;                     // 00:00 de Fortaleza desse dia
}

export function diffChanges(original, editado) {
  const out = [];
  for (const [key, ed] of editado) {
    const or = original.get(key) || {};
    const m = /^u-(\d+)-(\d+)$/.exec(key);
    const mud = { torre: Number(m[1]), unidade: Number(m[2]) };
    if (ed.status !== undefined && ed.status !== or.status) mud.status = ed.status;
    if (ed.venda !== undefined && ed.venda !== or.venda) mud.venda = ed.venda;
    if (Object.keys(mud).length > 2) out.push(mud);
  }
  return out;
}

export function toSimuladorRows(views) {
  return views
    .map(u => [u.torre, u.unidade, u.area, u.venda, u.avaliacao, 0])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// Grade do gerente: recarregar (e perder edições) só quando a pessoa logada muda de fato.
export const precisaRecarregar = (usuarioAtual, usuarioNovo) => (usuarioAtual ?? null) !== (usuarioNovo ?? null);

// Preço que muda mais de 50% em relação ao atual provavelmente é erro de digitação.
export const precoSuspeito = (antigo, novo) => antigo > 0 && Math.abs(novo / antigo - 1) > 0.5;

export const AVISO_PRECOS = 'Preços da tabela publicada; não foi possível confirmar atualizações.';
export const avisoPrecos = prices => (prices ? null : AVISO_PRECOS);

// Grava itens com até `concorrencia` pedidos ao mesmo tempo, avisando o progresso.
// No primeiro erro, para de iniciar novos e rejeita com e.gravados = quantos já foram gravados.
export async function aplicarEmLotes(itens, gravar, { concorrencia = 6, aoProgredir = () => {} } = {}) {
  let proximo = 0, gravados = 0, erro = null;
  const trabalhador = async () => {
    while (!erro && proximo < itens.length) {
      const item = itens[proximo++];
      try { await gravar(item); gravados++; aoProgredir(gravados, itens.length); }
      catch (e) { erro = erro || e; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concorrencia, itens.length) }, trabalhador));
  if (erro) { erro.gravados = gravados; throw erro; }
  return { gravados };
}
