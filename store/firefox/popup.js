"use strict";
/*
 * PDF Extractor (pdfx) popup — self-contained since 1.1.0.
 *
 * Extraction runs in this browser via the vendored pdf.js engine
 * (engine.js). There is no local API and nothing to install or start:
 * the pre-1.1.0 design sent the PDF to a companion API process on the
 * loopback interface, and the tab feature sent the tab's URL to that
 * API to fetch defensively (remediation round 3, 2026-10-30). The
 * owner's ruling of 2026-11-05 retired the companion entirely:
 * nobody walks that extra mile, so the engine is packed in here.
 *
 * Fetch boundary, stated plainly: the ONLY network fetch this
 * extension can make is the "Use current tab PDF" button fetching the
 * exact URL of the tab the user is already viewing, at the user's
 * click, under the activeTab grant, in the user's own browser (which
 * has, by definition, already loaded that PDF). There is no URL input
 * field and no other fetch target in the code. The response is
 * size-capped (50 MB) and verified as a PDF by its %PDF magic bytes
 * before the engine touches it. Picked files never leave the machine.
 */
const WORKSPACE_PAGE_LIMIT = 25;
const MAX_TAB_BYTES = 50 * 1024 * 1024;

const lib = globalThis.pdfjsLib;
if (lib && typeof chrome !== "undefined" && chrome.runtime) {
  lib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("vendor/pdf.worker.min.js");
}

let blobUrl = null;
let lastDoc = null;

const $ = (id) => document.getElementById(id);

function setProgress(page, total) {
  $("prog").textContent = total
    ? `Extracting… page ${page} of ${total}`
    : "";
}

function validateTabPdfUrl(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch (e) { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (!u.pathname.toLowerCase().endsWith(".pdf")) return null;
  return u.href;
}

function openWorkspace() {
  chrome.tabs.create({
    url: chrome.runtime.getURL("workspace.html"),
  });
}

async function routeToWorkspace(blob, name, pageCount) {
  await PdfxDocStore.put(blob, name);
  openWorkspace();
  $("out").textContent =
    `“${name}” has ${pageCount} pages — opened in the workspace tab, ` +
    "where large documents extract with progress.";
  setProgress(0, 0);
}

function renderResult() {
  if (!lastDoc) return;
  const fmt = $("format").value;
  const doc = lastDoc;
  const stem = PdfxEngine.stemOf(doc.source);
  let blob, preview;
  if (fmt === "json") {
    const j = PdfxEngine.toJson(doc);
    blob = new Blob([j], { type: "application/json" });
    preview = j;
  } else if (fmt === "md") {
    const md = PdfxEngine.toMarkdown(doc);
    blob = new Blob([md], { type: "text/markdown" });
    preview = md;
  } else if (fmt === "docx") {
    blob = new Blob([PdfxEngine.docxBytes(doc)], {
      type: "application/vnd.openxmlformats-officedocument" +
        ".wordprocessingml.document",
    });
    preview = `Word document ready — ${doc.metadata.pages} pages, ` +
      `${doc.text_length} characters of text. Use “Download result”.`;
  } else {
    const t = PdfxEngine.toText(doc);
    blob = new Blob([t], { type: "text/plain" });
    preview = t;
  }
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(blob);
  const a = $("dl");
  a.href = blobUrl;
  a.download = `${stem}.${fmt}`;
  a.style.display = "block";
  a.textContent = "Download result";
  $("out").textContent = preview.slice(0, 8000);
  $("copy").style.display = doc.text ? "block" : "none";
  setProgress(0, 0);
}

// Shared path for picked files and the current-tab PDF: probe the
// page count, route large documents to the workspace, extract small
// ones here with progress. No timeout anywhere — a document takes
// as long as it takes.
async function handleBytes(bytes, blob, name) {
  const pages = await PdfxEngine.countPages(lib, bytes);
  if (pages > WORKSPACE_PAGE_LIMIT) {
    await routeToWorkspace(blob, name, pages);
    return;
  }
  lastDoc = await PdfxEngine.extractDocument(lib, bytes, name, setProgress);
  renderResult();
}

$("go").onclick = async () => {
  const f = $("file").files[0];
  if (!f) {
    $("out").textContent =
      "Pick a PDF file first, or use the tab button.";
    return;
  }
  try {
    const buf = await f.arrayBuffer();
    await handleBytes(new Uint8Array(buf), f, f.name);
  } catch (e) {
    setProgress(0, 0);
    $("out").textContent = `Could not extract that PDF: ${e.message || e}`;
  }
};

$("tab").onclick = async () => {
  const out = $("out");
  try {
    const [tab] = await chrome.tabs.query({
      active: true, currentWindow: true,
    });
    const url = tab && tab.url ? validateTabPdfUrl(tab.url) : null;
    if (!url) {
      out.textContent = "Current tab is not an http(s) PDF page.";
      return;
    }
    out.textContent = "Fetching the tab's PDF…";
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`the site returned ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_TAB_BYTES) {
      throw new Error("that PDF is larger than 50 MB");
    }
    const head = new Uint8Array(buf.slice(0, 5));
    if (String.fromCharCode(...head) !== "%PDF-") {
      throw new Error("the tab's response is not a PDF");
    }
    const name = decodeURIComponent(
      new URL(url).pathname.split("/").pop() || "tab.pdf");
    await handleBytes(
      new Uint8Array(buf),
      new Blob([buf], { type: "application/pdf" }),
      name);
  } catch (e) {
    setProgress(0, 0);
    out.textContent = `Could not use the tab PDF: ${e.message || e}`;
  }
};

$("workspace").onclick = async () => {
  const f = $("file").files[0];
  if (f) await PdfxDocStore.put(f, f.name);
  openWorkspace();
};

$("format").onchange = () => { if (lastDoc) renderResult(); };
$("copy").onclick = () => {
  if (lastDoc) navigator.clipboard.writeText(lastDoc.text);
};
