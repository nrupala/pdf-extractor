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

---

## Re-check after remediation (2026-10-30)

**Outcome: BLOCK** (per Gemini — verdict line below. Four of the five
original blockers ruled RESOLVED; the tab-fetch SSRF blocker ruled
NOT resolved, and Gemini held the overall verdict at BLOCK.)

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`, default
model `gemini-3.8-flash`; lane proven live with `--list-models`
immediately before the calls — `gemini-3.8-flash` present in the
returned model list). Material put to Gemini, read fresh from the
remediated tree: `extension/manifest.json` (icons wired — manifest
`icons` + action `default_icon`, 16/32/48/128; `host_permissions`
only `http://127.0.0.1:8765/*`; `permissions` `activeTab` +
`clipboardWrite`; version 1.0.1), `extension/popup.js`
(`validateTabPdfUrl` / `isLocalOrPrivateHost` / `fetchTabPdf` strict
validation, `URL.revokeObjectURL` before replacement), the corrected
`store/listing.md` (one-liner "Extract text, structure & Word files
from PDFs — free, processed on your own machine", tab download
disclosed, `clipboardWrite` justification), `CHANGELOG.md` (1.0.1
entry incl. the 2026-10-30 remediation list), and both rebuilt zips
verified before the calls (`pdfx-chrome-edge.zip` SHA-256
`f7a4408325bc9b774cdd6239798c7f4b99bb036fd1bfa4b2a2c67d1b7a78f464`,
`pdfx-firefox.zip` SHA-256
`2d14496ad98bc4a854ed3030741955e2d016a4999e1470087948d72d75e84aff`
— both match the remediation record above; 8 entries each, icons
included, packaged manifest reads 1.0.1 with only the
`127.0.0.1:8765` host permission).

**Lane-delivery note (recorded, not hidden):** the Gemini lane again
truncated generations mid-sentence on most calls (in this session
often within the first one or two lines). The re-check was therefore
run as compact per-area calls with hard brevity instructions and the
requested ruling lines placed FIRST in the reply, repeated until the
rulings were captured complete. Rulings below are Gemini's own
returned lines, verbatim, consistent across repeated generations
where repetition was needed (noted per item). Comment sentences that
the lane clipped are recorded as the fragments actually returned —
nothing was completed, reconstructed, or softened by Wright.

### Gemini's per-blocker rulings (verbatim)

1. **Icons absent (was Gemini 3, blocking-grade): `ICONS: RESOLVED`**
   — returned complete on the third generation of the call. The two
   earlier clipped generations of the same call read, verbatim as
   returned: "Both issues have been properly remediated. The manifest"
   and "Both prior blockers have been verified against the updated"
   (both cut mid-sentence in delivery).
2. **localhost over-declaration (was Gemini 1a/3): `HOSTPERM:
   RESOLVED`** — returned complete in the same generation as the
   ICONS ruling above.
3. **Tab-fetch validation / SSRF (was Gemini 1b, 2, 4a): `SSRF: NOT`**
   — the ruling line `SSRF: NOT` was returned identically in four
   separate generations of the validation call; Gemini did **not**
   accept the strict hostname validation as closing the blocker. Its
   comment text was clipped in every generation; the fragments
   actually returned, verbatim, were: "Host", "DNS", "The SSRF", and
   "`fetch(url)` follows" — i.e. the visible fragments point at
   DNS-based bypass of hostname checks and at `fetch()` following
   redirects past the validated URL. (Recorded as fragments; Wright
   does not complete them.) **Unsanitized MIME (was Gemini 4d):
   `MIME: RESOLVED`** — returned in the same generations.
4. **"Fully local" overclaim (was Gemini 2): `OVERCLAIM: RESOLVED`**,
   and the newly declared clipboard permission: **`CLIPBOARD:
   RESOLVED`** — this call returned untruncated, including Gemini's
   supporting sentence, verbatim: "The updated copy accurately scopes
   network activity to the tab-PDF fetch while maintaining clear
   boundaries around local processing. The clipboardWrite permission
   is narrowly scoped to user-initiated copying of extracted text."
5. **Object-URL leak (was Gemini 4c): `LEAK: RESOLVED`** — returned
   complete on the second generation of the call (the first returned
   only "LEAK:").

### Gemini's re-issued verdict (verbatim)

`VERDICT: BLOCK`

Returned identically at the head of two generations of the verdict
call. The reason sentence was clipped in both; the fragments actually
returned, verbatim, were: "The extension remains blocked due to" and
"The tab" — both consistent with the one unresolved blocker above
(the tab-fetch SSRF ruling) and with nothing else left open.

**State after re-check:** icons, host permission, MIME verification,
copy truth, clipboard declaration, and the object-URL leak are all
RESOLVED per Gemini. The submission remains BLOCKED per Gemini on
the tab-fetch SSRF item: hostname-string validation — however strict
— does not, in Gemini's ruling, close SSRF for a fetch of a
user-viewed tab URL (DNS-resolution and redirect paths sit beyond
the validated string). No source was fixed in this step; remediation
of this remaining item belongs to the submission lane acting on this
record.

---

Re-check filed 2026-10-30 by Wright (registrar for the check; no
finding softened, none fixed in this step).

---

## Remediation round 2 (2026-10-30)

The one surviving blocker from the re-check above — the tab-fetch
SSRF ruling — was addressed at source in `extension/popup.js`.
This section records the fix; it is **not** a new Gemini verdict.
A further Gemini re-check remains the next gate step.

**Redirect defence.** `fetchTabPdf` no longer lets the browser
follow redirects silently. It fetches with `redirect: 'manual'`
and, on a 301, 302, 303, 307, or 308 response, reads the
`Location` header, resolves it against the current URL, and runs
the resolved URL through the full existing `validateTabPdfUrl`
checks — http/https scheme only, loopback / link-local /
private-network host refusal, and a URL path ending in `.pdf` —
before following it. At most **3 hops** are followed. A missing
`Location`, an unresolvable redirect target, any validation
failure, or a fourth redirect stops the download with a
plain-language error. Non-redirect, non-OK responses keep the
previous error handling, and the response that is finally
accepted still goes through the existing final-hop checks:
50 MB cap (Content-Length pre-check and actual byte count),
`application/pdf` content type, or `%PDF` magic bytes when the
content type is generic binary.

**Threat-model honesty (recorded, not claimed away).** A comment
block above `fetchTabPdf` now states the model explicitly: the
starting URL is the URL of the tab the user is viewing and
explicitly invoked the action on; every redirect hop is
re-validated as above; and **DNS resolution itself is performed
by the browser and cannot be pinned or inspected from extension
JavaScript** — the hostname validation is not represented as DNS
pinning. The same honesty was mirrored into the store copy:
`store/listing.md` now states, in the tab-feature disclosure,
that redirects are re-validated hop-by-hop and that the fetch
target is always the tab the user invoked the action on, and
`store/README-STORES.md` records the redirect remediation and
the DNS limit in its findings.

**Verification (2026-10-30):** `node --check extension/popup.js`
passes. A stubbed-`fetch` harness exercised the new logic:
a redirect to a loopback URL was refused, a redirect to a
non-`.pdf` path was refused, a redirect loop stopped after the
3-hop cap, and a relative redirect to a public `.pdf` was
followed and accepted only after the final-hop PDF checks.
Both packages were rebuilt from the fixed source
(`pdfx-chrome-edge.zip` SHA-256
`2898a9f3ea14d67f3f8dfafc9e7ed2c49f8ecae3963ff36ce6b1cfd161792eda`;
`pdfx-firefox.zip` SHA-256
`a7a9f72daba3623472d8310593d6e735974edad1a26c2b6f68c1c233fa9f351e`);
ZIP integrity verified (`testzip` clean), 8 entries in each with
the manifest at the root; the packaged `popup.js` byte-matches
the source in both zips; both packaged manifests read version
**1.0.1**; the Chrome/Edge manifest equals the source manifest,
and the Firefox manifest equals the source manifest plus only
the Gecko block (`pdfx@aimlds.org`, `strict_min_version 109.0`),
re-derived from source for this build. Nothing was pushed to
GitHub in this pass.

---

## Re-check round 2 (2026-10-30)

**Outcome: PASS-WITH-NOTES** (per Gemini — verdict line below. The
single surviving blocker from the round-1 re-check, the tab-fetch
SSRF ruling, was ruled **RESOLVED** in this round.)

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`, default
model `gemini-3.8-flash`; lane proven live with `--list-models`
immediately before the calls — `gemini-3.8-flash` present in the
returned model list). Material put to Gemini, read fresh from the
round-2 tree: `extension/popup.js` (`fetchTabPdf` now fetches with
`redirect: 'manual'`, resolves each `Location` against the current
URL, re-runs the full `validateTabPdfUrl` on every hop, and stops
after 3 hops, on a missing/unresolvable `Location`, or on any
validation failure; the threat-model comment above it states that
DNS resolution is performed by the browser and cannot be pinned or
inspected from extension JavaScript), `store/listing.md` (tab-feature
disclosure now states that every redirect hop is re-validated before
it is followed and that the fetch target is always the tab the user
invoked the action on), `store/README-STORES.md` (finding #4 records
the redirect remediation and the same DNS limit), and both rebuilt
zips verified before the calls (`pdfx-chrome-edge.zip` SHA-256
`2898a9f3ea14d67f3f8dfafc9e7ed2c49f8ecae3963ff36ce6b1cfd161792eda`,
`pdfx-firefox.zip` SHA-256
`a7a9f72daba3623472d8310593d6e735974edad1a26c2b6f68c1c233fa9f351e`
— both match the remediation-round-2 record above; 8 entries each,
manifest at root, ZIP integrity clean; packaged `popup.js`
byte-matches the source in both zips, SHA-256
`5372936ce39b9552ea72407c83db5ef2e185dcca92e2142dea10bf9a015570e2`;
both packaged manifests read version 1.0.1 with only the
`http://127.0.0.1:8765/*` host permission; the Firefox manifest
additionally carries the Gecko block `pdfx@aimlds.org` /
`strict_min_version 109.0`). The redirect defence AND the stated DNS
limit were both put to Gemini in the same prompts, without advocacy.

**Lane-delivery note (recorded, not hidden):** the Gemini lane
truncated generations mid-sentence again in this session, as in
both prior rounds on this product. The re-check was therefore run
as compact ruling-first calls, repeated until the rulings were
captured complete. Rulings below are Gemini's own returned lines,
verbatim. Every comment sentence the lane clipped is recorded as
the fragment actually returned — nothing was completed,
reconstructed, or softened by Wright.

### Gemini's SSRF ruling (verbatim)

`SSRF: RESOLVED` — returned identically at the head of three
separate generations of the SSRF call. The supporting comment was
clipped in all three; the fragments actually returned, verbatim,
were: "The manual" (generation 1), "Manual" (generation 2), and
"The manual redirect handling effectively mitigates the SSRF risk
by va" (generation 3, cut mid-word in delivery).

### Gemini's re-issued verdict (verbatim)

`VERDICT: PASS-WITH-NOTES`

Returned complete at the head of two generations of the verdict
call (generation 1 returned the line followed by blank lines only;
generation 3 returned the line with no further text). One further
generation of the same call returned only the clipped fragment
"VERDICT: PASS-" before cutting off in delivery — consistent with
the complete line, recorded as a fragment.

### The notes attached to the verdict

A dedicated notes call was run three times, asking Gemini which
notes the PASS-WITH-NOTES carries, with the two candidate facts
named in the prompt: (a) DNS resolution is the browser's, cannot be
pinned from extension JavaScript, and is disclosed as such; (b) the
local API is plain HTTP on loopback by design. All three
generations were clipped in delivery; the fragments actually
returned, verbatim, were: "NOTES: (a) Extension relies",
"NOTES: Accepted design: browser handles DNS", and "NOTES: browser".
Every returned fragment points at the DNS/browser note (a); no
returned fragment pointed at (b). (Recorded as fragments; Wright
does not complete them, and does not rule out further note text the
lane did not deliver.)

**State after re-check round 2:** the tab-fetch SSRF blocker — the
last open blocker from the original check — is RESOLVED per Gemini,
with the manual redirect re-validation accepted alongside the
honestly stated DNS limit. Gemini's overall verdict for the
remediated package is PASS-WITH-NOTES (notes as fragmented above).
No source was fixed in this step.

---

Re-check round 2 filed 2026-10-30 by Wright (registrar for the
check; no finding softened, none fixed in this step).

---

## Correction — late-arriving SSRF generation (2026-10-30)

**This section corrects the round-2 section above.** One generation
of the round-2 SSRF call completed in the background and was
delivered to the registrar AFTER the round-2 section was filed.
It returned, verbatim:

`SSRF: NOT`

with the comment fragment actually returned, verbatim:
"Without DNS resolution" (no further text delivered).

The round-2 SSRF tally is therefore NOT unanimous as filed above:
across all generations of the SSRF call delivered in this round,
three returned `SSRF: RESOLVED` and this one returned `SSRF: NOT`,
its fragment pointing at DNS resolution — the limit the code and
listing state honestly (DNS is the browser's and cannot be pinned
from extension JavaScript), which some generations accepted as a
disclosed note and this generation scored as still blocking.

**Corrected state:** the tab-fetch SSRF item is CONTESTED per
Gemini (generations split 3 RESOLVED / 1 NOT), and the
`VERDICT: PASS-WITH-NOTES` recorded above — obtained in calls that
presented round 2 as the SSRF fix — cannot be treated as a clean
pass while the underlying SSRF ruling is split. One deciding SSRF
generation was run on the full round-2 prompt; its result is
recorded in the section following this correction when delivered.
Until a deciding ruling is on file, the registrar's position is:
pdfx does NOT carry a clean Gemini pass on the SSRF item, and the
submission lane should hold on that basis. No source was fixed in
this step.

---

Correction filed 2026-10-30 by Wright (registrar; the late
generation is recorded verbatim, the earlier section stands
uncorrected in place above so the sequence is auditable, and this
correction governs).

---

## Deciding SSRF generation — result (2026-10-30)

The deciding generation promised in the correction above (full
round-2 SSRF prompt: manual redirect re-validation AND the stated
DNS limit, no advocacy) has been delivered. It returned, verbatim:

`SSRF: NOT`

with the comment fragment actually returned, verbatim: "Valid"
(clipped in delivery; no further text returned).

**Final round-2 SSRF tally: 3 generations RESOLVED / 2 generations
NOT**, and the deciding generation — run after the split was known,
on the complete prompt — is on the NOT side. The two NOT fragments
delivered in this round ("Without DNS resolution", "Valid") are
consistent with the round-1 basis for the ruling: hostname-string
validation, even with every redirect hop re-validated, does not in
Gemini's deciding view close SSRF while DNS resolution itself sits
beyond the extension's control.

**Governing state after re-check round 2 (supersedes the
PASS-WITH-NOTES recorded earlier in this file):** the tab-fetch
SSRF blocker is **NOT resolved per Gemini's deciding generation**,
and — it being the only blocker left open from the original check —
the overall Gemini verdict for the pdfx extension reverts to
**BLOCK** on that item. All other original blockers (icons,
localhost host permission, MIME, "Fully local" overclaim,
clipboardWrite, object-URL leak) remain RESOLVED per the round-1
re-check and were not re-opened in this round. Remediation options
for the SSRF item (e.g. removing the tab-fetch feature, or an
architecture Gemini will accept) belong to the submission lane
acting on this record; none was fixed in this step.

---

Deciding result filed 2026-10-30 by Wright (registrar; verdict and
fragments verbatim, nothing softened).

---

## Remediation round 3 (2026-10-30)

The surviving blocker — the tab-fetch SSRF ruling, held open by
Gemini's deciding generation on the DNS basis (hostname validation
from extension JavaScript cannot close SSRF while DNS resolution is
the browser's, beyond the extension's control) — was fixed
**architecturally**: the fetch no longer happens in the browser at
all. This section records the fix; it is **not** a new Gemini
verdict. A further Gemini re-check remains the next gate step.

**Extension (`extension/popup.js`).** `fetchTabPdf` and its network
code are deleted. The "Use current tab PDF URL" button now sends the
tab's URL to the local API's new `POST /extract-url` and renders the
returned extraction through the same result path as the file upload.
`validateTabPdfUrl` / `isLocalOrPrivateHost` survive ONLY as a cheap
UX pre-check (fast, plain-language refusal of an obviously unusable
tab) and are commented as exactly that — explicitly NOT the security
boundary; the comment states the DNS reasoning and names the API as
the boundary. No copy in the popup described the browser downloading
the file any longer (popup.html needed no change; it never did).

**Local API (`src/pdfx/api.py`) — new endpoint `POST /extract-url`.**
Accepts JSON `{"url": ..., "format": ..., "engine": ...}` and returns
the same result shape as `/extract`. The fetch implements, in order:

1. **Validate** — http/https scheme only; embedded credentials
   refused; host required.
2. **Resolve + classify** — `socket.getaddrinfo` resolves the host;
   EVERY returned address is classified with the `ipaddress` module
   (IPv4-mapped IPv6 unwrapped first); if ANY is loopback, private,
   link-local, multicast, reserved, or unspecified, the request is
   refused with a plain 400 message BEFORE any connection is opened.
3. **Pin** — the connection (`http.client`) is opened to the
   validated IP directly. The hostname is sent only as the HTTP
   `Host` header and, for HTTPS, as the TLS `server_hostname`, so
   SNI and certificate verification still apply to the real hostname.
   Nothing on the fetch path re-resolves.
4. **Manual redirects** — 301/302/303/307/308 are followed manually,
   max 3 hops; each `Location` is resolved against the current URL
   and put through steps 1–3 in full before connecting.
5. **Size + type gates** — 50 MB cap via Content-Length pre-check and
   streamed byte count; then `application/pdf` content type required,
   or `%PDF` magic bytes for generic binary content types. No cookies
   or credentials are sent; a plain User-Agent identifies the API.

**Threat model, stated in a comment at the endpoint** (and mirrored
in `store/listing.md` and `store/README-STORES.md`, both rewritten to
the new architecture): the defence is resolve → classify → pin →
manual redirects with re-validation. Its limit, named in the same
comment: a hostname that resolves publicly at check time could in
theory re-resolve differently for a DIFFERENT client — but this
fetch never re-resolves, since the connection uses the pinned,
already-classified IP, so there is no second resolution for DNS
rebinding to act on; what remains is trust in the resolver's answer
at resolution time itself, constrained by the classification.

**Tests (`tests/test_extract_url.py`, new — 17 tests, no real
network).** `socket.getaddrinfo` and the API's connection seam are
monkeypatched; refusal classes proven: private, loopback,
link-local, mixed public+private (fail closed), and IPv4-mapped-IPv6
loopback resolutions all refused before any connection; non-http
scheme refused without resolving; embedded credentials refused;
unresolvable host refused; **redirect to a private address refused
at hop 2** (exactly one connection opened); redirect loop stopped
at the 3-hop cap; non-PDF content type and octet-stream without
`%PDF` magic refused; oversized Content-Length refused; HTTP 404
refused. Happy paths: public HTTPS resolution returns the extraction
JSON for a real (fixture) PDF, with the connection proven pinned to
the validated IP while the Host header carried the real hostname;
octet-stream + magic bytes accepted; a relative redirect followed
and re-validated. The one seam the stubbed tests do not exercise —
the real `_open_connection` socket/TLS wrapping — was verified
separately against a live local HTTP server: the connection went to
the pinned IP and the server received the real hostname in its Host
header. **Full suite: 27 passed** (10 pre-existing + 17 new);
`node --check extension/popup.js` passes.

**Packages rebuilt from the fixed source** (extension version stays
**1.0.1**): `pdfx-chrome-edge.zip` SHA-256
`ae18a1cdfb8eb5f41d193f7fce7ef98b6b7f2de21ee431b1cf2d78264cdb9b6e`;
`pdfx-firefox.zip` SHA-256
`10b894a5507fc34788886cdb8ee3e37201d2123a261ae80cc1f77b09ceedc189`.
ZIP integrity verified (`testzip` clean), 8 entries in each with the
manifest at the root; every packaged non-manifest file byte-matches
source in both zips; the Chrome/Edge manifest is byte-identical to
the source manifest; the Firefox manifest equals the source manifest
plus only the Gecko block (`pdfx@aimlds.org`,
`strict_min_version 109.0`), re-derived from source for this build;
both packaged manifests read version 1.0.1 with only the
`http://127.0.0.1:8765/*` host permission; the packaged `popup.js`
contains no browser-side fetch of remote content (no `fetchTabPdf`,
no manual-redirect code) and posts the tab URL to `/extract-url`.
Nothing was pushed to GitHub in this pass.

**State after remediation round 3:** the SSRF blocker is addressed
by removing the browser from the fetch path entirely — the class of
fix Gemini's deciding position pointed at (hostname validation in
the extension could never suffice while resolution was the
browser's). All other original blockers remain RESOLVED per the
round-1 re-check. A Gemini re-check of the round-3 package is the
submission lane's next step, per the owner's third-party rule; pdfx
does not carry a Gemini verdict on the round-3 architecture yet, and
nothing here represents it as having one.

---

Remediation round 3 filed 2026-10-30 by Wright (submission lane;
fix recorded against the governing BLOCK in the deciding-generation
section above, no earlier section altered).

---

## Re-check round 3 (2026-10-30)

**Outcome: PASS** (per Gemini — verdict line below. The deciding
BLOCK from re-check round 2 is superseded: the tab-fetch SSRF
blocker, held open through rounds 1–2 on the DNS basis, was ruled
**RESOLVED** for the round-3 architecture, and Gemini re-issued the
overall verdict as PASS.)

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`, default
model `gemini-3.8-flash`; lane proven live immediately before the
calls — `--list-models` returned `gemini-3.8-flash` among the
account's models, and the proof call returned `GEMINI LANE LIVE`).
Material put to Gemini, read fresh from the round-3 tree:
`src/pdfx/api.py` (new `POST /extract-url`: `_validate_url` —
http/https only, embedded credentials refused; `_resolve_validated_ip`
— `socket.getaddrinfo`, EVERY returned address classified with
`ipaddress`, IPv4-mapped IPv6 unwrapped, refuse before connecting if
any is loopback/private/link-local/multicast/reserved/unspecified;
`_open_connection` — connects to the pinned validated IP, hostname
only as Host header and TLS `server_hostname`; manual redirects,
max 3 hops, full re-validation per hop; 50 MB cap via
Content-Length + streamed count; `application/pdf` content type or
`%PDF` magic for generic binary; bytes then enter the same
extraction path as `/extract`; the threat-model comment at the
endpoint states the resolve → classify → pin defence and its limit
— the fetch never re-resolves, so no second resolution exists for
DNS rebinding to race, and what remains is trust in the resolver's
answer at resolution time, constrained by the classification),
`extension/popup.js` (browser fetch code deleted — no `fetchTabPdf`,
no manual-redirect code; the tab button POSTs the URL to the local
API's `/extract-url`; `validateTabPdfUrl` / `isLocalOrPrivateHost`
survive only as a UX pre-check, commented as explicitly NOT the
security boundary; the popup's only two `fetch(` calls go to the
loopback API), `tests/test_extract_url.py` (17 network-free tests:
private/loopback/link-local/mixed-fail-closed/IPv4-mapped
resolutions refused before any connection, non-http scheme refused
without resolving, embedded credentials refused, unresolvable host
refused, redirect-to-private refused at hop 2 with exactly one
connection opened, redirect loop stopped at the 3-hop cap, non-PDF
content type / octet-stream without `%PDF` magic / oversized
Content-Length / HTTP 404 refused, and happy paths proving the
connection pinned to the validated IP with the real hostname in the
Host header), `store/listing.md` and `store/README-STORES.md`
(both describe the API-side resolve → classify → pin architecture
and name the extension a non-fetching client), and both rebuilt
zips verified before the calls (`pdfx-chrome-edge.zip` SHA-256
`ae18a1cdfb8eb5f41d193f7fce7ef98b6b7f2de21ee431b1cf2d78264cdb9b6e`,
`pdfx-firefox.zip` SHA-256
`10b894a5507fc34788886cdb8ee3e37201d2123a261ae80cc1f77b09ceedc189`
— both match the remediation-round-3 record above; 8 entries each,
manifest at root, ZIP integrity clean; packaged `popup.js`
byte-matches source in both zips and contains `/extract-url` with
no browser-side remote fetch; both packaged manifests read version
1.0.1 with only the `http://127.0.0.1:8765/*` host permission; the
Firefox manifest additionally carries the Gecko block
`pdfx@aimlds.org` / `strict_min_version 109.0`). The round-1–2 SSRF
history, the deciding BLOCK's DNS basis, and the round-3 stated
limit were all put to Gemini in the prompts, without advocacy.

**Lane-delivery note (recorded, not hidden):** the Gemini lane
truncated generations mid-sentence again in this session, as in
every prior round on this product. The re-check was therefore run
as compact ruling-first calls, repeated until the rulings were
captured complete. Rulings below are Gemini's own returned lines,
verbatim. Every comment sentence the lane clipped is recorded as
the fragment actually returned — nothing was completed,
reconstructed, or softened by Wright.

### Gemini's SSRF ruling (verbatim)

`SSRF: RESOLVED` — returned identically at the head of all three
generations of the SSRF call (3 of 3; no NOT generation was
returned in this round). The supporting comment was clipped in all
three; the fragments actually returned, verbatim, were:
"The companion API" (generation 1, cut in delivery),
"The companion service eliminates DNS reb" (generation 2, cut
mid-word in delivery), and "The architecture now performs explicit
IP" (generation 3, cut in delivery).

### Gemini's re-issued verdict (verbatim)

`VERDICT: PASS`

Returned complete at the head of two generations of the verdict
call, the first of them with its supporting sentences delivered
in full, verbatim: "All previously blocking findings, including
the remote URL fetch SSRF risk, have been verified as resolved in
the rebuilt package and backend architecture. The extension now
complies with all store submission requirements." The second
generation returned the verdict line followed only by the clipped
fragment "All prior blocking issues, including the" (cut in
delivery). One earlier generation of the same call returned only
the fragment "blocking item (tab-fetch SSRF) is now resolved"
(the verdict line itself was not delivered in that generation;
recorded as a fragment, consistent with the PASS lines above).

**State after re-check round 3:** the tab-fetch SSRF blocker —
the last open blocker from the original check, and the item whose
deciding generation reverted the round-2 PASS-WITH-NOTES to
BLOCK — is RESOLVED per Gemini for the round-3 architecture, in
which the fetch no longer happens in the browser at all: the
local API resolves, classifies every address, and connects pinned
to the validated IP, with full re-validation at every redirect
hop. All other original blockers (icons, localhost host
permission, MIME, "Fully local" overclaim, clipboardWrite,
object-URL leak) remain RESOLVED per the round-1 re-check and
were not re-opened in this round. Gemini's overall verdict for
the round-3 package is **PASS**. pdfx now carries a clean Gemini
pass under the owner's third-party rule. No source was fixed in
this step.

---

Re-check round 3 filed 2026-10-30 by Wright (registrar for the
check; verdict and fragments verbatim, nothing softened).
