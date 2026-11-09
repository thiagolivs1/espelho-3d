import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { toMeters } from '../app/scene/geometry.js';
import { distanciaPontoPolilinha } from '../app/scene/geo.js';

const ler = f => JSON.parse(readFileSync(new URL(`../fantastique-prime-2/${f}`, import.meta.url), 'utf8'));
const pkg = ler('empreendimento.json'), ent = ler('entorno.json');
const M = p => toMeters(pkg.implantacao, p);
const meio = (a, b) => { const [x1, z1] = M(a), [x2, z2] = M(b); return [(x1 + x2) / 2, (z1 + z2) / 2]; };
const maisPerto = (pt, nome) => Math.min(...ent.vias.filter(v => v.nome === nome).map(v => distanciaPontoPolilinha(pt, v.pts)));
const dentro = ([x, z], poli) => {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i], [xj, zj] = poli[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
};

test('borda nordeste do lote encosta na Avenida Francisco Sá (< 20 m)', () => {
  const d = maisPerto(meio([655, 72], [972, 155]), 'Avenida Francisco Sá');
  assert.ok(d < 20, `${d.toFixed(1)} m`);
});

test('borda sul do lote encosta na Rua Caririaçu (< 20 m)', () => {
  const d = maisPerto(meio([150, 660], [800, 772]), 'Rua Caririaçu');
  assert.ok(d < 20, `${d.toFixed(1)} m`);
});

test('nenhum prédio do entorno dentro do lote', () => {
  const lote = pkg.implantacao.lote.map(M);
  const centro = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  assert.equal(ent.predios.filter(p => dentro(centro(p.pts), lote)).length, 0);
});

test('pontos de referência em pelo menos 3 categorias, com distância', () => {
  assert.ok(new Set(ent.pontos.map(p => p.categoria)).size >= 3);
  assert.ok(ent.pontos.every(p => p.nome && p.distanciaM > 0));
  assert.match(ent.fonte, /OpenStreetMap/);
});
