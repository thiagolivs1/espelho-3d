// Caixas de confirmação e aviso da própria página. Substituem confirm()/alert(), que navegadores
// embutidos (painel do app, navegador interno do WhatsApp/Instagram) bloqueiam em silêncio.

function abrir({ titulo, texto, itens = [], ok, cancelar }) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg-confirma';
    const box = document.createElement('div');
    box.className = 'login';
    const h = document.createElement('h2'); h.textContent = titulo;
    const p = document.createElement('p'); p.textContent = texto;
    box.append(h, p);
    if (itens.length) {
      const ul = document.createElement('ul');
      ul.className = 'dlg-itens';
      for (const i of itens) { const li = document.createElement('li'); li.textContent = i; ul.append(li); }
      box.append(ul);
    }
    const row = document.createElement('div'); row.className = 'row';
    const fechar = valor => { dlg.close(); dlg.remove(); resolve(valor); };
    if (cancelar) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.textContent = cancelar;
      b.onclick = () => fechar(false); row.append(b);
    }
    const bOk = document.createElement('button'); bOk.type = 'button'; bOk.className = 'btn'; bOk.textContent = ok;
    bOk.onclick = () => fechar(true); row.append(bOk);
    box.append(row);
    dlg.append(box);
    dlg.addEventListener('cancel', ev => { ev.preventDefault(); fechar(false); }); // tecla Esc
    document.body.append(dlg);
    dlg.showModal();
    bOk.focus();
  });
}

export const confirmar = ({ titulo, texto, itens, ok = 'Confirmar', cancelar = 'Cancelar' }) =>
  abrir({ titulo, texto, itens, ok, cancelar });

export const avisar = (titulo, texto, itens = []) => abrir({ titulo, texto, itens, ok: 'Entendi' }).then(() => undefined);

// Caixa de progresso que não fecha com Esc nem clique: usada enquanto grava no banco.
export function progresso(titulo) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg-confirma';
  dlg.innerHTML = '<div class="login"><h2></h2><p class="prog-texto"></p><progress max="1" value="0"></progress></div>';
  dlg.querySelector('h2').textContent = titulo;
  dlg.addEventListener('cancel', ev => ev.preventDefault());
  document.body.append(dlg);
  dlg.showModal();
  return {
    atualizar(feitas, total) {
      dlg.querySelector('.prog-texto').textContent = `Gravando ${feitas} de ${total}…`;
      const barra = dlg.querySelector('progress'); barra.max = total; barra.value = feitas;
    },
    fechar() { dlg.close(); dlg.remove(); },
  };
}
