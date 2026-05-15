# Runner/editor UX and snippet workflow implementation plan

> Confirmed by Roman on 2026-05-15. Execute incrementally; do not ship as one large unverified diff.

## Confirmed product decisions

- `Insert snippet` command inserts at the current cursor position; fallback is append to active Markdown note if editor insertion is unavailable.
- Snippet editor copy button means **duplicate snippet file**, not copy content to clipboard.
- `Available as start point` checkbox is shown for all typed node kinds, including `start`.
- Self-check checklist uses separate dynamic text fields and persists as `items: string[]` in `.rp.json`.
- Minimap visibility is a global plugin setting, not per-protocol document state.

## Pipeline

1. Beta A: current UX/bug fixes without the larger new command/schema features.
   - Snippet/answer incoming edge label sync in `.rp.json` editor.
   - Hide noisy edge labels; only answer/snippet targets and loop→loop exit edges display labels.
   - Compact custom fields in snippet fill modal.
   - Larger auto-growing preview in snippet fill modal.
   - Inline runner header progress bar instead of protocol filename.
2. Beta B: start-from-node opt-in and insert snippet command.
3. Beta C: self-check checklist and complete auto-close behavior.
4. Beta D: duplicate snippet button and minimap toggle.

## Verification per beta

- Inspect `git diff --stat` and key diffs.
- Run targeted Vitest suites for changed files.
- Run `npm run build`.
- Run `npm run lint`.
- Run `npm test` before release.
- Run `git diff --check`.
- For BRAT beta release: bump via `npm version`, push main/tag, verify GitHub Release assets (`main.js`, `manifest.json`, `styles.css`).

## Beta A acceptance criteria

- Creating an edge to a snippet node after `snippetLabel` is already set shows that label.
- Editing `snippetLabel` after an edge exists refreshes incoming edge labels if they are empty or still auto-generated.
- Editing an edge label targeting a snippet updates the snippet node's `snippetLabel` and therefore runner button label.
- Manual edge labels are not overwritten by later answer/snippet label edits.
- Edges to/from loop/text nodes are not visually labeled unless the target is answer/snippet or the edge is a loop→loop exit edge.
- Snippet fill custom inputs are collapsed by default and revealed by a compact icon/button.
- Snippet fill preview is larger and auto-grows as rendered text expands.
- Inline runner header no longer displays the protocol filename and shows a responsive progress bar.
