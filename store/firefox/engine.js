"use strict";
/*
 * PDF Extractor (pdfx) — in-browser extraction engine.
 *
 * Everything runs inside the extension with the vendored pdf.js build
 * (vendor/pdf.min.js, Apache-2.0, Mozilla). No companion app, no local
 * API, no network: the document object produced here mirrors the shape
 * the Python engine (src/pdfx/core.py) returns — {source, engine,
 * text, text_length, metadata, structure, index} — so the .txt/.md/
 * .json outputs match the CLI/API outputs for the same document.
 *
 * Word (.docx) output is generated locally by the minimal OOXML
 * writer at the bottom of this file (store-only ZIP, no dependency),
 * mirroring src/pdfx/outputs.py write_docx.
 *
 * Copyright (c) 2026 2351485 ALBERTA INC. — MIT (see ../LICENSE).
 */
(function (root) {

// ---------------------------------------------------------------- text

function pageText(items) {
  // pdf.js text items carry hasEOL markers; honour them as line breaks
  // and separate same-line items with a space.
  const lines = [];
  let line = "";
  for (const item of items) {
    if (line && !line.endsWith(" ") && !item.str.startsWith(" ")) line += " ";
    line += item.str;
    if (item.hasEOL) { lines.push(line); line = ""; }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ------------------------------------------------- structure and index
// Ports of src/pdfx/core.py parse_structure / build_index — same
// regex, same stopwords, same concept list, so the extension and the
// CLI/API agree on the same document.

const HEADING_RE = /^\s*(Chapter|Appendix|Section)\s+[\w.]+/;
const STOPWORDS = new Set(["a", "an", "and", "are", "as", "at", "be", "by",
  "for", "from", "in", "is", "it", "of", "on", "or", "that", "the", "this",
  "to", "with"]);
const CONCEPT_KEYWORDS = ["outcome", "convergence", "CTST", "mechanism",
  "governance", "lineage", "context", "freshness", "attribution",
  "observer", "Goodhart", "requisite", "variety", "agency", "constraint"];

function parseStructure(text) {
  const chapters = [], appendices = [], sections = [];
  for (const line of text.split("\n")) {
    if (!HEADING_RE.test(line)) continue;
    const s = line.trim();
    const low = s.toLowerCase();
    if (low.startsWith("chapter")) chapters.push(s);
    else if (low.startsWith("appendix")) appendices.push(s);
    else if (low.startsWith("section")) sections.push(s);
  }
  return { chapters, appendices, sections };
}

function buildIndex(text) {
  const tokens = text.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const lower = tokens.map((t) => t.toLowerCase())
    .filter((t) => !STOPWORDS.has(t));
  const counts = new Map();
  for (const t of lower) counts.set(t, (counts.get(t) || 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([t]) => t);
  const present = new Set(lower);
  const concepts = CONCEPT_KEYWORDS.filter((kw) => present.has(kw.toLowerCase()));
  return { concepts, term_count: lower.length, top_terms: top };
}

// ------------------------------------------------------------ extraction

async function loadPdf(pdfjsLib, data) {
  // isEvalSupported: false — required under MV3 CSP and the pdf.js
  // hardening guidance; extraction never needs it.
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
  return task.promise;
}

async function countPages(pdfjsLib, data) {
  const pdf = await loadPdf(pdfjsLib, data);
  const n = pdf.numPages;
  await pdf.destroy();
  return n;
}

async function extractDocument(pdfjsLib, data, sourceName, onProgress) {
  const { doc } = await extractWithPages(pdfjsLib, data, sourceName, onProgress);
  return doc;
}

// Same extraction, but also returns the per-page texts. The document
// object keeps the Python engine's shape (no pages field — parity
// for the .json output); the workspace uses pageTexts for page-range
// chunks and per-page citations in the knowledgebank.
async function extractWithPages(pdfjsLib, data, sourceName, onProgress) {
  const pdf = await loadPdf(pdfjsLib, data);
  try {
    const numPages = pdf.numPages;
    let info = {};
    try {
      const meta = await pdf.getMetadata();
      if (meta && meta.info) {
        for (const [k, v] of Object.entries(meta.info)) {
          if (typeof v === "string") info[k.toLowerCase()] = v;
        }
      }
    } catch (e) { /* metadata is best-effort, as in the Python engine */ }
    const metadata = {
      title: info.title || null,
      author: info.author || null,
      creator: info.creator || null,
      producer: info.producer || null,
      pages: numPages,
      metadata: info,
    };
    const pageTexts = [];
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      pageTexts.push(pageText(tc.items));
      page.cleanup();
      if (onProgress) onProgress(i, numPages);
      if (i % 8 === 0) await yieldToUi();
    }
    const text = pageTexts.join("\n");
    const doc = {
      source: sourceName,
      engine: "pdf.js",
      text,
      text_length: text.length,
      metadata,
      structure: parseStructure(text),
      index: buildIndex(text),
    };
    return { doc, pageTexts };
  } finally {
    await pdf.destroy();
  }
}

// --------------------------------------------------------------- outputs

function stemOf(sourceName) {
  const base = (sourceName || "document").split(/[\\/]/).pop();
  return base.replace(/\.pdf$/i, "") || "document";
}

function toText(doc) { return doc.text; }

function toJson(doc) { return JSON.stringify(doc, null, 2); }

// Mirror of src/pdfx/outputs.py write_md.
function toMarkdown(doc) {
  const m = doc.metadata || {};
  const lines = [`# ${m.title || stemOf(doc.source)}`, ""];
  lines.push(m.author ? `- Author: ${m.author}` : "");
  lines.push(`- Pages: ${m.pages}`, "", "## Structure");
  const s = doc.structure || {};
  for (const k of ["chapters", "appendices", "sections"]) {
    for (const h of s[k] || []) lines.push(`- ${h}`);
  }
  lines.push("", "## Text", "", doc.text || "");
  return lines.join("\n");
}

// ------------------------------------------- minimal OOXML (.docx) writer
// A .docx is a ZIP of XML parts. This writer emits a store-only
// (uncompressed) ZIP with the parts Word needs, mirroring the content
// of the Python write_docx (python-docx): title, pages/author line,
// structure bullets, then the text as paragraphs.

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function zipStore(entries) {
  // entries: [{name, data: Uint8Array}] → Uint8Array (ZIP, stored)
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
  const u32 = (v) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff,
    (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
  const push = (arr) => { chunks.push(arr); offset += arr.length; };
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const localOffset = offset;
    push(u32(0x04034b50)); push(u16(20)); push(u16(0x0800)); push(u16(0));
    push(u16(0)); push(u16(0x0021)); // DOS time 0, date 1980-01-01
    push(u32(crc)); push(u32(e.data.length)); push(u32(e.data.length));
    push(u16(name.length)); push(u16(0)); push(name); push(e.data);
    central.push({ name, crc, size: e.data.length, localOffset });
  }
  const cdStart = offset;
  for (const c of central) {
    push(u32(0x02014b50)); push(u16(20)); push(u16(20)); push(u16(0x0800));
    push(u16(0)); push(u16(0)); push(u16(0x0021));
    push(u32(c.crc)); push(u32(c.size)); push(u32(c.size));
    push(u16(c.name.length)); push(u16(0)); push(u16(0)); push(u16(0));
    push(u16(0)); push(u32(0)); push(u32(c.localOffset)); push(c.name);
  }
  push(u32(0x06054b50)); push(u16(0)); push(u16(0));
  push(u16(central.length)); push(u16(central.length));
  push(u32(offset - cdStart)); push(u32(cdStart)); push(u16(0));
  const out = new Uint8Array(offset);
  let pos = 0;
  for (const ch of chunks) { out.set(ch, pos); pos += ch.length; }
  return out;
}

function xmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function docxBytes(doc) {
  const enc = new TextEncoder();
  const m = doc.metadata || {};
  const title = m.title || stemOf(doc.source);
  const paras = [];
  const para = (text, style) =>
    paras.push(`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>` +
      `<w:r><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r></w:p>`);
  para(title, "Title");
  para(`Pages: ${m.pages}  Author: ${m.author || ""}`, "Normal");
  const s = doc.structure || {};
  const all = ["chapters", "appendices", "sections"]
    .flatMap((k) => s[k] || []);
  if (all.length) {
    para("Structure", "Heading1");
    for (const h of all) para(h, "ListBullet");
  }
  para("Text", "Heading1");
  for (const block of (doc.text || "").split("\n\n")) {
    if (block.trim()) para(block.trim(), "Normal");
  }
  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paras.join("")}` +
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body></w:document>`;
  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>` +
    `<w:style w:type="paragraph" w:styleId="ListBullet"><w:name w:val="List Bullet"/></w:style>` +
    `</w:styles>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
    `</Relationships>`;
  const core =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:title>${xmlEscape(title)}</dc:title>` +
    (m.author ? `<dc:creator>${xmlEscape(m.author)}</dc:creator>` : "") +
    `</cp:coreProperties>`;
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(contentTypes) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(documentXml) },
    { name: "word/styles.xml", data: enc.encode(stylesXml) },
    { name: "docProps/core.xml", data: enc.encode(core) },
  ]);
}

const api = {
  extractDocument, extractWithPages, countPages, parseStructure,
  buildIndex, toText, toMarkdown, toJson, docxBytes, stemOf, pageText,
};
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.PdfxEngine = api;

})(typeof self !== "undefined" ? self : globalThis);
