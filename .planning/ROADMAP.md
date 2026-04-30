# Roadmap: RadiProtocol

**Project:** RadiProtocol
**Last updated:** 2026-04-29 (v1.11 milestone opened — phases 69–74 derived from 12 requirements; v1.10 details collapsed into archive)

---

## Milestones

- ✅ **v1.0 Community Plugin Release** — Phases 1-7 (shipped 2026-04-07)
- ✅ **v1.2 Runner UX & Bug Fixes** — Phases 12-19 (shipped 2026-04-10)
- ✅ **v1.3 Interactive Placeholder Editor** — Phase 27 (shipped 2026-04-12)
- ✅ **v1.4 Snippets and Colors, Colors and Snippets** — Phases 28-31 (shipped 2026-04-15)
- ✅ **v1.5 Snippet Editor Refactoring** — Phases 32-35 (shipped 2026-04-16)
- ✅ **v1.6 Polish & Canvas Workflow** — Phases 36-42 (shipped 2026-04-17)
- ✅ **v1.7 Loop Rework & Regression Cleanup** — Phases 43-46 (shipped 2026-04-18)
- ✅ **v1.8 UX Polish & Snippet Picker Overhaul** — Phases 47-58 (shipped 2026-04-21)
- ✅ **v1.9 Inline Runner Polish & Settings UX** — Phases 59-62 (shipped 2026-04-25)
- ✅ **v1.10 Editor Sync & Runner UX Polish** — Phases 63-68 (shipped 2026-04-26)
- 🚧 **v1.11 Inline Polish, Loop Hint, Donate & Canvas Library** — Phases 69-74 (in progress)

_v1.10 shipped. v1.11 milestone opened 2026-04-29 — 12 requirements (INLINE-CLEAN-01, LOOP-EXIT-01, DONATE-01, CANVAS-LIB-01..08, BRAT-03) mapped to 6 phases._

---

## Phases

### v1.11 (active)

- [x] **Phase 69: Inline Runner — Hide Result-Export Buttons in Complete State** — At protocol-complete state, Inline Runner stops rendering Insert / Copy to clipboard / Save to note buttons; sidebar and tab Runner views unchanged
- [ ] **Phase 70: Loop-Exit Picker Visual Hint** — `+`-prefix loop-exit button gets a subtle accent treatment using existing Obsidian CSS variables, applied uniformly across sidebar / tab / inline runner modes
- [ ] **Phase 71: Settings — Donate Section** — "Помочь разработке" section at the top of the Settings tab with nine crypto-wallet rows and copy-to-clipboard controls
- [ ] **Phase 72: Canvas Library — Full Algorithmic Canvases** — Five author-vault canvases (ГМ, ОБП, ОЗП, ОМТ, ПКОП) hand-built and verified end-to-end against `Z:\projects\references\` `.md` templates
- [ ] **Phase 73: Canvas Library — Short Algorithmic Canvases** — Three author-vault short-version canvases (ОГК, ОБП, ОМТ) hand-built alongside the full versions and verified end-to-end against the short `.md` templates
- [ ] **Phase 74: GitHub Release v1.11.0** — `manifest.json` / `versions.json` / `package.json` aligned on `1.11.0`, unprefixed annotated tag pushed, GitHub Release with three loose root assets, BRAT smoke install on a clean vault verified

### Archived milestones

<details>
<summary>✅ v1.0 Community Plugin Release (Phases 1-7) — SHIPPED 2026-04-07</summary>

- [x] Phase 1: Project Scaffold and Canvas Parsing Foundation (6/6 plans) — completed 2026-04-06
- [x] Phase 2: Core Protocol Runner Engine (3/3 plans) — completed 2026-04-06
- [x] Phase 3: Runner UI (ItemView) (5/5 plans) — completed 2026-04-06
- [x] Phase 4: Canvas Node Editor Side Panel (3/3 plans) — completed 2026-04-06
- [x] Phase 5: Dynamic Snippets (5/5 plans) — completed 2026-04-06
- [x] Phase 6: Loop Support (3/3 plans) — completed 2026-04-07
- [x] Phase 7: Mid-Session Save and Resume (3/3 plans) — completed 2026-04-07

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Runner UX & Bug Fixes (Phases 12-19) — SHIPPED 2026-04-10</summary>

- [x] Phase 12: Runner Layout Overhaul — completed 2026-04-08
- [x] Phase 13: Sidebar Canvas Selector and Run Again — completed 2026-04-08
- [x] Phase 14: Node Editor Auto-Switch and Unsaved Guard — completed 2026-04-09
- [x] Phase 15: Text Separator Setting — completed 2026-04-09
- [x] Phase 16: Runner Textarea Edit Preservation — completed 2026-04-09
- [x] Phase 17: Node Type Read-Back and Snippet Placeholder Fixes — completed 2026-04-09
- [x] Phase 18: CSS Gap Fixes (INSERTED) — completed 2026-04-10
- [x] Phase 19: Phase 12-14 Formal Verification — completed 2026-04-10

Full details: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v1.3 Interactive Placeholder Editor (Phase 27) — SHIPPED 2026-04-12</summary>

- [x] Phase 27: Interactive Placeholder Editor (1/1 plans) — completed 2026-04-12

Full details: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.4 Snippets and Colors, Colors and Snippets (Phases 28-31) — SHIPPED 2026-04-15</summary>

- [x] Phase 28: Auto Node Coloring (2/2 plans) — completed 2026-04-13
- [x] Phase 29: Snippet Node — Model, Editor, Validator (3/3 plans) — completed 2026-04-13
- [x] Phase 30: Snippet Node — Runner Integration (3/3 plans) — completed 2026-04-14
- [x] Phase 31: Mixed Answer + Snippet Branching at Question Nodes (4/4 plans) — completed 2026-04-15

Full details: `.planning/milestones/v1.4-ROADMAP.md`

</details>

<details>
<summary>✅ v1.5 Snippet Editor Refactoring (Phases 32-35) — SHIPPED 2026-04-16</summary>

- [x] Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync (5/5 plans) — completed 2026-04-15
- [x] Phase 33: Tree UI, Modal Create/Edit, Folder Operations, Vault Watcher (5/5 plans) — completed 2026-04-15
- [x] Phase 34: Drag-and-Drop, Context Menu, Rename, Move with Canvas Reference Updates (6/6 plans) — completed 2026-04-15
- [x] Phase 35: Markdown Snippets in Protocol Runner (2/2 plans) — completed 2026-04-16

Full details: `.planning/milestones/v1.5-ROADMAP.md`

</details>

<details>
<summary>✅ v1.6 Polish & Canvas Workflow (Phases 36-42) — SHIPPED 2026-04-17</summary>

- [x] Phase 36: Dead Code Audit and Cleanup (2/2 plans) — completed 2026-04-16
- [x] Phase 37: Snippet Editor Improvements (2/2 plans) — completed 2026-04-16
- [x] Phase 38: Canvas Node Creation Infrastructure (2/2 plans) — completed 2026-04-16
- [x] Phase 39: Quick-Create UI in Node Editor (2/2 plans) — completed 2026-04-16
- [x] Phase 40: Node Duplication (1/1 plans) — completed 2026-04-16
- [x] Phase 41: Live Canvas Update on Folder Rename (1/1 plans) — completed 2026-04-16
- [x] Phase 42: Snippet Node Quick-Create Button & Double-Click Node Selection Fix (4/4 plans) — completed 2026-04-17

Full details: `.planning/milestones/v1.6-ROADMAP.md`

</details>

<details>
<summary>✅ v1.7 Loop Rework & Regression Cleanup (Phases 43-46) — SHIPPED 2026-04-18</summary>

- [x] Phase 43: Unified Loop — Graph Model, Parser, Validator & Migration Errors (7/7 plans) — completed 2026-04-17
- [x] Phase 44: Unified Loop Runtime (5/5 plans) — completed 2026-04-17
- [x] Phase 45: Loop Editor Form, Picker & Color Map (3/3 plans) — completed 2026-04-18
- [x] Phase 46: Free-Text-Input Removal (3/3 plans) — completed 2026-04-18

Full details: `.planning/milestones/v1.7-ROADMAP.md`

</details>

<details>
<summary>✅ v1.8 UX Polish & Snippet Picker Overhaul (Phases 47-58) — SHIPPED 2026-04-21</summary>

- [x] Phase 47: Runner Regressions (3/3 plans) — completed 2026-04-18
- [x] Phase 48: Node Editor UX Polish (2/2 plans) — completed 2026-04-19
- [x] Phase 48.1: Toolbar Gap Tighten (INSERTED) — completed 2026-04-19
- [x] Phase 49: Loop Exit Edge Convention (5/5 plans) — completed 2026-04-19
- [x] Phase 50: Answer ↔ Edge Label Sync (5/5 plans) — completed 2026-04-19
- [x] Phase 50.1: Loop Exit `+` Prefix Convention (INSERTED) (5/5 plans) — completed 2026-04-19
- [x] Phase 51: Snippet Picker Overhaul (6/6 plans) — completed 2026-04-20
- [x] Phase 52: JSON Placeholder Rework (5/5 plans) — completed 2026-04-20
- [x] Phase 53: Runner Skip & Close Buttons (4/4 plans) — completed 2026-04-21
- [x] Phase 54: Inline Protocol Display Mode (4/4 plans) — completed 2026-04-21
- [x] Phase 55: BRAT Distribution Readiness (4/4 plans) — completed 2026-04-21
- [x] Phase 56: Snippet Button UX Reversal (4/4 plans) — completed 2026-04-21
- [x] Phase 57: REQUIREMENTS Traceability Refresh + Phase 54 Promotion (GAP CLOSURE) (1/1 plans) — completed 2026-04-21
- [x] Phase 58: VERIFICATION.md Backfill + Stale Frontmatter Flip (GAP CLOSURE) — completed 2026-04-21

Full details: `.planning/milestones/v1.8-ROADMAP.md`

</details>

<details>
<summary>✅ v1.9 Inline Runner Polish & Settings UX (Phases 59-62) — SHIPPED 2026-04-25</summary>

- [x] Phase 59: Inline Runner Feature Parity (5/5 plans) — completed 2026-04-24
- [x] Phase 60: Inline Runner Layout & Position Persistence (5/5 plans) — completed 2026-04-24
- [x] Phase 61: Settings Folder Autocomplete (4/4 plans) — completed 2026-04-24
- [x] Phase 62: BRAT Release v1.9.0 (3/3 plans) — shipped 2026-04-25

Full details: `.planning/milestones/v1.9-ROADMAP.md`

</details>

<details>
<summary>✅ v1.10 Editor Sync & Runner UX Polish (Phases 63-68) — SHIPPED 2026-04-26</summary>

- [x] Phase 63: Bidirectional Canvas ↔ Node Editor Sync (4/4 plans + gap closure) — completed 2026-04-25, UAT 9/9 PASS
- [x] Phase 64: Node Editor Polish — Auto-grow & Text Block Quick-Create (3/3 plans) — completed 2026-04-25, UAT 7/7 PASS
- [x] Phase 65: Runner Footer Layout — Back/Skip Row (2/2 plans) — completed 2026-04-25, human-approved
- [x] Phase 66: Runner Step-Back Reliability & Scroll Pinning (5/5 plans) — completed 2026-04-25, UAT 9/9 PASS
- [x] Phase 67: Inline Runner Resizable Modal & File-Bound Snippet Parity (3/3 plans) — completed 2026-04-25, UAT 8/8 PASS
- [x] Phase 68: GitHub Release v1.10.0 (4/4 plans) — shipped 2026-04-26 (Release 1.10.0 live, BRAT smoke verified)

Full details: `.planning/milestones/v1.10-ROADMAP.md`

</details>

---

## Phase Details

### Phase 69: Inline Runner — Hide Result-Export Buttons in Complete State
**Goal**: In every Inline Runner state (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete`), the user no longer sees the redundant Insert / Copy to clipboard / Save to note buttons — only the Close control in the modal header remains. Sidebar Runner View and tab Runner View are unaffected.
**Depends on**: Nothing (Inline-mode-only render-time conditional in `InlineRunnerModal`; isolated from sidebar/tab runner code paths)
**Requirements**: INLINE-CLEAN-01
**Success Criteria** (what must be TRUE):
  1. In every Inline Runner state (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete`), the `.rp-copy-btn`, `.rp-save-btn`, and `.rp-insert-btn` button classes are absent from the DOM, and the `.rp-output-toolbar` container is also absent inside `.rp-inline-runner-content`; only the Close control in the modal header remains as a way to exit the modal (INLINE-CLEAN-01)
  2. Running the same protocol to completion in sidebar Runner View shows all three result-export buttons exactly as before — no cross-mode regression (INLINE-CLEAN-01)
  3. Running the same protocol to completion in tab Runner View shows all three result-export buttons exactly as before — no cross-mode regression (INLINE-CLEAN-01)
  4. The active note continues to receive answer/snippet text appended in real time as the protocol runs (the existing Inline-mode contract is unchanged) — the result-export buttons are removed because they are redundant, not because output stopped working (INLINE-CLEAN-01)
**Plans:** 2 plans
- [ ] 69-01-PLAN.md — Amend INLINE-CLEAN-01 + ROADMAP §Phase 69 to cover all 6 Inline states (D-02)
- [ ] 69-02-PLAN.md — Delete output toolbar + 3 dead CSS blocks + paired regression tests (D-01,D-03..D-09)
**UI hint**: yes

### Phase 70: Loop-Exit Picker Visual Hint
**Goal**: When the runner reaches a `loop` node, the loop-exit button (the picker entry whose edge label starts with the `+` prefix per Phase 50.1 convention) is visually distinguishable from the body-branch buttons next to it via a subtle background/accent treatment using existing Obsidian CSS variables — applied uniformly across sidebar, tab, and inline runner modes.
**Depends on**: Nothing (CSS-only rule in the appropriate `src/styles/*.css` file plus a CSS-hook class on the picker button; append-only per phase per CLAUDE.md)
**Requirements**: LOOP-EXIT-01
**Success Criteria** (what must be TRUE):
  1. Running a protocol that contains a `loop` node into the picker state shows the loop-exit button (the `+`-prefix-labeled edge) with a visibly different background or accent than the body-branch buttons rendered beside it — using existing Obsidian theme variables only (no new colour tokens) (LOOP-EXIT-01)
  2. The loop-exit button retains its original shape, label text (with `+` prefix stripped per existing convention), and position in the picker — only the background/accent changes (LOOP-EXIT-01)
  3. Body-branch buttons in the same picker render with the same styling they had before this phase — no visual regression on the non-exit entries (LOOP-EXIT-01)
  4. The visual hint applies in all three runner modes: sidebar Runner View, tab Runner View, and Inline Runner — verified by reaching a loop picker state in each mode (LOOP-EXIT-01)
**Plans:** 1/1 plans complete
- [x] 70-01-PLAN.md — CSS-only Phase 70 visual-hint append + build + UAT (completed 2026-04-29)
**UI hint**: yes

### Phase 71: Settings — Donate Section
**Goal**: A "Помочь разработке" section is rendered at the very top of the plugin's Settings tab with nine crypto-wallet rows (1 EVM address shared across 6 networks, plus BTC, Solana, Tron) and a copy-to-clipboard control for each row that surfaces a transient Obsidian Notice on success.
**Depends on**: Nothing (Settings-tab UI feature in the same `src/main.ts` settings tab class as Phase 61; reuses `createEl`/`createDiv`/`registerDomEvent` DOM patterns and `navigator.clipboard.writeText` + `new Notice(...)` for copy)
**Requirements**: DONATE-01
**Success Criteria** (what must be TRUE):
  1. Opening the plugin's Settings tab shows a "Помочь разработке" section as the first/top-most section, above all existing settings (Protocols folder, Snippets folder, Output folder, Session folder, Default separator, etc.) (DONATE-01)
  2. The section renders a brief invitation line followed by nine wallet rows: one row labeled with the six EVM networks (Ethereum / Linea / Base / Arbitrum / BNB Chain / Polygon) sharing the address `0x0B528dAF919516899617C536ec26D2d5ab7fB02A`, one row for Bitcoin (`bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7`), one row for Solana (`HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA`), and one row for Tron (`TPBbBauXk56obAiQMSKzMQgsnUiea12hAB`) (DONATE-01)
  3. Each row shows the network name, the wallet address (truncated/wrapped for readability), and a copy-to-clipboard control; clicking the control copies the full untruncated address to the system clipboard via `navigator.clipboard.writeText` and surfaces a transient Obsidian Notice confirming the copy (DONATE-01)
  4. The section persists no settings — wallet addresses are hard-coded constants in source — and contains no external links, no analytics, no network requests (DONATE-01)
**Plans:** 3/3 plans complete
- [x] 71-01-PLAN.md — Constants module `src/donate/wallets.ts` + unit test (NTC-D-03, NTC-D-04)
- [x] 71-02-PLAN.md — New `src/styles/donate-section.css` + register in `esbuild.config.mjs` CSS_FILES (VIS-D-02, VIS-D-03)
- [x] 71-03-PLAN.md — Insert «Помочь разработке» section into `src/settings.ts.display()` + dev-vault UAT (Row-D, EVM-D, NTC-D-01..02)
**UI hint**: yes

### Phase 72: Canvas Library — Full Algorithmic Canvases
**Goal**: Five hand-authored algorithmic `.canvas` files (ГМ, ОБП full, ОЗП, ОМТ full, ПКОП) exist in the author's local vault, each modeled on the reference `ОГК 1.10.0.canvas` and the corresponding `.md` text template plus the `SNIPPETS` folder structure stored at `Z:\projects\references\`, and each runs end-to-end in the Protocol Runner producing a structurally complete report. None of these canvases are bundled with the plugin distribution or committed to this repository.
**Depends on**: Nothing strictly (content-authoring track in author's local vault — does not modify `src/`, does not change build output, does not need vitest tests; can run in parallel with the code-side phases 69/70/71. Each canvas is verified by running it end-to-end in the live Runner against the reference `.md` template at `Z:\projects\references\`.)
**Requirements**: CANVAS-LIB-01, CANVAS-LIB-02, CANVAS-LIB-03, CANVAS-LIB-04, CANVAS-LIB-05
**Success Criteria** (what must be TRUE):
  1. A ГМ (головной мозг) canvas exists in the author's vault and runs end-to-end in the Protocol Runner using the existing graph node kinds (Question / Answer / Text block / Snippet / Loop), producing a structurally complete ГМ report matching the corresponding `.md` text template at `Z:\projects\references\` (CANVAS-LIB-01)
  2. An ОБП (органы брюшной полости — full version) canvas exists and runs end-to-end with output matching the full ОБП `.md` text template (CANVAS-LIB-02)
  3. An ОЗП (органы забрюшинного пространства) canvas exists and runs end-to-end with output matching the ОЗП `.md` text template (CANVAS-LIB-03)
  4. An ОМТ (органы малого таза — full version) canvas exists and runs end-to-end with output matching the full ОМТ `.md` text template (CANVAS-LIB-04)
  5. A ПКОП (пояснично-крестцовый отдел позвоночника) canvas exists and runs end-to-end with output matching the ПКОП `.md` text template (CANVAS-LIB-05)
**Plans:** 5/5 plans complete
- [x] 72-01-PLAN.md — ГМ (головной мозг) authoring guide — start + 7 sections + 1 focal-lesion loop + terminal Заключение/Рекомендации, modeled on ОГК 1.10.0 + ГМ.md (CANVAS-LIB-01)
- [x] 72-02-PLAN.md — ОБП full (органы брюшной полости) authoring guide — «Контраст вводился?» fan-out + 9 sections + 2 loops (ПЕЧЕНЬ + ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА) modeled on ОГК + ОБП без/с контрастом.md (CANVAS-LIB-02)
- [x] 72-03-PLAN.md — ОЗП (органы забрюшинного пространства) authoring guide — «Контраст вводился?» fan-out + 7-9 sections + 3 loops (НАДПОЧЕЧНИКИ + 2 kidneys) modeled on ОЗП без/с контрастом.md (CANVAS-LIB-03)
- [x] 72-04-PLAN.md — ОМТ full (органы малого таза) authoring guide — sex × contrast 4-leaf fan-out + per-gender sections + 2 loops on жен trunks (МАТКА + ЯИЧНИКИ) modeled on 4 ОМТ .md templates (CANVAS-LIB-04)
- [x] 72-05-PLAN.md — ПКОП (пояснично-крестцовый отдел позвоночника) authoring guide — 8 sections + 2 loops (ПОЗВОНКИ + 5-iteration МЕЖПОЗВОНКОВЫЕ ДИСКИ L1-L2..L5-S1) modeled on ПКОП остеохондроз.md (CANVAS-LIB-05)

### Phase 73: Canvas Library — Short Algorithmic Canvases
**Goal**: Three hand-authored short-version `.canvas` files (ОГК short, ОБП short, ОМТ short) exist alongside the existing ОГК 1.10.0 reference canvas and the full versions of ОБП and ОМТ from Phase 72, each modeled on the corresponding short `.md` text template at `Z:\projects\references\`, and each runs end-to-end in the Protocol Runner producing a structurally complete shortened report. None of these canvases are bundled with the plugin distribution or committed to this repository.
**Depends on**: Phase 72 (the short ОБП and short ОМТ canvases pair with the full versions delivered in Phase 72; per requirement text, short canvases "exist alongside" their full counterparts. Short ОГК pairs with the existing ОГК 1.10.0 reference canvas, which already exists pre-milestone.)
**Requirements**: CANVAS-LIB-06, CANVAS-LIB-07, CANVAS-LIB-08
**Success Criteria** (what must be TRUE):
  1. A short-version ОГК (органы грудной клетки) canvas exists alongside the existing ОГК 1.10.0 reference canvas, runs end-to-end in the Protocol Runner, and produces a shortened ОГК report matching the short-ОГК `.md` text template at `Z:\projects\references\` (CANVAS-LIB-06)
  2. A short-version ОБП canvas exists alongside the full ОБП canvas (CANVAS-LIB-02 from Phase 72), runs end-to-end, and produces a shortened ОБП report matching the short-ОБП `.md` text template (CANVAS-LIB-07)
  3. A short-version ОМТ canvas exists alongside the full ОМТ canvas (CANVAS-LIB-04 from Phase 72), runs end-to-end, and produces a shortened ОМТ report matching the short-ОМТ `.md` text template (CANVAS-LIB-08)
**Plans:** 3 plans
- [x] 71-01-PLAN.md — Constants module `src/donate/wallets.ts` + unit test (NTC-D-03, NTC-D-04)
- [x] 71-02-PLAN.md — New `src/styles/donate-section.css` + register in `esbuild.config.mjs` CSS_FILES (VIS-D-02, VIS-D-03)
- [x] 71-03-PLAN.md — Insert «Помочь разработке» section into `src/settings.ts.display()` + dev-vault UAT (Row-D, EVM-D, NTC-D-01..02)

### Phase 74: GitHub Release v1.11.0
**Goal**: Ship a fresh GitHub Release `1.11.0` following the BRAT-installable pattern established by Phases 55 (v1.8.0), 62 (v1.9.0), and 68 (v1.10.0): version files aligned, production build artifacts generated, three loose root assets attached at the GitHub release, unprefixed annotated tag pushed, and end-to-end BRAT install on a clean Obsidian vault verified.
**Depends on**: Phases 69, 70, 71 complete and UAT-accepted (release asset must reflect the full v1.11 shippable plugin build — Inline button cleanup, loop-exit visual hint, and Donate section must have landed before tagging). Phases 72 and 73 are content-authoring tracks that do not modify the plugin distribution and are NOT release-blocking — they ship via the author's local vault, not via the GitHub release. Mirrors Phase 68's runbook structure (D10 UAT-gate-as-first-section pattern).
**Requirements**: BRAT-03
**Success Criteria** (what must be TRUE):
  1. `manifest.json.version`, `versions.json` mapping for `1.11.0`, and `package.json.version` all agree on `1.11.0`; prior version mappings (`1.8.0`, `1.9.0`, `1.10.0`) are preserved in `versions.json`; `npm run build` produces a clean `main.js` + `styles.css` against that manifest version (BRAT-03)
  2. An unprefixed annotated tag `1.11.0` exists on the release commit and is pushed to the remote — matching the BRAT convention from Phases 55 / 62 / 68 (BRAT-03)
  3. A GitHub Release `1.11.0` is published with `manifest.json`, `main.js`, and `styles.css` attached as three individually downloadable loose assets at the release root (no zip), `prerelease=false`, release runbook executed with the D10 UAT-gate-as-first-section pattern (BRAT-03)
  4. Installing the plugin in a fresh Obsidian vault via BRAT with identifier `vegacepticon/RadiProtocol` succeeds end-to-end on the `1.11.0` release — plugin appears in Community Plugins, enables cleanly at version `1.11.0`, and the Runner view opens without errors (BRAT-03)
**Plans:** 3 plans
- [x] 71-01-PLAN.md — Constants module `src/donate/wallets.ts` + unit test (NTC-D-03, NTC-D-04)
- [x] 71-02-PLAN.md — New `src/styles/donate-section.css` + register in `esbuild.config.mjs` CSS_FILES (VIS-D-02, VIS-D-03)
- [x] 71-03-PLAN.md — Insert «Помочь разработке» section into `src/settings.ts.display()` + dev-vault UAT (Row-D, EVM-D, NTC-D-01..02)

---

## Progress

**Execution Order:**
v1.11 in progress — Phase 69 is next. Phases 69, 70, 71 are independent and code-side; Phases 72, 73 are content-authoring tracks (parallel to code phases); Phase 74 is the release gate (depends on 69–71 UAT acceptance).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7 | v1.0 | 28/28 | Complete | 2026-04-07 |
| 12-19 | v1.2 | 15/15 | Complete | 2026-04-10 |
| 27 | v1.3 | 1/1 | Complete | 2026-04-12 |
| 28-31 | v1.4 | 12/12 | Complete | 2026-04-15 |
| 32-35 | v1.5 | 18/18 | Complete | 2026-04-16 |
| 36-42 | v1.6 | 14/14 | Complete | 2026-04-17 |
| 43-46 | v1.7 | 18/18 | Complete | 2026-04-18 |
| 47-58 | v1.8 | 50/50 | Complete | 2026-04-21 |
| 59-62 | v1.9 | 17/17 | Complete | 2026-04-25 |
| 63-68 | v1.10 | 18/18 | Complete | 2026-04-26 |
| 69 | v1.11 | 2/2 | Complete | 2026-04-29 |
| 70 | v1.11 | 1/1 | Complete    | 2026-04-29 |
| 71 | v1.11 | 3/3 | Complete    | 2026-04-29 |
| 72 | v1.11 | 5/5 | Complete   | 2026-04-30 |
| 73 | v1.11 | 0/? | Not started | — |
| 74 | v1.11 | 0/? | Not started | — |
