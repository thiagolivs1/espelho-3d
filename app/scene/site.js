// Chão, lote, paisagismo do condomínio (vagas, grama, campinho, piscina, salões, muro, portaria e árvores) e entorno real.
import * as THREE from 'three';
import { toMeters, towerTransform } from './geometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pontosNoPerimetro, pontosDentro, foraDe, corDoPredio, dentro } from './paisagem.js';
import { criarArvores } from './arvores.js';

// ---------- texturas desenhadas em canvas, repetidas por metro ----------
function texturaCanvas(w, h, desenhar, [mx, mz]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  desenhar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / mx, 1 / mz);
  t.anisotropy = 8;
  return t;
}
const ruido = (g, w, h, cores, n) => { for (let i = 0; i < n; i++) { g.fillStyle = cores[i % cores.length]; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };

const TEX = {
  // 20 m × 16 m: duas fileiras de vagas de 2,5 m × 5 m e uma rua de 6 m
  vagas: () => texturaCanvas(256, 208, (g, w) => {
    g.fillStyle = '#74787B'; g.fillRect(0, 0, w, 208);
    ruido(g, w, 208, ['#6C7073', '#7C8083'], 1400);
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillRect(0, 0, w, 2); g.fillRect(0, 64, w, 2); g.fillRect(0, 128, w, 2);
    for (let x = 0; x < w; x += 32) { g.fillRect(x, 0, 2, 64); g.fillRect(x, 64, 2, 64); }
  }, [20, 16]),
  grama: () => texturaCanvas(128, 128, (g) => {
    g.fillStyle = '#7C9D50'; g.fillRect(0, 0, 128, 128);
    ruido(g, 128, 128, ['#6F9047', '#88A95B', '#759748'], 2600);
  }, [6, 6]),
  campo: () => texturaCanvas(128, 64, (g) => {
    g.fillStyle = '#4E9A45'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#58A44E'; g.fillRect(64, 0, 64, 64);
  }, [10, 10]),
  piso: () => texturaCanvas(64, 64, (g) => {
    g.fillStyle = '#DAD4C8'; g.fillRect(0, 0, 64, 64);
    ruido(g, 64, 64, ['#D2CBBE', '#E0DBD0'], 300);
    g.fillStyle = 'rgba(0,0,0,.07)'; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
  }, [2, 2]),
  pastilha: () => texturaCanvas(64, 64, (g) => {
    g.fillStyle = '#2E9FD3'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#4DB4E2';
    for (let i = 0; i < 64; i += 8) { g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); }
  }, [1, 1]),
  vidro: () => texturaCanvas(64, 64, (g) => {   // módulo de 4 m × 3,2 m: pilar branco e pano de vidro
    g.fillStyle = '#F2EFEA'; g.fillRect(0, 0, 64, 64);
    const grad = g.createLinearGradient(0, 10, 0, 60);
    grad.addColorStop(0, '#7F96A6'); grad.addColorStop(1, '#2C3A44');
    g.fillStyle = grad; g.fillRect(6, 10, 52, 50);
    g.fillStyle = '#F2EFEA'; g.fillRect(31, 10, 2, 50);
  }, [4, 3.2]),
  janelas: () => texturaCanvas(64, 64, (g) => {   // 3 m × 3 m de parede com uma janela; tingida pela cor de cada prédio
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#5E6870'; g.fillRect(20, 16, 24, 26);
    g.fillStyle = '#8A98A3'; g.fillRect(20, 16, 24, 8);
  }, [3, 3]),
};

const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, ...o });

function placa(pontosMetros, y, altura, material) {
  const forma = new THREE.Shape(pontosMetros.map(([x, z]) => new THREE.Vector2(x, -z)));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: altura, bevelEnabled: false }), material);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  m.castShadow = altura > 1;
  m.userData.solido = true;
  return m;
}

const centro = poli => [poli.reduce((s, p) => s + p[0], 0) / poli.length, poli.reduce((s, p) => s + p[1], 0) / poli.length];
const escalar = (poli, f) => { const [cx, cz] = centro(poli); return poli.map(([x, z]) => [cx + (x - cx) * f, cz + (z - cz) * f]); };

function textoNoChao(txt, x, z, ang, tamanho, cor = '#ffffff') {
  const fpx = 64, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `700 ${fpx}px Montserrat, Arial, sans-serif`;
  c.width = Math.ceil(g.measureText(txt).width) + 24;
  c.height = fpx * 1.5;
  const g2 = c.getContext('2d');
  g2.font = `700 ${fpx}px Montserrat, Arial, sans-serif`;
  g2.fillStyle = cor; g2.textBaseline = 'middle'; g2.textAlign = 'center';
  g2.fillText(txt, c.width / 2, c.height / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const largura = tamanho * c.width / c.height;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura, tamanho),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  const grupo = new THREE.Group();
  grupo.add(m);
  grupo.position.set(x, 0.2, z);
  grupo.rotation.y = ang;
  return grupo;
}

function cantosTorre(imp, t) {
  const { x, z, rotY } = towerTransform(imp, t), c = Math.cos(rotY), s = Math.sin(rotY);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => {
    const lx = i * (t.largura / 2 + 2), lz = j * (t.profundidade / 2 + 2);
    return [x + lx * c + lz * s, z - lx * s + lz * c];
  });
}

// Muro branco no contorno do lote, aberto na portaria; pórtico e guarita como no render da fachada.
function muroEPortaria(lote, portaria) {
  const g = new THREE.Group(), pecas = [], branco = mat({ color: '#EFECE6', roughness: 0.85 });
  for (let i = 0; i < lote.length; i++) {
    const [ax, az] = lote[i], [bx, bz] = lote[(i + 1) % lote.length];
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 3)), ang = Math.atan2(-(bz - az), bx - ax);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      if (portaria && Math.hypot(px - portaria[0], pz - portaria[1]) < 9) continue;
      const b = new THREE.BoxGeometry(L / n + 0.05, 2.4, 0.22);
      b.rotateY(ang); b.translate(px, 1.2, pz);
      pecas.push(b);
    }
  }
  if (pecas.length) {
    const muro = new THREE.Mesh(mergeGeometries(pecas), branco);
    muro.castShadow = true; muro.receiveShadow = true;
    g.add(muro);
  }
  if (portaria) {
    // alinha o pórtico com o lado do lote mais próximo
    let melhor = { d: Infinity, ang: 0, normal: [0, 1] };
    for (let i = 0; i < lote.length; i++) {
      const [ax, az] = lote[i], [bx, bz] = lote[(i + 1) % lote.length], L = Math.hypot(bx - ax, bz - az);
      const t = Math.max(0, Math.min(1, ((portaria[0] - ax) * (bx - ax) + (portaria[1] - az) * (bz - az)) / (L * L)));
      const d = Math.hypot(ax + (bx - ax) * t - portaria[0], az + (bz - az) * t - portaria[1]);
      if (d < melhor.d) melhor = { d, ang: Math.atan2(-(bz - az), bx - ax), dir: [(bx - ax) / L, (bz - az) / L] };
    }
    const p = new THREE.Group();
    const peca = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), branco); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; p.add(m); };
    peca(1.4, 7.6, 1.4, -7.4, 3.8, 0);
    peca(1.4, 7.6, 1.4, 7.4, 3.8, 0);
    peca(16.2, 1.3, 2.6, 0, 7.6, 0);
    peca(4.2, 3.2, 4.2, 10.5, 1.6, 2.8);                  // guarita
    const vidro = new THREE.Mesh(new THREE.BoxGeometry(4.25, 1.4, 4.25), mat({ color: '#3A4A55', roughness: 0.15 }));
    vidro.position.set(10.5, 1.9, 2.8); p.add(vidro);
    p.position.set(portaria[0], 0.15, portaria[1]);
    p.rotation.y = melhor.ang;
    g.add(p);
  }
  return g;
}

export function buildSite(pkg, entorno = null) {
  const imp = pkg.implantacao, M = p => toMeters(imp, p), group = new THREE.Group();

  const chao = new THREE.Mesh(new THREE.CircleGeometry(5000, 64), mat({ color: '#CFCAC0', roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  chao.userData.solido = true;
  group.add(chao);

  const lote = imp.lote.map(M);
  group.add(placa(lote, 0, 0.15, mat({ map: TEX.piso() })));
  const obstaculos = imp.torres.map(t => cantosTorre(imp, t)), verdes = [], palmeiras = [];
  const materiais = {
    garagem: mat({ map: TEX.vagas(), roughness: 0.95 }),
    verde: mat({ map: TEX.grama(), roughness: 1 }),
    quadra: mat({ map: TEX.campo(), roughness: 1 }),
  };
  imp.areas.forEach((a, i) => {
    const poli = a.poligono.map(M);
    if (a.tipo === 'agua') {
      group.add(placa(escalar(poli, 1.12), 0.15, 0.1, mat({ color: '#ECE7DC' })));   // borda de pedra; a água fica por cima
      group.add(placa(poli, 0.15, 0.17, mat({ map: TEX.pastilha(), roughness: 0.06, metalness: 0.05 })));
      obstaculos.push(escalar(poli, 1.15));
      palmeiras.push(...foraDe(pontosNoPerimetro(escalar(poli, 1.6), 11, 0.6), obstaculos));
    } else if (a.tipo === 'lazer') {
      const vidro = TEX.vidro();
      group.add(placa(escalar(poli, 0.97), 0.15, 3.0, [mat({ color: '#E9E5DD' }), mat({ map: vidro, roughness: 0.4 })]));
      group.add(placa(escalar(poli, 1.04), 3.15, 0.45, mat({ color: '#DADCDB', roughness: 0.7 })));
      obstaculos.push(escalar(poli, 1.1));
    } else {
      group.add(placa(poli, 0.15, 0.12, materiais[a.tipo] || mat({ color: '#DDD' })));
      if (a.tipo === 'verde') verdes.push([poli, i]);
      else obstaculos.push(poli);
    }
  });

  const portaria = imp.portaria ? M(imp.portaria.px) : null;
  group.add(muroEPortaria(lote, portaria));
  if (portaria) obstaculos.push(escalar([[portaria[0] - 9, portaria[1] - 6], [portaria[0] + 9, portaria[1] - 6], [portaria[0] + 9, portaria[1] + 6], [portaria[0] - 9, portaria[1] + 6]], 1));

  const copas = foraDe(pontosNoPerimetro(lote, 8, 2.6), obstaculos);
  for (const [poli, i] of verdes) copas.push(...foraDe(pontosDentro(poli, Math.max(2, Math.round(areaDe(poli) / 90)), 11 + i), obstaculos));
  if (portaria) for (const dx of [-11, 11]) palmeiras.push([portaria[0] + dx, portaria[1] + 1.5]);
  group.add(criarArvores(copas.filter(p => dentro(p, lote)), { tipo: 'copa', semente: 3 }));
  group.add(criarArvores(palmeiras.filter(p => dentro(p, lote)), { tipo: 'palmeira', semente: 5 }));

  if (entorno) { group.add(buildEntorno(entorno)); return group; }

  // Sem entorno real: as duas ruas desenhadas à mão no pacote (comportamento da Fase 1).
  for (const r of imp.ruas) {
    const [a, b] = r.linha.map(M), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = -dz / L * r.largura / 2, nz = dx / L * r.largura / 2;
    group.add(placa([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], 0.01, 0.05, mat({ color: '#6E7174' })));
    group.add(textoNoChao(r.nome.toUpperCase(), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx), r.largura * 0.28));
  }
  return group;
}

const areaDe = poli => Math.abs(poli.reduce((s, [x1, z1], i) => { const [x2, z2] = poli[(i + 1) % poli.length]; return s + x1 * z2 - x2 * z1; }, 0) / 2);

// ---------- entorno real (OpenStreetMap): cada tipo vira UMA malha mesclada, para não pesar no celular ----------
function geometriaPlaca(pts, y, altura) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: altura, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function malhaMesclada(geoms, material, { sombra = false, solido = false } = {}) {
  if (!geoms.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geoms, false), material);
  geoms.forEach(g => g.dispose());
  m.castShadow = sombra; m.receiveShadow = true; m.userData.solido = solido;
  return m;
}

// Paredes (com janelas, tingidas pela cor de cada prédio) e telhados separados.
function predios(lista) {
  const paredes = { pos: [], uv: [], cor: [] }, telhados = [], c = new THREE.Color();
  lista.forEach((p, i) => {
    const cores = corDoPredio(p.altura, i), pts = p.pts[0][0] === p.pts.at(-1)[0] && p.pts[0][1] === p.pts.at(-1)[1] ? p.pts.slice(0, -1) : p.pts;
    if (pts.length < 3) return;
    c.set(cores.parede);
    let u = 0;
    for (let k = 0; k < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length], L = Math.hypot(bx - ax, bz - az), h = p.altura;
      const v = [[ax, 0, az, u, 0], [bx, 0, bz, u + L, 0], [bx, h, bz, u + L, h], [ax, 0, az, u, 0], [bx, h, bz, u + L, h], [ax, h, az, u, h]];
      for (const [x, y, z, uu, vv] of v) { paredes.pos.push(x, y, z); paredes.uv.push(uu, vv); paredes.cor.push(c.r, c.g, c.b); }
      u += L;
    }
    const teto = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
    teto.rotateX(-Math.PI / 2); teto.translate(0, p.altura, 0);
    c.set(cores.telhado);
    teto.setAttribute('color', new THREE.Float32BufferAttribute(new Array(teto.attributes.position.count).fill(0).flatMap(() => [c.r, c.g, c.b]), 3));
    telhados.push(teto);
  });
  const gp = new THREE.BufferGeometry();
  gp.setAttribute('position', new THREE.Float32BufferAttribute(paredes.pos, 3));
  gp.setAttribute('uv', new THREE.Float32BufferAttribute(paredes.uv, 2));
  gp.setAttribute('color', new THREE.Float32BufferAttribute(paredes.cor, 3));
  gp.computeVertexNormals();
  const mParedes = new THREE.Mesh(gp, mat({ map: TEX.janelas(), vertexColors: true, side: THREE.DoubleSide }));
  mParedes.castShadow = true; mParedes.receiveShadow = true; mParedes.userData.solido = true;
  return [mParedes, malhaMesclada(telhados, mat({ vertexColors: true }), { solido: true })];
}

function buildEntorno(ent) {
  const g = new THREE.Group();
  const faixa = (v, larg, y, alt) => {
    const out = [];
    for (let i = 0; i < v.pts.length - 1; i++) {
      const [a, b] = [v.pts[i], v.pts[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 0.5) continue;
      const nx = -dz / L * larg / 2, nz = dx / L * larg / 2;
      out.push(geometriaPlaca([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], y, alt));
    }
    return out;
  };
  const verdes = ent.verde.filter(p => p.pts.length > 2);
  const partes = [
    malhaMesclada(ent.vias.flatMap(v => faixa(v, v.largura + 3.5, 0.015, 0.03)), mat({ color: '#D7D2C7' })),
    malhaMesclada(ent.vias.flatMap(v => faixa(v, v.largura, 0.03, 0.04)), mat({ color: '#6A6E72', roughness: 0.95 })),
    malhaMesclada(verdes.map(p => geometriaPlaca(p.pts, 0.01, 0.06)), mat({ color: '#8DAA63' })),
    malhaMesclada(ent.agua.filter(p => p.pts.length > 2).map(p => geometriaPlaca(p.pts, 0.01, 0.08)), mat({ color: '#4E92AE', roughness: 0.1 })),
    ...predios(ent.predios.filter(p => p.pts.length > 2)),
  ];
  partes.filter(Boolean).forEach(m => g.add(m));
  // árvores nas praças e parques (limite para não pesar)
  const copas = [];
  verdes.forEach((p, i) => { if (copas.length < 700) copas.push(...pontosDentro(p.pts, Math.min(40, Math.round(areaDe(p.pts) / 260)), 100 + i)); });
  g.add(criarArvores(copas.slice(0, 700), { tipo: 'copa', semente: 9 }));

  // Nomes das vias com nome: um por nome, no maior trecho.
  const porNome = new Map();
  for (const v of ent.vias) {
    if (!v.nome || v.largura < 7) continue;
    for (let i = 0; i < v.pts.length - 1; i++) {
      const [a, b] = [v.pts[i], v.pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 40 && (!porNome.has(v.nome) || porNome.get(v.nome).L < L)) porNome.set(v.nome, { a, b, L, largura: v.largura });
    }
  }
  for (const [nome, { a, b, largura }] of porNome) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    g.add(textoNoChao(nome.toUpperCase(), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx), Math.max(2.4, largura * 0.3)));
  }
  return g;
}
