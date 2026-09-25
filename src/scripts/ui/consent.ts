import { $, $$, runtime, store } from './dom';

type Consent = { analytics: boolean; media: boolean; date: string } | null;
const C = store<Consent>('bdf-consent', null);

export const consent = {
  get: () => C.get(),
  set(v: { analytics: boolean; media: boolean }) {
    C.set({ ...v, date: new Date().toISOString() });
    apply();
  },
};

function loadAnalytics() {
  const cfg = runtime().analytics || {};
  if (cfg.plausibleDomain && !document.querySelector('script[data-plausible]')) {
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.domain = cfg.plausibleDomain;
    s.dataset.plausible = '1';
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }
  if (cfg.gaMeasurementId && !(window as any).gtag) {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.gaMeasurementId}`;
    document.head.appendChild(s);
    (window as any).dataLayer = (window as any).dataLayer || [];
    const gtag = function (..._args: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      (window as any).dataLayer.push(arguments);
    };
    (window as any).gtag = gtag;
    gtag('js', new Date());
    gtag('config', cfg.gaMeasurementId, { anonymize_ip: true });
  }
}

function apply() {
  const c = C.get();
  if (c?.analytics) loadAnalytics();
}

function mountVideo(box: HTMLElement) {
  const id = box.dataset.yt!;
  const title = box.dataset.title || 'Vidéo';
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  iframe.title = title;
  iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.loading = 'lazy';
  box.classList.add('is-playing');
  box.innerHTML = '';
  box.appendChild(iframe);
}

export function initConsent() {
  const banner = $('[data-cookie-banner]');
  const opts = $('[data-cookie-opts]');
  const show = () => {
    if (!banner) return;
    const c = C.get();
    $$<HTMLInputElement>('[data-consent]', banner).forEach((i) => (i.checked = !!c?.[i.dataset.consent as 'analytics' | 'media']));
    banner.hidden = false;
  };
  const hide = () => banner && (banner.hidden = true);
  if (!C.get()) setTimeout(show, 1800);
  apply();

  $('[data-cookie-accept]')?.addEventListener('click', () => {
    consent.set({ analytics: true, media: true });
    hide();
  });
  $('[data-cookie-refuse]')?.addEventListener('click', () => {
    consent.set({ analytics: false, media: false });
    hide();
  });
  $('[data-cookie-custom]')?.addEventListener('click', () => {
    if (opts) opts.hidden = false;
    $('[data-cookie-save]')!.hidden = false;
    $('[data-cookie-custom]')!.hidden = true;
  });
  $('[data-cookie-save]')?.addEventListener('click', () => {
    const v = { analytics: false, media: false };
    $$<HTMLInputElement>('[data-consent]').forEach((i) => ((v as any)[i.dataset.consent!] = i.checked));
    consent.set(v);
    hide();
  });
  $$('[data-cookie-settings]').forEach((b) => b.addEventListener('click', show));

  // Vidéos YouTube : chargement au clic (façade légère, respect du consentement)
  document.addEventListener('click', (e) => {
    const box = (e.target as Element).closest<HTMLElement>('[data-yt]');
    if (!box || box.classList.contains('is-playing')) return;
    e.preventDefault();
    const c = C.get();
    if (!c?.media) consent.set({ analytics: !!c?.analytics, media: true });
    mountVideo(box);
  });
}
