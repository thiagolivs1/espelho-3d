// Torres e unidades geradas a partir do pacote. A fachada de cada unidade segue os renders aprovados (fachada.js).
import * as THREE from 'three';
import { pisoAltura, towerTransform, unitBox, varianteFachada } from './geometry.js';
import { CORES_SITUACAO, corDaUnidade } from './cores.js';
import { criarTexturasFachada, criarGeometriasUnidade, texturaNucleo } from './fachada.js';

export { CORES_SITUACAO };

export function buildTowers(pkg, views) {
  const imp = pkg.implantacao, fach = pkg.cores.fachada;
  const h = pisoAltura(pkg.torres), niveis = pkg.torres.pavimentos, altura = niveis * h;
  const caixa = new THREE.BoxGeometry(1, 1, 1);
  const texturas = criarTexturasFachada(pkg.cores), geometrias = criarGeometriasUnidade();
  const matNucleo = new THREE.MeshStandardMaterial({ map: texturaNucleo(pkg.cores, niveis), roughness: 0.85 });
  const bloco = (g, mat, [w, hh, d], [x, y, z]) => {
    const m = new THREE.Mesh(caixa, mat);
    m.scale.set(w, hh, d); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; m.userData.solido = true;
    g.add(m); return m;
  };
  const claro = new THREE.MeshStandardMaterial({ color: fach.base, roughness: 0.85 });

  const group = new THREE.Group(), meshesByKey = new Map(), towers = new Map();
  const porTorre = new Map();
  for (const v of views) (porTorre.get(v.torre) || porTorre.set(v.torre, []).get(v.torre)).push(v);

  for (const t of imp.torres) {
    const g = new THREE.Group();
    const { x, z, rotY } = towerTransform(imp, t);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    g.userData.torre = t.numero;

    // núcleo de circulação: faixa branca no meio da fachada, subindo acima da cobertura; casa de máquinas e caixa d'água
    const xNucleo = unitBox(t, 3, 0, h).x + (unitBox(t, 2, 0, h).x - unitBox(t, 3, 0, h).x) / 2;
    bloco(g, matNucleo, [t.nucleo, altura + 3, t.profundidade - 0.1], [xNucleo, (altura + 3) / 2, 0]);
    bloco(g, claro, [9, 2.6, 7], [xNucleo, altura + 1.3, 0]);
    bloco(g, claro, [5, 2.2, 5], [xNucleo, altura + 3 + 1.1, 0]);

    for (const v of porTorre.get(t.numero) || []) {
      const b = unitBox(t, v.coluna, v.andar, h);
      const variante = varianteFachada({ coluna: v.coluna, andar: v.andar, pavimentos: niveis });
      const tx = texturas(variante);
      const m = new THREE.Mesh(geometrias(variante), new THREE.MeshStandardMaterial({ map: tx.real, roughnessMap: tx.rug, roughness: 1, metalness: 0 }));
      m.scale.set(b.w, h, b.d);
      m.position.set(b.x, v.andar * h + h / 2, b.z);
      m.castShadow = true; m.receiveShadow = true;
      m.userData = { key: v.key, normal: new THREE.Vector3(0, 0, b.z < 0 ? -1 : 1), texturas: tx };
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

// Unidade selecionada: acende na própria cor (a cor da situação continua a mesma) e ganha contorno na cor da marca,
// desenhado por cima de tudo.
let contorno = null;
export function destacarUnidade(mesh, liga, cor) {
  if (!contorno) {
    contorno = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.04, 1.04, 1.04)),
      new THREE.LineBasicMaterial({ color: cor, depthTest: false, transparent: true }));
    contorno.renderOrder = 10;
    contorno.raycast = () => {};
  }
  if (liga) mesh.material.emissive.copy(mesh.material.color); else mesh.material.emissive.set('#000000');
  mesh.material.emissiveIntensity = liga ? 0.5 : 1;
  if (liga) mesh.add(contorno);
  else if (contorno.parent === mesh) mesh.remove(contorno);
}

export function paintUnits(meshesByKey, views, modo, visiveis, cores) {
  for (const v of views) {
    const m = meshesByKey.get(v.key);
    if (!m) continue;
    const { cor, opacidade, mapa } = corDaUnidade(v, modo, visiveis, cores);
    m.material.color.set(cor);
    if (m.userData.texturas) m.material.map = m.userData.texturas[mapa];
    m.material.opacity = opacidade;
    m.material.transparent = opacidade < 1;
    m.material.depthWrite = opacidade === 1;
  }
}
