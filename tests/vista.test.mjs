import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { orientacao, textoSol, noCampoDeVisao, cone, pontosDasTorres } from '../app/scene/vista.js';
import { towerTransform } from '../app/scene/geometry.js';

const pkg = JSON.parse(readFileSync(new URL('../fantastique-prime-2/empreendimento.json', import.meta.url), 'utf8'));
const centro = n => { const t = towerTransform(pkg.implantacao, pkg.implantacao.torres.find(x => x.numero === n)); return { nome: `Torre ${n}`, x: t.x, z: t.z }; };

test('orientação da fachada (x = leste, z = sul), com giro da prancha', () => {
  assert.equal(orientacao([0, -1]), 'norte');
  assert.equal(orientacao([0, 1]), 'sul');
  assert.equal(orientacao([1, 0]), 'leste');
  assert.equal(orientacao([-1, 0]), 'oeste');
  assert.equal(orientacao([0.3, -1]), 'norte');
  assert.equal(orientacao([0, -1], 90), 'oeste');   // norte da prancha a 90° do norte real
});

test('texto do sol por fachada em Fortaleza', () => {
  assert.match(textoSol('norte', -3.72), /março a outubro/);
  assert.match(textoSol('sul', -3.72), /outubro a março/);
  assert.match(textoSol('leste', -3.72), /manhã/);
  assert.match(textoSol('oeste', -3.72), /tarde/);
});

test('da fachada norte da Torre 2 vê-se a Torre 1, não a Torre 3', () => {
  const t2 = centro(2), pontos = [centro(1), centro(3)];
  const vistos = noCampoDeVisao([t2.x, t2.z - 9], [0, -1], pontos);
  assert.ok(vistos.includes('Torre 1'));
  assert.ok(!vistos.includes('Torre 3'));
});

test('pontos atrás da câmera ficam fora; ordem por distância', () => {
  const pts = [{ nome: 'longe', x: 0, z: -300 }, { nome: 'perto', x: 5, z: -40 }, { nome: 'atrás', x: 0, z: 50 }];
  assert.deepEqual(noCampoDeVisao([0, 0], [0, -1], pts), ['perto', 'longe']);
});

test('cone do minimapa: vértice na posição e abertura simétrica', () => {
  const [p, a, b] = cone([10, 20], [0, -1], 50, 50);
  assert.deepEqual(p, [10, 20]);
  assert.ok(Math.abs(a[1] - b[1]) < 1e-9 && Math.abs((a[0] - 10) + (b[0] - 10)) < 1e-9);
  assert.ok(a[1] < 20 && b[1] < 20);
});

test('coluna da ponta também vê a torre vizinha (cantos contam, não só o centro)', () => {
  // Torre 2, coluna 4 (ponta oeste, fachada norte): a Torre 1 ocupa metade da vista, mas o centro dela está a ~45°.
  const t2 = pkg.implantacao.torres.find(x => x.numero === 2);
  const { x, z } = towerTransform(pkg.implantacao, t2);
  const pontos = pontosDasTorres(pkg.implantacao).filter(p => p.numero !== 2);
  const vistos = noCampoDeVisao([x - 14, z - 9], [0, -1], pontos);
  assert.ok(vistos.includes('Torre 1'), JSON.stringify(vistos));
  assert.equal(vistos.filter(n => n === 'Torre 1').length, 1);
});
