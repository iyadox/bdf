import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// worker MapLibre empaqueté par Vite (avec ses dépendances)
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

maplibregl.setWorkerUrl(workerUrl);

/*
 * Cartes interactives (MapLibre + tuiles libres OpenFreeMap, sans clé d'API).
 * Le fond « dark » est recoloré aux couleurs de la marque.
 */

export type InstallerPoint = {
  slug: string;
  name: string;
  address: string;
  cp: string;
  city: string;
  phone?: string;
  lat: number;
  lng: number;
  premium?: boolean;
  dist?: number;
};

const STYLE = 'https://tiles.openfreemap.org/styles/dark';

function brandify(map: MLMap) {
  const set = (id: string, prop: string, val: unknown) => {
    try {
      if (map.getLayer(id)) map.setPaintProperty(id, prop, val as any);
    } catch {
      /* couche absente */
    }
  };
  set('background', 'background-color', '#060e1b');
  set('water', 'fill-color', '#0a1d33');
  set('waterway', 'line-color', '#0a1d33');
  set('landuse_residential', 'fill-color', '#0a1628');
  set('landcover_wood', 'fill-color', '#0a1729');
  set('landuse_park', 'fill-color', '#0a1729');
  set('building', 'fill-color', '#0b1626');
  set('building', 'fill-outline-color', '#12243a');
  for (const id of ['highway_minor', 'highway_major_inner', 'highway_major_subtle', 'highway_motorway_subtle']) set(id, 'line-color', '#12263f');
  set('highway_motorway_inner', 'line-color', '#1d3b5c');
  set('highway_major_casing', 'line-color', 'rgba(46,104,148,0.35)');
  set('highway_motorway_casing', 'line-color', 'rgba(46,104,148,0.45)');
  set('boundary_country_z0-4', 'line-color', 'rgba(255,102,34,0.55)');
  set('boundary_country_z5-', 'line-color', 'rgba(255,102,34,0.55)');
  set('boundary_state', 'line-color', 'rgba(74,115,150,0.5)');
  for (const id of ['place_city', 'place_city_large', 'place_town', 'place_village', 'place_suburb', 'place_other', 'place_state']) {
    set(id, 'text-color', '#8397ad');
    set(id, 'text-halo-color', 'rgba(3,7,14,0.9)');
  }
  for (const id of ['place_country_major', 'place_country_minor', 'place_country_other']) set(id, 'text-color', '#b9c7d6');
  // libellés en français quand ils existent
  for (const l of map.getStyle()?.layers || []) {
    if (l.type !== 'symbol' || l.id.startsWith('inst-')) continue;
    const tf = (l.layout as any)?.['text-field'];
    if (!tf || JSON.stringify(tf).includes('name:fr')) continue;
    try {
      map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:fr'], ['get', 'name:latin'], ['get', 'name']]);
    } catch {
      /* ignore */
    }
  }
}

export function createMap(container: HTMLElement, opts: { center?: [number, number]; zoom?: number; interactive?: boolean } = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLE,
    ...(opts.center ? { center: opts.center, zoom: opts.zoom ?? 12 } : { bounds: [[-5.3, 41.4], [9.7, 51.2]] as [[number, number], [number, number]], fitBoundsOptions: { padding: 20 } }),
    attributionControl: { compact: true },
    interactive: opts.interactive ?? true,
    cooperativeGestures: window.matchMedia('(pointer: coarse)').matches,
    fadeDuration: 150,
  });
  if (opts.interactive !== false) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  let done = false;
  map.on('styledata', () => {
    if (done || !map.isStyleLoaded()) return;
    done = true;
    brandify(map);
  });
  return map;
}

/** Bâtiments extrudés en 3D (vue inclinée autour du siège). */
export function add3DBuildings(map: MLMap) {
  if (map.getLayer('bdf-3d')) return;
  const style = map.getStyle();
  const src = Object.keys(style.sources).find((k) => (style.sources[k] as any).type === 'vector') || 'openmaptiles';
  const firstSymbol = style.layers.find((l) => l.type === 'symbol')?.id;
  if (map.getLayer('building')) map.setLayoutProperty('building', 'visibility', 'none');
  map.addLayer(
    {
      id: 'bdf-3d',
      type: 'fill-extrusion',
      source: src,
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, '#0c1b2e', 25, '#143050', 60, '#1f4a76'],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    firstSymbol,
  );
}

export function hqMarker(map: MLMap, lngLat: [number, number], label = 'Siège & usine BDF') {
  const el = document.createElement('div');
  el.className = 'hq-marker';
  el.innerHTML = `<span class="hq-marker__hex"><img src="/brand/bdf-mark.svg" alt=""></span><span class="hq-marker__lbl">${label}</span>`;
  return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(lngLat).addTo(map);
}

export function pointMarker(map: MLMap, lngLat: [number, number]) {
  const el = document.createElement('div');
  el.className = 'pt-marker';
  return new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
}

export function toGeoJSON(list: InstallerPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: list.map((i) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [i.lng, i.lat] },
      properties: { slug: i.slug, name: i.name, city: i.city, cp: i.cp, premium: i.premium ? 1 : 0 },
    })),
  };
}

export function addInstallerLayers(map: MLMap, list: InstallerPoint[], onClick: (slug: string) => void) {
  map.addSource('inst', { type: 'geojson', data: toGeoJSON(list), cluster: true, clusterRadius: 46, clusterMaxZoom: 12 });
  map.addLayer({
    id: 'inst-cluster-halo',
    type: 'circle',
    source: 'inst',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#ff6622',
      'circle-opacity': 0.18,
      'circle-radius': ['step', ['get', 'point_count'], 26, 10, 32, 50, 42, 150, 54],
      'circle-blur': 0.6,
    },
  });
  map.addLayer({
    id: 'inst-cluster',
    type: 'circle',
    source: 'inst',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#ff8844', 10, '#ff6622', 50, '#e55510'],
      'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 25, 150, 32],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.85)',
    },
  });
  map.addLayer({
    id: 'inst-count',
    type: 'symbol',
    source: 'inst',
    filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Regular'], 'text-size': 13 },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'inst-point',
    type: 'circle',
    source: 'inst',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['case', ['==', ['get', 'premium'], 1], '#5aa3e0', '#ff6622'],
      'circle-radius': 8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });
  map.addLayer({
    id: 'inst-label',
    type: 'symbol',
    source: 'inst',
    filter: ['!', ['has', 'point_count']],
    minzoom: 11,
    layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1.4], 'text-anchor': 'top' },
    paint: { 'text-color': '#e9f0f7', 'text-halo-color': 'rgba(3,7,14,0.95)', 'text-halo-width': 1.4 },
  });
  map.on('click', 'inst-cluster', async (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: ['inst-cluster'] })[0];
    const src = map.getSource('inst') as GeoJSONSource;
    const zoom = await src.getClusterExpansionZoom(f.properties!.cluster_id);
    map.easeTo({ center: (f.geometry as any).coordinates, zoom });
  });
  map.on('click', 'inst-point', (e) => {
    const f = e.features?.[0];
    if (f) onClick(f.properties!.slug);
  });
  for (const id of ['inst-cluster', 'inst-point']) {
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
  }
}

export function setInstallerData(map: MLMap, list: InstallerPoint[]) {
  const src = map.getSource('inst') as GeoJSONSource | undefined;
  src?.setData(toGeoJSON(list));
}

export function popup(map: MLMap, lngLat: [number, number], html: string) {
  return new maplibregl.Popup({ closeButton: true, maxWidth: '300px', offset: 14, className: 'bdf-popup' }).setLngLat(lngLat).setHTML(html).addTo(map);
}

export function fitTo(map: MLMap, list: { lat: number; lng: number }[], padding = 60) {
  if (!list.length) return;
  const b = new maplibregl.LngLatBounds();
  list.forEach((i) => b.extend([i.lng, i.lat]));
  map.fitBounds(b, { padding, maxZoom: 13, duration: 900 });
}

export { maplibregl };
