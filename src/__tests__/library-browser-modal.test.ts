import { describe, it, expect } from 'vitest';
import {
  buildLibraryTree,
  collectLibraryEntries,
  filterLibraryEntries,
} from '../views/library-browser-modal';
import type { LibrarySnippetEntry } from '../snippets/library-model';

const entries: LibrarySnippetEntry[] = [
  {
    id: 'gm-ateroskleroz',
    name: 'АТЕРОСКЛЕРОЗ',
    category: 'ГМ',
    path: 'snippets/gm/ateroskleroz.json',
    description: 'ГМ / АТЕРОСКЛЕРОЗ',
  },
  {
    id: 'chest-atelectasis',
    name: 'Atelectasis',
    category: 'Chest/CT',
    path: 'snippets/chest/ct/atelectasis.json',
    description: 'Chest / CT / Atelectasis',
  },
  {
    id: 'chest-xray-effusion',
    name: 'Pleural effusion',
    category: 'Chest/X-ray',
    path: 'snippets/chest/xray/effusion.json',
    description: 'Chest / X-ray / Pleural effusion',
  },
];

describe('LibraryBrowserModal helpers', () => {
  it('builds a navigable tree from category paths', () => {
    const tree = buildLibraryTree(entries);

    expect([...tree.children.keys()]).toEqual(['Chest', 'ГМ']);
    const chest = tree.children.get('Chest');
    expect(chest).toBeTruthy();
    expect([...(chest?.children.keys() ?? [])]).toEqual(['CT', 'X-ray']);
    expect(chest?.children.get('CT')?.entries.map((entry) => entry.id)).toEqual(['chest-atelectasis']);
    expect(tree.children.get('ГМ')?.entries.map((entry) => entry.id)).toEqual(['gm-ateroskleroz']);
  });

  it('collects all snippets under the current directory recursively', () => {
    const tree = buildLibraryTree(entries);
    const chest = tree.children.get('Chest');

    expect(chest).toBeTruthy();
    expect(collectLibraryEntries(chest!).map((entry) => entry.id).sort()).toEqual([
      'chest-atelectasis',
      'chest-xray-effusion',
    ]);
  });

  it('searches by name, category, description, and remote path', () => {
    expect(filterLibraryEntries(entries, 'атеро').map((entry) => entry.id)).toEqual(['gm-ateroskleroz']);
    expect(filterLibraryEntries(entries, 'x-ray').map((entry) => entry.id)).toEqual(['chest-xray-effusion']);
    expect(filterLibraryEntries(entries, 'ct').map((entry) => entry.id)).toEqual(['chest-atelectasis']);
    expect(filterLibraryEntries(entries, 'missing')).toEqual([]);
  });
});
