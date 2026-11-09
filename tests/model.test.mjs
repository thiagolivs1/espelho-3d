import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeUnits, summarize, filterUnits, isStale, diffChanges, toSimuladorRows, precisaRecarregar, precoSuspeito, avisoPrecos } from '../app/model.js';
import { corDaUnidade, CORES_SITUACAO } from '../app/scene/cores.js';

const us = [
  { torre: 1, unidade: 101, andar: 1, coluna: 1, area: 59.93, venda: 348382, avaliacao: 374487.24, tipologia: 'A', quartos: 3 },
  { torre: 1, unidade: 102, andar: 1, coluna: 2, area: 51.66, venda: 294532, avaliacao: 344407.94, tipologia: 'B-PNE', quartos: 2 },
  { torre: 2, unidade: 1, andar: 0, coluna: 1, area: 68.4, venda: 360000, avaliacao: 389000, tipologia: 'A1 Garden', quartos: 3 },
];

test('sem banco: preço do arquivo e situação desconhecida', () => {
  const v = mergeUnits(us, null, null);
  assert.ok(v.every(u => u.status === null && u.precoFonte === 'arquivo'));
  assert.equal(v[0].key, 'u-1-101');
});

test('mapa de situações vazio (acesso desativado) vira desconhecido, nunca disponível', () => {
  assert.ok(mergeUnits(us, null, new Map()).every(u => u.status === null));
});

test('preço do banco vence o do arquivo', () => {
  const v = mergeUnits(us, new Map([['u-1-101', { venda: 350000, avaliacao: 374487.24 }]]), null);
  assert.equal(v.find(u => u.key === 'u-1-101').venda, 350000);
  assert.equal(v.find(u => u.key === 'u-1-101').precoFonte, 'banco');
  assert.equal(v.find(u => u.key === 'u-1-102').precoFonte, 'arquivo');
});

test('resumo público não revela disponibilidade', () => {
  const v = mergeUnits(us, null, new Map([['u-1-101', 'V'], ['u-1-102', 'D'], ['u-2-1', 'D']]));
  assert.deepEqual(summarize(v, false), { total: 3, disponiveis: null, pctVendido: null, aPartirDe: 294532 });
  const s = summarize(v, true);
  assert.equal(s.disponiveis, 2); assert.equal(s.aPartirDe, 294532);
  assert.ok(Math.abs(s.pctVendido - 1 / 3) < 1e-9);
});

test('resumo logado com situação desconhecida não chuta disponibilidade', () => {
  const s = summarize(mergeUnits(us, null, null), true);
  assert.equal(s.disponiveis, null); assert.equal(s.pctVendido, null); assert.equal(s.aPartirDe, 294532);
});

test('filtro de tipologia e só disponíveis', () => {
  const v = mergeUnits(us, null, new Map([['u-1-101', 'V'], ['u-1-102', 'D'], ['u-2-1', 'D']]));
  assert.deepEqual(filterUnits(v, { tipologia: '3q', soDisponiveis: true }).map(u => u.key), ['u-2-1']);
  assert.deepEqual(filterUnits(v, { tipologia: '2q', soDisponiveis: false }).map(u => u.key), ['u-1-102']);
  assert.deepEqual(filterUnits(v, { tipologia: 'garden', soDisponiveis: false }).map(u => u.key), ['u-2-1']);
  assert.equal(filterUnits(v, { tipologia: 'all', soDisponiveis: false }).length, 3);
});

test('desatualização por dia útil (America/Fortaleza)', () => {
  const d = s => new Date(s);
  assert.equal(isStale(d('2026-11-13T18:00:00-03:00'), d('2026-11-16T09:00:00-03:00')), false); // sex → seg
  assert.equal(isStale(d('2026-11-12T18:00:00-03:00'), d('2026-11-16T09:00:00-03:00')), true);  // qui → seg
  assert.equal(isStale(d('2026-11-10T08:00:00-03:00'), d('2026-11-11T20:00:00-03:00')), false); // ter → qua
  assert.equal(isStale(d('2026-11-09T23:00:00-03:00'), d('2026-11-11T08:00:00-03:00')), true);  // seg → qua
});

test('diffChanges envia só o que mudou', () => {
  const o = new Map([['u-1-101', { status: 'D', venda: 348382 }], ['u-1-102', { status: 'D', venda: 294532 }]]);
  const e = new Map([['u-1-101', { status: 'R', venda: 348382 }], ['u-1-102', { status: 'D', venda: 294532 }]]);
  assert.deepEqual(diffChanges(o, e), [{ torre: 1, unidade: 101, status: 'R' }]);
  const e2 = new Map([['u-1-101', { status: 'D', venda: 348382 }], ['u-1-102', { status: 'D', venda: 300000 }]]);
  assert.deepEqual(diffChanges(o, e2), [{ torre: 1, unidade: 102, venda: 300000 }]);
});

test('linhas do simulador sempre disponíveis', () => {
  const rows = toSimuladorRows(mergeUnits(us, null, null));
  assert.ok(rows.every(r => r.length === 6 && r[5] === 0));
  assert.deepEqual(rows[0], [1, 101, 59.93, 348382, 374487.24, 0]);
  assert.deepEqual(rows.map(r => `${r[0]}-${r[1]}`), ['1-101', '1-102', '2-1']);
});

test('gerente só recarrega a grade quando o usuário muda (não perde edições ao voltar para a aba)', () => {
  assert.equal(precisaRecarregar('u1', 'u1'), false);
  assert.equal(precisaRecarregar('u1', 'u2'), true);
  assert.equal(precisaRecarregar('u1', null), true);
  assert.equal(precisaRecarregar(null, 'u1'), true);
});

test('preço suspeito: variação acima de 50% em relação ao atual', () => {
  assert.equal(precoSuspeito(348382, 360), true);
  assert.equal(precoSuspeito(348382, 360000), false);
  assert.equal(precoSuspeito(348382, 600000), true);
  assert.equal(precoSuspeito(null, 360000), false);
});

test('aviso de preços quando o banco falha (página e simulador usam o mesmo texto)', () => {
  assert.equal(avisoPrecos(null), 'Preços da tabela publicada; não foi possível confirmar atualizações.');
  assert.equal(avisoPrecos(new Map()), null);
});

test('filtro visível na maquete: unidade fora do filtro fica translúcida e bem diferente', () => {
  const cores = { fachada: { base: '#EEE9E1', faixa: '#D5C7B2', detalhe: '#B5A68A' } };
  const u = { key: 'u-1-101', coluna: 1, status: 'D' };
  const dentro = corDaUnidade(u, 'tabela', new Set(['u-1-101']), cores);
  const fora = corDaUnidade(u, 'tabela', new Set(['u-9-9']), cores);
  assert.equal(dentro.opacidade, 1);
  assert.ok(fora.opacidade <= 0.3);
  assert.notEqual(fora.cor, dentro.cor);
  assert.equal(corDaUnidade(u, 'disponibilidade', null, cores).cor, CORES_SITUACAO.D);
  assert.equal(corDaUnidade({ ...u, status: null }, 'disponibilidade', null, cores).cor, '#BDB8AE');
});
