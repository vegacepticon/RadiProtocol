# Phase 25: Snippet Node Runner UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 25-snippet-node-runner-ui
**Areas discussed:** File Picker, Subfolders, Empty Folder, Cancel, Folder Not Configured, .json Dispatch

---

## File Picker — Display Format

| Option | Description | Selected |
|--------|-------------|----------|
| Filename only | Shows `findings.md`, `ct-liver.json` — clean, fast to scan | ✓ |
| Filename + relative path | Shows `findings.md (Templates/CT/)` — useful if duplicate names in subfolders | |

**User's choice:** Filename only
**Notes:** Medical file names are self-descriptive; clean list is preferred.

---

## File Picker — Subfolders

| Option | Description | Selected |
|--------|-------------|----------|
| Recursive (include subfolders) | All `.md`/`.json` files in folder and any subdirectory | ✓ |
| Top-level only | Only files directly in the configured folder | |

**User's choice:** Recursive
**Notes:** Allows organisation by category (CT/, MRI/, etc.)

---

## Empty Folder

| Option | Description | Selected |
|--------|-------------|----------|
| Notice + stay on node | `Notice("No files found in [folder]")` — modal not opened | ✓ |
| Open modal with empty list | FuzzySuggestModal opens but list is empty | |
| Inline message in runner | Text shown in runner zone instead of picker | |

**User's choice:** Notice + stay on node

---

## Cancel (Esc in picker)

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on node | Runner stays at snippet node; user can retry or step back | ✓ |
| Skip (advance without text) | Mirrors Phase 5 SnippetFillInModal cancel | |

**User's choice:** Stay on node
**Notes:** "Cancel = stay" policy is consistent across all Phase 25 dismiss paths.

---

## Folder Not Configured

| Option | Description | Selected |
|--------|-------------|----------|
| Notice: "Snippet folder not configured" (short) | Brief notice with Settings path hint | ✓ |
| Notice with detailed instruction | Longer notice text | |
| Inline message in runner | Shown in runner zone | |

**User's choice:** Notice: "Snippet folder not configured. Set a path in plugin Settings → Storage."

---

## .json Dispatch — Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Extension + structure check | Parse JSON, check `id`/`name`/`template` fields; invalid → Notice + stay | ✓ |
| Extension only | Any `.json` opens SnippetFillInModal | |
| Only files from .radiprotocol/snippets/ | Built-in snippets folder only | |

**User's choice:** Extension + structure validation
**Notes:** Lightweight check — `typeof id === 'string'` etc., not full schema validation.

---
