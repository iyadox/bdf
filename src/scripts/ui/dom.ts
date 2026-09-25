export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

export const reducedMotion = () =>
  document.documentElement.classList.contains('reduced') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isLite = () => document.documentElement.classList.contains('lite');

export const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

export function toast(html: string, ms = 3200) {
  const host = $('[data-toasts]');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = html;
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export const fold = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function store<T>(key: string, fallback: T): { get: () => T; set: (v: T) => void } {
  return {
    get() {
      try {
        const v = localStorage.getItem(key);
        return v ? (JSON.parse(v) as T) : fallback;
      } catch {
        return fallback;
      }
    },
    set(v: T) {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* stockage indisponible */
      }
    },
  };
}

/** Détecte un support WebGL exploitable. */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function runtime(): any {
  try {
    return JSON.parse(document.getElementById('bdf-runtime')?.textContent || '{}');
  } catch {
    return {};
  }
}
