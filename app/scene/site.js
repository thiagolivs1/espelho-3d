// Chão, lote, áreas do condomínio e ruas com nome pintado no chão.
import * as THREE from 'three';
import { toMeters } from './geometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COR_AREA = { garagem: '#C4C0B6', lazer: '#E8E0D1', verde: '#9DB585', agua: '#5AB3C9' };
const ALTURA_AREA = { garagem: 0.1, lazer: 3.2, verde: 0.12, agua: 0.14 };

function placa(pontosMetros, y, altura, cor) {
  const forma = new THREE.Shape(pontosMetros.map(([x, z]) => new THREE.Vector2(x, -z)));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: altura, bevelEnabled: false }),
    new THREE.MeshStandardMaterial({ color: cor, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  m.castShadow = altura > 1;
  m.userData.solido = true;
  return m;
}

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

export function buildSite(pkg, entorno = null) {
  const imp = pkg.implantacao, M = p => toMeters(imp, p), group = new THREE.Group();

  const chao = new THREE.Mesh(new THREE.CircleGeometry(5000, 64), new THREE.MeshStandardMaterial({ color: '#D8D5CB', roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  chao.userData.solido = true;
  group.add(chao);

  group.add(placa(imp.lote.map(M), 0, 0.15, '#CBD5BE'));
  for (const a of imp.areas) group.add(placa(a.poligono.map(M), 0.15, ALTURA_AREA[a.tipo] ?? 0.1, COR_AREA[a.tipo] ?? '#DDD'));

  if (entorno) { group.add(buildEntorno(entorno)); return group; }

  // Sem entorno real: as duas ruas desenhadas à mão no pacote (comportamento da Fase 1).
  for (const r of imp.ruas) {
    const [a, b] = r.linha.map(M), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = -dz / L * r.largura / 2, nz = dx / L * r.largura / 2;
    group.add(placa([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], 0.01, 0.05, '#8E8C88'));
    group.add(textoNoChao(r.nome.toUpperCase(), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx), r.largura * 0.28));
  }
  return group;
}

// Entorno real (OpenStreetMap): cada tipo vira UMA malha mesclada, para não pesar no celular.
function geometriaPlaca(pts, y, altura) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))), { depth: altura, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

function malhaMesclada(geoms, cor, { sombra = false, solido = false } = {}) {
  if (!geoms.length) return null;
  const m = new THREE.Mesh(mergeGeometries(geoms, false), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.95 }));
  geoms.forEach(g => g.dispose());
  m.castShadow = sombra; m.receiveShadow = true; m.userData.solido = solido;
  return m;
}

function buildEntorno(ent) {
  const g = new THREE.Group();
  const faixas = [];
  for (const v of ent.vias) for (let i = 0; i < v.pts.length - 1; i++) {
    const [a, b] = [v.pts[i], v.pts[i + 1]], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 0.5) continue;
    const nx = -dz / L * v.largura / 2, nz = dx / L * v.largura / 2;
    faixas.push(geometriaPlaca([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], 0.02, 0.04));
  }
  const partes = [
    malhaMesclada(faixas, '#8E8C88'),
    malhaMesclada(ent.verde.filter(p => p.pts.length > 2).map(p => geometriaPlaca(p.pts, 0.01, 0.06)), '#A9BE93'),
    malhaMesclada(ent.agua.filter(p => p.pts.length > 2).map(p => geometriaPlaca(p.pts, 0.01, 0.08)), '#7FBFD0'),
    malhaMesclada(ent.predios.filter(p => p.pts.length > 2).map(p => geometriaPlaca(p.pts, 0, p.altura)), '#E4DED2', { sombra: true, solido: true }),
  ];
  partes.filter(Boolean).forEach(m => g.add(m));
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
