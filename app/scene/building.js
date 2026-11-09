// Torres e unidades geradas a partir do pacote.
import * as THREE from 'three';
import { pisoAltura, towerTransform, unitBox } from './geometry.js';
import { CORES_SITUACAO, corDaUnidade } from './cores.js';

export { CORES_SITUACAO };
const COR_TABELA = '#E9E3D7';

export function buildTowers(pkg, views) {
  const imp = pkg.implantacao, fach = pkg.cores.fachada;
  const h = pisoAltura(pkg.torres), niveis = pkg.torres.pavimentos, altura = niveis * h;
  const caixa = new THREE.BoxGeometry(1, 1, 1);
  const mat = cor => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.82 });
  const bloco = (g, cor, [w, hh, d], [x, y, z], solido = true) => {
    const m = new THREE.Mesh(caixa, mat(cor));
    m.scale.set(w, hh, d); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; m.userData.solido = solido;
    g.add(m); return m;
  };

  const group = new THREE.Group(), meshesByKey = new Map(), towers = new Map();
  const porTorre = new Map();
  for (const v of views) (porTorre.get(v.torre) || porTorre.set(v.torre, []).get(v.torre)).push(v);

  for (const t of imp.torres) {
    const g = new THREE.Group();
    const { x, z, rotY } = towerTransform(imp, t);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.userData.torre = t.numero;

    // núcleo de circulação, lajes e cobertura
    const xNucleo = unitBox(t, 3, 0, h).x + (unitBox(t, 2, 0, h).x - unitBox(t, 3, 0, h).x) / 2;
    bloco(g, fach.detalhe, [t.nucleo - 0.2, altura + 1.2, t.profundidade * 0.55], [xNucleo, (altura + 1.2) / 2, 0]);
    for (let n = 1; n <= niveis; n++) bloco(g, fach.base, [t.largura + 0.3, 0.12, t.profundidade + 0.3], [0, n * h - 0.06, 0], false);
    bloco(g, fach.base, [8, 3.2, 6.5], [xNucleo, altura + 1.6, 0]);         // casa de máquinas
    bloco(g, fach.faixa, [5, 2.4, 5], [xNucleo, altura + 3.2 + 1.2, 0]);    // caixa d'água

    for (const v of porTorre.get(t.numero) || []) {
      const b = unitBox(t, v.coluna, v.andar, h);
      const m = new THREE.Mesh(caixa, mat(COR_TABELA));
      m.scale.set(b.w - 0.25, b.h, b.d - 0.35);
      m.position.set(b.x, b.y, b.z);
      m.castShadow = true; m.receiveShadow = true;
      m.userData = { key: v.key, normal: new THREE.Vector3(0, 0, b.z < 0 ? -1 : 1) };
      g.add(m);
      meshesByKey.set(v.key, m);
    }
    group.add(g);
    towers.set(t.numero, {
      center: new THREE.Vector3(x, altura / 2, z),
      normalNorte: new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY),
    });
  }
  return { group, meshesByKey, towers };
}

export function paintUnits(meshesByKey, views, modo, visiveis, cores) {
  for (const v of views) {
    const m = meshesByKey.get(v.key);
    if (!m) continue;
    const { cor, opacidade } = corDaUnidade(v, modo, visiveis, cores);
    m.material.color.set(cor);
    m.material.opacity = opacidade;
    m.material.transparent = opacidade < 1;
    m.material.depthWrite = opacidade === 1;
  }
}
