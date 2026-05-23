import { describe, it, expect, vi } from 'vitest';
import { LibraryBrowserModal, buildLibraryTree } from '../../views/library-browser-modal';
import type { LibrarySnippetEntry } from '../../snippets/library-model';

// ---------------------------------------------------------------------------
// Traversable MockEl — matches the pattern in library-admin-renderers.test.ts
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
	disabled: boolean;
	createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string | number | boolean> }) => MockEl;
	createDiv: (opts?: { cls?: string; text?: string; attr?: Record<string, string | number | boolean> }) => MockEl;
	empty: () => void;
	setText: (text: string) => void;
	addClass: (cls: string) => void;
	removeClass: (cls: string) => void;
	setAttribute: (k: string, v: string) => void;
	getAttribute: (k: string) => string | null;
	addEventListener: (type: string, handler: (ev: unknown) => void) => void;
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
		disabled: false,
		createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string | number | boolean> }): MockEl {
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
		createDiv(opts?: { cls?: string; text?: string; attr?: Record<string, string | number | boolean> }): MockEl {
			return el.createEl('div', opts as { text?: string; cls?: string; attr?: Record<string, string | number | boolean> } | undefined);
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
	};
	return el;
}

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

// ---------------------------------------------------------------------------
// Mock dom-helpers to use MockEl
// ---------------------------------------------------------------------------

vi.mock('../../utils/dom-helpers', () => ({
	createButton: (parent: MockEl, opts: { cls?: string; text?: string; attr?: Record<string, string | number | boolean> } = {}): MockEl => {
		return parent.createEl('button', { cls: opts.cls, text: opts.text, attr: opts.attr });
	},
	createInput: (parent: MockEl, opts: { cls?: string; type?: string; placeholder?: string; value?: string; attr?: Record<string, string | number | boolean> } = {}): MockEl => {
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

// ---------------------------------------------------------------------------
// Mock obsidian (Modal base class, Notice, etc.)
// ---------------------------------------------------------------------------

const mockContentEl = makeEl('div');
const mockTitleEl = makeEl('div');
const mockModalEl = makeEl('div');

vi.mock('obsidian', () => ({
	Modal: class {
		app = {};
		contentEl = mockContentEl;
		titleEl = mockTitleEl;
		modalEl = mockModalEl;
		open() {}
		close() {}
		onOpen() {}
		onClose() {}
	},
	App: class {},
	Notice: class { constructor() {} },
}));

// ---------------------------------------------------------------------------
// Mock LibrarySnippetPreviewModal (imported by library-browser-modal)
// ---------------------------------------------------------------------------

vi.mock('../../views/library-snippet-preview-modal', () => ({
	LibrarySnippetPreviewModal: class { constructor() {} open() {} },
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testEntries: LibrarySnippetEntry[] = [
	{ id: 'chest-atelectasis', name: 'Atelectasis', category: 'Chest/CT', path: 'snippets/chest/ct/atelectasis.json', description: 'Chest / CT / Atelectasis' },
	{ id: 'gm-ateroskleroz', name: 'АТЕРОСКЛЕРОЗ', category: 'ГМ', path: 'snippets/gm/ateroskleroz.json', description: 'ГМ / АТЕРОСКЛЕРОЗ' },
];

// ---------------------------------------------------------------------------
// Localized translator for aria-label assertions
// ---------------------------------------------------------------------------

const enT = (key: string, params?: Record<string, string>): string => {
	const map: Record<string, string> = {
		'library.title': 'Snippet Library',
		'library.searchPlaceholder': 'Search snippets…',
		'library.installAll': 'Install full library',
		'library.installCurrentFolder': 'Install current folder',
		'library.root': 'Library',
		'library.directoryCount': params ? `${params.count} snippets` : '0 snippets',
		'library.empty': 'No snippets found in this folder.',
		'library.emptyResults': 'No snippets match your search.',
		'library.searchResults': params ? `${params.count} results` : '0 results',
		'library.preview': 'Preview',
		'library.install': 'Install',
		'library.previewAria': params ? `Preview snippet ${params.name}` : 'Preview snippet',
		'library.installAria': params ? `Install snippet ${params.name}` : 'Install snippet',
		'library.openFolderAria': params ? `Open folder ${params.name}` : 'Open folder',
		'library.installAllAria': 'Install full library',
		'library.installCurrentFolderAria': 'Install current folder',
	};
	return map[key] ?? key;
};

// ---------------------------------------------------------------------------
// Helper to create a modal with mocked plugin and call render methods
// ---------------------------------------------------------------------------

function createModalForRender(): {
	modal: LibraryBrowserModal;
	contentEl: MockEl;
} {
	const tree = buildLibraryTree(testEntries);

	const contentEl = makeEl('div');
	const titleEl = makeEl('div');
	const modalEl = makeEl('div');

	const mockPlugin = {
		i18n: { t: enT },
		libraryService: {
			fetchIndex: vi.fn().mockResolvedValue({ version: '1.0.0', snippets: testEntries }),
			fetchSnippetPreview: vi.fn(),
			installSnippet: vi.fn(),
			installSnippets: vi.fn(),
		},
		settings: {},
	};

	const modal = new LibraryBrowserModal({} as any, mockPlugin as any);

	// Override internal state
	(modal as any).contentEl = contentEl;
	(modal as any).titleEl = titleEl;
	(modal as any).modalEl = modalEl;
	(modal as any).tree = tree;
	(modal as any).allEntries = testEntries;
	(modal as any).drillPath = [];
	(modal as any).currentQuery = '';
	(modal as any).busy = false;

	return { modal, contentEl };
}

// ---------------------------------------------------------------------------
// aria-label regression tests
// ---------------------------------------------------------------------------

describe('LibraryBrowserModal: aria-label regression tests', () => {
	it('renderToolbar: install-all button has aria-label', () => {
		const { modal } = createModalForRender();
		const host = makeEl('div');
		(modal as any).renderToolbar(host);

		const btns = findAllByClass(host, 'rp-library-install-all-btn');
		expect(btns.length).toBeGreaterThanOrEqual(1);
		expect(btns[0]!._attrs['aria-label']).toBe('Install full library');
	});

	it('renderToolbar: install-folder button has aria-label', () => {
		const { modal } = createModalForRender();
		const host = makeEl('div');
		(modal as any).renderToolbar(host);

		const btns = findAllByClass(host, 'rp-library-install-folder-btn');
		expect(btns.length).toBeGreaterThanOrEqual(1);
		expect(btns[0]!._attrs['aria-label']).toBe('Install current folder');
	});

	it('renderFolderRow: folder button has aria-label with folder name', () => {
		const { modal } = createModalForRender();
		const tree = (modal as any).tree;
		const chestNode = tree.children.get('Chest');
		expect(chestNode).toBeTruthy();

		const host = makeEl('div');
		(modal as any).renderFolderRow(host, chestNode);

		const rows = findAllByClass(host, 'rp-library-folder-row');
		expect(rows.length).toBeGreaterThanOrEqual(1);
		expect(rows[0]!._attrs['aria-label']).toBe('Open folder Chest');
	});

	it('renderEntryRow: preview button has aria-label with snippet name', () => {
		const { modal } = createModalForRender();
		const entry = testEntries[0]!;
		const host = makeEl('div');
		(modal as any).renderEntryRow(host, entry, false);

		const btns = findAllByClass(host, 'rp-library-preview-btn');
		expect(btns.length).toBeGreaterThanOrEqual(1);
		expect(btns[0]!._attrs['aria-label']).toBe('Preview snippet Atelectasis');
	});

	it('renderEntryRow: install button has aria-label with snippet name', () => {
		const { modal } = createModalForRender();
		const entry = testEntries[0]!;
		const host = makeEl('div');
		(modal as any).renderEntryRow(host, entry, false);

		const btns = findAllByClass(host, 'rp-library-install-btn');
		expect(btns.length).toBeGreaterThanOrEqual(1);
		expect(btns[0]!._attrs['aria-label']).toBe('Install snippet Atelectasis');
	});

	it('renderEntryRow: preview and install buttons have localized aria-labels for Cyrillic names', () => {
		const { modal } = createModalForRender();
		const entry = testEntries[1]!; // АТЕРОСКЛЕРОЗ
		const host = makeEl('div');
		(modal as any).renderEntryRow(host, entry, true);

		const previewBtns = findAllByClass(host, 'rp-library-preview-btn');
		expect(previewBtns[0]!._attrs['aria-label']).toBe('Preview snippet АТЕРОСКЛЕРОЗ');

		const installBtns = findAllByClass(host, 'rp-library-install-btn');
		expect(installBtns[0]!._attrs['aria-label']).toBe('Install snippet АТЕРОСКЛЕРОЗ');
	});

	it('renderToolbar: neither install button has a title attribute', () => {
		const { modal } = createModalForRender();
		const host = makeEl('div');
		(modal as any).renderToolbar(host);

		const allBtn = findAllByClass(host, 'rp-library-install-all-btn')[0]!;
		const folderBtn = findAllByClass(host, 'rp-library-install-folder-btn')[0]!;
		expect(allBtn._attrs['title']).toBeUndefined();
		expect(folderBtn._attrs['title']).toBeUndefined();
	});

	it('renderEntryRow: preview and install buttons have no title attribute', () => {
		const { modal } = createModalForRender();
		const entry = testEntries[0]!;
		const host = makeEl('div');
		(modal as any).renderEntryRow(host, entry, false);

		const previewBtn = findAllByClass(host, 'rp-library-preview-btn')[0]!;
		const installBtn = findAllByClass(host, 'rp-library-install-btn')[0]!;
		expect(previewBtn._attrs['title']).toBeUndefined();
		expect(installBtn._attrs['title']).toBeUndefined();
	});

	it('renderFolderRow: folder button has no title attribute', () => {
		const { modal } = createModalForRender();
		const tree = (modal as any).tree;
		const chestNode = tree.children.get('Chest')!;

		const host = makeEl('div');
		(modal as any).renderFolderRow(host, chestNode);

		const row = findAllByClass(host, 'rp-library-folder-row')[0]!;
		expect(row._attrs['title']).toBeUndefined();
	});
});