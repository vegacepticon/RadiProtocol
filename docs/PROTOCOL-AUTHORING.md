# Authoring a RadiProtocol canvas

This document describes the node and edge model RadiProtocol expects in a
canvas file. For installation and a quick-start, see the top-level
[README](../README.md). For development setup, see
[CONTRIBUTING](CONTRIBUTING.md).

> **Localisation note.** RadiProtocol's runtime UI ships with English and
> Russian locales. Author-facing tooling (this document, the node and edge
> editor copy, validator messages) is currently English-only; a Russian
> translation is future work.

## How a protocol is built

A RadiProtocol canvas is a [JSON Canvas v1.0](https://jsoncanvas.org/) file
where nodes carry extra `radiprotocol_*` properties to mark their kind. Plain
text nodes without these properties are silently skipped — you can mix
documentation notes with protocol nodes on the same canvas.

The runner walks from the start node along outgoing edges. Some node kinds
auto-advance (the runner appends text and moves on); others halt and wait for
user input.

## Node kinds

Every protocol node carries a `radiprotocol_nodeType` property identifying its
kind. The kinds are:

### `start`

The entry point. Exactly one start node per canvas. Auto-advances along its
single outgoing edge. Has no other configuration.

### `question`

Halts the runner. The user is shown the question text and a button per
outgoing branch. Configuration:

- `radiprotocol_questionText` — the prompt shown in the runner.

A question's outgoing edges may target answer, snippet, text-block, loop, or
nested question nodes. Branch buttons are derived from the immediate neighbours.

### `answer`

A preset reply that, when picked, contributes its text to the accumulated
output. Configuration:

- `radiprotocol_answerText` — the literal text appended on selection.
- `radiprotocol_displayLabel` *(optional)* — overrides the button caption
  shown at the question. The displayLabel is mirrored onto the incoming
  edge label for canvas-side readability.
- `radiprotocol_separator` *(optional, `space` or `newline`)* — overrides the
  global text separator for the chunk this answer contributes.

### `text-block`

A static text fragment that auto-advances. Configuration:

- `radiprotocol_content` — the text to append.
- `radiprotocol_separator` *(optional)* — same semantics as on answer.

A text-block can also reference a snippet by id (`radiprotocol_snippetId`),
in which case the runner halts and opens the snippet fill-in flow before
auto-advancing.

### `snippet`

Inserts a snippet's rendered text. Two binding modes are mutually exclusive:

- **Folder-bound** (`radiprotocol_subfolderPath` set) — the runner shows a
  picker rooted at that folder under your snippet root. The user chooses a
  file at runtime.
- **File-bound** (`radiprotocol_snippetPath` set, relative to the snippet
  root) — the runner inserts that specific snippet directly. If the file is
  missing the validator surfaces an error at canvas-open.

Optional configuration shared across both modes:

- `radiprotocol_snippetLabel` — overrides the runner button caption.
- `radiprotocol_snippetSeparator` *(`space` or `newline`)* — overrides the
  separator for the inserted text.

JSON snippets carry a template plus typed placeholders (free-text, choice,
multi-choice, number, date). When a snippet has placeholders the runner opens
a fill-in modal to gather values; otherwise the template is inserted verbatim.
MD snippets always insert their content verbatim.

### `loop`

A unified loop node — a single element that picks a body branch each iteration
and exits via a `+`-prefixed edge. Configuration:

- `radiprotocol_headerText` — the heading shown in the loop picker.

Behaviour, exit/body edges, and validation rules are described in the
"Loops" section below.

## Edge semantics

Edges connect protocol nodes and are walked one at a time during traversal.
An edge's `label` carries semantic meaning in two places:

- **Answer-incoming edges** are auto-labelled with the answer's display text by
  the canvas live editor, so the canvas reads naturally even when you skim it
  without running the protocol.
- **Loop-outgoing edges** distinguish the exit branch from body branches via
  the `+` prefix (see below).

Outside of those two cases, an edge label is decorative — the runtime walks the
graph by adjacency, not by label.

## Loop construction with the unified loop node

A loop node has exactly one **exit edge** and one or more **body edges**:

- An **exit edge** is any outgoing edge whose label starts with a literal `+`.
  The text after the `+` becomes the caption of the exit button shown in the
  loop picker. Example: `+done`, `+exit`.
- A **body edge** is any outgoing edge without a `+` prefix. The label is
  surfaced as the body-branch button caption (or the target node's display
  text if the label is empty).

Each loop node must have exactly one exit edge. The validator rejects canvases
with zero or with multiple `+` edges, and emits a hint when a labelled
non-`+` edge is present (likely intended as the exit). Within the body, any
canvas shape works — additional questions, answers, snippets, even nested loops.

When the runner re-enters a loop node along a back-edge (a body branch that
loops back to the loop node), it increments the iteration counter and shows
the picker again. The exit button pops the current loop frame and continues
the protocol along the exit edge.

## Snippet binding

Snippets live under your configured snippet root (default
`.radiprotocol/snippets`). The plugin's snippet manager exposes CRUD
operations for both JSON and MD snippets and keeps canvas references in sync
when you rename or move snippets/folders.

When you bind a snippet node to a folder, the runner offers a tree picker
rooted at that folder. When you bind it to a file, the runner inserts that
file's content directly (a `📄` glyph distinguishes file-bound buttons from
the `📁` glyph used for folder-bound siblings).

For details on placeholder syntax inside JSON snippets, the snippet editor
modal in Obsidian is the practical reference — it validates the template as
you type.
