import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Navegadores embutidos (o painel do app, o navegador interno do WhatsApp/Instagram) bloqueiam
// confirm/alert/prompt: confirm() devolve false sem mostrar nada. A página usa caixas próprias.
for (const arquivo of ['../app/gerente.js', '../app/page.js', '../app/ui/login.js']) {
  test(`${arquivo.split('/').pop()} não usa confirm/alert/prompt nativos`, () => {
    const src = readFileSync(new URL(arquivo, import.meta.url), 'utf8');
    assert.equal(/\b(?:window\.)?(?:confirm|alert|prompt)\s*\(/.test(src), false);
  });
}
