---
phase: 17
slug: node-type-read-back-and-snippet-placeholder-fixes
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-10
---

# Phase 17 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| canvas view → runner content | Canvas in-memory data (getData()) flows into CanvasParser | In-process JSON (CanvasData object) — same trust level as vault.read() |
| vault disk → runner content | Fallback: disk JSON flows into CanvasParser | File content read via Obsidian vault.read() API |
| user input → draft.placeholders | Label text and type selection from mini-form become placeholder data | User-typed label strings, normalized via slugifyLabel() |
| draft.placeholders → template textarea | Slug derived from label is inserted into template | Slug string injected into textarea.value (DOM-sandboxed) |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-17-01 | Tampering | getCanvasJSON() | accept | getData() returns Obsidian-internal data already trusted by saveLive(); same trust level as vault.read(). No user-controlled injection path. | closed |
| T-17-02 | Denial of Service | debouncedRequestSave leak | accept | getCanvasJSON() is read-only; does not interact with debounce timers. No timer changes in this fix. | closed |
| T-17-03 | Information Disclosure | Live canvas data exposure | accept | Data stays in-process (same plugin). No serialization to external storage in this path. | closed |
| T-17-04 | Spoofing | Stale disk vs live data | mitigate | getCanvasJSON() takes strict precedence over vault.read() when canvas is open — live in-memory data is canonical. Verified in runner-view.ts lines 62-64 and confirmed by TDD tests (canvas-live-editor.test.ts, 4 tests GREEN). | closed |
| T-17-05 | Tampering | slugifyLabel(rawLabel) | accept | slugifyLabel() normalizes user input to safe Unicode slug via `[^\p{L}\p{N}]+/gu`; already implemented and tested in snippet-model.test.ts (10 tests GREEN). No injection path into file system from slug alone. | closed |
| T-17-06 | Tampering | insertAtCursor | accept | textarea.value manipulation is sandboxed to the DOM; no eval or innerHTML involved. | closed |
| T-17-07 | Denial of Service | Rapid Add clicks | accept | Each click is independent; no async operation in the Add handler path. No timer or accumulation issue. | closed |
| T-17-08 | Elevation of Privilege | type="button" absence | mitigate | Explicit type="button" added to miniAddBtn (line 226) and miniCancelBtn (line 228) in snippet-manager-view.ts. Prevents implicit submit behavior in Electron/Chromium webview. Verified structurally and via live UAT (8 steps passed). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-17-01 | T-17-01 | getData() is an Obsidian-internal API already used by saveLive(); no new attack surface introduced. Data does not cross process boundary. | Roman Shulgha | 2026-04-10 |
| AR-17-02 | T-17-02 | getCanvasJSON() is purely read-only; the debounce timer in saveLive() is unaffected. No DoS vector from read-only method. | Roman Shulgha | 2026-04-10 |
| AR-17-03 | T-17-03 | Canvas data is in-process plugin memory. No external serialization. Same confidentiality scope as vault.read(). | Roman Shulgha | 2026-04-10 |
| AR-17-04 | T-17-05 | slugifyLabel() produces URL-safe Unicode slugs used only as textarea identifiers. No filesystem write or eval involved. | Roman Shulgha | 2026-04-10 |
| AR-17-05 | T-17-06 | textarea.value assignment is fully DOM-sandboxed; Obsidian/Electron CSP prevents script injection via value. | Roman Shulgha | 2026-04-10 |
| AR-17-06 | T-17-07 | Synchronous click handler with no async accumulation. Multiple rapid clicks are idempotent in terms of resource usage. | Roman Shulgha | 2026-04-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-10 | 8 | 8 | 0 | gsd-security-auditor (orchestrated) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-10
