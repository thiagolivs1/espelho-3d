// Cor de cada unidade na maquete. Puro: roda no Node e no navegador.
export const CORES_SITUACAO = { D: '#2E7A57', R: '#C98A12', V: '#A59D90', B: '#D5DADD' };
const COR_TABELA = '#E9E3D7', COR_DESCONHECIDA = '#BDB8AE', COR_FORA_FILTRO = '#8F8A80';

export function corDaUnidade(v, modo, visiveis, cores) {
  if (visiveis && !visiveis.has(v.key)) return { cor: COR_FORA_FILTRO, opacidade: 0.18 };
  if (modo === 'disponibilidade') return { cor: v.status ? CORES_SITUACAO[v.status] : COR_DESCONHECIDA, opacidade: 1 };
  if (modo === 'fachada') return { cor: [2, 3, 6, 7].includes(v.coluna) ? cores.fachada.faixa : cores.fachada.base, opacidade: 1 };
  return { cor: COR_TABELA, opacidade: 1 };
}
