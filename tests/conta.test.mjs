import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarNovaSenha, validarEmail } from '../app/conta.js';

test('nova senha: mínimo de 8 caracteres e as duas iguais', () => {
  assert.equal(validarNovaSenha('1234567', '1234567'), 'A senha precisa ter pelo menos 8 caracteres.');
  assert.equal(validarNovaSenha('12345678', '12345679'), 'As duas senhas não são iguais.');
  assert.equal(validarNovaSenha('12345678', '12345678'), null);
});

test('e-mail do novo corretor', () => {
  assert.equal(validarEmail('corretor@exemplo.com.br'), null);
  assert.equal(validarEmail(' corretor@exemplo.com '), null);
  for (const e of ['', 'corretor', 'corretor@', '@exemplo.com', 'a b@c.com']) assert.equal(validarEmail(e), 'Digite um e-mail válido.');
});
