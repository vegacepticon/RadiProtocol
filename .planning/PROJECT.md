# RadiProtocol

## What This Is

An Obsidian plugin that turns Canvas files into interactive protocol generators for medical imaging reports (CT, X-ray, MRI, Ultrasound). The user builds a question-and-answer algorithm visually on the Obsidian Canvas, then runs it through the plugin's protocol runner — which steps through questions, assembles the report text piece by piece, and outputs the finished protocol to a configurable destination.

## Core Value

A radiologist can generate a structured, accurate protocol in seconds by answering a guided algorithm — without writing a single line of code to build that algorithm.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Canvas Editor (algorithm authoring):**
- [ ] UI side panel to add/configure nodes (question, answer, loop start/end, text block) without touching raw JSON
- [ ] Customizable node templates — save frequently-used node structures and insert them via button
- [ ] Visual loop nodes — mark a region on Canvas as a loop; algorithm repeats until user exits

**Protocol Runner (protocol generation):**
- [ ] Open any `.canvas` file as a guided protocol session via plugin command
- [ ] Step-by-step Q&A interface: one question at a time, answer options clearly presented
- [ ] Answer types: preset text (button → appends to protocol), free text input, dynamic snippet (with placeholders)
- [ ] Live protocol preview always visible during session — user sees accumulating text in real time
- [ ] Step back — undo last answer and return to previous question
- [ ] Mid-session save/resume — save session state and continue later
- [ ] Start from a specific node — jump into the algorithm at any chosen point
- [ ] Protocol text always editable inline during the session

**Snippet Manager:**
- [ ] Dedicated "Snippets" tab in plugin UI — create, edit, preview, delete snippets
- [ ] Placeholder types: free-text input field and multi-select checkboxes (predefined options, one or many)
- [ ] File-based storage in vault (dedicated folder, e.g. JSON files) — survives plugin reinstall/crash
- [ ] Snippet preview shows rendered output with placeholder values filled in

**Output:**
- [ ] Configurable output destination in plugin settings: new note, clipboard, insert into current note (any combination)
- [ ] Output folder configurable when "new note" is selected

**Dev Workflow:**
- [ ] Hot-reload script — single command builds, copies files to vault plugin folder, and reloads the plugin automatically

### Out of Scope

- AI/LLM-generated text — manual algorithm authoring only; not in v1
- PACS/RIS direct integration — clipboard/note output is sufficient for v1
- Mobile support (Obsidian mobile) — desktop-first; mobile later
- Multi-user / shared vaults — single-user local vault only for v1
- Version history for snippets — file system handles backups

## Context

- Built as an Obsidian community plugin (TypeScript, Obsidian Plugin API)
- Target: public release on Obsidian Community Plugins
- Primary author: radiologist (CT focus), but designed for all imaging modalities
- Obsidian Canvas stores data as `.canvas` JSON — plugin reads and writes this format
- UI language: English only (i18n deferred)
- Key UX principle: authoring algorithms must feel like visual design, not programming — no raw expressions or syntax to learn

## Constraints

- **Tech Stack**: TypeScript + Obsidian Plugin API + esbuild (standard plugin toolchain)
- **Canvas Format**: Must stay compatible with Obsidian's native `.canvas` JSON format — cannot break existing canvas files
- **UX**: Non-technical users (radiologists) must be able to build algorithms without reading documentation
- **File Safety**: Snippets stored as plain files in vault — never silently deleted or overwritten by plugin updates

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Obsidian Canvas as algorithm storage | Leverages built-in visual editor; no custom graph renderer needed | — Pending |
| File-based snippet storage (not plugin data) | Survives plugin reinstalls, easy to back up | — Pending |
| English-only UI for v1 | Standard for Obsidian Community; i18n adds complexity | — Pending |
| Hot-reload dev script | Eliminates manual build+copy friction during development | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-05 after initialization*
