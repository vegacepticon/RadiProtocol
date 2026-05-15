# RadiProtocol

RadiProtocol is an [Obsidian](https://obsidian.md) plugin that provides a
guided, step-by-step protocol runner for radiologists and anyone who needs
structured branching workflows.

Protocols are authored as **`.rp.json`** files — a first-party JSON format
with a custom visual graph editor. Legacy `.canvas` (JSON Canvas) support is
preserved for backward compatibility and migration.

**Latest release:** 1.17.0 (2026-05-15) — UX Hardening & Inline Runner release after Beta A–D chain (edge labels, snippet ops, self-check checklist, minimap toggle)

## Features

- **`.rp.json` protocol authoring.** Build flows as `.rp.json` protocol files
  with question, answer, text-block, snippet, loop, and start nodes.
  The built-in visual editor renders an interactive graph.
- **Legacy `.canvas` support.** Existing JSON Canvas files continue to work.
  Use the migration command to convert `.canvas` → `.rp.json`.
- **Interactive runner with step-back.** Halt at every question, pick a branch,
  and step back at any point — the runner restores both the cursor and the
  accumulated text from a snapshot stack.
- **Dynamic snippets with placeholders.** JSON snippets carry typed placeholders
  (free-text, choice, multi-choice, number, date) that prompt the user via a
  fill-in modal. MD snippets insert verbatim. Snippets live under a configurable
  vault folder and can be bound to a node by file or by directory.
- **Loops for multi-lesion / multi-iteration workflows.** A unified loop node uses
  a `+`-prefixed exit edge and one or more body edges. Iterations accumulate text
  cleanly across passes; nested loops are supported.
- **Inline, note-anchored runner.** Run a protocol as a draggable inline panel
  against the active Markdown note. Multiple inline runners can be open at once;
  the plugin reuses an existing runner for the same protocol/note pair.

<!-- screenshot: inline-runner.png — Draggable inline runner over a Markdown note with a question and step-back button -->
<!-- screenshot: canvas-authoring.png — A protocol canvas with question/answer/loop nodes -->
<!-- screenshot: snippet-fill-modal.png — Dynamic snippet placeholder fill-in modal -->

## Installation

### BRAT (recommended)

1. Install the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings → "Add Beta plugin", paste the GitHub URL of this repository.
3. Enable "RadiProtocol" in Obsidian's Community plugins list.

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest GitHub release.
2. Copy those files into `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Reload Obsidian and enable "RadiProtocol" in Community plugins.

## Quick start

1. Create a new protocol file with the "Create new RadiProtocol protocol"
   command. New protocols use the `.rp.json` format.
2. Open the protocol in the RadiProtocol visual editor and add `start`,
   `question`, `answer`, `text-block`, `snippet`, or `loop` nodes.
3. Connect the nodes with edges. The `start` node has no incoming edges; each
   `question` should have at least one outgoing edge to an `answer` or another
   protocol node.
4. Open or create the Markdown note that should receive the generated protocol text.
5. Run the protocol via the "Run protocol in inline" command. Pick the protocol
   you just authored. The inline runner walks you through one node at a time and
   appends accumulated output to the active note.

Existing `.canvas` files are still supported. Convert them with the
"Convert Canvas protocol to .rp.json" command when you are ready to migrate.

For a deeper guide to the node and edge model, see
[`docs/PROTOCOL-AUTHORING.md`](docs/PROTOCOL-AUTHORING.md). For dev-environment
setup and contribution guidelines, see
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md). The inline-only runner decision is
recorded in [`docs/adr/0001-inline-runner-only.md`](docs/adr/0001-inline-runner-only.md).

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.
