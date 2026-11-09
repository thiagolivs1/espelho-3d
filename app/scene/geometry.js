// Contas puras da maquete (metros). Mundo 3D: x = leste, z = sul, y = para cima.
// Implantação em pixels da imagem do PDF (x para a direita, y para baixo, norte para cima).

export const pisoAltura = torres => Math.round((torres.peDireito + torres.laje) * 1000) / 1000;

export function centroide(poli) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poli.length; i++) {
    const [x1, y1] = poli[i], [x2, y2] = poli[(i + 1) % poli.length], f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

export function toMeters(implantacao, [px, py]) {
  const [cx, cy] = centroide(implantacao.lote), m = implantacao.metrosPorPixel;
  return [(px - cx) * m + 0, (py - cy) * m + 0]; // "+ 0" troca -0 por 0
}

// giroGraus é medido na imagem (y para baixo): negativo = eixo subindo para a direita (anti-horário no mapa).
export function towerTransform(implantacao, torre) {
  const [x, z] = toMeters(implantacao, torre.centro);
  return { x, z, rotY: -torre.giroGraus * Math.PI / 180 };
}

// Lado norte, oeste→leste: 4 3 [núcleo] 2 1. Lado sul, oeste→leste: 5 6 [núcleo] 7 8.
const ORDEM = { 4: 0, 3: 1, 2: 2, 1: 3, 5: 0, 6: 1, 7: 2, 8: 3 };

export function unitBox(torreSpec, coluna, andar, alturaPiso) {
  const { largura, profundidade, nucleo } = torreSpec;
  const w = (largura - nucleo) / 4, d = profundidade / 2, h = alturaPiso - 0.12;
  const slot = ORDEM[coluna];
  const x = -largura / 2 + w / 2 + slot * w + (slot >= 2 ? nucleo : 0);
  const z = coluna <= 4 ? -profundidade / 4 : profundidade / 4;
  return { x, y: andar * alturaPiso + h / 2, z, w, h, d };
}
