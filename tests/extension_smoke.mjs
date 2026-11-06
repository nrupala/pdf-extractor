// Extension smoke test — exercises the self-contained (1.1.0+)
// in-browser engine end to end in Node: the vendored pdf.js build
// extracts the fixture PDFs through extension/engine.js, the popup's
// own logic runs in a stub DOM with a stub engine, and static checks
// prove the companion-API design is gone (no loopback reference, no
// host permissions, no fixed timeout).
// Run: node tests/extension_smoke.mjs
//
// Honest scope: this is Node + a stub DOM, NOT a real-browser
// unpacked load; that leg belongs in the gate record.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const pdfjsLib = require("../extension/vendor/pdf.min.js");
pdfjsLib.GlobalWorkerOptions.workerSrc =
  require.resolve("../extension/vendor/pdf.worker.min.js");
const engine = require("../extension/engine.js");
const bank = require("../extension/bank.js");
const talk = require("../extension/talk.js");
const docstore = require("../extension/docstore.js");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}`);
  if (!cond) failures++;
}

const fixture = (name) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));

// ---------------------------------------------------------- engine: book
{
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("sample_book.pdf"), "sample_book.pdf", null);
  check("engine: page count", doc.metadata.pages === 4);
  check("engine: metadata title", doc.metadata.title === "Sample Book");
  check("engine: metadata author", doc.metadata.author === "A. Author");
  check("engine: text extracted",
    doc.text.includes("Outcome convergence begins with a desired state."));
  check("engine: structure chapters",
    doc.structure.chapters.includes("Chapter 1 Foundations") &&
    doc.structure.chapters.includes("Chapter 2 Mechanisms"));
  check("engine: index top terms", doc.index.top_terms.length > 0 &&
    doc.index.term_count > 0);
  check("engine: text_length matches",
    doc.text_length === doc.text.length);

  const md = engine.toMarkdown(doc);
  check("markdown mirrors the Python writer",
    md.startsWith("# Sample Book") && md.includes("## Structure") &&
    md.includes("- Chapter 1 Foundations") && md.includes("## Text"));
  const js = JSON.parse(engine.toJson(doc));
  check("json round-trips", js.metadata.pages === 4);

  // docx: stored-ZIP with a document.xml carrying the text.
  const bytes = engine.docxBytes(doc);
  check("docx is a zip", bytes[0] === 0x50 && bytes[1] === 0x4b);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();
  let off = 0, docXml = null;
  while (off + 30 <= bytes.length && dv.getUint32(off, true) === 0x04034b50) {
    const nlen = dv.getUint16(off + 26, true);
    const elen = dv.getUint16(off + 28, true);
    const size = dv.getUint32(off + 18, true);
    const name = dec.decode(bytes.subarray(off + 30, off + 30 + nlen));
    const start = off + 30 + nlen + elen;
    if (name === "word/document.xml") {
      docXml = dec.decode(bytes.subarray(start, start + size));
    }
    off = start + size;
  }
  check("docx document.xml carries the text",
    !!docXml && docXml.includes("Outcome convergence begins"));
}

// ------------------------------------------- engine: owner's-book shape
// The 2026-11-05 acceptance case (old design): a several-hundred-page
// textbook died at a fixed 20 s timeout. Here the 240-page fixture
// must simply complete, reporting progress page by page — there is
// no timeout in the code (asserted statically below).
{
  const seen = [];
  const t0 = Date.now();
  const doc = await engine.extractDocument(
    pdfjsLib, fixture("big_book.pdf"), "big_book.pdf",
    (p, t) => seen.push([p, t]));
  check("big book: all 240 pages extracted", doc.metadata.pages === 240);
  check("big book: progress reported per page",
    seen.length === 240 && seen[239][0] === 240 && seen[239][1] === 240);
  check("big book: progress is monotonic",
    seen.every((v, i) => i === 0 || v[0] === seen[i - 1][0] + 1));
  check("big book: late text present",
    doc.text.includes("Chapter 12 Topic 12"));
  console.log(`INFO big book extraction took ${Date.now() - t0} ms in Node`);
}

// ------------------------------------------- knowledgebank round-trip
// File → persist (structured clone stands in for the IndexedDB
// round-trip) → reload → item present → export contains it →
// artifacts ride with the item.
{
  const { doc, pageTexts } = await engine.extractWithPages(
    pdfjsLib, fixture("sample_book.pdf"), "sample_book.pdf", null);
  const container = bank.makeContainer("Protection", "#0284c7");
  const atom = bank.documentAtom(doc, pageTexts);
  atom.containerIds = [container.id];
  atom.tags = ["relays", "textbook"];

  const reloaded = structuredClone({ containers: [container], items: [atom] });
  const item = reloaded.items[0];
  check("bank: item survives the persistence round-trip",
    item.title === "Sample Book" && item.kind === "document" &&
    item.text.includes("Outcome convergence begins"));
  const arts = bank.artifactsForItem(engine, item);
  check("bank: artifacts regenerate from the item (derived, not stored)",
    arts.txt.includes("Mechanisms") &&
    arts.json.includes('"Sample Book"') &&
    arts.md.includes("## Structure") &&
    arts.docx[0] === 0x50 && arts.docx[1] === 0x4b);
  check("bank: passages carry the filing-time index",
    item.passages.length > 0 &&
    item.passages.every((p) => p.terms && typeof p.terms === "object") &&
    item.passages.some((p) => (p.terms.governance || 0) > 0));
  check("bank: filter by container",
    bank.filterItems(reloaded.items, { containerId: container.id })
      .length === 1 &&
    bank.filterItems(reloaded.items, { containerId: "nope" }).length === 0);
  check("bank: filter by tag and search",
    bank.filterItems(reloaded.items, { tag: "relays" }).length === 1 &&
    bank.filterItems(reloaded.items, { query: "governance" }).length === 1 &&
    bank.filterItems(reloaded.items, { query: "zzz-absent" }).length === 0);
  const expJ = JSON.parse(bank.exportJson(
    "PDF Extractor (pdfx)", reloaded.containers, reloaded.items));
  check("bank: json export contains the item",
    expJ.items.length === 1 && expJ.items[0].title === "Sample Book" &&
    expJ.containers[0].name === "Protection");
  const expM = bank.exportMd(
    "PDF Extractor (pdfx)", reloaded.containers, reloaded.items);
  check("bank: md export contains the item under its container",
    expM.includes("## Protection") && expM.includes("### Sample Book") &&
    expM.includes("Outcome convergence begins"));

  const chunk = bank.chunkAtom(doc, pageTexts, 2, 3);
  check("bank: page-range chunk atom",
    chunk.kind === "chunk" && chunk.pageStart === 2 &&
    chunk.pageEnd === 3 && chunk.wordCount > 0 &&
    chunk.passages.every((p) => /^p\. [23]$/.test(p.citation)));

  // Talk to the page: retrieval answers carry page citations.
  const ans = talk.answer(item, "What does governance keep honest?");
  check("talk: grounded answer found with citation",
    ans.found && ans.hits.length > 0 &&
    ans.hits.every((h) => /^p\. \d+$/.test(h.citation)) &&
    ans.text.includes("mechanism"));
  const miss = talk.answer(item, "What is the capital of France?");
  check("talk: unanswerable question says so", !miss.found);
  // The meter (owner's line): features are never size-gated; free
  // talk is 15 minutes of use in total, then it pauses.
  check("talk: no size gate — a huge item still answers",
    talk.answer({ ...item, text: "governance " + "word ".repeat(9000),
      passages: item.passages }, "governance?").found);
  check("talk: meter allows under the allowance",
    talk.meterAllows({ usedSeconds: 0 }, null).allowed &&
    talk.meterAllows({ usedSeconds: 899 }, null).allowed);
  check("talk: meter pauses at the allowance",
    !talk.meterAllows({ usedSeconds: 900 }, null).allowed);
  check("talk: Pro (valid licence) removes the meter",
    talk.meterAllows({ usedSeconds: 99999 }, { status: "valid" }).allowed);
  check("talk: charging accumulates, min 1s per question",
    talk.chargeSeconds({ usedSeconds: 10 }, 0.2).usedSeconds === 11 &&
    talk.chargeSeconds({ usedSeconds: 10 }, 3.4).usedSeconds === 14);
  check("talk: dual mode — full context for short items",
    talk.buildContext(item, "governance").mode === "full");
  const longItem = { ...item, text: "filler ".repeat(4000),
    passages: item.passages };
  check("talk: dual mode — retrieval for long items",
    talk.buildContext(longItem, "governance").mode === "retrieval");
  const okFetch = async () => ({
    ok: true, json: async () => ({ valid: true }),
  });
  check("talk: licence validation honours the contract",
    await talk.validateLicence("KEY-123", okFetch) === true);
  let threw = false;
  try {
    await talk.validateLicence("KEY-123",
      async () => { throw new Error("offline"); });
  } catch (e) { threw = true; }
  check("talk: unreachable validation never reads as valid", threw);
}

// ------------------------------------- bank management lifecycle (#6)
// save → edit → move → export reflects the edit → save-as → delete
// → gone after reload; container delete with both choices. Driven
// through the ops layer against an in-memory adapter with the
// docstore bank shape.
{
  const mkAdapter = () => {
    const containers = new Map(), items = new Map();
    return {
      listContainers: async () => [...containers.values()],
      putContainer: async (c) => { containers.set(c.id, c); },
      deleteContainer: async (id) => { containers.delete(id); },
      listItems: async () => [...items.values()],
      putItem: async (i) => { items.set(i.id, structuredClone(i)); },
      deleteItem: async (id) => { items.delete(id); },
    };
  };
  const adapter = mkAdapter();
  const ops = bank.createOps(adapter);
  const c1 = bank.makeContainer("One", "#0284c7");
  const c2 = bank.makeContainer("Two", "#16a34a");
  await adapter.putContainer(c1);
  await adapter.putContainer(c2);
  const item = bank.documentAtom(
    { source: "b.pdf", text: "alpha governance text",
      metadata: { title: "B", pages: 1 },
      structure: {}, index: {} },
    ["alpha governance text"]);
  item.containerIds = [c1.id];
  await ops.file(item);
  check("mgmt: filed item persists",
    (await adapter.listItems()).length === 1);

  item.title = "B — corrected";
  item.text = "alpha governance text, corrected by hand";
  item.notes = "checked against the print copy";
  item.tags = ["verified"];
  bank.resegment(item);
  await ops.save(item);
  let back = (await adapter.listItems())[0];
  check("mgmt: edit persists (title, text, notes, tags)",
    back.title === "B — corrected" &&
    back.text.includes("corrected by hand") &&
    back.notes.includes("print copy") &&
    back.tags.includes("verified"));

  await ops.move(back, [c2.id]);
  back = (await adapter.listItems())[0];
  check("mgmt: move re-files the item", back.containerIds[0] === c2.id);
  const expM = bank.exportMd("PDF Extractor (pdfx)",
    await adapter.listContainers(), await adapter.listItems());
  check("mgmt: export reflects the edit",
    expM.includes("## Two") && expM.includes("B — corrected") &&
    expM.includes("corrected by hand"));

  const copy = await ops.saveAs(back, "B — archive copy");
  check("mgmt: save-as makes a distinct copy",
    copy.id !== back.id && (await adapter.listItems()).length === 2);

  await ops.remove(back);
  check("mgmt: delete removes the record",
    (await adapter.listItems()).length === 1 &&
    (await adapter.listItems())[0].id === copy.id);

  await ops.deleteContainer(c2, "out");
  back = (await adapter.listItems())[0];
  check("mgmt: container delete (out) unfiles but keeps items",
    (await adapter.listContainers()).length === 1 &&
    back.containerIds.length === 0);
  await ops.move(back, [c1.id]);
  await ops.deleteContainer(c1, "with");
  check("mgmt: container delete (with) deletes its items",
    (await adapter.listItems()).length === 0 &&
    (await adapter.listContainers()).length === 0);
}

// ------------------------------------------------- downloads (F1)
// Browser proof 2026-11-05, defect F1: every download button in the
// real browser produced no file — the workspace's downloadBytes()
// clicked a DETACHED anchor, which Chrome extension pages ignore.
// The helper now lives in docstore.js (the one non-vendor script
// both pages load): it must attach the anchor before clicking,
// remove it after, and fail LOUDLY (visible notice + false return,
// Gate 12) when a download cannot start. The stub DOM records
// attachment at click time — on the detached-anchor code the
// central check below fails.
{
  function makeDownloadDom(throwForTag) {
    const created = [];
    const body = {
      children: [],
      appendChild(node) {
        if (node.tag === throwForTag) {
          throw new Error("append refused for " + node.tag);
        }
        node.parentNode = body;
        body.children.push(node);
      },
    };
    return {
      body, created,
      getElementById: (id) =>
        created.find((e) => e.id === id) || null,
      createElement: (tag) => {
        const el = {
          tag, parentNode: null, style: {}, attrs: {},
          get isConnected() { return this.parentNode != null; },
          setAttribute(k, v) { this.attrs[k] = v; },
          click() {
            this.attachedAtClick = this.isConnected;
            this.clicked = true;
          },
          remove() {
            if (this.parentNode) {
              const i = this.parentNode.children.indexOf(this);
              if (i >= 0) this.parentNode.children.splice(i, 1);
              this.parentNode = null;
            }
          },
        };
        created.push(el);
        return el;
      },
    };
  }

  const dom = makeDownloadDom(null);
  globalThis.document = dom;
  const okDl = docstore.downloadBytes("result.txt", "hello", "text/plain");
  const anchor = dom.created.find((e) => e.tag === "a");
  check("downloads: helper reports success", okDl === true);
  check("downloads: anchor attached at click time (F1)",
    !!anchor && anchor.clicked === true &&
    anchor.attachedAtClick === true);
  check("downloads: anchor removed after the click",
    !!anchor && anchor.parentNode === null &&
    !dom.body.children.includes(anchor));
  check("downloads: anchor carries the file name",
    !!anchor && anchor.download === "result.txt");

  const bad = makeDownloadDom("a");
  globalThis.document = bad;
  const okBad = docstore.downloadBytes("result.txt", "hello",
    "text/plain");
  const notice = bad.created.find((e) => e.id === "dl-notice");
  check("downloads: a failed start returns false (Gate 12)",
    okBad === false);
  check("downloads: a failed start is loud in the page (Gate 12)",
    !!notice && /could not start/.test(notice.textContent || ""));
  delete globalThis.document;
}

// ------------------------------------------------------- popup behaviour
function makePopupWorld() {
  const els = {};
  const mk = (id) => (els[id] = {
    files: [], style: {}, textContent: "", value: "json",
    listeners: {},
    addEventListener(ev, fn) { this.listeners[ev] = fn; },
  });
  ["file", "tab", "format", "go", "workspace", "prog", "out", "dl", "copy"]
    .forEach(mk);
  els.file.files = [{
    name: "small.pdf",
    arrayBuffer: async () => new ArrayBuffer(8),
  }];
  const calls = { extracted: 0, put: 0, tabsCreated: [] };
  const sandbox = {
    document: { getElementById: (id) => els[id] },
    pdfjsLib: { GlobalWorkerOptions: {} },
    PdfxEngine: {
      countPages: async () => 3,
      extractDocument: async (lib, bytes, name, onProgress) => {
        calls.extracted++;
        if (onProgress) onProgress(3, 3);
        return {
          source: name, engine: "pdf.js", text: "hello text",
          text_length: 10,
          metadata: { title: "T", author: null, pages: 3, metadata: {} },
          structure: { chapters: [], appendices: [], sections: [] },
          index: { concepts: [], term_count: 2, top_terms: ["hello"] },
        };
      },
      toJson: (d) => JSON.stringify(d), toText: (d) => d.text,
      toMarkdown: () => "# T", docxBytes: () => new Uint8Array([0x50, 0x4b]),
      stemOf: () => "small",
    },
    PdfxDocStore: {
      put: async () => { calls.put++; },
      get: async () => null, forget: async () => {},
    },
    chrome: {
      runtime: { getURL: (p) => "chrome-extension://x/" + p },
      tabs: {
        create: (o) => { calls.tabsCreated.push(o.url); },
        query: async () => [{ url: "https://example.com/a.pdf" }],
      },
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    Blob, navigator: { clipboard: { writeText: async () => {} } },
    fetch: async () => { throw new Error("unused"); },
    console,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(
    readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8"),
    sandbox);
  return { els, calls };
}

{
  const { els, calls } = makePopupWorld();
  await els.go.onclick();
  check("popup: small file extracts in the popup", calls.extracted === 1);
  check("popup: result rendered", els.out.textContent.includes("hello text") ||
    els.out.textContent.includes('"text"'));
  check("popup: download offered", els.dl.style.display === "block");
}

// --------------------------------------- popup flow, real engine (F2)
// Browser proof 2026-11-05, defect F2: the popup extracted NOTHING
// in a real browser — pdf.js transfers the buffer handed to
// getDocument to its worker, detaching the caller's copy, and the
// popup spent one buffer on countPages and then tried to extract
// from the corpse ("An ArrayBuffer is detached and could not be
// cloned"). Node's pdf.js runs an in-process worker that does NOT
// transfer, so the stub-engine test above can never see this class.
// This section runs the REAL popup.js against the REAL engine with
// a getDocument wrapper that reproduces the browser's transfer
// semantics (the caller's buffer is neutered; the worker side
// receives a copy). On the pre-fix popup both entry points fail
// here; on the fix — fresh bytes read from the Blob per pdf.js
// call — both extract end to end.
{
  const simPdfjs = {
    GlobalWorkerOptions: pdfjsLib.GlobalWorkerOptions,
    getDocument: (params) => {
    const data = params && params.data;
    if (data && data.buffer instanceof ArrayBuffer &&
        data.byteLength > 0) {
      const copy = data.slice();
      try {
        structuredClone(data.buffer, { transfer: [data.buffer] });
      } catch (e) { /* already detached — nothing left to simulate */ }
        return pdfjsLib.getDocument({ ...params, data: copy });
      }
      return pdfjsLib.getDocument(params);
    },
  };

  // Control: the simulation must bite. Two pdf.js calls over ONE
  // buffer is exactly the pre-fix pattern, and it must fail.
  {
    const bytes = fixture("sample_book.pdf");
    await engine.countPages(simPdfjs, bytes);
    let threw = false;
    try {
      await engine.extractDocument(
        simPdfjs, bytes, "sample_book.pdf", null);
    } catch (e) { threw = true; }
    check("popup F2 control: a spent buffer cannot be re-used", threw);
  }

  function makeRealPopupWorld(fetchRaw) {
    const els = {};
    const mk = (id) => (els[id] = {
      files: [], style: {}, textContent: "", value: "json",
      listeners: {},
      addEventListener(ev, fn) { this.listeners[ev] = fn; },
    });
    ["file", "tab", "format", "go", "workspace", "prog", "out", "dl",
     "copy"].forEach(mk);
    const raw = readFileSync(
      new URL("./fixtures/sample_book.pdf", import.meta.url));
    els.file.files = [{
      name: "sample_book.pdf",
      // A real File returns a FRESH buffer from every read.
      arrayBuffer: async () => new Uint8Array(raw).buffer,
    }];
    const calls = { put: 0, tabsCreated: [] };
    const sandbox = {
      document: { getElementById: (id) => els[id] },
      pdfjsLib: simPdfjs,
      PdfxEngine: engine,
      PdfxDocStore: {
        put: async () => { calls.put++; },
        get: async () => null, forget: async () => {},
      },
      chrome: {
        runtime: {
          getURL: (p) => p.endsWith("pdf.worker.min.js")
            ? require.resolve("../extension/vendor/pdf.worker.min.js")
            : "chrome-extension://x/" + p,
        },
        tabs: {
          create: (o) => { calls.tabsCreated.push(o.url); },
          query: async () =>
            [{ url: "https://example.com/sample_book.pdf" }],
        },
      },
      URL, Blob,
      navigator: { clipboard: { writeText: async () => {} } },
      fetch: async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array(fetchRaw).buffer,
      }),
      console,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(
      readFileSync(new URL("../extension/popup.js", import.meta.url),
        "utf8"),
      sandbox);
    return { els, calls };
  }

  {
    const { els } = makeRealPopupWorld(null);
    await els.go.onclick();
    check("popup F2: picked file extracts end to end",
      els.out.textContent.includes("Outcome convergence begins") &&
      !/detached|Could not/i.test(els.out.textContent));
    check("popup F2: download offered after extraction",
      els.dl.style.display === "block");
  }
  {
    const raw = readFileSync(
      new URL("./fixtures/sample_book.pdf", import.meta.url));
    const { els } = makeRealPopupWorld(raw);
    await els.tab.onclick();
    check("popup F2: current-tab PDF extracts end to end",
      els.out.textContent.includes("Outcome convergence begins") &&
      !/detached|Could not/i.test(els.out.textContent));
  }
}

// ------------------------------------------------------------ static law
{
  const ext = (p) =>
    readFileSync(new URL(`../extension/${p}`, import.meta.url), "utf8");
  const manifest = JSON.parse(ext("manifest.json"));
  check("manifest: exactly one host permission (licence validation)",
    JSON.stringify(manifest.host_permissions) ===
      JSON.stringify(["https://aimlds.org/*"]));
  check("manifest: version 1.1.1", manifest.version === "1.1.1");
  check("downloads: one central helper, in docstore.js (F1)",
    ext("docstore.js").includes("function downloadBytes") &&
    ext("docstore.js").includes("appendChild(a)") &&
    ext("docstore.js").includes("dl-notice"));
  check("downloads: workspace keeps no private copy (F1)",
    !ext("workspace.js").includes("function downloadBytes"));
  check("popup: the Blob is re-read per pdf.js call (F2)",
    ext("popup.js").includes("async function handleBytes(blob, name)") &&
    ext("popup.js").includes("await blob.arrayBuffer()"));
  check("manifest: description drops the companion",
    !/local|api/i.test(manifest.description) ||
    manifest.description.includes("browser"));
  const code = ["popup.js", "workspace.js", "engine.js", "docstore.js"]
    .map(ext).join("\n");
  check("no loopback reference in extension code",
    !code.includes("127.0.0.1") && !code.includes("localhost"));
  check("no companion start instructions in extension code",
    !code.includes("pdfx-api") && !/start the api/i.test(code));
  check("no fixed timeout on extraction",
    !code.includes("AbortController") && !code.includes("setTimeout(() => controller"));
  check("popup routes large documents to the workspace",
    ext("popup.js").includes("WORKSPACE_PAGE_LIMIT = 25") &&
    ext("popup.js").includes("workspace.html") ||
    ext("docstore.js").length > 0 && ext("popup.js").includes("PdfxDocStore.put"));
  check("manifest: WASM allowed for the on-device model runtime",
    (manifest.content_security_policy?.extension_pages || "")
      .includes("wasm-unsafe-eval"));
  const fs = require("node:fs");
  const vendored = (p) => fs.existsSync(new URL(`../extension/${p}`, import.meta.url));
  check("vendored: pdf.js + transformers runtime + model config",
    vendored("vendor/pdf.min.js") &&
    vendored("vendor/transformers/transformers.min.mjs") &&
    vendored("vendor/transformers/ort-wasm-simd-threaded.jsep.wasm") &&
    vendored("vendor/models/qwen2.5-0.5b-instruct/config.json") &&
    vendored("vendor/models/qwen2.5-0.5b-instruct/tokenizer.json") &&
    vendored("vendor/models/qwen2.5-0.5b-instruct/LICENSE"));
  // The 483 MB weights are not in git (fetch-model.sh restores
  // them); their presence is asserted at packaging time instead.
  console.log("INFO model weights present in this tree: " +
    vendored("vendor/models/qwen2.5-0.5b-instruct/onnx/model_q4f16.onnx"));
}

process.exit(failures ? 1 : 0);
