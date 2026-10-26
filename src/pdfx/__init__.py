"""PDF Extractor (pdfx)."""
__version__="1.0.1"
from .core import extract_document, get_metadata, parse_structure, build_index, decode_value
from .agent import PDFExtractorAgent
__all__=["extract_document","get_metadata","parse_structure","build_index","decode_value","PDFExtractorAgent","__version__"]
