// Posição do sol (puro). Aproximação de Cooper para a declinação; sem equação do tempo (erro de poucos minutos).
const RAD = Math.PI / 180;

export const horaSolar = (horaLocal, longitude, fusoHoras = -3) => horaLocal + (longitude - fusoHoras * 15) / 15;

export function diaDoAno(data, fusoHoras = -3) {
  const local = new Date(data.getTime() + fusoHoras * 3600e3);
  const inicio = Date.UTC(local.getUTCFullYear(), 0, 1);
  return Math.floor((Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - inicio) / 864e5) + 1;
}

// Azimute a partir do norte, sentido horário; elevação acima do horizonte. Graus.
export function posicaoSol({ horaSolar: h, diaDoAno: n, latitude }) {
  const dec = 23.45 * Math.sin(RAD * (360 / 365) * (284 + n)) * RAD;
  const lat = latitude * RAD, H = 15 * (h - 12) * RAD;
  const elevacao = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) / RAD;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)) / RAD + 180;
  return { azimute: ((az % 360) + 360) % 360, elevacao };
}

// Direção (unitária) da cena até o sol: x = leste da prancha, z = sul da prancha, y = cima.
// rotacaoGraus: quanto o norte real está girado, no sentido horário, em relação ao norte da prancha.
export function direcaoSol({ azimute, elevacao }, rotacaoGraus = 0) {
  const a = (azimute + rotacaoGraus) * RAD, e = elevacao * RAD;
  const limpa = v => (Math.abs(v) < 1e-12 ? 0 : v);
  return [limpa(Math.sin(a) * Math.cos(e)), limpa(Math.sin(e)), limpa(-Math.cos(a) * Math.cos(e))];
}
