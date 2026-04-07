# Phase 9: Canvas Selector Dropdown - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 09-canvas-selector-dropdown
**Areas discussed:** Canvas list scope, Mid-session switch, Dropdown refresh, Idle-state UX, Display/navigation

---

## Canvas List Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All .canvas in vault | Show every .canvas file regardless of content. Simple — app.vault.getFiles() filtered by .canvas. | |
| Only RadiProtocol files | Pre-validate each file on view open. Clean list but expensive. | |
| Only from configured folder | Separate "Protocol canvas folder" setting. Separate from outputFolder. | ✓ |

**User's choice:** Отдельная настройка "Protocol canvas folder". Если папка не задана — пустой список + подсказка "Настройте папку в Settings".

**Follow-up — empty folder behaviour:**

| Option | Description | Selected |
|--------|-------------|----------|
| All .canvas in vault (fallback) | Show everything when no folder set. | |
| Empty list + hint | Show empty dropdown and direct user to Settings. | ✓ |

---

## Mid-Session Switch

| Option | Description | Selected |
|--------|-------------|----------|
| Ask confirmation | Modal: "Session will be reset. Continue?" Yes/No. | ✓ (for at-node/awaiting) |
| Silent reset | Immediately clear state and switch. | |
| Auto-save + switch | Save silently then switch without asking. | |

**User's choice:** Подтверждение модалом при active-сессии. При complete-состоянии — переключить без вопроса.

**Follow-up — complete state:**

| Option | Description | Selected |
|--------|-------------|----------|
| Switch without confirmation | Session finished — nothing to lose. | ✓ |
| Always ask | Uniform UX regardless of state. | |

---

## Dropdown Refresh

| Option | Description | Selected |
|--------|-------------|----------|
| Reactive (vault events) | registerEvent for create/delete/rename. List always current. | ✓ |
| Static snapshot at onOpen | Populate once. Stale if files change while view is open. | |

**User's choice:** Реактивно через vault-события.

---

## Idle-State UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown as sole CTA | Remove old "Open a canvas file to start" text. Show only "Select a protocol above" in contentEl. | ✓ |
| Keep old text | Retain h2 + p command palette hint alongside dropdown. | |

**Follow-up — idle contentEl text:**

| Option | Description | Selected |
|--------|-------------|----------|
| Simple hint | "Select a protocol above" — one line. | ✓ |
| Empty contentEl | Nothing shown in idle. | |

---

## Display / Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Drill-down: folders + files | Custom div-dropdown. Folder icon + ►. Click folder → drill in. ← Back row. | ✓ |
| Flat list with paths | Native <select> with relative paths like "CT/CT Chest". | |

**User's choice:** Drill-down навигация. Пользователь хочет организовывать протоколы по модальностям и зонам исследования в подпапках.

**Follow-up — trigger button label:**

| Option | Description | Selected |
|--------|-------------|----------|
| Basename only | "CT Chest" — short and clean. | ✓ |
| Relative path | "CT/CT Chest" — shows context but longer. | |

---

## Claude's Discretion

- CSS class names for drill-down popover
- Outside-click close mechanism (document listener vs overlay)
- Lucide icon names for folder and file rows
- Exact setting label/description text
- Handling non-existent `protocolFolderPath` folder (same as empty — empty list + hint)

## Deferred Ideas

None — discussion stayed within phase scope.
