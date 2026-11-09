// Regras puras das unidades: sem DOM, sem three.js, sem Supabase (roda no Node e no navegador).

export const STATUS = { D: 'Disponível', R: 'Reservada', V: 'Vendida', B: 'Bloqueada' };

export const floorOf = unidade => Math.floor(unidade / 100);
export const columnOf = unidade => unidade % 100;
export const unitLabel = unidade => (unidade < 100 ? String(unidade).padStart(3, '0') : String(unidade));
export const unitKey = (torre, unidade) => `u-${torre}-${unidade}`;

export function parseUnitHash(hash) {
  const m = /^#?u-(\d+)-(\d{1,4})$/.exec(hash || '');
  return m ? { torre: Number(m[1]), unidade: Number(m[2]) } : null;
}

export function findUnit(units, ref) {
  if (!ref) return null;
  return units.find(u => u.torre === ref.torre && u.unidade === ref.unidade) || null;
}

// PDF p. 13–16: colunas 1/4/5/8 são o tipo de 3 quartos; 2/3/6/7 o de 2 quartos.
// Térreo é Garden; na Torre 1, as colunas de 2 quartos são PNE no térreo e do 1º ao 3º.
export function tipologiaFor(torre, unidade) {
  const andar = floorOf(unidade), coluna = columnOf(unidade);
  const tresQuartos = [1, 4, 5, 8].includes(coluna);
  const garden = andar === 0;
  const pne = !tresQuartos && torre === 1 && andar <= 3;
  const base = tresQuartos ? (garden ? 'A1' : 'A') : (pne ? 'B-PNE' : 'B');
  return { codigo: garden ? `${base} Garden` : base, quartos: tresQuartos ? 3 : 2, garden, pne };
}

const espacoComum = s => s.replace(/ | /g, ' ');

export const formatBRL = v =>
  espacoComum(v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }));

export function formatShortBRL(v) {
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  return `R$ ${Math.round(v / 1000).toLocaleString('pt-BR')} mil`;
}

export const formatArea = v => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;

// Aceita "360.000,00", "R$ 1.234,5", "360000". Ponto é milhar; vírgula é decimal.
export function parseBRL(text) {
  const t = String(text ?? '').replace(/R\$/g, '').replace(/\s/g, '');
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
  const v = Number(t.replace(/\./g, '').replace(',', '.'));
  return v > 0 ? v : null;
}
