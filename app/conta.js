// Validações de conta (puro).
export function validarNovaSenha(a, b) {
  if (String(a || '').length < 8) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (a !== b) return 'As duas senhas não são iguais.';
  return null;
}

export function validarEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()) ? null : 'Digite um e-mail válido.';
}
