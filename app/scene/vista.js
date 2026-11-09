// Contas da vista da unidade (puro). Cena: x = leste da prancha, z = sul da prancha.
import { towerTransform } from './geometry.js';

const RAD = Math.PI / 180;

// Cantos da lâmina de uma torre na cena (mesmo giro que building.js aplica).
export function cantosTorre(implantacao, t) {
  const { x, z, rotY } = towerTransform(implantacao, t), c = Math.cos(rotY), s = Math.sin(rotY), hl = t.largura / 2, hp = t.profundidade / 2;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [x + c * hl * i + s * hp * j, z - s * hl * i + c * hp * j]);
}

// Cada torre entra pelo centro e pelos 4 cantos: de uma coluna da ponta, a torre vizinha
// pode tomar meia vista com o centro fora do ângulo.
export function pontosDasTorres(implantacao) {
  return implantacao.torres.flatMap(t => {
    const { x, z } = towerTransform(implantacao, t), nome = `Torre ${t.numero}`;
    return [[x, z], ...cantosTorre(implantacao, t)].map(([px, pz]) => ({ nome, x: px, z: pz, numero: t.numero }));
  });
}

// Azimute na cena (a partir do norte da prancha, sentido horário) → azimute real, descontando o giro da prancha.
const azimuteReal = ([x, z], rotacaoGraus) => ((Math.atan2(x, -z) / RAD - rotacaoGraus) % 360 + 360) % 360;

export function orientacao(normal, rotacaoGraus = 0) {
  const a = azimuteReal(normal, rotacaoGraus);
  return ['norte', 'leste', 'sul', 'oeste'][Math.round(a / 90) % 4];
}

// No hemisfério sul perto do equador (Fortaleza, ~4°S) o sol passa ao norte de março a outubro.
export function textoSol(orient, latitude) {
  const sul = latitude < 0;
  return {
    norte: sul ? 'Fachada norte: sol direto de março a outubro' : 'Fachada norte: pouco sol direto',
    sul: sul ? 'Fachada sul: sol direto de outubro a março' : 'Fachada sul: sol direto o ano todo',
    leste: 'Fachada leste: sol da manhã',
    oeste: 'Fachada oeste: sol da tarde',
  }[orient];
}

export function noCampoDeVisao(pos, dir, pontos, aberturaGraus = 36) {
  const dl = Math.hypot(dir[0], dir[1]);
  return pontos
    .map(p => {
      const vx = p.x - pos[0], vz = p.z - pos[1], d = Math.hypot(vx, vz);
      const cos = d ? (vx * dir[0] + vz * dir[1]) / (d * dl) : -1;
      return { nome: p.nome, d, ang: Math.acos(Math.max(-1, Math.min(1, cos))) / RAD };
    })
    .filter(o => o.d > 0 && o.ang <= aberturaGraus)
    .sort((a, b) => a.d - b.d)
    .map(o => o.nome)
    .filter((nome, i, todos) => todos.indexOf(nome) === i);
}

export function cone(pos, dir, raio, aberturaGraus) {
  const l = Math.hypot(dir[0], dir[1]), ux = dir[0] / l, uz = dir[1] / l, h = (aberturaGraus / 2) * RAD;
  const gira = a => [pos[0] + (ux * Math.cos(a) - uz * Math.sin(a)) * raio, pos[1] + (ux * Math.sin(a) + uz * Math.cos(a)) * raio];
  return [[pos[0], pos[1]], gira(h), gira(-h)];
}
