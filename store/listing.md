# PDF Extractor (pdfx) — store listing copy (Chrome Web Store / Edge Add-ons / Firefox AMO)

Rewritten 2026-11-05 for the self-contained extension (1.1.0). One copy
set, usable on all three stores; per-store field-length notes are
inline. Copyright (c) 2026 2351485 ALBERTA INC. Licence: MIT. The
product is free; tips are welcome and entirely optional (see Support).

## Name

PDF Extractor (pdfx)

## One-line summary

Extract text, structure & Word files from PDFs — entirely in your browser. Nothing is uploaded.
(95 characters; within Chrome's 132-char summary limit. Same text as
the extension manifest description. It replaces the 1.0.x companion
copy under the owner's copy-truth rule: since 1.1.0 the extraction
engine ships inside the extension, so "in your browser" is the exact
claim.)

## Full description

PDF Extractor (pdfx) takes a PDF and gives you clean text, the
book/document structure (chapters, appendices, sections), a
term/concept index, and decoded metadata — as `.txt`, `.md`, `.docx`
(Word), or `.json`.

**Self-contained: install it and it works.** The extraction engine
(pdf.js) ships inside the extension. There is nothing else to
download, install, or start — no companion app, no local server, no
account. Extraction runs entirely in your browser; nothing is
uploaded anywhere. We operate no server for this product.

Two ways to give it a PDF, both at your explicit click:

- **Pick a file** in the popup. It is processed in the browser and
  never leaves your machine.
- **Use the current tab's PDF** — if the tab you are viewing is a
  PDF, the extension fetches that tab's own PDF (the file your
  browser is already displaying) and extracts it. That fetch is the
  only network request the extension can make: it goes to the exact
  URL of the tab you clicked from, under the activeTab grant, is
  capped at 50 MB, and the response is verified as a PDF by its
  `%PDF` header before use. There is no URL input field and no other
  fetch target in the code.

**Big documents get a room, not a popup.** Documents over 25 pages
open in the workspace — a full browser tab in feedreader format:
structure and top terms on the left, the extracted text on the
right. Extraction there proceeds page by page with a progress bar
and no time limit, so a several-hundred-page book completes instead
of dying against a popup. You can also send any document to the
workspace explicitly from the popup.

**A knowledgebank, not just an extraction.** In the workspace you
can file a document — or any page range of it — into containers
you create (name + colour) with your own tags. Filed items are
fully manageable — save, edit (title, tags, containers, notes, and
the working text itself), move between containers, delete for real
— and their `.json` / `.md` / `.txt` / `.docx` outputs regenerate
from the current text at download time, so outputs are never out
of sync with your edits. Everything lives only in your browser's
local storage (IndexedDB): searchable, filterable by container and
tag, readable in the three-pane bank view, and exportable per item,
per container, or as a whole-bank `.json` / `.md` bundle at any
time. Your bank is never uploaded and never trapped.

**Talk to the page.** In the workspace you can ask questions of the
document or filed item you are reading. Answers are grounded in the
text itself: retrieval over the item's own passages returns the
bearing passages with their page citations (click one to open it,
highlighted, in the reader). A small AI model ships inside the
extension (Qwen2.5-0.5B, Apache-2.0) and runs on your device to
phrase answers from those passages; larger 7B-class models are
available from an in-workspace catalogue, downloaded to your
machine on your click. Only models ever travel — no document
content leaves your machine for this feature, ever. Every feature
is fully available to everyone, on documents of any size; free use
includes 15 minutes of talk in total, after which talk pauses
(it never degrades). Pro — a one-time payment, no subscription —
removes the meter for life. Extraction, filing, and export are
never metered.

**Free, tips only.** PDF Extractor is a free product with no pricing
and no checkout. If it saved you time, tips are welcome (see Support).

**For power users:** the same engine is also a free, open-source
(MIT) Python package — CLI, local API and MCP server — for scripts
and pipelines: https://github.com/nrupala/pdf-extractor. The
extension does not need it; it is there if you want it.

## What's new (1.1.1)

Two fixes, both found by testing 1.1.0 in a real browser:
downloads work again (every download button produced no file),
and popup extraction works again (it failed on every PDF with a
detached-buffer error). This text copies the CHANGELOG entry for
Extension 1.1.1 verbatim, per the update-chain rule.

## Category suggestion

- Chrome Web Store: **Productivity** (alternative: Developer Tools)
- Edge Add-ons: **Productivity**
- Firefox AMO: closest productivity entry offered at submission time
  (AMO's category list is short).

## Permission justifications (for reviewers)

- **`activeTab`** — exercised by exactly one feature: the "Use
  current tab PDF" button. On the user's click it reads the active
  tab's URL via `chrome.tabs.query({active: true, currentWindow:
  true})`, checks it is an http(s) URL whose path ends in `.pdf`,
  and fetches that URL — the PDF the user's browser is already
  displaying — so it can be extracted by the in-extension engine.
  The response is capped at 50 MB and verified by its `%PDF` magic
  bytes before the engine touches it. No other tab data is read at
  any time, no browsing history is accessed, and there is no URL
  input field: the fetch target is always the tab the user invoked
  the action on.
- **`clipboardWrite`** — declared for exactly one action: the Copy
  button writes the extracted text to the clipboard via
  `navigator.clipboard.writeText`, only when the user clicks it.
- **host_permissions — `https://aimlds.org/*` only.** Used by
  exactly two user-initiated features, both in the workspace:
  talk-to-the-page licence validation (sends the licence key the
  user typed and the product id — never document content) and
  model catalogue downloads (the browser fetches model files from
  our host to the user's machine; only models travel). No other
  hosts are declared.
- **No other API permissions.** No storage, history, cookies, or
  scripting permissions are declared. Apart from the activeTab fetch
  above and the licence validation, the extension makes no network
  requests: the extraction engine (pdf.js) is vendored into the
  package, and picked files never leave the machine.
- **Local storage (IndexedDB):** when a document is routed to the
  workspace tab, the popup stores that one document in the
  browser's own IndexedDB (on this device only) so the workspace
  tab can read it; it is replaced by the next routed document and
  removable at any time with the workspace's "Forget document"
  button. Knowledgebank containers, filed items, their generated
  output files, and the licence record likewise live only in
  IndexedDB on this device. Nothing is synced or transmitted.

## Privacy statement (store privacy fields + listing)

PDF Extractor (pdfx) collects **no data for the developer, ever**.

- No personal data, browsing data, file contents, or usage data is
  collected, stored, sold, or transmitted to us or to any analytics,
  telemetry, crash-reporting, advertising, or third-party service.
  We operate no server for this product to send anything to.
- A PDF you pick is processed inside your browser and never leaves
  your machine. The extension can make two network requests, both
  described above: the current-tab fetch (your browser fetching the
  PDF you are already viewing, from the site you are viewing it
  on) and talk-to-the-page licence validation (the key you typed
  and the product id only — no document content). Nothing about
  either is content of yours sent to us; we receive no documents,
  ever.
- A document routed to the workspace, and everything you file into
  the knowledgebank (items, their generated output files, tags,
  containers), is held in the browser's local IndexedDB on your
  device only. Extraction results are otherwise held in page memory
  while the popup or workspace is open.

Single-purpose statement (Chrome): PDF Extractor (pdfx)'s single
purpose is to extract text, structure, and metadata from a
user-selected PDF, computed entirely inside the user's browser.

## Support

- Support email: info@aimlds.org
- Support site: https://aimlds.org
- Project: https://github.com/nrupala/pdf-extractor
- Tips (optional): Buy Me a Coffee — https://www.buymeacoffee.com/nrupalakolt · PayPal — https://paypal.me/nrupalakolkar
