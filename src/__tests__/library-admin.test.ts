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
    expect(calls.some(c => c.includes('commit -m msg'))).toBe(true);
    expect(calls.some(c => c.includes('push -u origin test-branch'))).toBe(true);
  });

  it('gitCommitAndPushBranch shell-quotes commit messages with spaces and quotes', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes('checkout -b')) return '';
      if (cmd.includes('add -A')) return '';
      if (cmd.includes('commit')) return '[branch abc1234] msg';
      if (cmd.includes('push')) return '';
      if (cmd.includes('remote get-url')) return 'https://github.com/vegacepticon/RadiProtocol-Library\n';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitCommitAndPushBranch('test-branch', `Обновление содержимого библиотеки`);

    expect(result.success).toBe(true);
    expect(calls).toContain(`git commit -m 'Обновление содержимого библиотеки'`);
  });

  it('gitCommitAndPushBranch shell-quotes single quotes safely', async () => {
    const calls: string[] = [];
    const mockExec = (cmd: string) => {
      calls.push(cmd);
      if (cmd.includes('checkout -b')) return '';
      if (cmd.includes('add -A')) return '';
      if (cmd.includes('commit')) return '[branch abc1234] msg';
      if (cmd.includes('push')) return '';
      if (cmd.includes('remote get-url')) return 'https://github.com/vegacepticon/RadiProtocol-Library\n';
      return '';
    };
    const svc = new LibraryAdminService(repo, t, mockExec as unknown as typeof import('node:child_process').execSync);

    const result = await svc.gitCommitAndPushBranch('test-branch', `Bob's update`);

    expect(result.success).toBe(true);
    expect(calls).toContain(`git commit -m 'Bob'"'"'s update'`);
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


  it('imports a snippet directly into a specific subdirectory', async () => {
    // Create the target directory structure
    fs.mkdirSync(path.join(repo, 'snippets', 'chest-ct'), { recursive: true });

    const result = await service.importSnippetFromVaultToDirectory(
      JSON.stringify({ name: 'Nodule', template: '{{size}} nodule', placeholders: [{ id: 'size', label: 'Size', type: 'free-text' }] }),
      'snippets/chest-ct',
      'Nodule',
    );

    expect(result).not.toBeNull();
    expect(result!.path).toBe('snippets/chest-ct/nodule.json');
    expect(fs.existsSync(path.join(repo, 'snippets', 'chest-ct', 'nodule.json'))).toBe(true);
  });

  it('reads and saves library snippet content including placeholders', async () => {
    const snippetContent = JSON.stringify({
      name: 'Pneumonia',
      template: 'Pneumonia {{side}} {{lobe}}',
      placeholders: [
        { id: 'side', label: 'Side', type: 'choice', options: ['Right', 'Left', 'Bilateral'] },
        { id: 'lobe', label: 'Lobe', type: 'free-text' },
      ],
    }, null, 2);
    fs.mkdirSync(path.join(repo, 'snippets', 'infectious'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'snippets', 'infectious', 'pneumonia.json'), snippetContent + '\n');

    const entry: import('../snippets/library-model').LibrarySnippetEntry = {
      id: 'infectious-pneumonia',
      name: 'Pneumonia',
      category: 'Infectious',
      path: 'snippets/infectious/pneumonia.json',
      description: 'Infectious / Pneumonia',
    };

    const read = await service.readLibrarySnippet(entry);
    expect(read).not.toBeNull();
    expect(read!.name).toBe('Pneumonia');
    expect(read!.template).toContain('Pneumonia {{side}} {{lobe}}');
    expect(read!.placeholders).toHaveLength(2);
    expect(read!.validationError).toBeNull();

    const modified = { ...read! };
    if (modified.kind !== 'json') return;
    modified.name = 'Pneumonia Updated';
    modified.template = 'Community-acquired pneumonia {{side}}';
    modified.placeholders = [{ id: 'side', label: 'Side', type: 'choice', options: ['Right', 'Left'] }];
    await service.saveLibrarySnippet(modified);

    const reRead = await service.readLibrarySnippet(entry);
    expect(reRead!.name).toBe('Pneumonia Updated');
    expect(reRead!.placeholders).toHaveLength(1);
  });

  it('moves a snippet to a different directory and updates path', async () => {
    fs.mkdirSync(path.join(repo, 'snippets', 'chest-xray'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'snippets', 'chest-ct'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'snippets', 'chest-xray', 'effusion.json'),
      JSON.stringify({ name: 'Effusion', template: 'Effusion {{side}}', placeholders: [] }) + '\n');

    const entry: import('../snippets/library-model').LibrarySnippetEntry = {
      id: 'chest-xray-effusion', name: 'Effusion', category: 'Chest Xray',
      path: 'snippets/chest-xray/effusion.json', description: 'Chest Xray / Effusion',
    };

    const result = await service.moveSnippetToDirectory(entry, 'snippets/chest-ct');
    expect(result).not.toBeNull();
    expect(result!.path).toBe('snippets/chest-ct/effusion.json');
    expect(fs.existsSync(path.join(repo, 'snippets', 'chest-xray', 'effusion.json'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'snippets', 'chest-ct', 'effusion.json'))).toBe(true);

    const index = JSON.parse(fs.readFileSync(path.join(repo, 'index.json'), 'utf-8'));
    expect(index.snippets[0].path).toBe('snippets/chest-ct/effusion.json');
  });

  it('moveSnippetToDirectory skips when already in same directory', async () => {
    fs.mkdirSync(path.join(repo, 'snippets', 'cat1'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'snippets', 'cat1', 'test.json'),
      JSON.stringify({ name: 'Test', template: '', placeholders: [] }) + '\n');

    const entry: import('../snippets/library-model').LibrarySnippetEntry = {
      id: 'cat1-test', name: 'Test', category: 'Cat1',
      path: 'snippets/cat1/test.json', description: 'Cat1 / Test',
    };

    const result = await service.moveSnippetToDirectory(entry, 'snippets/cat1');
    expect(result!.path).toBe('snippets/cat1/test.json'); // Returns original when path unchanged
  });

  it('listSnippetDirectories returns all snippet subdirectories sorted', async () => {
    fs.mkdirSync(path.join(repo, 'snippets', 'chest-ct'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'snippets', 'chest-ct', 'subdir'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'snippets', 'abdominal'), { recursive: true });

    const dirs = await service.listSnippetDirectories();
    expect(dirs).toContain('snippets');
    expect(dirs).toContain('snippets/chest-ct');
    expect(dirs).toContain('snippets/chest-ct/subdir');
    expect(dirs).toContain('snippets/abdominal');
    expect(dirs[0]).toBe('snippets'); // sorted
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

  it('deleteDirectory removes an empty folder', async () => {
    fs.mkdirSync(path.join(repo, 'snippets', 'empty'), { recursive: true });

    const ok = await service.deleteDirectory('snippets', 'snippets/empty');

    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(repo, 'snippets', 'empty'))).toBe(false);
  });

  it('deleteDirectory removes a non-empty folder child-first', async () => {
    fs.mkdirSync(path.join(repo, 'snippets', 'filled', 'nested'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'snippets', 'filled', 'nested', 'snippet.json'), JSON.stringify({ name: 'Snippet' }));

    const ok = await service.deleteDirectory('snippets', 'snippets/filled');

    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(repo, 'snippets', 'filled'))).toBe(false);
  });

  it('deleteDirectory ignores technical manifest files when deleting otherwise visible-empty folders', async () => {
    fs.mkdirSync(path.join(repo, 'snippets', 'manifest-only'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'snippets', 'manifest-only', 'library-manifest.json'), JSON.stringify({ installed: [] }));

    const ok = await service.deleteDirectory('snippets', 'snippets/manifest-only');

    expect(ok).toBe(true);
    expect(fs.existsSync(path.join(repo, 'snippets', 'manifest-only'))).toBe(false);
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
