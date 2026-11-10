// Renderer, câmera, controles de órbita, seleção e enquadramento.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { direcaoSol } from './sol.js';

const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const HORIZONTE = '#C9D6E2';   // névoa da cor do horizonte: o chão some no céu sem emenda

export function createViewer(canvas, { margemDireita = () => 0 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(HORIZONTE);
  scene.fog = new THREE.Fog(HORIZONTE, 450, 1500);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 4000);

  // Céu físico (Sky do three) que acompanha a câmera; o mesmo céu ilumina os vidros pelo mapa de ambiente.
  const ceu = new Sky();
  ceu.scale.setScalar(4000);
  ceu.material.uniforms.turbidity.value = 3;
  ceu.material.uniforms.rayleigh.value = 2.8;
  ceu.material.uniforms.mieCoefficient.value = 0.003;
  ceu.material.uniforms.mieDirectionalG.value = 0.8;
  ceu.frustumCulled = false;
  ceu.onBeforeRender = (_r, _s, cam) => ceu.position.copy(cam.position);
  scene.add(ceu);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const cenaCeu = new THREE.Scene(), ceuAmbiente = new Sky();
  ceuAmbiente.scale.setScalar(100);
  Object.entries(ceu.material.uniforms).forEach(([k, u]) => { ceuAmbiente.material.uniforms[k].value = u.value; });
  cenaCeu.add(ceuAmbiente);
  let ambiente = null, esperaAmbiente = 0;
  const refazerAmbiente = () => {
    clearTimeout(esperaAmbiente);
    esperaAmbiente = setTimeout(() => {
      ceuAmbiente.material.uniforms.sunPosition.value.copy(ceu.material.uniforms.sunPosition.value);
      const novo = pmrem.fromScene(cenaCeu, 0, 1, 1000);
      scene.environment = novo.texture;
      scene.environmentIntensity = 0.3;
      if (ambiente) ambiente.dispose();
      ambiente = novo;
      pedir();
    }, 120);
  };

  scene.add(new THREE.HemisphereLight(0xdfe9f5, 0xb9ad96, 0.45));
  const sol = new THREE.DirectionalLight(0xfff1dc, 2.6);
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
  const irPara = (alvo, posicao, dur = 700) => {
    if (reduzMovimento()) { controls.target.copy(alvo); camera.position.copy(posicao); tween = null; pedir(); return; }
    tween = { t0: performance.now(), dur, deAlvo: controls.target.clone(), dePos: camera.position.clone(), alvo, posicao };
    pedir();
  };

  // Tela em pé (celular) precisa de mais distância para caber o mesmo enquadramento.
  let larguraUtil = 1;
  const afastamento = () => (larguraUtil < 0.9 ? 1.8 : 1);

  // Condomínio visto de perto do chão, com uma faixa de céu atrás das torres, como nos renders.
  const VISTA_GERAL = [new THREE.Vector3(0, 14, 0), new THREE.Vector3(105, 72, 225)];
  function frame(alvo = 'all', dur) {
    if (vista) sairVista();
    const f = afastamento();
    if (alvo === 'all' || !towers.has(alvo)) {
      irPara(VISTA_GERAL[0].clone(), VISTA_GERAL[1].clone().multiplyScalar(f > 1 ? 1.45 : 1), dur);   // em pé: torres maiores na tela
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

  // Painel flutuando à direita: o centro da cena vai para o meio da área livre (projeção deslocada).
  const ajustar = () => {
    const el = canvas.parentElement, w = el.clientWidth, h = el.clientHeight, p = Math.max(0, Math.min(margemDireita(), w * 0.6));
    renderer.setSize(w, h, false);
    camera.aspect = (w + p) / h;
    if (p) camera.setViewOffset(w + p, h, p, 0, w, h); else camera.clearViewOffset();
    larguraUtil = (w - p) / h;
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
  camera.position.copy(VISTA_GERAL[1]);
  controls.target.copy(VISTA_GERAL[0]);

  // Entrada depois da abertura: parte de longe e baixo e pousa na vista geral.
  function voarEntrada() {
    const f = afastamento();
    camera.position.set(-260 * f, 34 * f, 560 * f);
    controls.target.set(0, 40, 0);
    frame('all', 2400);
  }
  pedir();

  // Sol: posição real (azimute/elevação) convertida para a cena; à noite fica só uma luz fraca.
  const corBaixa = new THREE.Color('#FFC890'), corAlta = new THREE.Color('#FFF4E6');
  function setSol(pos, rotacaoGraus = 0) {
    const [x, y, z] = direcaoSol(pos, rotacaoGraus);
    sol.position.set(x * 160, Math.max(y * 160, 3), z * 160);
    const alto = Math.min(1, Math.max(0, pos.elevacao) / 35);
    sol.intensity = pos.elevacao > 0 ? 0.8 + 2.2 * alto : 0.15;
    sol.color.copy(corBaixa).lerp(corAlta, alto);
    ceu.material.uniforms.sunPosition.value.set(x, Math.max(y, 0.02), z);
    refazerAmbiente();
    pedir();
  }

  return {
    scene, camera, renderer, controls, frame, focusUnit, setSol, frameTo, setArredores,
    invalidate: pedir, voarEntrada, reajustar: ajustar,
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
