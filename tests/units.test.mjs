import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS, floorOf, columnOf, unitLabel, unitKey, parseUnitHash, findUnit,
  tipologiaFor, formatBRL, formatShortBRL, formatArea, parseBRL,
} from '../app/units.js';

test('códigos de situação', () => {
  assert.deepEqual(STATUS, { D: 'Disponível', R: 'Reservada', V: 'Vendida', B: 'Bloqueada' });
});

test('andar, coluna e rótulo', () => {
  assert.equal(floorOf(1708), 17); assert.equal(columnOf(1708), 8);
  assert.equal(floorOf(3), 0); assert.equal(unitLabel(3), '003'); assert.equal(unitLabel(101), '101');
});

test('hash de unidade', () => {
  assert.deepEqual(parseUnitHash('#u-1-101'), { torre: 1, unidade: 101 });
  assert.deepEqual(parseUnitHash('u-3-5'), { torre: 3, unidade: 5 });
  for (const h of ['', '#', '#u-1-abc', '#x-1-101', '#u-1-12345']) assert.equal(parseUnitHash(h), null);
  assert.equal(unitKey(2, 1708), 'u-2-1708');
});

test('findUnit ignora unidade inexistente', () => {
  const us = [{ torre: 1, unidade: 101 }];
  assert.equal(findUnit(us, { torre: 4, unidade: 101 }), null);
  assert.equal(findUnit(us, { torre: 1, unidade: 1801 }), null);
  assert.equal(findUnit(us, { torre: 1, unidade: 9 }), null);
  assert.equal(findUnit(us, null), null);
  assert.equal(findUnit(us, { torre: 1, unidade: 101 }), us[0]);
});

test('tipologia por torre, andar e coluna', () => {
  assert.deepEqual(tipologiaFor(1, 1), { codigo: 'A1 Garden', quartos: 3, garden: true, pne: false });
  assert.deepEqual(tipologiaFor(1, 2), { codigo: 'B-PNE Garden', quartos: 2, garden: true, pne: true });
  assert.deepEqual(tipologiaFor(2, 2), { codigo: 'B Garden', quartos: 2, garden: true, pne: false });
  assert.deepEqual(tipologiaFor(1, 303), { codigo: 'B-PNE', quartos: 2, garden: false, pne: true });
  assert.deepEqual(tipologiaFor(1, 402), { codigo: 'B', quartos: 2, garden: false, pne: false });
  assert.deepEqual(tipologiaFor(3, 1705), { codigo: 'A', quartos: 3, garden: false, pne: false });
});

test('formatos', () => {
  assert.equal(formatBRL(348382), 'R$ 348.382');
  assert.equal(formatShortBRL(348382), 'R$ 348 mil');
  assert.equal(formatShortBRL(1020000), 'R$ 1,02 mi');
  assert.equal(formatArea(59.93), '59,93 m²');
});

test('parseBRL aceita formato brasileiro e recusa inválidos', () => {
  assert.equal(parseBRL('360.000,00'), 360000);
  assert.equal(parseBRL('R$ 1.234,5'), 1234.5);
  assert.equal(parseBRL('360000'), 360000);
  for (const t of ['', '0', '-10', 'abc', '   ']) assert.equal(parseBRL(t), null);
});
