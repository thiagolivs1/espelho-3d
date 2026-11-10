// Árvores de copa e palmeiras instanciadas: centenas delas custam só duas chamadas de desenho por tipo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { aleatorio } from './paisagem.js';

function geometriaCopa() {
  const a = new THREE.IcosahedronGeometry(2.6, 1); a.translate(0, 4.7, 0);
  const b = new THREE.IcosahedronGeometry(1.9, 1); b.translate(1.4, 4.0, 0.7);
  const c = new THREE.IcosahedronGeometry(1.7, 1); c.translate(-1.2, 4.1, -0.8);
  return mergeGeometries([a, b, c]);
}

function geometriaPalma() {
  const folhas = [];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.BoxGeometry(3.6, 0.06, 0.6);
    f.translate(1.8, 0, 0);
    f.rotateZ(-0.3 - (i % 3) * 0.18);          // folhas caídas, em alturas diferentes
    f.rotateY((i * Math.PI * 2) / 9);
    f.translate(0, 9.2, 0);
    folhas.push(f);
  }
  return mergeGeometries(folhas);
}

const VERDES = { copa: ['#4F7A3A', '#5C8A40', '#466F35', '#6A9447', '#3F6631'], palmeira: ['#5E8A3A', '#6B9443', '#55803A'] };

export function criarArvores(pontos, { tipo = 'copa', semente = 1 } = {}) {
  const g = new THREE.Group();
  if (!pontos.length) return g;
  const palmeira = tipo === 'palmeira', r = aleatorio(semente), n = pontos.length;
  const geoTronco = palmeira ? new THREE.CylinderGeometry(0.14, 0.24, 9.2, 6) : new THREE.CylinderGeometry(0.16, 0.26, 3.6, 5);
  geoTronco.translate(0, palmeira ? 4.6 : 1.8, 0);
  const tronco = new THREE.InstancedMesh(geoTronco, new THREE.MeshStandardMaterial({ color: palmeira ? '#8C7D69' : '#6B5440', roughness: 1 }), n);
  const folhas = new THREE.InstancedMesh(palmeira ? geometriaPalma() : geometriaCopa(),
    new THREE.MeshStandardMaterial({ roughness: 0.85, side: palmeira ? THREE.DoubleSide : THREE.FrontSide }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), eixo = new THREE.Vector3(0, 1, 0), cor = new THREE.Color();
  pontos.forEach(([x, z], i) => {
    const e = 0.8 + r() * 0.5;
    q.setFromAxisAngle(eixo, r() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(e, e * (0.9 + r() * 0.25), e));
    tronco.setMatrixAt(i, m);
    folhas.setMatrixAt(i, m);
    folhas.setColorAt(i, cor.set(VERDES[tipo][Math.floor(r() * VERDES[tipo].length)]));
  });
  for (const im of [tronco, folhas]) {
    im.castShadow = true; im.receiveShadow = true;
    im.raycast = () => {};            // árvores não atrapalham o toque nas unidades
    im.computeBoundingSphere();
    g.add(im);
  }
  return g;
}
