import { test } from 'node:test';
import assert from 'node:assert/strict';
import { varianteFachada } from '../app/scene/geometry.js';

const V = (coluna, andar) => varianteFachada({ coluna, andar, pavimentos: 18 });

test('frente e lado exposto: pontas da torre mostram a lateral', () => {
  assert.deepEqual([V(5, 3).frente, V(5, 3).ladoExposto], ['sul', 'oeste']);
  assert.deepEqual([V(8, 3).frente, V(8, 3).ladoExposto], ['sul', 'leste']);
  assert.deepEqual([V(4, 3).frente, V(4, 3).ladoExposto], ['norte', 'oeste']);
  assert.equal(V(2, 3).ladoExposto, null);
  assert.equal(V(6, 3).ladoExposto, null);
});

test('varanda sempre do lado do núcleo, olhando de fora', () => {
  // Desenho padrão: varanda à direita de quem olha. Sul olha para o norte: direita = leste.
  assert.equal(V(5, 3).espelhar, false);   // oeste do núcleo, varanda a leste
  assert.equal(V(6, 3).espelhar, false);
  assert.equal(V(7, 3).espelhar, true);    // leste do núcleo, varanda a oeste = esquerda
  assert.equal(V(8, 3).espelhar, true);
  // Norte olha para o sul: direita = oeste.
  assert.equal(V(4, 3).espelhar, true);    // oeste do núcleo, varanda a leste = esquerda
  assert.equal(V(3, 3).espelhar, true);
  assert.equal(V(2, 3).espelhar, false);
  assert.equal(V(1, 3).espelhar, false);
});

test('coroa clara nos últimos pavimentos, mais alta junto ao núcleo', () => {
  assert.equal(V(5, 13).coroa, false);
  assert.equal(V(5, 14).coroa, true);
  assert.equal(V(6, 11).coroa, false);
  assert.equal(V(6, 12).coroa, true);
  assert.equal(V(1, 17).coroa, true);
});

test('faixa marrom na base da coroa e seis pavimentos abaixo', () => {
  assert.equal(V(5, 14).faixa, true);
  assert.equal(V(5, 8).faixa, true);
  assert.equal(V(5, 9).faixa, false);
  assert.equal(V(6, 12).faixa, true);
  assert.equal(V(6, 6).faixa, true);
});

test('placas marrons alternam de lado a cada pavimento', () => {
  assert.notEqual(V(5, 3).painel, V(5, 4).painel);
  assert.ok([0, 1].includes(V(5, 3).painel));
});
