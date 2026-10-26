"""Engine/output tests incl. docx and the two wart fixes."""
import json
from pathlib import Path
import pytest
from pdfx.core import decode_value, extract_document, get_metadata
from pdfx.outputs import WRITERS
from pdfx.cli import main as cli_main

@pytest.fixture(scope="module")
def sample_pdf(tmp_path_factory):
    # Build a real PDF with UTF-16-ish metadata via PyPDF2 writer + report via fpdf-free minimal writer using PyPDF2 blank + metadata
    import PyPDF2
    w = PyPDF2.PdfWriter()
    w.add_blank_page(width=612, height=792)
    w.add_blank_page(width=612, height=792)
    w.add_metadata({"/Title": "Sample Title", "/Author": "Jane Author", "/Creator": "pdfx-test"})
    p = tmp_path_factory.mktemp("pdf") / "sample.pdf"
    with open(p, "wb") as f:
        w.write(f)
    return p

def test_decode_utf16_bytes():
    raw = "Jane Author".encode("utf-16")  # includes BOM \xfe\xff...
    assert decode_value(raw) == "Jane Author"
    assert decode_value(b"\xfe\xff\x00J\x00a\x00n\x00e") == "Jane"

def test_metadata_pages_not_unknown(sample_pdf):
    m = get_metadata(sample_pdf)
    assert m["pages"] == 2
    assert m["author"] == "Jane Author"
    assert isinstance(m["author"], str) and not m["author"].startswith("b'")

def test_extract_and_outputs(sample_pdf, tmp_path):
    doc = extract_document(sample_pdf)
    assert doc["metadata"]["pages"] == 2
    doc["text"] = "Chapter 1: Hello\n\nSome body text about outcome and governance."
    doc["structure"] = {"chapters": ["Chapter 1: Hello"], "appendices": [], "sections": []}
    for fmt, writer in WRITERS.items():
        dest = tmp_path / f"out.{fmt}"
        writer(doc, dest)
        assert dest.exists() and dest.stat().st_size > 0
    data = json.loads((tmp_path / "out.json").read_text())
    assert data["metadata"]["pages"] == 2
    from docx import Document
    d = Document(str(tmp_path / "out.docx"))
    assert any("Hello" in p.text for p in d.paragraphs)

def test_pypdf2_engine(sample_pdf):
    doc = extract_document(sample_pdf, engine="pypdf2")
    assert doc["engine"] == "pypdf2"
    assert doc["metadata"]["pages"] == 2

def test_cli_info(sample_pdf, tmp_path, capsys):
    rc = cli_main([str(sample_pdf), "-o", str(tmp_path / "o"), "--info", "--format", "txt,json"])
    assert rc == 0
    out = capsys.readouterr().out
    assert "pages: 2" in out
    assert (tmp_path / "o" / "sample.txt").exists()
