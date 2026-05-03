# RadiProtocol

RadiProtocol is an [Obsidian](https://obsidian.md) plugin that turns interactive
canvas diagrams into guided, step-by-step protocols. It was built for radiologists
who dictate structured reports, but the same workflow fits any field where a
practitioner needs to walk through a branching script and produce consistent text
output — clinical examinations, intake interviews, code-review checklists, training
drills.

You author the protocol once as a JSON Canvas with question, answer, text, snippet,
and loop nodes. RadiProtocol's Runner then drives you through the canvas one node
at a time, accumulating text as you go, with full step-back support and dynamic
snippet templates.

## Features

- **Canvas-based protocol authoring.** Build flows as JSON Canvas files. Question,
  answer, text-block, snippet, loop, and start nodes are recognised by their
  `radiprotocol_*` properties. Validation runs at canvas-open time.
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
- **Inline, sidebar, and tab runner modes.** Run a protocol in the right sidebar
  (default), as a workspace tab, or as a draggable inline modal anchored to a
  target note.

<!-- screenshot: runner-sidebar.png — Runner view in the right sidebar with a question and step-back button -->
<!-- screenshot: canvas-authoring.png — A protocol canvas with question/answer/loop nodes -->
<!-- screenshot: snippet-fill-modal.png — Dynamic snippet placeholder fill-in modal -->

## Installation

### BRAT (recommended)

1. Install the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings → "Add Beta plugin", paste the GitHub URL of this repository.
3. Enable "RadiProtocol" in Obsidian's Community plugins list.

### Manual

1. Download `main.js` and `manifest.json` from the latest GitHub release.
2. Copy both files into `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Reload Obsidian and enable "RadiProtocol" in Community plugins.

## Quick start

1. Create a new canvas file in your vault (`File → New canvas`).
2. Drop in a few text nodes and use the RadiProtocol "Open node editor" command
   to mark them as `start`, `question`, and `answer` nodes (or use the node-picker
   command to insert a typed node directly).
3. Connect the nodes with edges. The `start` node has no incoming edges; each
   `question` should have at least one outgoing edge to an `answer`.
4. Run the protocol via the ribbon icon (activity dial) or the "Run protocol"
   command. Pick the canvas you just authored. The runner walks you through one
   node at a time and accumulates text in the preview pane.

For a deeper guide to the node and edge model, see
[`docs/PROTOCOL-AUTHORING.md`](docs/PROTOCOL-AUTHORING.md). For dev-environment
setup and contribution guidelines, see
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.
