// SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.
//
// SPDX-License-Identifier: MIT

"use strict";
/*
 * PDF Extractor (pdfx) workspace — the full-tab surface.
 *
 * Two views over one local store:
 * - Document: the feedreader for the current extraction (structure
 *   left, text right), downloads, filing into the knowledgebank,
 *   and talk-to-the-page.
 * - Knowledgebank: containers/tags (navigation) · filed items
 *   (list) · item text with its stored artifacts (reading pane),
 *   search and container/tag filters, .json/.md bundle export.
 *
 * Everything is local: extraction by the vendored pdf.js engine,
 * storage in IndexedDB. The only network calls this page can make
 * are the licence validation (key + product id only) — never
 * document content.
 */
const lib = globalThis.pdfjsLib;
if (lib && typeof chrome !== "undefined" && chrome.runtime) {
  lib.GlobalWorkerOptions.workerSrc =
    chrome.runtime.getURL("vendor/pdf.worker.min.js");
}

const $ = (id) => document.getElementById(id);
const store = PdfxStorage;
const ops = PdfxBank.createOps(store.bank);

let currentDoc = null;
let currentPages = [];
let containers = [];
let items = [];
let bankFilter = { containerId: null, tag: null, query: "" };
let selectedItem = null;
let pendingAtom = null;
let licence = null;

// ------------------------------------------------------------ helpers

function el(tag, text, cls) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

// Downloads go through the shared downloadBytes() in docstore.js
// (attached-anchor click; the detached-anchor copy that lived here
// silently produced no file in a real browser — defect F1,
// browser proof 2026-11-05).

function fillColorSelect(sel) {
  sel.innerHTML = "";
  for (const c of PdfxBank.PALETTE) {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = "■";
    o.style.color = c;
    sel.appendChild(o);
  }
  sel.value = PdfxBank.PALETTE[4];
}

// ------------------------------------------------------------- licence

async function loadLicence() {
  licence = await store.settings.get("licence");
}

function renderLicenceState() {
  $("licence-state").textContent = licence
    ? `Licence ••••${licence.tail} — status: ${licence.status}.`
    : "No licence on file.";
}

async function validateLicence() {
  const key = $("licence-key").value.trim();
  const status = $("licence-status");
  if (!key) { status.textContent = "Enter a licence key first."; return; }
  status.textContent = "Validating…";
  try {
    const ok = await PdfxTalk.validateLicence(key);
    licence = {
      status: ok ? "valid" : "invalid",
      tail: key.slice(-4),
      checkedAt: Date.now(),
    };
    await store.settings.put("licence", licence);
    status.textContent = ok
      ? "Licence valid — talk is unlocked for documents of any size."
      : "That key was not accepted.";
  } catch (e) {
    // The validation service is the pending half of the contract;
    // say so plainly rather than pretending an answer.
    licence = { status: "pending", tail: key.slice(-4), checkedAt: Date.now() };
    await store.settings.put("licence", licence);
    status.textContent =
      "The licence validation service is not live yet, so this key " +
      "could not be checked. Talk stays within the free limit until " +
      "it is.";
  }
  renderLicenceState();
}
$("licence-validate").onclick = validateLicence;

// ---------------------------------------------------------------- talk

let talkMeter = { usedSeconds: 0 };

async function askTalk(itemLike, qEl, aEl, readerEl) {
  const q = qEl.value.trim();
  if (!q) return;
  const gate = PdfxTalk.meterAllows(talkMeter, licence);
  if (!gate.allowed) {
    // One plain line, only here, only when the meter is spent.
    aEl.textContent =
      "Your free talk time (15 minutes in total) is used up — talk " +
      "is paused, not removed. Pro removes the meter for good: " +
      "About / Settings.";
    return;
  }
  const t0 = performance.now();
  aEl.textContent = "Searching the text…";
  const layer = await PdfxModel.readyLayer().catch(() => null);
  const res = await PdfxTalk.answerWithModel(itemLike, q, layer);
  talkMeter = PdfxTalk.chargeSeconds(
    talkMeter, (performance.now() - t0) / 1000);
  await store.settings.put("talkmeter", talkMeter);
  aEl.innerHTML = "";
  aEl.appendChild(el("p", res.text));
  if (res.found) {
    const cites = el("p", null, "cites");
    cites.appendChild(document.createTextNode("From: "));
    res.hits.forEach((h, i) => {
      if (i) cites.appendChild(document.createTextNode(" · "));
      const b = el("button", h.citation, "citebtn");
      b.title = "Open this passage in the reader";
      b.onclick = () => highlightPassage(readerEl, h.text);
      cites.appendChild(b);
    });
    cites.appendChild(document.createTextNode(res.model
      ? ` · phrased on-device by ${res.model} from these passages`
      : " · retrieved passages, shown verbatim"));
    aEl.appendChild(cites);
  }
  aEl.appendChild(el("p", PdfxModel.describe(), "wherelabel"));
}

// Citation discipline: a citation opens its exact passage in the
// local reader, highlighted (the field study's Emergency-Box bar).
function highlightPassage(pre, passageText) {
  if (!pre || !passageText) return;
  const full = pre.textContent;
  const anchor = passageText.trim().slice(0, 120);
  const idx = full.indexOf(anchor);
  if (idx === -1) return;
  const end = Math.min(full.length, idx + passageText.trim().length);
  pre.innerHTML = "";
  pre.appendChild(document.createTextNode(full.slice(0, idx)));
  const mark = document.createElement("mark");
  mark.textContent = full.slice(idx, end);
  pre.appendChild(mark);
  pre.appendChild(document.createTextNode(full.slice(end)));
  mark.scrollIntoView({ block: "center" });
}

// ---------------------------------------------------- model catalogue

async function renderModels() {
  const sel = PdfxModel.getSelected();
  const used = talkMeter.usedSeconds || 0;
  $("model-state").textContent =
    `Selected: ${PdfxModel.entryById(sel).name}. ` +
    PdfxModel.describe() +
    (licence && licence.status === "valid"
      ? " Talk meter: removed (Pro)."
      : ` Free talk used: ${Math.floor(used / 60)}m ${used % 60}s ` +
        "of 15m in total.");
  const wrap = $("model-catalogue");
  wrap.innerHTML = "";
  wrap.appendChild(el("p",
    "Downloads bring MODELS to your machine — your documents never " +
    "leave it. Downloaded models live in this browser and work " +
    "offline afterwards.", "note"));
  for (const entry of [PdfxModel.BUNDLED, ...PdfxModel.CATALOG]) {
    const row = el("div", null, "modelrow");
    row.appendChild(el("span",
      `${entry.name} — ${entry.detail}`, "modelname"));
    if (sel === entry.id) {
      row.appendChild(el("span", "Selected", "note"));
    } else {
      const b = el("button", "Select");
      b.onclick = async () => {
        PdfxModel.setSelected(entry.id);
        await store.settings.put("talkModel", entry.id);
        renderModels();
      };
      row.appendChild(b);
    }
    if (!entry.bundled) {
      const status = el("span", "", "note");
      const dl = el("button", "Download");
      dl.onclick = async () => {
        status.textContent = "Downloading…";
        try {
          await PdfxModel.downloadModel(entry.id, (p) => {
            if (p && p.status === "progress" && p.progress != null) {
              status.textContent =
                `Downloading… ${Math.round(p.progress)}%`;
            }
          });
          status.textContent = "Downloaded and cached on this device.";
        } catch (e) {
          status.textContent =
            "The model catalogue host is not live yet — downloads " +
            "start when it is. The bundled model keeps working.";
        }
      };
      row.appendChild(dl);
      row.appendChild(status);
    }
    wrap.appendChild(row);
  }
  const clear = el("button", "Clear downloaded models");
  clear.onclick = async () => {
    await PdfxModel.clearDownloads();
    renderModels();
  };
  wrap.appendChild(clear);
}

// ------------------------------------------------------------ document

function setProgress(page, total) {
  if (!total) {
    $("progresswrap").style.display = "none";
    return;
  }
  $("progresswrap").style.display = "block";
  $("bar").max = total;
  $("bar").value = page;
  $("progtext").textContent = `Extracting… page ${page} of ${total}`;
}

function renderDoc(doc) {
  const m = doc.metadata || {};
  $("doctitle").textContent = m.title || PdfxEngine.stemOf(doc.source);
  $("docmeta").textContent =
    [m.author && `Author: ${m.author}`, `${m.pages} pages`,
     `${doc.text_length} characters`].filter(Boolean).join(" · ");
  const s = doc.structure || {};
  const wrap = $("structbody");
  wrap.innerHTML = "";
  let any = false;
  for (const [title, list] of [["Chapters", s.chapters],
      ["Appendices", s.appendices], ["Sections", s.sections]]) {
    if (!list || !list.length) continue;
    any = true;
    wrap.appendChild(el("h4", title));
    const ul = document.createElement("ul");
    for (const item of list) ul.appendChild(el("li", item));
    wrap.appendChild(ul);
  }
  if (!any) wrap.appendChild(el("p",
    "No chapters, appendices or sections detected.", "note"));
  $("terms").textContent = (doc.index.top_terms || []).join(", ");
  $("text").textContent = doc.text;
  $("downloads").style.display = "block";
  $("filebar").style.display = "block";
  $("talk-doc").style.display = "block";
  $("forget").style.display = "inline-block";
  $("chunk-from").max = m.pages;
  $("chunk-to").max = m.pages;
  $("chunk-to").value = m.pages;
  setProgress(0, 0);
}

async function extractBlob(blob, name) {
  setProgress(0, 1);
  $("progtext").textContent = "Loading…";
  try {
    const buf = await blob.arrayBuffer();
    const { doc, pageTexts } = await PdfxEngine.extractWithPages(
      lib, new Uint8Array(buf), name, setProgress);
    currentDoc = doc;
    currentPages = pageTexts;
    renderDoc(doc);
  } catch (e) {
    setProgress(0, 0);
    $("text").textContent = `Could not extract that PDF: ${e.message || e}`;
  }
}

for (const btn of document.querySelectorAll("#downloads button")) {
  btn.onclick = () => {
    if (!currentDoc) return;
    const fmt = btn.dataset.fmt;
    const doc = currentDoc;
    if (fmt === "docx") {
      downloadBytes(`${PdfxEngine.stemOf(doc.source)}.docx`,
        PdfxEngine.docxBytes(doc),
        "application/vnd.openxmlformats-officedocument" +
          ".wordprocessingml.document");
    } else {
      const content = fmt === "json" ? PdfxEngine.toJson(doc)
        : fmt === "md" ? PdfxEngine.toMarkdown(doc)
        : PdfxEngine.toText(doc);
      downloadBytes(`${PdfxEngine.stemOf(doc.source)}.${fmt}`,
        content, "text/plain");
    }
  };
}

function docTalkItem() {
  if (!currentDoc) return null;
  return {
    title: currentDoc.metadata.title || currentDoc.source,
    text: currentDoc.text,
    passages: PdfxBank.documentAtom(currentDoc, currentPages).passages,
  };
}
$("talk-doc-ask").onclick = () => {
  const item = docTalkItem();
  if (item) askTalk(item, $("talk-doc-q"), $("talk-doc-a"), $("text"));
};

// -------------------------------------------------------------- filing

function openFilePanel(atom, title) {
  pendingAtom = atom;
  $("fp-title").textContent = title;
  const wrap = $("fp-containers");
  wrap.innerHTML = "";
  if (!containers.length) {
    wrap.appendChild(el("p",
      "No containers yet — name one below and it is created as you file.",
      "note"));
  }
  for (const c of containers) {
    const label = el("label", null, "fp-cont");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c.id;
    const dot = el("span", "■ ");
    dot.style.color = c.color;
    label.appendChild(cb);
    label.appendChild(dot);
    label.appendChild(document.createTextNode(c.name));
    wrap.appendChild(label);
  }
  const dl = $("taglist");
  dl.innerHTML = "";
  for (const t of PdfxBank.allTags(items)) {
    const o = document.createElement("option");
    o.value = t;
    dl.appendChild(o);
  }
  $("fp-tags").value = "";
  $("fp-status").textContent = "";
  $("filepanel").style.display = "block";
}

$("file-doc").onclick = () => {
  if (!currentDoc) return;
  openFilePanel(
    PdfxBank.documentAtom(currentDoc, currentPages),
    `File document — ${currentDoc.metadata.title || currentDoc.source}`);
};

$("file-chunk").onclick = () => {
  if (!currentDoc) return;
  const total = currentDoc.metadata.pages;
  let from = parseInt($("chunk-from").value, 10) || 1;
  let to = parseInt($("chunk-to").value, 10) || total;
  from = Math.max(1, Math.min(from, total));
  to = Math.max(from, Math.min(to, total));
  openFilePanel(
    PdfxBank.chunkAtom(currentDoc, currentPages, from, to),
    `File pages ${from}–${to}`);
};

$("fp-cancel").onclick = () => {
  pendingAtom = null;
  $("filepanel").style.display = "none";
};

$("fp-save").onclick = async () => {
  if (!pendingAtom) return;
  let ids = [...document.querySelectorAll("#fp-containers input:checked")]
    .map((cb) => cb.value);
  const newName = $("fp-nc-name").value.trim();
  if (newName) {
    const c = PdfxBank.makeContainer(newName, $("fp-nc-color").value);
    await store.bank.putContainer(c);
    containers.push(c);
    ids.push(c.id);
  }
  pendingAtom.containerIds = ids;
  pendingAtom.tags = $("fp-tags").value.split(",")
    .map((t) => t.trim()).filter(Boolean);
  await ops.file(pendingAtom);
  items.push(pendingAtom);
  $("fp-status").textContent = `Filed “${pendingAtom.title}”.`;
  pendingAtom = null;
  renderBankNav();
  renderBankList();
  setTimeout(() => { $("filepanel").style.display = "none"; }, 900);
};

// -------------------------------------------------------- bank: render

function switchView(name) {
  $("docview").style.display = name === "doc" ? "block" : "none";
  $("bankview").style.display = name === "bank" ? "block" : "none";
  $("settingsview").style.display =
    name === "settings" ? "block" : "none";
  $("view-doc").classList.toggle("selected", name === "doc");
  $("view-bank").classList.toggle("selected", name === "bank");
  $("view-settings").classList.toggle("selected", name === "settings");
  if (name === "bank") { renderBankNav(); renderBankList(); }
  if (name === "settings") { renderLicenceState(); renderModels(); }
}
$("view-doc").onclick = () => switchView("doc");
$("view-bank").onclick = () => switchView("bank");
$("view-settings").onclick = () => switchView("settings");

function renderBankNav() {
  const nav = $("bank-containers");
  nav.innerHTML = "";
  const mkRow = (label, id, color, container) => {
    const b = el("button", null, "banknav" +
      (bankFilter.containerId === id ? " selected" : ""));
    if (color) {
      const dot = el("span", "■ ");
      dot.style.color = color;
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(label));
    b.onclick = () => {
      bankFilter.containerId = id;
      bankFilter.tag = null;
      renderBankNav();
      renderBankList();
    };
    nav.appendChild(b);
    if (container) {
      const del = el("button", "✕ delete", "condel-btn");
      del.onclick = () => askDeleteContainer(container);
      nav.appendChild(del);
    }
  };
  mkRow(`All items (${items.length})`, null, null);
  for (const c of containers) {
    const n = items.filter(
      (i) => (i.containerIds || []).includes(c.id)).length;
    mkRow(`${c.name} (${n})`, c.id, c.color, c);
  }
  const unfiled = items.filter(
    (i) => !(i.containerIds || []).length).length;
  if (unfiled) mkRow(`Unfiled (${unfiled})`, "__none__", null);

  const tags = $("bank-tags");
  tags.innerHTML = "";
  for (const t of PdfxBank.allTags(items)) {
    const b = el("button", `#${t}`, "banknav tag" +
      (bankFilter.tag === t ? " selected" : ""));
    b.onclick = () => {
      bankFilter.tag = bankFilter.tag === t ? null : t;
      renderBankNav();
      renderBankList();
    };
    tags.appendChild(b);
  }
}

function visibleItems() {
  let list = items;
  if (bankFilter.containerId === "__none__") {
    list = list.filter((i) => !(i.containerIds || []).length);
  } else if (bankFilter.containerId) {
    list = list.filter(
      (i) => (i.containerIds || []).includes(bankFilter.containerId));
  }
  return PdfxBank.filterItems(list, {
    tag: bankFilter.tag, query: bankFilter.query,
  });
}

function renderBankList() {
  const wrap = $("bank-items");
  wrap.innerHTML = "";
  const list = visibleItems();
  if (!list.length) {
    wrap.appendChild(el("p", "Nothing filed here yet.", "note"));
    return;
  }
  for (const item of list) {
    const b = el("button", null, "bankitem" +
      (selectedItem && selectedItem.id === item.id ? " selected" : ""));
    b.appendChild(el("span", item.title, "bi-t"));
    b.appendChild(el("span",
      `${item.sourceName} · p. ${item.pageStart}–${item.pageEnd} · ` +
      `${item.wordCount} words`, "bi-m"));
    b.onclick = () => selectItem(item);
    wrap.appendChild(b);
  }
}

function selectItem(item) {
  selectedItem = item;
  renderBankList();
  $("bi-title").textContent = item.title;
  const names = (item.containerIds || [])
    .map((id) => containers.find((c) => c.id === id))
    .filter(Boolean).map((c) => c.name);
  $("bi-meta").textContent =
    `${item.sourceName} · pages ${item.pageStart}–${item.pageEnd} · ` +
    `${item.wordCount} words` +
    (names.length ? ` · in: ${names.join(", ")}` : " · unfiled") +
    ((item.tags || []).length ? ` · tags: ${item.tags.join(", ")}` : "");
  $("bi-text").textContent = item.text;
  $("bi-notes").textContent = item.notes ? `Notes: ${item.notes}` : "";
  $("bi-artifacts").style.display = "block";
  $("bi-editor").style.display = "none";
  $("talk-bank").style.display = "block";
}

for (const btn of document.querySelectorAll("#bi-artifacts [data-art]")) {
  btn.onclick = () => {
    if (!selectedItem) return;
    const fmt = btn.dataset.art;
    // Artifacts regenerate from the item's current text on every
    // download — edits are never out of sync with outputs.
    const data = PdfxBank.artifactsForItem(PdfxEngine, selectedItem)[fmt];
    const stem = PdfxEngine.stemOf(selectedItem.sourceName) +
      `-p${selectedItem.pageStart}-${selectedItem.pageEnd}`;
    if (fmt === "docx") {
      downloadBytes(`${stem}.docx`, data,
        "application/vnd.openxmlformats-officedocument" +
          ".wordprocessingml.document");
    } else {
      downloadBytes(`${stem}.${fmt}`, data, "text/plain");
    }
  };
}

$("bi-delete").onclick = async () => {
  if (!selectedItem) return;
  await ops.remove(selectedItem);
  items = items.filter((i) => i.id !== selectedItem.id);
  selectedItem = null;
  $("bi-title").textContent = "Knowledgebank";
  $("bi-text").textContent = "";
  $("bi-notes").textContent = "";
  $("bi-artifacts").style.display = "none";
  $("bi-editor").style.display = "none";
  $("talk-bank").style.display = "none";
  renderBankNav();
  renderBankList();
};

// ------------------------------------------------------- item editing

function openEditor() {
  if (!selectedItem) return;
  const item = selectedItem;
  $("ed-title").value = item.title;
  $("ed-tags").value = (item.tags || []).join(", ");
  $("ed-notes").value = item.notes || "";
  $("ed-text").value = item.text;
  const wrap = $("ed-containers");
  wrap.innerHTML = "";
  for (const c of containers) {
    const label = el("label", null, "fp-cont");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = c.id;
    cb.checked = (item.containerIds || []).includes(c.id);
    const dot = el("span", "■ ");
    dot.style.color = c.color;
    label.appendChild(cb);
    label.appendChild(dot);
    label.appendChild(document.createTextNode(c.name));
    wrap.appendChild(label);
  }
  $("bi-editor").style.display = "block";
}
$("bi-edit").onclick = openEditor;
$("ed-cancel").onclick = () => {
  $("bi-editor").style.display = "none";
};

function readEditor(item) {
  const textChanged = $("ed-text").value !== item.text;
  item.title = $("ed-title").value.trim() || item.title;
  item.tags = $("ed-tags").value.split(",")
    .map((t) => t.trim()).filter(Boolean);
  item.notes = $("ed-notes").value;
  item.containerIds =
    [...document.querySelectorAll("#ed-containers input:checked")]
      .map((cb) => cb.value);
  if (textChanged) {
    item.text = $("ed-text").value;
    PdfxBank.resegment(item);
  }
  return item;
}

$("ed-save").onclick = async () => {
  if (!selectedItem) return;
  readEditor(selectedItem);
  await ops.save(selectedItem);
  $("bi-editor").style.display = "none";
  selectItem(selectedItem);
  renderBankNav();
};

$("ed-saveas").onclick = async () => {
  if (!selectedItem) return;
  const draft = { ...selectedItem };
  readEditor(draft);
  const copy = await ops.saveAs(draft, draft.title);
  items.push(copy);
  $("bi-editor").style.display = "none";
  renderBankNav();
  selectItem(copy);
};

// ------------------------------------------------- container deletion

let pendingDeleteContainer = null;
function askDeleteContainer(c) {
  pendingDeleteContainer = c;
  const n = items.filter(
    (i) => (i.containerIds || []).includes(c.id)).length;
  $("condel-text").textContent =
    `Delete container “${c.name}”? It holds ${n} filed item(s). ` +
    "Deleting is real — the records leave this browser's storage.";
  $("condel").style.display = "block";
}
$("condel-cancel").onclick = () => {
  pendingDeleteContainer = null;
  $("condel").style.display = "none";
};
async function doDeleteContainer(mode) {
  if (!pendingDeleteContainer) return;
  const c = pendingDeleteContainer;
  await ops.deleteContainer(c, mode);
  containers = containers.filter((x) => x.id !== c.id);
  items = await store.bank.listItems();
  if (selectedItem &&
      !items.some((i) => i.id === selectedItem.id)) {
    selectedItem = null;
    $("bi-text").textContent = "";
    $("bi-artifacts").style.display = "none";
  }
  pendingDeleteContainer = null;
  $("condel").style.display = "none";
  if (bankFilter.containerId === c.id) bankFilter.containerId = null;
  renderBankNav();
  renderBankList();
}
$("condel-out").onclick = () => doDeleteContainer("out");
$("condel-with").onclick = () => doDeleteContainer("with");

$("talk-bank-ask").onclick = () => {
  if (selectedItem) {
    askTalk(selectedItem, $("talk-bank-q"), $("talk-bank-a"),
      $("bi-text"));
  }
};

$("bank-search").addEventListener("input", () => {
  bankFilter.query = $("bank-search").value;
  renderBankList();
});

$("nc-add").onclick = async () => {
  const name = $("nc-name").value.trim();
  if (!name) return;
  const c = PdfxBank.makeContainer(name, $("nc-color").value);
  await store.bank.putContainer(c);
  containers.push(c);
  $("nc-name").value = "";
  renderBankNav();
};

function exportSelection(containerOnly, fmt) {
  let cs = containers;
  let list = items;
  if (containerOnly) {
    const id = bankFilter.containerId;
    if (!id || id === "__none__") {
      $("bi-meta").textContent =
        "Pick a container first to export just that container.";
      return;
    }
    cs = containers.filter((c) => c.id === id);
    list = items.filter((i) => (i.containerIds || []).includes(id));
  }
  const content = fmt === "json"
    ? PdfxBank.exportJson("PDF Extractor (pdfx)", cs, list)
    : PdfxBank.exportMd("PDF Extractor (pdfx)", cs, list);
  downloadBytes(
    containerOnly ? "knowledgebank-container." + fmt
      : "knowledgebank." + fmt,
    content, "text/plain");
}
$("exp-bank-json").onclick = () => exportSelection(false, "json");
$("exp-bank-md").onclick = () => exportSelection(false, "md");
$("exp-cont-json").onclick = () => exportSelection(true, "json");
$("exp-cont-md").onclick = () => exportSelection(true, "md");

// -------------------------------------------------------------- inputs

$("file").addEventListener("change", async () => {
  const f = $("file").files[0];
  if (f) {
    await PdfxDocStore.put(f, f.name);
    extractBlob(f, f.name);
  }
});

document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", async (e) => {
  e.preventDefault();
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) {
    await PdfxDocStore.put(f, f.name);
    extractBlob(f, f.name);
  }
});

$("forget").onclick = async () => {
  await PdfxDocStore.forget();
  location.reload();
};

// ---------------------------------------------------------------- init

fillColorSelect($("nc-color"));
fillColorSelect($("fp-nc-color"));

(async () => {
  await loadLicence();
  talkMeter = (await store.settings.get("talkmeter")) ||
    { usedSeconds: 0 };
  PdfxModel.setSelected(
    (await store.settings.get("talkModel")) || undefined);
  containers = await store.bank.listContainers();
  items = await store.bank.listItems();
  const rec = await PdfxDocStore.get();
  if (rec && rec.blob) extractBlob(rec.blob, rec.name);
})();
