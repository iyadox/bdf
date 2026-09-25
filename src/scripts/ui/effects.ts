import { $$, isTouch, reducedMotion } from './dom';

/** Halo lumineux qui suit la souris (.spot / [data-spot]) */
export function initSpotlight() {
  if (isTouch()) return;
  document.addEventListener(
    'pointermove',
    (e) => {
      const el = (e.target as Element)?.closest?.('[data-spot], .spot') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

/** Inclinaison 3D au survol : [data-tilt] (intensité via data-tilt="12") */
export function initTilt(root: ParentNode = document) {
  if (isTouch() || reducedMotion()) return;
  $$('[data-tilt]', root).forEach((el) => {
    if (el.dataset.tiltOn) return;
    el.dataset.tiltOn = '1';
    const max = parseFloat(el.dataset.tilt || '') || 10;
    let raf = 0;
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el.style.setProperty('--rx', `${(-cy * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(cx * max).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${50 + cx * 50}%`);
      el.style.setProperty('--gy', `${50 + cy * 50}%`);
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) raf = requestAnimationFrame(loop);
      else raf = 0;
    };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      el.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(loop);
    });
    el.addEventListener('pointerleave', () => {
      tx = 0;
      ty = 0;
      el.classList.remove('is-tilting');
      if (!raf) raf = requestAnimationFrame(loop);
    });
  });
}

/** Boutons « magnétiques » : [data-magnetic] */
export function initMagnetic() {
  if (isTouch() || reducedMotion()) return;
  $$('[data-magnetic]').forEach((el) => {
    const s = parseFloat(el.dataset.magnetic || '') || 0.25;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * s}px, ${y * s}px)`;
    });
    el.addEventListener('pointerleave', () => {
      el.style.transform = '';
    });
  });
}

/** Parallaxe légère : [data-parallax="0.2"] */
export function initParallax() {
  if (reducedMotion()) return;
  const els = $$('[data-parallax]');
  if (!els.length) return;
  let ticking = false;
  const update = () => {
    const vh = window.innerHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      const k = parseFloat(el.dataset.parallax || '0.15');
      const off = (r.top + r.height / 2 - vh / 2) * -k;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
    }
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}
