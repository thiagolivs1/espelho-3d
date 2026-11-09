// Chão, lote, áreas do condomínio e ruas com nome pintado no chão.
import * as THREE from 'three';
import { toMeters } from './geometry.js';

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

export function buildSite(pkg) {
  const imp = pkg.implantacao, M = p => toMeters(imp, p), group = new THREE.Group();

  const chao = new THREE.Mesh(new THREE.CircleGeometry(1400, 64), new THREE.MeshStandardMaterial({ color: '#D8D5CB', roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  chao.userData.solido = true;
  group.add(chao);

  group.add(placa(imp.lote.map(M), 0, 0.15, '#CBD5BE'));
  for (const a of imp.areas) group.add(placa(a.poligono.map(M), 0.15, ALTURA_AREA[a.tipo] ?? 0.1, COR_AREA[a.tipo] ?? '#DDD'));

  for (const r of imp.ruas) {
    const [a, b] = r.linha.map(M), dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = -dz / L * r.largura / 2, nz = dx / L * r.largura / 2;
    group.add(placa([[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]], 0.01, 0.05, '#8E8C88'));
    group.add(textoNoChao(r.nome.toUpperCase(), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(-dz, dx), r.largura * 0.28));
  }
  return group;
}
