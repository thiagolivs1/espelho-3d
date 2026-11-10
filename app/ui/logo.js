// O logo do pacote vem em JPG com o céu noturno ao fundo. Aqui o fundo escuro vira transparente
// (letras creme e cobre são claras; céu e árvores são escuros), para o logo pousar sobre o render e o vidro.
const cache = new Map();

export function logoRecortado(src) {
  if (cache.has(src)) return cache.get(src);
  const p = new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
        for (let i = 0; i < px.length; i += 4) {
          const m = Math.max(px[i], px[i + 1], px[i + 2]);
          const a = Math.min(1, Math.max(0, (m - 105) / 70));
          px[i + 3] = Math.round(a * a * (3 - 2 * a) * 255);
        }
        g.putImageData(d, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch { resolve(src); }      // sem canvas: fica o JPG original
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
  cache.set(src, p);
  return p;
}

// Só recorta quando o pacote avisa (logos.fundoEscuro): um logo escuro sobre fundo branco sumiria.
export const precisaRecorte = logos => logos?.fundoEscuro === true;

export function aplicarLogo(el, logos) {
  if (!el || !precisaRecorte(logos)) return;
  logoRecortado(el.getAttribute('src')).then(url => { el.src = url; el.classList.add('recortado'); });
}
