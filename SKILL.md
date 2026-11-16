<!--
SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.

SPDX-License-Identifier: MIT
-->

# Skill: pdfx — local PDF extraction for agents

Use this skill when you are an AI agent and you need the **text,
structure, or metadata of a PDF file on this machine** — to read it,
summarize it, quote it, or feed it into another step — without sending
the file anywhere. pdfx runs fully local: no cloud, no account, no
upload.

## When to reach for pdfx

- The user points at a local PDF and asks what it says, how it is
  organized, or what its metadata claims.
- You need a document's structure (chapters / appendices / sections)
  before deciding which parts to read closely.
- Use your own file reading instead when the file is not a PDF, or
  when you need layout-faithful rendering (pdfx extracts text and
  structure, not page images).

## The tools (MCP server `pdfx-mcp`, stdio)

| Tool | Arguments | Returns |
|---|---|---|
| `extract_pdf` | `path` (required), `engine`: `pdfminer` (default) or `pypdf2` | Full text, decoded metadata, structure, and concept index |
| `pdf_metadata` | `path` | Decoded metadata incl. page count |
| `pdf_structure` | `path` | Chapters / appendices / sections detected in the text |

CLI equivalents: `pdfx <file> [--info] [--format txt,md,docx,json]
[--engine pypdf2]`.

## Workflow

1. Start cheap: `pdf_metadata` for page count and title before a full
   extraction of a large file.
2. `extract_pdf` for the content; `pdf_structure` when you only need
   the outline.
3. **Check the text length before you conclude anything.** pdfx reads
   the PDF's text layer — there is no OCR. Empty or near-empty text
   from a file that clearly has pages almost always means a scanned /
   image-only PDF with no text layer. Report that ("no extractable
   text layer — this looks scanned") instead of reporting the document
   as empty.
4. Treat structure as detected, not guaranteed: it comes from a
   heading parser over the extracted text. An empty structure means
   no headings were detected, not that the document has no sections.

## Rules of the house

- Everything stays on the machine. Do not relay extracted content to
  external services as part of using this skill.
- Quote metadata as the document's claims ("the metadata says the
  author is …"), not as verified facts.

---

*Agentic Packaging Standard conformance (2026-11-16): explicit
uncertainty — met by the README "Known limits" section and step 3
above (no OCR; empty text names its likely cause); composite task
tools — met in substance (`extract_pdf` is itself the task-level call;
the other two tools are its cheap probes); agent onboarding — met by
this file; zero-compile install — met in part (prebuilt installers on
GitHub Releases v1.0.1; the pip route installs from source);
measured traces — open (no benchmark trace published); terminal-story
docs — met (README sample is a real capture from the repo's own test
fixture).*
