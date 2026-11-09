// Página de um empreendimento: maquete 3D + painel. Link aberto mostra preços; login mostra a situação.
import { createViewer } from './scene/viewer.js';
import { buildTowers, paintUnits } from './scene/building.js';
import { buildSite } from './scene/site.js';
import { mergeUnits, summarize, filterUnits, isStale, AVISO_PRECOS } from './model.js';
import { parseUnitHash, findUnit, unitLabel, STATUS } from './units.js';
import { renderHero, renderKpis, renderLegend, renderDetail, renderList, tooltip, pavimento } from './ui/panel.js';
import { mountLogin } from './ui/login.js';
import { supabase, signOut, currentSession, currentRole, fetchPrices, fetchStatuses, fetchLastUpdate } from './supabase.js';

const FUSO = 'America/Fortaleza';
const dataHora = d => `${d.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })}`;
const isM = () => innerWidth < 880;

const SHELL = `
  <div class="app">
    <section class="stage" id="stage">
      <canvas id="gl" aria-label="Maquete 3D do empreendimento. Arraste para girar, role ou pince para aproximar, toque numa unidade para ver os detalhes."></canvas>
      <div class="topbar">
        <div class="seg" id="views" role="group" aria-label="Enquadramento"></div>
        <div class="seg" id="modos" role="group" aria-label="Modo de visualização"></div>
      </div>
      <div class="legend" id="legend" hidden></div>
      <div class="hint" id="hint">Arraste para girar · role ou pince para aproximar</div>
      <div class="tip" id="tip" hidden></div>
      <div class="selbar" id="selbar" hidden><div><b id="sb-n"></b><span id="sb-s"></span></div><button type="button" id="sb-go" class="btn">Ver detalhes</button></div>
    </section>
    <aside class="panel">
      <div id="hero"></div>
      <div class="faixas" id="faixas"></div>
      <div class="acesso" id="acesso"></div>
      <div class="kpis" id="kpis"></div>
      <div class="filters">
        <div class="row" id="f-tipo" role="group" aria-label="Tipologia">
          <button class="chip" data-t="all" aria-pressed="true">Todas</button>
          <button class="chip" data-t="2q" aria-pressed="false">2 quartos</button>
          <button class="chip" data-t="3q" aria-pressed="false">3 quartos</button>
          <button class="chip" data-t="garden" aria-pressed="false">Garden</button>
        </div>
        <div class="row" id="f-disp" hidden><button class="chip" data-d aria-pressed="false">Só disponíveis</button></div>
      </div>
      <div id="detail" class="card empty">Toque numa unidade da maquete ou da lista para ver tipologia, metragem, planta e valor.</div>
      <div class="lista">
        <button type="button" class="ulist-btn" id="ulist-btn" aria-expanded="false"></button>
        <div class="list" id="list" hidden></div>
      </div>
      <footer class="rodape"><p id="rodape"></p><p class="by"><span>Espelho 3D</span><a id="link-gerente" href="../gerente/" hidden>Área do gerente</a></p></footer>
    </aside>
  </div>
  <dialog class="lightbox" id="lightbox"><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="btn" data-fechar>Fechar</button></dialog>`;

export async function startPage(slug) {
  const base = new URL(`../${slug}/`, import.meta.url).href;
  document.getElementById('app').innerHTML = SHELL;
  const $ = id => document.getElementById(id);

  const [pkg, arquivo] = await Promise.all([
    fetch(`${base}empreendimento.json`).then(r => r.json()),
    fetch(`${base}units.json`).then(r => r.json()),
  ]);
  document.title = `${pkg.nome} · Espelho 3D`;
  const raiz = document.documentElement.style;
  raiz.setProperty('--marca', pkg.cores.marca);
  raiz.setProperty('--escuro', pkg.cores.escuro);
  raiz.setProperty('--paper', pkg.cores.fundo);
  $('hero').innerHTML = renderHero(pkg, base);
  $('rodape').textContent = pkg.rodape;
  $('legend').innerHTML = renderLegend();

  const viewer = createViewer($('gl'), { fundo: pkg.cores.fundo });
  viewer.scene.add(buildSite(pkg));
  const st = {
    logado: false, role: null, prices: null, statuses: null, ultima: null,
    erroPreco: false, erroSituacao: null, modo: 'tabela', tipologia: 'all', soDisp: false, sel: null, listaAberta: false,
  };
  let views = mergeUnits(arquivo.unidades, null, null);
  const built = buildTowers(pkg, views);
  viewer.scene.add(built.group);
  viewer.setTowers(built.towers);
  const login = mountLogin({ titulo: 'Entrar', texto: 'Acesso para corretores e gerentes da equipe de vendas.' });

  // ---------- enquadramento e modos ----------
  const torres = pkg.implantacao.torres.map(t => t.numero).sort();
  $('views').innerHTML = `<button data-v="all" aria-pressed="true">Condomínio</button>` +
    torres.map(n => `<button data-v="${n}" aria-pressed="false">Torre ${n}</button>`).join('');
  $('views').onclick = ev => {
    const b = ev.target.closest('[data-v]'); if (!b) return;
    $('views').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
    viewer.frame(b.dataset.v === 'all' ? 'all' : Number(b.dataset.v));
  };
  const renderModos = () => {
    const modos = st.logado ? [['disponibilidade', 'Disponibilidade'], ['fachada', 'Fachada']] : [['tabela', 'Tabela'], ['fachada', 'Fachada']];
    if (!modos.some(([m]) => m === st.modo)) st.modo = modos[0][0];
    $('modos').innerHTML = modos.map(([m, r]) => `<button data-m="${m}" aria-pressed="${m === st.modo}">${r}</button>`).join('');
  };
  $('modos').onclick = ev => { const b = ev.target.closest('[data-m]'); if (b) { st.modo = b.dataset.m; atualizar(); } };

  // ---------- filtros ----------
  $('f-tipo').onclick = ev => {
    const b = ev.target.closest('[data-t]'); if (!b) return;
    st.tipologia = b.dataset.t;
    $('f-tipo').querySelectorAll('[data-t]').forEach(x => x.setAttribute('aria-pressed', x === b));
    atualizar();
  };
  $('f-disp').onclick = ev => {
    const b = ev.target.closest('[data-d]'); if (!b) return;
    st.soDisp = !st.soDisp; b.setAttribute('aria-pressed', st.soDisp); atualizar();
  };

  // ---------- seleção ----------
  const destacar = (u, liga) => {
    const m = built.meshesByKey.get(u.key); if (!m) return;
    m.material.emissive.setHex(liga ? 0x6a4210 : 0x000000);
    viewer.invalidate();
  };
  function selecionar(u, focar) {
    if (st.sel) destacar(st.sel, false);
    st.sel = u;
    if (!u) { $('selbar').hidden = true; return; }
    destacar(u, true);
    if (focar) viewer.focusUnit(built.meshesByKey.get(u.key));
    try { history.replaceState(null, '', `#${u.key}`); } catch { /* sem histórico (ex.: iframe) */ }
    renderDetalhe(); renderLista();
    $('sb-n').textContent = `${unitLabel(u.unidade)} · Torre ${u.torre}`;
    $('sb-s').textContent = ` · ${pavimento(u.andar)}${st.logado && u.status ? ` · ${STATUS[u.status]}` : ''}`;
    $('selbar').hidden = !isM();
  }
  viewer.onPick(k => { const u = k && views.find(v => v.key === k); if (u) selecionar(u, false); });
  viewer.onHover((k, x, y) => {
    const tip = $('tip'), u = k && views.find(v => v.key === k);
    if (!u || isM()) { tip.hidden = true; return; }
    const r = $('stage').getBoundingClientRect();
    tip.textContent = tooltip(u, st.logado);
    tip.style.left = `${x - r.left}px`; tip.style.top = `${y - r.top}px`; tip.hidden = false;
  });
  $('sb-go').onclick = () => $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const doHash = () => {
    const u = findUnit(views, parseUnitHash(location.hash));
    if (u && u !== st.sel) selecionar(u, true);
  };
  addEventListener('hashchange', doHash);

  // ---------- painel ----------
  function renderDetalhe() {
    const d = $('detail');
    if (!st.sel) return;
    d.classList.remove('empty');
    d.innerHTML = renderDetail(st.sel, { pkg, base, logado: st.logado });
    d.querySelector('.pl-open')?.addEventListener('click', ev => {
      const b = ev.currentTarget, lb = $('lightbox');
      lb.querySelector('img').src = b.dataset.src; lb.querySelector('img').alt = b.dataset.legenda;
      lb.querySelector('figcaption').textContent = b.dataset.legenda;
      lb.showModal();
    });
    d.querySelector('[data-copiar]').onclick = async ev => {
      const url = `${location.origin}${location.pathname}#${st.sel.key}`, b = ev.currentTarget;
      try { await navigator.clipboard.writeText(url); b.textContent = 'Link copiado'; } catch { b.textContent = url; }
      setTimeout(() => { b.textContent = 'Copiar link da unidade'; }, 2200);
    };
  }
  $('lightbox').addEventListener('click', ev => { if (ev.target.id === 'lightbox' || ev.target.matches('[data-fechar]')) $('lightbox').close(); });

  const linhasLista = () => filterUnits(views, { tipologia: st.tipologia, soDisponiveis: st.logado && st.soDisp })
    .filter(u => !(st.logado && u.status === 'V'))
    .sort((a, b) => a.venda - b.venda);
  function renderLista() {
    const rows = linhasLista();
    $('ulist-btn').innerHTML = st.listaAberta ? '<span>Fechar lista de unidades</span><i>▾</i>' : `<span>Ver lista com ${rows.length} unidades e preços</span><i>▾</i>`;
    $('ulist-btn').setAttribute('aria-expanded', st.listaAberta);
    $('list').hidden = !st.listaAberta;
    if (st.listaAberta) $('list').innerHTML = renderList(rows, st.sel, st.logado);
  }
  $('ulist-btn').onclick = () => { st.listaAberta = !st.listaAberta; renderLista(); };
  $('list').onclick = ev => {
    const b = ev.target.closest('[data-key]'); if (!b) return;
    selecionar(views.find(v => v.key === b.dataset.key), true);
    if (isM()) $('stage').scrollIntoView({ behavior: 'smooth' });
  };

  function renderAcesso() {
    const faixas = [];
    if (st.erroPreco) faixas.push(['info', AVISO_PRECOS]);
    if (st.erroSituacao === 'desativado') faixas.push(['erro', 'Seu acesso está desativado. Fale com o gerente.']);
    else if (st.erroSituacao) faixas.push(['erro', 'Não foi possível carregar a disponibilidade. As unidades aparecem em cinza até a conexão voltar.']);
    else if (st.logado && st.ultima && isStale(st.ultima.em, new Date()))
      faixas.push(['alerta', `A disponibilidade não é atualizada desde ${dataHora(st.ultima.em).split(' às')[0]}. Confirme com o gerente antes de fechar.`]);
    $('faixas').innerHTML = faixas.map(([t, m]) => `<p class="faixa ${t}" role="status">${m}</p>`).join('');

    if (!st.logado) {
      $('acesso').innerHTML = '<button type="button" class="btn ghost" id="entrar">Entrar para ver a disponibilidade</button>';
      $('entrar').onclick = () => login.abrir();
    } else {
      const quando = st.ultima ? `Atualizado em ${dataHora(st.ultima.em)}${st.ultima.por ? ` por ${st.ultima.por}` : ''}` : '';
      $('acesso').innerHTML = `<div class="sessao"><span>${quando}</span><button type="button" class="linkbtn" id="sair">Sair</button></div>`;
      $('sair').onclick = () => signOut();
    }
    $('f-disp').hidden = !st.logado;
    $('link-gerente').hidden = !['admin', 'gerente'].includes(st.role);
  }

  function atualizar() {
    views = mergeUnits(arquivo.unidades, st.prices, st.statuses);
    if (st.sel) st.sel = views.find(v => v.key === st.sel.key);
    renderModos();
    const filtrando = st.tipologia !== 'all' || (st.logado && st.soDisp);
    const visiveis = filtrando ? new Set(filterUnits(views, { tipologia: st.tipologia, soDisponiveis: st.logado && st.soDisp }).map(u => u.key)) : null;
    paintUnits(built.meshesByKey, views, st.modo, visiveis, pkg.cores);
    if (st.sel) destacar(st.sel, true);
    viewer.invalidate();
    $('legend').hidden = st.modo !== 'disponibilidade';
    $('kpis').innerHTML = renderKpis(summarize(views, st.logado && !st.erroSituacao));
    renderAcesso(); renderLista();
    if (st.sel) renderDetalhe();
  }

  // ---------- dados ----------
  async function carregarPrecos() {
    try { st.prices = await fetchPrices(slug); st.erroPreco = false; } catch { st.prices = null; st.erroPreco = true; }
  }
  async function carregarAcesso() {
    st.statuses = null; st.ultima = null; st.erroSituacao = null; st.role = null;
    const sessao = await currentSession().catch(() => null);
    st.logado = !!sessao;
    if (!sessao) return;
    try {
      st.role = await currentRole();
      if (!st.role) { st.erroSituacao = 'desativado'; return; }
      const [s, u] = await Promise.all([fetchStatuses(slug), fetchLastUpdate(slug).catch(() => null)]);
      st.statuses = s; st.ultima = u;
      if (!s.size) st.erroSituacao = 'desativado';
    } catch { st.erroSituacao = 'falha'; }
  }

  atualizar();
  viewer.frame('all');
  doHash();
  await Promise.all([carregarPrecos(), carregarAcesso()]);
  atualizar();
  supabase.auth.onAuthStateChange(evento => {
    if (!['SIGNED_IN', 'SIGNED_OUT'].includes(evento)) return;
    // Fora do callback: chamar o Supabase dentro dele pode travar o cliente de autenticação.
    setTimeout(() => carregarAcesso().then(atualizar), 0);
  });
  window.__espelho = { viewer, built, st, get views() { return views; } };
}
