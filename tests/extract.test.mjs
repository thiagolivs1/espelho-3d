import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractUnits, toUnitsJson, toSeedSql, toStatusSeedSql } from '../tools/extract-units.mjs';

// Fonte: o simulador original, que fica fora do repositório, na pasta do projeto.
const rows = extractUnits(readFileSync(new URL('../../FAntastique prime 2.html', import.meta.url), 'utf8'));

test('432 unidades, 3 torres, 18 níveis, 8 colunas', () => {
  assert.equal(rows.length, 432);
  assert.deepEqual([...new Set(rows.map(r => r.torre))].sort(), [1, 2, 3]);
  assert.equal(new Set(rows.map(r => r.andar)).size, 18);
  assert.equal(new Set(rows.map(r => r.coluna)).size, 8);
});

test('valores da tabela de 09/11/2026', () => {
  const u = rows.find(r => r.torre === 1 && r.unidade === 101);
  assert.deepEqual([u.area, u.venda, u.avaliacao], [59.93, 348382, 374487.24]);
  assert.equal(rows.filter(r => r.indisponivel).length, 105);
});

test('units.json nunca leva situação', () => {
  const j = toUnitsJson(rows);
  assert.equal(JSON.stringify(j).includes('indisponivel'), false);
  assert.equal(j.unidades.find(u => u.torre === 1 && u.unidade === 303).tipologia, 'B-PNE');
});

test('seed público (vai para o repositório) não leva situação de venda', () => {
  const sql = toSeedSql(rows, 'fantastique-prime-2');
  assert.equal(sql.includes('unit_status'), false);
  assert.equal(/'[DRVB]'\)/.test(sql), false);
  assert.equal((sql.match(/\('fantastique-prime-2', \d+, \d+, [\d.]+, [\d.]+\)/g) || []).length, 432);
});

test('seed de situação (fica fora do git) marca 105 vendidas e 327 disponíveis', () => {
  const sql = toStatusSeedSql(rows, 'fantastique-prime-2');
  assert.equal((sql.match(/'V'\)/g) || []).length, 105);
  assert.equal((sql.match(/'D'\)/g) || []).length, 327);
});

test('arquivos de situação ficam fora do git', () => {
  const gi = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.ok(gi.split('\n').includes('supabase/seed/*-status.sql'));
});
