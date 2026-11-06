# aimlds.org page copy — /products/pdf-extractor (PREPARED 2026-11-05, NOT DEPLOYED)

Status: release-prep deliverable for the extension 1.1.0 rebuild.
Wright deploys through the gated site route; nothing here is live
until he does. Copy is written for the public page (product voice).

---

## Hero

**PDF Extractor (pdfx)**

Pull the text, metadata, structure and index out of any PDF —
entirely in your browser. Install it, pick a file, and it works:
nothing to download separately, nothing to start, nothing uploaded.

[Get it for Chrome / Edge / Firefox] · Free — Pro is a one-time
payment, never a subscription.

## What changed in 1.1.0

The extension used to need a companion app running on your machine.
That step is gone. The extraction engine (pdf.js) now ships inside
the extension, and everything — extraction, the knowledgebank,
talk-to-the-page — runs locally in your browser.

## What it does

- **Extract** — full text, decoded metadata (title, author,
  dates), page count, document structure (chapters, appendices,
  sections), and a term/concept index.
- **Download** — `.txt`, `.md`, `.json`, or a Word `.docx`,
  generated in the browser.
- **Big documents get a room** — PDFs over 25 pages open in a
  full-tab workspace and process page by page with a progress bar
  and no time limit. Several-hundred-page books complete; the old
  design's timeout is gone because the timeout itself is gone.
- **A knowledgebank, not just an extraction** — file a document or
  any page range into containers you create (name + colour) with
  your own tags. Items are fully manageable — save, edit, move,
  delete, export — and their outputs regenerate from the current
  text, so exports never go stale. Everything lives in your
  browser's local storage only.
- **Talk to the page** — ask questions of what you're reading.
  Answers come back as the bearing passages with citations you can
  click to open in the reader. A small AI model bundled in the
  extension phrases answers on your device; larger models are
  downloadable from an in-workspace catalogue. Only models ever
  travel — your documents never leave your machine.

## Pricing, plainly

No subscription — subscriptions are a money drain, and we have
moved away from that model. Every feature works fully for
everyone; free use includes 15 minutes of talk-to-the-page in
total, after which talk pauses. Pro is a **one-time payment** that
removes the meter for life — it buys the feature unlock and
nothing else. And if the tool saved you time, you can tip out of
gratitude — when you wish, and how many times you wish.

## Privacy

Your PDF is processed in your browser and nowhere else. Documents,
filed items, and settings live in your browser's local storage
(IndexedDB) on your device. The only data that ever leaves is a
licence key you type (validation) and the model files you choose
to download. No accounts, no analytics, no document uploads —
ever.

## Prefer a command line?

The free Python package (CLI / local API / MCP server) remains
available for automation and power users:
`pip install pdfx-extractor`.
