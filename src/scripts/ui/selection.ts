import { $$, store, toast } from './dom';

/** Sélection de produits (favoris) — mémorisée dans le navigateur, envoyée avec la demande de devis. */
export type SelItem = { slug: string; title: string; url: string; image?: string; quote?: string };
const S = store<SelItem[]>('bdf-selection', []);

export const selection = {
  all: () => S.get(),
  has: (slug: string) => S.get().some((i) => i.slug === slug),
  add(item: SelItem) {
    const list = S.get().filter((i) => i.slug !== item.slug);
    list.push(item);
    S.set(list);
    sync();
  },
  remove(slug: string) {
    S.set(S.get().filter((i) => i.slug !== slug));
    sync();
  },
  clear() {
    S.set([]);
    sync();
  },
};

function sync() {
  const n = S.get().length;
  $$('[data-selection-count]').forEach((el) => {
    el.textContent = String(n);
    el.hidden = n === 0;
  });
  $$<HTMLButtonElement>('[data-fav]').forEach((b) => {
    const on = selection.has(b.dataset.fav!);
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('is-on', on);
    const lbl = b.querySelector('[data-fav-label]');
    if (lbl) lbl.textContent = on ? 'Dans ma sélection' : 'Ajouter à ma sélection';
  });
  document.dispatchEvent(new CustomEvent('selection:change', { detail: S.get() }));
}

export function initSelection() {
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-fav]');
    if (!b) return;
    e.preventDefault();
    const slug = b.dataset.fav!;
    if (selection.has(slug)) {
      selection.remove(slug);
      toast('Retiré de votre sélection');
    } else {
      selection.add({ slug, title: b.dataset.title || slug, url: b.dataset.url || '#', image: b.dataset.image, quote: b.dataset.quote });
      toast('Ajouté à votre sélection · <a href="/selection">Voir</a>');
    }
  });
  window.addEventListener('storage', (e) => e.key === 'bdf-selection' && sync());
  sync();
}
