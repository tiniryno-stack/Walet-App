// Device-wide image library in IndexedDB (SPEC §8). Tickets reference images by imageId.
import { IMAGE_DB } from './constants.js';
import { uid } from './store.js';

let dbp = null;
const urlCache = new Map();

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(IMAGE_DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('images', { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('images', mode);
    const store = t.objectStore('images');
    const out = fn(store);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
  }));
}

export async function putImage(blob, name = '', id = uid('img')) {
  await tx('readwrite', (s) => s.put({ id, blob, name, type: blob.type, added: Date.now() }));
  urlCache.delete(id);
  return id;
}

export async function getImage(id) {
  if (!id) return null;
  return tx('readonly', (s) => s.get(id));
}

export async function listImages() {
  const all = await tx('readonly', (s) => s.getAll());
  return (all || []).sort((a, b) => b.added - a.added);
}

export async function deleteImage(id) {
  await tx('readwrite', (s) => s.delete(id));
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
}

// Synchronous lookup for rendering; returns null until warmed.
export const cachedUrl = (id) => (id ? urlCache.get(id) || null : null);

export async function imageUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await getImage(id);
  if (!rec) return null;
  const u = URL.createObjectURL(rec.blob);
  urlCache.set(id, u);
  return u;
}

export async function warm(ids) {
  await Promise.all([...ids].map((id) => imageUrl(id).catch(() => null)));
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function exportImages(ids) {
  const map = {};
  for (const id of ids) {
    const rec = await getImage(id);
    if (rec) map[id] = await blobToDataUrl(rec.blob);
  }
  return map;
}

export async function importImages(map) {
  for (const [id, dataUrl] of Object.entries(map || {})) {
    const blob = await dataUrlToBlob(dataUrl);
    await putImage(blob, '', id);
  }
}
