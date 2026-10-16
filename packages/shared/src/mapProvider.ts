/**
 * mapProvider — fondasi Fase 0: abstraksi provider peta OSM vs Google.
 *
 * Selama billing GCP bermasalah, pakai "osm" (100% gratis, tanpa API key):
 * - Tiles: OpenStreetMap standard + CARTO dark_matter (cocok dark theme)
 * - Search/autocomplete: Photon (primer, tanpa key) + Nominatim (fallback)
 * - Reverse geocode (klik peta -> alamat): Nominatim
 * - Routing visual: OSRM public demo + fallback garis lurus haversine
 *
 * Nanti saat billing pulih: set VITE_MAP_PROVIDER=google, kode Google lama
 * langsung aktif lagi. Skema data { lat, lng } tetap sama di kedua provider.
 *
 * Kebijakan fair-use yang WAJIB dipatuhi caller:
 * - Nominatim: max 1 req/detik, sertakan referer/User-Agent "ARO-DRIVE",
 *   debounce input ~300-400ms, cache hasil (lihat geocodeCache helpers).
 * - OSRM public (router.project-osrm.org) adalah demo gratis: jangan polling
 *   agresif, reuse throttle yang sudah ada (update rute jika geser >40m).
 * - Tiles OSM/CARTO wajib tampilkan atribusi (lihat OSM_ATTRIBUTION).
 */

import L from 'leaflet';
import { BLITAR_CENTER, MARKER_ICONS } from './mapConfig';

export type MapProvider = 'osm' | 'google';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SearchResult {
  lat: number;
  lng: number;
  /** Alamat lengkap untuk ditampilkan */
  displayName: string;
  /** Baris utama (nama jalan/tempat) */
  mainText: string;
  /** Baris kedua (kecamatan/kota) */
  secondaryText: string;
  /** 'photon' | 'nominatim' */
  source: string;
}

export interface RouteResult {
  /** Polyline rute sebagai [lat, lng][] */
  coords: LatLng[];
  distanceMeters: number;
  durationSeconds: number;
}

/** Baca provider aktif dari env. Default "osm" agar aman saat billing error. */
export function getMapProvider(): MapProvider {
  try {
    const v = (import.meta.env.VITE_MAP_PROVIDER as string | undefined)?.toLowerCase();
    return v === 'google' ? 'google' : 'osm';
  } catch {
    return 'osm';
  }
}

export function isGoogleMaps(): boolean {
  return getMapProvider() === 'google';
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export const OSM_TILES = {
  standard: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
} as const;

/** Wajib dirender di sudut peta (lisensi ODbL). */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Buat Leaflet icon dari katalog MARKER_ICONS (mapConfig).
 * Selalu pasang icon eksplisit agar tidak kena bug default-icon Leaflet di bundler.
 */
export function createLeafletIcon(type: string): L.Icon | undefined {
  const config = (MARKER_ICONS as Record<string, { url: string; scaledSize: { width: number; height: number }; anchor: { x: number; y: number } }>)[type];
  if (!config) return undefined;
  return L.icon({
    iconUrl: config.url,
    iconSize: [config.scaledSize.width, config.scaledSize.height],
    iconAnchor: [config.anchor.x, config.anchor.y],
  });
}

// ---------------------------------------------------------------------------
// Area default (reuse BLITAR_CENTER dari mapConfig agar satu sumber)
// ---------------------------------------------------------------------------

/** bbox format "minLng,minLat,maxLng,maxLat" untuk Photon/Nominatim. */
export const JATIM_BBOX = '111.0,-8.8,114.6,-6.7';

const PHOTON_BASE = 'https://photon.komoot.io/api/';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

const FETCH_TIMEOUT_MS = 10000;

async function fetchJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Photon search (autocomplete saat mengetik) — primer, tanpa key
// ---------------------------------------------------------------------------

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

function toSearchResultFromPhoton(f: PhotonFeature): SearchResult | null {
  const coords = f.geometry?.coordinates;
  const p = f.properties;
  if (!coords || !p) return null;
  const parts = [p.street, p.district, p.city, p.state].filter(Boolean) as string[];
  const displayName = [p.name, ...parts].filter(Boolean).join(', ');
  if (!displayName) return null;
  return {
    lng: coords[0],
    lat: coords[1],
    displayName,
    mainText: p.name || p.street || displayName,
    secondaryText: parts.join(', '),
    source: 'photon',
  };
}

export async function photonSearch(
  query: string,
  opts: { lat?: number; lon?: number; limit?: number } = {},
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    limit: String(opts.limit ?? 6),
    lang: 'id',
    bbox: JATIM_BBOX,
  });
  if (opts.lat != null && opts.lon != null) {
    params.set('lat', String(opts.lat));
    params.set('lon', String(opts.lon));
  }
  const data = (await fetchJson(`${PHOTON_BASE}?${params.toString()}`)) as {
    features?: PhotonFeature[];
  };
  const out: SearchResult[] = [];
  for (const f of data.features ?? []) {
    const r = toSearchResultFromPhoton(f);
    if (r) out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Nominatim search (fallback) + reverse geocode
// ---------------------------------------------------------------------------

interface NominatimItem {
  lat?: string | number;
  lon?: string | number;
  display_name?: string;
  name?: string;
  address?: Record<string, string>;
}

function splitDisplayName(displayName: string): { main: string; secondary: string } {
  const parts = displayName.split(',').map((s) => s.trim()).filter(Boolean);
  return { main: parts[0] ?? displayName, secondary: parts.slice(1, 3).join(', ') };
}

export async function nominatimSearch(
  query: string,
  opts: { limit?: number } = {},
): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    countrycodes: 'id',
    viewbox: JATIM_BBOX.split(',').join(','),
    bounded: '1',
    addressdetails: '1',
    limit: String(opts.limit ?? 6),
    'accept-language': 'id',
  });
  const data = (await fetchJson(`${NOMINATIM_BASE}/search?${params.toString()}`)) as NominatimItem[];
  const out: SearchResult[] = [];
  for (const item of data ?? []) {
    const lat = toNum(item.lat, NaN);
    const lon = toNum(item.lon, NaN);
    const displayName = item.display_name ?? '';
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !displayName) continue;
    const { main, secondary } = splitDisplayName(displayName);
    out.push({ lat, lng: lon, displayName, mainText: main, secondaryText: secondary, source: 'nominatim' });
  }
  return out;
}

export async function nominatimReverse(lat: number, lng: number): Promise<SearchResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'id',
  });
  const item = (await fetchJson(`${NOMINATIM_BASE}/reverse?${params.toString()}`)) as NominatimItem & {
    error?: string;
  };
  if (!item || item.error || !item.display_name) return null;
  const { main, secondary } = splitDisplayName(item.display_name);
  return {
    lat,
    lng,
    displayName: item.display_name,
    mainText: main,
    secondaryText: secondary,
    source: 'nominatim',
  };
}

/** Search gabungan: coba Photon dulu, fallback ke Nominatim jika kosong/error. */
export async function osmSearch(query: string): Promise<SearchResult[]> {
  try {
    const primary = await photonSearch(query, { lat: BLITAR_CENTER.lat, lon: BLITAR_CENTER.lng });
    if (primary.length > 0) return primary;
  } catch (e) {
    console.warn('[mapProvider] photonSearch gagal, fallback ke nominatim:', e);
  }
  return nominatimSearch(query);
}

// ---------------------------------------------------------------------------
// OSRM routing (visual saja — ongkir tetap haversine lokal)
// ---------------------------------------------------------------------------

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

export async function osrmRoute(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const url =
    `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=full&geometries=geojson`;
  try {
    const data = (await fetchJson(url)) as OsrmResponse;
    const route = data.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (data.code !== 'Ok' || !line || line.length < 2) return null;
    return {
      coords: line.map(([lng, lat]) => ({ lat, lng })),
      distanceMeters: route?.distance ?? 0,
      durationSeconds: route?.duration ?? 0,
    };
  } catch (e) {
    console.warn('[mapProvider] osrmRoute gagal, pakai garis lurus:', e);
    return null;
  }
}

/** Fallback saat OSRM gagal: garis lurus 2 titik (peta tidak blank). */
export function straightLineRoute(from: LatLng, to: LatLng): RouteResult {
  return { coords: [from, to], distanceMeters: 0, durationSeconds: 0 };
}

/** Ambil rute: OSRM dulu, fallback garis lurus. Tidak pernah throw. */
export async function getRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const r = await osrmRoute(from, to);
  return r ?? straightLineRoute(from, to);
}

// ---------------------------------------------------------------------------
// Cache sederhana (localStorage, TTL 7 hari) — hormati fair-use Nominatim
// ---------------------------------------------------------------------------

const CACHE_PREFIX = 'aro_geocode_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(k: string): string {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return `${CACHE_PREFIX}${h.toString(36)}`;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    if (!raw) return null;
    const { exp, val } = JSON.parse(raw) as { exp: number; val: T };
    if (Date.now() > exp) {
      localStorage.removeItem(cacheKey(key));
      return null;
    }
    return val;
  } catch {
    return null;
  }
}

export function setCached(key: string, val: unknown): void {
  try {
    localStorage.setItem(cacheKey(key), JSON.stringify({ exp: Date.now() + CACHE_TTL_MS, val }));
  } catch {
    /* storage penuh — abaikan, fungsi tetap jalan tanpa cache */
  }
}
