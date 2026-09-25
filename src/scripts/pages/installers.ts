import { $, $$, escapeHtml, fold, hasWebGL, toast } from '../ui/dom';
import type { InstallerPoint } from '../map/map';

type Data = { list: InstallerPoint[]; hq: [number, number] };
const root = $('[data-locator]');

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b[1] - a[1]);
  const dLng = toR(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[1])) * Math.cos(toR(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)} km`);

/** Géocodage via la Base Adresse Nationale (api-adresse.data.gouv.fr) */
async function geocode(q: string): Promise<{ lngLat: [number, number]; label: string } | null> {
  try {
    const u = new URL('https://api-adresse.data.gouv.fr/search/');
    u.searchParams.set('q', q);
    u.searchParams.set('limit', '1');
    if (/^\d{5}$/.test(q)) u.searchParams.set('type', 'municipality');
    const r = await fetch(u.toString());
    const j = await r.json();
    const f = j.features?.[0];
    if (!f || f.properties.score < 0.35) return null;
    return { lngLat: f.geometry.coordinates, label: `${f.properties.city || f.properties.label}${f.properties.postcode ? ` (${f.properties.postcode.slice(0, 2)})` : ''}` };
  } catch {
    return null;
  }
}

if (root) {
  const data: Data = JSON.parse($('#loc-data')!.textContent || '{}');
  const bySlug = new Map(data.list.map((i) => [i.slug, i]));
  const list = $('[data-loc-list]', root)!;
  const items = $$('[data-inst]', list);
  const itemBySlug = new Map(items.map((li) => [li.dataset.inst!, li]));
  const status = $('[data-loc-status]', root)!;
  const input = $<HTMLInputElement>('[data-loc-q]', root)!;
  const dep = $<HTMLSelectElement>('[data-loc-dep]', root)!;
  const more = $<HTMLButtonElement>('[data-loc-more]', root)!;
  const PAGE = 40;
  let shown = PAGE;
  let origin: [number, number] | null = null;
  let originLabel = '';
  let visible: HTMLElement[] = items;
  let mapApi: typeof import('../map/map') | null = null;
  let map: import('maplibre-gl').Map | null = null;
  let originMarker: import('maplibre-gl').Marker | null = null;

  const render = (fit = true) => {
    const q = fold(input.value.trim());
    const d = dep.value;
    const isGeoQuery = !!origin;
    visible = items.filter((li) => {
      if (d && !(li.dataset.cp || '').startsWith(d)) return false;
      if (q && !isGeoQuery) {
        const hay = `${li.dataset.name} ${fold(li.dataset.city || '')} ${li.dataset.cp}`;
        if (!q.split(/\s+/).every((t) => fold(hay).includes(t))) return false;
      }
      return true;
    });
    // tri par distance si une position de référence existe
    if (origin) {
      for (const li of visible) {
        const p = bySlug.get(li.dataset.inst!);
        const km = p ? haversine(origin, [p.lng, p.lat]) : Infinity;
        li.dataset.km = String(km);
        const el = li.querySelector('[data-dist]');
        if (el) el.textContent = isFinite(km) ? fmtKm(km) : '';
      }
      visible.sort((a, b) => +a.dataset.km! - +b.dataset.km!);
    } else {
      items.forEach((li) => {
        const el = li.querySelector('[data-dist]');
        if (el) el.textContent = '';
      });
    }
    items.forEach((li) => (li.hidden = true));
    visible.forEach((li, i) => {
      list.appendChild(li);
      li.hidden = i >= shown;
    });
    more.hidden = visible.length <= shown;
    const n = visible.length;
    status.innerHTML = origin
      ? `<strong>${n}</strong> installateur${n > 1 ? 's' : ''} triés par distance de <em>${escapeHtml(originLabel)}</em> · <button type="button" class="link-reset" data-loc-clear>effacer</button>`
      : `<strong>${n}</strong> installateur${n > 1 ? 's' : ''}${d || q ? ' correspondant' + (n > 1 ? 's' : '') : ''}`;
    if (map && mapApi) {
      const pts = visible.map((li) => bySlug.get(li.dataset.inst!)).filter(Boolean) as InstallerPoint[];
      mapApi.setInstallerData(map, pts);
      if (fit) {
        if (origin) mapApi.fitTo(map, [{ lng: origin[0], lat: origin[1] }, ...pts.slice(0, 6)], 70);
        else if (d || q) mapApi.fitTo(map, pts, 60);
      }
    }
    // paramètres d'URL partageables
    const p = new URLSearchParams();
    if (input.value.trim()) p.set('q', input.value.trim());
    if (d) p.set('dep', d);
    history.replaceState(null, '', location.pathname + (p.toString() ? `?${p}` : ''));
  };

  const setOrigin = (lngLat: [number, number] | null, label = '') => {
    origin = lngLat;
    originLabel = label;
    shown = PAGE;
    if (map && mapApi) {
      originMarker?.remove();
      originMarker = lngLat ? mapApi.pointMarker(map, lngLat) : null;
    }
    render();
  };

  const search = async () => {
    const q = input.value.trim();
    shown = PAGE;
    if (!q) return setOrigin(null);
    // correspondance directe sur un nom d'installateur ?
    const byName = items.some((li) => (li.dataset.name || '').includes(q.toLowerCase()));
    if (/^\d{2}$/.test(q) && [...dep.options].some((o) => o.value === q)) {
      dep.value = q;
      input.value = '';
      return setOrigin(null);
    }
    if (!byName || /^\d{4,5}$/.test(q)) {
      status.textContent = 'Recherche en cours…';
      const g = await geocode(q);
      if (g) return setOrigin(g.lngLat, g.label);
    }
    setOrigin(null);
  };

  let t: number | undefined;
  input.addEventListener('input', () => {
    clearTimeout(t);
    if (origin) {
      origin = null;
      originMarker?.remove();
    }
    t = window.setTimeout(() => render(false), 150);
  });
  $('[data-loc-form]', root)!.addEventListener('submit', (e) => {
    e.preventDefault();
    search();
  });
  dep.addEventListener('change', () => {
    shown = PAGE;
    render();
  });
  more.addEventListener('click', () => {
    shown += PAGE;
    render(false);
  });
  status.addEventListener('click', (e) => {
    if ((e.target as Element).closest('[data-loc-clear]')) {
      input.value = '';
      setOrigin(null);
    }
  });

  const locate = () => {
    if (!navigator.geolocation) return toast('Géolocalisation indisponible sur cet appareil');
    status.textContent = 'Localisation en cours…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        input.value = '';
        dep.value = '';
        setOrigin([pos.coords.longitude, pos.coords.latitude], 'votre position');
      },
      () => {
        toast('Position refusée : saisissez votre code postal');
        render(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  };
  $('[data-loc-near]', root)!.addEventListener('click', locate);

  // survol / clic d'une fiche → carte
  const focus = (slug: string, openPopup = true) => {
    const p = bySlug.get(slug);
    items.forEach((li) => li.classList.toggle('is-active', li.dataset.inst === slug));
    if (!p || !map || !mapApi) return;
    map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.getZoom(), 13), duration: 900 });
    if (openPopup) {
      $$('.bdf-popup').forEach((x) => x.remove());
      const tel = p.phone ? `<a href="tel:${p.phone.replace(/\s/g, '')}">${escapeHtml(p.phone)}</a>` : '';
      mapApi.popup(
        map,
        [p.lng, p.lat],
        `<h4>${escapeHtml(p.name)}</h4><p>${escapeHtml(p.address)}<br>${p.cp} ${escapeHtml(p.city)}</p><div class="pp-links">${tel}<a href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}" target="_blank" rel="noopener">Itinéraire</a><a href="/installateurs-portes-blindees/${p.slug}">Fiche →</a></div>`,
      );
    }
  };
  list.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLElement>('[data-show-map]');
    if (!b) return;
    focus(b.dataset.showMap!);
    if (window.innerWidth < 1000) $('[data-loc-map]')!.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // carte (chargée à la demande)
  const mapEl = $('[data-loc-map]', root)!;
  if (hasWebGL()) {
    import('../map/map').then((api) => {
      mapApi = api;
      map = api.createMap(mapEl);
      map.on('load', () => {
        api.addInstallerLayers(map!, data.list, (slug) => {
          focus(slug);
          const li = itemBySlug.get(slug);
          if (li) {
            li.hidden = false;
            li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
        api.hqMarker(map!, data.hq);
        render();
      });
    });
  } else {
    mapEl.innerHTML = '<p style="padding:2rem;color:var(--muted)">La carte interactive n’est pas disponible sur ce navigateur. Utilisez la liste.</p>';
  }

  // état initial depuis l'URL (liens du site : ?q=75009, ?near=1, ?dep=93)
  const params = new URLSearchParams(location.search);
  if (params.get('dep')) dep.value = params.get('dep')!;
  if (params.get('q')) {
    input.value = params.get('q')!;
    search();
  } else render(false);
  if (params.get('near')) locate();
}
