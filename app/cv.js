// Leitura do mapa de disponibilidade exportado pelo Construtor de Vendas (CSV, separador ";"). Puro.
import { unitKey, parseBRL } from './units.js';

export const SITUACAO_CV = { 'Disponível': 'D', 'Vendida': 'V', 'Reservada': 'R', 'Em processo': 'R', 'Bloqueada': 'B' };

export function parseVaga(texto) {
  const m = /^\s*(\d+)\s*\(\s*(T[eé]rreo|Sobressolo)\s*\)\s*$/i.exec(texto || '');
  if (!m) return null;
  return { numero: Number(m[1]), nivel: /^sob/i.test(m[2]) ? 'Sobressolo' : 'Térreo' };
}

// Divide uma linha CSV com aspas duplas ("" dentro de aspas é uma aspa).
function campos(linha) {
  const out = [];
  let atual = '', aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === ';') { out.push(atual); atual = ''; }
    else atual += c;
  }
  out.push(atual);
  return out.map(s => s.trim());
}

const normaliza = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const parseArea = t => { const v = Number(String(t || '').replace(/m²|m2/gi, '').trim().replace(/\./g, '').replace(',', '.')); return v > 0 ? v : null; };

// areas: Map<unitKey, área privativa> do pacote. Unidade fora do pacote, ou com área diferente
// (empreendimento irmão com a mesma numeração), conta como desconhecida.
export function parseCvCsv(texto, areas) {
  const bruto = String(texto).replace(/^﻿/, '');
  const linhasTxt = bruto.split(/\r?\n/);
  const cab = linhasTxt[0] || '';
  const vazio = { linhas: [], erros: [] };
  // "Ã" = UTF-8 lido duas vezes; "�" = arquivo em Windows-1252 (padrão do Excel) lido como UTF-8.
  if (/Ã/.test(cab) || /�/.test(bruto)) return { ...vazio, recusado: 'Salve o arquivo do CV em UTF-8 e tente de novo.' };

  const nomes = campos(cab).map(normaliza);
  const col = nome => nomes.indexOf(nome);
  const iBloco = col('bloco'), iUnid = col('unidade'), iSit = col('situacao'), iValor = col('valor'), iGar = col('garagem'), iArea = col('area');
  if ([iBloco, iUnid, iSit, iValor].some(i => i < 0))
    return { ...vazio, recusado: 'O arquivo não tem as colunas do mapa do CV (Bloco, Unidade, Situação, Valor).' };

  const linhas = [], erros = [];
  let total = 0, desconhecidas = 0;
  linhasTxt.slice(1).forEach((txt, i) => {
    if (!txt.trim()) return;
    total++;
    const n = i + 2, c = campos(txt);
    const bloco = c[iBloco] || '', torre = Number((/(\d+)\s*$/.exec(bloco) || [])[1]), unidade = Number(c[iUnid]);
    const ref = `${bloco} · ${c[iUnid]}`;
    const key = unitKey(torre, unidade);
    if (!torre || !unidade || !areas.has(key)) {
      desconhecidas++;
      erros.push(`Linha ${n}: ${ref} não existe neste empreendimento.`);
      return;
    }
    const area = iArea >= 0 ? parseArea(c[iArea]) : null;
    if (area !== null && Math.abs(area - areas.get(key)) > 0.02) {
      desconhecidas++;
      erros.push(`Linha ${n}: ${ref} tem ${c[iArea]} no arquivo, mas ${String(areas.get(key)).replace('.', ',')} m² aqui.`);
      return;
    }
    const status = SITUACAO_CV[c[iSit]];
    if (!status) { erros.push(`Linha ${n}: situação "${c[iSit]}" desconhecida (${ref}).`); return; }
    const venda = parseBRL(c[iValor]);
    if (venda === null) { erros.push(`Linha ${n}: valor inválido "${c[iValor]}" (${ref}).`); return; }
    linhas.push({ torre, unidade, key, status, venda, vaga: iGar >= 0 ? parseVaga(c[iGar]) : null, situacaoCv: c[iSit] });
  });

  if (total === 0) return { linhas: [], erros, recusado: 'O arquivo não tem nenhuma unidade.' };
  if (desconhecidas / total > 0.5)
    return { linhas: [], erros, recusado: 'Este arquivo não parece ser deste empreendimento: a maior parte das unidades não existe aqui ou tem outra área.' };
  if (!linhas.length) return { linhas: [], erros, recusado: 'Nenhuma linha do arquivo pôde ser lida. Veja os problemas abaixo.' };
  return { linhas, erros, recusado: null };
}
