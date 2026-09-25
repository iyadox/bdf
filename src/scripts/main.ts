import { initReveal } from './ui/reveal';
import { initHeader } from './ui/header';
import { initSpotlight, initTilt, initMagnetic, initParallax } from './ui/effects';
import { initSelection } from './ui/selection';
import { initOpenStatus } from './ui/status';
import { initConsent } from './ui/consent';
import { initPalette } from './ui/palette';
import { initSmooth } from './ui/smooth';
import { initForms } from './ui/forms';

initSmooth();
initHeader();
initReveal();
initSpotlight();
initTilt();
initMagnetic();
initParallax();
initSelection();
initOpenStatus();
initConsent();
initPalette();
initForms();

// Grands titres : sur petit écran, réduit la taille si un mot très long dépasse
const fitHeadings = () => {
  const small = window.innerWidth <= 760;
  document.querySelectorAll<HTMLElement>('h1, h2, .h1, .h2').forEach((h) => {
    if (h.dataset.fit) h.style.fontSize = '';
    if (!small || !h.offsetWidth) return;
    let fs = parseFloat(getComputedStyle(h).fontSize);
    const min = fs * 0.62;
    let n = 0;
    const vw = document.documentElement.clientWidth;
    const over = () => h.scrollWidth > h.clientWidth + 1 || h.getBoundingClientRect().right > vw;
    while (over() && fs > min && n++ < 16) {
      fs *= 0.94;
      h.style.fontSize = `${fs}px`;
      h.dataset.fit = '1';
    }
  });
};
fitHeadings();
document.fonts?.ready.then(fitHeadings);
let fitT: number | undefined;
window.addEventListener('resize', () => {
  clearTimeout(fitT);
  fitT = window.setTimeout(fitHeadings, 200);
});

// Mode allégé (sans 3D) : mémorisé sur l'appareil du visiteur
document.querySelectorAll<HTMLButtonElement>('[data-lite-toggle]').forEach((b) => {
  const on = document.documentElement.classList.contains('lite');
  const state = b.querySelector('[data-lite-state]');
  if (state) state.textContent = on ? 'activé' : 'désactivé';
  b.setAttribute('aria-pressed', String(on));
  if (document.documentElement.classList.contains('no-3d')) b.hidden = true;
  b.addEventListener('click', () => {
    try {
      localStorage.setItem('bdf-lite', on ? '0' : '1');
    } catch {
      /* stockage indisponible */
    }
    location.reload();
  });
});

// Lightbox générique : [data-lightbox="url"]
document.addEventListener('click', (e) => {
  const t = (e.target as Element).closest<HTMLElement>('[data-lightbox]');
  if (!t) return;
  e.preventDefault();
  const src = t.dataset.lightbox!;
  const d = document.createElement('dialog');
  d.className = 'lightbox';
  d.innerHTML = `<button class="lightbox__x" aria-label="Fermer">×</button><img src="${src}" alt="${t.dataset.alt || ''}">`;
  document.body.appendChild(d);
  d.showModal();
  const close = () => {
    d.close();
    d.remove();
  };
  d.addEventListener('click', (ev) => {
    if (ev.target === d || (ev.target as Element).closest('.lightbox__x')) close();
  });
  d.addEventListener('close', () => d.remove());
});
