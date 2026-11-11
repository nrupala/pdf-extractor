<!--
SPDX-License-Identifier: MIT
-->

# PDF Extractor (pdfx)

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16394/badge)](https://www.bestpractices.dev/en/projects/16394)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/nrupala/pdf-extractor/badge)](https://scorecard.dev/viewer/?uri=github.com/nrupala/pdf-extractor)
[![REUSE status](https://api.reuse.software/badge/github.com/nrupala/pdf-extractor)](https://api.reuse.software/info/github.com/nrupala/pdf-extractor)
[![Licence](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

Extract text, structure & Word files from PDFs — free, fully local.

PDF Extractor takes a PDF on your own machine and gives you clean text, the
book/document structure (chapters, appendices, sections), a term/concept
index, and decoded metadata — as `.txt`, `.md`, `.docx` (Word), or `.json`.

**Privacy: fully local. Your files never leave your machine.** There is no
cloud, no account, and no upload — the CLI, the local API, the MCP server,
and the browser extension all run on your computer.

## Quickstart

### 1. CLI / package (all platforms)

```bash
pip install git+https://github.com/nrupala/pdf-extractor
pdfx mybook.pdf                      # writes extracted_mybook/ with .txt, .md, .docx, .json
pdfx mybook.pdf --info               # decoded metadata incl. page count
pdfx mybook.pdf --format txt,docx    # choose outputs
pdfx mybook.pdf --engine pypdf2      # page-marked mode (=== PAGE n ===)
```

From a clone: `pip install -e .`

### 2. Local API

```bash
pip install -e ".[api]"
pdfx-api                             # http://127.0.0.1:8765  (localhost by default)
curl http://127.0.0.1:8765/health
curl -F file=@mybook.pdf -F format=json http://127.0.0.1:8765/extract
```

### 3. MCP server (stdio)

```bash
pdfx-mcp
```

Tools: `extract_pdf`, `pdf_metadata`, `pdf_structure`. Point your MCP client
at the `pdfx-mcp` command.

### 4. Browser extension

Load `extension/` unpacked (Developer mode in Chrome/Edge). Since 1.1.0
the extension is self-contained — the extraction engine (pdf.js) ships
inside it; no local app or API needs to be running. Pick a PDF file or
use the current tab's PDF, then view, copy, or download the result
(`.txt` / `.md` / `.json` / `.docx`). Documents over 25 pages open in
a full-tab workspace with a knowledgebank (file documents or page
ranges into containers with tags; edit, move, delete, export — all
local in IndexedDB) and talk-to-the-page (passage retrieval with
citations, phrased by a bundled on-device model; free talk metered at
15 minutes of use, Pro is a one-time lifetime unlock — no
subscription). See `extension/README.md`.

(The bundled model weights are not in git — GitHub's file limit;
`tools/fetch-model.sh` restores them, SHA-256 pinned. The store
packages are built complete.)

### Installers

Release builds (Windows `.exe` + zip / Inno installer, Linux tarball,
macOS tarball) are built by GitHub Actions on release tags and attached to
the GitHub Release — never hand-built.

**iOS:** iOS has no installer model for this kind of tool. The browser
extension + local API are its surfaces — there is no iOS installer artifact,
and we do not fake one.

## Sample output

```
$ pdfx proposal.pdf --info
PDF Metadata:
- pages: 3
- title: …
- author: …
Wrote extracted_proposal/proposal.txt
Wrote extracted_proposal/proposal.md
Wrote extracted_proposal/proposal.docx
Wrote extracted_proposal/proposal.json
Extracted 6,214 characters, 3 pages
```

The JSON output carries `text`, decoded `metadata`, `structure`
(chapters / appendices / sections), and `index` (concepts, term count,
top terms).

## How it works

- Primary engine: **pdfminer.six** (good layout-faithful text).
- Optional **PyPDF2 page-marked mode**: text with `=== PAGE n ===` markers.
- Structure + index layer: heading parser (book/document structure) and a
  concept/term index over the extracted text.
- Metadata values are properly decoded (no raw UTF-16 bytes), and the page
  count is read from the document's pages.

## Support

PDF Extractor is free. If it saved you time, tips are welcome:

- Buy Me a Coffee: https://www.buymeacoffee.com/nrupalakolt
- PayPal: https://paypal.me/nrupalakolkar

## Licence

MIT — Copyright (c) 2026 2351485 ALBERTA INC. See [LICENSE](LICENSE).
