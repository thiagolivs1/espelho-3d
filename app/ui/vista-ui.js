// Interface da vista da unidade: faixa com textos, minimapa com o cone de visão e saída.
import { toMeters, centroide } from '../scene/geometry.js';
import { orientacao, textoSol, noCampoDeVisao, cone, pontosDasTorres, cantosTorre } from '../scene/vista.js';
import { unitLabel } from '../units.js';
import { pavimento } from './panel.js';

const svgPts = pts => pts.map(([x, z]) => `${x.toFixed(1)},${z.toFixed(1)}`).join(' ');

export function montarVista({ stage, viewer, pkg, built }) {
  const imp = pkg.implantacao, M = p => toMeters(imp, p), geo = pkg.geo || { lat: -3.72, rotacaoGraus: 0 };
  let pontos = [
    ...pontosDasTorres(imp),
    ...imp.ruas.map(r => { const [a, b] = r.linha.map(M); return { nome: r.nome, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2 }; }),
    ...imp.areas.filter(a => a.tipo !== 'garagem').map(a => { const [x, z] = M(centroide(a.poligono)); return { nome: a.nome, x, z }; }),
  ];

  const faixa = document.createElement('div');
  faixa.className = 'vista'; faixa.hidden = true;
  faixa.innerHTML = '<div><b class="vista-t"></b><span class="vista-s"></span><span class="vista-v"></span></div><button type="button" class="btn">Sair da vista</button>';
  const mapa = document.createElement('div');
  mapa.className = 'minimap'; mapa.hidden = true;
  stage.append(faixa, mapa);

  // Minimapa em metros da cena (x = leste, y do SVG = z = sul).
  const lote = imp.lote.map(M), xs = lote.map(p => p[0]), zs = lote.map(p => p[1]), margem = 25;
  const vb = [Math.min(...xs) - margem, Math.min(...zs) - margem, Math.max(...xs) - Math.min(...xs) + 2 * margem, Math.max(...zs) - Math.min(...zs) + 2 * margem];
  const norte = (() => { const a = (geo.rotacaoGraus || 0) * Math.PI / 180; return [Math.sin(a), -Math.cos(a)]; })();
  let unidadeAtual = null;

  function desenharMapa(u) {
    const nx = vb[0] + vb[2] - 14, nz = vb[1] + 16;
    mapa.innerHTML = `<svg viewBox="${vb.join(' ')}" role="img" aria-label="Posição da unidade e direção da vista">
      <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#e9e5da"/>
      <polygon points="${svgPts(lote)}" fill="#d6dfc9" stroke="#3B2A20" stroke-width=".8"/>
      ${imp.torres.map(t => `<polygon points="${svgPts(cantosTorre(imp, t))}" fill="${t.numero === u.torre ? 'var(--marca)' : '#c9c2b5'}"/>`).join('')}
      <g class="mm-cone"></g><circle class="mm-dot" r="2.6" fill="#de7a32" stroke="#fff" stroke-width=".8"/>
      <g transform="translate(${nx} ${nz})"><line x1="0" y1="0" x2="${norte[0] * 9}" y2="${norte[1] * 9}" stroke="#1D2320" stroke-width="1.4"/>
      <text x="${norte[0] * 13}" y="${norte[1] * 13 + 2}" font-size="6" text-anchor="middle" font-weight="700" fill="#1D2320">N</text></g>
    </svg><p>Torre ${u.torre} · coluna ${String(u.coluna).padStart(2, '0')} · o leque laranja mostra para onde você olha</p>`;
  }

  viewer.onRender(() => {
    const e = viewer.estadoVista();
    if (!e || !unidadeAtual) return;
    const [p, a, b] = cone(e.pos, e.dir, 45, 50);
    mapa.querySelector('.mm-cone').innerHTML = `<polygon points="${svgPts([p, a, b])}" fill="rgba(222,122,50,.32)" stroke="#de7a32" stroke-width=".6"/>`;
    const dot = mapa.querySelector('.mm-dot'); dot.setAttribute('cx', e.pos[0]); dot.setAttribute('cy', e.pos[1]);
    const vistos = noCampoDeVisao(e.pos, e.dir, pontos.filter(o => o.numero !== unidadeAtual.torre));
    faixa.querySelector('.vista-v').textContent = vistos.length ? `No seu campo de visão: ${vistos.slice(0, 4).join(', ')}` : '';
  });

  function fechar() { faixa.hidden = true; mapa.hidden = true; stage.classList.remove('em-vista'); unidadeAtual = null; }
  faixa.querySelector('button').onclick = () => viewer.sairVista();

  return {
    abrir(u) {
      const mesh = built.meshesByKey.get(u.key);
      if (!mesh) return;
      unidadeAtual = u;
      const normal = mesh.userData.normal.clone().transformDirection(mesh.parent.matrixWorld);
      const o = orientacao([normal.x, normal.z], geo.rotacaoGraus || 0);
      faixa.querySelector('.vista-t').textContent = `Vista da unidade ${unitLabel(u.unidade)} · Torre ${u.torre}`;
      faixa.querySelector('.vista-s').textContent = `${pavimento(u.andar)} · ${textoSol(o, geo.lat)}`;
      desenharMapa(u);
      faixa.hidden = false; mapa.hidden = false; stage.classList.add('em-vista');
      viewer.entrarVista(mesh, { aoSair: fechar });
    },
    adicionarPontos(novos) { pontos = pontos.concat(novos); },
  };
}
