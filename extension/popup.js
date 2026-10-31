const API_URL = 'http://127.0.0.1:8765/extract';
const MAX_TAB_PDF_BYTES = 50 * 1024 * 1024; // 50 MB cap on tab-PDF downloads
let blobUrl = null, lastText = "";

// Loopback, link-local, and private-network hosts are never valid tab-PDF
// sources: the tab feature exists to fetch a public PDF the user is viewing,
// not to reach the user's own network from the extension.
function isLocalOrPrivateHost(hostname) {
  const host = (hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host.endsWith('.internal') || host.endsWith('.intranet') || host.endsWith('.lan') ||
      host.endsWith('.home') || host.endsWith('.corp')) return true;
  const bare = host.startsWith('[') ? host.slice(1, -1) : host;
  if (bare.includes(':')) { // IPv6 literal
    if (bare === '::1' || bare === '::') return true;
    if (/^fe[89ab]/.test(bare)) return true; // fe80::/10 link-local
    if (/^f[cd]/.test(bare)) return true;    // fc00::/7 unique-local
    const mapped = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isLocalOrPrivateHost(mapped[1]) : false;
  }
  const parts = bare.split('.');
  if (parts.length === 4 && parts.every(p => /^\d+$/.test(p))) {
    const a = Number(parts[0]), b = Number(parts[1]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;              // link-local
    if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16.0.0/12
    if (a === 192 && b === 168) return true;              // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;    // CGNAT 100.64.0.0/10
  }
  return false;
}

// Strict validation for the "Use current tab PDF URL" path: http(s) only,
// public host only, and the URL path must actually end in .pdf.
function validateTabPdfUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isLocalOrPrivateHost(u.hostname)) return null;
  if (!u.pathname.toLowerCase().endsWith('.pdf')) return null;
  return u.href;
}

// Download a validated tab PDF, enforcing the size cap and verifying the
// response really is a PDF before the bytes go anywhere near the local API.
async function fetchTabPdf(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download the tab PDF (HTTP ' + res.status + ').');
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_TAB_PDF_BYTES) throw new Error('That PDF is over the 50 MB limit for tab downloads.');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_TAB_PDF_BYTES) throw new Error('That PDF is over the 50 MB limit for tab downloads.');
  const ct = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ct === 'application/octet-stream' || ct === 'binary/octet-stream') {
    const head = new Uint8Array(buf.slice(0, 4));
    const isPdf = head.length === 4 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
    if (!isPdf) throw new Error('The tab URL did not return a PDF file.');
  } else if (ct !== 'application/pdf') {
    throw new Error('The tab URL returned "' + (ct || 'an unknown content type') + '", not a PDF.');
  }
  return new File([buf], 'tab.pdf', { type: 'application/pdf' });
}

async function send(file) {
  const fmt = document.getElementById('format').value;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('format', fmt);
  const res = await fetch(API_URL, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('API error ' + res.status + ' - is pdfx-api running?');
  if (fmt === 'json') {
    const j = await res.json();
    lastText = j.text || JSON.stringify(j, null, 2);
    document.getElementById('out').textContent = lastText.slice(0, 8000);
  } else {
    const b = await res.blob();
    if (blobUrl) URL.revokeObjectURL(blobUrl); // release the previous result before replacing it
    blobUrl = URL.createObjectURL(b);
    const a = document.getElementById('dl');
    a.href = blobUrl;
    a.download = 'extracted.' + fmt;
    a.style.display = 'block';
    a.textContent = 'Download result';
    if (fmt === 'txt' || fmt === 'md') {
      lastText = await b.text();
      document.getElementById('out').textContent = lastText.slice(0, 8000);
    }
  }
  document.getElementById('copy').style.display = lastText ? 'block' : 'none';
}

document.getElementById('go').onclick = async () => {
  const f = document.getElementById('file').files[0];
  if (!f) { document.getElementById('out').textContent = 'Pick a PDF file first, or use the tab button.'; return; }
  try { await send(f); } catch (e) { document.getElementById('out').textContent = String(e); }
};
document.getElementById('tab').onclick = async () => {
  const out = document.getElementById('out');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? validateTabPdfUrl(tab.url) : null;
  if (!url) { out.textContent = 'Current tab is not a public http(s) PDF URL.'; return; }
  try { await send(await fetchTabPdf(url)); } catch (e) { out.textContent = String(e); }
};
document.getElementById('copy').onclick = () => navigator.clipboard.writeText(lastText);
