// Gera o entorno real (prédios, vias, água, verde e pontos de referência) a partir do OpenStreetMap.
// Uso: node tools/osm-entorno.mjs fantastique-prime-2/empreendimento.json fantastique-prime-2/entorno.json
// Só roda em tempo de build: o site nunca consulta a Overpass. Dados © colaboradores do OpenStreetMap (ODbL).
import { readFileSync, writeFileSync } from 'node:fs';
import { latLonParaLocal } from '../app/scene/geo.js';
import { toMeters } from '../app/scene/geometry.js';

const SERVIDORES = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://lz4.overpass-api.de/api/interpreter'];
const RAIO_ENTORNO = 450, RAIO_PONTOS = 3000, POR_CATEGORIA = 4;
const LARGURA_VIA = { primary: 14, secondary: 12, tertiary: 10, residential: 7, unclassified: 7, living_street: 5, service: 4 };

// Servidores públicos da Overpass ficam sobrecarregados (502/504/429): tenta cada um algumas vezes, com espera.
async function overpass(q) {
  const erros = [];
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    for (const url of SERVIDORES) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': 'espelho3d-build/1.0', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(q),
        });
        if (r.ok) {
          const j = await r.json();
          // Estouro de tempo na Overpass volta como 200 com "remark" e lista vazia: trata como falha.
          if (j.remark && /error|timed out|timeout/i.test(j.remark)) { erros.push(`${new URL(url).host}: ${j.remark.slice(0, 80)}`); continue; }
          return j.elements;
        }
        erros.push(`${new URL(url).host}: ${r.status}`);
      } catch (e) { erros.push(`${new URL(url).host}: ${e.message}`); }
    }
    await new Promise(res => setTimeout(res, 5000 * (tentativa + 1)));
  }
  throw new Error(`Overpass indisponível (${erros.join('; ')})`);
}

export function categoria(t) {
  if (/^(supermarket|mall)$/.test(t.shop || '')) return 'compras';
  if (/^(school|university|college)$/.test(t.amenity || '')) return 'escolas';
  if (/^(hospital|clinic)$/.test(t.amenity || '')) return 'saude';
  if (t.natural === 'beach' || t.leisure === 'park') return 'lazer';
  if (t.railway === 'station' || t.public_transport === 'station') return 'transporte';
  return null;
}

const r1 = v => Math.round(v * 10) / 10;
const dentro = ([x, z], poli) => {
  let c = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, zi] = poli[i], [xj, zj] = poli[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
};

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [entrada, saida] = process.argv.slice(2);
  const pkg = JSON.parse(readFileSync(entrada, 'utf8')), geo = pkg.geo;
  if (!geo) { console.error('empreendimento.json sem "geo"'); process.exit(1); }
  const L = ({ lat, lon }) => latLonParaLocal({ lat, lon }, geo).map(r1);
  const lote = pkg.implantacao.lote.map(p => toMeters(pkg.implantacao, p));
  const c = `${geo.lat},${geo.lon}`;

  const base = await overpass(`[out:json][timeout:60];(
    way["building"](around:${RAIO_ENTORNO},${c});
    way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|service)$"](around:${RAIO_ENTORNO},${c});
    way["natural"="water"](around:${RAIO_ENTORNO},${c});
    way["leisure"="park"](around:${RAIO_ENTORNO},${c});
    way["landuse"~"^(grass|recreation_ground)$"](around:${RAIO_ENTORNO},${c});
  );out geom tags;`);
  // Uma consulta pequena por categoria: a consulta única de 3 km estoura o tempo dos servidores públicos.
  const FILTROS = [
    'nwr["shop"~"^(supermarket|mall)$"]["name"]',
    'nwr["amenity"~"^(school|university|college)$"]["name"]',
    'nwr["amenity"~"^(hospital|clinic)$"]["name"]',
    'nwr["natural"="beach"]["name"]',
    'nwr["leisure"="park"]["name"]',
    'nwr["railway"="station"]["name"]',
  ];
  const pois = [];
  for (const f of FILTROS) pois.push(...await overpass(`[out:json][timeout:180];${f}(around:${RAIO_PONTOS},${c});out center tags;`));

  const predios = [], vias = [], agua = [], verde = [];
  for (const e of base) {
    if (!e.geometry || e.geometry.length < 2) continue;
    const pts = e.geometry.map(L), t = e.tags || {};
    if (t.building) {
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      if (dentro([cx, cz], lote)) continue;
      const altura = Number(t.height) || (Number(t['building:levels']) ? Number(t['building:levels']) * 3 : 6);
      predios.push({ pts, altura: r1(Math.min(altura, 120)) });
    } else if (t.highway) vias.push({ pts, largura: LARGURA_VIA[t.highway] || 6, nome: t.name || '' });
    else if (t.natural === 'water') agua.push({ pts });
    else verde.push({ pts });
  }

  const vistos = new Set(), porCat = {};
  for (const e of pois) {
    const t = e.tags || {}, cat = categoria(t), ll = e.center || (e.lat !== undefined ? { lat: e.lat, lon: e.lon } : null);
    if (!cat || !ll || vistos.has(t.name)) continue;
    vistos.add(t.name);
    const [x, z] = L(ll);
    (porCat[cat] ||= []).push({ nome: t.name, categoria: cat, x, z, distanciaM: Math.round(Math.hypot(x, z)) });
  }
  const pontos = Object.values(porCat).flatMap(l => l.sort((a, b) => a.distanciaM - b.distanciaM).slice(0, POR_CATEGORIA));
  if (!predios.length || !vias.length || !pontos.length) {
    console.error(`Resposta incompleta da Overpass (${predios.length} prédios, ${vias.length} vias, ${pontos.length} pontos); nada foi gravado. Rode de novo.`);
    process.exit(1);
  }

  const saidaJson = {
    fonte: '© colaboradores do OpenStreetMap (ODbL)', geradoEm: new Date().toISOString().slice(0, 10),
    raioM: RAIO_ENTORNO, predios, vias, agua, verde, pontos,
  };
  writeFileSync(saida, JSON.stringify(saidaJson) + '\n');
  console.log(`${predios.length} prédios, ${vias.length} vias, ${agua.length} água, ${verde.length} verde, ${pontos.length} pontos → ${saida}`);
}
