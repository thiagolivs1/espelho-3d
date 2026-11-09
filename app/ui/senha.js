// Caixa "Trocar senha" (página do empreendimento e área do gerente).
import { validarNovaSenha } from '../conta.js';
import { trocarSenha } from '../supabase.js';

export function abrirTrocaSenha() {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg-login';
  dlg.innerHTML = `
    <form class="login">
      <h2>Trocar senha</h2>
      <label>Nova senha<input name="a" type="password" autocomplete="new-password" required></label>
      <label>Repita a nova senha<input name="b" type="password" autocomplete="new-password" required></label>
      <p class="erro" role="alert" hidden></p>
      <p class="ok" role="status" hidden>Senha trocada.</p>
      <div class="row">
        <button type="button" class="btn ghost" data-fechar>Fechar</button>
        <button type="submit" class="btn">Trocar</button>
      </div>
    </form>`;
  document.body.append(dlg);
  const form = dlg.querySelector('form'), erro = dlg.querySelector('.erro'), okMsg = dlg.querySelector('.ok');
  const fechar = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('[data-fechar]').onclick = fechar;
  dlg.addEventListener('cancel', ev => { ev.preventDefault(); fechar(); });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    erro.hidden = true; okMsg.hidden = true;
    const msg = validarNovaSenha(form.a.value, form.b.value);
    if (msg) { erro.textContent = msg; erro.hidden = false; return; }
    const b = form.querySelector('[type=submit]'); b.disabled = true;
    try { await trocarSenha(form.a.value); form.reset(); okMsg.hidden = false; }
    catch (e) { erro.textContent = /same|different/i.test(e.message) ? 'A nova senha precisa ser diferente da atual.' : 'Não foi possível trocar a senha. Tente de novo.'; erro.hidden = false; }
    finally { b.disabled = false; }
  });
  dlg.showModal();
  form.a.focus();
}
