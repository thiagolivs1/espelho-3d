import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latLonParaLocal, distanciaPontoPolilinha } from '../app/scene/geo.js';

const origem = { lat: -3.72, lon: -38.55, rotacaoGraus: 0 };
const perto = (a, b, tol = 0.2) => Math.abs(a - b) < tol;

test('a origem vira [0, 0]', () => {
  const [x, z] = latLonParaLocal({ lat: -3.72, lon: -38.55 }, origem);
  assert.ok(perto(x, 0) && perto(z, 0));
});

test('0,001° ao norte ≈ 110,6 m para −z; 0,001° a leste ≈ 111,1 m para +x', () => {
  const [x, z] = latLonParaLocal({ lat: -3.719, lon: -38.55 }, origem);
  assert.ok(perto(x, 0) && perto(z, -110.6, 0.5));
  const [x2, z2] = latLonParaLocal({ lat: -3.72, lon: -38.549 }, origem);
  assert.ok(perto(x2, 111.1, 0.5) && perto(z2, 0));
});

test('rotação de 90° leva o norte real para o leste da prancha', () => {
  const [x, z] = latLonParaLocal({ lat: -3.719, lon: -38.55 }, { ...origem, rotacaoGraus: 90 });
  assert.ok(perto(x, 110.6, 0.5) && perto(z, 0));
});

test('distância de ponto a polilinha', () => {
  assert.equal(distanciaPontoPolilinha([5, 3], [[0, 0], [10, 0]]), 3);
  assert.equal(distanciaPontoPolilinha([13, 4], [[0, 0], [10, 0]]), 5);
  assert.equal(distanciaPontoPolilinha([0, 7], [[0, 0]]), 7);
});
