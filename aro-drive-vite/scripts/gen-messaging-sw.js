/**
 * gen-messaging-sw.js — Fase 0
 *
 * Mengisi placeholder di public/firebase-messaging-sw.js dengan nilai dari
 * aro-drive-vite/.env (atau environment) setiap kali build dijalankan.
 *
 * Dipanggil otomatis via `prebuild` (lihat package.json). Tanpa ini, service
 * worker FCM berisi REPLACE_WITH_YOUR_* dan background push tidak akan jalan.
 *
 * Catatan: Firebase Web API key memang dirancang publik (selalu ada di JS
 * bundle). Yang membatasi akses adalah Security Rules + App Check, bukan key.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const swPath = join(root, 'public', 'firebase-messaging-sw.js');

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fileEnv = parseEnvFile(envPath);
const pick = (k) => process.env[k] || fileEnv[k] || '';

const mapping = {
  REPLACE_WITH_YOUR_API_KEY: pick('VITE_FIREBASE_API_KEY'),
  REPLACE_WITH_YOUR_AUTH_DOMAIN: pick('VITE_FIREBASE_AUTH_DOMAIN'),
  REPLACE_WITH_YOUR_PROJECT_ID: pick('VITE_FIREBASE_PROJECT_ID'),
  REPLACE_WITH_YOUR_STORAGE_BUCKET: pick('VITE_FIREBASE_STORAGE_BUCKET'),
  REPLACE_WITH_YOUR_MESSAGING_SENDER_ID: pick('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  REPLACE_WITH_YOUR_APP_ID: pick('VITE_FIREBASE_APP_ID'),
};

let content = readFileSync(swPath, 'utf8');
let missing = [];
for (const [placeholder, value] of Object.entries(mapping)) {
  if (!content.includes(placeholder)) continue;
  if (!value) {
    missing.push(placeholder);
    continue;
  }
  content = content.split(placeholder).join(value);
}

if (missing.length > 0) {
  console.warn(
    `[gen-messaging-sw] LEWATI inject (${missing.length} placeholder belum ada nilainya di .env): ${missing.join(', ')}. ` +
      'Background FCM push nonaktif sampai .env dilengkapi — app tetap jalan normal.'
  );
} else {
  writeFileSync(swPath, content);
  console.log('[gen-messaging-sw] firebase-messaging-sw.js terisi dari .env, siap build.');
}
