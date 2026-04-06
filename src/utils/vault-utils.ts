// utils/vault-utils.ts
// Pure module — vault calls via parameter (NFR-01 — no direct Obsidian imports)
import type { Vault } from 'obsidian';

/**
 * Ensure a folder exists in the vault, creating it if necessary.
 * Guards against vault.createFolder() throwing on existing paths (SNIP-08, RESEARCH.md Pitfall 2).
 */
export async function ensureFolderPath(vault: Vault, folderPath: string): Promise<void> {
  const exists = await vault.adapter.exists(folderPath);
  if (!exists) {
    await vault.createFolder(folderPath);
  }
}
