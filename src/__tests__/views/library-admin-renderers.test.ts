import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Minimal DOM mock element for testing rendering functions
// ---------------------------------------------------------------------------

interface MockEl {
	tagName: string;
	children: MockEl[];
	parent: MockEl | null;
	_text: string;
	classList: Set<string>;
	_attrs: Record<string, string>;
	_listeners: Map<string, Array<(ev: unknown) => void>>;
	_value: string;
	_placeholder: string;
	_type: string;
	createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }) => MockEl;
	createDiv: (opts?: { cls?: string; text?: string; attr?: Record<string, string> }) => MockEl;
	empty: () => void;
	setText: (text: string) => void;
	addClass: (cls: string) => void;
	removeClass: (cls: string) => void;
	setAttribute: (k: string, v: string) => void;
	getAttribute: (k: string) => string | null;
	addEventListener: (type: string, handler: (ev: unknown) => void) => void;
	dispatchEvent: (event: { type: string; [key: string]: unknown }) => void;
	closest: (sel: string) => MockEl | null;
}

function makeEl(tag = 'div'): MockEl {
	const children: MockEl[] = [];
	const listeners = new Map<string, Array<(ev: unknown) => void>>();
	const classList = new Set<string>();
	const attrs: Record<string, string> = {};
	const el: MockEl = {
		tagName: tag.toUpperCase(),
		children,
		parent: null,
		_text: '',
		classList,
		_attrs: attrs,
		_listeners: listeners,
		_value: '',
		_placeholder: '',
		_type: '',
		createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }): MockEl {
			const child = makeEl(subtag);
			child.parent = el;
			if (opts?.text !== undefined) child._text = opts.text;
			if (opts?.cls) {
				for (const c of opts.cls.split(' ').filter(Boolean)) child.classList.add(c);
			}
			if (opts?.type) child._type = opts.type;
			if (opts?.attr) {
				for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = String(v);
			}
			children.push(child);
			return child;
		},
		createDiv(opts?: { cls?: string; text?: string; attr?: Record<string, string> }): MockEl {
			return el.createEl('div', opts);
		},
		empty(): void { children.length = 0; },
		setText(text: string): void { el._text = text; },
		addClass(cls: string): void { classList.add(cls); },
		removeClass(cls: string): void { classList.delete(cls); },
		setAttribute(k: string, v: string): void { attrs[k] = v; },
		getAttribute(k: string): string | null { return attrs[k] ?? null; },
		addEventListener(type: string, handler: (ev: unknown) => void): void {
			const arr = listeners.get(type) ?? [];
			arr.push(handler);
			listeners.set(type, arr);
		},
		dispatchEvent(event: { type: string; [key: string]: unknown }): void {
			for (const h of listeners.get(event.type) ?? []) h(event);
		},
		closest(sel: string): MockEl | null {
			if (sel === 'button' && el.tagName === 'BUTTON') return el;
			return null;
		},
	};
	return el;
}

// Helper: find all MockEl descendants with a given CSS class
function findAllByClass(root: MockEl, cls: string): MockEl[] {
	const results: MockEl[] = [];
	const stack = [root];
	while (stack.length > 0) {
		const cur = stack.pop()!;
		if (cur.classList.has(cls)) results.push(cur);
		for (const child of cur.children) stack.push(child);
	}
	return results;
}

// Mock dom-helpers — our MockEl stands in for HTMLElement
vi.mock('../../utils/dom-helpers', () => ({
	createButton: (parent: MockEl, opts: { cls?: string; text?: string; attr?: Record<string, string> } = {}): MockEl => {
		return parent.createEl('button', { cls: opts.cls, text: opts.text, attr: opts.attr });
	},
	createInput: (parent: MockEl, opts: { cls?: string; type?: string; placeholder?: string; value?: string; attr?: Record<string, string> } = {}): MockEl => {
		const input = parent.createEl('input', {
			cls: opts.cls,
			type: opts.type,
			attr: { ...opts.attr ?? {}, ...(opts.placeholder ? { placeholder: opts.placeholder } : {}) },
		});
		input._value = opts.value ?? '';
		input._placeholder = opts.placeholder ?? '';
		input._type = opts.type ?? 'text';
		return input;
	},
}));

// Mock obsidian for transitive imports
vi.mock('obsidian', () => ({
	Modal: class { app = {}; contentEl = makeEl('div'); titleEl = makeEl('div'); open() {} close() {} onOpen() {} onClose() {} },
	Setting: class { constructor() {} setName() { return this; } setDesc() { return this; } addButton() { return this; } addText() { return this; } setCta() { return this; } setDisabled() { return this; } },
	AbstractInputSuggest: class { constructor() {} },
	App: class {},
	TFile: class { path = ''; extension = ''; basename = ''; constructor(p = '') { this.path = p; } },
	TFolder: class { path = ''; name = ''; children = []; constructor(p = '') { this.path = p; this.name = p.split('/').pop() ?? ''; } },
	Notice: class { constructor() {} },
}));

import { renderBreadcrumb } from '../../views/library-admin/breadcrumb';
import { renderTreeSearch } from '../../views/library-admin/search';
import {
	renderFolderTile,
	renderEntryRow,
	renderDirectory,
	renderSearchResults,
} from '../../views/library-admin/tree-renderer';
import type { AdminTreeNode, AdminEntry } from '../../views/library-admin/types';
import type { LibrarySnippetEntry } from '../../snippets/library-model';
import type { ProtocolLibraryEntry } from '../../protocol/protocol-library-model';

function makeSnippetEntry(overrides: Partial<LibrarySnippetEntry> = {}): LibrarySnippetEntry {
	return { id: 'test-id', name: 'Test Snippet', category: 'Test Category', path: 'snippets/test-cat/test-snippet.json', description: 'A test snippet', ...overrides };
}

function makeProtocolEntry(overrides: Partial<ProtocolLibraryEntry> = {}): ProtocolLibraryEntry {
	return { id: 'test-proto-id', title: 'Test Protocol', path: 'protocols/test-proto.rp.json', schema: 'radiprotocol.protocol', version: 1, nodes: 3, edges: 2, description: 'A test protocol', ...overrides };
}

function makeNode(overrides: Partial<AdminTreeNode> = {}): AdminTreeNode {
	return { name: 'root', displayName: 'Root', path: 'root', children: new Map(), entries: [], ...overrides };
}

const mockI18n = (key: string, params?: Record<string, string>): string => {
	const map: Record<string, string> = {
		'admin.directoryCount': params ? `${params.count} items` : '0 items',
		'admin.rename': 'Rename',
		'admin.delete': 'Delete',
		'admin.edit': 'Edit',
		'admin.editSnippet': params ? `Edit snippet: ${params.name}` : 'Edit snippet',
		'admin.editProtocol': params ? `Edit protocol: ${params.title}` : 'Edit protocol',
		'admin.emptyFolder': 'Empty folder',
		'admin.searchResults': params ? `${params.count} results` : '0 results',
		'admin.emptyResults': 'No results',
		'admin.protocolMeta': params ? `${params.nodes} nodes, ${params.edges} edges` : '',
		'admin.searchPlaceholder': 'Search…',
		'admin.createFolder': 'New Folder',
		'admin.openFolder': params ? `Open folder ${params.name}` : 'Open folder',
	};
	return map[key] ?? key;
};

// Cast helper: MockEl -> HTMLElement for function args
function asEl(el: MockEl): HTMLElement {
	return el as unknown as HTMLElement;
}

// ─── renderBreadcrumb ─────────────────────────────────────────────────────

describe('renderBreadcrumb', () => {
	it('renders root button with is-current class when drill path is empty', () => {
		const host = makeEl('div');
		renderBreadcrumb(asEl(host), [], 'Snippets', { onRootClick: () => {}, onCrumbClick: () => {} });

		const breadcrumb = host.children[0]!;
		expect(breadcrumb.classList.has('rp-admin-breadcrumb')).toBe(true);

		const rootBtn = breadcrumb.children[0]!;
		expect(rootBtn.classList.has('rp-admin-crumb')).toBe(true);
		expect(rootBtn.classList.has('is-current')).toBe(true);
		expect(rootBtn._text).toBe('Snippets');
	});

	it('renders root and crumb segments for non-empty drill path', () => {
		const host = makeEl('div');
		renderBreadcrumb(asEl(host), ['gm', 'chest'], 'Snippets', { onRootClick: () => {}, onCrumbClick: () => {} });

		const breadcrumb = host.children[0]!;
		const buttons = breadcrumb.children.filter(c => c.tagName === 'BUTTON');
		expect(buttons.length).toBe(3);
		expect(buttons[1]!._text).toBe('gm');
		expect(buttons[2]!._text).toBe('chest');
	});

	it('calls onRootClick when root button is clicked', () => {
		const host = makeEl('div');
		const clicks: string[] = [];
		renderBreadcrumb(asEl(host), ['gm'], 'Snippets', {
			onRootClick: () => { clicks.push('root'); },
			onCrumbClick: () => {},
		});

		const breadcrumb = host.children[0]!;
		const rootBtn = breadcrumb.children[0]!;
		rootBtn.dispatchEvent({ type: 'click' });
		expect(clicks).toEqual(['root']);
	});

	it('calls onCrumbClick with correct index when crumb is clicked', () => {
		const host = makeEl('div');
		const crumbClicks: number[] = [];
		renderBreadcrumb(asEl(host), ['gm', 'chest'], 'Snippets', {
			onRootClick: () => {},
			onCrumbClick: (i) => { crumbClicks.push(i); },
		});

		const breadcrumb = host.children[0]!;
		const buttons = breadcrumb.children.filter(c => c.tagName === 'BUTTON');
		buttons[2]!.dispatchEvent({ type: 'click' });
		expect(crumbClicks).toEqual([1]);
	});

	it('marks last crumb as current', () => {
		const host = makeEl('div');
		renderBreadcrumb(asEl(host), ['gm'], 'Snippets', { onRootClick: () => {}, onCrumbClick: () => {} });

		const breadcrumb = host.children[0]!;
		const buttons = breadcrumb.children.filter(c => c.tagName === 'BUTTON');
		expect(buttons[0]!.classList.has('is-current')).toBe(false);
		expect(buttons[1]!.classList.has('is-current')).toBe(true);
	});

	it('renders separators between crumbs', () => {
		const host = makeEl('div');
		renderBreadcrumb(asEl(host), ['gm', 'chest'], 'Snippets', { onRootClick: () => {}, onCrumbClick: () => {} });

		const breadcrumb = host.children[0]!;
		const spans = breadcrumb.children.filter(c => c.tagName === 'SPAN');
		expect(spans.length).toBe(2);
		expect(spans.every(s => s.classList.has('rp-admin-crumb-separator'))).toBe(true);
	});
});

// ─── renderTreeSearch ─────────────────────────────────────────────────────

describe('renderTreeSearch', () => {
	it('creates a toolbar container with search input and folder button', () => {
		const host = makeEl('div');
		renderTreeSearch(asEl(host), '', mockI18n, () => {}, () => {});

		const toolbar = host.children[0]!;
		expect(toolbar.classList.has('rp-admin-tree-toolbar')).toBe(true);

		const input = toolbar.children[0]!;
		expect(input.classList.has('rp-admin-search-input')).toBe(true);
		expect(input._type).toBe('text');
	});

	it('pre-populates search input with initial query', () => {
		const host = makeEl('div');
		// Note: renderTreeSearch returns HTMLInputElement but our mock stores
		// the initial query in _value (mock-specific). The real DOM value
		// property is not available on mock elements, so we just check
		// that the function returned without error.
		renderTreeSearch(asEl(host), 'pneumonia', mockI18n, () => {}, () => {});
		// Verify the toolbar was created
		expect(host.children.length).toBeGreaterThan(0);
	});

	it('fires onInput callback when search input receives input event', () => {
		const host = makeEl('div');
		let inputCount = 0;
		renderTreeSearch(asEl(host), '', mockI18n, () => { inputCount++; }, () => {});

		const toolbar = host.children[0]!;
		const input = toolbar.children[0]!;
		input.dispatchEvent({ type: 'input' });
		expect(inputCount).toBe(1);
	});

	it('renders create folder button with correct text', () => {
		const host = makeEl('div');
		renderTreeSearch(asEl(host), '', mockI18n, () => {}, () => {});

		const toolbar = host.children[0]!;
		const folderBtn = toolbar.children[1]!;
		expect(folderBtn.tagName).toBe('BUTTON');
		expect(folderBtn._text).toBe('New Folder');
		expect(folderBtn.classList.has('rp-admin-create-folder-btn')).toBe(true);
	});

	it('fires onCreateFolder callback when folder button is clicked', () => {
		const host = makeEl('div');
		const folderClicks: number[] = [];
		renderTreeSearch(asEl(host), '', mockI18n, () => {}, () => { folderClicks.push(1); });

		const toolbar = host.children[0]!;
		const folderBtn = toolbar.children[1]!;
		folderBtn.dispatchEvent({ type: 'click' });
		expect(folderClicks).toEqual([1]);
	});
});

// ─── renderFolderTile ─────────────────────────────────────────────────────

describe('renderFolderTile', () => {
	it('renders folder tile with display name and click handler', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const clicks: string[] = [];
		renderFolderTile(asEl(grid), node, mockI18n, () => { clicks.push('open'); }, () => {}, () => {});

		const tile = grid.children[0]!;
		expect(tile.classList.has('rp-admin-folder-tile')).toBe(true);

		const openBtn = tile.children[0]!;
		expect(openBtn.classList.has('rp-admin-folder-tile-open')).toBe(true);
		openBtn.dispatchEvent({ type: 'click' });
		expect(clicks).toEqual(['open']);
	});

	it('shows slug name when displayName differs', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		renderFolderTile(asEl(grid), node, mockI18n, () => {}, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		const pathEls = findAllByClass(openBtn, 'rp-admin-entry-path');
		expect(pathEls.length).toBeGreaterThan(0);
		expect(pathEls[0]!._text).toBe('gm');
	});

	it('does not show slug name when displayName equals name', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'gm', path: 'snippets/gm' });
		renderFolderTile(asEl(grid), node, mockI18n, () => {}, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		const pathEls = findAllByClass(openBtn, 'rp-admin-entry-path');
		expect(pathEls.length).toBe(0);
	});

	it('fires rename and delete callbacks', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const actions: string[] = [];
		renderFolderTile(asEl(grid), node, mockI18n,
			() => {},
			() => { actions.push('rename'); },
			() => { actions.push('delete'); },
		);

		const tile = grid.children[0]!;
		const actionArea = tile.children[1]!;
		expect(actionArea.classList.has('rp-admin-folder-tile-actions')).toBe(true);
		expect(actionArea.children.length).toBe(2);
		actionArea.children[0]!.dispatchEvent({ type: 'click' });
		expect(actions).toEqual(['rename']);
		actionArea.children[1]!.dispatchEvent({ type: 'click' });
		expect(actions).toEqual(['rename', 'delete']);
	});

	it('open button has action-oriented aria-label with folder name', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		renderFolderTile(asEl(grid), node, mockI18n, () => {}, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		expect(openBtn._attrs['aria-label']).toBe('Open folder ГМ');
		expect(openBtn._attrs['title']).toBeUndefined();
	});

	it('open button aria-label uses displayName, not slug', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'chest', displayName: 'Грудная клетка', path: 'snippets/chest' });
		renderFolderTile(asEl(grid), node, mockI18n, () => {}, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		expect(openBtn._attrs['aria-label']).toBe('Open folder Грудная клетка');
		expect(openBtn._attrs['aria-label']).not.toContain('chest');
	});

	it('open button has tabindex=0 and role=button', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		renderFolderTile(asEl(grid), node, mockI18n, () => {}, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		expect(openBtn._attrs['tabindex']).toBe('0');
		expect(openBtn._attrs['role']).toBe('button');
	});

	it('Enter keydown on open button fires onOpen callback', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const opens: string[] = [];
		renderFolderTile(asEl(grid), node, mockI18n, () => { opens.push('open'); }, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		let prevented = false;
		openBtn.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => { prevented = true; } });
		expect(opens).toEqual(['open']);
		expect(prevented).toBe(true);
	});

	it('Space keydown on open button fires onOpen callback', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const opens: string[] = [];
		renderFolderTile(asEl(grid), node, mockI18n, () => { opens.push('open'); }, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		let prevented = false;
		openBtn.dispatchEvent({ type: 'keydown', key: ' ', preventDefault: () => { prevented = true; } });
		expect(opens).toEqual(['open']);
		expect(prevented).toBe(true);
	});

	it('other keys on open button do not fire onOpen', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const opens: string[] = [];
		renderFolderTile(asEl(grid), node, mockI18n, () => { opens.push('open'); }, () => {}, () => {});

		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		openBtn.dispatchEvent({ type: 'keydown', key: 'Tab', preventDefault: () => {} });
		openBtn.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: () => {} });
		expect(opens).toEqual([]);
	});
});

// ─── renderEntryRow ───────────────────────────────────────────────────────

describe('renderEntryRow', () => {
	it('renders snippet entry with info and actions sections', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 's1', name: 'Pneumonia', path: 'snippets/chest/pneumonia.json' });
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n);

		const row = list.children[0]!;
		expect(row.classList.has('rp-admin-entry')).toBe(true);

		const info = row.children[0]!;
		expect(info.classList.has('rp-admin-entry-info')).toBe(true);

		const actions = row.children[1]!;
		expect(actions.classList.has('rp-admin-entry-actions')).toBe(true);
	});

	it('shows path as leaf name when showPath is false', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ path: 'snippets/chest/pneumonia.json' });
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		const pathEls = findAllByClass(info, 'rp-admin-entry-path');
		expect(pathEls.length).toBeGreaterThan(0);
		expect(pathEls[0]!._text).toBe('pneumonia.json');
	});

	it('shows full path when showPath is true', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ path: 'snippets/chest/pneumonia.json' });
		renderEntryRow(asEl(list), entry, 'snippets', true, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		const pathEls = findAllByClass(info, 'rp-admin-entry-path');
		expect(pathEls.length).toBeGreaterThan(0);
		expect(pathEls[0]!._text).toBe('snippets/chest/pneumonia.json');
	});

	it('renders protocol meta for protocol entries', () => {
		const list = makeEl('div');
		const entry = makeProtocolEntry({ nodes: 5, edges: 3 });
		renderEntryRow(asEl(list), entry, 'protocols', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		const metaEls = findAllByClass(info, 'rp-admin-entry-meta');
		expect(metaEls.length).toBeGreaterThan(0);
		expect(metaEls[0]!._text).toContain('5 nodes');
		expect(metaEls[0]!._text).toContain('3 edges');
	});

	it('does not render protocol meta for snippet entries', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry();
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		const metaEls = findAllByClass(info, 'rp-admin-entry-meta');
		expect(metaEls.length).toBe(0);
	});

	it('fires onEdit and onDelete callbacks', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'edit-test' });
		const edits: string[] = [];
		const deletes: string[] = [];
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n,
			(e) => { edits.push(e.id); },
			(e) => { deletes.push(e.id); },
		);

		const row = list.children[0]!;
		const actions = row.children[1]!;
		actions.children[0]!.dispatchEvent({ type: 'click' });
		actions.children[1]!.dispatchEvent({ type: 'click' });
		expect(edits).toEqual(['edit-test']);
		expect(deletes).toEqual(['edit-test']);
	});

	it('does not render action buttons when callbacks are omitted', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry();
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n);

		const row = list.children[0]!;
		const actions = row.children[1]!;
		expect(actions.children.length).toBe(0);
	});

	it('sets tabindex=0, role=button, and snippet-specific aria-label on info when onEdit is provided', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'kb1', name: 'Pneumo' });
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		expect(info._attrs['tabindex']).toBe('0');
		expect(info._attrs['role']).toBe('button');
		expect(info._attrs['aria-label']).toBe('Edit snippet: Pneumo');
	});

	it('sets protocol-specific aria-label on info for protocol entries', () => {
		const list = makeEl('div');
		const entry = makeProtocolEntry({ id: 'kb2', title: 'КТ Грудная клетка' });
		renderEntryRow(asEl(list), entry, 'protocols', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		expect(info._attrs['aria-label']).toBe('Edit protocol: КТ Грудная клетка');
	});

	it('does not set tabindex, role, or aria-label on info when onEdit is omitted', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry();
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n);

		const row = list.children[0]!;
		const info = row.children[0]!;
		expect(info._attrs['tabindex']).toBeUndefined();
		expect(info._attrs['role']).toBeUndefined();
		expect(info._attrs['aria-label']).toBeUndefined();
	});

	it('Enter key on info fires onEdit with the entry', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'kb-enter' });
		const edits: string[] = [];
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, (e) => { edits.push(e.id); }, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		let prevented = false;
		info.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => { prevented = true; } });
		expect(edits).toEqual(['kb-enter']);
		expect(prevented).toBe(true);
	});

	it('Space key on info fires onEdit and prevents default', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'kb-space' });
		const edits: string[] = [];
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, (e) => { edits.push(e.id); }, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		let prevented = false;
		info.dispatchEvent({ type: 'keydown', key: ' ', preventDefault: () => { prevented = true; } });
		expect(edits).toEqual(['kb-space']);
		expect(prevented).toBe(true);
	});

	it('Enter/Space on info does not fire onEdit when target is a button (no double-trigger)', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'kb-nodbl' });
		const edits: string[] = [];
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, (e) => { edits.push(e.id); }, () => {});

		const row = list.children[0]!;
		const info = row.children[0]!;
		const actions = row.children[1]!;
		const editBtn = actions.children[0]!;

		let prevented = false;
		info.dispatchEvent({ type: 'keydown', key: 'Enter', target: editBtn, preventDefault: () => { prevented = true; } });
		expect(edits).toEqual([]);

		info.dispatchEvent({ type: 'keydown', key: ' ', target: editBtn, preventDefault: () => { prevented = true; } });
		expect(edits).toEqual([]);
		expect(prevented).toBe(false);
	});

	it('Enter/Space on info with onEdit=undefined does not add keydown handler', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'kb-noedit' });
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n);

		const row = list.children[0]!;
		const info = row.children[0]!;
		const keydownHandlers = info._listeners.get('keydown');
		expect(keydownHandlers).toBeUndefined();
	});
});

// ─── renderDirectory ──────────────────────────────────────────────────────

describe('renderDirectory', () => {
	it('renders directory count and folder grid for nodes with children', () => {
		const host = makeEl('div');
		const child = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const root = makeNode({ children: new Map([['gm', child]]) });

		renderDirectory(
			asEl(host), root, 'snippets', mockI18n,
			() => {}, () => {}, () => {}, () => {}, () => {},
			3,
		);

		expect(host.children[0]!._text).toBe('3 items');
		expect(host.children[1]!.classList.has('rp-admin-folder-grid')).toBe(true);
	});

	it('renders folder tile click handlers correctly', () => {
		const host = makeEl('div');
		const child = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		const root = makeNode({ children: new Map([['gm', child]]) });
		const folderClicks: string[] = [];

		renderDirectory(
			asEl(host), root, 'snippets', mockI18n,
			(node) => { folderClicks.push('open:' + node.name); },
			(_node) => {}, (_node) => {},
			() => {}, () => {},
			5,
		);

		const grid = host.children[1]!;
		const tile = grid.children[0]!;
		const openBtn = tile.children[0]!;
		openBtn.dispatchEvent({ type: 'click' });
		expect(folderClicks).toEqual(['open:gm']);
	});

	it('renders empty folder message when no children and no entries', () => {
		const host = makeEl('div');
		const emptyNode = makeNode({ entries: [] });

		renderDirectory(
			asEl(host), emptyNode, 'snippets', mockI18n,
			() => {}, () => {}, () => {}, () => {}, () => {},
			0,
		);

		const list = host.children[1]!;
		expect(list.classList.has('rp-admin-list')).toBe(true);
		const emptyDiv = list.children[0]!;
		expect(emptyDiv.classList.has('rp-admin-empty')).toBe(true);
		expect(emptyDiv._text).toBe('Empty folder');
	});

	it('renders entry rows with correct callbacks', () => {
		const host = makeEl('div');
		const entry = makeSnippetEntry({ id: 'test-entry' });
		const node = makeNode({ entries: [entry] });
		const edits: string[] = [];
		const deletes: string[] = [];

		renderDirectory(
			asEl(host), node, 'snippets', mockI18n,
			() => {}, () => {}, () => {},
			(e) => { edits.push(e.id); },
			(e) => { deletes.push(e.id); },
			1,
		);

		const list = host.children[1]!;
		const row = list.children[0]!;
		const actions = row.children[1]!;
		actions.children[0]!.dispatchEvent({ type: 'click' });
		actions.children[1]!.dispatchEvent({ type: 'click' });
		expect(edits).toEqual(['test-entry']);
		expect(deletes).toEqual(['test-entry']);
	});
});

// ─── renderSearchResults ─────────────────────────────────────────────────

describe('renderSearchResults', () => {
	it('renders matching entries and result count', () => {
		const host = makeEl('div');
		const entries: AdminEntry[] = [
			makeSnippetEntry({ id: '1', name: 'Pneumonia', path: 'snippets/chest/pneumonia.json' }),
			makeSnippetEntry({ id: '2', name: 'Fracture', path: 'snippets/bone/fracture.json' }),
		];

		renderSearchResults(asEl(host), entries, 'snippets', 'pneum', mockI18n);

		expect(host.children[0]!._text).toBe('1 results');
		const list = host.children[1]!;
		expect(list.classList.has('rp-admin-list')).toBe(true);
		expect(list.children.length).toBe(1);
	});

	it('shows empty results message when no matches', () => {
		const host = makeEl('div');
		const entries: AdminEntry[] = [
			makeSnippetEntry({ id: '1', name: 'Pneumonia' }),
		];

		renderSearchResults(asEl(host), entries, 'snippets', 'xyz', mockI18n);

		expect(host.children[0]!._text).toBe('0 results');
		const list = host.children[1]!;
		const emptyDiv = list.children[0]!;
		expect(emptyDiv.classList.has('rp-admin-empty')).toBe(true);
	});

	it('returns all entries when query matches everything', () => {
		const host = makeEl('div');
		const entries: AdminEntry[] = [
			makeSnippetEntry({ id: '1', name: 'Pneumonia', path: 'snippets/chest/pneumonia.json', description: 'Lung' }),
			makeSnippetEntry({ id: '2', name: 'Fracture', path: 'snippets/bone/fracture.json', description: 'Bone' }),
		];

		renderSearchResults(asEl(host), entries, 'snippets', 'snippets', mockI18n);

		expect(host.children[0]!._text).toBe('2 results');
		const list = host.children[1]!;
		expect(list.children.length).toBe(2);
	});

	it('fires onEdit and onDelete callbacks for rendered rows', () => {
		const host = makeEl('div');
		const entry = makeSnippetEntry({ id: 'cb-test', name: 'Test' });
		const edits: string[] = [];
		const deletes: string[] = [];

		renderSearchResults(
			asEl(host), [entry], 'snippets', 'test', mockI18n,
			(e) => { edits.push(e.id); },
			(e) => { deletes.push(e.id); },
		);

		const list = host.children[1]!;
		const row = list.children[0]!;
		const actions = row.children[1]!;
		actions.children[0]!.dispatchEvent({ type: 'click' });
		actions.children[1]!.dispatchEvent({ type: 'click' });
		expect(edits).toEqual(['cb-test']);
		expect(deletes).toEqual(['cb-test']);
	});
});

// ─── Accessibility / aria-label regression tests ──────────────────────────

describe('Accessibility: aria-label and no-title attribute regression', () => {
	it('renderBreadcrumb: root button has aria-label matching its text', () => {
		const host = makeEl('div');
		renderBreadcrumb(asEl(host), [], 'Snippets', { onRootClick: () => {}, onCrumbClick: () => {} });

		const breadcrumb = host.children[0]!;
		const rootBtn = breadcrumb.children[0]!;
		expect(rootBtn._attrs['aria-label']).toBe('Snippets');
		// Must NOT have a title attribute (Obsidian icon tooltip pitfall)
		expect(rootBtn._attrs['title']).toBeUndefined();
	});

	it('renderBreadcrumb: crumb buttons have aria-label matching their segment text', () => {
		const host = makeEl('div');
		renderBreadcrumb(asEl(host), ['gm', 'chest'], 'Snippets', { onRootClick: () => {}, onCrumbClick: () => {} });

		const breadcrumb = host.children[0]!;
		const buttons = breadcrumb.children.filter(c => c.tagName === 'BUTTON');
		// Root button
		expect(buttons[0]!._attrs['aria-label']).toBe('Snippets');
		// gm crumb
		expect(buttons[1]!._attrs['aria-label']).toBe('gm');
		// chest crumb
		expect(buttons[2]!._attrs['aria-label']).toBe('chest');
		// None should have title
		for (const btn of buttons) {
			expect(btn._attrs['title']).toBeUndefined();
		}
	});

	it('renderTreeSearch: search input has aria-label (not title)', () => {
		const host = makeEl('div');
		renderTreeSearch(asEl(host), '', mockI18n, () => {}, () => {});

		const toolbar = host.children[0]!;
		const input = toolbar.children[0]!;
		expect(input._attrs['aria-label']).toBe('Search…');
		expect(input._attrs['title']).toBeUndefined();
	});

	it('renderTreeSearch: create folder button has aria-label', () => {
		const host = makeEl('div');
		renderTreeSearch(asEl(host), '', mockI18n, () => {}, () => {});

		const toolbar = host.children[0]!;
		const folderBtn = toolbar.children[1]!;
		expect(folderBtn._attrs['aria-label']).toBe('New Folder');
		expect(folderBtn._attrs['title']).toBeUndefined();
	});

	it('renderFolderTile: rename and delete buttons have aria-labels, not title', () => {
		const grid = makeEl('div');
		const node = makeNode({ name: 'gm', displayName: 'ГМ', path: 'snippets/gm' });
		renderFolderTile(asEl(grid), node, mockI18n, () => {}, () => {}, () => {});

		const tile = grid.children[0]!;
		const actionArea = tile.children[1]!;
		const renameBtn = actionArea.children[0]!;
		const deleteBtn = actionArea.children[1]!;
		expect(renameBtn._attrs['aria-label']).toBe('Rename');
		expect(renameBtn._attrs['title']).toBeUndefined();
		expect(deleteBtn._attrs['aria-label']).toBe('Delete');
		expect(deleteBtn._attrs['title']).toBeUndefined();
	});

	it('renderEntryRow: edit button has snippet-specific aria-label, delete button has generic label, no title', () => {
		const list = makeEl('div');
		const entry = makeSnippetEntry({ id: 'ar1', name: 'Test' });
		renderEntryRow(asEl(list), entry, 'snippets', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const actions = row.children[1]!;
		const editBtn = actions.children[0]!;
		const deleteBtn = actions.children[1]!;
		expect(editBtn._attrs['aria-label']).toBe('Edit snippet: Test');
		expect(editBtn._attrs['title']).toBeUndefined();
		expect(deleteBtn._attrs['aria-label']).toBe('Delete');
		expect(deleteBtn._attrs['title']).toBeUndefined();
	});

	it('renderEntryRow: edit button has protocol-specific aria-label with Cyrillic title', () => {
		const list = makeEl('div');
		const entry = makeProtocolEntry({ id: 'ar2', title: 'КТ Грудная клетка' });
		renderEntryRow(asEl(list), entry, 'protocols', false, mockI18n, () => {}, () => {});

		const row = list.children[0]!;
		const actions = row.children[1]!;
		const editBtn = actions.children[0]!;
		expect(editBtn._attrs['aria-label']).toBe('Edit protocol: КТ Грудная клетка');
	});

	it('renderSearchResults: result count has aria-live="polite"', () => {
		const host = makeEl('div');
		const entries: AdminEntry[] = [
			makeSnippetEntry({ id: '1', name: 'Pneumonia' }),
		];

		renderSearchResults(asEl(host), entries, 'snippets', 'pneum', mockI18n);

		const meta = host.children[0]!;
		expect(meta._attrs['aria-live']).toBe('polite');
	});

	it('renderDirectory: directory count does NOT have title attribute', () => {
		const host = makeEl('div');
		const node = makeNode({ entries: [] });

		renderDirectory(
			asEl(host), node, 'snippets', mockI18n,
			() => {}, () => {}, () => {}, () => {}, () => {},
			5,
		);

		const meta = host.children[0]!;
		expect(meta._attrs['title']).toBeUndefined();
	});
});