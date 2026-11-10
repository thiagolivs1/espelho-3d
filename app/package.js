// Validação do pacote de um empreendimento (empreendimento.json). Puro: roda no Node e no navegador.
import { tipologiaFor } from './units.js';

const OBRIGATORIOS = ['slug', 'nome', 'construtora', 'endereco', 'entrega', 'fatos', 'rodape', 'cores', 'logos',
  'torres', 'implantacao', 'tipologias'];

// Cantos de uma torre em metros, no referencial da imagem (x para a direita, y para baixo).
function cantos(t, mpp) {
  const a = t.giroGraus * Math.PI / 180, ux = [Math.cos(a), Math.sin(a)], uy = [-Math.sin(a), Math.cos(a)];
  const [cx, cy] = [t.centro[0] * mpp, t.centro[1] * mpp], hl = t.largura / 2, hp = t.profundidade / 2;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) =>
    [cx + ux[0] * hl * i + uy[0] * hp * j, cy + ux[1] * hl * i + uy[1] * hp * j]);
}

// Teste do eixo separador entre dois retângulos orientados.
function sobrepoe(A, B) {
  for (const P of [A, B]) for (let i = 0; i < 4; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % 4], n = [y1 - y2, x2 - x1];
    const proj = Q => Q.map(([x, y]) => x * n[0] + y * n[1]);
    const a = proj(A), b = proj(B);
    if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
  }
  return true;
}

function dentro([x, y], poli) {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function validatePackage(pkg) {
  const erros = [];
  for (const k of OBRIGATORIOS) if (pkg?.[k] === undefined) erros.push(`campo obrigatório ausente: ${k}`);
  if (erros.length) return erros;

  const imp = pkg.implantacao, mpp = imp.metrosPorPixel;
  if (!(mpp > 0)) erros.push('implantacao.metrosPorPixel deve ser maior que zero');
  if (!Array.isArray(imp.lote) || imp.lote.length < 3) erros.push('implantacao.lote precisa de ao menos 3 pontos');
  for (const k of ['base', 'faixa', 'detalhe']) if (!pkg.cores.fachada?.[k]) erros.push(`cores.fachada.${k} ausente`);

  const torres = imp.torres || [];
  const numeros = torres.map(t => t.numero).sort();
  if (numeros.join() !== '1,2,3') erros.push(`implantacao.torres deve ter as torres 1, 2 e 3 (tem: ${numeros.join(', ') || 'nenhuma'})`);
  for (const t of torres) {
    if (!(t.largura >= 30 && t.largura <= 45)) erros.push(`torre ${t.numero}: largura ${t.largura} fora de 30–45 m`);
    if (!(t.profundidade >= 12 && t.profundidade <= 20)) erros.push(`torre ${t.numero}: profundidade ${t.profundidade} fora de 12–20 m`);
    if (Array.isArray(imp.lote) && imp.lote.length >= 3 && !dentro(t.centro, imp.lote)) erros.push(`torre ${t.numero}: centro fora do lote`);
  }
  if (mpp > 0) for (let i = 0; i < torres.length; i++) for (let j = i + 1; j < torres.length; j++) {
    if (sobrepoe(cantos(torres[i], mpp), cantos(torres[j], mpp)))
      erros.push(`torres ${torres[i].numero} e ${torres[j].numero} se sobrepõem`);
  }

  const codigos = new Set();
  for (const t of torres) for (let andar = 0; andar < pkg.torres.pavimentos; andar++)
    for (let col = 1; col <= pkg.torres.colunas; col++) codigos.add(tipologiaFor(t.numero, andar * 100 + col).codigo);
  for (const c of codigos) if (!pkg.tipologias[c]?.planta) erros.push(`tipologias['${c}'] sem planta`);
  for (const [c, t] of Object.entries(pkg.tipologias)) {
    if (!t.perspectivas?.length) erros.push(`tipologias['${c}'] sem perspectivas`);
    else if (t.perspectivas.some(f => !f?.src)) erros.push(`tipologias['${c}']: perspectiva sem arquivo (src)`);
  }
  for (const [i, p] of (pkg.pontosLazer || []).entries()) {
    if (!p.nome || !Array.isArray(p.px) || p.px.length !== 2) erros.push(`pontosLazer[${i}]: nome ou posição ausente`);
    if (!p.imagens?.length) erros.push(`pontosLazer[${i}] (${p.nome}): ponto de lazer sem imagem`);
    else if (p.imagens.some(f => !f?.src)) erros.push(`pontosLazer[${i}] (${p.nome}): foto de lazer sem arquivo (src)`);
  }
  return erros;
}
