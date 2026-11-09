// Dados do simulador de fluxo: o mesmo arquivo de unidades da maquete + preços do banco.
// O simulador nunca recebe situação de venda: toda unidade é selecionável.
import { mergeUnits, toSimuladorRows, avisoPrecos } from './model.js';
import { fetchPrices } from './supabase.js';

// Devolve { linhas, aviso }. aviso ≠ null quando o banco falhou e os preços vieram só do arquivo.
export async function carregarUnidadesSimulador(slug) {
  const arquivo = await fetch(new URL(`../${slug}/units.json`, import.meta.url)).then(r => {
    if (!r.ok) throw new Error(`units.json não encontrado (${r.status})`);
    return r.json();
  });
  const precos = await fetchPrices(slug).catch(() => null);
  return { linhas: toSimuladorRows(mergeUnits(arquivo.unidades, precos, null)), aviso: avisoPrecos(precos) };
}
