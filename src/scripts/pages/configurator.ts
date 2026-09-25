import { $, $$, escapeHtml, hasWebGL, toast } from '../ui/dom';
import type { DoorOptions, Finish, HandleType, Molding } from '../three/door-model';

/*
 * Configurateur 3D : état ↔ interface ↔ URL partageable ↔ demande de devis.
 */
type Ral = { code: string; name: string; hex: string };
type Wood = { name: string; colors: [string, string] };
type Prod = { slug: string; title: string; url: string; image?: string; quote: string; v: string[]; c: string[]; f: string[]; seg: string };
type Data = { products: Prod[]; ral: Ral[]; woods: Wood[]; certs: { id: string; label: string; filter: string }[]; options: { id: string; key: string; label: string }[] };

type State = {
  leaves: 1 | 2;
  width: number;
  height: number;
  finish: Finish;
  color: string;
  wood: number;
  molding: Molding;
  colorInt: string;
  same: boolean;
  frameColor: string;
  lockPoints: number;
  handle: HandleType;
  hardware: 'inox' | 'laiton' | 'noir';
  peephole: boolean;
  oculus: boolean;
  closer: boolean;
  grille: boolean;
  cert: string;
  mod: string;
};

const root = $('[data-cfg]');
if (root) {
  const D: Data = JSON.parse($('#cfg-data')!.textContent || '{}');
  const ralBy = new Map(D.ral.map((r) => [r.code, r]));
  const LIMITS = { 1: [530, 1219], 2: [1000, 2000] } as const;
  const DEFAULT: State = {
    leaves: 1,
    width: 930,
    height: 2080,
    finish: 'lisse',
    color: '7016',
    wood: 0,
    molding: 'classique',
    colorInt: '9016',
    same: false,
    frameColor: '7016',
    lockPoints: 5,
    handle: 'bequille',
    hardware: 'inox',
    peephole: true,
    oculus: false,
    closer: false,
    grille: false,
    cert: 'bp1',
    mod: '',
  };
  const S: State = { ...DEFAULT };

  /* ------------------------------------------------ URL ⇄ état */
  const OPT_KEYS = D.options.map((o) => ({ id: o.id, key: o.key as 'peephole' | 'oculus' | 'closer' | 'grille' }));
  const toQuery = () => {
    const p = new URLSearchParams();
    p.set('l', String(S.leaves));
    p.set('w', String(S.width));
    p.set('h', String(S.height));
    p.set('f', S.finish);
    p.set(S.finish === 'bois' ? 'b' : 'c', S.finish === 'bois' ? String(S.wood) : S.color);
    if (S.finish === 'bois') p.set('c', S.color);
    p.set('i', S.same ? 'same' : S.colorInt);
    p.set('fc', S.frameColor);
    p.set('m', S.molding);
    p.set('hd', S.handle);
    p.set('hw', S.hardware);
    p.set('lp', String(S.lockPoints));
    p.set('o', OPT_KEYS.filter((o) => S[o.key]).map((o) => o.id).join('') || '-');
    if (S.cert) p.set('cert', S.cert);
    if (S.mod) p.set('modele', S.mod);
    return p;
  };
  const fromQuery = (p: URLSearchParams) => {
    const n = (k: string) => Number(p.get(k));
    if (p.get('l') === '2') {
      S.leaves = 2;
      S.width = 1400;
    }
    if (n('w')) S.width = n('w');
    if (n('h')) S.height = n('h');
    const f = p.get('f') as Finish;
    if (['lisse', 'texture', 'bois', 'acier'].includes(f)) S.finish = f;
    if (ralBy.has(p.get('c') || '')) S.color = p.get('c')!;
    if (p.has('b')) S.wood = Math.min(D.woods.length - 1, Math.max(0, n('b')));
    const i = p.get('i') || '';
    if (i === 'same') S.same = true;
    else if (ralBy.has(i)) S.colorInt = i;
    if (ralBy.has(p.get('fc') || '')) S.frameColor = p.get('fc')!;
    const m = p.get('m') as Molding;
    if (['aucune', 'classique', 'moderne', 'rainures', 'cadre'].includes(m)) S.molding = m;
    const hd = p.get('hd') as HandleType;
    if (['bequille', 'tirage', 'barre'].includes(hd)) S.handle = hd;
    const hw = p.get('hw') as State['hardware'];
    if (['inox', 'laiton', 'noir'].includes(hw)) S.hardware = hw;
    if ([1, 3, 5, 7].includes(n('lp'))) S.lockPoints = n('lp');
    if (p.has('o')) OPT_KEYS.forEach((o) => (S[o.key] = (p.get('o') || '').includes(o.id)));
    if (p.has('cert') && D.certs.some((c) => c.id === p.get('cert'))) S.cert = p.get('cert')!;
    // point de départ : un modèle du catalogue
    const mod = D.products.find((x) => x.slug === p.get('modele'));
    if (mod) {
      S.mod = mod.slug;
      if (!p.has('l')) S.leaves = mod.v.includes('2 vantaux') && !mod.v.includes('1 vantail') ? 2 : 1;
      if (!p.has('cert')) {
        const c = D.certs.find((c) => c.filter && mod.c.includes(c.filter));
        S.cert = c ? c.id : '';
      }
      if (!p.has('w') && S.leaves === 2) S.width = 1400;
      if (!p.has('hd') && mod.f.some((x) => /anti-panique/i.test(x))) S.handle = 'barre';
      if (!p.has('o') && mod.seg.includes('cave')) S.grille = true;
    }
    clampSize();
  };
  const clampSize = () => {
    const [a, b] = LIMITS[S.leaves];
    S.width = Math.round(Math.min(b, Math.max(a, S.width)));
    S.height = Math.round(Math.min(2484, Math.max(1620, S.height)));
  };

  /* ------------------------------------------------ libellés */
  const ralLabel = (code: string) => `RAL ${code} ${ralBy.get(code)?.name || ''}`.trim();
  const FINISH: Record<Finish, string> = { lisse: 'lisse laquée', texture: 'texturée', bois: 'décor bois', acier: 'acier brossé' };
  const MOLD: Record<Molding, string> = { aucune: 'sans moulure', classique: 'moulures classiques', moderne: 'moulures modernes', rainures: 'rainures', cadre: 'cadre' };
  const HANDLE: Record<HandleType, string> = { bequille: 'Béquille', tirage: 'Barre de tirage', barre: 'Barre anti-panique' };
  const HW: Record<State['hardware'], string> = { inox: 'inox', laiton: 'laiton', noir: 'noir mat' };
  const extLabel = () => (S.finish === 'bois' ? `Décor ${D.woods[S.wood].name.toLowerCase()}` : `${ralLabel(S.color)}, ${FINISH[S.finish]}`);
  const optsLabel = () =>
    OPT_KEYS.filter((o) => S[o.key])
      .map((o) => D.options.find((x) => x.id === o.id)!.label)
      .join(', ');
  const certLabel = () => D.certs.find((c) => c.id === S.cert)?.label || 'Non certifiée';
  const sizeLabel = () => `${S.leaves === 1 ? '1 vantail' : '2 vantaux'} · ${S.width} × ${S.height} mm`;
  const summary = () =>
    [
      sizeLabel(),
      `Extérieur : ${extLabel()}, ${MOLD[S.molding]}`,
      `Intérieur : ${S.same ? 'identique à l’extérieur' : ralLabel(S.colorInt)}`,
      `Huisserie : ${ralLabel(S.frameColor)}`,
      `Serrure ${S.lockPoints} point${S.lockPoints > 1 ? 's' : ''} · ${HANDLE[S.handle]} ${HW[S.hardware]}`,
      optsLabel() && `Options : ${optsLabel()}`,
      `Protection : ${certLabel()}`,
    ]
      .filter(Boolean)
      .join(' · ');

  /* ------------------------------------------------ interface */
  const paintSwatches = (key: 'color' | 'colorInt' | 'frameColor') => {
    const host = $(`[data-swatches="${key}"]`, root)!;
    host.innerHTML = D.ral
      .map((r) => `<button type="button" data-sw="${key}" data-val="${r.code}" style="background:${r.hex}" title="RAL ${r.code} · ${escapeHtml(r.name)}" aria-label="RAL ${r.code} ${escapeHtml(r.name)}"></button>`)
      .join('');
  };
  (['color', 'colorInt', 'frameColor'] as const).forEach(paintSwatches);
  $('[data-swatches="wood"]', root)!.innerHTML = D.woods
    .map((w, i) => `<button type="button" data-sw="wood" data-val="${i}" style="background:linear-gradient(100deg,${w.colors[0]},${w.colors[1]} 45%,${w.colors[0]} 70%,${w.colors[1]})" title="${escapeHtml(w.name)}" aria-label="${escapeHtml(w.name)}"></button>`)
    .join('');

  const rW = $<HTMLInputElement>('[data-range="width"]', root)!;
  const rH = $<HTMLInputElement>('[data-range="height"]', root)!;
  const fill = (r: HTMLInputElement) => r.style.setProperty('--p', `${((+r.value - +r.min) / (+r.max - +r.min)) * 100}%`);

  const sync = () => {
    const [a, b] = LIMITS[S.leaves];
    rW.min = String(a);
    rW.max = String(b);
    rW.value = String(S.width);
    rH.value = String(S.height);
    fill(rW);
    fill(rH);
    $('[data-min="width"]', root)!.textContent = String(a);
    $('[data-max="width"]', root)!.textContent = String(b);
    $('[data-out="width"]', root)!.textContent = `${S.width} mm`;
    $('[data-out="height"]', root)!.textContent = `${S.height} mm`;
    $$<HTMLButtonElement>('[data-set]', root).forEach((btn) => {
      const k = btn.dataset.set as keyof State;
      btn.classList.toggle('is-on', String(S[k]) === btn.dataset.val);
      btn.setAttribute('aria-pressed', String(String(S[k]) === btn.dataset.val));
    });
    $$<HTMLButtonElement>('[data-sw]', root).forEach((btn) => {
      const k = btn.dataset.sw as 'color' | 'colorInt' | 'frameColor' | 'wood';
      const on = String(S[k]) === btn.dataset.val;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const wood = S.finish === 'bois';
    $('[data-swatches="wood"]', root)!.hidden = !wood;
    $('[data-swatches="color"]', root)!.hidden = wood;
    $('[data-color-lbl]', root)!.textContent = wood ? 'Essence' : 'Couleur RAL';
    $<HTMLInputElement>('[data-same]', root)!.checked = S.same;
    $('[data-swatches="colorInt"]', root)!.style.opacity = S.same ? '0.35' : '1';
    $('[data-swatches="colorInt"]', root)!.style.pointerEvents = S.same ? 'none' : '';
    $$<HTMLInputElement>('[data-opt]', root).forEach((i) => (i.checked = !!S[i.dataset.opt as 'peephole']));
    // résumés des sections
    const set = (k: string, v: string) => ($(`[data-sum="${k}"]`, root)!.textContent = v);
    set('size', sizeLabel());
    set('ext', S.finish === 'bois' ? D.woods[S.wood].name : `RAL ${S.color}`);
    set('int', S.same ? 'Identique' : `RAL ${S.colorInt}`);
    set('lock', `${S.lockPoints} pts · ${HANDLE[S.handle]}`);
    set('opts', optsLabel() || 'Aucune');
    set('cert', certLabel());
    $('[data-caption]')!.textContent = `${sizeLabel()} · ${certLabel()}`;
    $('[data-dim-w]')!.textContent = `${S.width} mm`;
    $('[data-dim-h]')!.textContent = `${S.height} mm`;
    $('[data-summary]', root)!.textContent = summary();
    // modèles compatibles
    const cert = D.certs.find((c) => c.id === S.cert);
    const lab = S.leaves === 1 ? '1 vantail' : '2 vantaux';
    const match = D.products
      .filter((p) => p.v.includes(lab) && (cert?.filter ? p.c.includes(cert.filter) : !p.c.some((c) => /A2P|Coupe|Pare/.test(c))))
      .sort((a, b) => Number(b.seg.startsWith('blocs-portes')) - Number(a.seg.startsWith('blocs-portes')))
      .slice(0, 3);
    $('[data-match]', root)!.innerHTML = match.length
      ? `<p class="m-t">Modèles compatibles</p>${match
          .map((p) => `<a href="${p.url}">${p.image ? `<img src="${p.image}" alt="" loading="lazy">` : ''}<span>${escapeHtml(p.title)}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg></a>`)
          .join('')}`
      : `<p class="m-t">Sur mesure</p><p class="hint">Aucun modèle standard ne correspond exactement : nous étudions votre projet sur mesure.</p>`;
    // devis
    const q = new URLSearchParams();
    const mod = D.products.find((p) => p.slug === S.mod);
    if (mod) q.set('produit', mod.quote);
    q.set('config', `${summary()}\nConfiguration 3D : ${shareUrl()}`);
    $<HTMLAnchorElement>('[data-quote]', root)!.href = `/devis-porte-blindee?${q}`;
  };
  const shareUrl = () => `${location.origin}${location.pathname}?${toQuery()}`;

  /* ------------------------------------------------ 3D */
  let scene: Awaited<ReturnType<typeof import('../three/configurator-scene')['createConfigurator']>> | null = null;
  const toDoor = (): DoorOptions => {
    const hex = (c: string) => ralBy.get(c)?.hex || '#383e42';
    const wood = D.woods[S.wood];
    return {
      leaves: S.leaves,
      width: S.width / 1000,
      height: S.height / 1000,
      thickness: 0.068,
      color: S.finish === 'bois' ? wood.colors[0] : S.finish === 'acier' ? '#8e969e' : hex(S.color),
      colorInt: S.same ? (S.finish === 'bois' ? wood.colors[0] : hex(S.color)) : hex(S.colorInt),
      frameColor: hex(S.frameColor),
      finish: S.finish,
      wood: wood.colors,
      molding: S.molding,
      handle: S.handle,
      hardware: S.hardware,
      peephole: S.peephole,
      oculus: S.oculus,
      closer: S.closer,
      grille: S.grille,
      lockPoints: S.lockPoints,
      withFrame: true,
      internals: false,
    };
  };
  let raf = 0;
  let urlT: number | undefined;
  const update = () => {
    clampSize();
    sync();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => scene?.setDoor(toDoor()));
    clearTimeout(urlT);
    urlT = window.setTimeout(() => history.replaceState(null, '', `${location.pathname}?${toQuery()}`), 300);
  };

  /* ------------------------------------------------ événements */
  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const set = t.closest<HTMLButtonElement>('[data-set]');
    if (set) {
      const k = set.dataset.set as keyof State;
      const val = set.dataset.val!;
      (S as any)[k] = typeof DEFAULT[k] === 'number' ? Number(val) : val;
      if (k === 'leaves') S.width = S.leaves === 2 ? Math.max(S.width, 1400) : Math.min(S.width, 930);
      return update();
    }
    const sw = t.closest<HTMLButtonElement>('[data-sw]');
    if (sw) {
      const k = sw.dataset.sw as 'color' | 'colorInt' | 'frameColor' | 'wood';
      if (k === 'wood') S.wood = Number(sw.dataset.val);
      else S[k] = sw.dataset.val!;
      return update();
    }
  });
  rW.addEventListener('input', () => {
    S.width = +rW.value;
    update();
  });
  rH.addEventListener('input', () => {
    S.height = +rH.value;
    update();
  });
  $<HTMLInputElement>('[data-same]', root)!.addEventListener('change', (e) => {
    S.same = (e.target as HTMLInputElement).checked;
    update();
  });
  $$<HTMLInputElement>('[data-opt]', root).forEach((i) =>
    i.addEventListener('change', () => {
      S[i.dataset.opt as 'peephole'] = i.checked;
      update();
    }),
  );
  $('[data-reset]', root)!.addEventListener('click', () => {
    Object.assign(S, DEFAULT);
    update();
    toast('Configuration réinitialisée');
  });
  $('[data-share]', root)!.addEventListener('click', async () => {
    const url = shareUrl();
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: 'Ma porte Blindages de France', text: summary(), url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Lien de votre configuration copié');
      }
    } catch {
      /* partage annulé */
    }
  });

  // vue & outils
  const view = $('[data-cfg-view]')!;
  $$<HTMLButtonElement>('[data-view]').forEach((b) =>
    b.addEventListener('click', () => {
      $$<HTMLButtonElement>('[data-view]').forEach((x) => {
        x.classList.toggle('is-on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      scene?.setView(b.dataset.view as 'ext' | 'int');
    }),
  );
  const press = (b: HTMLElement, on: boolean) => b.setAttribute('aria-pressed', String(on));
  let amb: 'studio' | 'jour' = 'studio';
  $$<HTMLButtonElement>('[data-tool]').forEach((b) =>
    b.addEventListener('click', () => {
      const tool = b.dataset.tool;
      if (!scene) return;
      if (tool === 'open') {
        const open = scene.toggleOpen();
        press(b, open);
        b.querySelector('span')!.textContent = open ? 'Fermer' : 'Ouvrir';
      } else if (tool === 'xray') {
        const on = b.getAttribute('aria-pressed') !== 'true';
        press(b, on);
        scene.setXray(on);
      } else if (tool === 'dims') {
        const on = b.getAttribute('aria-pressed') !== 'true';
        press(b, on);
        scene.setDims(on);
      } else if (tool === 'amb') {
        amb = amb === 'studio' ? 'jour' : 'studio';
        press(b, amb === 'jour');
        scene.setAmbiance(amb);
        b.querySelector('span')!.textContent = amb === 'jour' ? 'Ambiance studio' : 'Ambiance jour';
      } else if (tool === 'reset') scene.reset();
      else if (tool === 'shot') {
        const a = document.createElement('a');
        a.href = scene.snapshot();
        a.download = `porte-blindages-de-france-${S.leaves}v-${S.width}x${S.height}.png`;
        a.click();
      } else if (tool === 'full') {
        if (document.fullscreenElement) document.exitFullscreen();
        else view.requestFullscreen?.().catch(() => toast('Plein écran indisponible'));
      }
    }),
  );
  const hint = $('[data-hint]');
  view.addEventListener('pointerdown', () => hint && (hint.style.opacity = '0'), { once: true });

  // départ depuis une fiche produit
  fromQuery(new URLSearchParams(location.search));
  const mod = D.products.find((p) => p.slug === S.mod);
  if (mod) {
    $('[data-from-model]', root)!.hidden = false;
    const a = $<HTMLAnchorElement>('[data-from-link]', root)!;
    a.href = mod.url;
    a.textContent = mod.title;
  }
  sync();

  const canvas = $<HTMLCanvasElement>('[data-cfg-canvas]')!;
  const loading = $('[data-cfg-loading]')!;
  if (hasWebGL()) {
    import('../three/configurator-scene').then(({ createConfigurator }) => {
      scene = createConfigurator(canvas, { w: $('[data-dim-w]')!, h: $('[data-dim-h]')! });
      scene.setDoor(toDoor());
      scene.stage.start();
      requestAnimationFrame(() => loading.classList.add('is-done'));
    });
  } else {
    loading.innerHTML = '<p class="cfg-nogl">L’aperçu 3D n’est pas disponible sur ce navigateur.<br>Vous pouvez tout de même composer votre porte et demander un devis.</p>';
  }
}
