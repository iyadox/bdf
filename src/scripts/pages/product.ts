import { $, $$, toast } from '../ui/dom';
import { initCompare } from '../ui/compare';

// galerie
const img = $<HTMLImageElement>('[data-viewer-img]');
const zoom = $<HTMLElement>('.viewer__zoom');
$$<HTMLButtonElement>('[data-thumb]').forEach((b) =>
  b.addEventListener('click', () => {
    if (!img) return;
    $$('[data-thumb]').forEach((x) => x.classList.toggle('is-on', x === b));
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = b.dataset.thumb!;
      img.style.opacity = '1';
      if (zoom) zoom.dataset.lightbox = b.dataset.thumb!;
    }, 180);
  }),
);

// onglets : défilement actif
const tabs = $$<HTMLAnchorElement>('[data-tab]');
if (tabs.length) {
  const secs = tabs.map((t) => document.getElementById(t.dataset.tab!)).filter(Boolean) as HTMLElement[];
  const nav = $('[data-ptabs] .ptabs__in');
  const setActive = (id: string) => {
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.classList.toggle('is-active', on);
      if (on && nav) nav.scrollTo({ left: t.offsetLeft - nav.clientWidth / 2 + t.clientWidth / 2, behavior: 'smooth' });
    });
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) setActive((e.target as HTMLElement).id);
    },
    { rootMargin: '-40% 0px -55% 0px' },
  );
  secs.forEach((s) => io.observe(s));
}

// partager
$('[data-share]')?.addEventListener('click', async (e) => {
  const b = e.currentTarget as HTMLElement;
  const data = { title: b.dataset.title || document.title, url: location.href };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(location.href);
      toast('Lien copié dans le presse-papiers');
    }
  } catch {
    /* partage annulé */
  }
});

// imprimer
$('[data-print]')?.addEventListener('click', () => window.print());

initCompare();
