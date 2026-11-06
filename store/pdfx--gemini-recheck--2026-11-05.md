<!--
SPDX-FileCopyrightText: 2026 2351485 ALBERTA INC.

SPDX-License-Identifier: MIT
-->

# Gemini pre-store re-check — pdfx 1.1.1 fix build (2026-11-05)

Request: Gemini (custom.gemini connector, model gemini-3.1-flash-lite,
connector default; lane proven live with --list-models before the
call) asked for a delta re-check of the 1.1.1 fix build: defect F1
(downloads produced no file — detached-anchor click) and defect F2
(popup extraction failed on a detached ArrayBuffer), root causes,
fixes, new regression tests with mutation check, package hashes.

## Verdict: PASS

## Wright-side disposition

- Gemini confirms both fixes address the stated root causes with
  the standard patterns (DOM-attached anchor with an isConnected
  check and a loud failure state; fresh Blob reads per pdf.js
  call), and finds no new store-policy, privacy or security
  concern in the delta. Accepted as stated.
- Its one submission note — mention the nomodel fallback strategy
  in the AMO "Notes for Reviewers" when the Firefox light package
  is submitted — is a submission-time instruction, recorded here
  for the submission lane; it needs no code change.
- The decisive leg remains Wright's real-browser re-proof of
  these exact packages; it has NOT run yet at the time of this
  check and the release does not proceed without it.

## Raw response (verbatim)

### Review Verdict: PASS

**Reasoning:**
The provided delta fix addresses the two identified functional defects (F1 and F2) with robust, industry-standard patterns. The implementation details confirm that the extension remains fully self-contained and privacy-preserving.

#### 1. Effectiveness of Fixes
*   **Defect F1 (Downloads):** Moving to a centralized, DOM-attached anchor pattern is the correct way to handle `blob:` URLs in MV3 extension contexts. The addition of an `isConnected` verification and a visible `role=alert` failure state satisfies the "no silent failure" requirement (Gate 12). The logic is sound and addresses the behavior of modern browser security models regarding detached anchors.
*   **Defect F2 (Popup Extraction):** The transition from passing a mutable `ArrayBuffer` to using `Blob.arrayBuffer()` for fresh reads is the standard solution for avoiding `DataCloneError` and buffer detachment issues in `pdf.js`. By decoupling the extraction calls from the initial buffer state, you have eliminated the race condition/state-persistence issue identified in 1.1.0.

#### 2. Store Policy, Privacy, and Security
*   **Privacy:** No changes to permissions or data handling. The extension continues to operate locally. The use of `Blob` objects for internal processing is memory-efficient and does not expose user data to the network.
*   **Security:**
    *   **CSP:** The `script-src 'self' 'wasm-unsafe-eval'` policy is maintained. The fix does not introduce any `eval()` or remote code execution vectors.
    *   **Blob URLs:** Using `URL.createObjectURL(blob)` for local downloads is safe within the context of an extension, provided the content is generated internally (as is the case here).
    *   **DOM Injection:** The temporary attachment/detachment of the `<a>` tag is a clean implementation that avoids polluting the DOM.
*   **Policy:** The fix adheres to the "Self-Contained" requirement. The inclusion of three distinct package variants (including the Firefox-specific `nomodel` build for AMO size limits) demonstrates a clear understanding of store-specific constraints.

#### 3. Reviewer Flags (Delta Check)
*   **Regression Testing:** The inclusion of a mutation-based test suite (proving failure on 1.1.0 and success on 1.1.1) is excellent and provides high confidence for a store reviewer.
*   **Code Quality:** The consolidation of the download helper into `docstore.js` reduces code duplication and decreases the attack surface by centralizing critical logic.
*   **Note for Submission:** Ensure the AMO submission for `pdfx-firefox-nomodel.zip` explicitly mentions the 200MB fallback strategy in the "Notes for Reviewers" field to prevent an automated rejection based on file size.

**Conclusion:**
The changes are high-quality, address the bugs directly without over-engineering, and maintain the existing security posture of the extension. No new risks have been introduced.
