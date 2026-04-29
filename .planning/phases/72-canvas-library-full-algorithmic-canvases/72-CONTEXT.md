# Phase 72: Canvas Library — Full Algorithmic Canvases - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Five hand-authored algorithmic `.canvas` files (ГМ, ОБП full, ОЗП, ОМТ full, ПКОП) exist in the author's local vault, each modeled on the reference `ОГК 1.10.0.canvas` and the corresponding `.md` text template from `Z:\projects\references\` plus the `SNIPPETS` folder structure there. Each canvas runs end-to-end in the Protocol Runner producing a structurally complete report matching its `.md` template. None of these canvases are bundled with the plugin distribution or committed to this repository.
</domain>

<decisions>
## Implementation Decisions

### Canvas structure approach
- **D-01:** Mixed structure as in ОГК 1.10.0 — linear for simple sections, loops for repeating elements
- **D-02:** Each canvas standalone: ГМ, ОБП, ОЗП, ОМТ, ПКОП — independent reports with own conclusions
- **D-03:** Optional "НА СКАНИРОВАННЫХ УРОВНЯХ" block at end of each canvas (like ОГК 1.10.0)
- **D-04:** Canvases do NOT reference each other — no cross-canvas snippet links at the end
- **D-05:** ПКОП standalone, does not reference other canvases

### Loop modeling conventions
- **D-06:** ГМ — loop for multiple focal lesions in brain parenchyma
- **D-07:** ОБП full — loop for liver + pancreas; other organs (spleen, kidneys, GI, lymph nodes, aorta) linear
- **D-08:** ОЗП — loops for kidneys + adrenal glands (for lesions/masses); other structures linear
- **D-09:** ОМТ — loops ✓ (multiple fibroids/cysts/etc.)
- **D-10:** ПКОП — loop ✓ (multiple vertebral levels L1-L2, L2-L3, etc.)
- **D-11:** Exit from loop — "+" prefix label ("+Все указано, продолжаем") per Phase 50.1 convention
- **D-12:** Hybrid modeling as in ОГК 1.10.0 — per-organ linear + nested discovery loop for complex organs

### Snippet strategy
- **D-13:** Snippet nodes inserted in canvas where appropriate (template placeholders)
- **D-14:** Paths to snippet folders will be configured manually by author later — no pre-created folder structure needed
- **D-15:** Do NOT create snippet folders in advance — author will specify paths according to own structure
- **D-16:** Format (.json with placeholder or .md verbatim) — author decides per snippet at creation time

### Canvas independence
- **D-17:** Each canvas produces complete standalone report with own conclusion and recommendations
- **D-18:** No references between canvases — no snippet nodes linking to other canvases
- **D-19:** Each canvas ends with its own Заключение + Рекомендации (auto-output fixed text)

### Verification standard
- **D-20:** Verification: canvas runs end-to-end without errors
- **D-21:** All sections from corresponding `.md` template are present in output
- **D-22:** Fixed blocks (Заключение, Рекомендации) output automatically at end of canvas
- **D-23:** "==напишу что не так==" branches are valid — for non-standard findings where no template fits
- **D-24:** Snippets with fill-in placeholders considered filled after user completes fill-in
- **D-25:** Author verification = visual comparison of output structure vs `.md` template (all sections present, no missing parts)

### agent's Discretion
- Exact node positions in canvas (x/y coordinates) — author arranges visually
- Specific answer text wording for each branch (author can adjust to match clinical language)
- Which specific snippets to insert at each "выберу шаблон" point (author decides at creation time)
- Loop iteration naming conventions (e.g., "очаг 1", "очаг 2" or clinical description)
</decisions>

<specifics>
## Specific Ideas

- ОГК 1.10.0.canvas is the reference template for structure and node modeling
- Z:\projects\references\ contains `.md` templates and SNIPPETS folder structure
- ГМ.md template exists and defines section structure: СРЕДИННЫЕ СТРУКТУРЫ, ВЕЩЕСТВО ГОЛОВНОГО МОЗГА, ЛИКВОРОСОДЕРЖАЩИЕ ПРОСТРАНСТВА, СЕЛЛЯРНАЯ ОБЛАСТЬ, ОКОЛОНОСОВЫЕ ПАЗУХИ, ОРБИТЫ, КОСТНЫЕ СТРУКТУРЫ, Заключение, Рекомендации
- ОБП.md, ОЗП.md, ОМТ.md, ПКОП.md templates exist in Z:\projects\references\ (Russian filenames, exact names to be confirmed by author)
- Loop exit uses "+" prefix convention per Phase 50.1 (e.g., "+Все указано, продолжаем")
- Snippet nodes in ОГК reference folder paths like "ОГК/ГРУДНАЯ КЛЕТКА", "ОГК/ЛЕГКИЕ" etc.
- Author will manually specify snippet paths according to personal folder structure

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reference canvas
- `Z:\projects\references\ОГК 1.10.0.canvas` — Reference template for canvas structure, node kinds, loop modeling, snippet usage

### Text templates
- `Z:\projects\references\ГМ.md` — ГМ (головной мозг) text template defining section structure and fixed text blocks
- `Z:\projects\references\ОБП.md` — ОБП full text template (full path to be confirmed)
- `Z:\projects\references\ОЗП.md` — ОЗП text template (full path to be confirmed)
- `Z:\projects\references\ОМТ.md` — ОМТ full text template (full path to be confirmed)
- `Z:\projects\references\ПКОП.md` — ПКОП text template (full path to be confirmed)
- `Z:\projects\references\КМ.md` — КМ template if applicable (confirm with author)

### Snippets structure
- `Z:\projects\references\SNIPPETS\` — Snippet folder structure showing organized templates by organ system
- Subfolders: ОГК/ГРУДНАЯ КЛЕТКА, ОГК/ЛЕГКИЕ, ОГК/СРЕДОСТЕНИЕ, ОГК/ПЛЕВРАЛЬНЫЕ ПОЛОСТИ, ОГК/КОСТИ, ШЕЯ, БП, ОЗП, ОМТ etc.

### Phase conventions
- Phase 50.1 — Loop exit "+" prefix convention
- Phase 43-46 — Unified loop node model, picker behavior, exit semantics

[If no external specs: "No external specs — requirements fully captured in decisions above"]

</canonical_refs>

<codebase_context>
## Existing Code Insights

### Reusable Assets
- ОГК 1.10.0.canvas — complete reference implementation showing all node kinds in use (start, question, answer, text-block, loop, snippet)
- Existing fixtures in `src/__tests__/fixtures/` show canvas JSON structure for all node kinds

### Established Patterns
- Loop node with headerText + body branches + "+" prefixed exit edge
- Snippet nodes with subfolderPath (folder picker) or snippetPath (specific file)
- Text-block nodes for section headers (e.g., "\nЛЕГКИЕ:", "\nСРЕДОСТЕНИЕ:")
- Answer nodes with displayLabel for picker UI, answerText for output text
- Nested loops as in ОГК (e.g., lung parenchyma loop nested within chest loop)

### Integration Points
- Each canvas verified by running in live Protocol Runner (manual author verification)
- Snippet paths reference `.radiprotocol/snippets/` folder in author's vault
- Canvas files stored in author's local vault, not in plugin repository

</codebase_context>

<deferred>
## Deferred Ideas

- Phase 73: Short algorithmic canvases (ОГК short, ОБП short, ОМТ short) — future phase
- Snippet folder structure creation — deferred to author's local workflow (not created in this phase)
- Canvas publication / community sharing — out of scope, deferred

</deferred>

---

*Phase: 72-canvas-library-full-algorithmic-canvases*
*Context gathered: 2026-04-29*