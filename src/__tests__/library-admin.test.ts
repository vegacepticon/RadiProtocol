import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LibraryAdminService } from '../snippets/library-admin';

function makeTempRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-library-admin-'));
  fs.mkdirSync(path.join(repo, 'snippets'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'protocols'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'index.json'), JSON.stringify({ version: '1.0.0', snippets: [] }, null, 2) + '\n');
  fs.writeFileSync(path.join(repo, 'protocols-index.json'), JSON.stringify({ version: '1.0.0', protocols: [] }, null, 2) + '\n');
  return repo;
}

describe('LibraryAdminService', () => {
  let repo: string;
  let service: LibraryAdminService;
  const t = (key: string, params?: Record<string, string | number>) => `${key}${params ? JSON.stringify(params) : ''}`;

  beforeEach(() => {
    repo = makeTempRepo();
    service = new LibraryAdminService(repo, t);
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('validates a local library repo path', async () => {
    const result = await service.validateRepoPath();
    expect(result).toEqual({ valid: true });
  });

  it('imports a vault snippet into snippets/category/name.json and regenerates indexes', async () => {
    await service.importSnippetFromVault(
      JSON.stringify({ name: 'Atelectasis', template: 'Atelectasis {{side}}', placeholders: [] }),
      'Chest CT',
      'Atelectasis',
      undefined,
      'Chest CT / Atelectasis',
    );

    const snippetPath = path.join(repo, 'snippets', 'chest-ct', 'atelectasis.json');
    expect(fs.existsSync(snippetPath)).toBe(true);

    const index = JSON.parse(fs.readFileSync(path.join(repo, 'index.json'), 'utf-8'));
    expect(index.snippets).toEqual([
      {
        id: 'chest-ct-atelectasis',
        name: 'Atelectasis',
        category: 'Chest CT',
        path: 'snippets/chest-ct/atelectasis.json',
        description: 'Chest CT / Atelectasis',
      },
    ]);

    const combined = JSON.parse(fs.readFileSync(path.join(repo, 'library.json'), 'utf-8'));
    expect(combined.snippets).toHaveLength(1);
  });

  it('moves snippet file when metadata category changes', async () => {
    const entry = await service.importSnippetFromVault(
      JSON.stringify({ name: 'Effusion', template: 'Effusion', placeholders: [] }),
      'Chest Xray',
      'Effusion',
    );
    expect(entry).not.toBeNull();

    await service.updateSnippetMetadata(entry!, { category: 'Chest CT', description: 'Updated' });

    expect(fs.existsSync(path.join(repo, 'snippets', 'chest-xray', 'effusion.json'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'snippets', 'chest-ct', 'effusion.json'))).toBe(true);

    const index = JSON.parse(fs.readFileSync(path.join(repo, 'index.json'), 'utf-8'));
    expect(index.snippets[0]).toMatchObject({
      category: 'Chest CT',
      description: 'Updated',
      path: 'snippets/chest-ct/effusion.json',
    });
  });

  it('imports a vault protocol and regenerates protocol index', async () => {
    await service.importProtocolFromVault(
      JSON.stringify({
        schema: 'radiprotocol.protocol',
        version: 1,
        title: 'CT chest',
        nodes: [{ id: 'start' }, { id: 'end' }],
        edges: [{ id: 'edge' }],
      }),
      'Chest',
      'Chest protocol',
    );

    const protocolPath = path.join(repo, 'protocols', 'ct-chest.rp.json');
    expect(fs.existsSync(protocolPath)).toBe(true);

    const index = JSON.parse(fs.readFileSync(path.join(repo, 'protocols-index.json'), 'utf-8'));
    expect(index.protocols).toEqual([
      {
        id: 'ct-chest',
        title: 'CT chest',
        path: 'protocols/ct-chest.rp.json',
        schema: 'radiprotocol.protocol',
        version: 1,
        nodes: 2,
        edges: 1,
        description: 'Chest protocol',
      },
    ]);
  });

  it('validates duplicate ids and missing snippet files', async () => {
    fs.writeFileSync(path.join(repo, 'index.json'), JSON.stringify({
      version: '1.0.0',
      snippets: [
        { id: 'same', name: 'A', category: 'A', path: 'snippets/missing-a.json', description: 'A' },
        { id: 'same', name: 'B', category: 'B', path: 'snippets/missing-b.json', description: 'B' },
      ],
    }, null, 2));

    const result = await service.validateSnippets();
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate id: same');
    expect(result.errors).toContain('Missing file: snippets/missing-a.json');
    expect(result.errors).toContain('Missing file: snippets/missing-b.json');
  });

  it('pulls origin main with rebase and autostash so local branch state does not hide remote changes', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => { calls.push(cmd); return 'Already up to date.\n'; };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitPull();

    expect(result.success).toBe(true);
    expect(result.output).toBe('Already up to date.');
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('git pull --rebase --autostash origin main');
  });

  it('returns git stderr/stdout details when pull fails', async () => {
    const error = Object.assign(new Error('Command failed'), {
      stdout: 'stdout details',
      stderr: 'stderr details',
    });
    const mockExec = () => { throw error; };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitPull();

    expect(result.success).toBe(false);
    expect(result.output).toContain('stderr details');
    expect(result.output).toContain('stdout details');
  });
});
