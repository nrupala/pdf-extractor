
from __future__ import annotations
from pathlib import Path
from .core import parse_structure, build_index, get_metadata, extract_text_pdfminer
class PDFExtractorAgent:
    """Original OCS PDFExtractorAgent, productized with decoded metadata."""
    def __init__(self): self._pdfminer_available=None
    def _check_pdfminer(self):
        if self._pdfminer_available is None:
            try: import pdfminer.high_level; self._pdfminer_available=True
            except ImportError: self._pdfminer_available=False
        return self._pdfminer_available
    def extract(self, pdf_path, output_dir=None):
        path=Path(pdf_path)
        if not path.is_file(): raise FileNotFoundError(f"PDF not found: {pdf_path}")
        text=extract_text_pdfminer(path)
        result={"text_length":len(text),"first_200_chars":text[:200]}
        if output_dir is not None:
            out=Path(output_dir); out.mkdir(parents=True,exist_ok=True)
            op=out/f"{path.stem}.txt"; op.write_text(text,encoding="utf-8"); result["output_path"]=str(op)
        return result
    def parse_structure(self, text): return parse_structure(text)
    def index(self, text): return build_index(text)
    def extract_metadata(self, pdf_path):
        try: return get_metadata(pdf_path)
        except Exception: return {}
