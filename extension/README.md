# Browser extension (MV3)

Load unpacked: chrome://extensions → Developer mode → Load unpacked →
this folder.

Self-contained since 1.1.0: the extraction engine (pdf.js, vendored in
`vendor/`, Apache-2.0) runs inside the extension. There is no
companion app to install and no local API to start. Pick a PDF in the
popup — or use the current tab's PDF, fetched by the browser at your
click under the activeTab grant — then view, copy, or download the
result as `.txt`, `.md`, `.json`, or `.docx` (Word, generated
in-browser). Nothing is uploaded; we operate no server.

Documents over 25 pages open in the workspace tab (`workspace.html`)
in feedreader format — structure and top terms on the left, extracted
text on the right — and extract page by page with a progress bar and
no time limit. Any document can be sent there explicitly with "Open
in workspace". A document routed to the workspace is held in the
browser's own IndexedDB (this device only) until you forget it or
route another.

The free Python package in this repository (CLI `pdfx`, local API
`pdfx-api`, MCP server `pdfx-mcp`) remains available for scripts and
pipelines. The extension does not need it.

The workspace also carries the knowledgebank (file documents or
page ranges into containers with tags; edit, move, delete, export —
all local in IndexedDB), talk-to-the-page (passage retrieval with
citations, phrased by the bundled on-device Qwen2.5-0.5B model in
`vendor/`; 7B-class models downloadable from the in-workspace
catalogue), and the About / Settings area — the only commercial
surface (tip jar, one-time Pro, licence key). Talk is metered at
15 minutes of free use in total; Pro removes the meter. Nothing
about your documents ever leaves the machine.

Note: the bundled model weights (`vendor/models/*/onnx/*.onnx`,
483 MB) are not stored in git (GitHub's file limit) — the store
packages are built from a tree that has them (see
`tools/fetch-model.sh`, SHA-256 pinned), and a package without
them still extracts, files, and answers from retrieval; only the
model phrasing layer stays off.
