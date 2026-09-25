import { $, $$, hasWebGL, isLite, isTouch, reducedMotion, runtime } from '../ui/dom';

const can3D = () => hasWebGL() && !isLite() && runtime().features?.enable3D !== false;

/** Exécute fn quand l'élément approche de l'écran. */
function whenNear(el: Element, fn: () => void, margin = '300px') {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin: margin },
  );
  io.observe(el);
}

/** Progression 0→1 d'une section « sticky » en fonction du défilement. */
function sectionProgress(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
}

// ======================================================================= HÉRO
function initHero() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const canvas = $<HTMLCanvasElement>('[data-hero-canvas]', hero)!;
  const content = $('[data-hero-content]', hero)!;
  const hint = $('[data-hero-hint]', hero);
  const bar = $('[data-hero-bar]', hero);
  const steps = $$('[data-step]', hero);
  const tags = $$('[data-anchor]', hero);
  const welcome = $('[data-hero-welcome]', hero);
  let api: import('../three/hero-scene').HeroApi | null = null;

  if (can3D()) {
    import('../three/hero-scene').then(({ createHero }) => {
      api = createHero(canvas, { skipIntro: runtime().features?.introAnimation === false });
      hero.classList.add('is-3d');
      api.intro(() => hero.classList.add('hud-on'));
      if (reducedMotion()) hero.classList.add('hud-on');
    });
  } else {
    canvas.remove();
    hero.classList.add('no-3d');
    hero.style.height = 'auto';
  }

  let p = 0;
  const onScroll = () => {
    p = sectionProgress(hero);
    api?.setProgress(p);
    const f = Math.min(1, p * 3.2);
    content.style.opacity = String(1 - f);
    content.style.transform = `translate3d(0, ${-f * 60}px, 0)`;
    content.style.pointerEvents = f > 0.6 ? 'none' : '';
    if (hint) hint.style.opacity = String(1 - Math.min(1, p * 8));
    bar?.style.setProperty('--hp', String(Math.max(0.02, p)));
    const idx = p < 0.04 ? 0 : p < 0.24 ? 1 : p < 0.72 ? 2 : 3;
    steps.forEach((s, i) => s.classList.toggle('is-on', i <= idx));
    welcome?.style.setProperty('--wo', String(Math.min(1, Math.max(0, (p - 0.74) / 0.16))));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // étiquettes HUD accrochées à la 3D
  if (!isTouch()) {
    const tick = () => {
      requestAnimationFrame(tick);
      if (!api || p > 0.05 || !hero.classList.contains('hud-on')) {
        tags.forEach((t) => (t.style.opacity = '0'));
        return;
      }
      const a = api.anchors();
      const map = Object.fromEntries(a.map((x) => [x.id, x]));
      tags.forEach((t) => {
        const q = map[t.dataset.anchor!];
        if (!q || !q.visible) return;
        t.style.setProperty('--x', `${q.x}px`);
        t.style.setProperty('--y', `${q.y}px`);
        t.style.opacity = '1';
      });
    };
    requestAnimationFrame(tick);
  }
}

// ======================================================================= GAMMES (rail horizontal)
function initRanges() {
  const sec = $('[data-ranges]');
  if (!sec) return;
  const track = $('[data-ranges-track]', sec)!;
  const cards = $$('[data-rcard]', sec);
  const idxEl = $('[data-ranges-idx]', sec);
  const bar = $('[data-ranges-bar]', sec);
  const native = () => window.innerWidth < 900 || isTouch() || reducedMotion();
  let dist = 0;

  const measure = () => {
    if (native()) {
      sec.classList.add('is-native');
      sec.style.removeProperty('--rh');
      track.style.transform = '';
      return;
    }
    sec.classList.remove('is-native');
    dist = Math.max(0, track.scrollWidth - window.innerWidth);
    sec.style.setProperty('--rh', `${window.innerHeight + dist}px`);
  };
  const update = () => {
    if (native()) return;
    const p = sectionProgress(sec);
    track.style.transform = `translate3d(${-p * dist}px,0,0)`;
    bar?.style.setProperty('--rp', String(Math.max(0.04, p)));
    const cx = window.innerWidth / 2;
    let best = 0,
      bestD = Infinity;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = (r.left + r.width / 2 - cx) / window.innerWidth;
      c.style.setProperty('--cry', `${(-d * 28).toFixed(2)}deg`);
      c.style.setProperty('--crz', `${(-Math.abs(d) * 160).toFixed(1)}px`);
      if (Math.abs(d) < bestD) {
        bestD = Math.abs(d);
        best = i;
      }
    });
    if (idxEl) idxEl.textContent = String(Math.min(best + 1, cards.length - 1)).padStart(2, '0');
  };
  measure();
  update();
  window.addEventListener('resize', () => {
    measure();
    update();
  });
  window.addEventListener('scroll', update, { passive: true });
}

// ======================================================================= ANATOMIE (vue éclatée)
function initAnatomy() {
  const sec = $('[data-anatomy]');
  if (!sec) return;
  const canvas = $<HTMLCanvasElement>('[data-anatomy-canvas]', sec)!;
  const label = $('[data-anatomy-label]', sec);
  const steps = $$('[data-astep]', sec);
  const toggle = $('[data-anatomy-toggle]', sec);
  let api: { setExplode: (v: number) => void; setFocus: (id: string) => void } | null = null;
  let manual: number | null = null;
  let current = '';

  if (can3D()) {
    whenNear(sec, () =>
      import('../three/anatomy-scene').then(({ createAnatomy }) => {
        api = createAnatomy(canvas);
        apply();
      }),
    );
  } else {
    canvas.remove();
    $('[data-anatomy-fallback]', sec)!.hidden = false;
  }

  const apply = () => {
    if (!api) return;
    const i = steps.findIndex((s) => s.dataset.astep === current);
    api.setFocus(current);
    api.setExplode(manual ?? (i < 0 ? 0 : 1));
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const el = e.target as HTMLElement;
          steps.forEach((s) => s.classList.toggle('is-active', s === el));
          current = el.dataset.astep || '';
          if (label) label.textContent = el.dataset.k || '';
          apply();
        }
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  steps.forEach((s) => io.observe(s));
  // sortie de section : on réassemble
  const io2 = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) {
        current = '';
        steps.forEach((s) => s.classList.remove('is-active'));
        apply();
      }
    },
    { threshold: 0 },
  );
  io2.observe($('.asteps', sec)!);
  toggle?.addEventListener('click', () => {
    const on = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(on));
    manual = on ? 1 : 0;
    apply();
  });
}

// ======================================================================= CARROUSEL 3D
function initCarousel() {
  const root = $('[data-featured]');
  if (!root) return;
  const car = $('[data-carousel]', root)!;
  const ring = $('[data-ring]', root)!;
  const items = $$('[data-citem]', root);
  const details = $$('[data-fitem]', root);
  const dots = $$<HTMLButtonElement>('[data-dot]', root);
  const n = items.length;
  if (!n) return;
  const step = 360 / n;
  let angle = 0;
  let target = 0;
  let vel = 0;
  let dragging = false;
  let lastX = 0;
  let active = -1;
  let idleT = performance.now();

  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    items.forEach((it, k) => it.classList.toggle('is-active', k === i));
    items.forEach((it, k) => it.setAttribute('tabindex', k === i ? '0' : '-1'));
    details.forEach((d, k) => (d.hidden = k !== i));
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
  };
  const goto = (i: number) => {
    const cur = Math.round(-target / step);
    let diff = (((i - cur) % n) + n) % n;
    if (diff > n / 2) diff -= n;
    target = -(cur + diff) * step;
    idleT = performance.now();
  };
  const loop = () => {
    requestAnimationFrame(loop);
    if (!dragging) {
      if (Math.abs(vel) > 0.01) {
        target += vel;
        vel *= 0.92;
        if (Math.abs(vel) < 0.05) {
          vel = 0;
          target = Math.round(target / step) * step;
        }
      }
      // défilement automatique doux
      if (!reducedMotion() && performance.now() - idleT > 5000) {
        target -= step;
        idleT = performance.now();
      }
    }
    angle += (target - angle) * 0.08;
    ring.style.setProperty('--angle', `${angle.toFixed(3)}deg`);
    const idx = ((Math.round(-angle / step) % n) + n) % n;
    setActive(idx);
  };
  requestAnimationFrame(loop);

  car.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    vel = 0;
    car.setPointerCapture(e.pointerId);
    idleT = performance.now();
  });
  car.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    target += dx * 0.25;
    vel = dx * 0.25;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(vel) < 0.5) target = Math.round(target / step) * step;
    idleT = performance.now();
  };
  car.addEventListener('pointerup', end);
  car.addEventListener('pointercancel', end);
  // un clic sur un élément latéral le ramène au centre ; sur l'élément actif, on suit le lien
  items.forEach((it, i) =>
    it.addEventListener('click', (e) => {
      if (Math.abs(vel) > 1) {
        e.preventDefault();
        return;
      }
      if (i !== active) {
        e.preventDefault();
        goto(i);
      }
    }),
  );
  $('[data-prev]', root)?.addEventListener('click', () => goto(active - 1));
  $('[data-next]', root)?.addEventListener('click', () => goto(active + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => goto(i)));
  car.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goto(active - 1);
    if (e.key === 'ArrowRight') goto(active + 1);
  });
}

// ======================================================================= RÉSEAU 3D
function initNetwork() {
  const sec = $('[data-network]');
  if (!sec) return;
  const canvas = $<HTMLCanvasElement>('[data-network-canvas]', sec)!;
  if (!can3D()) {
    canvas.remove();
    $('[data-network-fallback]', sec)!.hidden = false;
    return;
  }
  const data = JSON.parse($('[data-network-data]', sec)!.textContent || '{}');
  whenNear(sec, () =>
    import('../three/network-scene').then(({ createNetwork }) => {
      const api = createNetwork(canvas, data.pts, data.hq);
      const io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            api.grow();
            io.disconnect();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(canvas);
    }),
  );
}

initHero();
initRanges();
initAnatomy();
initCarousel();
initNetwork();
