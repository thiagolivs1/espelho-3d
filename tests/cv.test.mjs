import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseVaga, parseCvCsv, SITUACAO_CV } from '../app/cv.js';

const amostra = readFileSync(new URL('./fixtures/cv-amostra.csv', import.meta.url), 'utf8');
// unidade → área privativa (m²), como no pacote: o importador confere a área para não aceitar arquivo de outro empreendimento.
const areas = new Map([['u-1-1', 68.4], ['u-1-2', 76.51], ['u-1-101', 59.93], ['u-1-102', 51.66], ['u-2-305', 59.93], ['u-3-1708', 59.93], ['u-2-1', 68.4]]);

test('mapa de situações do CV', () => {
  assert.deepEqual(SITUACAO_CV, { 'Disponível': 'D', 'Vendida': 'V', 'Reservada': 'R', 'Em processo': 'R', 'Bloqueada': 'B' });
});

test('vaga', () => {
  assert.deepEqual(parseVaga('80 (Sobressolo)'), { numero: 80, nivel: 'Sobressolo' });
  assert.deepEqual(parseVaga('62 (Terreo)'), { numero: 62, nivel: 'Térreo' });
  assert.deepEqual(parseVaga('12(Sobressolo)'), { numero: 12, nivel: 'Sobressolo' });
  assert.equal(parseVaga('-'), null);
  assert.equal(parseVaga(''), null);
});

test('amostra: situações mapeadas, erros por linha', () => {
  const r = parseCvCsv(amostra, areas);
  assert.equal(r.recusado, null);
  assert.equal(r.linhas.length, 6);
  assert.equal(r.linhas.find(l => l.situacaoCv === 'Em processo').status, 'R');
  assert.equal(r.linhas.find(l => l.key === 'u-2-305').status, 'B');
  assert.ok(r.erros.some(e => /TORRE 4/.test(e)) && r.erros.some(e => /Distratada/.test(e)));
  assert.equal(r.erros.length, 2);
  const u = r.linhas.find(l => l.key === 'u-1-101');
  assert.deepEqual([u.torre, u.unidade, u.venda, u.status], [1, 101, 348382, 'R']);
  assert.deepEqual(u.vaga, { numero: 12, nivel: 'Sobressolo' });
});

test('BOM, colunas em outra ordem e quebra de linha do Windows', () => {
  const [cab, ...linhas] = amostra.trim().split('\n');
  const cols = cab.split(';'), ordem = [8, 1, 7, 2, 0, 3, 4, 5, 6];
  const reordena = l => { const c = l.split(';'); return ordem.map(i => c[i]).join(';'); };
  const csv = '﻿' + [reordena(cab), ...linhas.map(reordena)].join('\r\n');
  assert.equal(cols.length, 9);
  const a = parseCvCsv(amostra, areas), b = parseCvCsv(csv, areas);
  assert.deepEqual(b.linhas, a.linhas);
  assert.equal(b.erros.length, a.erros.length);
});

test('acentuação quebrada é recusada', () => {
  assert.match(parseCvCsv('"Bloco";"Unidade";"SituaÃ§Ã£o";"Valor"\n', areas).recusado, /UTF-8/);
});

test('arquivo sem as colunas do CV é recusado', () => {
  assert.match(parseCvCsv('"a";"b"\n"1";"2"\n', areas).recusado, /colunas/);
});

test('arquivo de outro empreendimento é recusado', () => {
  const csv = '"Bloco";"Unidade";"Situação";"Valor";"Garagem"\n' +
    Array.from({ length: 6 }, (_, i) => `"TORRE 9";"${i + 1}";"Vendida";"R$ 1,00";"-"`).join('\n');
  const r = parseCvCsv(csv, areas);
  assert.match(r.recusado, /não parece ser/);
  assert.equal(r.linhas.length, 0);
});

test('valor inválido vira erro da linha', () => {
  const csv = '"Bloco";"Unidade";"Situação";"Valor"\n"TORRE 1";"101";"Vendida";"abc"\n"TORRE 1";"102";"Vendida";"R$ 294.532,00"\n';
  const r = parseCvCsv(csv, areas);
  assert.equal(r.linhas.length, 1);
  assert.match(r.erros[0], /Linha 2.*valor/i);
});

test('arquivo salvo em Windows-1252 (Excel) pede UTF-8', () => {
  const bytes = Buffer.from('"Bloco";"Unidade";"Situa\xe7\xe3o";"Valor"\n"TORRE 1";"101";"Vendida";"R$ 1,00"\n', 'latin1');
  const texto = new TextDecoder('utf-8').decode(bytes);   // é o que File.text() faz
  assert.match(parseCvCsv(texto, areas).recusado, /UTF-8/);
});

test('arquivo só com cabeçalho, ou em que nenhuma linha pôde ser lida, é recusado (não diz "já está igual")', () => {
  assert.match(parseCvCsv('"Bloco";"Unidade";"Situação";"Valor"\n', areas).recusado, /nenhuma unidade/i);
  const r = parseCvCsv('"Bloco";"Unidade";"Situação";"Valor"\n"TORRE 1";"101";"Distratada";"R$ 1,00"\n', areas);
  assert.match(r.recusado, /nenhuma linha/i);
  assert.equal(r.erros.length, 1);
});

test('arquivo de empreendimento irmão (mesma numeração, áreas diferentes) é recusado', () => {
  const csv = '"Bloco";"Unidade";"Área";"Situação";"Valor"\n' +
    ['"TORRE 1";"101";"62,10 m²"', '"TORRE 1";"102";"55,00 m²"', '"TORRE 2";"305";"62,10 m²"'].map(l => `${l};"Vendida";"R$ 1,00"`).join('\n');
  assert.match(parseCvCsv(csv, areas).recusado, /não parece ser/);
});
