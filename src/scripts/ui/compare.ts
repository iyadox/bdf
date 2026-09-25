import { $, $$, escapeHtml, store, toast } from './dom';

export type CmpItem = { slug: string; title: string; image?: string };
const S = store<CmpItem[]>('bdf-compare', []);
export const MAX_COMPARE = 3;

export const compare = {
  all: () => S.get(),
  has: (slug: string) => S.get().some((i) => i.slug === slug),
  toggle(item: CmpItem, on?: boolean) {
    let list = S.get();
    const exists = list.some((i) => i.slug === item.slug);
    const want = on ?? !exists;
    if (want && !exists) {
      if (list.length >= MAX_COMPARE) {
        toast(`Vous pouvez comparer ${MAX_COMPARE} produits maximum`);
        return false;
      }
      list = [...list, item];
    } else if (!want) list = list.filter((i) => i.slug !== item.slug);
    S.set(list);
    render();
    return true;
  },
  clear() {
    S.set([]);
    render();
  },
};

export function render() {
  const list = S.get();
  $$<HTMLInputElement>('[data-compare]').forEach((i) => (i.checked = list.some((x) => x.slug === i.dataset.compare)));
  const bar = $('[data-cmpbar]');
  if (!bar) return;
  bar.hidden = list.length === 0;
  $('[data-cmp-n]', bar)!.textContent = String(list.length);
  $('[data-cmp-list]', bar)!.innerHTML = list
    .map(
      (i) =>
        `<li>${i.image ? `<img src="${i.image}" alt="">` : ''}<span>${escapeHtml(i.title)}</span><button type="button" data-cmp-rm="${i.slug}" aria-label="Retirer ${escapeHtml(i.title)}">×</button></li>`,
    )
    .join('');
  const go = $<HTMLAnchorElement>('[data-cmp-go]', bar)!;
  go.href = `/comparateur?p=${list.map((i) => i.slug).join(',')}`;
  go.classList.toggle('is-disabled', list.length < 2);
  document.documentElement.classList.toggle('has-cmpbar', list.length > 0);
}

export function initCompare() {
  document.addEventListener('change', (e) => {
    const i = e.target as HTMLInputElement;
    if (!i.matches?.('[data-compare]')) return;
    const ok = compare.toggle({ slug: i.dataset.compare!, title: i.dataset.title || '', image: i.dataset.image }, i.checked);
    if (!ok) i.checked = false;
  });
  document.addEventListener('click', (e) => {
    const rm = (e.target as Element).closest<HTMLElement>('[data-cmp-rm]');
    if (rm) compare.toggle({ slug: rm.dataset.cmpRm!, title: '' }, false);
    if ((e.target as Element).closest('[data-cmp-clear]')) compare.clear();
    const go = (e.target as Element).closest<HTMLAnchorElement>('[data-cmp-go]');
    if (go && S.get().length < 2) {
      e.preventDefault();
      toast('Sélectionnez au moins 2 produits à comparer');
    }
  });
  window.addEventListener('storage', (e) => e.key === 'bdf-compare' && render());
  render();
}
