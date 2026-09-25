import { $, $$ } from './dom';

export function initHeader() {
  const header = $('[data-header]');
  const progress = $('[data-scroll-progress]');
  const dock = $('[data-dock]');
  let lastY = window.scrollY;
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    header?.classList.toggle('is-scrolled', y > 40);
    // masque l'en-tête en descendant, le réaffiche en remontant
    const menuOpen = document.documentElement.classList.contains('menu-open');
    if (!menuOpen && header && !header.querySelector('.is-open')) {
      header.classList.toggle('is-hidden', y > 420 && y > lastY + 2);
      if (y < lastY - 2) header.classList.remove('is-hidden');
    }
    progress?.style.setProperty('--p', String(h > 0 ? Math.min(1, y / h) : 0));
    dock?.classList.toggle('is-visible', y > 600);
    lastY = y;
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

  // menus déroulants : survol (desktop) + clic/clavier
  const items = $$('[data-nav-item]').filter((li) => li.querySelector('[data-dropdown]'));
  let closeTimer: number | undefined;
  const closeAll = (except?: Element) => items.forEach((i) => i !== except && i.classList.remove('is-open'));
  items.forEach((li) => {
    const link = li.querySelector('a')!;
    li.addEventListener('mouseenter', () => {
      if (!matchMedia('(hover: hover)').matches) return;
      clearTimeout(closeTimer);
      closeAll(li);
      li.classList.add('is-open');
    });
    li.addEventListener('mouseleave', () => {
      if (!matchMedia('(hover: hover)').matches) return;
      closeTimer = window.setTimeout(() => li.classList.remove('is-open'), 160);
    });
    link.setAttribute('aria-haspopup', 'true');
    link.setAttribute('aria-expanded', 'false');
    link.addEventListener('click', (e) => {
      if (!matchMedia('(hover: hover)').matches && !li.classList.contains('is-open')) {
        e.preventDefault();
        closeAll(li);
        li.classList.add('is-open');
      }
    });
    link.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        closeAll(li);
        li.classList.add('is-open');
        (li.querySelector('[data-dropdown] a') as HTMLElement)?.focus();
      }
    });
    li.addEventListener('focusout', (e) => {
      if (!li.contains(e.relatedTarget as Node)) li.classList.remove('is-open');
    });
    const obs = new MutationObserver(() => link.setAttribute('aria-expanded', String(li.classList.contains('is-open'))));
    obs.observe(li, { attributes: true, attributeFilter: ['class'] });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-nav-item]')) closeAll();
  });

  // menu mobile
  const burger = $('[data-burger]');
  const menu = $('[data-mobile-menu]');
  const setMenu = (open: boolean) => {
    if (!burger || !menu) return;
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.documentElement.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add('is-open'));
      document.body.style.overflow = 'hidden';
      header?.classList.remove('is-hidden');
    } else {
      menu.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
      }, 350);
    }
  };
  burger?.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('menu-open')) setMenu(false);
  });
  menu?.addEventListener('click', (e) => {
    if ((e.target as Element).closest('a')) setMenu(false);
  });

  // bandeau d'annonce
  const ann = $('[data-announce]');
  if (ann) {
    const key = 'bdf-ann-' + (ann.textContent || '').trim().length;
    try {
      if (sessionStorage.getItem(key)) ann.remove();
    } catch {}
    $('[data-announce-close]')?.addEventListener('click', () => {
      ann.remove();
      try {
        sessionStorage.setItem(key, '1');
      } catch {}
    });
  }

  // retour en haut
  $$('[data-to-top]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const l = (window as any).__lenis;
      if (l) l.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }),
  );
}
