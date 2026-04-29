---
phase: 72
slug: canvas-library-full-algorithmic-canvases
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 72 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Content-authoring phase — no automated test framework runs. Validation
> is split into static structural-invariant checks (verifier-runnable on
> the canvas JSON) and manual end-to-end runs in Obsidian's Protocol
> Runner against the corresponding `.md` template.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (content-authoring phase — author-side runs in live Obsidian) |
| **Config file** | None |
| **Quick run command** | Open canvas in Obsidian → run via Protocol Runner sidebar → step through start-to-finish |
| **Full suite command** | Run all 5 canvases sequentially in Obsidian; copy assembled output; visual diff vs matching `Z:\projects\references\*.md` |
| **Estimated runtime** | ~5-15 minutes per canvas walkthrough (depends on branch fan-out) |

---

## Sampling Rate

- **After every per-canvas authoring task:** Author opens the canvas in Obsidian and runs at least one path end-to-end (1× ГМ, 2× ОБП [each contrast], 2× ОЗП, 4× ОМТ [sex × contrast], 1× minimum ПКОП [ideally per disc segment]).
- **After every plan wave:** Author confirms the just-finished canvas exits the runner cleanly (no parser error, no deadlock, all sections present in output).
- **Before `/gsd-verify-work`:** All 5 canvases pass static invariants I1–I10 (verifier reads `.canvas` JSON without launching Obsidian) AND author has run each canvas's primary path at least once.
- **Max feedback latency:** ~15 minutes per canvas (manual walkthrough).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 72-01-01 | 01 (ГМ) | 1 | CANVAS-LIB-01 | — | N/A (no security surface — local file authoring) | manual + static | Author runs in Obsidian; verifier checks I1–I10 against `ГМ.canvas` JSON | ❌ W0 (canvas authored in this phase) | ⬜ pending |
| 72-02-01 | 02 (ОБП full) | 1 | CANVAS-LIB-02 | — | N/A | manual + static | Author runs both contrast branches; verifier checks I1–I10 against `ОБП full.canvas` JSON | ❌ W0 | ⬜ pending |
| 72-03-01 | 03 (ОЗП) | 1 | CANVAS-LIB-03 | — | N/A | manual + static | Author runs both contrast branches; verifier checks I1–I10 against `ОЗП.canvas` JSON | ❌ W0 | ⬜ pending |
| 72-04-01 | 04 (ОМТ full) | 1 | CANVAS-LIB-04 | — | N/A | manual + static | Author runs all 4 sex×contrast paths; verifier checks I1–I10 against `ОМТ full.canvas` JSON | ❌ W0 | ⬜ pending |
| 72-05-01 | 05 (ПКОП) | 1 | CANVAS-LIB-05 | — | N/A | manual + static | Author runs full disc-segment loop (5 iterations L1-L2..L5-S1); verifier checks I1–I10 against `ПКОП.canvas` JSON | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None. There is no test infrastructure to bootstrap because this is a content-authoring phase. All "Wave 0" equivalents — author skeleton from ОГК reference, snippet folder paths, fixed Заключение / Рекомендации text — are inlined in each per-canvas authoring plan.

---

## Structural Invariants (Static — Verifier-Runnable)

These ten invariants are statically verifiable from the `.canvas` JSON without launching Obsidian. The verifier (`/gsd-verify-work`) reads each canvas file and confirms each invariant holds. Source: `72-RESEARCH.md` § Validation Architecture.

| # | Invariant | Verification |
|---|-----------|--------------|
| I1 | Exactly one node has `radiprotocol_nodeType:"start"` | grep node array |
| I2 | Every `loop` node has at least one outgoing edge with `label` starting with `"+"` | per-loop edge scan |
| I3 | Every `loop` node has at least one body edge (no label OR non-`+` label) | per-loop edge scan |
| I4 | Every `snippet` node carries exactly one of `radiprotocol_subfolderPath` OR `radiprotocol_snippetPath` | per-snippet attr check |
| I5 | Every section header from the matching `.md` `## Описание` block appears as a `text-block` node text | text-block contents vs section list |
| I6 | The `## Заключение` text from the `.md` appears verbatim somewhere in the canvas | grep raw canvas |
| I7 | The `## Рекомендации` text from the `.md` appears verbatim | grep raw canvas |
| I8 | No edge points to a missing node (referential integrity) | edge.fromNode and edge.toNode resolve |
| I9 | All nodes are reachable from the `start` node via the edge DAG | BFS from start |
| I10 | Every `==…==` placeholder in an answer's text is well-formed (matched `==`) | regex scan |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ГМ canvas runs end-to-end in Obsidian and assembled output structurally matches `ГМ.md` (all sections present, Заключение and Рекомендации verbatim) | CANVAS-LIB-01 | Output structure is observed in the live Protocol Runner sidebar — no headless harness for external `.canvas` files | Open `ГМ 1.0.0.canvas` → start runner → click through each prompt → copy assembled report → visual diff vs `Z:\projects\references\ГМ.md` |
| ОБП full runs end-to-end (both contrast branches) and matches the matching `ОБП без контраста.md` / `ОБП с контрастом.md` template | CANVAS-LIB-02 | Same | Run twice (КУ + безКУ); diff each output |
| ОЗП runs end-to-end (both contrast branches) and matches `ОЗП без контраста.md` / `ОЗП с контрастом.md` | CANVAS-LIB-03 | Same | Run twice; diff |
| ОМТ full runs end-to-end (4 sex×contrast paths) and matches `ОМТ жен без КУ норма.md` / `ОМТ жен с КУ норма.md` / `ОМТ муж без контраста.md` / `ОМТ муж с контрастом.md` | CANVAS-LIB-04 | Same | Run all 4 combinations; diff each |
| ПКОП runs end-to-end with disc loop iterating L1-L2 → L5-S1 and matches `ПКОП остеохондроз.md` | CANVAS-LIB-05 | Same | Run once full pass; verify all 5 vertebral-level segments appear in output |

---

## Validation Sign-Off

- [ ] All five canvases pass static invariants I1–I10 (verifier-runnable)
- [ ] Each canvas has been manually run end-to-end at least once per primary branch (ГМ ×1, ОБП ×2, ОЗП ×2, ОМТ ×4, ПКОП ×1)
- [ ] Visual structural diff against matching `.md` template confirms every section heading appears in output
- [ ] Fixed Заключение and Рекомендации text auto-emitted at end of each canvas
- [ ] No `+`-prefix loop-exit edges missing (Pitfall 1)
- [ ] No body branch missing return-to-header edge (Pitfall 2)
- [ ] No snippet node with both `subfolderPath` and `snippetPath`, or neither (Pitfall 3)
- [ ] No cross-canvas snippet leakage (D-04, D-05 — canvas independence)
- [ ] `nyquist_compliant: true` set in frontmatter once all five canvases verified

**Approval:** pending
