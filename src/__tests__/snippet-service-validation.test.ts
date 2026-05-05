// src/__tests__/snippet-service-validation.test.ts
// Phase 52 Plan 01 (D-03 RED) — SnippetService.load / listFolder must surface
// `validationError: string | null` on JsonSnippet when the .json declares a
// legacy placeholder type ('number' | 'multichoice' | 'multi-choice') or a
// 'choice' placeholder without a valid options array.
//
// Every test in this file is RED at Plan 01 commit time. Plan 02 wires
// `validatePlaceholders` into SnippetService.load + listFolder, flipping these
// to GREEN. Pre-existing snippet-service.test.ts / snippet-service-move.test.ts
// remain untouched and green.

import { describe, it, expect, vi } from 'vitest';
import { SnippetService } from '../snippets/snippet-service';

type MockAdapter = {
  exists: ReturnType<typeof vi.fn>;
  read: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
};

function makeMockApp(
  files: Record<string, string>,
  folderList: { files: string[]; folders: string[] },
): { app: unknown; adapter: MockAdapter } {
  const adapter: MockAdapter = {
    exists: vi.fn(async (p: string) => p in files || p === 'Protocols/Snippets'),
    read: vi.fn(async (p: string) => {
      if (!(p in files)) throw new Error(`ENOENT: ${p}`);
      return files[p]!;
    }),
    list: vi.fn(async () => folderList),
  };
  const app = { vault: { adapter } };
  return { app, adapter };
}

const settings = {
  snippetFolderPath: 'Protocols/Snippets',
  snippetTreeExpandedPaths: [] as string[],
  sessionFolderPath: '.radiprotocol/sessions',
  protocolFolderPath: '',
  textSeparator: 'newline' as const,
};

describe('SnippetService.load — Phase 52 D-03 validationError', () => {
  it('returns validationError: null for a valid choice placeholder with options', async () => {
    const path = 'Protocols/Snippets/ok.json';
    const raw = JSON.stringify({
      template: 'Side: {{s}}',
      placeholders: [{ id: 's', label: 'Side', type: 'choice', options: ['L', 'R'] }],
    });
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet).not.toBeNull();
    expect(snippet?.kind).toBe('json');
    if (snippet?.kind !== 'json') return;
    const validated = snippet as typeof snippet & { validationError: string | null };
    expect(validated.validationError).toBeNull();
  });

  it('returns validationError citing "number" for legacy number type', async () => {
    const path = 'Protocols/Snippets/legacy-num.json';
    const raw = JSON.stringify({
      template: 'Size: {{sz}}',
      placeholders: [{ id: 'sz', label: 'Size', type: 'number', unit: 'mm' }],
    });
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet?.kind).toBe('json');
    if (snippet?.kind !== 'json') return;
    const validated = snippet as typeof snippet & { validationError: string | null };
    expect(validated.validationError).not.toBeNull();
    // Phase 84 (I18N-02): SnippetService falls back to defaultT (English) when no translator is passed.
    expect(validated.validationError).toMatch(/removed type "number"/);
    expect(validated.validationError).toMatch(/Placeholder "sz"/);
  });

  it('returns validationError citing "multichoice" for legacy multichoice type', async () => {
    const path = 'Protocols/Snippets/legacy-mc.json';
    const raw = JSON.stringify({
      template: 'F: {{f}}',
      placeholders: [{ id: 'f', label: 'F', type: 'multichoice', options: ['a'] }],
    });
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    if (snippet?.kind !== 'json') return;
    const validated = snippet as typeof snippet & { validationError: string | null };
    expect(validated.validationError).toMatch(/removed type "multichoice"/);
  });

  it('returns validationError citing "multi-choice" for legacy hyphenated multi-choice type', async () => {
    const path = 'Protocols/Snippets/legacy-mc2.json';
    const raw = JSON.stringify({
      template: 'F: {{f}}',
      placeholders: [{ id: 'f', label: 'F', type: 'multi-choice', options: ['a'] }],
    });
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    if (snippet?.kind !== 'json') return;
    const validated = snippet as typeof snippet & { validationError: string | null };
    expect(validated.validationError).toMatch(/removed type "multi-choice"/);
  });

  it('returns validationError for choice placeholder with empty options array', async () => {
    const path = 'Protocols/Snippets/empty-choice.json';
    const raw = JSON.stringify({
      template: 'F: {{f}}',
      placeholders: [{ id: 'f', label: 'F', type: 'choice', options: [] }],
    });
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    if (snippet?.kind !== 'json') return;
    const validated = snippet as typeof snippet & { validationError: string | null };
    expect(validated.validationError).toMatch(/has no options/);
    expect(validated.validationError).toMatch(/Placeholder "f"/);
  });

  it('returns null for syntax-broken JSON (preserves silent-skip)', async () => {
    const path = 'Protocols/Snippets/broken.json';
    const { app } = makeMockApp({ [path]: '{not json' }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet).toBeNull();
  });

  it('returns MdSnippet unaffected (no validationError field on md)', async () => {
    const path = 'Protocols/Snippets/note.md';
    const { app } = makeMockApp({ [path]: '# hi' }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet?.kind).toBe('md');
  });
});

describe('SnippetService.listFolder — Phase 52 D-03 validationError', () => {
  it('returns a mix of valid + broken snippets with validationError populated per entry', async () => {
    const root = 'Protocols/Snippets';
    const okPath = `${root}/ok.json`;
    const badPath = `${root}/legacy.json`;
    const okRaw = JSON.stringify({
      template: 'Side: {{s}}',
      placeholders: [{ id: 's', label: 'Side', type: 'choice', options: ['L', 'R'] }],
    });
    const badRaw = JSON.stringify({
      template: 'Sz: {{sz}}',
      placeholders: [{ id: 'sz', label: 'Sz', type: 'number' }],
    });
    const { app } = makeMockApp(
      { [okPath]: okRaw, [badPath]: badRaw },
      { files: [okPath, badPath], folders: [] },
    );
    const svc = new SnippetService(app as never, settings as never);
    const { snippets } = await svc.listFolder(root);
    const ok = snippets.find((s) => s.name === 'ok');
    const bad = snippets.find((s) => s.name === 'legacy');
    expect(ok?.kind).toBe('json');
    expect(bad?.kind).toBe('json');
    if (ok?.kind === 'json') {
      const okValidated = ok as typeof ok & { validationError: string | null };
      expect(okValidated.validationError).toBeNull();
    }
    if (bad?.kind === 'json') {
      const badValidated = bad as typeof bad & { validationError: string | null };
      expect(badValidated.validationError).toMatch(/removed type "number"/);
    }
  });

  it('silently skips syntax-broken .json (not in returned snippets)', async () => {
    const root = 'Protocols/Snippets';
    const brokenPath = `${root}/corrupt.json`;
    const { app } = makeMockApp(
      { [brokenPath]: '{not json' },
      { files: [brokenPath], folders: [] },
    );
    const svc = new SnippetService(app as never, settings as never);
    const { snippets } = await svc.listFolder(root);
    expect(snippets.find((s) => s.name === 'corrupt')).toBeUndefined();
  });
});
