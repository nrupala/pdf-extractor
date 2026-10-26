
from __future__ import annotations
import re
from collections import Counter
from pathlib import Path
from typing import Any

def decode_value(v):
    """Fix wart (a): pdfminer metadata may be undecoded UTF-16 bytes."""
    if isinstance(v, bytes):
        b=v
        if b.startswith(b"\xfe\xff"): 
            try: return b.decode("utf-16")
            except Exception: pass
        if b.startswith(b"\xff\xfe"):
            try: return b.decode("utf-16")
            except Exception: pass
        # PDFDoc encoding-ish: try utf-16-be if nulls present
        if b"\x00" in b:
            try: return b.decode("utf-16-be").lstrip("\ufeff")
            except Exception: pass
        return b.decode("utf-8","replace").lstrip("\ufeff")
    if isinstance(v, str):
        return v.lstrip("\ufeff")
    return v

_HEADING_RE=re.compile(r"^\s*(Chapter|Appendix|Section)\s+[\w.]+")
_STOPWORDS={"a","an","and","are","as","at","be","by","for","from","in","is","it","of","on","or","that","the","this","to","with"}
_CONCEPT_KEYWORDS=["outcome","convergence","CTST","mechanism","governance","lineage","context","freshness","attribution","observer","Goodhart","requisite","variety","agency","constraint"]

def parse_structure(text):
    chapters=[]; appendices=[]; sections=[]
    for line in text.splitlines():
        if not _HEADING_RE.match(line): continue
        s=line.strip(); low=s.lower()
        if low.startswith("chapter"): chapters.append(s)
        elif low.startswith("appendix"): appendices.append(s)
        elif low.startswith("section"): sections.append(s)
    return {"chapters":chapters,"appendices":appendices,"sections":sections}

def build_index(text):
    tokens=[t for t in re.split(r"[^A-Za-z0-9]+",text) if t]
    lower=[t.lower() for t in tokens if t.lower() not in _STOPWORDS]
    counts=Counter(lower); top=[t for t,_ in counts.most_common(20)]
    concepts=[kw for kw in _CONCEPT_KEYWORDS if kw.lower() in lower]
    return {"concepts":concepts,"term_count":len(lower),"top_terms":top}

# alias matching original agent name
def index_text(text): return build_index(text)

def get_metadata(pdf_path):
    """Fix wart (b): page count via PDFPage.create_pages, not document.get_pages()."""
    from pdfminer.pdfdocument import PDFDocument
    from pdfminer.pdfpage import PDFPage
    from pdfminer.pdfparser import PDFParser
    path=Path(pdf_path)
    with open(path,"rb") as fh:
        parser=PDFParser(fh); doc=PDFDocument(parser)
        info={}
        if doc.info:
            raw=doc.info[0]
            for k,val in raw.items():
                info[str(k).lower()]=decode_value(val)
        pages=len(list(PDFPage.create_pages(doc)))
    return {"title":info.get("title"),"author":info.get("author"),"creator":info.get("creator"),"producer":info.get("producer"),"pages":pages,"metadata":info}

def extract_text_pdfminer(pdf_path):
    from pdfminer.high_level import extract_text
    return extract_text(str(pdf_path))

def extract_text_pypdf2(pdf_path):
    import PyPDF2
    out=[]
    with open(pdf_path,"rb") as f:
        r=PyPDF2.PdfReader(f)
        for i,page in enumerate(r.pages):
            t=page.extract_text()
            if t: out.append(f"=== PAGE {i+1} ===\n{t}\n")
    return "".join(out)

def extract_document(pdf_path, engine="pdfminer"):
    path=Path(pdf_path)
    if not path.is_file(): raise FileNotFoundError(f"PDF not found: {pdf_path}")
    text=extract_text_pypdf2(path) if engine=="pypdf2" else extract_text_pdfminer(path)
    try: meta=get_metadata(path)
    except Exception: meta={"pages":None,"title":None,"author":None}
    return {"source":str(path),"engine":engine,"text":text,"text_length":len(text),"metadata":meta,"structure":parse_structure(text),"index":build_index(text)}
