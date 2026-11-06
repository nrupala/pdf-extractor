<!--
SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.

SPDX-License-Identifier: MIT
-->

# PDF Extractor (pdfx) extension — store submission checklists (STAGING ONLY)

Prepared 2026-10-30. Nothing here has been submitted anywhere. No
accounts were created, no fees paid, no listings filed. The owner's
taps (identified per store below) are the only steps Wright cannot do.

## Packages in this folder

| File | Store(s) | Contents |
|---|---|---|
| `pdfx-chrome-edge.zip` | Chrome Web Store, Microsoft Edge Add-ons | `manifest.json`, `popup.html`, `popup.js`, `popup.css`, `icons/icon{16,32,48,128}.png` — manifest at ZIP **root**, no wrapper folder |
| `pdfx-firefox.zip` | Firefox AMO | Same files; manifest additionally carries the Gecko block below |
| `firefox/` | — | The unzipped Firefox staging tree the zip was built from (source `extension/` was NOT modified) |
| `listing.md` | all | Listing copy, permission justifications, privacy statement |
| `GEMINI-CHECK-2026-10-30.md` | gate | Gemini third-party pre-store check (owner's rule: nothing goes online without it) |

Firefox manifest delta (the only code difference between the zips):

```json
"browser_specific_settings": {
  "gecko": { "id": "pdfx@aimlds.org", "strict_min_version": "109.0" }
}
```

MV3 is supported in Firefox 109+, hence `strict_min_version: 109.0`.

SHA-256 (2026-10-30 build):
- `pdfx-chrome-edge.zip` — `15457e8aa75af568ae8deaeaa13cb23bc188499f47e163834ddf48307dcf7e04`
- `pdfx-firefox.zip` — `9f824057b2b32bd8a894479c99faa7a3adf7580a4767952ef7798f00097ea2bd`

SHA-256 (2026-10-30 remediation rebuild — extension v1.0.1, icons
included, 8 entries per zip):
- `pdfx-chrome-edge.zip` — `f7a4408325bc9b774cdd6239798c7f4b99bb036fd1bfa4b2a2c67d1b7a78f464`
- `pdfx-firefox.zip` — `2d14496ad98bc4a854ed3030741955e2d016a4999e1470087948d72d75e84aff`

SHA-256 (2026-10-30 remediation round 2 rebuild — extension v1.0.1,
manual redirect handling in the tab-PDF fetch, 8 entries per zip):
- `pdfx-chrome-edge.zip` — `2898a9f3ea14d67f3f8dfafc9e7ed2c49f8ecae3963ff36ce6b1cfd161792eda`
- `pdfx-firefox.zip` — `a7a9f72daba3623472d8310593d6e735974edad1a26c2b6f68c1c233fa9f351e`

SHA-256 (2026-10-30 remediation round 3 rebuild — extension v1.0.1,
tab fetch moved out of the browser into the local API's
`/extract-url`, 8 entries per zip):
- `pdfx-chrome-edge.zip` — `ae18a1cdfb8eb5f41d193f7fce7ef98b6b7f2de21ee431b1cf2d78264cdb9b6e`
- `pdfx-firefox.zip` — `10b894a5507fc34788886cdb8ee3e37201d2123a261ae80cc1f77b09ceedc189`

## Validation performed on these packages (2026-10-30)

- ZIP integrity (`testzip`) + listing verified for both zips;
  `manifest.json` confirmed at the root of each; no wrapper folder.
- Both packaged manifests parse as valid JSON; MV3 confirmed; package
  name reads exactly **PDF Extractor (pdfx)** in both; the Firefox
  manifest's Gecko block confirmed present, the Chrome/Edge manifest
  confirmed free of it; the source `extension/manifest.json`
  confirmed untouched.
- Packaged `popup.js` is byte-identical to the source file in both
  zips (build copies, never edits).
- **NOT RUN:** `web-ext lint` — web-ext is not installed on this
  machine and nothing was installed to stage these packages. Run it
  (or rely on AMO's upload-time validator, which performs the same
  checks) before the Firefox submission is called final.
- **NOT RUN:** real-browser unpacked load of either package — the
  browser automation available to Wright cannot open
  `chrome://extensions` or loopback pages (recorded in the PDFStruct
  release gate record; same tooling limit). No stub-DOM smoke harness
  exists for this extension (PDFStruct has one; pdfx does not yet).
  Grade accordingly.

## Behaviour notes (from reading popup.js, 2026-10-30)

- Two network paths, both user-initiated by explicit click:
  (1) POST the picked file to `http://127.0.0.1:8765/extract`
  (loopback, the product's own local API); (2) "Use current tab PDF
  URL" — `chrome.tabs.query` (hence `activeTab`, which IS exercised
  here, unlike PDFStruct) reads the active tab's URL, and the
  extension POSTs **the URL itself** to the local API's
  `/extract-url`. The extension never fetches remote content
  (remediation round 3, 2026-10-30 — earlier builds fetched the tab
  PDF in the browser; that path is gone). The local API performs the
  download on the user's own machine under the resolve → classify →
  pin defence recorded in finding #4 below. The listing's privacy
  statement discloses this exactly; a reviewer question about it is
  answered by the user-viewing-the-page fact plus the API-side
  validation, not by claiming the extension is the fetch boundary.
- `popup.js` hardcodes `127.0.0.1:8765`; the manifest also declared
  `http://localhost:8765/*`, which the code never calls. Least-
  privilege reviewers may flag the unused alias (the PDFStruct
  Gemini check flagged the same pattern). — **RESOLVED 2026-10-30:**
  the alias was dropped (see Known findings #2).
- Under Firefox MV3, `host_permissions` are treated as optional,
  user-granted permissions (not granted automatically at install), so
  a Firefox user may need to grant access to `127.0.0.1` before the
  first API call succeeds; until granted, the popup shows its API
  error even when the API is running. Chrome/Edge grant the loopback
  host permission at install.
- Output renders via `textContent` (no `innerHTML` sink); the fetch
  calls carry no timeout; errors are shown raw (they include the
  "is pdfx-api running?" hint). Recorded as observations for the
  submission lane — staging changed no source.

## Known findings before submission

1. **No icon asset exists.** — **RESOLVED 2026-10-30:** icon set
   (16/32/48/128) drawn and wired into the manifest (`icons` +
   `default_icon`); included in both rebuilt zips. (The CWS console
   still wants its own 128×128 upload at submission; the packaged
   `icons/icon128.png` serves.)
2. **Unused `localhost` host alias** — **RESOLVED 2026-10-30:**
   removed from the manifest; `http://127.0.0.1:8765/*` only. The
   same remediation pass also added strict tab-URL validation,
   `clipboardWrite`, object-URL revocation, and the listing
   copy-truth fixes — see the Remediation section of
   `GEMINI-CHECK-2026-10-30.md`. Extension version is now 1.0.1,
   matching the package.
3. **No smoke harness / no browser-load proof** — still open; see
   Validation.
4. **Tab-fetch SSRF / DNS** — **ARCHITECTURE REPLACED 2026-10-30
   (remediation round 3):** rounds 1–2 hardened the browser-side
   fetch (strict hostname validation, then manual redirect
   re-validation), but Gemini's deciding generation held the blocker
   open: hostname validation from extension JavaScript cannot close
   SSRF while DNS resolution is the browser's, beyond the extension's
   control. The fetch therefore no longer happens in the browser at
   all. The extension sends the tab's URL to the local API's
   `POST /extract-url`, and the API — where resolution CAN be
   inspected and pinned — resolves the host with
   `socket.getaddrinfo`, refuses the request if ANY resolved address
   is loopback / private / link-local / multicast / reserved /
   unspecified (ipaddress classification), connects to the validated
   IP directly (hostname used only for the Host header and, for
   HTTPS, the TLS server_hostname, so SNI + certificate verification
   still apply to the real name), follows redirects manually (max 3)
   with the full validation repeated at every hop, and enforces the
   50 MB cap + PDF content-type / `%PDF` magic checks before the
   bytes reach the same extraction path as `/extract`. The
   extension's `validateTabPdfUrl` survives only as a UX pre-check
   and is commented as such — the API is the boundary.
   **Honest limit:** a hostname that resolves publicly at check time
   could in theory re-resolve differently for a DIFFERENT client, but
   this fetch never re-resolves — the connection uses the pinned,
   already-classified IP — so nothing on the fetch path remains for
   DNS rebinding to act on; what is left is trust in the resolver's
   answer at resolution time itself, constrained by the
   classification.

## Chrome Web Store checklist

- [ ] **Owner's tap:** one-time US$5 developer enrolment, paid inside
      the owner's own Google account (his card never passes through
      Wright). Fleet-level enrolment — status per board:2026.0022
      (enrolment ratified and paid 2026-10-30; dashboard identity
      AIMLDS).
- [ ] Upload `pdfx-chrome-edge.zip` in the Developer Dashboard.
- [ ] Paste listing copy from `listing.md`; upload 128×128 icon +
      screenshots (asset gap — see findings).
- [ ] Privacy tab: single-purpose statement + permission
      justifications from `listing.md`; declare **no data collected**.
      The tab-URL download must be described as in `listing.md` —
      do not shorten it to "loopback only".
- [ ] Distribution: public, free.
- [ ] Submit for review; respond to any reviewer query with the
      local-API architecture note (the extension is inert without
      the user's own local API, by design) and the tab-feature
      explanation (at the user's click, the local API downloads the
      page being viewed under the resolve → classify → pin defence;
      the extension fetches nothing remote).

## Microsoft Edge Add-ons checklist

- [ ] Partner Center registration for Edge Add-ons — **free** (owner's
      Microsoft account sign-in; no enrolment fee).
- [ ] Upload the **same** `pdfx-chrome-edge.zip` (Edge is
      Chromium-based; no separate build).
- [ ] Listing copy from `listing.md`; icon/screenshot assets as above.
- [ ] Privacy + permission notes from `listing.md` (loopback API +
      user-initiated tab download disclosed; no data collection).
- [ ] Submit for certification; Edge review is a separate queue from
      Chrome's — passing one store says nothing about the other.

## Firefox AMO checklist

- [ ] Sign in at addons.mozilla.org with the owner's existing Mozilla
      account (personal account is fine — AMO developer accounts are
      individual; the listing shows the AMO **display name**, which is
      set on the AMO profile and does not sync from the Mozilla
      account, so set it deliberately, e.g. AIMLDS).
- [ ] Ensure **two-factor authentication is enabled** on the Mozilla
      account — Mozilla requires 2FA for add-on developer accounts.
- [ ] Accept the AMO Developer Agreement when prompted.
- [ ] Developer Hub → Submit a New Add-on → **On this site** (listed
      distribution) → upload `pdfx-firefox.zip`.
- [ ] AMO's automated validator runs at upload (equivalent coverage to
      `web-ext lint`, which is NOT RUN locally — see Validation).
- [ ] Listing: copy from `listing.md`; set licence MIT;
      support email info@aimlds.org; support site https://aimlds.org.
      Note the "requires additional software" fact honestly: the
      add-on needs the free local pdfx API running (see listing copy).
- [ ] Reviewer notes: local-API architecture, plus the tab-feature
      disclosure (user-initiated; the local API fetches the viewed
      page's PDF under the resolve → classify → pin defence, the
      extension itself fetches nothing remote);
      source is plain, unminified JS (no source-upload obligation
      expected); the Gecko ID is `pdfx@aimlds.org`.
- [ ] **Mozilla signs every build** — the listed version goes live
      only after Mozilla's review + signing; unlisted/self-distributed
      builds are also signed but were not chosen here.
- [ ] Ownership can be transferred or co-owners added later via
      Developer Hub → Manage Authors & License, so starting on the
      personal account does not lock the add-on to it.

---

## Rebuild 2026-11-05 — extension 1.1.0 (self-contained)

The packages above were rebuilt for 1.1.0: the extension is now
self-contained (vendored pdf.js engine, workspace tab, knowledgebank,
talk-to-the-page with a bundled on-device model). Package contents
are now the full extension tree (34 entries: manifest, popup,
workspace, engine/docstore/bank/talk/model scripts, icons, vendor/
including the PDF.js engine, the Transformers.js runtime, and the
Qwen2.5-0.5B model). The `firefox/` staging tree was re-synced from
the same build.

SHA-256 (2026-11-05 build):
- `pdfx-chrome-edge.zip` — `54bb6d5fe281ff354d89ba0eec248204d33af1ca90faa6dbdcb25809e64b91a4` (404,011,648 bytes)
- `pdfx-firefox.zip` — `0ce43812654a132487e16e721d2e41a8c2668dbd934649116ad48842420ff21f` (404,011,735 bytes)

Validation on these packages (2026-11-05): both zips opened and
manifest read back from inside the zip (version 1.1.0; Firefox
carries the gecko block); the bundled model file inside each zip
measures 483,003,582 bytes. NOT RUN: real-browser unpacked load and
`web-ext lint` (no browser/linter in the build environment) —
Wright's pre-submission legs. Store package-size caps (notably
AMO's) must be re-checked at submission time against the ~404 MB
package size.

Store-size verification (2026-11-05, primary sources): Chrome Web
Store maximum package = 2 GB (compliant). Firefox AMO maximum =
200 MB — the full Firefox package exceeds it. Fallback variant
built for the AMO path: `pdfx-firefox-nomodel.zip` — SHA-256
`2821fb8f598fd70cb96bb21a026310b95b8696b643c1f7ac36c651091e196c85`
(9,838,156 bytes) — identical except the bundled model weights are
omitted (the model is then the catalogue's first download). If the
fallback is what ships to AMO, the Firefox listing's bundled-model
wording must be scoped accordingly at submission.

---

## Fix rebuild 2026-11-05 — extension 1.1.1 (defects F1 + F2)

Rebuilt after Wright's real-browser proof of the 1.1.0 packages
(browser proof 2026-11-05) found two defects: F1 — every download
silently produced no file (detached-anchor click); F2 — popup
extraction always failed on a detached ArrayBuffer. Fixes are in
`extension/docstore.js` (shared attached-anchor download helper),
`extension/popup.js` (Blob re-read per pdf.js call) and
`extension/workspace.js` (private helper copy removed); the
Firefox staging tree was re-synced from the same build.

SHA-256 (2026-11-05 fix build):
- `pdfx-chrome-edge.zip` — `14ea551cffa5d77b3d7f7828bc11610fa7e2a9770f8574eeffbcbc26407687e7` (403,373,743 bytes, 34 entries)
- `pdfx-firefox.zip` — `7a96da0ff09823f0c3ba3c4778d9be1df74057a97cffbcdf263ec41558512729` (403,373,831 bytes, 34 entries)
- `pdfx-firefox-nomodel.zip` — `e27048590d66db97f8ce739d2bc42f9ed67bb56e68ea7a60cb7a80bf9ccf8e2d` (9,851,547 bytes, 33 entries)

Validation on these packages: manifest read back from inside
each zip (version 1.1.1; gecko block in the Firefox variants
only); the changed files (docstore.js, workspace.js, popup.js,
manifest.json) are byte-identical to the source tree inside
every zip; the bundled model file inside each full zip measures
483,003,582 bytes. Extension smoke 67 PASS / 0 FAIL (was 54 —
the F1/F2 regression sections are the delta, and they fail
against the shipped 1.1.0 popup.js). NOT RUN here: the
real-browser re-proof — Wright's leg before submission.
