import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deveMostrarAbertura } from '../app/ui/abertura.js';

test('abertura aparece na primeira visita da sessão', () => {
  assert.equal(deveMostrarAbertura('', false), true);
  assert.equal(deveMostrarAbertura('#', false), true);
});

test('abertura não volta depois de vista na mesma sessão', () => {
  assert.equal(deveMostrarAbertura('', true), false);
});

test('link de unidade vai direto para a maquete', () => {
  assert.equal(deveMostrarAbertura('#u-2-805', false), false);
});
