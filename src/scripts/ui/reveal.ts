import { $$, reducedMotion } from './dom';

export function initReveal(root: ParentNode = document) {
  const els = $$('[data-reveal]', root);
  if (!('IntersectionObserver' in window) || reducedMotion()) {
    els.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
  }

  // compteurs animés : <span data-count="504" data-suffix="+">
  const counters = $$('[data-count]', root);
  const run = (el: HTMLElement) => {
    const target = parseFloat(el.dataset.count || '0');
    const dec = (el.dataset.count || '').includes('.') ? 1 : 0;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (reducedMotion()) {
      el.textContent = prefix + target.toLocaleString('fr-FR', { maximumFractionDigits: dec }) + suffix;
      return;
    }
    const dur = 1800;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 4);
      el.textContent = prefix + (target * e).toLocaleString('fr-FR', { maximumFractionDigits: dec, minimumFractionDigits: dec }) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const io2 = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            run(e.target as HTMLElement);
            io2.unobserve(e.target);
          }
      },
      { threshold: 0.4 },
    );
    counters.forEach((c) => io2.observe(c));
  } else counters.forEach(run);

  // Découpage de titres en lettres/mots animés : [data-split]
  $$('[data-split]', root).forEach((el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    const words = (el.textContent || '').trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent?.trim() || '');
    el.innerHTML = words
      .map(
        (w, i) =>
          `<span class="sw" aria-hidden="true"><span class="sw__i" style="--wi:${i}">${w}</span></span>`,
      )
      .join(' ');
  });
}
