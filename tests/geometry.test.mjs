import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pisoAltura, toMeters, towerTransform, unitBox } from '../app/scene/geometry.js';

const torre = { largura: 38, profundidade: 16, nucleo: 6 };

test('altura de piso 2,70 m', () => assert.equal(pisoAltura({ peDireito: 2.6, laje: 0.1 }), 2.7));

test('colunas 1–4 ao norte (z < 0), 5–8 ao sul (z > 0)', () => {
  for (const c of [1, 2, 3, 4]) assert.ok(unitBox(torre, c, 1, 2.7).z < 0);
  for (const c of [5, 6, 7, 8]) assert.ok(unitBox(torre, c, 1, 2.7).z > 0);
});

test('ordem oeste→leste: 4,3,2,1 e 5,6,7,8, com núcleo no meio', () => {
  const x = c => unitBox(torre, c, 1, 2.7).x;
  assert.ok(x(4) < x(3) && x(3) < x(2) && x(2) < x(1));
  assert.ok(x(5) < x(6) && x(6) < x(7) && x(7) < x(8));
  assert.ok(x(2) - x(3) > unitBox(torre, 1, 1, 2.7).w); // núcleo entre 3 e 2
});

test('17º andar no topo', () => {
  const b = unitBox(torre, 1, 17, 2.7);
  assert.ok(Math.abs(b.y + b.h / 2 - (17 * 2.7 + 2.7 - 0.12)) < 1e-9);
});

test('toMeters: centroide do lote é a origem', () => {
  const imp = { metrosPorPixel: 0.5, lote: [[0, 0], [100, 0], [100, 100], [0, 100]] };
  assert.deepEqual(toMeters(imp, [50, 50]), [0, 0]);
  assert.deepEqual(toMeters(imp, [60, 50]), [5, 0]);
});

test('towerTransform: giro medido na imagem vira rotação anti-horária vista de cima', () => {
  const imp = { metrosPorPixel: 1, lote: [[0, 0], [100, 0], [100, 100], [0, 100]] };
  const t = towerTransform(imp, { centro: [60, 40], giroGraus: -3.2 });
  assert.deepEqual([t.x, t.z], [10, -10]);
  assert.ok(Math.abs(t.rotY - 3.2 * Math.PI / 180) < 1e-12);
});
