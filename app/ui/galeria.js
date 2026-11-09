// Galeria de imagens em <dialog>: setas, teclado (← → Esc) e contador. Toda legenda avisa que é ilustrativa.
export function abrirGaleria(imagens, indice = 0, { ilustrativa = true } = {}) {
  if (!imagens.length) return;
  let i = Math.max(0, Math.min(indice, imagens.length - 1));
  const dlg = document.createElement('dialog');
  dlg.className = 'galeria';
  dlg.innerHTML = `
    <figure><img alt=""><figcaption></figcaption></figure>
    <button type="button" class="gal-nav gal-ant" aria-label="Imagem anterior">‹</button>
    <button type="button" class="gal-nav gal-prox" aria-label="Próxima imagem">›</button>
    <button type="button" class="btn gal-fechar">Fechar</button>`;
  document.body.append(dlg);
  const img = dlg.querySelector('img'), cap = dlg.querySelector('figcaption');
  const varias = imagens.length > 1;
  dlg.querySelectorAll('.gal-nav').forEach(b => { b.hidden = !varias; });
  const mostrar = () => {
    const { src, legenda } = imagens[i];
    img.src = src; img.alt = legenda;
    cap.textContent = [legenda, ilustrativa ? 'imagem ilustrativa' : '', varias ? `${i + 1} de ${imagens.length}` : ''].filter(Boolean).join(' · ');
  };
  const passo = d => { i = (i + d + imagens.length) % imagens.length; mostrar(); };
  const fechar = () => { dlg.close(); dlg.remove(); };
  dlg.querySelector('.gal-ant').onclick = () => passo(-1);
  dlg.querySelector('.gal-prox').onclick = () => passo(1);
  dlg.querySelector('.gal-fechar').onclick = fechar;
  dlg.addEventListener('click', ev => { if (ev.target === dlg) fechar(); });
  dlg.addEventListener('cancel', ev => { ev.preventDefault(); fechar(); });
  dlg.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight' && varias) passo(1);
    if (ev.key === 'ArrowLeft' && varias) passo(-1);
  });
  mostrar();
  dlg.showModal();
  return { fechar };
}
