// Renderer, câmera, controles de órbita, seleção e enquadramento.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { direcaoSol } from './sol.js';

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
    if (vista) sairVista();
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

  // Voa até um ponto do chão (arredores). distancia em metros.
  function frameTo({ x, z }, distancia = 200) {
    if (vista) sairVista();
    // Visão quase de cima, levemente do sul: o ponto e o condomínio cabem juntos na tela.
    const d = distancia * afastamento();
    irPara(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + 0.15 * d, 0.9 * d, z + 0.4 * d));
  }

  // Arredores: deixa afastar mais e empurra a névoa para longe.
  function setArredores(ligado) {
    controls.maxDistance = ligado ? 9000 : 650;
    scene.fog.near = ligado ? 2500 : 450;
    scene.fog.far = ligado ? 9000 : 1500;
    camera.far = ligado ? 12000 : 4000; camera.updateProjectionMatrix();
    pedir();
  }

  function focusUnit(mesh) {
    if (vista) sairVista();
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
  const cbs = { pick: [], hover: [], render: [] };
  let inicio = null, ultimo = null;
  canvas.addEventListener('pointerdown', ev => { inicio = [ev.clientX, ev.clientY]; ultimo = inicio; });
  canvas.addEventListener('pointerup', ev => {
    if (!vista && inicio && Math.hypot(ev.clientX - inicio[0], ev.clientY - inicio[1]) < 6) {
      const k = chaveEm(ev); cbs.pick.forEach(cb => cb(k));
    }
    inicio = null;
  });
  canvas.addEventListener('pointermove', ev => {
    if (vista) {               // na vista, arrastar gira o olhar
      if (inicio && ev.buttons) {
        vista.yaw -= (ev.clientX - ultimo[0]) * 0.004;
        vista.pitch = Math.max(-1.1, Math.min(0.5, vista.pitch + (ev.clientY - ultimo[1]) * 0.003));
        ultimo = [ev.clientX, ev.clientY];
        olharVista(); pedir();
      }
      return;
    }
    if (inicio && ev.buttons) return;
    const k = chaveEm(ev); cbs.hover.forEach(cb => cb(k, ev.clientX, ev.clientY));
  });

  // ---------- vista da unidade ----------
  let vista = null;
  const dirVista = () => new THREE.Vector3(Math.sin(vista.yaw) * Math.cos(vista.pitch), Math.sin(vista.pitch), Math.cos(vista.yaw) * Math.cos(vista.pitch));
  function olharVista() { camera.position.copy(vista.pos); camera.lookAt(vista.pos.clone().add(dirVista())); }
  function entrarVista(mesh, { aoSair } = {}) {
    tween = null;
    const centro = new THREE.Vector3(); mesh.getWorldPosition(centro);
    const normal = (mesh.userData.normal || new THREE.Vector3(0, 0, 1)).clone().transformDirection(mesh.parent.matrixWorld);
    const pos = centro.clone().add(normal.clone().multiplyScalar(mesh.scale.z / 2 + 0.6));
    pos.y = centro.y - mesh.scale.y / 2 + 1.5;
    vista = { pos, yaw: Math.atan2(normal.x, normal.z), pitch: -0.06, aoSair };
    controls.enabled = false;
    olharVista(); pedir();
  }
  function sairVista() {
    if (!vista) return;
    const alvo = vista.pos.clone().add(dirVista().multiplyScalar(30)), aoSair = vista.aoSair;
    vista = null;
    controls.target.copy(alvo); controls.enabled = true; controls.update();
    pedir();
    if (aoSair) aoSair();
  }
  addEventListener('keydown', ev => { if (ev.key === 'Escape' && vista) sairVista(); });
  const estadoVista = () => {
    if (!vista) return null;
    const d = dirVista();
    return { pos: [vista.pos.x, vista.pos.z], dir: [d.x, d.z] };
  };
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
    const mexeu = vista ? false : controls.update();   // true enquanto o amortecimento ainda move a câmera
    renderer.render(scene, camera);
    cbs.render.forEach(cb => cb());
    if (tween || mexeu) pedir();
  }
  controls.addEventListener('change', pedir);
  camera.position.set(95, 125, 205);
  pedir();

  // Sol: posição real (azimute/elevação) convertida para a cena; à noite fica só uma luz fraca.
  function setSol(pos, rotacaoGraus = 0) {
    const [x, y, z] = direcaoSol(pos, rotacaoGraus);
    sol.position.set(x * 160, Math.max(y * 160, 3), z * 160);
    sol.intensity = pos.elevacao > 0 ? 0.5 + 1.9 * Math.min(1, pos.elevacao / 35) : 0.12;
    pedir();
  }

  return {
    scene, camera, renderer, controls, frame, focusUnit, setSol, frameTo, setArredores,
    invalidate: pedir,
    setTowers: m => { towers = m; },
    onPick: cb => cbs.pick.push(cb),
    onHover: cb => cbs.hover.push(cb),
    onRender: cb => cbs.render.push(cb),
    // Ponto da cena → pixel no canvas; visivel = na frente da câmera e dentro da tela.
    projetar(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera), w = canvas.clientWidth, h = canvas.clientHeight;
      const px = (v.x + 1) / 2 * w, py = (1 - v.y) / 2 * h;
      return { x: px, y: py, visivel: v.z < 1 && px >= 0 && px <= w && py >= 0 && py <= h };
    },
    entrarVista, sairVista, estadoVista,
    emVista: () => !!vista,
    dispose: () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); },
  };
}
