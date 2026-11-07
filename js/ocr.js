// On-device OCR with Tesseract.js (SPEC §9.3). Engine, worker and English data are
// vendored under /vendor/tesseract and cached by the service worker — no network, no AI service.
let workerP = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Tesseract) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('OCR engine failed to load'));
    document.head.appendChild(s);
  });
}

const abs = (p) => new URL(p, location.href).href;

export async function getWorker(onProgress) {
  if (!workerP) {
    workerP = (async () => {
      await loadScript(abs('./vendor/tesseract/tesseract.min.js'));
      const w = await window.Tesseract.createWorker('eng', 1, {
        workerPath: abs('./vendor/tesseract/worker.min.js'),
        corePath: abs('./vendor/tesseract/core/'),
        langPath: abs('./vendor/tesseract/lang/'),
        gzip: true,
        logger: (m) => { if (m.status && onProgress) onProgress(`${m.status}${m.progress ? ` ${Math.round(m.progress * 100)}%` : ''}`); },
      });
      await w.setParameters({ tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' });
      return w;
    })().catch((e) => { workerP = null; throw e; });
  }
  return workerP;
}

// boxes: [{ key, canvas }] → { key: { text, confidence } }
export async function ocrBoxes(boxes, onProgress) {
  const w = await getWorker(onProgress);
  const out = {};
  let i = 0; let psm = '7';
  for (const b of boxes) {
    i += 1;
    onProgress?.(`Reading text ${i}/${boxes.length}`);
    if ((b.psm || '7') !== psm) { psm = b.psm || '7'; await w.setParameters({ tessedit_pageseg_mode: psm }); }
    const { data } = await w.recognize(b.canvas);
    out[b.key] = { text: (data.text || '').replace(/\s+/g, ' ').trim(), confidence: data.confidence ?? 0 };
  }
  if (psm !== '7') await w.setParameters({ tessedit_pageseg_mode: '7' });
  return out;
}
