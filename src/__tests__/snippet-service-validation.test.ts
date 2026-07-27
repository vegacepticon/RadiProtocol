// src/__tests__/snippet-service-validation.test.ts
// Phase 52 Plan 01 (D-03) + Phase 2 (JSON-removal) — SnippetService.load /
// listFolder must surface `validationError: string | null` on MdTemplateSnippet
// when the frontmatter declares a 'choice' placeholder without a valid options
// array, or the template body references an undeclared placeholder.
//
// Phase 2 (JSON-removal): JSON-loaded validation cases are removed (legacy
// `.json` files are no longer loaded). Direct `md-template` placeholder
// validation is retained.

import { describe, it, expect, vi } from 'vitest';
import { SnippetService } from '../snippets/snippet-service';
import { serializeMarkdownTemplate } from '../snippets/md-template';
import type { SnippetPlaceholder } from '../snippets/snippet-model';

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
  protocolFolderPath: '',
  textSeparator: 'newline' as const,
};

function mdTemplateFile(
  name: string,
  body: string,
  placeholders: SnippetPlaceholder[],
): string {
  return serializeMarkdownTemplate({
    kind: 'md-template',
    path: '',
    name,
    template: body,
    placeholders,
    validationError: null,
  });
}

describe('SnippetService.load — md-template validationError', () => {
  it('returns validationError: null for a valid choice placeholder with options', async () => {
    const path = 'Protocols/Snippets/ok.md';
    const raw = mdTemplateFile('ok', 'Side: {{s}}', [
      { id: 's', label: 'Side', type: 'choice', options: ['L', 'R'] },
    ]);
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet).not.toBeNull();
    expect(snippet?.kind).toBe('md-template');
    if (snippet?.kind !== 'md-template') return;
    expect(snippet.validationError).toBeNull();
  });

  it('returns validationError for a choice placeholder with empty options', async () => {
    const path = 'Protocols/Snippets/empty-choice.md';
    const raw = mdTemplateFile('empty-choice', 'F: {{f}}', [
      { id: 'f', label: 'F', type: 'choice', options: [] },
    ]);
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet?.kind).toBe('md-template');
    if (snippet?.kind !== 'md-template') return;
    expect(snippet.validationError).not.toBeNull();
    expect(snippet.validationError).toMatch(/has no options/);
    expect(snippet.validationError).toMatch(/Placeholder "f"/);
  });

  it('returns validationError for an undeclared placeholder token in the body', async () => {
    const path = 'Protocols/Snippets/orphan.md';
    const raw = mdTemplateFile('orphan', 'Body {{undeclared}} text', [
      { id: 'declared', label: 'Declared', type: 'free-text' },
    ]);
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet?.kind).toBe('md-template');
    if (snippet?.kind !== 'md-template') return;
    expect(snippet.validationError).toMatch(/undeclared placeholder/);
  });

  it('returns validationError: null for a valid free-text-only template', async () => {
    const path = 'Protocols/Snippets/freetext.md';
    const raw = mdTemplateFile('freetext', 'Age: {{age}}', [
      { id: 'age', label: 'Age', type: 'free-text' },
    ]);
    const { app } = makeMockApp({ [path]: raw }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet?.kind).toBe('md-template');
    if (snippet?.kind !== 'md-template') return;
    expect(snippet.validationError).toBeNull();
  });

  it('returns MdSnippet unaffected (no validationError field on md)', async () => {
    const path = 'Protocols/Snippets/note.md';
    const { app } = makeMockApp({ [path]: '# hi' }, { files: [path], folders: [] });
    const svc = new SnippetService(app as never, settings as never);
    const snippet = await svc.load(path);
    expect(snippet?.kind).toBe('md');
  });
});

describe('SnippetService.listFolder — md-template validationError', () => {
  it('returns a mix of valid + broken md-template snippets with validationError per entry', async () => {
    const root = 'Protocols/Snippets';
    const okPath = `${root}/ok.md`;
    const badPath = `${root}/empty.md`;
    const okRaw = mdTemplateFile('ok', 'Side: {{s}}', [
      { id: 's', label: 'Side', type: 'choice', options: ['L', 'R'] },
    ]);
    const badRaw = mdTemplateFile('empty', 'F: {{f}}', [
      { id: 'f', label: 'F', type: 'choice', options: [] },
    ]);
    const { app } = makeMockApp(
      { [okPath]: okRaw, [badPath]: badRaw },
      { files: [okPath, badPath], folders: [] },
    );
    const svc = new SnippetService(app as never, settings as never);
    const { snippets } = await svc.listFolder(root);
    const ok = snippets.find((s) => s.name === 'ok');
    const bad = snippets.find((s) => s.name === 'empty');
    expect(ok?.kind).toBe('md-template');
    expect(bad?.kind).toBe('md-template');
    if (ok?.kind === 'md-template') {
      expect(ok.validationError).toBeNull();
    }
    if (bad?.kind === 'md-template') {
      expect(bad.validationError).toMatch(/has no options/);
    }
  });

  it('silently skips legacy .json files (not in returned snippets)', async () => {
    const root = 'Protocols/Snippets';
    const jsonPath = `${root}/legacy.json`;
    const { app } = makeMockApp(
      { [jsonPath]: JSON.stringify({ name: 'legacy', template: 't', placeholders: [] }) },
      { files: [jsonPath], folders: [] },
    );
    const svc = new SnippetService(app as never, settings as never);
    const { snippets } = await svc.listFolder(root);
    expect(snippets.find((s) => s.name === 'legacy')).toBeUndefined();
  });
});