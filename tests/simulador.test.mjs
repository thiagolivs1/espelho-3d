import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../fantastique-prime-2/simulador/index.html', import.meta.url), 'utf8');

test('simulador não mostra situação de venda', () => {
  assert.equal(html.includes('Indisponível'), false);
  assert.equal(/\bde \$\{us\.length\} disponíveis/.test(html), false);
  assert.equal(html.includes('<dt>Situação</dt>'), false);
  assert.equal(html.includes('u[5]'), false);
});

test('simulador abre pela unidade do link e lê dados compartilhados', () => {
  assert.ok(html.includes('carregarUnidadesSimulador'));
  assert.ok(html.includes('parseUnitHash'));
  assert.equal(/const U = \[\[/.test(html), false);
});

test('simulador tem o import map para o Supabase', () => {
  assert.ok(html.includes('"@supabase/supabase-js": "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"'));
});

test('simulador mostra o aviso quando não confirma os preços no banco', () => {
  assert.ok(html.includes('U = r.linhas'));
  assert.ok(html.includes('if (r.aviso)'));
});
