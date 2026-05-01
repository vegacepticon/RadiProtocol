import { describe, it, expect } from 'vitest';
import { ProtocolRunner } from '../runner/protocol-runner';
import { CanvasParser } from '../graph/canvas-parser';
import type { MdSnippet } from '../snippets/snippet-model';
import * as fs from 'node:fs';
import * as path from 'node:path';

const fixturesDir = path.join(__dirname, 'fixtures');
function _loadGraph(name: string) {
  const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const parser = new CanvasParser();
  const result = parser.parse(json, name);
  if (!result.success) throw new Error(`Fixture ${name} failed to parse: ${result.error}`);
  return result.graph;
}

// Phase 36: removed 3 RED stubs from Phase 26 — features never implemented

// ── Phase 35 — MD snippets in Runner picker (Wave 0 RED stubs) ──────────────
//
// These tests are RED until Plan 02 lifts the `kind !== 'json'` filter in
// renderSnippetPicker and widens handleSnippetPickerSelection to accept the
// Snippet union (JsonSnippet | MdSnippet). Each test pairs a runner-level
// behavior assertion with a source-level marker check against runner-view.ts,
// so every test covers its own slice of the Plan 02 contract.
//
// Source-level checks exist because the view layer (RunnerView) is not mounted
// in this suite — we assert on the source file directly to verify the filter
// was removed and the MD branch was added, symmetric to how Phase 30 picker
// code is already shaped.

describe('Phase 35 — MD snippets in Runner picker', () => {
  const runnerViewSource = fs.readFileSync(
    path.join(__dirname, '..', 'views', 'runner-view.ts'),
    'utf-8',
  );

  function makeMdSnippet(name: string, content: string, folder = ''): MdSnippet {
    return {
      kind: 'md',
      name,
      path: folder
        ? `.radiprotocol/snippets/${folder}/${name}.md`
        : `.radiprotocol/snippets/${name}.md`,
      content,
    };
  }

  // Helper: load a fixture graph (mirror of top-level loadGraph, local scope)
  function loadSnippetGraph(name: string) {
    const json = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
    const parser = new CanvasParser();
    const result = parser.parse(json, name);
    if (!result.success) throw new Error(`Fixture ${name} failed: ${result.error}`);
    return result.graph;
  }

  // Drive runner to 'awaiting-snippet-pick' at the snippet node (matches pattern
  // from runner/protocol-runner.test.ts:605-610).
  function startAtSnippet(fixture: string): ProtocolRunner {
    const runner = new ProtocolRunner();
    runner.start(loadSnippetGraph(fixture));
    runner.chooseAnswer('n-a1');
    return runner;
  }

  it('MD-01: md picker row — renderSnippetPicker lists MD entries with 📝 prefix (RED until Plan 02)', () => {
    // Plan 02 must remove `if (snippet.kind !== 'json') continue;` and render
    // MD rows with a 📝 prefix alongside 📄 for JSON (D-01).
    expect(runnerViewSource).not.toMatch(/if\s*\(\s*snippet\.kind\s*!==\s*['"]json['"]\s*\)\s*continue/);
    expect(runnerViewSource).toContain('📝');
    expect(runnerViewSource).toContain('📄');
  });

  it('MD-02: md click completes — handler inserts MdSnippet.content verbatim without modal (RED until Plan 02)', () => {
    // Source contract: handleSnippetPickerSelection must branch on kind === 'md'
    // and call completeSnippet(snippet.content) directly — no SnippetFillInModal.
    expect(runnerViewSource).toMatch(/snippet\.kind\s*===\s*['"]md['"]/);
    expect(runnerViewSource).toMatch(/completeSnippet\s*\(\s*snippet\.content\s*\)/);

    // Runtime behavior: the runner's pickSnippet → completeSnippet(content) path
    // must insert the MD body byte-for-byte into accumulatedText (D-02 verbatim).
    const mdContent = '# Protocol note\n\nFirst paragraph line.\nSecond paragraph line.\n';
    const md = makeMdSnippet('plain', mdContent);
    const runner = startAtSnippet('snippet-node-with-exit.canvas');
    runner.pickSnippet(md.path);
    runner.completeSnippet(md.content);
    const state = runner.getState();
    // Snippet node has an outgoing text-block neighbour → runner transitions to complete.
    if (state.status === 'complete') {
      expect(state.finalText).toContain(mdContent);
    } else if (state.status === 'at-node') {
      expect(state.accumulatedText).toContain(mdContent);
    } else {
      throw new Error(`Unexpected runner status after MD completeSnippet: ${state.status}`);
    }
  });

  it('MD-03: md drill-down — picker surfaces MD files inside subfolders (RED until Plan 02)', () => {
    // Source contract: Plan 02 must remove the JSON-only filter, so MD rows
    // appear at every depth of the drill-down (renderSnippetPicker recursively
    // consumes snippetPickerPath). Absence of the filter is the proxy signal.
    expect(runnerViewSource).not.toMatch(/snippet\.kind\s*!==\s*['"]json['"]/);

    // Runtime proxy: an MdSnippet living under a subfolder is a valid pick —
    // runner happily accepts its path and content through the public contract.
    const nested = makeMdSnippet('nested', 'Nested MD marker: rp-phase-35-nested\n', 'subfolder');
    expect(nested.path).toContain('subfolder/');
    const runner = startAtSnippet('snippet-node-with-exit.canvas');
    runner.pickSnippet(nested.path);
    runner.completeSnippet(nested.content);
    const state = runner.getState();
    if (state.status === 'complete') {
      expect(state.finalText).toContain('rp-phase-35-nested');
    } else if (state.status === 'at-node') {
      expect(state.accumulatedText).toContain('rp-phase-35-nested');
    } else {
      throw new Error(`Unexpected status: ${state.status}`);
    }
  });

  it('MD-04: mixed branch md — branch-entered picker accepts MD snippet and advances (RED until Plan 02)', () => {
    // Source contract: MD branch must live inside handleSnippetPickerSelection,
    // so Phase 31 mixed-branch flow routes MD picks through the same state
    // machine as JSON.
    expect(runnerViewSource).toMatch(/snippet\.kind\s*===\s*['"]md['"]/);

    // Runtime: snippet-node-with-exit.canvas enters the picker after answer;
    // completeSnippet(mdContent) must advance the runner past the snippet node.
    const md = makeMdSnippet('branch', 'branch-md-body');
    const runner = startAtSnippet('snippet-node-with-exit.canvas');
    runner.pickSnippet(md.path);
    runner.completeSnippet(md.content);
    const after = runner.getState();
    expect(after.status).not.toBe('awaiting-snippet-pick');
    expect(after.status).not.toBe('awaiting-snippet-fill');
    if (after.status === 'complete') {
      expect(after.finalText).toContain('branch-md-body');
    }
  });

  it('D-06: step-back md — stepBack after MD insert reverts accumulatedText and reopens picker (RED until Plan 02)', () => {
    // Source contract: MD branch must use the existing pickSnippet undo-snapshot
    // path. Presence of the 'md' branch in the handler is the proxy.
    expect(runnerViewSource).toMatch(/snippet\.kind\s*===\s*['"]md['"]/);

    // Runtime: pickSnippet snapshots accumulatedText BEFORE the mutation. A
    // stepBack from the open snippet picker must return to awaiting-snippet-pick
    // with the pre-pick accumulator value — identical to JSON behavior.
    const runner = startAtSnippet('snippet-node-with-exit.canvas');
    const prePickState = runner.getState();
    if (prePickState.status !== 'awaiting-snippet-pick') {
      throw new Error(`expected awaiting-snippet-pick, got ${prePickState.status}`);
    }
    const prePickText = prePickState.accumulatedText;

    runner.pickSnippet('.radiprotocol/snippets/plain.md');
    // Undo BEFORE completing the snippet — exactly mirrors Phase 30 D-06 flow.
    runner.stepBack();
    const back = runner.getState();
    // Phase 66 D-05: pickSnippet pushes restoreStatus: 'awaiting-snippet-pick'
    expect(back.status).toBe('awaiting-snippet-pick');
    if (back.status === 'awaiting-snippet-pick') {
      expect(back.accumulatedText).toBe(prePickText);
    }
  });

  it('D-03: empty md — empty `.md` content is a valid pick that advances the runner (RED until Plan 02)', () => {
    // Source contract: MD branch must exist so the handler routes empty content
    // through completeSnippet('') without guarding on length.
    expect(runnerViewSource).toMatch(/completeSnippet\s*\(\s*snippet\.content\s*\)/);

    // Runtime: pickSnippet → completeSnippet('') mirrors the JSON zero-template
    // path and must not transition to error.
    const runner = startAtSnippet('snippet-node-with-exit.canvas');
    runner.pickSnippet('.radiprotocol/snippets/empty.md');
    runner.completeSnippet('');
    const state = runner.getState();
    expect(state.status).not.toBe('error');
    expect(state.status).not.toBe('awaiting-snippet-fill');
  });

  it('SC-05: session md resume — MD content round-trips through accumulatedText snapshot (RED until Plan 02)', () => {
    // Source contract: MD branch must exist so session autosave catches the
    // inserted MD content through the existing accumulatedText serialization.
    expect(runnerViewSource).toMatch(/snippet\.kind\s*===\s*['"]md['"]/);

    // Runtime: after MD completeSnippet, the getState() snapshot already
    // contains the MD content (session persistence uses this state verbatim).
    const mdBody = 'session-md-marker\nsecond line\n';
    const runner = startAtSnippet('snippet-node-with-exit.canvas');
    runner.pickSnippet('.radiprotocol/snippets/resume.md');
    runner.completeSnippet(mdBody);
    const snapshot = JSON.parse(JSON.stringify(runner.getState())) as Record<string, unknown>;
    // Session restore reads either accumulatedText (at-node) or finalText (complete).
    const serialized = (snapshot.accumulatedText ?? snapshot.finalText ?? '') as string;
    expect(serialized).toContain('session-md-marker');
    expect(serialized).toContain('second line');
  });
});
