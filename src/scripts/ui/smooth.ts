import Lenis from 'lenis';
import { isLite, isTouch, reducedMotion } from './dom';

/** Défilement fluide (desktop uniquement, désactivé si « mouvement réduit » ou mode allégé). */
export function initSmooth() {
  if (reducedMotion() || isTouch() || isLite()) return null;
  const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, smoothWheel: true });
  (window as any).__lenis = lenis;
  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  // ancres internes
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#' || a.hasAttribute('data-to-top')) return;
    const t = document.querySelector(a.getAttribute('href')!);
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t as HTMLElement, { offset: -90 });
    history.replaceState(null, '', a.getAttribute('href'));
  });
  // les dialogues / menus bloquent le défilement
  const mo = new MutationObserver(() => {
    const locked = document.body.style.overflow === 'hidden' || !!document.querySelector('dialog[open]');
    locked ? lenis.stop() : lenis.start();
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: false });
  document.addEventListener('dialog:toggle', () => {
    document.querySelector('dialog[open]') ? lenis.stop() : lenis.start();
  });
  return lenis;
}
