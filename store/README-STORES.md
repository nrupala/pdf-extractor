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
  extension `fetch`es the PDF **from that remote URL** before handing
  it to the local API. The listing's privacy statement discloses this
  exactly; a reviewer question about it is answered by the
  user-viewing-the-page fact, not by claiming loopback-only traffic.
- `popup.js` hardcodes `127.0.0.1:8765`; the manifest also declares
  `http://localhost:8765/*`, which the code never calls. Least-
  privilege reviewers may flag the unused alias (the PDFStruct
  Gemini check flagged the same pattern). Dropping it is a source
  change for the submission lane to decide on, with a zip rebuild.
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
      explanation (user-initiated download of the page being viewed).

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
      disclosure (user-initiated fetch of the viewed page's PDF);
      source is plain, unminified JS (no source-upload obligation
      expected); the Gecko ID is `pdfx@aimlds.org`.
- [ ] **Mozilla signs every build** — the listed version goes live
      only after Mozilla's review + signing; unlisted/self-distributed
      builds are also signed but were not chosen here.
- [ ] Ownership can be transferred or co-owners added later via
      Developer Hub → Manage Authors & License, so starting on the
      personal account does not lock the add-on to it.
