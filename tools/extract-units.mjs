// Extrai as unidades e preços embutidos no simulador de fluxo (linha `const U = [[...]];`).
// Uso: node tools/extract-units.mjs "<simulador.html>" <saida-units.json> <saida-seed.sql> <slug>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { floorOf, columnOf, tipologiaFor, unitKey } from '../app/units.js';
import { parseCvCsv } from '../app/cv.js';

export function extractUnits(html) {
  const m = /const U = (\[\[.*?\]\]);/.exec(html);
  if (!m) throw new Error('Tabela "const U = [[...]];" não encontrada no simulador');
  // Colunas no simulador: torre, unidade, área, venda, avaliação, indisponível
  return JSON.parse(m[1]).map(([torre, unidade, area, venda, avaliacao, indisp]) => ({
    torre, unidade, andar: floorOf(unidade), coluna: columnOf(unidade),
    area, venda, avaliacao, indisponivel: indisp === 1,
  }));
}

// vagas: Map<unitKey, {numero, nivel}> lido do mapa do CV (opcional). Vaga não é disponibilidade.
export function toUnitsJson(rows, vagas = new Map()) {
  return {
    fonte: 'Tabela 60X Lançamento Prime II · 09/11/2026',
    unidades: rows.map(({ torre, unidade, andar, coluna, area, venda, avaliacao }) => {
      const { codigo, quartos } = tipologiaFor(torre, unidade);
      const vaga = vagas.get(unitKey(torre, unidade)) || null;
      return { torre, unidade, andar, coluna, area, venda, avaliacao, tipologia: codigo, quartos, vaga };
    }),
  };
}

const literal = slug => `'${slug.replace(/'/g, "''")}'`;

// Preços: públicos, podem ir para o repositório.
export function toSeedSql(rows, slug) {
  const s = literal(slug);
  const precos = rows.map(r => `(${s}, ${r.torre}, ${r.unidade}, ${r.venda}, ${r.avaliacao})`);
  return [
    '-- Gerado por tools/extract-units.mjs. Só preços (públicos). A situação inicial fica em *-status.sql, fora do git.',
    `insert into unit_prices (empreendimento, torre, unidade, venda, avaliacao) values\n${precos.join(',\n')}\non conflict (empreendimento, torre, unidade) do nothing;`,
    '',
  ].join('\n\n');
}

// Situação inicial: NUNCA vai para o repositório publicado (supabase/seed/*-status.sql está no .gitignore).
export function toStatusSeedSql(rows, slug) {
  const s = literal(slug);
  const situacoes = rows.map(r => `(${s}, ${r.torre}, ${r.unidade}, '${r.indisponivel ? 'V' : 'D'}')`);
  return [
    "-- Gerado por tools/extract-units.mjs. Situação inicial: indisponível na tabela de origem = 'V'. Não versionar.",
    `insert into unit_status (empreendimento, torre, unidade, status) values\n${situacoes.join(',\n')}\non conflict (empreendimento, torre, unidade) do nothing;`,
    '',
  ].join('\n\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [html, outJson, outSql, slug, cvCsv] = process.argv.slice(2);
  if (!slug) { console.error('uso: node tools/extract-units.mjs <simulador.html> <units.json> <seed.sql> <slug> [mapa-do-cv.csv]'); process.exit(2); }
  const rows = extractUnits(readFileSync(html, 'utf8'));
  let vagas = new Map();
  if (cvCsv) {
    const r = parseCvCsv(readFileSync(cvCsv, 'utf8'), new Map(rows.map(x => [unitKey(x.torre, x.unidade), x.area])));
    if (r.recusado) { console.error(r.recusado); process.exit(1); }
    vagas = new Map(r.linhas.filter(l => l.vaga).map(l => [l.key, l.vaga]));
    console.log(`${vagas.size} vagas lidas de ${cvCsv}${r.erros.length ? ` (${r.erros.length} linhas com problema)` : ''}`);
  }
  const outStatus = outSql.replace(/\.sql$/, '-status.sql');
  for (const f of [outJson, outSql]) mkdirSync(dirname(f), { recursive: true });
  writeFileSync(outJson, JSON.stringify(toUnitsJson(rows, vagas), null, 1) + '\n');
  writeFileSync(outSql, toSeedSql(rows, slug));
  writeFileSync(outStatus, toStatusSeedSql(rows, slug));
  console.log(`${rows.length} unidades → ${outJson}, ${outSql}, ${outStatus} (este último fora do git)`);
}
