
from __future__ import annotations
import json
from pathlib import Path
def write_txt(doc, path): Path(path).write_text(doc["text"],encoding="utf-8")
def write_json(doc, path): Path(path).write_text(json.dumps(doc,ensure_ascii=False,indent=2),encoding="utf-8")
def write_md(doc, path):
    m=doc.get("metadata") or {}; lines=[f"# {m.get('title') or Path(doc.get('source','document')).stem}",""]
    lines+=[f"- Author: {m.get('author')}" if m.get('author') else "", f"- Pages: {m.get('pages')}","", "## Structure"]
    s=doc.get("structure") or {}
    for k in ("chapters","appendices","sections"):
        for h in s.get(k,[]): lines.append(f"- {h}")
    lines+=["","## Text","",doc.get("text","")]
    Path(path).write_text("\n".join(lines),encoding="utf-8")
def write_docx(doc, path):
    from docx import Document
    d=Document(); m=doc.get("metadata") or {}
    d.core_properties.title=m.get("title") or ""; 
    if m.get("author"): d.core_properties.author=str(m["author"])
    d.add_heading(m.get("title") or Path(doc.get("source","Document")).stem, level=0)
    d.add_paragraph(f"Pages: {m.get('pages')}  Author: {m.get('author') or ''}")
    s=doc.get("structure") or {}
    if any(s.get(k) for k in s):
        d.add_heading("Structure",level=1)
        for k in ("chapters","appendices","sections"):
            for h in s.get(k,[]): d.add_paragraph(h,style="List Bullet")
    d.add_heading("Text",level=1)
    for para in (doc.get("text") or "").split("\n\n"):
        if para.strip(): d.add_paragraph(para.strip())
    d.save(str(path))
WRITERS={"txt":write_txt,"md":write_md,"json":write_json,"docx":write_docx}
EXT={"txt":".txt","md":".md","json":".json","docx":".docx"}
