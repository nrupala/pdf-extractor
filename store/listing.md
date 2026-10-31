# PDF Extractor (pdfx) — store listing copy (Chrome Web Store / Edge Add-ons / Firefox AMO)

Prepared 2026-10-30. One copy set, usable on all three stores; per-store
field-length notes are inline. Copyright (c) 2026 2351485 ALBERTA INC.
Licence: MIT. The product is free; tips are welcome and entirely
optional (see Support).

## Name

PDF Extractor (pdfx)

## One-line summary

Extract text, structure & Word files from PDFs — free, processed on your own machine.
(85 characters; within Chrome's 132-char summary limit. This replaces
the earlier "fully local" one-liner under the owner's copy-truth rule
(2026-10-30): the tab-PDF path downloads from the remote page being
viewed, so "fully local" unqualified was an overclaim. CANONICAL-SHEET
§2 is owed the same replacement — flagged in the remediation record.)

## Full description

PDF Extractor (pdfx) takes a PDF on your own machine and gives you
clean text, the book/document structure (chapters, appendices,
sections), a term/concept index, and decoded metadata — as `.txt`,
`.md`, `.docx` (Word), or `.json`.

**Local processing, no cloud.** There is no account, and no upload to
any server of ours — we operate no server. Extraction runs on your own
machine; the one network download the extension ever makes is the
tab-PDF fetch described below, from the page you are already viewing
to your own browser. The extension does nothing on
its own: it hands the PDF to the free pdfx API running on your own
computer (`pdfx-api`, 127.0.0.1:8765) and shows you what comes back —
read the extracted text in the popup, copy it, or download the result
file.

Two ways to give it a PDF, both at your explicit click:

- **Pick a file** in the popup — it is sent to your local API only.
- **Use the current tab's PDF URL** — if the tab you are viewing is a
  PDF, the extension downloads that PDF from the site you are already
  viewing and passes it to your local API.

**What you need:** the free, open-source (MIT) PDF Extractor package
installed on the same computer, with its local API running:

- Project: https://github.com/nrupala/pdf-extractor
- Start the API with one command: `pdfx-api`

If the API is not running, the popup shows an error telling you so —
it never fails silently.

**Free, tips only.** PDF Extractor is a free product with no pricing
and no checkout. If it saved you time, tips are welcome (see Support).

## Category suggestion

- Chrome Web Store: **Productivity** (alternative: Developer Tools)
- Edge Add-ons: **Productivity**
- Firefox AMO: closest productivity entry offered at submission time
  (AMO's category list is short).

## Permission justifications (for reviewers)

- **`activeTab`** — exercised by exactly one feature: the "Use current
  tab PDF URL" button calls `chrome.tabs.query({active: true,
  currentWindow: true})` to read the active tab's URL, strictly
  validates it (http/https scheme only; loopback, link-local, and
  private-network hosts refused; the URL path must end in `.pdf`),
  downloads that PDF, verifies the response is a PDF (content type,
  with a `%PDF` magic-byte check on generic binary responses) under a
  50 MB cap, and hands it to the user's local API. No tab data is
  read at any other time, and no browsing history is accessed.
- **host_permissions — `http://127.0.0.1:8765/*` only.** Loopback
  only, on the one fixed port of the product's local API — the only
  host the code calls. The extension POSTs the PDF (picked file, or
  the tab PDF described above) to the API the user runs on their own
  machine and reads the extracted result.
- **`clipboardWrite`** — declared for exactly one action: the Copy
  button writes the extracted text to the clipboard via
  `navigator.clipboard.writeText`, only when the user clicks it.
- **No other API permissions.** No storage, history, cookies, or
  scripting permissions are declared or used.

## Privacy statement (store privacy fields + listing)

PDF Extractor (pdfx) collects **no data for the developer, ever**.

- No personal data, browsing data, file contents, or usage data is
  collected, stored, sold, or transmitted to us or to any analytics,
  telemetry, crash-reporting, advertising, or third-party service.
  We operate no server for this product to send anything to.
- A PDF you pick in the popup is sent only to the pdfx API running on
  your own machine (`http://127.0.0.1:8765`), which processes it
  locally and keeps nothing after responding.
- The one non-loopback request the extension can ever make happens
  only when you click "Use current tab PDF URL": it downloads the PDF
  from the very page you are viewing, so it can hand that file to your
  local API. The download goes from the site to your browser — nothing
  about it is sent to us.
- Extracted text is held only in the popup's memory while the popup is
  open (so you can read, copy, or download it). The extension uses no
  persistent storage.

Single-purpose statement (Chrome): PDF Extractor (pdfx)'s single
purpose is to extract text, structure, and metadata from a
user-selected PDF, computed by the user's own local pdfx API.

## Support

- Support email: info@aimlds.org
- Support site: https://aimlds.org
- Project: https://github.com/nrupala/pdf-extractor
- Tips (optional): Buy Me a Coffee — https://www.buymeacoffee.com/nrupalakolt · PayPal — https://paypal.me/nrupalakolkar
