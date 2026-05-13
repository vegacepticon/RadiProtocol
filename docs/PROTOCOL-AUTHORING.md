# Authoring a RadiProtocol protocol

This document describes the node and edge model RadiProtocol expects in a
`.rp.json` protocol file. The new `.rp.json` format is the primary authoring
format as of v1.16.0. Legacy `.canvas` (JSON Canvas) files continue to work
via the import/migration path described at the end of this document.
For installation and a quick-start, see the top-level
[README](../README.md). For development setup, see
[CONTRIBUTING](CONTRIBUTING.md).

> **Localisation note.** RadiProtocol's runtime UI ships with English and
> Russian locales. Author-facing tooling (this document, the node and edge
> editor copy, validator messages) is currently English-only; a Russian
> translation is future work.

## How a protocol is built

A RadiProtocol file is a JSON document (`.rp.json`) with a `schema` field of
`"radiprotocol.protocol"` and a `version` of `1`. Nodes carry a `kind`
property (`"start"`, `"question"`, `"answer"`, `"text-block"`, `"snippet"`,
`"loop"`) plus a `fields` record for kind-specific configuration. Plain text
nodes without a recognised kind are silently skipped — you can mix
documentation notes with protocol nodes in the same file.

The runner walks from the start node along outgoing edges. Some node kinds
auto-advance (the runner appends text and moves on); others halt and wait for
user input.

## Node kinds

### `start`

The entry point. Exactly one start node per protocol. Auto-advances along its
single outgoing edge. Has no other configuration.

### `question`

Halts the runner. The user is shown the question text and a button per
outgoing branch. Configuration in `fields`:

- `questionText` — the prompt shown in the runner.

A question's outgoing edges may target answer, snippet, text-block, loop, or
nested question nodes. Branch buttons are derived from the immediate neighbours.

### `answer`

A preset reply that, when picked, contributes its text to the accumulated
output. Configuration in `fields`:

- `answerText` — the literal text appended on selection.
- `displayLabel` *(optional)* — overrides the button caption shown at the
  question. The displayLabel is mirrored onto the incoming edge label for
  canvas-side readability.
- `separator` *(optional, `"space"` or `"newline"`)* — overrides the global
  text separator for the chunk this answer contributes.

### `text-block`

A static text fragment that auto-advances. Configuration in `fields`:

- `content` — the text to append.
- `separator` *(optional)* — same semantics as on answer.

A text-block can also reference a snippet by id via `snippetId`, in which case
the runner halts and opens the snippet fill-in flow before auto-advancing.

### `snippet`

Inserts a snippet's rendered text. Two binding modes are mutually exclusive:

- **Folder-bound** (`subfolderPath` set in `fields`) — the runner shows a
  picker rooted at that folder under your snippet root. The user chooses a
  file at runtime.
- **File-bound** (`snippetPath` set in `fields`, relative to the snippet
  root) — the runner inserts that specific snippet directly. If the file is
  missing the validator surfaces an error at load time.

Optional configuration shared across both modes in `fields`:

- `snippetLabel` — overrides the runner button caption.
- `snippetSeparator` *(`"space"` or `"newline"`)* — overrides the separator
  for the inserted text.

JSON snippets carry a template plus typed placeholders (free-text, choice,
multi-choice, number, date). When a snippet has placeholders the runner opens
a fill-in modal to gather values; otherwise the template is inserted verbatim.
MD snippets always insert their content verbatim.

### `loop`

A unified loop node — a single element that picks a body branch each iteration
and exits via a `+`-prefixed edge. Configuration in `fields`:

- `headerText` — the heading shown in the loop picker.

Behaviour, exit/body edges, and validation rules are described in the
"Loops" section below.

## Edge semantics

Edges connect protocol nodes and are walked one at a time during traversal.
An edge's `label` carries semantic meaning in two places:

- **Answer-incoming edges** are auto-labelled with the answer's display text,
  so the graph reads naturally even when you skim it without running the
  protocol.
- **Loop-outgoing edges** distinguish the exit branch from body branches via
  the `+` prefix (see below).

Outside of those two cases, an edge label is decorative — the runtime walks
the graph by adjacency, not by label.

## Loop construction with the unified loop node

A loop node has exactly one **exit edge** and one or more **body edges**:

- An **exit edge** is any outgoing edge whose label starts with a literal `+`.
  The text after the `+` becomes the caption of the exit button shown in the
  loop picker. Example: `+done`, `+exit`.
- A **body edge** is any outgoing edge without a `+` prefix. The label is
  surfaced as the body-branch button caption (or the target node's display
  text if the label is empty).

Each loop node must have exactly one exit edge. The validator rejects protocols
with zero or with multiple `+` edges, and emits a hint when a labelled
non-`+` edge is present (likely intended as the exit). Within the body, any
graph shape works — additional questions, answers, snippets, even nested loops.

When the runner re-enters a loop node along a back-edge (a body branch that
loops back to the loop node), it increments the iteration counter and shows
the picker again. The exit button pops the current loop frame and continues
the protocol along the exit edge.

## Snippet binding

Snippets live under your configured snippet root (default
`.radiprotocol/snippets`). The plugin's snippet manager exposes CRUD
operations for both JSON and MD snippets and keeps references in sync
when you rename or move snippets/folders.

When you bind a snippet node to a folder, the runner offers a tree picker
rooted at that folder. When you bind it to a file, the runner inserts that
file's content directly (a `📄` glyph distinguishes file-bound buttons from
the `📁` glyph used for folder-bound siblings).

For details on placeholder syntax inside JSON snippets, the snippet editor
modal in Obsidian is the practical reference — it validates the template as
you type.

## Legacy `.canvas` migration

Existing `.canvas` (JSON Canvas v1.0) files continue to work. To migrate:

1. Open the command palette and run **"Convert Canvas protocol to .rp.json"**.
2. Select the canvas file to convert.
3. A new `.rp.json` file is created alongside the original `.canvas` file.
4. Verify the converted protocol in the visual editor, then delete the
   `.canvas` file if everything looks correct.

The conversion preserves node kinds, fields, positions, colors, edge labels,
and IDs. The original `.canvas` file is never modified or deleted
automatically.
