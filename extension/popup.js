const API_BASE = 'http://127.0.0.1:8765';
const API_URL = API_BASE + '/extract';
const EXTRACT_URL_ENDPOINT = API_BASE + '/extract-url';
let blobUrl = null, lastText = "";

// --- Tab-URL pre-check (UX only — NOT the security boundary) -------------
// The checks in this section exist ONLY to give a fast, plain-language
// error when the current tab obviously is not a public PDF (wrong scheme,
// intranet host, path not ending in .pdf). They are not the security
// boundary and are not represented as one: hostname validation in
// extension JavaScript cannot close SSRF, because DNS resolution happens
// inside the browser, beyond the extension's control — a name that
// validates can still resolve, or be redirected, to a loopback or
// private address (Gemini pre-store check, deciding generation,
// 2026-10-30). The boundary is the local API's POST /extract-url: the
// extension sends it the tab's URL, and the API resolves the host
// itself, refuses the request if ANY resolved address is non-public,
// pins the connection to the validated IP, and re-validates every
// redirect hop in full before following it. The extension never fetches
// remote content itself.

// Loopback, link-local, and private-network hosts are never plausible
// tab-PDF sources, so the pre-check rejects them for a clear message.
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

// Pre-check for the "Use current tab PDF URL" path: http(s) only, public
// host only, and the URL path must actually end in .pdf. The API applies
// the real validation to whatever this returns (see the boundary note
// above); failing here just fails faster and clearer.
function validateTabPdfUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isLocalOrPrivateHost(u.hostname)) return null;
  if (!u.pathname.toLowerCase().endsWith('.pdf')) return null;
  return u.href;
}

// Render one API response (shared by the file path and the tab-URL path).
// The API's own error message is preferred when it sends one — /extract-url
// refuses with plain-language reasons the user should see verbatim.
async function showResult(res, fmt) {
  if (!res.ok) {
    let msg = 'API error ' + res.status + ' - is pdfx-api running?';
    try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (e) { /* keep the default */ }
    throw new Error(msg);
  }
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

async function send(file) {
  const fmt = document.getElementById('format').value;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('format', fmt);
  const res = await fetch(API_URL, { method: 'POST', body: fd });
  await showResult(res, fmt);
}

// The tab path downloads nothing in the browser: the tab's URL goes to the
// local API, which fetches and validates it on the user's own machine
// (resolve -> classify -> pin -> re-validated redirects; see the boundary
// note at the top) and returns the extraction result.
async function sendTabUrl(url) {
  const fmt = document.getElementById('format').value;
  const res = await fetch(EXTRACT_URL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url, format: fmt }),
  });
  await showResult(res, fmt);
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
  try { await sendTabUrl(url); } catch (e) { out.textContent = String(e); }
};
document.getElementById('copy').onclick = () => navigator.clipboard.writeText(lastText);
