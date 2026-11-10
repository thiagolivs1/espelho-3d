// Cor de cada unidade na maquete. Puro: roda no Node e no navegador.
// mapa: 'real' = fachada dos renders sem tingir; 'neutro' = fachada clara tingida pela cor da situação.
export const CORES_SITUACAO = { D: '#2E7A57', R: '#C98A12', V: '#A59D90', B: '#D5DADD' };
const COR_DESCONHECIDA = '#BDB8AE', COR_FORA_FILTRO = '#8F8A80';

export function corDaUnidade(v, modo, visiveis, _cores) {
  const mapa = modo === 'disponibilidade' ? 'neutro' : 'real';
  if (visiveis && !visiveis.has(v.key)) return { cor: COR_FORA_FILTRO, opacidade: 0.18, mapa };
  if (modo === 'disponibilidade') return { cor: v.status ? CORES_SITUACAO[v.status] : COR_DESCONHECIDA, opacidade: 1, mapa };
  return { cor: '#FFFFFF', opacidade: 1, mapa };
}
