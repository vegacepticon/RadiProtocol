# RadiProtocol

[Русская версия](README.ru.md)

RadiProtocol is an [Obsidian](https://obsidian.md) plugin for radiologists who want to run structured examination protocols inside their reporting vault. It turns a protocol into a guided clinical checklist: choose the relevant branch, insert prepared report text or snippets, repeat sections for multiple findings, and write the generated text into the active Markdown note.

Protocols are authored as **`.rp.json`** files in the built-in visual protocol editor.

## What RadiProtocol helps with

- **Standardized radiology reporting.** Encode local protocols, modality workflows, follow-up recommendations, or structured report templates as reusable decision trees.
- **Guided branching.** Question and answer nodes let the radiologist choose the clinically appropriate path without searching through long static templates.
- **Reusable report fragments.** Snippet nodes insert prepared text from a configurable snippet folder. Markdown templates can ask for placeholders such as free text or choice, filled during protocol execution.
- **Repeated findings.** Loop nodes support workflows such as multiple lesions, multiple nodules, repeated measurements, or several anatomical levels.
- **Inline note-anchored execution.** The runner opens as a draggable inline panel over the active Markdown note and appends the selected protocol output to that note.
- **Visual protocol authoring.** The protocol editor supports start, question, answer, snippet, and loop nodes connected as a graph. (Existing text-block nodes from older versions remain supported — see the compatibility note below.)

## Typical clinical workflow

1. Open or create the Markdown note for the examination report.
2. Run **Run protocol in inline** from the command palette.
3. Select a protocol from the configured protocol folder.
4. Answer each clinical question in the inline runner.
5. Fill snippet placeholders when prompted.
6. Review the generated text appended to the note and edit it as needed before final reporting.

RadiProtocol is a documentation aid. The radiologist remains responsible for clinical judgment, wording, and final report validation.

## Installation

### BRAT (recommended)

1. Install the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings, choose **Add Beta plugin** and paste the GitHub URL of this repository.
3. Enable **RadiProtocol** in Obsidian's Community plugins list.

### Manual installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest [GitHub release](https://github.com/vegacepticon/RadiProtocol/releases).
2. Copy those files into `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Reload Obsidian.
4. Enable **RadiProtocol** in Obsidian's Community plugins list.

## Setup

1. Open RadiProtocol settings.
2. Set **Protocol folder** to the vault-relative folder that contains `.rp.json` protocol files.
3. Set **Snippet folder** to the vault-relative folder that contains snippet Markdown files.
4. Choose the preferred text separator for accumulated report text: newline or space.
5. Select the interface language if needed.

### Community library

RadiProtocol does not ship with a registry endpoint. To use the Community library, open RadiProtocol settings and enter an explicitly configured **HTTPS** endpoint in **Advanced → Library registry URL**. An empty, invalid, or non-HTTPS value leaves the catalog unavailable instead of falling back to another service.

1. Run **Open community library** from the command palette.
2. Browse, search, or filter the catalog, then open a package to review its protocol title and snippet paths with their SHA-256 hashes.
3. Choose **Install**. RadiProtocol downloads the full release again, verifies its hashes and protocol graph, and commits snippets, protocol, then the Installed marker.
4. Wait for the progress dialog to report success. The package appears under **Installed**, and its protocol becomes available in the normal protocol pickers once Obsidian indexes the new file.
5. If the dialog reports that indexing is still pending, the package is already committed; do not reinstall it. It may appear in the picker shortly. You can refresh the Community library view to confirm the Installed record.

Installed package files live under a managed `library/<package>/<version>/` namespace inside the configured protocol and snippet folders. They are read-only in RadiProtocol; use **Uninstall** from the Installed section to remove only package-owned files.

> **Trust boundary.** SHA-256 verifies that downloaded contents match the release manifest. It does **not** authenticate the publisher or prove who created the package.

## Creating a protocol

1. Run **Open protocol editor**.
2. Create or open a `.rp.json` protocol file in the configured protocol folder.
3. Add a **Start** node.
4. Add clinical **Question** nodes and connect them to **Answer** nodes or other protocol nodes.
5. Chain **Answer** nodes for fixed pass-through report text (`Question → Answer1 → Answer2`): select Answer1 to append it, and downstream Answer2 is appended automatically without another click.
6. Use **Snippet** nodes to insert reusable report fragments from a file or folder.
7. Use **Loop** nodes when the same reporting section may need to be repeated.
8. Save the protocol and test it with **Run protocol in inline** on a Markdown note.

> **Text block compatibility.** New protocols no longer offer a **Text block** node type in the creation menu — chain **Answer** nodes instead. Existing protocols that contain `text-block` nodes (including snippet-backed ones) continue to load, run, edit, and appear in **Start from specific node**; you do not need to migrate them.

## Snippets

RadiProtocol supports two Markdown snippet formats, both stored as `.md` files in the snippet folder:

- **Plain Markdown snippets**: the file contents are inserted as written, with no placeholder substitution.
- **Markdown templates**: a `.md` file with a YAML-like frontmatter block that declares placeholders. Supported placeholder types are **free text** and **choice** (with optional predefined options). Placeholders are filled during protocol execution and substituted into the template body via `{{id}}` tokens.

A snippet node can point to a specific snippet file or to a directory. When it points to a directory, the inline runner lets the user choose one snippet from that directory during execution.

> **Legacy JSON snippets.** Older versions stored snippets as `.json` files. These legacy files are **not converted or deleted** — they are left untouched on disk but are no longer listed, searchable, or insertable. To keep using their content, recreate them as frontmatter-backed Markdown templates and update the protocol's snippet references.

## For contributors

Repository hooks live in `.githooks/` and are optional for each local clone. To enable them, run:

`git config core.hooksPath .githooks`

The pre-commit hook runs staged TypeScript/CSS lint plus affected Vitest tests. The pre-push hook runs `npm run check`. Bypass hooks only when you have a clear reason and run the equivalent checks manually before opening a pull request.

For releases, use `npm version X.Y.Z` so `manifest.json` and `versions.json` are updated by the version lifecycle. Git tags are numeric because `.npmrc` sets an empty tag prefix. Release assets are `main.js`, `styles.css`, and `manifest.json` from the latest GitHub release.

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.