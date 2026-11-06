<!--
SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.

SPDX-License-Identifier: MIT
-->

# PDF Extractor (pdfx) extension 1.1.0 — Gemini pre-store check (2026-11-05)

**Outcome: SATISFACTORY WITH FINDINGS** (Gemini's verdict; the
dispositions below are Wright-side, each grounded in the code or
in a primary source checked the same day.)

Reviewer: Gemini, via the fleet's Gemini connector lane
(`~/workspace/custom-connectors/custom.gemini/bin/gemini.py`,
default model; lane proven live with `--list-models` immediately
before the call). Material put to Gemini: the final manifest, the
package facts (34 entries; vendored pdf.js / Transformers.js /
ONNX Runtime WASM + Qwen2.5-0.5B weights, all licences named; zip
404,011,648 bytes), the full fetch surface of the extension JS,
the licence/meter logic anchors, and the listing's permission and
privacy sections.

## Gemini's findings and their dispositions

1. **Package size (404 MB) will draw review scrutiny; document
   the offline-AI reason in the submission.** ACCEPTED as a
   submission note for Wright's press (a reviewer note explaining
   the bundled on-device model). On limits, verified against
   primary sources the same day: the Chrome Web Store's maximum
   package size is **2 GB** (Chrome's own documentation) — the
   package is compliant there. **Firefox AMO's maximum is
   200 MB** (Mozilla Extension Workshop, "Submitting an add-on")
   — the full Firefox package exceeds it; see the gate record
   for the fallback variant and the open ruling.
2. **`fetch(url, {credentials: "include"})` in popup.js could be
   a proxy/CSRF vector "if url can be any PDF URL".** The premise
   is factually bounded in the code: the URL is only ever the
   active tab's own URL, obtained from `chrome.tabs.query` under
   the activeTab grant after the user's click; no user- or
   page-supplied URL exists anywhere in the extension (no URL
   input field, by design). No code change; the listing's
   justification already states this boundary.
3. **WASM libraries must be strictly vendored, never CDN-loaded.**
   TRUE of the build: pdf.js, Transformers.js and the ONNX
   Runtime WASM are vendored in `vendor/`; the model loader sets
   `allowRemoteModels = false` and local paths only. The only
   remote fetches of files are model *data* files from our own
   catalogue host on explicit user click (licence validation is
   the other call). No change.
4. **"Google prohibits paid unlocks except via the Chrome Web
   Store Payments API."** OUTDATED premise: the CWS payments API
   was shut down by Google (2022); the current accepted pattern
   for extensions is exactly this one — purchase on the vendor's
   site, licence key in the extension. Recorded as noted; Wright
   to confirm current policy wording at submission.
5. **"Nothing is uploaded" should be nuanced re the tab fetch.**
   The listing already carries the nuance: the tab fetch is
   described as carrying the user's session for that site
   "exactly like opening the PDF in the browser", and the
   no-upload claim is scoped to the developer throughout ("No PDF
   is uploaded to us or anywhere"). No change.
