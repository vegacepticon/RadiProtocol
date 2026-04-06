import { describe, it, expect, vi } from 'vitest';
import { ensureFolderPath } from '../utils/vault-utils';

function makeVault(exists: boolean) {
  return {
    adapter: { exists: vi.fn().mockResolvedValue(exists) },
    createFolder: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ensureFolderPath (SNIP-08)', () => {
  it('is an async function accepting (vault, folderPath)', () => {
    expect(ensureFolderPath).toBeInstanceOf(Function);
  });

  it('does NOT call createFolder when folder already exists', async () => {
    const vault = makeVault(true);
    await ensureFolderPath(vault as never, '.radiprotocol/snippets');
    expect(vault.createFolder).not.toHaveBeenCalled();
  });

  it('calls createFolder when folder does not exist', async () => {
    const vault = makeVault(false);
    await ensureFolderPath(vault as never, '.radiprotocol/snippets');
    expect(vault.createFolder).toHaveBeenCalledWith('.radiprotocol/snippets');
  });
});
