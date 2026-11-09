import { test } from 'node:test';
import assert from 'node:assert/strict';
import { horaSolar, posicaoSol, direcaoSol, diaDoAno } from '../app/scene/sol.js';

test('hora solar em Fortaleza (−38,55°) adianta ~26 min', () => assert.ok(Math.abs(horaSolar(12, -38.55) - 12.43) < 0.01));

test('equinócio, meio-dia solar: sol quase a pino', () => {
  const p = posicaoSol({ horaSolar: 12, diaDoAno: 80, latitude: -3.72 });
  assert.ok(Math.abs(p.elevacao - 86.3) < 1.5, `elevação ${p.elevacao}`);
});

test('equinócio, 6h solar: nasce no leste', () => {
  const p = posicaoSol({ horaSolar: 6, diaDoAno: 80, latitude: -3.72 });
  assert.ok(Math.abs(p.elevacao) < 2 && Math.abs(p.azimute - 90) < 3, JSON.stringify(p));
});

test('equinócio, 18h solar: põe no oeste', () => {
  const p = posicaoSol({ horaSolar: 18, diaDoAno: 80, latitude: -3.72 });
  assert.ok(Math.abs(p.azimute - 270) < 3, JSON.stringify(p));
});

test('junho ao meio-dia o sol fica ao norte; dezembro, ao sul', () => {
  const jun = posicaoSol({ horaSolar: 12, diaDoAno: 172, latitude: -3.72 });
  const dez = posicaoSol({ horaSolar: 12, diaDoAno: 355, latitude: -3.72 });
  assert.ok(jun.azimute < 10 || jun.azimute > 350, `junho ${jun.azimute}`);
  assert.ok(Math.abs(dez.azimute - 180) < 10, `dezembro ${dez.azimute}`);
});

test('direção da luz na cena (x = leste, z = sul), com o giro da prancha', () => {
  const [x, y, z] = direcaoSol({ azimute: 90, elevacao: 0 }, 0);
  assert.ok(Math.abs(x - 1) < 1e-9 && Math.abs(y) < 1e-9 && Math.abs(z) < 1e-9);
  const [x2, , z2] = direcaoSol({ azimute: 0, elevacao: 0 }, 0);
  assert.ok(Math.abs(x2) < 1e-9 && Math.abs(z2 + 1) < 1e-9);       // norte = −z
  const [x3, , z3] = direcaoSol({ azimute: 0, elevacao: 0 }, 90);   // prancha girada 90°: norte real vira leste da cena
  assert.ok(Math.abs(x3 - 1) < 1e-9 && Math.abs(z3) < 1e-9);
});

test('dia do ano em Fortaleza', () => {
  assert.equal(diaDoAno(new Date('2026-01-01T12:00:00-03:00')), 1);
  assert.equal(diaDoAno(new Date('2026-11-09T23:30:00-03:00')), 313);
});
