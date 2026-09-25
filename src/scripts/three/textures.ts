import * as THREE from 'three';

/* Textures procédurales (générées dans le navigateur : aucun fichier à télécharger). */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

// bruit de valeur simple (déterministe)
function makeNoise(seed = 1) {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const N = 256;
  const perm = new Float32Array(N * N);
  for (let i = 0; i < perm.length; i++) perm[i] = rand();
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x),
      yi = Math.floor(y);
    const xf = smooth(x - xi),
      yf = smooth(y - yi);
    const g = (a: number, b: number) => perm[(((b % N) + N) % N) * N + (((a % N) + N) % N)];
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), xf), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), xf), yf);
  };
}

const cache = new Map<string, THREE.Texture>();

/** Normal map « acier brossé » (stries horizontales) */
export function brushedNormal(size = 512) {
  const key = 'brushed' + size;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);
  const noise = makeNoise(7);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x * 0.02, y * 1.7) * 0.7 + noise(x * 0.3, y * 3.1) * 0.3;
      const v = (n - 0.5) * 60;
      const i = (y * size + x) * 4;
      img.data[i] = 128;
      img.data[i + 1] = 128 + v;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Normal map « grenaillage » (peinture texturée) */
export function grainNormal(size = 512) {
  const key = 'grain' + size;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  const noise = makeNoise(3);
  const h = (x: number, y: number) => noise(x * 0.35, y * 0.35) * 0.6 + noise(x * 1.3, y * 1.3) * 0.4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const i = (y * size + x) * 4;
      img.data[i] = 128 + dx * 220;
      img.data[i + 1] = 128 + dy * 220;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

/** Texture bois (veinage vertical) teintée */
export function woodTexture(base: string, dark: string, size = 1024) {
  const key = `wood-${base}-${dark}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size / 2, size);
  const w = c.width,
    hh = c.height;
  const noise = makeNoise(11);
  const cb = new THREE.Color(base),
    cd = new THREE.Color(dark);
  const img = ctx.createImageData(w, hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const warp = noise(x * 0.01, y * 0.004) * 18 + noise(x * 0.05, y * 0.01) * 4;
      const ring = Math.sin((x + warp) * 0.22) * 0.5 + 0.5;
      const fine = noise(x * 0.8, y * 0.02);
      let t = Math.pow(ring, 3) * 0.55 + fine * 0.25 + noise(x * 0.02, y * 0.02) * 0.2;
      t = Math.min(1, Math.max(0, t));
      const col = cb.clone().lerp(cd, t);
      const i = (y * w + x) * 4;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Texture laine de roche (fibreuse, jaunâtre) */
export function woolTexture(size = 512) {
  const key = 'wool';
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = '#8a9096';
  ctx.fillRect(0, 0, size, size);
  const noise = makeNoise(5);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const n = noise(x * 0.9, y * 0.08) * 0.5 + noise(x * 0.1, y * 0.1) * 0.5;
      const i = (y * size + x) * 4;
      const k = 0.6 + n * 0.6;
      img.data[i] *= k;
      img.data[i + 1] *= k;
      img.data[i + 2] *= k * 0.9;
    }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}

/** Grille lumineuse au sol (lignes fines + dégradé radial) */
export function gridTexture(size = 1024, divisions = 16, color = '#2e6894', accent = '#4a7396') {
  const key = `grid-${divisions}-${color}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size, size);
  ctx.clearRect(0, 0, size, size);
  const step = size / divisions;
  for (let i = 0; i <= divisions; i++) {
    const major = i % 4 === 0;
    ctx.strokeStyle = major ? color : color + '66';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(i * step, 0);
    ctx.lineTo(i * step, size);
    ctx.moveTo(0, i * step);
    ctx.lineTo(size, i * step);
    ctx.stroke();
  }
  // petites croix aux intersections majeures
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  for (let i = 0; i <= divisions; i += 4)
    for (let j = 0; j <= divisions; j += 4) {
      const x = i * step,
        y = j * step;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}

/** Halo radial (sprites, lumières) */
export function glowTexture(inner = 'rgba(232,238,244,1)', outer = 'rgba(74, 115, 150, 0)', size = 256) {
  const key = `glow-${inner}-${outer}`;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Dégradé vertical (faisceaux lumineux) */
export function beamTexture(color = '232,238,244') {
  const key = 'beam' + color;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(64, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.5, `rgba(${color},0.9)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  const g2 = ctx.createLinearGradient(0, 0, 64, 0);
  g2.addColorStop(0, 'rgba(0,0,0,1)');
  g2.addColorStop(0.5, 'rgba(0,0,0,0)');
  g2.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Halo linéaire (lueur autour d'un tube LED) : dégradé transversal, constant en longueur. */
export function lineGlowTexture(color = '74,115,150') {
  const key = 'lineglow' + color;
  if (cache.has(key)) return cache.get(key)!;
  const [c, ctx] = canvas(8, 128);
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.5, `rgba(${color},1)`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}
