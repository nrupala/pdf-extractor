# Changelog

All notable changes to PDF Extractor (pdfx) are recorded in this file,
in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

Version anchors: the package version lives in `pyproject.toml`; the
browser extension version lives in `extension/manifest.json`. Under the
owner's rule, every version bump carries its entry in this file in the
same commit — this file is the start of that chain.

## [Extension 1.1.1] — 2026-11-05

Two fixes, both found by testing 1.1.0 in a real browser:
downloads work again (every download button produced no file),
and popup extraction works again (it failed on every PDF with a
detached-buffer error).

### Fixed

- Downloads produced no file anywhere in the extension —
  workspace document downloads, knowledgebank item downloads and
  bank/container exports all went through a helper that clicked
  an anchor never attached to the document, which Chrome
  extension pages ignore (browser proof 2026-11-05, defect F1).
  The helper now lives in one place (`docstore.js`, loaded by
  both pages), attaches the anchor before clicking and removes
  it after; if a download still cannot start, the page says so
  visibly instead of failing silently.
- Popup extraction always failed with "An ArrayBuffer is
  detached and could not be cloned": pdf.js transfers the buffer
  handed to it to its worker, and the popup spent one buffer on
  the page-count probe and then tried to extract from it
  (browser proof 2026-11-05, defect F2). The popup now keeps the
  PDF as a Blob and reads fresh bytes for every pdf.js call —
  the pattern the workspace already used — on both entry points
  (picked file and current-tab PDF).

## [Extension 1.1.0] — 2026-11-05

The extension is now self-contained: the extraction engine runs
entirely in your browser (no companion app to install or start),
large documents open in a full-tab workspace with page-by-page
progress and no time limit, and Word (.docx) export is generated
in the browser.

### Added

- In-browser extraction engine (pdf.js, vendored into the
  extension) producing the same document shape as the Python
  engine: text, decoded metadata, page count, structure
  (chapters/appendices/sections), term/concept index.
- Workspace tab in feedreader format — structure and top terms on
  the left, extracted text on the right — with `.txt` / `.md` /
  `.json` / `.docx` downloads. Documents over 25 pages route here
  automatically; any document can be sent explicitly.
- Page-by-page progress in the popup and the workspace. There is
  no timeout on extraction.
- Knowledgebank in the workspace: file a document or any page
  range into user-created containers (name + colour) with tags;
  full management (save, save-as, edit title/tags/containers/
  notes/working text, move, real delete; container delete with
  move-out or delete-with choice); outputs (`.json` / `.md` /
  `.txt` / `.docx`) regenerate from the item's current text at
  download; per-item, per-container and whole-bank export.
  Local IndexedDB only.
- Talk to the page: passage retrieval indexed at filing time,
  answers with clickable citations that open the passage in the
  reader; a bundled on-device model (Qwen2.5-0.5B-Instruct,
  Apache-2.0, via vendored Transformers.js) phrases answers from
  the retrieved passages, with a downloadable 7B-class model
  catalogue (models only ever travel; documents never leave).
  Free talk is metered at 15 minutes of use in total and then
  pauses; Pro (one-time, lifetime, no subscription) removes the
  meter. No feature is size-gated.
- About / Settings area: the only commercial surface — tip jar
  (gratitude, whenever and as often as you wish), Pro purchase,
  and the licence-key field live there and nowhere else.

### Removed

- The companion local API dependency: the extension no longer
  contacts the loopback API, and the manifest drops its loopback
  `host_permissions`. The Python package's CLI, local API and MCP
  surfaces are unchanged and remain available for power users.

### Changed

- "Use current tab PDF": the extension now fetches the active
  tab's own PDF itself, at the user's click under `activeTab`
  (50 MB cap, `%PDF` magic bytes verified), instead of handing
  the URL to a local API to fetch.

## [1.0.1] — 2026-10-26

First open-source release (MIT), published 2026-10-26.

*Backfill note (2026-10-30): this entry was written after the fact from
the product's shipped record — the README and the release workflow in
this repository. No git history was available in the working tree to
separate a distinct 1.0.0 delta, so none is invented; 1.0.1 is recorded
as the first public release, which is what the record supports.*

### Added

- CLI (`pdfx`): extract a PDF to `.txt`, `.md`, `.docx` (Word), and
  `.json` outputs in an `extracted_<name>/` folder; `--info` for
  decoded metadata including page count; `--format` to choose outputs;
  `--engine pypdf2` page-marked mode (`=== PAGE n ===`).
- Local API (`pdfx-api`): FastAPI service on `127.0.0.1:8765` with
  `/health` and `/extract`.
- MCP server (`pdfx-mcp`): stdio tools `extract_pdf`, `pdf_metadata`,
  `pdf_structure`.
- Browser extension (MV3, `extension/`): pick a PDF file, or use the
  current tab's PDF URL; view, copy, or download the extracted result.
  Requires the local API running.
- Extraction core: pdfminer.six primary engine (layout-faithful text);
  PyPDF2 page-marked mode; heading parser producing the book/document
  structure (chapters, appendices, sections); term/concept index;
  properly decoded metadata (no raw UTF-16 bytes) with page count read
  from the document's pages.
- Release builds by GitHub Actions on release tags (Windows `.exe` +
  zip / Inno installer, Linux tarball, macOS tarball), attached to the
  GitHub Release — never hand-built.

### Extension store remediation — 2026-10-30

Extension version aligned to **1.0.1** to match the package at first
store submission (fixes from the Gemini pre-store check, which returned
BLOCK on the 1.0.0 package; see `store/GEMINI-CHECK-2026-10-30.md`):

- Added an icon set (16/32/48/128) wired into the manifest (`icons`
  and the action's `default_icon`); the manifest previously declared
  no icons, which store validation rejects outright.
- Removed the declared-but-never-called `http://localhost:8765/*` host
  permission; `http://127.0.0.1:8765/*` is the only host permission.
- Declared `clipboardWrite`, used by the popup's Copy button
  (`navigator.clipboard.writeText`, click-only).
- Security: the tab-PDF path now strictly validates the URL
  (http/https only; loopback, link-local, and private-network hosts
  refused; path must end in `.pdf`), enforces a 50 MB download cap,
  and verifies the response is a PDF (content type, with a `%PDF`
  magic-byte check on generic binary responses) before handing bytes
  to the local API. The previous check accepted any URL whose string
  contained ".pdf".
- Fixed an object-URL leak: the previous download URL is revoked
  before a new result replaces it.
- Store listing copy corrected: the "fully local" headline is
  qualified — the tab path downloads the PDF from the remote page the
  user is viewing; extraction itself runs on the user's machine.

### Extension store remediation round 3 — 2026-10-30

Extension version remains **1.0.1** (pre-submission; nothing has been
submitted yet). The tab-fetch architecture was replaced after the
Gemini re-check's deciding generation held the SSRF blocker open
against rounds 1–2: hostname validation from extension JavaScript
cannot close SSRF while DNS resolution is the browser's, beyond the
extension's control.

- The browser extension no longer fetches the tab PDF at all. The
  "Use current tab PDF URL" button sends the tab's URL to the local
  API's new `POST /extract-url` endpoint and renders the returned
  extraction. The extension's URL validation survives only as a UX
  pre-check, commented as not the security boundary.
- The local API now performs the download where resolution can be
  inspected and pinned: it resolves the host, refuses the request if
  ANY resolved address is loopback, private, link-local, multicast,
  reserved, or unspecified, connects to the validated IP directly
  (hostname used only for the Host header and TLS server name),
  follows redirects manually (max 3) with the full validation
  repeated at every hop, enforces the 50 MB cap, and verifies the
  PDF content type / `%PDF` magic bytes before the bytes reach the
  same extraction path as `/extract`. No cookies or credentials are
  sent.
- Store listing and submission notes rewritten to the new
  architecture (the local API fetches and validates; the extension
  never fetches remote content).
