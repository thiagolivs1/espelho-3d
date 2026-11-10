// Pedaços do painel lateral, como HTML. Sem estado: quem chama passa tudo o que precisa.
import { STATUS, unitLabel, formatBRL, formatShortBRL, formatArea } from '../units.js';
import { CORES_SITUACAO } from '../scene/building.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = v => `${Math.round(v * 100)}%`;
export const pavimento = andar => (andar === 0 ? 'Térreo' : `${andar}º pavimento`);

export function renderHero(pkg, base) {
  return `
    <div class="hero">
      <img class="logo" src="${base}${esc(pkg.logos.empreendimento)}" alt="${esc(pkg.nome)}">
      <p class="end">${esc(pkg.endereco)}</p>
      <div class="facts">${pkg.fatos.map(f => `<div><b>${esc(f.valor)}</b>${esc(f.rotulo)}</div>`).join('')}</div>
      <img class="construtora" src="${base}${esc(pkg.logos.construtora)}" alt="${esc(pkg.construtora)}">
      ${pkg.galeria?.length ? `<button type="button" class="btn ghost ver-fotos">Ver ${pkg.galeria.length} fotos do condomínio</button>` : ''}
    </div>`;
}

export function renderKpis(s) {
  const itens = [];
  if (s.disponiveis !== null) itens.push([s.disponiveis, 'disponíveis'], [pct(s.pctVendido), 'vendido']);
  else itens.push([s.total, 'unidades']);
  itens.push([formatShortBRL(s.aPartirDe), 'a partir de']);
  return itens.map(([v, r]) => `<div class="kpi"><strong>${esc(v)}</strong><span>${r}</span></div>`).join('');
}

export function renderLegend() {
  return Object.entries(STATUS).map(([k, nome]) => `<span><i class="dot" style="background:${CORES_SITUACAO[k]}"></i>${nome}</span>`).join('');
}

export function tooltip(u, logado) {
  return `Torre ${u.torre} · ${unitLabel(u.unidade)} · ${u.quartos} quartos · ${formatShortBRL(u.venda)}` +
    (logado && u.status ? ` · ${STATUS[u.status]}` : '');
}

export function renderDetail(u, { pkg, base, logado }) {
  const tip = pkg.tipologias[u.tipologia] || {};
  const pill = logado && u.status ? `<span class="pill s-${u.status}">${STATUS[u.status]}</span>` : '';
  const aviso = logado && u.status === 'V' ? '<p class="msg">Unidade vendida. Veja na lista as opções disponíveis com a mesma tipologia.</p>'
    : logado && u.status === 'R' ? '<p class="msg">Unidade reservada. Confirme com o gerente antes de oferecer.</p>'
      : logado && u.status === 'B' ? '<p class="msg">Unidade bloqueada para venda.</p>' : '';
  return `
    <div class="uhead">
      <div><h3>${unitLabel(u.unidade)}</h3><p>Torre ${u.torre} · ${pavimento(u.andar)} · coluna ${String(u.coluna).padStart(2, '0')}</p></div>
      ${pill}
    </div>
    <p class="typo">${esc(u.tipologia)}</p>
    <div class="specs">
      <div><b>${formatArea(u.area).replace(' m²', '')}</b><span>m² privativos</span></div>
      <div><b>${u.quartos}</b><span>quartos</span></div>
      ${u.vaga ? `<div><b>${u.vaga.numero}</b><span>vaga · ${esc(u.vaga.nivel)}</span></div>` : '<div><b>1</b><span>vaga</span></div>'}
    </div>
    <div class="price">${formatBRL(u.venda)}<small>${formatBRL(u.venda / u.area)} por m² · valor de tabela</small></div>
    ${aviso}
    ${tip.planta ? `<figure class="planta"><button class="pl-open" type="button" data-src="${base}${esc(tip.planta)}" data-legenda="${esc(tip.legenda)}">
      <img src="${base}${esc(tip.planta)}" alt="Planta ${esc(tip.legenda)}" loading="lazy"></button>
      <figcaption>${esc(tip.legenda)}. Toque para ampliar${tip.plantaTecnica ? ' e ver a planta técnica com medidas' : ''}.</figcaption></figure>` : ''}
    ${tip.perspectivas?.length ? `<div class="persp"><p class="typo">Perspectivas do apartamento</p><div class="persp-row">${tip.perspectivas.map((f, i) =>
      `<button type="button" class="persp-b" data-persp="${i}" aria-label="${esc(f.legenda)}"><img src="${base}${esc(f.src)}" alt="" loading="lazy"><span>${esc(f.legenda)}</span></button>`).join('')}</div></div>` : ''}
    <div class="actions">
      <button class="btn ghost" type="button" data-vista>Ver a vista desta unidade</button>
      <a class="btn" href="${base}${esc(pkg.simulador)}#${u.key}" target="_blank" rel="noopener">Simular fluxo desta unidade</a>
      <button class="btn ghost" type="button" data-copiar>Copiar link da unidade</button>
    </div>`;
}

export function renderList(rows, selecionada, logado) {
  if (!rows.length) return '<p class="msg">Nenhuma unidade com esse filtro.</p>';
  return rows.map(u => `
    <button class="li${u === selecionada ? ' sel' : ''}" type="button" data-key="${u.key}">
      <b>${unitLabel(u.unidade)}</b>
      <span>Torre ${u.torre} · ${esc(u.tipologia)} · ${formatArea(u.area)}${logado && u.status === 'R' ? ' · reservada' : ''}</span>
      <em>${formatShortBRL(u.venda)}</em>
    </button>`).join('');
}
