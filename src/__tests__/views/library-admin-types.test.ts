import { describe, it, expect } from 'vitest';
import {
	entryTitle,
	nodePath,
	collectEntries,
	sortTree,
	buildAdminTree,
	findNodeByDrillPath,
	filterEntries,
	SEARCH_DEBOUNCE_MS,
	GLYPH_FOLDER,
	GLYPH_JSON,
} from '../../views/library-admin/types';
import type { AdminTreeNode, AdminEntry } from '../../views/library-admin/types';
import type { LibraryAdminDirectoryEntry } from '../../snippets/library-admin';
import type { LibrarySnippetEntry } from '../../snippets/library-model';
import type { ProtocolLibraryEntry } from '../../protocol/protocol-library-model';

function makeSnippetEntry(overrides: Partial<LibrarySnippetEntry> = {}): LibrarySnippetEntry {
	return {
		id: 'test-id',
		name: 'Test Snippet',
		category: 'Test Category',
		path: 'snippets/test-cat/test-snippet.json',
		description: 'A test snippet',
		...overrides,
	};
}

function makeProtocolEntry(overrides: Partial<ProtocolLibraryEntry> = {}): ProtocolLibraryEntry {
	return {
		id: 'test-proto-id',
		title: 'Test Protocol',
		path: 'protocols/test-proto.rp.json',
		schema: 'radiprotocol.protocol',
		version: 1,
		nodes: 3,
		edges: 2,
		description: 'A test protocol',
		...overrides,
	};
}

function makeNode(overrides: Partial<AdminTreeNode> = {}): AdminTreeNode {
	return {
		name: 'root',
		displayName: 'Root',
		path: 'root',
		children: new Map(),
		entries: [],
		...overrides,
	};
}

// ─── entryTitle ──────────────────────────────────────────────────────────

describe('entryTitle', () => {
	it('returns entry.name for snippet entries (which have name but no title)', () => {
		const entry = makeSnippetEntry({ name: 'Pneumonia' });
		expect(entryTitle(entry)).toBe('Pneumonia');
	});

	it('returns entry.title for protocol entries (which have title)', () => {
		const entry = makeProtocolEntry({ title: 'CT Chest' });
		expect(entryTitle(entry)).toBe('CT Chest');
	});
});

// ─── nodePath ────────────────────────────────────────────────────────────

describe('nodePath', () => {
	it('returns name when parent path is empty', () => {
		expect(nodePath('', 'gm')).toBe('gm');
	});

	it('joins parent and name with slash', () => {
		expect(nodePath('snippets', 'gm')).toBe('snippets/gm');
	});

	it('nests deeper paths', () => {
		expect(nodePath('snippets/gm', 'chest')).toBe('snippets/gm/chest');
	});
});

// ─── collectEntries ──────────────────────────────────────────────────────

describe('collectEntries', () => {
	it('returns direct entries of a leaf node', () => {
		const entries: AdminEntry[] = [makeSnippetEntry(), makeSnippetEntry({ id: 'b', name: 'B' })];
		const node = makeNode({ entries });
		expect(collectEntries(node)).toEqual(entries);
	});

	it('recursively collects from children', () => {
		const childEntry: AdminEntry = makeSnippetEntry({ id: 'child-a', name: 'Child A' });
		const child = makeNode({ name: 'child', displayName: 'Child', path: 'root/child', entries: [childEntry] });
		const rootEntry: AdminEntry = makeSnippetEntry({ id: 'root-a', name: 'Root A' });
		const root = makeNode({ entries: [rootEntry], children: new Map([['child', child]]) });
		const all = collectEntries(root);
		expect(all).toHaveLength(2);
		expect(all.map(e => e.id)).toContain('root-a');
		expect(all.map(e => e.id)).toContain('child-a');
	});

	it('recursively collects from children', () => {
		const childEntry = makeSnippetEntry({ id: 'child-a', name: 'Child A' });
		const child = makeNode({ name: 'child', displayName: 'Child', path: 'root/child', entries: [childEntry] });
		const rootEntry = makeSnippetEntry({ id: 'root-a', name: 'Root A' });
		const root = makeNode({ entries: [rootEntry], children: new Map([['child', child]]) });
		const all = collectEntries(root);
		expect(all).toHaveLength(2);
		expect(all.map(e => e.id)).toContain('root-a');
		expect(all.map(e => e.id)).toContain('child-a');
	});

	it('returns empty array for empty node', () => {
		expect(collectEntries(makeNode())).toEqual([]);
	});
});

// ─── sortTree ────────────────────────────────────────────────────────────

describe('sortTree', () => {
	it('sorts entries by title (case-insensitive)', () => {
		const entryA: AdminEntry = makeSnippetEntry({ id: 'a', name: 'beta' });
		const entryB: AdminEntry = makeSnippetEntry({ id: 'b', name: 'Alpha' });
		const node = makeNode({ entries: [entryA, entryB] });
		sortTree(node);
		expect(entryTitle(node.entries[0]!)).toBe('Alpha');
		expect(entryTitle(node.entries[1]!)).toBe('beta');
	});

	it('sorts children by displayName (Russian-aware)', () => {
		const childB = makeNode({ name: 'b', displayName: 'Бета', path: 'root/b' });
		const childA = makeNode({ name: 'a', displayName: 'Альфа', path: 'root/a' });
		const root = makeNode({ children: new Map([['b', childB], ['a', childA]]) });
		sortTree(root);
		const names = [...root.children.values()].map(c => c.displayName);
		expect(names).toEqual(['Альфа', 'Бета']);
	});

	it('sorts recursively into deep children', () => {
		const deepEntry1 = makeSnippetEntry({ id: 'z', name: 'Zebra' });
		const deepEntry2 = makeSnippetEntry({ id: 'a', name: 'Apple' });
		const deep = makeNode({ name: 'deep', displayName: 'Deep', path: 'root/deep', entries: [deepEntry1, deepEntry2] });
		const root = makeNode({ children: new Map([['deep', deep]]) });
		sortTree(root);
		const deepNode = root.children.get('deep')!;
		expect(entryTitle(deepNode.entries[0]!)).toBe('Apple');
	});
});

// ─── filterEntries ───────────────────────────────────────────────────────

describe('filterEntries', () => {
	const entries: AdminEntry[] = [
		makeSnippetEntry({ id: '1', name: 'Pneumonia', path: 'snippets/chest/pneumonia.json', description: 'Lung infection' }),
		makeSnippetEntry({ id: '2', name: 'Fracture', path: 'snippets/bone/fracture.json', description: 'Bone break' }),
		makeProtocolEntry({ id: '3', title: 'CT Chest', path: 'protocols/ct-chest.rp.json', description: 'Chest CT protocol' }),
	];

	it('returns all entries when query is empty', () => {
		expect(filterEntries(entries, '')).toHaveLength(3);
	});

	it('filters by name (case-insensitive)', () => {
		const result = filterEntries(entries, 'pneum');
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('1');
	});

	it('filters by title for protocol entries', () => {
		const result = filterEntries(entries, 'CT Chest');
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('3');
	});

	it('filters by path', () => {
		const result = filterEntries(entries, 'bone');
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('2');
	});

	it('filters by description', () => {
		const result = filterEntries(entries, 'infection');
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe('1');
	});

	it('returns empty for no match', () => {
		expect(filterEntries(entries, 'xyzzy')).toHaveLength(0);
	});
});

// ─── findNodeByDrillPath ────────────────────────────────────────────────

describe('findNodeByDrillPath', () => {
	it('returns root when drill path is empty', () => {
		const root = makeNode({ name: 'snippets', displayName: 'Snippets' });
		const { node, validPath } = findNodeByDrillPath(root, []);
		expect(node).toBe(root);
		expect(validPath).toEqual([]);
	});

	it('drills into existing children', () => {
		const child = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const root = makeNode({ name: 'snippets', displayName: 'Snippets', children: new Map([['gm', child]]) });
		const { node, validPath } = findNodeByDrillPath(root, ['gm']);
		expect(node).toBe(child);
		expect(validPath).toEqual(['gm']);
	});

	it('truncates path at first missing child', () => {
		const root = makeNode({ name: 'snippets', displayName: 'Snippets' });
		const { node, validPath } = findNodeByDrillPath(root, ['nonexistent', 'deeper']);
		expect(node).toBe(root);
		expect(validPath).toEqual([]);
	});

	it('validates partial drill path', () => {
		const deep = makeNode({ name: 'deep', displayName: 'Deep', path: 'snippets/gm/deep' });
		const mid = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm', children: new Map([['deep', deep]]) });
		const root = makeNode({ name: 'snippets', displayName: 'Snippets', children: new Map([['gm', mid]]) });
		const { node, validPath } = findNodeByDrillPath(root, ['gm', 'deep', 'missing']);
		expect(node).toBe(deep);
		expect(validPath).toEqual(['gm', 'deep']);
	});
});

// ─── buildAdminTree ─────────────────────────────────────────────────────

describe('buildAdminTree', () => {
	const directories: LibraryAdminDirectoryEntry[] = [
		{ name: 'gm', path: 'snippets/gm', section: 'snippets' },
		{ name: 'obp', path: 'snippets/obp', section: 'snippets' },
	];

	const entries: LibrarySnippetEntry[] = [
		makeSnippetEntry({ id: 'gm-atelectasis', name: 'Atelectasis', category: 'ГМ', path: 'snippets/gm/atelectasis.json' }),
		makeSnippetEntry({ id: 'obp-effusion', name: 'Effusion', category: 'ОБП', path: 'snippets/obp/effusion.json' }),
	];

	it('builds tree with root named after section', () => {
		const tree = buildAdminTree('snippets', directories, entries);
		expect(tree.name).toBe('snippets');
		expect(tree.path).toBe('snippets');
	});

	it('creates child nodes from directories', () => {
		const tree = buildAdminTree('snippets', directories, entries);
		expect(tree.children.has('gm')).toBe(true);
		expect(tree.children.has('obp')).toBe(true);
	});

	it('populates entries into correct child nodes', () => {
		const tree = buildAdminTree('snippets', directories, entries);
		const gm = tree.children.get('gm')!;
		expect(gm.entries).toHaveLength(1);
		expect((gm.entries[0]! as LibrarySnippetEntry).name).toBe('Atelectasis');
	});

	it('uses category as displayName fallback for slug nodes', () => {
		const tree = buildAdminTree('snippets', directories, entries);
		const gm = tree.children.get('gm')!;
		expect(gm.displayName).toBe('ГМ');
	});

	it('uses metaDisplayNameBySlug over category', () => {
		const metaNames = new Map([['gm', 'Грудная Мышица']]);
		const tree = buildAdminTree('snippets', directories, entries, metaNames);
		expect(tree.children.get('gm')!.displayName).toBe('Грудная Мышица');
	});

	it('uses slugToDisplayName when no category or meta', () => {
		const dirsNoCategory: LibraryAdminDirectoryEntry[] = [
			{ name: 'chest-ct', path: 'protocols/chest-ct', section: 'protocols' },
		];
		const protoEntries: ProtocolLibraryEntry[] = [
			makeProtocolEntry({ id: 'ct-chest', title: 'CT Chest', path: 'protocols/chest-ct/ct-chest.rp.json' }),
		];
		const tree = buildAdminTree('protocols', dirsNoCategory, protoEntries, undefined, (slug) => slug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '));
		expect(tree.children.get('chest-ct')!.displayName).toBe('Chest Ct');
	});

	it('sorts children alphabetically by displayName', () => {
		const tree = buildAdminTree('snippets', directories, entries);
		const childNames = [...tree.children.values()].map(c => c.displayName);
		for (let i = 1; i < childNames.length; i++) {
			expect(childNames[i - 1]!.localeCompare(childNames[i]!, 'ru', { sensitivity: 'base' }) <= 0).toBe(true);
		}
	});

	it('sorts entries alphabetically by name', () => {
		const multiEntries: LibrarySnippetEntry[] = [
			makeSnippetEntry({ id: 'z', name: 'Zebra', path: 'snippets/gm/zebra.json' }),
			makeSnippetEntry({ id: 'a', name: 'Apple', path: 'snippets/gm/apple.json' }),
		];
		const tree = buildAdminTree('snippets', directories, multiEntries);
		const gm = tree.children.get('gm');
		if (gm && gm.entries.length >= 2) {
			const first = gm.entries[0]! as LibrarySnippetEntry;
			const second = gm.entries[1]! as LibrarySnippetEntry;
			expect(first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }) <= 0).toBe(true);
		}
	});
});

// ─── Constants ───────────────────────────────────────────────────────────

describe('constants', () => {
	it('SEARCH_DEBOUNCE_MS is 120', () => {
		expect(SEARCH_DEBOUNCE_MS).toBe(120);
	});

	it('GLYPH_FOLDER is the folder emoji', () => {
		expect(GLYPH_FOLDER).toBe('\uD83D\uDCC1');
	});

	it('GLYPH_JSON is the document emoji', () => {
		expect(GLYPH_JSON).toBe('\uD83D\uDCC4');
	});
});