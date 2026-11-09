// Coordenadas reais → cena (puro). Cena: origem no centroide do lote, x = leste da prancha, z = sul da prancha.
// origem.rotacaoGraus: quanto o norte real aparece girado, no sentido horário, em relação ao norte da prancha.
const RAD = Math.PI / 180;
const M_POR_GRAU_LAT = 110574, M_POR_GRAU_LON = 111320;

export function latLonParaLocal({ lat, lon }, origem) {
  const e = (lon - origem.lon) * M_POR_GRAU_LON * Math.cos(origem.lat * RAD);
  const n = (lat - origem.lat) * M_POR_GRAU_LAT;
  const r = (origem.rotacaoGraus || 0) * RAD, c = Math.cos(r), s = Math.sin(r);
  const x = e * c + n * s, nl = -e * s + n * c;
  return [x + 0, -nl + 0];
}

export function distanciaPontoPolilinha([px, pz], pts) {
  if (pts.length === 1) return Math.hypot(px - pts[0][0], pz - pts[0][1]);
  let menor = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], dx = x2 - x1, dz = z2 - z1, L2 = dx * dx + dz * dz;
    const t = L2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / L2)) : 0;
    menor = Math.min(menor, Math.hypot(px - (x1 + t * dx), pz - (z1 + t * dz)));
  }
  return menor;
}
