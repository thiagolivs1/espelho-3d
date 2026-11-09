// Aba "Equipe" da área do gerente: lista de contas, ativar/desativar, novo corretor (e-mail + senha provisória).
import { listarEquipe, definirAcesso, criarCorretor } from '../supabase.js';
import { validarNovaSenha, validarEmail } from '../conta.js';
import { confirmar, avisar } from './dialogo.js';

const PAPEL = { admin: 'Administrador', gerente: 'Gerente', corretor: 'Corretor' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function mountEquipe(el, { meuPapel, meuId }) {
  async function desenhar() {
    el.innerHTML = '<p class="mute">Carregando a equipe…</p>';
    let contas;
    try { contas = await listarEquipe(); }
    catch (e) { el.innerHTML = `<p class="erro">Não foi possível carregar a equipe: ${esc(e.message)}</p>`; return; }
    el.innerHTML = `
      <form class="eq-novo card" id="eq-novo">
        <h3>Novo corretor</h3>
        <p class="mute">A conta já nasce ativa. Passe a senha provisória ao corretor; ele troca no primeiro acesso, em "Trocar senha".</p>
        <label>E-mail<input name="email" type="email" autocomplete="off" required></label>
        <label>Senha provisória<input name="a" type="password" autocomplete="new-password" required></label>
        <label>Repita a senha<input name="b" type="password" autocomplete="new-password" required></label>
        <p class="erro" role="alert" hidden></p>
        <button type="submit" class="btn">Criar conta</button>
      </form>
      <table class="eq-lista">
        <thead><tr><th>E-mail</th><th>Papel</th><th>Situação</th><th></th></tr></thead>
        <tbody>${contas.map(c => {
          const podeMexer = c.id !== meuId && c.role !== 'admin' && (meuPapel === 'admin' || c.role === 'corretor');
          const acoes = !podeMexer ? '' : [
            `<button class="btn ghost" data-acao="${c.ativo ? 'desativar' : 'ativar'}" data-id="${c.id}" data-email="${esc(c.email)}">${c.ativo ? 'Desativar' : 'Ativar'}</button>`,
            meuPapel === 'admin' && c.role === 'corretor' ? `<button class="btn ghost" data-acao="gerente" data-id="${c.id}" data-email="${esc(c.email)}" data-ativo="${c.ativo}">Tornar gerente</button>` : '',
            meuPapel === 'admin' && c.role === 'gerente' ? `<button class="btn ghost" data-acao="corretor" data-id="${c.id}" data-email="${esc(c.email)}" data-ativo="${c.ativo}">Tornar corretor</button>` : '',
          ].join('');
          return `<tr><td>${esc(c.email)}${c.id === meuId ? ' <span class="mute">(você)</span>' : ''}</td><td>${PAPEL[c.role] || esc(c.role)}</td>
            <td><span class="pill ${c.ativo ? 's-D' : 's-V'}">${c.ativo ? 'Ativa' : 'Desativada'}</span></td><td class="eq-acoes">${acoes}</td></tr>`;
        }).join('')}</tbody>
      </table>`;

    const form = el.querySelector('#eq-novo'), erro = form.querySelector('.erro');
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      erro.hidden = true;
      const msg = validarEmail(form.email.value) || validarNovaSenha(form.a.value, form.b.value);
      if (msg) { erro.textContent = msg; erro.hidden = false; return; }
      const b = form.querySelector('[type=submit]'); b.disabled = true; b.textContent = 'Criando…';
      try {
        await criarCorretor(form.email.value.trim(), form.a.value);
        await avisar('Conta criada', `${form.email.value.trim()} já pode entrar com a senha provisória.`);
        await desenhar();
      } catch (e) { erro.textContent = e.message; erro.hidden = false; b.disabled = false; b.textContent = 'Criar conta'; }
    });

    el.querySelector('.eq-lista').addEventListener('click', async ev => {
      const b = ev.target.closest('[data-acao]'); if (!b) return;
      const { acao, id, email } = b.dataset;
      const textos = {
        desativar: [`Desativar ${email}?`, 'A pessoa deixa de ver a disponibilidade na hora.', 'Desativar'],
        ativar: [`Ativar ${email}?`, 'A pessoa passa a ver a disponibilidade.', 'Ativar'],
        gerente: [`Tornar ${email} gerente?`, 'Gerentes atualizam a disponibilidade, os preços e a equipe de corretores.', 'Tornar gerente'],
        corretor: [`Tornar ${email} corretor?`, 'A pessoa perde o acesso à área do gerente.', 'Tornar corretor'],
      }[acao];
      if (!(await confirmar({ titulo: textos[0], texto: textos[1], ok: textos[2] }))) return;
      try {
        if (acao === 'desativar' || acao === 'ativar') await definirAcesso(id, acao === 'ativar');
        else await definirAcesso(id, b.dataset.ativo === 'true', acao);
        await desenhar();
      } catch (e) { await avisar('Não foi possível alterar', e.message); }
    });
  }
  desenhar();
}
