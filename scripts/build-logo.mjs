// Génère le logo vectoriel BDF (SVG) à partir de la police Michroma (famille Microgramma/Eurostile).
// Usage : node scripts/build-logo.mjs  → public/brand/*.svg
import fs from 'node:fs';
import opentype from 'opentype.js';

const buf = fs.readFileSync('node_modules/@fontsource/michroma/files/michroma-latin-400-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

function textPath(str, x, y, size, spacing = 0) {
  let cx = x;
  const parts = [];
  for (const ch of str) {
    const g = font.charToGlyph(ch);
    const p = g.getPath(cx, y, size);
    parts.push(p.toPathData(2));
    cx += (g.advanceWidth / font.unitsPerEm) * size + spacing;
  }
  return { d: parts.join(''), width: cx - x - spacing };
}

// Hexagone (pointe en haut) centré en (50,50), rayon 48
const R = 48, CX = 50, CY = 50;
const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 180) * (60 * i - 90);
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});
const hexPts = hex.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ');
const [top, tr, br, bot, bl, tl] = hex;

// "BDF" centré dans l'hexagone
const bdfSize = 22.5;
const bdfMeasure = textPath('BDF', 0, 0, bdfSize, -0.6);
const bdf = textPath('BDF', CX - bdfMeasure.width / 2 + 0.6, CY + bdfSize * 0.355, bdfSize, -0.6);

const EMB = 2.6; // épaississement (graisse "extended black")
const cube = (id, text = '#ffffff') => `
  <defs>
    <linearGradient id="${id}L" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a5a8f"/><stop offset="1" stop-color="#00284a"/>
    </linearGradient>
    <linearGradient id="${id}R" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a78ad"/><stop offset=".55" stop-color="#0d4a7e"/><stop offset="1" stop-color="#043d6c"/>
    </linearGradient>
    <linearGradient id="${id}S" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <polygon points="${[top, bot, bl, tl].map((p) => p.join(',')).join(' ')}" fill="url(#${id}L)"/>
  <polygon points="${[top, tr, br, bot].map((p) => p.join(',')).join(' ')}" fill="url(#${id}R)"/>
  <polygon points="${hexPts}" fill="url(#${id}S)" opacity=".6"/>
  <polygon points="${hexPts}" fill="none" stroke="#7fb0da" stroke-opacity=".35" stroke-width="1"/>
  <path d="${bdf.d}" fill="${text}" stroke="${text}" stroke-width="${EMB * 1.25}" stroke-linejoin="miter"/>`;

// Marque seule (hexagone)
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="BDF">${cube('m')}</svg>`;

// Logo complet (hexagone + BLINDAGES / DE FRANCE)
const wSize = 34.5;
const l1 = textPath('BLINDAGES', 0, 0, wSize, -0.5);
const l2 = textPath('DE FRANCE', 0, 0, wSize, -0.5);
const wx = 108;
const full = (color, id) => {
  const a = textPath('BLINDAGES', wx, 44.5, wSize, -0.5);
  const b = textPath('DE FRANCE', wx, 85, wSize, -0.5);
  const W = Math.ceil(wx + Math.max(l1.width, l2.width) + 6);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 100" role="img" aria-label="Blindages de France">${cube(id)}
  <g fill="${color}" stroke="${color}" stroke-width="${EMB * 1.45}" stroke-linejoin="miter"><path d="${a.d}"/><path d="${b.d}"/></g></svg>`;
};

fs.mkdirSync('public/brand', { recursive: true });
fs.writeFileSync('public/brand/bdf-mark.svg', mark);
fs.writeFileSync('public/brand/logo-bdf-blanc.svg', full('#ffffff', 'w'));
fs.writeFileSync('public/brand/logo-bdf-bleu.svg', full('#043d6c', 'b'));
fs.writeFileSync('public/favicon.svg', mark);
console.log('ok', l1.width.toFixed(1), l2.width.toFixed(1));
