// Contas puras do paisagismo e do entorno (metros, [x, z]). Rodam no Node e no navegador.

export function dentro([x, z], poli) {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i], [xj, zj] = poli[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

const areaAssinada = poli => poli.reduce((s, [x1, z1], i) => { const [x2, z2] = poli[(i + 1) % poli.length]; return s + x1 * z2 - x2 * z1; }, 0) / 2;

// Um ponto a cada `espaco` metros em cada lado, recuado `recuo` metros para dentro.
export function pontosNoPerimetro(poli, espaco, recuo) {
  const sinal = areaAssinada(poli) > 0 ? 1 : -1, out = [];
  for (let i = 0; i < poli.length; i++) {
    const [ax, az] = poli[i], [bx, bz] = poli[(i + 1) % poli.length];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < espaco) continue;
    const nx = (-(bz - az) / L) * sinal, nz = ((bx - ax) / L) * sinal;   // normal para dentro
    const n = Math.floor(L / espaco);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const p = [ax + (bx - ax) * t + nx * recuo, az + (bz - az) * t + nz * recuo];
      if (dentro(p, poli)) out.push(p);
    }
  }
  return out;
}

// Gerador pseudoaleatório com semente (mulberry32): a maquete sai igual em todo aparelho.
export function aleatorio(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pontosDentro(poli, n, semente) {
  if (Math.abs(areaAssinada(poli)) < 1e-6) return [];
  const xs = poli.map(p => p[0]), zs = poli.map(p => p[1]);
  const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const r = aleatorio(semente), out = [];
  for (let tent = 0; out.length < n && tent < n * 50; tent++) {
    const p = [x0 + r() * (x1 - x0), z0 + r() * (z1 - z0)];
    if (dentro(p, poli)) out.push(p);
  }
  return out;
}

export const foraDe = (pontos, poligonos) => pontos.filter(p => !poligonos.some(poli => dentro(p, poli)));

// Cores do entorno inspiradas nas fotos de drone do bairro: casas baixas com telhado cerâmico, prédios com laje clara.
const PAREDES = ['#EFEBE3', '#E9E2D2', '#F1E6C9', '#E6DCD3', '#DCE2E2', '#EADBC8', '#F4F1EA'];
const TELHAS = ['#B5643F', '#A85A3A', '#C07650', '#9E5B41'];
export function corDoPredio(altura, i) {
  const h = Math.abs(Math.imul(i + 1, 2654435761)) >>> 0;
  const baixa = altura <= 9;
  return {
    parede: PAREDES[h % PAREDES.length],
    telhado: baixa ? TELHAS[(h >>> 8) % TELHAS.length] : '#C9C7C2',
  };
}
