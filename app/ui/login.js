// Caixa de login (e-mail e senha). Quem digita a senha é sempre a pessoa usuária.
import { signIn } from '../supabase.js';

export function mountLogin({ titulo = 'Entrar', texto = '' } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg-login';
  dlg.innerHTML = `
    <form method="dialog" class="login">
      <h2>${titulo}</h2>
      ${texto ? `<p class="mute">${texto}</p>` : ''}
      <label>E-mail<input name="email" type="email" autocomplete="username" required></label>
      <label>Senha<input name="senha" type="password" autocomplete="current-password" required></label>
      <p class="erro" role="alert" hidden></p>
      <div class="row">
        <button type="button" class="btn ghost" data-fechar>Cancelar</button>
        <button type="submit" class="btn">Entrar</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form'), erro = dlg.querySelector('.erro'), enviar = form.querySelector('[type=submit]');
  dlg.querySelector('[data-fechar]').onclick = () => dlg.close();
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    erro.hidden = true; enviar.disabled = true; enviar.textContent = 'Entrando…';
    const r = await signIn(form.email.value, form.senha.value);
    enviar.disabled = false; enviar.textContent = 'Entrar';
    if (r.ok) { form.senha.value = ''; dlg.close(); } else { erro.textContent = r.erro; erro.hidden = false; }
  });
  return { abrir: () => { erro.hidden = true; dlg.showModal(); form.email.focus(); } };
}
