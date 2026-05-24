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

  it('returns git status, diff, branch, untracked, and remote URL helpers', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes('status --short')) return ' M snippets/test.json\n';
      if (cmd.includes('diff --stat HEAD')) return ' snippets/test.json | 2 +-\n';
      if (cmd.includes('rev-parse --abbrev-ref')) return 'main';
      if (cmd.includes('ls-files --others')) return 'snippets/new.json\n';
      if (cmd.includes('remote get-url')) return 'https://github.com/vegacepticon/RadiProtocol-Library\n';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const statusResult = await svc.gitStatus();
    expect(statusResult.success).toBe(true);
    expect(statusResult.output).toContain('snippets/test.json');

    const diffResult = await svc.gitDiffStat();
    expect(diffResult.success).toBe(true);
    expect(diffResult.output).toContain('snippets/test.json');

    const branch = await svc.gitBranch();
    expect(branch).toBe('main');

    const untracked = await svc.gitUntracked();
    expect(untracked).toContain('snippets/new.json');

    const remote = await svc.getRemoteHttpUrl();
    expect(remote).toBe('https://github.com/vegacepticon/RadiProtocol-Library');
  });

  it('gitCommitAndPushBranch stages, commits and pushes', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes('checkout -b')) return `Switched to branch 'test-branch'`;
      if (cmd.includes('add -A')) return '';
      if (cmd.includes('commit')) return '[test-branch abc1234] msg';
      if (cmd.includes('push')) return '';
      if (cmd.includes('remote get-url')) return 'https://github.com/vegacepticon/RadiProtocol-Library\n';
      if (cmd.includes('rev-parse') && cmd.includes('--short')) return 'abc1234';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitCommitAndPushBranch('test-branch', 'msg');

    expect(result.success).toBe(true);
    expect(result.branchUrl).toBe('https://github.com/vegacepticon/RadiProtocol-Library/compare/test-branch');
    expect(calls.some(c => c.includes('checkout -b test-branch'))).toBe(true);
    expect(calls.some(c => c.includes('add -A'))).toBe(true);
    expect(calls.some(c => c.includes('commit -m'))).toBe(true);
    expect(calls.some(c => c.includes('push -u origin test-branch'))).toBe(true);
  });

  it('gitCommitAndPushBranch returns branchUrl with ssh remote converted to https', async () => {
    const mockExec = (cmd: string) => {
      if (cmd.includes('checkout -b')) return '';
      if (cmd.includes('add -A')) return '';
      if (cmd.includes('commit')) return '';
      if (cmd.includes('push')) return '';
      if (cmd.includes('remote get-url')) return 'git@github.com:vegacepticon/RadiProtocol-Library.git\n';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitCommitAndPushBranch('b', 'm');
    expect(result.success).toBe(true);
    expect(result.branchUrl).toBe('https://github.com/vegacepticon/RadiProtocol-Library/compare/b');
  });

  it('gitCommitAndPushBranch returns hint when checkout fails', async () => {
    const mockExec = (cmd: string) => {
      if (cmd.includes('checkout')) throw Object.assign(new Error('branch exists'), { stderr: 'already exists' });
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitCommitAndPushBranch('b', 'm');
    expect(result.success).toBe(false);
    expect(result.hint).toBe('admin.sendBranchCheckoutFailed');
  });

  it('gitCommitAndPushBranch returns hint when push fails', async () => {
    const mockExec = (cmd: string) => {
      if (cmd.includes('checkout')) return '';
      if (cmd.includes('add')) return '';
      if (cmd.includes('commit')) return '';
      if (cmd.includes('push')) throw Object.assign(new Error('auth'), { stderr: '403' });
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitCommitAndPushBranch('b', 'm');
    expect(result.success).toBe(false);
    expect(result.hint).toBe('admin.sendPushFailed');
  });

  it('pull origin main blocks on dirty tree and reports status', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes('fetch')) return '';
      if (cmd.includes('status')) return ' M snippets/foo.json\n';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitPull();

    expect(result.success).toBe(false);
    expect(result.output).toContain('snippets/foo.json');
  });

  it('resets to origin/main with fetch + reset --hard + clean -fd', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes('fetch')) return '';
      if (cmd.includes('reset')) return 'HEAD is now at abc1234';
      if (cmd.includes('clean')) return '';
      if (cmd.includes('abbrev-ref')) return 'main';
      if (cmd.includes('rev-parse') && cmd.includes('--short')) return 'abc1234';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitResetToOriginMain();

    expect(result.success).toBe(true);
    expect(result.ref).toBe('main (abc1234)');
    expect(result.cleanedCount).toBe(0);
    expect(calls.some(c => c.includes('fetch origin main'))).toBe(true);
    expect(calls.some(c => c.includes('reset --hard origin/main'))).toBe(true);
    expect(calls.some(c => c.includes('clean -fd'))).toBe(true);
  });

  it('reset returns ref and cleanedCount when untracked files removed', async () => {
    const mockExec = (cmd: string) => {
      if (cmd.includes('fetch')) return '';
      if (cmd.includes('reset')) return 'HEAD is now at def5678';
      if (cmd.includes('clean')) return 'Removing snippets/orphan.json\nRemoving protocols/old.rp.json\n';
      if (cmd.includes('abbrev-ref')) return 'main';
      if (cmd.includes('rev-parse') && cmd.includes('--short')) return 'def5678';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitResetToOriginMain();

    expect(result.success).toBe(true);
    expect(result.ref).toBe('main (def5678)');
    expect(result.cleanedCount).toBe(2);
  });

  it('reset returns hint when fetch fails', async () => {
    const error = Object.assign(new Error('fetch failed'), { stderr: 'connection refused' });
    const mockExec = (cmd: string) => {
      if (cmd.includes('fetch')) throw error;
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitResetToOriginMain();

    expect(result.success).toBe(false);
    expect(result.hint).toBe('admin.resetFetchFailedHint');
    expect(result.output).toContain('connection refused');
  });

  it('reset returns hint when reset fails', async () => {
    const mockExec = (cmd: string) => {
      if (cmd.includes('fetch')) return '';
      if (cmd.includes('reset')) throw Object.assign(new Error('lock'), { stderr: 'index.lock exists' });
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitResetToOriginMain();

    expect(result.success).toBe(false);
    expect(result.hint).toBe('admin.resetFailedHint');
    expect(result.output).toContain('index.lock');
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

  it('createDirectory transliterates Cyrillic name to Latin slug', async () => {
    const entry = await service.createDirectory('snippets', 'snippets', 'ГМ');
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('gm');
    expect(entry!.path).toBe('snippets/gm');
    expect(fs.existsSync(path.join(repo, 'snippets', 'gm'))).toBe(true);
  });

  it('createDirectory transliterates complex Cyrillic name', async () => {
    const entry = await service.createDirectory('snippets', 'snippets', 'Щитовидная');
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('shchitovidnaya');
    expect(fs.existsSync(path.join(repo, 'snippets', 'shchitovidnaya'))).toBe(true);
  });

  it('renameDirectory produces Latin slug from Cyrillic name', async () => {
    const created = await service.createDirectory('snippets', 'snippets', 'test-dir');
    expect(created).not.toBeNull();

    const renamed = await service.renameDirectory('snippets', 'snippets/test-dir', 'Кости');
    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe('kosti');
    expect(renamed!.path).toBe('snippets/kosti');
    expect(fs.existsSync(path.join(repo, 'snippets', 'kosti'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'snippets', 'test-dir'))).toBe(false);
  });

  it('renameDirectory updates index entry paths to preserve category metadata', async () => {
    // Import a snippet first — this creates the directory and index entry
    const snippetContent = JSON.stringify({ name: 'Test Snippet', template: 'test {{param}}', placeholders: [] });
    await service.importSnippetFromVault(snippetContent, 'Old Cat', 'Test Snippet', undefined, 'Old Cat / Test Snippet');

    // Verify the snippet is under old-cat directory
    const oldIndexPath = path.join(repo, 'index.json');
    const oldIndex = JSON.parse(fs.readFileSync(oldIndexPath, 'utf-8'));
    const oldEntry = oldIndex.snippets.find((e: any) => e.path.includes('old-cat'));
    expect(oldEntry).toBeDefined();
    expect(oldEntry.category).toBe('Old Cat');

    // Rename the directory using the admin service
    const renamed = await service.renameDirectory('snippets', 'snippets/old-cat', 'new-cat');
    expect(renamed).not.toBeNull();
    expect(renamed!.name).toBe('new-cat');

    // Check that category is preserved after full regeneration
    const newIndex = JSON.parse(fs.readFileSync(oldIndexPath, 'utf-8'));
    const newEntry = newIndex.snippets.find((e: any) => e.path.includes('new-cat'));
    expect(newEntry).toBeDefined();
    expect(newEntry.category).toBe('Old Cat');
  });

  it('importSnippetFromVault still produces Latin slug from Cyrillic category', async () => {
    await service.importSnippetFromVault(
      JSON.stringify({ name: 'Atelectasis', template: 'Atelectasis {{side}}', placeholders: [] }),
      'Грудная Клетка',
      'Atelectasis',
      undefined,
      'Грудная Клетка / Atelectasis',
    );

    const snippetPath = path.join(repo, 'snippets', 'grudnaya-kletka', 'atelectasis.json');
    expect(fs.existsSync(snippetPath)).toBe(true);
  });

  describe('validateRepoPath invalid cases', () => {
    it('returns notDirectory error when path is a regular file', async () => {
      const filePath = path.join(os.tmpdir(), `rp-admin-file-${Date.now()}.txt`);
      fs.writeFileSync(filePath, 'not a dir');
      try {
        const svc = new LibraryAdminService(filePath, t);
        const result = await svc.validateRepoPath();
        expect(result).toEqual({ valid: false, error: 'admin.notDirectory' });
      } finally {
        fs.rmSync(filePath, { force: true });
      }
    });

    it('returns invalidRepoStructure error when directory has no snippets/, protocols/, or index.json', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-admin-empty-'));
      try {
        const svc = new LibraryAdminService(emptyDir, t);
        const result = await svc.validateRepoPath();
        expect(result).toEqual({ valid: false, error: 'admin.invalidRepoStructure' });
      } finally {
        fs.rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });
});
