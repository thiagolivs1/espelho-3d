import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { validatePackage } from '../app/package.js';
import { precisaRecorte } from '../app/ui/logo.js';

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

test('pontos de lazer e perspectivas presentes no pacote real', () => {
  assert.ok(Array.isArray(pkg.pontosLazer) && pkg.pontosLazer.length >= 7);
  for (const t of Object.values(pkg.tipologias)) assert.ok(t.perspectivas && t.perspectivas.length > 0);
});

test('acusa ponto de lazer sem imagem', () => {
  const p = copia(); p.pontosLazer[0].imagens = [];
  assert.ok(validatePackage(p).some(e => /lazer/.test(e)));
});

test('acusa tipologia sem perspectiva', () => {
  const p = copia(); delete p.tipologias.A.perspectivas;
  assert.ok(validatePackage(p).some(e => /perspectiva/.test(e)));
});

test('todas as imagens do pacote existem e têm menos de 350 KB (abertura: 600 KB)', () => {
  const caminhos = [...pkg.pontosLazer.flatMap(p => p.imagens.map(f => f.src)), ...Object.values(pkg.tipologias).flatMap(t => t.perspectivas.map(f => f.src)),
    ...pkg.galeria.map(f => f.src)];
  for (const c of new Set(caminhos)) {
    const tam = statSync(new URL(`../fantastique-prime-2/${c}`, import.meta.url)).size;
    assert.ok(tam < 350 * 1024, `${c}: ${tam} bytes`);
  }
  assert.ok(statSync(new URL(`../fantastique-prime-2/${pkg.abertura}`, import.meta.url)).size < 600 * 1024);
});

test('fotos aprovadas: cada perspectiva tem legenda, galeria do condomínio e novos pontos de lazer', () => {
  for (const t of Object.values(pkg.tipologias)) for (const f of t.perspectivas) assert.ok(f.src && f.legenda, JSON.stringify(f));
  assert.ok(pkg.galeria.length >= 12 && pkg.galeria.every(f => f.src && f.legenda));
  const nomes = pkg.pontosLazer.map(p => p.nome);
  for (const n of ['Piscina', 'Campinho', 'Playground', 'Portaria']) assert.ok(nomes.includes(n), n);
});

test('cada foto de lazer tem legenda própria (pet place não sai como playground)', () => {
  for (const p of pkg.pontosLazer) for (const f of p.imagens) assert.ok(f.src && f.legenda, `${p.nome}: ${JSON.stringify(f)}`);
  assert.ok(pkg.pontosLazer.find(p => p.nome === 'Playground').imagens.some(f => f.legenda === 'Pet place'));
  const p = copia(); p.pontosLazer[0].imagens = [{ legenda: 'sem arquivo' }];
  assert.ok(validatePackage(p).some(e => /lazer/.test(e)));
});

test('recorte do logo só quando o pacote avisa que o fundo é escuro', () => {
  assert.equal(precisaRecorte({ fundoEscuro: true }), true);
  assert.equal(precisaRecorte({}), false);
  assert.equal(pkg.logos.fundoEscuro, true);
});

test('tema escuro tira as cores da marca do pacote, sem cor fixa do Prime II', () => {
  const css = readFileSync(new URL('../app/ui/tema-noite.css', import.meta.url), 'utf8');
  assert.match(css, /--cobre:\s*var\(--marca\b/);
  assert.match(css, /--noite:\s*var\(--escuro\b/);
  assert.doesNotMatch(css, /--marca:\s*var\(--cobre/);
  assert.equal(pkg.cores.marca, '#E08A52');
});

test('planta principal é a renderizada; a técnica fica como segunda imagem e não repete nas perspectivas', () => {
  for (const [c, t] of Object.entries(pkg.tipologias)) {
    assert.match(t.planta, /^img\/aptos\/.+-apartamento\.jpg$/, c);
    assert.match(t.plantaTecnica, /^img\/plantas\//, c);
    assert.ok(!t.perspectivas.some(f => f.src === t.planta), `${c}: planta repetida nas perspectivas`);
    statSync(new URL(`../fantastique-prime-2/${t.plantaTecnica}`, import.meta.url));
  }
});

test('acusa perspectiva sem arquivo', () => {
  const p = copia(); p.tipologias.A.perspectivas = [{ legenda: 'Sala' }];
  assert.ok(validatePackage(p).some(e => /perspectiva/.test(e)));
});
