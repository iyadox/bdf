import { $, $$, escapeHtml, toast } from '../ui/dom';
import { selection } from '../ui/selection';

/*
 * Assistant de demande de devis en 4 étapes.
 * Préremplissage : ?produit=…  ?installateur=<slug>  ?config=<résumé du configurateur 3D>
 */
const form = $<HTMLFormElement>('form[data-wizard]');

if (form) {
  const panels = $$<HTMLElement>('[data-wz-panel]', form);
  const dots = $$<HTMLElement>('[data-wz-dot]', form);
  const bar = $<HTMLElement>('[data-wz-bar]', form)!;
  const prev = $<HTMLButtonElement>('[data-wz-prev]', form)!;
  const next = $<HTMLButtonElement>('[data-wz-next]', form)!;
  const submit = $<HTMLButtonElement>('[data-wz-submit]', form)!;
  const last = panels.length - 1;
  let step = 0;

  const go = (i: number, focus = true) => {
    step = Math.max(0, Math.min(last, i));
    panels.forEach((p, k) => (p.hidden = k !== step));
    dots.forEach((d, k) => {
      d.classList.toggle('is-current', k === step);
      d.classList.toggle('is-done', k < step);
      if (k === step) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
    bar.parentElement!.style.setProperty('--wp', `${((step + 1) / panels.length) * 100}%`);
    bar.style.width = `${((step + 1) / panels.length) * 100}%`;
    prev.hidden = step === 0;
    next.hidden = step === last;
    submit.hidden = step !== last;
    if (step === last) recap();
    if (focus) {
      const top = form.getBoundingClientRect().top + scrollY - 110;
      if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
      panels[step].querySelector<HTMLElement>('legend, h2')?.setAttribute('tabindex', '-1');
      panels[step].querySelector<HTMLElement>('legend, h2')?.focus({ preventScroll: true });
    }
  };

  /** Valide uniquement les champs de l'étape courante. */
  const valid = () => {
    const fields = $$<HTMLInputElement>('input, select, textarea', panels[step]);
    for (const f of fields) {
      if (!f.checkValidity()) {
        f.reportValidity();
        return false;
      }
    }
    return true;
  };

  next.addEventListener('click', () => valid() && go(step + 1));
  prev.addEventListener('click', () => go(step - 1));
  dots.forEach((d, k) =>
    d.addEventListener('click', () => {
      if (k < step || (k === step + 1 && valid())) go(k);
    }),
  );
  // « Entrée » passe à l'étape suivante tant qu'on n'est pas sur le récapitulatif
  form.addEventListener('bdf:beforesend', (e) => {
    if (step < last) {
      e.preventDefault();
      if (valid()) go(step + 1);
    }
  });

  /* ---------- Récapitulatif ---------- */
  const recapEl = $('[data-recap]', form)!;
  function recap() {
    const fd = new FormData(form!);
    const rows: { label: string; val: string; step: number }[] = [];
    const seen = new Map<string, number>();
    for (const [k, v] of fd.entries()) {
      if (['form-name', 'bot-field', 'consent'].includes(k)) continue;
      const el = form!.querySelector(`[name="${CSS.escape(k)}"]`);
      const label = el?.closest('[data-label]')?.getAttribute('data-label') || k;
      const panel = Number(el?.closest('[data-wz-panel]')?.getAttribute('data-wz-panel') || 0);
      const val = v instanceof File ? (v.size ? `${v.name} (${Math.round(v.size / 1024)} Ko)` : '') : String(v).trim();
      if (!val) continue;
      if (seen.has(k)) rows[seen.get(k)!].val += `, ${val}`;
      else {
        seen.set(k, rows.length);
        rows.push({ label, val, step: panel });
      }
    }
    recapEl.innerHTML = rows
      .map((r) => `<dt>${escapeHtml(r.label)}</dt><dd><button type="button" data-edit="${r.step}">Modifier</button>${escapeHtml(r.val)}</dd>`)
      .join('');
  }
  recapEl.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-edit]');
    if (b) go(Number(b.dataset.edit));
  });

  /* ---------- Préremplissage ---------- */
  const params = new URLSearchParams(location.search);
  const produits = $<HTMLTextAreaElement>('[name="produits"]', form)!;
  if (params.get('produit')) produits.value = params.get('produit')!;

  const cfg = params.get('config');
  if (cfg) {
    const box = $('[data-cfg-box]', form)!;
    box.hidden = false;
    $('[data-cfg-text]', box)!.textContent = cfg;
    $<HTMLInputElement>('[data-cfg-input]', box)!.value = cfg;
  }
  const inst = params.get('installateur');
  if (inst) {
    try {
      const list: { slug: string; name: string; city: string }[] = JSON.parse($('#inst-names')!.textContent || '[]');
      const it = list.find((x) => x.slug === inst);
      if (it) {
        const box = $('[data-inst-box]', form)!;
        box.hidden = false;
        $('[data-inst-name]', box)!.textContent = `${it.name} (${it.city})`;
        $<HTMLInputElement>('[data-inst-input]', box)!.value = `${it.name} — ${it.city}`;
      }
    } catch {
      /* ignore */
    }
  }

  // produits de la sélection (favoris) à ajouter en un clic
  const selWrap = $('[data-sel-add]', form)!;
  const selChips = $('[data-sel-chips]', form)!;
  const paintSel = () => {
    const items = selection.all().filter((i) => !produits.value.includes(i.quote || i.title));
    selWrap.hidden = !items.length;
    selChips.innerHTML = items.map((i) => `<button type="button" data-add="${escapeHtml(i.quote || i.title)}">+ ${escapeHtml(i.title)}</button>`).join('');
  };
  selChips.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-add]');
    if (!b) return;
    produits.value = [produits.value.trim(), b.dataset.add].filter(Boolean).join(' ; ');
    produits.dispatchEvent(new Event('input', { bubbles: true }));
    paintSel();
  });
  produits.addEventListener('input', paintSel);
  paintSel();

  /* ---------- Code postal → commune ---------- */
  const cp = $<HTMLInputElement>('[data-cp]', form)!;
  const city = $<HTMLInputElement>('[data-city]', form)!;
  const cities = $('[data-cities]', form)!;
  cp.addEventListener('input', async () => {
    const v = cp.value.replace(/\D/g, '');
    if (v.length !== 5) return;
    try {
      const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${v}&fields=nom&format=json`);
      const list: { nom: string }[] = await r.json();
      cities.innerHTML = list.map((c) => `<option value="${escapeHtml(c.nom)}">`).join('');
      if (list.length === 1 && !city.value) {
        city.value = list[0].nom;
        city.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch {
      /* hors ligne : saisie libre */
    }
  });

  /* ---------- Pièce jointe ---------- */
  const file = $<HTMLInputElement>('[data-file]', form)!;
  const fileName = $('[data-file-name]', form)!;
  const fileTxt = fileName.textContent;
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (f && f.size > 8 * 1024 * 1024) {
      file.value = '';
      toast('Fichier trop volumineux (8 Mo maximum)');
    }
    const g = file.files?.[0];
    fileName.textContent = g ? `📎 ${g.name}` : fileTxt;
  });

  /* ---------- Indicateur de brouillon ---------- */
  const saved = $('[data-saved]', form);
  let st: number | undefined;
  form.addEventListener('input', () => {
    if (!saved) return;
    saved.classList.add('is-on');
    clearTimeout(st);
    st = window.setTimeout(() => saved.classList.remove('is-on'), 1800);
  });

  go(0, false);
}
