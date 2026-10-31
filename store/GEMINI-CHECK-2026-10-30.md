# PDF Extractor (pdfx) extension — Gemini pre-store check (2026-10-30)

**Outcome: BLOCK** (per Gemini — verdict line below.)

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`, default
model `gemini-3.8-flash`; one attempt also ran on `gemini-flash-latest`
with the same result shape; lane proven live with `--list-models`
immediately before the calls). Material put to Gemini: the extension
manifest, popup.js, popup.html, and the store listing copy in
`listing.md`, plus verified package facts (both zips contain exactly
manifest.json, popup.html, popup.js, popup.css at the root; the
Firefox manifest additionally carries the Gecko block
`pdfx@aimlds.org` / `strict_min_version 109.0`; no icons declared;
companion local API on 127.0.0.1:8765).

**Lane-delivery note (recorded, not hidden):** the Gemini lane
returned truncated generations on every long call in this session
(~550–660 bytes, cut mid-sentence, on both models tried). The review
was therefore run as one full call (three attempts), four per-area
calls with hard brevity caps (repeated), and a dedicated verdict
call. The findings below are the union of Gemini's own returned
fragments, in Gemini's framing, with nothing completed or softened
by Wright. The verdict line itself was returned complete:
`VERDICT: BLOCK` (a second attempt returned `VERDICT: BLOCK:` with
its reason clause clipped in delivery; the blocking-grade findings
Gemini stated are items 1b, 3a, and 4a below).

This file records Gemini's verdict in Gemini's own framing. It is an
input to the gate, not Wright's edit of it. No source was fixed in
this step.

---

## Gemini's findings

**1. Permissions vs function**
* **Over-declared (least-privilege violation):** `host_permissions`
  entry `http://localhost:8765/*` is never used — `popup.js` strictly
  fetches `http://127.0.0.1:8765/extract`. Gemini: admitting the
  unused alias in the store notes does not exempt it from rejection.
* **Architectural defect — tab fetching:** the extension executes
  `fetch(tab.url)` directly from `popup.js`. Gemini's generations
  flagged the permission architecture as defective: MV3 extension-
  origin requests cannot bypass CORS without the corresponding
  `host_permissions` (the manifest declares loopback hosts only);
  one generation granted that `activeTab` is what lets the code read
  `tab.url` and "temporarily inherit permission to fetch() the PDF
  resource from the active tab's origin," while another held that
  `activeTab` **does not** grant cross-origin `fetch` rights from the
  popup. Either way, Gemini treats the feature's permission basis as
  a defect/risk, not a settled justification.
* `activeTab` itself: accurately matches the tab-URL functionality
  (required to read `tab.url` via `chrome.tabs.query`).

**2. Privacy truthfulness**
* **Overclaim:** the "Fully local" headline contradicts the tab-URL
  feature's remote download (Gemini's framing; the listing body does
  disclose the download — Gemini still scores the headline as an
  overclaim against it).
* **Omission on arbitrary GET requests:** tab-URL validation via
  `.includes('.pdf')` allows requests to arbitrary endpoints —
  including non-PDF tracking pixels or intranet endpoints containing
  `.pdf` in the query — beyond what the listing describes.
* One generated bullet began "Exact match: listing claims loopback
  POST to 1…" before the lane clipped it — i.e., at least the
  loopback-POST claim was being scored an exact match when cut.

**3. Store-review risk**
* **Missing icons (blocking-grade):** "Manifest declares no icons;
  automated store submission validation (CWS/AMO/Edge) will
  immediately fail."
* **Excess permission:** `http://localhost:8765/*` never used (as 1a).

**4. Security**
* **SSRF / arbitrary URL fetch:** weak validation
  (`tab.url.includes('.pdf')`) allows fetching arbitrary schemas
  (`file://`, internal IPs) via `fetch(fileOrUrl)` and exfiltrating
  data to the local API.
* **Insecure local transport:** plain HTTP to `127.0.0.1:8765`
  exposes parsed data to local network eavesdropping or unauthorized
  local processes without authentication/token checks.
* **Resource leak:** successive runs fail to call
  `URL.revokeObjectURL(blobUrl)`, causing memory exhaustion in
  long-lived contexts.
* **Unsanitized MIME types:** assumes response validity without
  verifying upstream `Content-Type`.

**Gemini's verdict line:** `VERDICT: BLOCK`

---

Filed 2026-10-30 by Wright (registrar for the check; no finding
softened, none fixed in this step — remediation belongs to the
submission lane acting on this record).

---

## Remediation (2026-10-30)

All BLOCK findings fixed at source (`extension/`), packages rebuilt
from the fixed source. Extension version bumped 1.0.0 → **1.0.1** to
match the published package version at first submission. Nothing was
submitted in this pass. Per-fix status against Gemini's items:

1. **Icons (Gemini 3, blocking) — FIXED.** Real icon set drawn with
   PIL: warm amber/orange document with white text lines and a
   deep-orange down-arrow badge (visually distinct from PDFStruct's
   navy/teal tree glyph). `extension/icons/icon{16,32,48,128}.png`,
   wired as manifest `icons` + action `default_icon`. No text in the
   glyph; shapes verified legible at 128 and by construction at 16.
2. **Unused host permission (Gemini 1a/3) — FIXED.**
   `http://localhost:8765/*` removed from `host_permissions`;
   `http://127.0.0.1:8765/*` (the only host the code calls) remains.
   `listing.md` justification updated to match.
3. **Tab-fetch validation / SSRF (Gemini 1b, 2, 4a, 4d) — FIXED.**
   The `.includes('.pdf')` check is gone. The tab path now:
   (a) requires scheme http: or https: (file:, data:, chrome: etc.
   rejected); (b) refuses loopback, link-local, and private-network
   hosts (incl. IPv6 loopback/link-local/ULA and IPv4-mapped IPv6);
   (c) requires the URL path to end in `.pdf` (query allowed);
   (d) enforces a 50 MB cap (Content-Length pre-check + actual size);
   (e) requires response Content-Type `application/pdf`, or
   `application/octet-stream`/`binary/octet-stream` with `%PDF` magic
   bytes, before bytes are handed to the local API. `activeTab` +
   `tabs.query` flow kept — it is exercised and justified; the fix is
   validation, not removal. Gemini's CORS/architecture uncertainty
   (1b) is a reviewer-notes matter, not changed by this fix; the
   behaviour is unchanged from what the listing discloses.
4. **Resource leak (Gemini 4c) — FIXED.** `popup.js` now calls
   `URL.revokeObjectURL` on the previous result's object URL before
   creating its replacement, on every run.
5. **Clipboard (Gemini-adjacent; listing accuracy) — FIXED via the
   declared-permission route.** `clipboardWrite` added to manifest
   `permissions`, with a one-line justification in `listing.md` (Copy
   button, `navigator.clipboard.writeText`, click-only). The listing's
   previous "no clipboardWrite declared" text was corrected.
6. **Copy truth (Gemini 2, "Fully local" overclaim) — FIXED.**
   `listing.md` one-liner is now "Extract text, structure & Word
   files from PDFs — free, processed on your own machine." and the
   description headline reads "Local processing, no cloud" with the
   tab download disclosed in the same paragraph. The manifest
   description's unqualified "Fully local." was likewise replaced
   ("Extraction runs on your own machine."). **Owed elsewhere:**
   `~/workspace/store-program/CANONICAL-SHEET.md` §2 still carries the
   old one-liner as canonical — it needs the same replacement, and
   the README retains "fully local" phrasing for the package as a
   whole (package-level claim; the CLI/API/MCP surfaces are local —
   flagged, not changed in this pass).

**Not addressed (recorded, not hidden):** Gemini 4b — plain HTTP to
`127.0.0.1:8765` with no token — is the product's local-API design
(loopback-only companion API, same pattern as the rest of the fleet);
no change in this pass.

**Verification:** `node --check extension/popup.js` passes; both zips
rebuilt from source (`pdfx-chrome-edge.zip` SHA-256
`f7a4408325bc9b774cdd6239798c7f4b99bb036fd1bfa4b2a2c67d1b7a78f464`;
`pdfx-firefox.zip` SHA-256
`2d14496ad98bc4a854ed3030741955e2d016a4999e1470087948d72d75e84aff`);
zip contents verified (8 entries each, manifest at root, icons
included); packaged `popup.js`/`popup.html`/`popup.css`/icons
byte-match source in both zips; the Firefox manifest equals the
source manifest plus only the Gecko block (`pdfx@aimlds.org`,
`strict_min_version 109.0`); packaged version reads 1.0.1 in both.
**pdfx has no stub-DOM smoke harness** (PDFStruct has one) and no
real-browser load was run — unchanged from the pre-remediation state;
graded accordingly. A Gemini re-check of the remediated package is
the submission lane's next step, per the owner's third-party rule.
