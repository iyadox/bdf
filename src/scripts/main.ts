import { initReveal } from './ui/reveal';
import { initHeader } from './ui/header';
import { initSpotlight, initTilt, initMagnetic, initParallax } from './ui/effects';
import { initSelection } from './ui/selection';
import { initOpenStatus } from './ui/status';
import { initConsent } from './ui/consent';
import { initPalette } from './ui/palette';
import { initSmooth } from './ui/smooth';

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
