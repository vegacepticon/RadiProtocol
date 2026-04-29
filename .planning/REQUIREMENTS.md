# Requirements: RadiProtocol v1.11

**Defined:** 2026-04-29
**Milestone:** v1.11 — Inline Polish, Loop Hint, Donate & Canvas Library
**Core Value:** A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code.

## v1.11 Requirements

### Inline Runner Polish

- [ ] **INLINE-CLEAN-01**: In every Inline Runner state (`idle`, `at-node`, `awaiting-snippet-pick`, `awaiting-loop-pick`, `awaiting-snippet-fill`, `complete`), the Insert / Copy to clipboard / Save to note buttons are no longer rendered — only the Close control in the modal header remains. The Inline Runner already appends every answer/snippet directly to the active note as the protocol runs, so the result-export buttons are redundant in this mode. The sidebar Runner View and the tab Runner View continue to show all three buttons unchanged — this requirement is Inline-mode-only.

### Runner UX

- [ ] **LOOP-EXIT-01**: When the runner reaches a `loop` node and the picker is rendered, the button representing the loop-exit edge (the edge whose label starts with the `+` prefix per Phase 50.1 convention) is visually distinguishable from the body-branch buttons next to it — a subtle background or accent treatment using existing Obsidian CSS variables (no new colour tokens), without changing button shape, label, or position. The author/user can tell at a glance which button continues the protocol past the loop. Applies uniformly in all three runner modes (sidebar, tab, inline). The body-branch buttons remain styled exactly as today.

### Settings — Donate

- [ ] **DONATE-01**: A "Помочь разработке" section is rendered at the very top of the plugin's Settings tab (above all existing sections), containing a brief invitation line and a list of nine crypto-wallet rows. Each row shows the network name, the wallet address (truncated/wrapped for readability), and a copy-to-clipboard control that copies the full address; clicking it surfaces a transient Obsidian Notice confirming the copy. Wallet rows:
  - **Ethereum / Linea / Base / Arbitrum / BNB Chain / Polygon (single EVM address)** — `0x0B528dAF919516899617C536ec26D2d5ab7fB02A`
  - **Bitcoin** — `bc1qqexgw3dfv6hgu682syufm02d7rfs6myllfmhh7`
  - **Solana** — `HenUEuxAADZqAb7AT6GXL5mz9VNqx6akzwf9w84wNpUA`
  - **Tron** — `TPBbBauXk56obAiQMSKzMQgsnUiea12hAB`

  The section is purely informational — no external links, no analytics, no settings persisted (addresses are hard-coded constants).

### Canvas Library — Author's Reference Algorithms

The eight canvases below are authored by hand in the author's vault using the existing `RadiProtocol` editor + Snippet system, modeled on the reference `ОГК 1.10.0.canvas` and the `.md` text templates plus the `SNIPPETS` folder structure stored in `Z:\projects\references\`. They are **not** bundled with the plugin distribution and **not** committed to this repository — the requirement is satisfied when each canvas is fully runnable end-to-end in a local Obsidian session and the author confirms it produces a structurally complete protocol report.

- [ ] **CANVAS-LIB-01**: An algorithmic canvas for the **ГМ** (головной мозг) area exists in the author's vault and runs end-to-end in the Protocol Runner using the existing graph node kinds (Question / Answer / Text block / Snippet / Loop). The output is a structurally complete ГМ report based on the corresponding `.md` text template from `Z:\projects\references\`.

- [ ] **CANVAS-LIB-02**: An algorithmic canvas for the **ОБП** (органы брюшной полости — full version) area exists and runs end-to-end with output matching the ОБП `.md` text template.

- [ ] **CANVAS-LIB-03**: An algorithmic canvas for the **ОЗП** (органы забрюшинного пространства) area exists and runs end-to-end with output matching the ОЗП `.md` text template.

- [ ] **CANVAS-LIB-04**: An algorithmic canvas for the **ОМТ** (органы малого таза — full version) area exists and runs end-to-end with output matching the ОМТ `.md` text template.

- [ ] **CANVAS-LIB-05**: An algorithmic canvas for the **ПКОП** (пояснично-крестцовый отдел позвоночника) area exists and runs end-to-end with output matching the ПКОП `.md` text template.

- [ ] **CANVAS-LIB-06**: A short-version algorithmic canvas for **ОГК** (органы грудной клетки) exists alongside the existing ОГК 1.10.0 reference canvas, runs end-to-end, and produces a shortened ОГК report matching the short-ОГК `.md` text template.

- [ ] **CANVAS-LIB-07**: A short-version algorithmic canvas for **ОБП** exists alongside the full ОБП canvas (CANVAS-LIB-02), runs end-to-end, and produces a shortened ОБП report matching the short-ОБП `.md` text template.

- [ ] **CANVAS-LIB-08**: A short-version algorithmic canvas for **ОМТ** exists alongside the full ОМТ canvas (CANVAS-LIB-04), runs end-to-end, and produces a shortened ОМТ report matching the short-ОМТ `.md` text template.

### Distribution

- [ ] **BRAT-03**: The repository ships a GitHub Release `1.11.0` following the BRAT-installable pattern established by Phases 55 (v1.8.0), 62 (v1.9.0), and 68 (v1.10.0): `manifest.json`, `versions.json`, and `package.json` aligned on `1.11.0` while preserving prior version mappings; clean `npm run build` produces production `main.js` + `styles.css`; an unprefixed annotated tag `1.11.0` pushed; release runbook executed (D10 UAT-gate-as-first-section pattern); GitHub Release published with `manifest.json` + `main.js` + `styles.css` as three loose root assets (no zip, prerelease=false); end-to-end BRAT install on a clean Obsidian vault via `vegacepticon/RadiProtocol` succeeds and the plugin enables at version `1.11.0`.

## Future Requirements (Deferred)

Items kept in the deferred list from the v1.10 close (PROJECT.md `Deferred (Future Milestones)`) that are explicitly NOT in scope for v1.11:

- Canvas selector dropdown in runner view
- Full-tab runner view
- Protocol authoring documentation / public canvas library (publishable form of v1.11 author's local canvases)
- Community plugin submission checklist
- Node templates — save frequently-used node structures for reuse
- Configurable output destination: insert into current note
- UI hint when global separator change requires canvas reopen to take effect
- Retroactive Nyquist VALIDATION.md for phases 12–19 (tech debt)
- Verification documentation backfill for v1.10 phases 64/66/67 (carry-over tech debt; see STATE.md)

## Out of Scope (v1.11)

Explicitly excluded for this milestone. Can be reconsidered later.

| Feature | Reason |
|---------|--------|
| New node kinds | v1.11 is content + polish + donate; no graph-model additions |
| Bundling reference canvases with the plugin | The eight canvases (CANVAS-LIB-01..08) are author-local only — public canvas library deferred (needs UX/distribution design) |
| Donation channels other than crypto | Author-stated scope: crypto wallets only for v1.11 — fiat / Patreon / Buy-Me-A-Coffee deferred |
| Donate UI internationalisation / multilingual | Russian-only label in the section header — i18n is out of scope project-wide |
| Visual-customisation tokens for the loop-exit highlight | LOOP-EXIT-01 uses existing Obsidian CSS variables; user-configurable accent colour is deferred |
| Mobile support | Out of scope since v1.0 |
| AI/LLM-generated text | Out of scope since v1.0 |
| Removing buttons from sidebar/tab Runner views | INLINE-CLEAN-01 is Inline-mode-only by design |

## Traceability

Phase mappings established by `gsd-roadmapper` 2026-04-29. Phase numbering continues from v1.10 (last phase = 68) — v1.11 starts at **Phase 69**.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INLINE-CLEAN-01 | Phase 69 | Open |
| LOOP-EXIT-01 | Phase 70 | Open |
| DONATE-01 | Phase 71 | Open |
| CANVAS-LIB-01 | Phase 72 | Open |
| CANVAS-LIB-02 | Phase 72 | Open |
| CANVAS-LIB-03 | Phase 72 | Open |
| CANVAS-LIB-04 | Phase 72 | Open |
| CANVAS-LIB-05 | Phase 72 | Open |
| CANVAS-LIB-06 | Phase 73 | Open |
| CANVAS-LIB-07 | Phase 73 | Open |
| CANVAS-LIB-08 | Phase 73 | Open |
| BRAT-03 | Phase 74 | Open |

**Coverage:**
- v1.11 requirements: 12 total
- Mapped to phases: 12 (Phases 69–74)
- Unmapped: 0

---
*Requirements defined: 2026-04-29 — traceability filled by gsd-roadmapper 2026-04-29.*
