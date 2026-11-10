// Abertura: o render aprovado da fachada em tela cheia e, ao entrar, o voo até a maquete.
// Aparece uma vez por sessão do navegador e nunca quando o link já aponta para uma unidade.
import { abrirGaleria } from './galeria.js';
import { aplicarLogo } from './logo.js';

const CHAVE = 'espelho-abertura-vista';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const deveMostrarAbertura = (hash, jaViu) => !jaViu && !/^#u-/.test(hash || '');

const jaViu = () => { try { return sessionStorage.getItem(CHAVE) === '1'; } catch { return false; } };
const marcar = () => { try { sessionStorage.setItem(CHAVE, '1'); } catch { /* navegação privada: só não lembra */ } };

export function montarAbertura({ pkg, base, aoEntrar }) {
  if (!pkg.abertura || !deveMostrarAbertura(location.hash, jaViu())) return false;
  const el = document.createElement('section');
  el.className = 'abertura';
  el.setAttribute('aria-label', `Apresentação do ${pkg.nome}`);
  el.innerHTML = `
    <img class="ab-foto" src="${base}${esc(pkg.abertura)}" alt="Perspectiva da fachada e da portaria do ${esc(pkg.nome)}">
    <div class="ab-conteudo">
      <img class="ab-logo" src="${base}${esc(pkg.logos.empreendimento)}" alt="${esc(pkg.nome)}">
      <p class="ab-end">${esc(pkg.endereco)}</p>
      <ul class="ab-fatos">${pkg.fatos.map(f => `<li><b>${esc(f.valor)}</b> ${esc(f.rotulo)}</li>`).join('')}</ul>
      <div class="ab-acoes">
        <button type="button" class="btn ab-entrar">Explorar a maquete 3D</button>
        ${pkg.galeria?.length ? '<button type="button" class="btn ghost ab-fotos">Ver fotos do condomínio</button>' : ''}
      </div>
      <p class="ab-aviso">Imagem ilustrativa do projeto aprovado.</p>
    </div>`;
  document.body.append(el);
  aplicarLogo(el.querySelector('.ab-logo'), pkg.logos);
  document.body.classList.add('com-abertura');
  const entrar = () => {
    marcar();
    el.classList.add('saindo');
    document.body.classList.remove('com-abertura');
    aoEntrar();
    setTimeout(() => el.remove(), 900);
  };
  el.querySelector('.ab-entrar').onclick = entrar;
  el.querySelector('.ab-fotos')?.addEventListener('click', () =>
    abrirGaleria(pkg.galeria.map(f => ({ src: base + f.src, legenda: f.legenda }))));
  el.addEventListener('keydown', ev => { if (ev.key === 'Escape') entrar(); });
  el.querySelector('.ab-entrar').focus();
  return true;
}
