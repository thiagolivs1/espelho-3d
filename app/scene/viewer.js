// Renderer, câmera, controles de órbita, seleção e enquadramento.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createViewer(canvas, { fundo = '#E8EBE7' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(fundo);
  scene.fog = new THREE.Fog(fundo, 450, 1500);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);
  scene.add(new THREE.HemisphereLight(0xf6f7ff, 0xb9ae96, 1.4));
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.2);
  sol.position.set(-60, 140, 90);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 400 });
  sol.shadow.bias = -0.0005;
  scene.add(sol);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = 1.42;   // nunca abaixo do chão
  controls.minDistance = 12;
  controls.maxDistance = 650;
  controls.target.set(0, 12, 0);

  let towers = new Map();
  let tween = null;
  // Desenha só quando algo muda (câmera, animação, cores). Parada, a maquete não gasta bateria do celular.
  let raf = 0;
  const pedir = () => { if (!raf) raf = requestAnimationFrame(desenhar); };
  const irPara = (alvo, posicao) => {
    if (reduzMovimento()) { controls.target.copy(alvo); camera.position.copy(posicao); tween = null; pedir(); return; }
    tween = { t0: performance.now(), dur: 700, deAlvo: controls.target.clone(), dePos: camera.position.clone(), alvo, posicao };
    pedir();
  };

  // Tela em pé (celular) precisa de mais distância para caber o mesmo enquadramento.
  const afastamento = () => (camera.aspect < 0.9 ? 1.8 : 1);

  function frame(alvo = 'all') {
    const f = afastamento();
    if (alvo === 'all' || !towers.has(alvo)) {
      irPara(new THREE.Vector3(0, 12, 0), new THREE.Vector3(95 * f, 125 * f, 205 * f));
      return;
    }
    const t = towers.get(alvo);
    const fora = t.normalNorte.clone().negate();              // olha a fachada sul, com leve giro
    const pos = t.center.clone().add(fora.multiplyScalar(85 * f)).add(new THREE.Vector3(30 * f, 35 * f, 0));
    irPara(t.center.clone(), pos);
  }

  function focusUnit(mesh) {
    const alvo = new THREE.Vector3();
    mesh.getWorldPosition(alvo);
    const normal = (mesh.userData.normal || new THREE.Vector3(0, 0, 1)).clone().transformDirection(mesh.parent.matrixWorld);
    const f = afastamento();
    // Afasta pela fachada da unidade e sobe acima do lazer térreo, olhando levemente para baixo.
    irPara(alvo.clone(), alvo.clone().add(normal.multiplyScalar(58 * f)).add(new THREE.Vector3(0, 22 * f, 0)));
  }

  // Seleção: clique sem arrasto (< 6 px). Etiqueta: passar o mouse.
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const visivel = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  function chaveEm(ev) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(scene.children, true).find(h => visivel(h.object) && (h.object.userData.key || h.object.userData.solido));
    return hit && hit.object.userData.key ? hit.object.userData.key : null;
  }
  const cbs = { pick: [], hover: [] };
  let inicio = null;
  canvas.addEventListener('pointerdown', ev => { inicio = [ev.clientX, ev.clientY]; });
  canvas.addEventListener('pointerup', ev => {
    if (inicio && Math.hypot(ev.clientX - inicio[0], ev.clientY - inicio[1]) < 6) {
      const k = chaveEm(ev); cbs.pick.forEach(cb => cb(k));
    }
    inicio = null;
  });
  canvas.addEventListener('pointermove', ev => {
    if (inicio && ev.buttons) return;
    const k = chaveEm(ev); cbs.hover.forEach(cb => cb(k, ev.clientX, ev.clientY));
  });
  canvas.addEventListener('pointerleave', () => cbs.hover.forEach(cb => cb(null, 0, 0)));

  const ajustar = () => {
    const el = canvas.parentElement, w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pedir();
  };
  const ro = new ResizeObserver(ajustar);
  ro.observe(canvas.parentElement);
  ajustar();

  function desenhar(now) {
    raf = 0;
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(tween.deAlvo, tween.alvo, e);
      camera.position.lerpVectors(tween.dePos, tween.posicao, e);
      if (k === 1) tween = null;
    }
    const mexeu = controls.update();   // true enquanto o amortecimento ainda move a câmera
    renderer.render(scene, camera);
    if (tween || mexeu) pedir();
  }
  controls.addEventListener('change', pedir);
  camera.position.set(95, 125, 205);
  pedir();

  return {
    scene, camera, renderer, controls, frame, focusUnit,
    invalidate: pedir,
    setTowers: m => { towers = m; },
    onPick: cb => cbs.pick.push(cb),
    onHover: cb => cbs.hover.push(cb),
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); },
  };
}
