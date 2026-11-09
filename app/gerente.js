// Área do gerente: situação e preço por unidade, numa grade torre × andar × coluna.
import { STATUS, unitKey, unitLabel, parseBRL, formatBRL } from './units.js';
import { diffChanges, precisaRecarregar, precoSuspeito } from './model.js';
import { CORES_SITUACAO } from './scene/cores.js';
import { mountLogin } from './ui/login.js';
import { confirmar, avisar, progresso } from './ui/dialogo.js';
import { parseCvCsv } from './cv.js';
import { mountEquipe } from './ui/equipe.js';
import { abrirTrocaSenha } from './ui/senha.js';
import { supabase, signOut, currentSession, currentRole, fetchPrices, fetchStatuses, fetchLastUpdate, saveChanges, registrarConferencia } from './supabase.js';

const EMPREENDIMENTOS = [{ slug: 'fantastique-prime-2', nome: 'Fantastique Prime II' }];
const FUSO = 'America/Fortaleza';
const dataHora = d => `${d.toLocaleDateString('pt-BR', { timeZone: FUSO })} às ${d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })}`;
const moeda = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function startGerente() {
  const app = document.getElementById('app');
  const login = mountLogin({ titulo: 'Área do gerente', texto: 'Entre com o seu e-mail de gerente.' });
  const st = { slug: EMPREENDIMENTOS[0].slug, torre: 1, usuario: null, unidades: [], original: new Map(), editado: new Map(), invalidos: new Set(), selecao: new Set() };

  async function iniciar() {
    const sessao = await currentSession().catch(() => null);
    st.usuario = sessao?.user?.id ?? null;
    if (!sessao) {
      app.innerHTML = `<div class="ger-msg"><h1>Área do gerente</h1><p>Entre para atualizar a disponibilidade e os preços.</p>
        <button class="btn" id="entrar" type="button">Entrar</button></div>`;
      document.getElementById('entrar').onclick = () => login.abrir();
      login.abrir();
      return;
    }
    let role = null;
    try { role = await currentRole(); } catch { /* tratado abaixo */ }
    st.role = role;
    if (!['admin', 'gerente'].includes(role)) {
      app.innerHTML = `<div class="ger-msg"><h1>Área do gerente</h1><p>Esta área é só para gerentes.</p>
        <button class="btn ghost" id="sair" type="button">Sair</button></div>`;
      document.getElementById('sair').onclick = () => signOut();
      return;
    }
    await carregar(sessao.user.email);
  }

  async function carregar(email) {
    app.innerHTML = '<div class="ger-msg"><p>Carregando…</p></div>';
    try {
      const base = new URL(`../${st.slug}/`, import.meta.url).href;
      const [arquivo, precos, situacoes, ultima] = await Promise.all([
        fetch(`${base}units.json`).then(r => r.json()), fetchPrices(st.slug), fetchStatuses(st.slug), fetchLastUpdate(st.slug).catch(() => null),
      ]);
      st.unidades = arquivo.unidades;
      st.original = new Map(st.unidades.map(u => {
        const k = unitKey(u.torre, u.unidade);
        return [k, { status: situacoes.get(k), venda: precos.get(k)?.venda ?? u.venda }];
      }));
      st.editado = new Map([...st.original].map(([k, v]) => [k, { ...v }]));
      st.invalidos.clear(); st.selecao.clear();
      desenhar(email, ultima);
    } catch (e) {
      app.innerHTML = `<div class="ger-msg"><h1>Área do gerente</h1><p class="erro">Não foi possível carregar os dados: ${e.message}</p>
        <button class="btn" id="tentar" type="button">Tentar de novo</button></div>`;
      document.getElementById('tentar').onclick = () => carregar(email);
    }
  }

  function desenhar(email, ultima) {
    const torres = [...new Set(st.unidades.map(u => u.torre))].sort();
    app.innerHTML = `
      <header class="ger-top">
        <div><h1>Área do gerente</h1><p class="mute">${email} · ${ultima ? `última atualização em ${dataHora(ultima.em)}${ultima.por ? ` por ${ultima.por}` : ''}` : 'sem atualização registrada'}</p></div>
        <div class="ger-acoes">
          <select id="emp" aria-label="Empreendimento">${EMPREENDIMENTOS.map(e => `<option value="${e.slug}">${e.nome}</option>`).join('')}</select>
          <label class="btn" for="cv-arquivo" title="Arquivo CSV exportado do Construtor de Vendas (mapa de disponibilidade)">Importar mapa do CV</label>
          <input type="file" id="cv-arquivo" accept=".csv,text/csv" hidden>
          <a class="btn ghost" href="../${st.slug}/">Ver maquete</a>
          <button class="btn ghost" id="senha" type="button">Trocar senha</button>
          <button class="btn ghost" id="sair" type="button">Sair</button>
        </div>
      </header>
      <div class="ger-secoes"><div class="seg" id="secoes" role="group" aria-label="Seção">
        <button data-sec="disp" aria-pressed="true">Disponibilidade</button><button data-sec="equipe" aria-pressed="false">Equipe</button>
      </div></div>
      <div id="sec-equipe" class="ger-equipe" hidden></div>
      <div id="sec-disp">
      <div class="ger-barra">
        <div class="seg" id="abas">${torres.map(t => `<button data-t="${t}" aria-pressed="${t === st.torre}">Torre ${t}</button>`).join('')}</div>
        <div class="ger-massa">
          <span class="mute" id="sel-info">Toque no número do andar ou da coluna para selecionar uma linha inteira.</span>
          <select id="massa" aria-label="Marcar seleção como" disabled>
            <option value="">Marcar seleção como…</option>${Object.entries(STATUS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}
          </select>
        </div>
        <div class="ger-salvar"><span id="resumo" class="mute"></span>
          <button class="btn ghost" id="conferir" type="button" title="Use nos dias em que nada mudou: os corretores veem que a disponibilidade foi conferida hoje.">Conferi hoje, sem mudanças</button>
          <button class="btn" id="salvar" type="button" disabled>Salvar alterações</button></div>
      </div>
      <div class="ger-grade" id="grade"></div>
      <p class="mute ger-leg">${Object.entries(STATUS).map(([k, n]) => `<span><i class="dot" style="background:${CORES_SITUACAO[k]}"></i>${n}</span>`).join(' ')}</p>
      </div>`;
    document.getElementById('sair').onclick = () => signOut();
    document.getElementById('senha').onclick = () => abrirTrocaSenha();
    let equipeMontada = false;
    document.getElementById('secoes').onclick = ev => {
      const b = ev.target.closest('[data-sec]'); if (!b) return;
      document.querySelectorAll('#secoes button').forEach(x => x.setAttribute('aria-pressed', x === b));
      const equipe = b.dataset.sec === 'equipe';
      document.getElementById('sec-equipe').hidden = !equipe;
      document.getElementById('sec-disp').hidden = equipe;
      if (equipe && !equipeMontada) { equipeMontada = true; mountEquipe(document.getElementById('sec-equipe'), { meuPapel: st.role, meuId: st.usuario }); }
    };
    document.getElementById('abas').onclick = ev => {
      const b = ev.target.closest('[data-t]'); if (!b) return;
      st.torre = Number(b.dataset.t); st.selecao.clear();
      document.querySelectorAll('#abas button').forEach(x => x.setAttribute('aria-pressed', x === b));
      grade();
    };
    document.getElementById('massa').onchange = ev => {
      const s = ev.target.value; if (!s) return;
      for (const k of st.selecao) st.editado.get(k).status = s;
      st.selecao.clear(); ev.target.value = ''; grade();
    };
    document.getElementById('salvar').onclick = salvar;
    document.getElementById('cv-arquivo').onchange = async ev => {
      const arquivo = ev.target.files[0]; ev.target.value = '';
      if (arquivo) await importarCv(arquivo, email);
    };
    document.getElementById('conferir').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Registrando…';
      try { await registrarConferencia(st.slug); await carregar(email); }
      catch (e) { b.disabled = false; b.textContent = 'Conferi hoje, sem mudanças'; await avisar('Não foi possível registrar', e.message); }
    };
    grade();
  }

  function grade() {
    const us = st.unidades.filter(u => u.torre === st.torre);
    const andares = [...new Set(us.map(u => u.andar))].sort((a, b) => b - a);
    const colunas = [...new Set(us.map(u => u.coluna))].sort((a, b) => a - b);
    const porPos = new Map(us.map(u => [`${u.andar}-${u.coluna}`, u]));
    const celula = u => {
      const k = unitKey(u.torre, u.unidade), e = st.editado.get(k), o = st.original.get(k);
      const mudou = e.status !== o.status || e.venda !== o.venda || st.invalidos.has(k);
      return `<td data-key="${k}" class="${mudou ? 'mudou' : ''}${st.selecao.has(k) ? ' marcada' : ''}">
        <b>${unitLabel(u.unidade)}</b>
        <select class="s-${e.status}" aria-label="Situação da unidade ${unitLabel(u.unidade)}">${Object.entries(STATUS).map(([s, n]) => `<option value="${s}"${s === e.status ? ' selected' : ''}>${n}</option>`).join('')}</select>
        <input inputmode="decimal" aria-label="Preço da unidade ${unitLabel(u.unidade)}" class="${st.invalidos.has(k) ? 'invalido' : ''}" value="${st.invalidos.has(k) ? '' : moeda(e.venda)}">
      </td>`;
    };
    const g = document.getElementById('grade');
    g.innerHTML = `<table><thead><tr><th></th>${colunas.map(c => `<th><button type="button" data-col="${c}">Coluna ${String(c).padStart(2, '0')}</button></th>`).join('')}</tr></thead>
      <tbody>${andares.map(a => `<tr><th><button type="button" data-andar="${a}">${a === 0 ? 'Térreo' : `${a}º`}</button></th>${colunas.map(c => porPos.get(`${a}-${c}`) ? celula(porPos.get(`${a}-${c}`)) : '<td></td>').join('')}</tr>`).join('')}</tbody></table>`;
    g.onchange = ev => {
      const td = ev.target.closest('td[data-key]'); if (!td) return;
      const k = td.dataset.key, e = st.editado.get(k);
      if (ev.target.tagName === 'SELECT') { e.status = ev.target.value; ev.target.className = `s-${e.status}`; }
      else {
        const v = parseBRL(ev.target.value);
        if (v === null) { st.invalidos.add(k); ev.target.classList.add('invalido'); }
        else { st.invalidos.delete(k); e.venda = v; ev.target.classList.remove('invalido'); ev.target.value = moeda(v); }
      }
      const o = st.original.get(k);
      td.classList.toggle('mudou', e.status !== o.status || e.venda !== o.venda || st.invalidos.has(k));
      resumo();
    };
    g.onclick = ev => {
      const b = ev.target.closest('[data-andar],[data-col]'); if (!b) return;
      const alvo = us.filter(u => (b.dataset.andar !== undefined ? u.andar === Number(b.dataset.andar) : u.coluna === Number(b.dataset.col)));
      const ks = alvo.map(u => unitKey(u.torre, u.unidade)), todas = ks.every(k => st.selecao.has(k));
      ks.forEach(k => (todas ? st.selecao.delete(k) : st.selecao.add(k)));
      grade();
    };
    resumo();
  }

  // Importação do mapa do CV: mostra o que muda e só grava depois da confirmação.
  async function importarCv(arquivo, email) {
    if (mudancas().length || st.invalidos.size)
      return avisar('Há alterações não salvas', 'Salve ou desfaça as alterações da grade antes de importar o mapa do CV.');
    const r = parseCvCsv(await arquivo.text(), new Map(st.unidades.map(u => [unitKey(u.torre, u.unidade), u.area])));
    if (r.recusado) return avisar('Não foi possível importar', r.recusado, r.erros.slice(0, 30));
    const editado = new Map([...st.original].map(([k, v]) => [k, { ...v }]));
    for (const l of r.linhas) editado.set(l.key, { status: l.status, venda: l.venda });
    const m = diffChanges(st.original, editado);
    const problemas = r.erros.length ? ` ${r.erros.length} ${r.erros.length === 1 ? 'linha com problema fica' : 'linhas com problema ficam'} de fora.` : '';
    if (!m.length) {
      return r.erros.length
        ? avisar('Nada mudou nas linhas lidas', `As ${r.linhas.length} unidades lidas já estão iguais ao espelho.${problemas}`, r.erros)
        : avisar('Nada para atualizar', 'O espelho já está igual ao mapa do CV.');
    }
    const nS = m.filter(x => x.status !== undefined).length, nP = m.filter(x => x.venda !== undefined).length;
    const descreve = x => {
      const o = st.original.get(unitKey(x.torre, x.unidade)), partes = [];
      if (x.status !== undefined) partes.push(`${STATUS[o.status] ?? '—'} → ${STATUS[x.status]}`);
      if (x.venda !== undefined) partes.push(`${formatBRL(o.venda)} → ${formatBRL(x.venda)}${precoSuspeito(o.venda, x.venda) ? ' (mais de 50%!)' : ''}`);
      return `Torre ${x.torre} · ${unitLabel(x.unidade)}: ${partes.join(' · ')}`;
    };
    const itens = m.slice(0, 15).map(descreve);
    if (m.length > 15) itens.push(`… e mais ${m.length - 15} ${m.length - 15 === 1 ? 'unidade' : 'unidades'}.`);
    const ok = await confirmar({
      titulo: 'Importar mapa do CV?',
      texto: `${nS} ${nS === 1 ? 'unidade muda' : 'unidades mudam'} de situação e ${nP} ${nP === 1 ? 'preço muda' : 'preços mudam'}.${problemas}`,
      itens: [...itens, ...r.erros],
      ok: 'Importar',
    });
    if (!ok) return;
    await gravarComProgresso(m, 'Importando o mapa do CV', email);
  }

  function mudancas() {
    const valido = new Map([...st.editado].filter(([k]) => !st.invalidos.has(k)));
    return diffChanges(st.original, valido);
  }

  function resumo() {
    const m = mudancas(), nS = m.filter(x => x.status !== undefined).length, nP = m.filter(x => x.venda !== undefined).length;
    const partes = [];
    if (nS) partes.push(`${nS} ${nS === 1 ? 'unidade muda' : 'unidades mudam'} de situação`);
    if (nP) partes.push(`${nP} ${nP === 1 ? 'preço muda' : 'preços mudam'}`);
    if (st.invalidos.size) partes.push(`${st.invalidos.size} ${st.invalidos.size === 1 ? 'preço inválido' : 'preços inválidos'}`);
    document.getElementById('resumo').textContent = partes.join(', ');
    document.getElementById('salvar').disabled = !m.length || st.invalidos.size > 0;
    document.getElementById('conferir').disabled = m.length > 0 || st.invalidos.size > 0;
    const info = document.getElementById('sel-info'), massa = document.getElementById('massa');
    massa.disabled = !st.selecao.size;
    info.textContent = st.selecao.size ? `${st.selecao.size} unidades selecionadas.` : 'Toque no número do andar ou da coluna para selecionar uma linha inteira.';
  }

  async function salvar() {
    const m = mudancas(); if (!m.length || st.invalidos.size) return;
    const nS = m.filter(x => x.status !== undefined).length, nP = m.filter(x => x.venda !== undefined).length;
    const suspeitos = m.filter(x => x.venda !== undefined && precoSuspeito(st.original.get(unitKey(x.torre, x.unidade)).venda, x.venda))
      .map(x => `Torre ${x.torre} · ${unitLabel(x.unidade)}: ${formatBRL(st.original.get(unitKey(x.torre, x.unidade)).venda)} → ${formatBRL(x.venda)}`);
    const resumoTexto = `${nS} ${nS === 1 ? 'unidade muda' : 'unidades mudam'} de situação e ${nP} ${nP === 1 ? 'preço muda' : 'preços mudam'}.`;
    const ok = await confirmar({
      titulo: 'Salvar alterações?',
      texto: suspeitos.length
        ? `${resumoTexto} Atenção: ${suspeitos.length === 1 ? 'este preço muda' : 'estes preços mudam'} mais de 50%. Confira se não é erro de digitação:`
        : resumoTexto,
      itens: suspeitos,
      ok: 'Salvar',
    });
    if (!ok) return;
    const sessao = await currentSession();
    await gravarComProgresso(m, 'Salvando alterações', sessao.user.email);
  }

  // Grava com caixa de progresso e trava de saída da página; ao terminar (ou falhar), recarrega a grade.
  async function gravarComProgresso(m, titulo, email) {
    const caixa = progresso(titulo);
    st.salvando = true;
    try {
      caixa.atualizar(0, m.length);
      await saveChanges(st.slug, m, (feitas, total) => caixa.atualizar(feitas, total));
      caixa.fechar(); st.salvando = false;
      await carregar(email);
    } catch (e) {
      caixa.fechar(); st.salvando = false;
      await avisar('A gravação parou no meio', `${e.gravados ?? 0} de ${m.length} unidades foram gravadas antes do erro: ${e.message} Recarregue e confira; importar de novo completa o que faltou.`);
      await carregar(email);
    }
  }

  // Eventos de sessão (inclusive ao voltar para a aba) só recarregam a grade se a pessoa logada mudou;
  // assim edições ainda não salvas não se perdem.
  supabase.auth.onAuthStateChange((evento, sessao) => {
    if (precisaRecarregar(st.usuario, sessao?.user?.id ?? null)) setTimeout(iniciar, 0);
  });
  addEventListener('beforeunload', ev => {
    if (st.salvando || mudancas().length || st.invalidos.size) { ev.preventDefault(); ev.returnValue = ''; }
  });
  iniciar();
}
