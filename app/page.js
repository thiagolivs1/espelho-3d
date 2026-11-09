// Página de um empreendimento: maquete 3D + painel. Link aberto mostra preços; login mostra a situação.
import { createViewer } from './scene/viewer.js';
import { buildTowers, paintUnits } from './scene/building.js';
import { buildSite } from './scene/site.js';
import { horaSolar, posicaoSol, diaDoAno } from './scene/sol.js';
import { mergeUnits, summarize, filterUnits, isStale, AVISO_PRECOS } from './model.js';
import { parseUnitHash, findUnit, unitLabel, STATUS } from './units.js';
import { renderHero, renderKpis, renderLegend, renderDetail, renderList, tooltip, pavimento } from './ui/panel.js';
import { mountLogin } from './ui/login.js';
import { abrirTrocaSenha } from './ui/senha.js';
import { montarVista } from './ui/vista-ui.js';
import { abrirGaleria } from './ui/galeria.js';
import { toMeters } from './scene/geometry.js';
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
      <div class="sunbox" id="sunbox"><label for="sol">Sol</label><input type="range" id="sol" min="6.5" max="17.5" step="0.25"><output id="sol-hora"></output></div>
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
`;

export async function startPage(slug) {
  const base = new URL(`../${slug}/`, import.meta.url).href;
  document.getElementById('app').innerHTML = SHELL;
  const $ = id => document.getElementById(id);

  const [pkg, arquivo, entornoBruto] = await Promise.all([
    fetch(`${base}empreendimento.json`).then(r => r.json()),
    fetch(`${base}units.json`).then(r => r.json()),
    fetch(`${base}entorno.json`).then(r => (r.ok ? r.json() : null)).catch(() => null),   // opcional
  ]);
  const entorno = entornoBruto && Array.isArray(entornoBruto.predios) && Array.isArray(entornoBruto.vias) && Array.isArray(entornoBruto.pontos) ? entornoBruto : null;
  document.title = `${pkg.nome} · Espelho 3D`;
  const raiz = document.documentElement.style;
  raiz.setProperty('--marca', pkg.cores.marca);
  raiz.setProperty('--escuro', pkg.cores.escuro);
  raiz.setProperty('--paper', pkg.cores.fundo);
  $('hero').innerHTML = renderHero(pkg, base);
  $('rodape').textContent = entorno ? `${pkg.rodape} Entorno ${entorno.fonte}.` : pkg.rodape;
  $('legend').innerHTML = renderLegend();

  const viewer = createViewer($('gl'), { fundo: pkg.cores.fundo });
  let site;
  try { site = buildSite(pkg, entorno); } catch (e) { console.warn('Entorno ignorado:', e); site = buildSite(pkg); }
  viewer.scene.add(site);
  const st = {
    logado: false, role: null, prices: null, statuses: null, ultima: null,
    erroPreco: false, erroSituacao: null, modo: 'tabela', tipologia: 'all', soDisp: false, sel: null, listaAberta: false,
  };
  let views = mergeUnits(arquivo.unidades, null, null);
  const built = buildTowers(pkg, views);
  viewer.scene.add(built.group);
  viewer.setTowers(built.towers);

  const vistaUi = montarVista({ stage: $('stage'), viewer, pkg, built });
  if (entorno) vistaUi.adicionarPontos(entorno.pontos.map(p => ({ nome: p.nome, x: p.x, z: p.z })));

  // ---------- arredores (pontos de referência do OpenStreetMap) ----------
  const CATEGORIAS = { compras: ['Compras', '#c63f33'], escolas: ['Escolas', '#d08a1e'], saude: ['Saúde', '#2f7fa8'], lazer: ['Praia e lazer', '#3d7a63'], transporte: ['Transporte', '#6f6a60'] };
  const distancia = m => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`) + ' em linha reta';
  const etiquetas = [];
  if (entorno && entorno.pontos.length) {
    const bt = document.createElement('div');
    bt.className = 'seg';
    bt.innerHTML = '<button type="button" id="arredores" aria-pressed="false">Mostrar arredores</button>';
    $('stage').querySelector('.topbar').append(bt);
    const camada = document.createElement('div');
    camada.className = 'pinos';
    $('stage').append(camada);
    for (const p of entorno.pontos) {
      const [rotulo, cor] = CATEGORIAS[p.categoria] || ['', '#555'];
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'poi'; b.style.setProperty('--c', cor); b.hidden = true;
      b.innerHTML = '<b></b><em></em>';
      b.querySelector('b').textContent = p.nome; b.querySelector('em').textContent = `${rotulo} · ${distancia(p.distanciaM)}`;
      b.onclick = () => voarPara(p);
      camada.append(b);
      etiquetas.push({ b, p });
    }
    const lista = document.createElement('div');
    lista.className = 'entorno';
    lista.innerHTML = '<p class="eyebrow">Morar no entorno</p>' + Object.entries(CATEGORIAS).map(([k, [rotulo, cor]]) => {
      const itens = entorno.pontos.filter(p => p.categoria === k);
      if (!itens.length) return '';
      return `<div class="ngrupo" style="--c:${cor}"><h4>${rotulo}</h4>${itens.map(p => `<button type="button" class="nitem" data-poi="${entorno.pontos.indexOf(p)}"><span></span><em>${distancia(p.distanciaM)}</em></button>`).join('')}</div>`;
    }).join('');
    lista.querySelectorAll('[data-poi]').forEach(b => { b.querySelector('span').textContent = entorno.pontos[b.dataset.poi].nome; b.onclick = () => voarPara(entorno.pontos[b.dataset.poi]); });
    $('ulist-btn').parentElement.after(lista);
    $('arredores').onclick = () => definirArredores(!st.arredores);
  }
  function definirArredores(ligado) {
    st.arredores = ligado;
    const b = $('arredores'); if (b) { b.setAttribute('aria-pressed', ligado); b.textContent = ligado ? 'Ocultar arredores' : 'Mostrar arredores'; }
    viewer.setArredores(ligado);
    if (ligado) viewer.frameTo({ x: 0, z: 0 }, 1100); else viewer.frame('all');
  }
  function voarPara(p) {
    if (!st.arredores) definirArredores(true);
    viewer.frameTo({ x: p.x / 2, z: p.z / 2 }, Math.max(300, p.distanciaM * 1.8));
    etiquetas.forEach(e => e.b.classList.toggle('destaque', e.p === p));
    if (isM()) $('stage').scrollIntoView({ behavior: 'smooth' });
  }
  viewer.onRender(() => {
    const ocupados = [];
    for (const { b, p } of etiquetas) {
      const s = viewer.projetar(p.x, 10, p.z);
      let esconde = !st.arredores || viewer.emVista() || !s.visivel;
      if (!esconde) {
        const caixa = [s.x - b.offsetWidth / 2, s.y - 34, s.x + b.offsetWidth / 2, s.y];
        esconde = !b.classList.contains('destaque') && ocupados.some(o => caixa[0] < o[2] && caixa[2] > o[0] && caixa[1] < o[3] && caixa[3] > o[1]);
        if (!esconde) ocupados.push(caixa);
      }
      b.hidden = esconde; b.style.left = `${s.x}px`; b.style.top = `${s.y}px`;
    }
  });

  // ---------- sol ----------
  const geo = pkg.geo || { lat: -3.72, lon: -38.55, rotacaoGraus: 0 };
  const hoje = diaDoAno(new Date());
  const rotuloHora = h => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`.replace('h00', 'h');
  const aplicarSol = h => {
    $('sol-hora').textContent = rotuloHora(h);
    viewer.setSol(posicaoSol({ horaSolar: horaSolar(h, geo.lon), diaDoAno: hoje, latitude: geo.lat }), geo.rotacaoGraus);
  };
  {
    const agora = new Date(), h = Number(agora.toLocaleString('en-US', { timeZone: FUSO, hour: 'numeric', hour12: false })) + agora.getMinutes() / 60;
    const inicial = Math.min(17.5, Math.max(6.5, Math.round(h * 4) / 4));
    $('sol').value = inicial; aplicarSol(inicial);
    $('sol').addEventListener('input', ev => aplicarSol(Number(ev.target.value)));
  }
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
      const b = ev.currentTarget;
      abrirGaleria([{ src: b.dataset.src, legenda: `Planta · ${b.dataset.legenda}` }], 0, { ilustrativa: false });
    });
    const persp = (pkg.tipologias[st.sel.tipologia]?.perspectivas || []).map(src => ({ src: base + src, legenda: `Apartamento ${st.sel.tipologia}` }));
    d.querySelectorAll('[data-persp]').forEach(b => { b.onclick = () => abrirGaleria(persp, Number(b.dataset.persp)); });
    d.querySelector('[data-vista]').onclick = () => {
      vistaUi.abrir(st.sel);
      if (isM()) $('stage').scrollIntoView({ behavior: 'smooth' });
    };
    d.querySelector('[data-copiar]').onclick = async ev => {
      const url = `${location.origin}${location.pathname}#${st.sel.key}`, b = ev.currentTarget;
      try { await navigator.clipboard.writeText(url); b.textContent = 'Link copiado'; } catch { b.textContent = url; }
      setTimeout(() => { b.textContent = 'Copiar link da unidade'; }, 2200);
    };
  }

  // ---------- pontos de lazer (pinos sobre a maquete) ----------
  const camadaPinos = document.createElement('div');
  camadaPinos.className = 'pinos';
  $('stage').append(camadaPinos);
  const pinos = (pkg.pontosLazer || []).map(p => {
    const [x, z] = toMeters(pkg.implantacao, p.px);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'spot'; b.innerHTML = `<i>+</i><span></span>`;
    b.querySelector('span').textContent = p.nome; b.setAttribute('aria-label', `Fotos: ${p.nome}`);
    b.onclick = () => abrirGaleria(p.imagens.map(src => ({ src: base + src, legenda: p.nome })));
    camadaPinos.append(b);
    return { b, x, z };
  });
  viewer.onRender(() => {
    const ocupados = [];
    for (const p of pinos) {
      const s = viewer.projetar(p.x, 5, p.z);
      let esconde = viewer.emVista() || !s.visivel || st.arredores;
      if (!esconde) {
        const caixa = [s.x - 6, s.y - 16, s.x + 6 + p.b.offsetWidth, s.y + 6];
        esconde = ocupados.some(o => caixa[0] < o[2] && caixa[2] > o[0] && caixa[1] < o[3] && caixa[3] > o[1]);
        if (!esconde) ocupados.push(caixa);
      }
      p.b.hidden = esconde;
      p.b.style.left = `${s.x}px`; p.b.style.top = `${s.y}px`;
    }
  });

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
      $('acesso').innerHTML = `<div class="sessao"><span>${quando}</span><span><button type="button" class="linkbtn" id="trocar-senha">Trocar senha</button> · <button type="button" class="linkbtn" id="sair">Sair</button></span></div>`;
      $('sair').onclick = () => signOut();
      $('trocar-senha').onclick = () => abrirTrocaSenha();
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
