// Texturas da fachada desenhadas em canvas, no padrão dos renders aprovados.
// Cores do pacote: cores.fachada.base = coroa clara, .faixa = parede, .detalhe = marrom (varandas, placas e faixas).
// Cada textura é um atlas: frente da unidade | lateral | cor lisa (topo, fundo e faces escondidas).
import * as THREE from 'three';

const W = 384, H = 96, FRENTE = 240, LADO = [248, 368], LISO = 376;

function janela(g, p, x, y, w, h) {
  g.fillStyle = p.moldura; g.fillRect(x - 2, y - 2, w + 4, h + 4);
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, p.brilho); grad.addColorStop(0.55, p.vidro); grad.addColorStop(1, p.vidro);
  g.fillStyle = grad; g.fillRect(x, y, w, h);
  g.fillStyle = p.moldura; g.fillRect(x + w / 2 - 1, y, 2, h);
}

function desenhar(g, v, p) {
  g.fillStyle = v.coroa ? p.coroa : p.parede; g.fillRect(0, 0, W, H);

  // Frente: varanda recuada à direita (marrom, porta de vidro, guarda-corpo branco)
  const vx = FRENTE - 86;
  g.fillStyle = p.marrom; g.fillRect(vx, 0, 86, H);
  g.fillStyle = p.sombra; g.fillRect(vx, 0, 86, 8);
  janela(g, p, vx + 12, 14, 62, 66);
  g.fillStyle = p.guarda; g.fillRect(vx + 4, 50, 78, 3);
  for (let x = vx + 6; x < vx + 82; x += 5) g.fillRect(x, 53, 1, 29);
  g.fillRect(vx + 4, 80, 78, 2);

  // Janelas e placas marrons (alternam de lado a cada pavimento)
  const [jx, px] = v.painel ? [92, 24] : [24, 100];
  janela(g, p, jx, 26, 40, 38);
  g.fillStyle = p.marrom; g.fillRect(px, 16, 26, 60);
  janela(g, p, 68, 30, 12, 12);

  // Lateral: janela e placa
  const [lj, lp] = v.painel ? [LADO[0] + 62, LADO[0] + 22] : [LADO[0] + 22, LADO[0] + 76];
  janela(g, p, lj, 26, 36, 38);
  g.fillStyle = p.marrom; g.fillRect(lp, 16, 22, 60);

  if (v.faixa) { g.fillStyle = p.marrom; g.fillRect(0, H - 7, W, 7); }
  g.fillStyle = p.laje; g.fillRect(0, H - 1, W, 1);
  g.fillStyle = p.teto; g.fillRect(LISO - 4, 0, 8, H);   // cobertura (só o topo do último pavimento aparece)
}

const PALETAS = {
  real: f => ({ coroa: f.base, parede: f.faixa, marrom: f.detalhe, vidro: '#24313B', brilho: '#6F8798', moldura: '#F3F1EC', guarda: '#F3F1EC', sombra: 'rgba(0,0,0,.25)', laje: 'rgba(0,0,0,.10)', teto: '#CBCAC5' }),
  neutro: () => ({ coroa: '#F5F5F3', parede: '#EFEFEC', marrom: '#D2D2CE', vidro: '#9EA8B0', brilho: '#C8D0D6', moldura: '#FFFFFF', guarda: '#FFFFFF', sombra: 'rgba(0,0,0,.08)', laje: 'rgba(0,0,0,.08)', teto: '#E4E4E1' }),
  // rugosidade: claro = fosco, escuro = vidro que reflete o céu
  rug: () => ({ coroa: '#E6E6E6', parede: '#E6E6E6', marrom: '#D4D4D4', vidro: '#2A2A2A', brilho: '#2A2A2A', moldura: '#A0A0A0', guarda: '#A0A0A0', sombra: 'rgba(0,0,0,0)', laje: 'rgba(0,0,0,0)', teto: '#E6E6E6' }),
};

function textura(v, paleta, cores, srgb) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  desenhar(c.getContext('2d'), v, PALETAS[paleta](cores.fachada));
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Uma trinca de texturas por combinação (coroa, faixa, painel): 8 combinações no total.
export function criarTexturasFachada(cores) {
  const cache = new Map();
  return v => {
    const k = `${v.coroa}|${v.faixa}|${v.painel}`;
    if (!cache.has(k)) cache.set(k, { real: textura(v, 'real', cores, true), neutro: textura(v, 'neutro', cores, true), rug: textura(v, 'rug', cores, false) });
    return cache.get(k);
  };
}

// Caixa da unidade com UVs apontando para as regiões do atlas. Faces do BoxGeometry: px, nx, py, ny, pz, nz.
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
export function criarGeometriasUnidade() {
  const cache = new Map();
  return ({ frente, ladoExposto, espelhar }) => {
    const fFrente = frente === 'sul' ? 'pz' : 'nz';
    const fLado = ladoExposto === 'leste' ? 'px' : ladoExposto === 'oeste' ? 'nx' : null;
    const k = `${fFrente}|${fLado}|${espelhar}`;
    if (cache.has(k)) return cache.get(k);
    const geo = new THREE.BoxGeometry(1, 1, 1), uv = geo.attributes.uv;
    FACES.forEach((f, i) => {
      for (let j = i * 4; j < i * 4 + 4; j++) {
        const u = uv.getX(j), vv = uv.getY(j);
        if (f === fFrente) uv.setXY(j, ((espelhar ? 1 - u : u) * FRENTE) / W, vv);
        else if (f === fLado) uv.setXY(j, (LADO[0] + u * (LADO[1] - LADO[0])) / W, vv);
        else uv.setXY(j, LISO / W, 0.5);
      }
    });
    uv.needsUpdate = true;
    cache.set(k, geo);
    return geo;
  };
}

// Núcleo de circulação: parede clara com uma janelinha por pavimento.
export function texturaNucleo(cores, pavimentos) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 96;
  const g = c.getContext('2d'), p = PALETAS.real(cores.fachada);
  g.fillStyle = p.coroa; g.fillRect(0, 0, 64, 96);
  janela(g, p, 22, 34, 20, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, pavimentos + 1);
  return t;
}
