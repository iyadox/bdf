import { $, $$, escapeHtml, fold } from './dom';

type Entry = { t: string; title: string; sub?: string; url: string; img?: string; icon?: string; kw: string; cp?: string };

const ICON: Record<string, string> = {
  page: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  installateur: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  categorie: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  actu: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
};
const LABEL: Record<string, string> = { produit: 'Produit', installateur: 'Installateur', page: 'Page', categorie: 'Gamme', actu: 'Actualité' };

let data: Entry[] | null = null;
async function load() {
  if (data) return data;
  const r = await fetch('/search.json');
  data = (await r.json()) as Entry[];
  return data;
}

function score(e: Entry, q: string, tokens: string[]) {
  const title = fold(e.title);
  let s = 0;
  for (const tk of tokens) {
    const inTitle = title.indexOf(tk);
    const inKw = e.kw.indexOf(tk);
    if (inTitle < 0 && inKw < 0) return -1;
    if (inTitle === 0) s += 12;
    else if (inTitle > 0) s += title[inTitle - 1] === ' ' ? 8 : 5;
    else s += 2;
  }
  if (title === q) s += 30;
  if (e.t === 'produit') s += 3;
  if (e.t === 'categorie' || e.t === 'page') s += 2;
  return s;
}

function highlight(text: string, tokens: string[]) {
  let out = escapeHtml(text);
  const f = fold(text);
  const ranges: [number, number][] = [];
  for (const tk of tokens) {
    const i = f.indexOf(tk);
    if (i >= 0) ranges.push([i, i + tk.length]);
  }
  if (!ranges.length) return out;
  ranges.sort((a, b) => b[0] - a[0]);
  let raw = text;
  for (const [a, b] of ranges) raw = raw.slice(0, a) + '\u0001' + raw.slice(a, b) + '\u0002' + raw.slice(b);
  out = escapeHtml(raw).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
  return out;
}

export function initPalette() {
  const dlg = $<HTMLDialogElement>('[data-palette]');
  if (!dlg) return;
  const input = $<HTMLInputElement>('[data-palette-input]', dlg)!;
  const list = $('[data-palette-list]', dlg)!;
  const empty = $('[data-palette-empty]', dlg)!;
  let scope = 'all';
  let results: Entry[] = [];
  let active = 0;

  const open = async (q = '') => {
    if (!dlg.open) dlg.showModal();
    document.dispatchEvent(new Event('dialog:toggle'));
    input.value = q;
    input.focus();
    await load();
    render();
  };
  const close = () => {
    dlg.close();
    document.dispatchEvent(new Event('dialog:toggle'));
  };

  const suggestions = (): Entry[] => {
    const d = data || [];
    const pick = (urls: string[]) => urls.map((u) => d.find((e) => e.url === u)).filter(Boolean) as Entry[];
    return pick([
      '/catalogue',
      '/configurateur',
      '/installateurs-portes-blindees',
      '/devis-porte-blindee',
      '/certifications/anti-effraction',
      '/certification-porte-blindee/coupe-feu',
      '/nous-contacter',
    ]);
  };

  const render = () => {
    const q = fold(input.value.trim());
    const d = data || [];
    if (!q) {
      results = suggestions();
    } else {
      const tokens = q.split(/\s+/).filter(Boolean);
      const isCp = /^\d{2,5}$/.test(q);
      let scored = d
        .filter((e) => scope === 'all' || e.t === scope || (scope === 'page' && (e.t === 'categorie' || e.t === 'actu')))
        .map((e) => {
          let s = score(e, q, tokens);
          if (isCp && e.cp) s = e.cp.startsWith(q) ? 50 - Math.abs(e.cp.length - q.length) : -1;
          return { e, s };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s);
      results = scored.slice(0, 40).map((x) => x.e);
    }
    active = 0;
    empty.hidden = results.length > 0;
    const tokens = q.split(/\s+/).filter(Boolean);
    let lastGroup = '';
    list.innerHTML = results
      .map((e, i) => {
        let group = '';
        if (!q && i === 0) group = '<li class="r-group" role="presentation">Accès rapides</li>';
        else if (q && e.t !== lastGroup && scope === 'all') group = `<li class="r-group" role="presentation">${LABEL[e.t] || e.t}s</li>`;
        lastGroup = e.t;
        const thumb = e.img
          ? `<span class="r-thumb"><img src="${e.img}" alt="" loading="lazy"></span>`
          : `<span class="r-thumb r-thumb--ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[e.t] || ICON.page}</svg></span>`;
        return `${group}<li role="option" id="r-${i}" aria-selected="${i === 0}" data-i="${i}"><a href="${e.url}">${thumb}<span class="r-main"><span class="r-title">${highlight(e.title, tokens)}</span>${e.sub ? `<span class="r-sub">${escapeHtml(e.sub)}</span>` : ''}</span><span class="r-type">${LABEL[e.t] || ''}</span></a></li>`;
      })
      .join('');
  };

  const move = (dir: number) => {
    const items = $$('li[role="option"]', list);
    if (!items.length) return;
    items[active]?.setAttribute('aria-selected', 'false');
    active = (active + dir + items.length) % items.length;
    items[active].setAttribute('aria-selected', 'true');
    items[active].scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      const a = $$<HTMLAnchorElement>('li[role="option"] a', list)[active];
      if (a) {
        e.preventDefault();
        location.href = a.href;
      }
    }
  });
  $$('[data-scope]', dlg).forEach((b) =>
    b.addEventListener('click', () => {
      scope = b.dataset.scope!;
      $$('[data-scope]', dlg).forEach((x) => x.classList.toggle('is-active', x === b));
      render();
      input.focus();
    }),
  );
  $('[data-palette-close]', dlg)?.addEventListener('click', close);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener('close', () => document.dispatchEvent(new Event('dialog:toggle')));

  document.addEventListener('click', (e) => {
    const t = (e.target as Element).closest<HTMLElement>('[data-open-search]');
    if (t) {
      e.preventDefault();
      open(t.dataset.query || '');
    }
  });
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable;
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      dlg.open ? close() : open();
    } else if (e.key === '/' && !typing && !dlg.open) {
      e.preventDefault();
      open();
    }
  });
  // raccourci : afficher Ctrl au lieu de ⌘ hors Mac
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) $$('.search-btn__kbd').forEach((k) => (k.textContent = 'Ctrl K'));
}
