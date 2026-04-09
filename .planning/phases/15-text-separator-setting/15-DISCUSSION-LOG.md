# Phase 15: Text Separator Setting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 15-text-separator-setting
**Areas discussed:** Separator application, Per-node override field, Snippet / free-text wrapping, Settings tab UI placement

---

## Separator Application

| Option | Description | Selected |
|--------|-------------|----------|
| Before each chunk except first | Buffer empty → no separator; subsequent appends: separator + text | ✓ |
| After each chunk including last | Trailing separator — usually undesirable | |
| Array join at read-time | Architecture change, more invasive | |

**User's choice:** Before each chunk, except first (buffer empty = no separator)
**Notes:** Per-node override takes priority; falls back to global setting.

---

## Per-Node Override Field

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit "Use global" option | Dropdown: "Use global" / "Newline" / "Space" — clear intent | ✓ |
| Absence = global (implicit) | Dropdown shows only "Newline" / "Space"; no selection = use global | |

**User's choice:** Explicit "Use global" option in dropdown
**Notes:** Applied only to answer, free-text-input, text-block nodes.

---

## Snippet / Free-Text Wrapping

| Option | Description | Selected |
|--------|-------------|----------|
| completeSnippet participates like text-block | separator before rendered snippet text | ✓ |
| completeSnippet bypasses separator | Always appends without separator | |

**User's choice:** completeSnippet participates in separator logic like any text-block

| Option | Description | Selected |
|--------|-------------|----------|
| Separator before entire "prefix+text+suffix" assembly | separator + prefix + text + suffix | ✓ |
| Separator between prefix and text | prefix + separator + text + suffix — non-standard | |

**User's choice:** Separator before the whole assembled chunk

---

## Settings Tab UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Output section (with outputDestination) | Groups all output-related settings | |
| Dedicated Runner section | Runner section: maxLoopIterations + textSeparator | ✓ |
| After maxLoopIterations, no section | Minimal change, no structural grouping | |

**User's choice:** Dedicated Runner section (Setting.setHeading())

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown (addDropdown) | Standard Obsidian Setting API, consistent | ✓ |
| Radio buttons via createEl | No built-in support, more code | |

**User's choice:** Dropdown (addDropdown) for both Settings tab and EditorPanel

---

## Claude's Discretion

- Property name for per-node canvas storage (`radiprotocol_separator`)
- Whether separator is injected via ProtocolRunnerOptions or resolved per-call by RunnerView

## Deferred Ideas

None.
