---
phase: 20
slug: housekeeping-removals
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-10
---

# Phase 20 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Canvas JSON → parser | External canvas file input crosses trust boundary into `parseNode()` | Node kind strings from untrusted vault files |
| Session file → `openCanvas()` | Persisted session JSON is read from vault disk — user-editable | `runnerStatus` string and node IDs from untrusted JSON |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-20-02-01 | Tampering | `canvas-parser.ts` DEPRECATED_KINDS | accept | `DEPRECATED_KINDS` is a module-scope `const Set` — cannot be modified by canvas content. Silent-skip path exposes no API surface. | closed |
| T-20-02-02 | Tampering | `session-model.ts` runnerStatus | mitigate | Raw-string cast guard in `openCanvas()` detects legacy `'awaiting-snippet-fill'` before TypeScript narrowing; calls `sessionService.clear()` and falls through to fresh start — no code execution, no data disclosure. Implemented in Plan 03 as T-20-03-01. | closed |
| T-20-02-03 | Information Disclosure | `protocol-runner.ts` | accept | Removing `enterFreeText()` and `completeSnippet()` reduces public API surface. No new disclosure risk introduced. | closed |
| T-20-02-04 | Denial of Service | `canvas-parser.ts` | accept | `DEPRECATED_KINDS.has()` is O(1) and allocates nothing. No DoS risk added. | closed |
| T-20-03-01 | Tampering | `openCanvas()` legacy session guard | mitigate | `(session as unknown as { runnerStatus: string }).runnerStatus === 'awaiting-snippet-fill'` guard fires before TypeScript narrowing. Calls `sessionService.clear()`, falls through to fresh start. No user-facing error — no session content leaked. Verified in `runner-view.ts` lines 103–107. | closed |
| T-20-03-02 | Elevation of Privilege | `editor-panel-view.ts` free-text-input removal | accept | Removing the `'free-text-input'` dropdown option and form case reduces the plugin's editable surface area. No privilege escalation vector introduced. | closed |
| T-20-03-03 | Information Disclosure | `styles.css` | accept | CSS changes are static style rules with no data access. Removing `.rp-free-text-input` eliminates dead code from the stylesheet. | closed |
| T-20-03-04 | Denial of Service | `openCanvas()` awaiting-snippet-fill guard | accept | Guard calls `sessionService.clear()` once and falls through — no loop, no I/O retry, no unbounded wait. O(1) path. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-20-01 | T-20-02-01 | DEPRECATED_KINDS is a compile-time constant with no runtime write path — canvas content cannot influence it. | Roman Shulgha | 2026-04-10 |
| AR-20-02 | T-20-02-03 | Dead-code removal (API surface reduction) — no new risk surface, risk only decreases. | Roman Shulgha | 2026-04-10 |
| AR-20-03 | T-20-02-04 | Set.has() is O(1); no allocation risk. Existing risk posture unchanged. | Roman Shulgha | 2026-04-10 |
| AR-20-04 | T-20-03-02 | Dead-code removal (form case removal) — attack surface reduced, not expanded. | Roman Shulgha | 2026-04-10 |
| AR-20-05 | T-20-03-03 | Static CSS rules carry no data access semantics — no risk to accept. | Roman Shulgha | 2026-04-10 |
| AR-20-06 | T-20-03-04 | Single synchronous clear() call; no loop or unbounded path. | Roman Shulgha | 2026-04-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-10 | 8 | 8 | 0 | gsd-security-auditor (automated) |
| 2026-04-10 | 8 | 8 | 0 | /gsd-secure-phase re-verification — mitigations confirmed in codebase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-10
