import { $$, runtime } from './dom';

type Day = { day: string; open: string; close: string };

/** Affiche « Ouvert maintenant » / « Fermé » selon les horaires (heure de Paris). */
export function initOpenStatus() {
  const els = $$('[data-open-status]');
  if (!els.length) return;
  const days: Day[] = runtime().hours || [];
  if (!days.length) return;
  const fmt = (t: string) => t.replace(/^0/, '').replace(':00', 'h').replace(':', 'h');
  const compute = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const idx = (now.getDay() + 6) % 7; // lundi = 0
    const d = days[idx];
    const mins = now.getHours() * 60 + now.getMinutes();
    const toM = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    if (d?.open && mins >= toM(d.open) && mins < toM(d.close)) {
      return { open: true, text: `Ouvert · jusqu'à ${fmt(d.close)}` };
    }
    // prochaine ouverture
    for (let k = 0; k < 7; k++) {
      const j = (idx + k) % 7;
      const dd = days[j];
      if (!dd?.open) continue;
      if (k === 0 && mins >= toM(dd.open)) continue;
      const when = k === 0 ? `aujourd'hui ${fmt(dd.open)}` : k === 1 ? `demain ${fmt(dd.open)}` : `${dd.day.toLowerCase()} ${fmt(dd.open)}`;
      return { open: false, text: `Fermé · ouvre ${when}` };
    }
    return { open: false, text: 'Fermé' };
  };
  const paint = () => {
    const s = compute();
    els.forEach((el) => {
      const t = el.querySelector('[data-open-text]');
      if (t) t.textContent = s.text;
      const dot = el.querySelector('.live-dot');
      dot?.classList.toggle('live-dot--ok', s.open);
      dot?.classList.toggle('live-dot--off', !s.open);
    });
  };
  paint();
  setInterval(paint, 60_000);
}
