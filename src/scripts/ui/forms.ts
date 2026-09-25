import { $, $$, escapeHtml, runtime, store, toast } from './dom';

/*
 * Envoi des formulaires. Fournisseur configurable dans src/data/settings.json → forms.provider :
 *  - "netlify"   : Netlify Forms (aucune configuration, e-mails via le tableau de bord Netlify)
 *  - "formspree" / "custom" : POST vers forms.endpoint (ex. https://formspree.io/f/xxxx)
 *  - "web3forms" : https://api.web3forms.com avec forms.web3formsKey
 *  - "mailto"    : ouvre la messagerie du visiteur vers forms.recipientEmail
 * En cas d'échec, le visiteur peut toujours appeler ou copier/envoyer sa demande par e-mail.
 */

type FormsCfg = { provider: string; endpoint?: string; web3formsKey?: string; recipientEmail?: string; successPage?: string };

function summary(form: HTMLFormElement) {
  const fd = new FormData(form);
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const [k, v] of fd.entries()) {
    if (['form-name', 'bot-field', '_gotcha', 'access_key', 'subject', 'redirect'].includes(k) || v instanceof File) continue;
    const label = form.querySelector(`[name="${CSS.escape(k)}"]`)?.closest('[data-label]')?.getAttribute('data-label') || k;
    const val = String(v).trim();
    if (!val) continue;
    if (seen.has(k)) lines.push(`  • ${val}`);
    else lines.push(`${label} : ${val}`);
    seen.add(k);
  }
  return lines.join('\n');
}

/** Regroupe les valeurs multiples (cases à cocher) en une seule ligne lisible. */
function collect(form: HTMLFormElement) {
  const src = new FormData(form);
  const fd = new FormData();
  for (const k of new Set([...src.keys()])) {
    const all = src.getAll(k);
    const files = all.filter((v) => v instanceof File) as File[];
    if (files.length) files.forEach((f) => f.size > 0 && fd.append(k, f));
    else fd.set(k, (all as string[]).filter(Boolean).join(', '));
  }
  return fd;
}

async function send(form: HTMLFormElement, cfg: FormsCfg) {
  const fd = collect(form);
  const name = form.getAttribute('name') || 'formulaire';
  const provider = cfg.provider || 'netlify';
  if (provider === 'netlify') {
    const hasFile = [...fd.values()].some((v) => v instanceof File && v.size > 0);
    const r = await fetch('/', hasFile ? { method: 'POST', body: fd } : { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd as any).toString() });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return;
  }
  if (provider === 'web3forms') {
    fd.set('access_key', cfg.web3formsKey || '');
    fd.set('subject', `[Site BDF] ${form.dataset.formLabel || name}`);
    const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return;
  }
  if ((provider === 'formspree' || provider === 'custom') && cfg.endpoint) {
    fd.set('_subject', `[Site BDF] ${form.dataset.formLabel || name}`);
    const r = await fetch(cfg.endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return;
  }
  if (provider === 'mailto' && cfg.recipientEmail) {
    location.href = `mailto:${cfg.recipientEmail}?subject=${encodeURIComponent(`[Site BDF] ${form.dataset.formLabel || name}`)}&body=${encodeURIComponent(summary(form))}`;
    return;
  }
  throw new Error('Aucun fournisseur de formulaire configuré');
}

function showFallback(form: HTMLFormElement, cfg: FormsCfg) {
  let box = form.querySelector<HTMLElement>('[data-form-fallback]');
  if (!box) {
    box = document.createElement('div');
    box.className = 'form-fallback panel';
    box.dataset.formFallback = '';
    form.appendChild(box);
  }
  const txt = summary(form);
  const to = cfg.recipientEmail || '';
  const phone = document.querySelector<HTMLAnchorElement>('.topbar__tel')?.textContent || '01 48 65 32 78';
  box.innerHTML = `<p><strong>L'envoi n'a pas abouti.</strong> Votre saisie est conservée. Vous pouvez :</p>
    <div class="btn-row">
      <a class="btn btn--sm" href="tel:${phone.replace(/\s/g, '')}">Appeler le ${escapeHtml(phone)}</a>
      ${to ? `<a class="btn btn--sm btn--ghost" href="mailto:${to}?subject=${encodeURIComponent('[Site BDF] ' + (form.dataset.formLabel || 'Demande'))}&body=${encodeURIComponent(txt)}">Envoyer par e-mail</a>` : ''}
      <button type="button" class="btn btn--sm btn--ghost" data-copy-summary>Copier ma demande</button>
      <button type="submit" class="btn btn--sm btn--ghost">Réessayer</button>
    </div>`;
  box.querySelector('[data-copy-summary]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(txt);
      toast('Demande copiée dans le presse-papiers');
    } catch {
      toast('Copie impossible sur ce navigateur');
    }
  });
}

/** Brouillon enregistré automatiquement dans le navigateur. */
function autosave(form: HTMLFormElement) {
  const key = `bdf-draft-${form.getAttribute('name')}`;
  const S = store<Record<string, string | string[]>>(key, {});
  const saved = S.get();
  const params = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(saved)) {
    if (params.has(k)) continue;
    const els = $$<HTMLInputElement>(`[name="${CSS.escape(k)}"]`, form);
    els.forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value;
      else if (el.type !== 'file' && el.type !== 'hidden' && !el.value) el.value = String(v);
    });
  }
  const save = () => {
    const out: Record<string, string | string[]> = {};
    const fd = new FormData(form);
    for (const k of new Set([...fd.keys()])) {
      if (['form-name', 'bot-field', 'consent'].includes(k)) continue;
      const all = fd.getAll(k).filter((x) => typeof x === 'string') as string[];
      out[k] = all.length > 1 ? all : all[0] || '';
    }
    S.set(out);
  };
  form.addEventListener('input', save);
  form.addEventListener('change', save);
  return () => {
    try {
      localStorage.removeItem(key);
    } catch {}
  };
}

export function initForms() {
  const cfg: FormsCfg = runtime().forms || { provider: 'netlify' };
  $$<HTMLFormElement>('form[data-bdf-form]').forEach((form) => {
    const t0 = Date.now();
    const clearDraft = form.hasAttribute('data-autosave') ? autosave(form) : () => {};
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (form.dataset.sending) return;
      // un assistant multi-étapes peut intercepter l'envoi (étape suivante)
      if (!form.dispatchEvent(new CustomEvent('bdf:beforesend', { cancelable: true }))) return;
      // anti-spam : champ piège + délai minimal
      const hp = form.querySelector<HTMLInputElement>('[name="bot-field"]');
      if (hp?.value || Date.now() - t0 < 2500) return;
      if (!form.reportValidity()) return;
      const btn = form.querySelector<HTMLButtonElement>('[type="submit"]:not([hidden])');
      form.dataset.sending = '1';
      btn?.classList.add('is-loading');
      btn && (btn.disabled = true);
      try {
        await send(form, cfg);
        clearDraft();
        form.dispatchEvent(new CustomEvent('bdf:sent'));
        const next = form.dataset.success || cfg.successPage || '/merci';
        if (!form.hasAttribute('data-stay')) location.href = `${next}?f=${encodeURIComponent(form.getAttribute('name') || '')}`;
      } catch {
        showFallback(form, cfg);
      } finally {
        delete form.dataset.sending;
        btn?.classList.remove('is-loading');
        btn && (btn.disabled = false);
      }
    });
  });
  // préremplissage générique depuis l'URL (?objet=…)
  const params = new URLSearchParams(location.search);
  params.forEach((v, k) => {
    const el = $<HTMLInputElement>(`form[data-bdf-form] [name="${CSS.escape(k)}"][data-prefill]`);
    if (el && !el.value) el.value = v;
  });
}
