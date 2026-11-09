import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePackage } from '../app/package.js';

const pkg = JSON.parse(readFileSync(new URL('../fantastique-prime-2/empreendimento.json', import.meta.url), 'utf8'));
const copia = () => structuredClone(pkg);

test('pacote real do Prime II é válido', () => {
  assert.deepEqual(validatePackage(pkg), []);
});

test('acusa torre faltando', () => {
  const p = copia(); p.implantacao.torres = p.implantacao.torres.filter(t => t.numero !== 3);
  assert.ok(validatePackage(p).length > 0);
});

test('acusa largura fora da faixa', () => {
  const p = copia(); p.implantacao.torres[0].largura = 80;
  assert.ok(validatePackage(p).some(e => /largura/.test(e)));
});

test('acusa torres sobrepostas', () => {
  const p = copia(); p.implantacao.torres[1].centro = [...p.implantacao.torres[0].centro];
  assert.ok(validatePackage(p).some(e => /sobrep/.test(e)));
});

test('acusa tipologia sem planta', () => {
  const p = copia(); delete p.tipologias['B-PNE'];
  assert.ok(validatePackage(p).some(e => /B-PNE/.test(e)));
});

test('acusa metrosPorPixel inválido', () => {
  const p = copia(); p.implantacao.metrosPorPixel = 0;
  assert.ok(validatePackage(p).some(e => /metrosPorPixel/.test(e)));
});
