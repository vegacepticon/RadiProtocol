# Phase 57: REQUIREMENTS Traceability Refresh + Phase 54 Promotion - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Pure REQUIREMENTS.md edit closing audit gaps from `.planning/v1.8-MILESTONE-AUDIT.md`:

1. Promote Phase 54 (Inline Protocol Display Mode) to a formal REQ-ID family `INLINE-01..05`, mapped **verbatim** to ROADMAP §Phase 54 Success Criteria 1-5.
2. Flip the 11 stale `[ ]` → `[x]` checkboxes whose phases are already complete at plan + UAT level (NODEUI-01..05, PICKER-01, PICKER-02, RUNNER-SKIP-01..03, BRAT-01).
3. Refresh the traceability table at the bottom of REQUIREMENTS.md with the new INLINE rows and updated statuses.
4. Preserve EDGE-01's existing historical-vs-active annotation (already partially in place at lines 55 + 145) and add a brief coverage summary at the top of REQUIREMENTS.md.
5. **Zero source-code changes** — `src/`, `main.js`, `styles.css`, `tests/` must not be touched. Phase lands as a single atomic REQUIREMENTS.md rewrite + ROADMAP.md/STATE.md rollup commit per SC-5.

This phase must precede Phase 58 because `54-VERIFICATION.md` (written in Phase 58) cites `INLINE-01..05`.

</domain>

<decisions>
## Implementation Decisions

### INLINE-01..05 Wording Style
- **D-01:** Each `INLINE-0N` requirement body is the **verbatim text** of the corresponding Phase 54 Success Criterion from ROADMAP.md §Phase 54 (lines 365–369), preserved word-for-word. Honors Phase 57 SC-1's explicit "mapped verbatim" clause and avoids paraphrase drift.
- **D-02:** Each INLINE requirement gets the same `Source:` + `Signal:` sub-bullet structure as other REQUIREMENTS in the file (mirroring RUNFIX-01 / RUNNER-SKIP-01 layout). `Source:` points to `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` + `.planning/notes/inline-protocol-mode.md`; `Signal:` summarises the observable post-condition ("command registered", "floating modal opens", "note-as-buffer", "source-note binding", "additive to sidebar/tab").
- **D-03:** INLINE section is inserted into REQUIREMENTS.md in phase-order (after `### Runner Skip & Close (RUNNER)` section, before `### Distribution (BRAT)`) as a new `### Inline Protocol Display Mode (INLINE)` block. Matches the existing section ordering convention.

### Plan Decomposition
- **D-04:** Phase 57 ships as a **single plan** (`57-01-PLAN.md`) producing a single atomic commit. All edits to REQUIREMENTS.md (INLINE section, 11 checkbox flips, traceability table rebuild, EDGE-01 annotation polish, coverage summary) land together. Phase 57 SC-5 explicitly calls for "a single REQUIREMENTS.md rewrite + ROADMAP.md/STATE.md rollup commit" — splitting the edits across plans would either force non-atomic merges or pointless intermediate commits against the same file.

### EDGE-01 Annotation + Coverage Summary
- **D-05:** EDGE-01 traceability row + requirement body annotations are kept **as-is** (they already say "superseded by EDGE-03 as active contract; Phase 49 closure stays as historical milestone" at REQUIREMENTS.md lines 55 + 145). Phase 57 SC-3 only asks for "clarification", not restructuring. The double-checkbox (EDGE-01 ✓ historical + EDGE-03 ✓ active) is intentional — both rows carry the historical-vs-active annotation so the pattern is self-documenting.
- **D-06:** A new `## Coverage Summary` block is added near the top of REQUIREMENTS.md (after `## v1.8 Requirements` heading and before `### Runner Regressions (RUNFIX)`) showing the post-flip count: N/M requirements closed, with one-line call-out of items explicitly deferred to Phase 58 (verification-artifact gap — RUNNER-CLOSE-01..03 remain `[ ]` pending 58). Satisfies Phase 57 SC-4.

### Stale Checkbox Scope
- **D-07:** The 11 flips are exactly: `NODEUI-01..05` (5 × 2026-04-19, Phase 48) + `PICKER-01` (2026-04-20, Phase 51) + `PICKER-02` (2026-04-20, Phase 51) + `RUNNER-SKIP-01..03` (3 × 2026-04-21, Phase 53) + `BRAT-01` (2026-04-21, Phase 55). **RUNNER-CLOSE-01/02/03 are explicitly NOT in the flip list** — they were reset to `[ ]` by the audit and stay `[ ]` until Phase 58 authors the backing `53-VERIFICATION.md`.
- **D-08:** Each flipped checkbox gains an inline completion-date annotation using the format already present on RUNFIX-01/02/03 (`✅ Closed by Phase X (YYYY-MM-DD)`). Dates come from ROADMAP.md's per-phase completion lines (already authoritative) — no re-checking against git history.

### Phase 56 REQ-ID
- **D-09:** Phase 56 does **not** get its own REQ-ID — per the existing convention in ROADMAP line 398 ("Follow-up to PICKER-01; PICKER-02 unaffected") and the audit line 145. The PICKER-01 traceability row already references "Phase 51 (+ Phase 56 reversal)". Introducing a PICKER-01-R or similar would contradict the standing design decision and add noise.

### EDGE-01 Annotation Scope
- **D-10:** Any polish to EDGE-01 is limited to light clarifying language on the traceability row (the current "⚠ historical … — superseded by EDGE-03 as active contract" is already acceptable). No changes to the requirement body at line 51-55 — that content is correct.

### Claude's Discretion
- Exact phrasing of the `## Coverage Summary` block (length, whether to use a table or bullet list) — default to a 3-6 line bullet list with header counts.
- Ordering of the traceability table rebuild — preserve existing row order, add `INLINE-01..05` rows positioned between `RUNNER-CLOSE-03` and `BRAT-01` (chronological phase order).
- Whether the STATE.md rollup includes Phase 57 progress entry now (yes, per SC-5 — a single commit with all three files: REQUIREMENTS.md + ROADMAP.md progress table update + STATE.md session record).

### Folded Todos
None — no pending todos match Phase 57 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Gap-closure source of truth
- `.planning/v1.8-MILESTONE-AUDIT.md` — Authoritative list of 11 stale checkboxes + finding that Phase 54 lacks a REQ-ID. §`gaps.requirements` drives the flip list; §`tech_debt.milestone-wide` (lines 146-150) is the verbatim audit statement.

### Phase-scope specs
- `.planning/ROADMAP.md` §Phase 54 (lines 360-370) — Success Criteria 1-5 become `INLINE-01..05` verbatim.
- `.planning/ROADMAP.md` §Phase 57 (lines 417-427) — Full Phase 57 Success Criteria defining what "done" means for this edit.
- `.planning/ROADMAP.md` §Phase 55 (lines 379-393) — BRAT-01 completion evidence for the checkbox flip.

### Requirements file
- `.planning/REQUIREMENTS.md` — Target of edit. Existing section structure (Runner Regressions → Node Editor UX → Edge Semantics → Snippet Node & Picker → JSON Snippet Placeholders → Runner Skip & Close → Distribution) is preserved; new `### Inline Protocol Display Mode (INLINE)` section is inserted after `### Runner Skip & Close (RUNNER)`.

### Prior context on Phase 54 design (Source for INLINE REQ-IDs)
- `.planning/phases/54-inline-protocol-display-mode/54-CONTEXT.md` — Locked design decisions for Phase 54.
- `.planning/notes/inline-protocol-mode.md` — 4 locked design decisions from `/gsd-explore` 2026-04-20.

### Standing convention
- `.planning/PROJECT.md` — Project principles (non-negotiable: backward-compat, no console.log, CSS append-only per phase). Not directly touched by Phase 57 but informs tone of INLINE-02/03 Signal text.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **REQUIREMENTS.md structure** — existing sections follow the pattern `### Section Name (PREFIX)` + `- [x/ ] **REQ-ID**: Body. ✅ Closed by Phase X.` + optional `  - **Source:** path` + `  - **Signal:** observable`. Mirror this exactly for INLINE.
- **Traceability table** — existing rows use `| REQ-ID | Phase X | ✅ complete (DATE) |` or longer "UAT PASS DATE — verification artefact pending Phase 58". Preserve conventions.
- **Annotation notes at bottom of file** (line 164) — existing sentence already mentions "Phase 57 introduces INLINE-01..05 and flips stale checkboxes, Phase 58 authors the missing VERIFICATION.md artefacts". Keep this line; it already advertises Phase 57's role.

### Established Patterns
- Completion date annotation format: `✅ Closed by Phase X Plan NN (YYYY-MM-DD)` or `✅ Closed by Phase X (YYYY-MM-DD)` — both are used; Phase 57 can standardize on the shorter form for the 11 flips.
- Superseded-REQ handling: EDGE-01 uses a `- **Superseded by EDGE-03 (Phase 50.1):**` sub-bullet inside the REQ body, plus `⚠ historical` marker in traceability. No INLINE reqs are superseded — not relevant for this phase but worth noting.

### Integration Points
- `.planning/ROADMAP.md` §Progress table (lines 449+) — needs a Phase 57 + Phase 58 entry once this phase commits.
- `.planning/STATE.md` — needs a session record for Phase 57 completion, written in the same commit as REQUIREMENTS.md per SC-5 atomicity.

</code_context>

<specifics>
## Specific Ideas

- **Verbatim preservation:** When copying Phase 54 SC 1-5 to INLINE-01..05, keep backticks, em-dashes, parenthetical clauses, and the word "inline" intact. Diff the final INLINE block against ROADMAP.md lines 365-369 to prove verbatim match.
- **Coverage Summary tone:** Short and factual. Example structure:
  ```
  ## Coverage Summary (as of 2026-04-21)

  **Requirements closed:** N of M (N/M%)
  **Deferred to Phase 58 (verification-artifact backfill):** RUNNER-CLOSE-01..03 (UAT PASS, awaiting VERIFICATION.md)
  **Historical / superseded:** EDGE-01 (superseded by EDGE-03 as active contract)
  ```
- **EDGE-01 row polish:** Existing annotation is acceptable. Only consider tightening "⚠ historical (Phase 49 UAT PASS 2026-04-19) — superseded by EDGE-03 (Phase 50.1) as active contract" to read cleanly — but do not change meaning.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 56 dedicated REQ-ID (e.g., PICKER-01R)** — rejected per D-09. Not revisiting.
- **Restructuring EDGE-01 / EDGE-03 into a single `EDGE` contract row** — out of Phase 57 scope; would require REQUIREMENTS rewrite beyond gap-closure.
- **Auto-derived coverage counts via script** — useful for future milestones; Phase 57 uses manual counting.

</deferred>

---

*Phase: 57-requirements-traceability-refresh*
*Context gathered: 2026-04-21*
