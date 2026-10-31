# Changelog

All notable changes to PDF Extractor (pdfx) are recorded in this file,
in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

Version anchors: the package version lives in `pyproject.toml`; the
browser extension version lives in `extension/manifest.json`. Under the
owner's rule, every version bump carries its entry in this file in the
same commit — this file is the start of that chain.

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
