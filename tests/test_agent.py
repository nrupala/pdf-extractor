# SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.
#
# SPDX-License-Identifier: MIT

"""Original 5 agent tests, carried over (import path updated to pdfx)."""
from pdfx import PDFExtractorAgent

SAMPLE_TEXT = """
Chapter 1: Foundations of the Outcome Convergence System
The outcome convergence is driven by mechanisms and governance.
The CTST layer records lineage and context freshness for the observer.

Appendix A: Reference Tables
A table of mechanism types and their authority bounds.

Section 1.1: Requisite Variety
The requisite variety principle constrains governance; Goodhart risk
is managed through attribution and agency.
"""

def test_parse_structure_groups_heading_lines():
    agent = PDFExtractorAgent()
    structure = agent.parse_structure(SAMPLE_TEXT)
    assert len(structure["chapters"]) == 1
    assert structure["chapters"][0].startswith("Chapter 1")
    assert len(structure["appendices"]) == 1
    assert structure["appendices"][0].startswith("Appendix A")
    assert len(structure["sections"]) == 1
    assert structure["sections"][0].startswith("Section 1.1")

def test_parse_structure_ignores_non_heading_lines():
    agent = PDFExtractorAgent()
    structure = agent.parse_structure("just a plain paragraph\n\nChapter 2: Real\n")
    assert structure["chapters"] == ["Chapter 2: Real"]
    assert structure["appendices"] == []
    assert structure["sections"] == []

def test_index_returns_concepts():
    agent = PDFExtractorAgent()
    index = agent.index(SAMPLE_TEXT)
    concepts = set(index["concepts"])
    assert {"outcome", "convergence", "mechanism", "governance", "CTST", "lineage"} <= concepts

def test_index_returns_term_count_and_top_terms():
    agent = PDFExtractorAgent()
    index = agent.index(SAMPLE_TEXT)
    assert isinstance(index["term_count"], int) and index["term_count"] > 0
    assert isinstance(index["top_terms"], list) and 0 < len(index["top_terms"]) <= 20

def test_index_removes_stopwords():
    agent = PDFExtractorAgent()
    index = agent.index("the and of a big outcome")
    assert "the" not in index["top_terms"]
    assert "outcome" in index["concepts"]
