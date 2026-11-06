# SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.
#
# SPDX-License-Identifier: MIT

from __future__ import annotations
import argparse, sys
from pathlib import Path
from .core import extract_document, get_metadata
from .outputs import WRITERS, EXT
def main(argv=None):
    p=argparse.ArgumentParser(prog="pdfx",description="Extract text, structure & Word files from PDFs - fully local")
    p.add_argument("input",help="Input PDF file")
    p.add_argument("-o","--output-dir",default=None,help="Output directory (default: extracted_<stem> next to PDF)")
    p.add_argument("--format",default="txt,md,docx,json",help="Comma list: txt,md,docx,json")
    p.add_argument("--engine",choices=["pdfminer","pypdf2"],default="pdfminer",help="pdfminer (default) or pypdf2 page-marked mode")
    p.add_argument("--info",action="store_true",help="Show decoded metadata incl. page count")
    p.add_argument("--quiet",action="store_true")
    a=p.parse_args(argv)
    src=Path(a.input)
    if not src.exists(): print(f"Input file not found: {src}"); return 1
    if a.info:
        m=get_metadata(src); print("PDF Metadata:")
        for k in ("pages","title","author","creator","producer"): print(f"- {k}: {m.get(k)}")
    doc=extract_document(src,engine=a.engine)
    outdir=Path(a.output_dir) if a.output_dir else src.parent/f"extracted_{src.stem}"
    outdir.mkdir(parents=True,exist_ok=True)
    for fmt in [f.strip().lower() for f in a.format.split(",") if f.strip()]:
        if fmt not in WRITERS: print(f"Unknown format: {fmt}"); return 2
        dest=outdir/f"{src.stem}{EXT[fmt]}"; WRITERS[fmt](doc,dest)
        if not a.quiet: print(f"Wrote {dest}")
    if not a.quiet: print(f"Extracted {doc['text_length']} characters, {doc['metadata'].get('pages')} pages")
    return 0
if __name__=="__main__": sys.exit(main())
