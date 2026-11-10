import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pontosNoPerimetro, pontosDentro, foraDe, dentro, corDoPredio } from '../app/scene/paisagem.js';

const quadrado = [[0, 0], [100, 0], [100, 100], [0, 100]];
const distBorda = ([x, z]) => Math.min(x, z, 100 - x, 100 - z);

test('pontos ao longo do perímetro, recuados para dentro (nos dois sentidos de desenho)', () => {
  for (const poli of [quadrado, [...quadrado].reverse()]) {
    const p = pontosNoPerimetro(poli, 10, 2);
    assert.ok(p.length >= 36 && p.length <= 44, `${p.length}`);
    assert.ok(p.every(q => dentro(q, poli)));
    assert.ok(p.every(q => Math.abs(distBorda(q) - 2) < 0.01 || distBorda(q) < 2.01));
  }
});

test('pontos dentro do polígono, sempre os mesmos para a mesma semente', () => {
  const a = pontosDentro(quadrado, 30, 7), b = pontosDentro(quadrado, 30, 7), c = pontosDentro(quadrado, 30, 8);
  assert.equal(a.length, 30);
  assert.ok(a.every(q => dentro(q, quadrado)));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('pontos dentro de um polígono sem área não travam', () => {
  assert.deepEqual(pontosDentro([[0, 0], [10, 0], [20, 0]], 5, 1), []);
});

test('tira pontos que caem dentro de obstáculos (torres, piscina, salões)', () => {
  const obst = [[[40, 40], [60, 40], [60, 60], [40, 60]]];
  assert.deepEqual(foraDe([[50, 50], [10, 10], [45, 59]], obst), [[10, 10]]);
});

test('casas baixas com telhado cerâmico; prédios com laje clara', () => {
  const casa = corDoPredio(6, 3), predio = corDoPredio(30, 3);
  assert.match(casa.telhado, /^#/);
  assert.notEqual(casa.telhado, predio.telhado);
  assert.equal(corDoPredio(6, 3).parede, corDoPredio(6, 3).parede);   // estável
  const paredes = new Set(Array.from({ length: 20 }, (_, i) => corDoPredio(6, i).parede));
  assert.ok(paredes.size >= 3, 'variação de cor entre as casas');
});
