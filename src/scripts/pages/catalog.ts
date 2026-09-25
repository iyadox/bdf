import { $, $$, fold, store } from '../ui/dom';
import { initCompare } from '../ui/compare';
import { initTilt } from '../ui/effects';

const root = $('[data-catalog]');
if (root) {
  const grid = $('[data-grid]', root)!;
  const cards = $$('[data-product]', grid);
  const inputs = $$<HTMLInputElement>('[data-filter]', root);
  const q = $<HTMLInputElement>('[data-q]', root)!;
  const sort = $<HTMLSelectElement>('[data-sort]', root)!;
  const results = $('[data-results]', root)!;
  const plural = $('[data-plural]', root)!;
  const chips = $('[data-chips]', root)!;
  const empty = $('[data-empty]', root)!;
  const activeCount = $('[data-active-count]', root);
  const views = $$<HTMLButtonElement>('[data-view]', root);
  const viewStore = store<string>('bdf-view', 'grid');
  const KEYS = ['categorie', 'vantaux', 'certification', 'fermeture'] as const;
  type Key = (typeof KEYS)[number];
  const ATTR: Record<Key, string> = { categorie: 'cats', vantaux: 'vantaux', certification: 'certs', fermeture: 'fermetures' };
  const cardVals = new Map(
    cards.map((c) => [c, Object.fromEntries(KEYS.map((k) => [k, (c.dataset[ATTR[k]] || '').split('|').filter(Boolean)])) as Record<Key, string[]>]),
  );
  const labelOf = (k: string, v: string) => inputs.find((i) => i.dataset.filter === k && i.value === v)?.closest('label')?.querySelector('.fopt__label')?.textContent || v;

  // état initial depuis l'URL (compatible anciens liens ?certification=A2P+BP1)
  const params = new URLSearchParams(location.search);
  for (const k of KEYS) {
    const vals = params.getAll(k).flatMap((v) => v.split(','));
    inputs.filter((i) => i.dataset.filter === k).forEach((i) => (i.checked = vals.includes(i.value)));
  }
  q.value = params.get('q') || '';
  if (params.get('tri')) sort.value = params.get('tri')!;
  const setView = (v: string) => {
    grid.classList.toggle('is-list', v === 'list');
    views.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    viewStore.set(v);
  };
  setView(params.get('vue') || viewStore.get());

  const selected = () => Object.fromEntries(KEYS.map((k) => [k, inputs.filter((i) => i.dataset.filter === k && i.checked).map((i) => i.value)])) as Record<Key, string[]>;

  const matches = (c: HTMLElement, sel: Record<Key, string[]>, skip?: Key) => {
    const vals = cardVals.get(c)!;
    for (const k of KEYS) {
      if (k === skip || !sel[k].length) continue;
      if (!sel[k].some((v) => vals[k].includes(v))) return false;
    }
    const tokens = fold(q.value.trim()).split(/\s+/).filter(Boolean);
    if (tokens.length) {
      const hay = c.dataset.search || '';
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return true;
  };

  const apply = (push = true) => {
    const sel = selected();
    let n = 0;
    for (const c of cards) {
      const ok = matches(c, sel);
      c.hidden = !ok;
      if (ok) n++;
    }
    // compteurs à facettes
    for (const i of inputs) {
      const k = i.dataset.filter as Key;
      const cnt = cards.filter((c) => matches(c, sel, k) && cardVals.get(c)![k].includes(i.value)).length;
      const el = root.querySelector(`[data-count-for="${CSS.escape(`${k}::${i.value}`)}"]`);
      if (el) el.textContent = String(cnt);
      i.disabled = cnt === 0 && !i.checked;
    }
    KEYS.forEach((k) => {
      const el = root.querySelector(`[data-sel-count="${k}"]`);
      if (el) el.textContent = sel[k].length ? String(sel[k].length) : '';
    });
    // tri
    const mode = sort.value;
    const sorted = [...cards].sort((a, b) => {
      if (mode === 'az') return (a.dataset.title || '').localeCompare(b.dataset.title || '', 'fr', { numeric: true });
      if (mode === 'za') return (b.dataset.title || '').localeCompare(a.dataset.title || '', 'fr', { numeric: true });
      if (mode === 'certif') {
        const ca = (a.dataset.certs || '').includes('Sans') || !a.dataset.certs ? 1 : 0;
        const cb = (b.dataset.certs || '').includes('Sans') || !b.dataset.certs ? 1 : 0;
        if (ca !== cb) return ca - cb;
      }
      return +(a.dataset.order || 0) - +(b.dataset.order || 0);
    });
    sorted.forEach((c) => grid.appendChild(c));
    results.textContent = String(n);
    plural.textContent = n > 1 ? 's' : '';
    empty.hidden = n > 0;
    // pastilles de filtres actifs
    const act: string[] = [];
    KEYS.forEach((k) => sel[k].forEach((v) => act.push(`<button type="button" data-chip="${k}::${v}">${labelOf(k, v)} <span aria-hidden="true">×</span><span class="sr-only">Retirer</span></button>`)));
    if (q.value.trim()) act.push(`<button type="button" data-chip="q">« ${q.value.trim().replace(/</g, '')} » <span aria-hidden="true">×</span></button>`);
    chips.innerHTML = act.join('');
    const total = KEYS.reduce((s, k) => s + sel[k].length, 0) + (q.value.trim() ? 1 : 0);
    if (activeCount) {
      activeCount.textContent = String(total);
      activeCount.hidden = total === 0;
    }
    // URL partageable
    if (push) {
      const p = new URLSearchParams();
      KEYS.forEach((k) => sel[k].forEach((v) => p.append(k, v)));
      if (q.value.trim()) p.set('q', q.value.trim());
      if (sort.value !== 'pertinence') p.set('tri', sort.value);
      const qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }
  };

  inputs.forEach((i) => i.addEventListener('change', () => apply()));
  let t: number | undefined;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = window.setTimeout(() => apply(), 120);
  });
  sort.addEventListener('change', () => apply());
  views.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view!)));
  chips.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-chip]');
    if (!b) return;
    const v = b.dataset.chip!;
    if (v === 'q') q.value = '';
    else {
      const [k, val] = v.split('::');
      const i = inputs.find((x) => x.dataset.filter === k && x.value === val);
      if (i) i.checked = false;
    }
    apply();
  });
  $$('[data-reset]', root).forEach((b) =>
    b.addEventListener('click', () => {
      inputs.forEach((i) => (i.checked = false));
      q.value = '';
      sort.value = 'pertinence';
      apply();
    }),
  );
  // panneau de filtres mobile
  const open = (v: boolean) => {
    root.classList.toggle('filters-open', v);
    document.body.style.overflow = v ? 'hidden' : '';
  };
  $('[data-filters-open]', root)?.addEventListener('click', () => open(true));
  $('[data-filters-close]', root)?.addEventListener('click', () => open(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && open(false));

  apply(false);
}

initCompare();
initTilt();
