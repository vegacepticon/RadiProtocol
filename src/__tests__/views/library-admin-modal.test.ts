import { describe, it, expect, vi } from 'vitest';

// ─── MockEl (self-contained, minimal) ───────────────────────────────────────

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
	setAttr: (name: string, value: string) => void;
	getAttribute: (k: string) => string | null;
	addEventListener: (type: string, handler: (ev: unknown) => void) => void;
	dispatchEvent: (event: { type: string; [key: string]: unknown }) => void;
	querySelectorAll: (sel: string) => MockEl[];
	querySelector: (sel: string) => MockEl | null;
	focus: () => void;
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
		setAttr(name: string, value: string): void { attrs[name] = value; },
		getAttribute(k: string): string | null { return attrs[k] ?? null; },
		addEventListener(type: string, handler: (ev: unknown) => void): void {
			const arr = listeners.get(type) ?? [];
			arr.push(handler);
			listeners.set(type, arr);
		},
		dispatchEvent(event: { type: string; [key: string]: unknown }): void {
			for (const h of listeners.get(event.type) ?? []) h(event);
		},
		querySelectorAll(sel: string): MockEl[] {
			const results: MockEl[] = [];
			function walk(node: MockEl): void {
				if (sel.startsWith('.') && node.classList.has(sel.slice(1))) results.push(node);
				else if (sel.startsWith('#') && node._attrs['id'] === sel.slice(1)) results.push(node);
				for (const child of node.children) walk(child);
			}
			walk(el);
			return results;
		},
		querySelector(sel: string): MockEl | null {
			const all = el.querySelectorAll(sel);
			return all.length > 0 ? all[0]! : null;
		},
		focus(): void {},
	};
	return el;
}

// ─── Mock obsidian (minimal — just Modal, Setting, Notice) ──────────────────

vi.mock('obsidian', () => {
	class Modal {
		app = {};
		contentEl = makeEl('div');
		titleEl = makeEl('div');
		containerEl = makeEl('div');
		modalEl = makeEl('div');
		constructor(_app: unknown) {}
		open() {}
		close() {}
		onOpen() {}
		onClose() {}
	}
	class Setting {
		constructor(_parentEl: unknown) {}
		setName() { return this; }
		setDesc() { return this; }
		addButton() { return this; }
		addText() { return this; }
		setCta() { return this; }
		setDisabled() { return this; }
	}
	class Notice { constructor(_m: string) {} }
	class TFile { path = ''; extension = ''; basename = ''; constructor(p = '') { this.path = p; } }
	class TFolder { path = ''; name = ''; children: unknown[] = []; constructor(p = '') { this.path = p; this.name = p.split('/').pop() ?? ''; } }
	class AbstractInputSuggest {
		app: unknown;
		inputEl: unknown;
		constructor(app: unknown, inputEl: unknown) { this.app = app; this.inputEl = inputEl; }
		setValue(_v: string): void {}
		open(): void {}
		close(): void {}
	}
	return { Modal, Setting, Notice, TFile, TFolder, App: class {}, AbstractInputSuggest };
});

vi.mock('../../views/library-admin/helper-modals', () => ({
	SendToRemoteModal: class { constructor() {} open() {} },
	TextPromptModal: { prompt: vi.fn().mockResolvedValue(null) },
	TypeConfirmModal: { prompt: vi.fn().mockResolvedValue(false) },
	ImportSnippetPickerModal: class { constructor() {} open() {} },
	ImportProtocolPickerModal: class { constructor() {} open() {} },
	ImportDetailsModal: class { constructor() {} open() {} },
	EditProtocolMetadataModal: class { constructor() {} open() {} },
}));

vi.mock('../../snippets/library-admin', () => ({
	LibraryAdminService: class {
		async validateRepoPath() { return { valid: true }; }
		async listDirectories() { return []; }
		async readSnippetIndex() { return { snippets: [] }; }
		async readProtocolIndex() { return { protocols: [] }; }
		async readDirectoryDisplayName() { return null; }
		resolveRepoPathPublic(p: string) { return p; }
	},
}));

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

(globalThis as any).window = globalThis;
(globalThis as any).document = { createElement: (_tag: string) => makeEl(_tag) };

import { LibraryAdminModal } from '../../views/library-admin-modal';
import { TextPromptModal } from '../../views/library-admin/helper-modals';

const mockI18n = (key: string, _params?: Record<string, string>): string => {
	const map: Record<string, string> = {
		'admin.title': 'Library Admin',
		'admin.snippetsTab': 'Snippets',
		'admin.protocolsTab': 'Protocols',
		'admin.resetToRemote': 'Reset to remote',
		'admin.sendToRemote': 'Send to remote',
		'admin.maintainerModeDisabled': 'Maintainer mode is not enabled.',
		'admin.enableInSettings': 'Enable maintainer mode.',
		'admin.noRepoPath': 'No repo path.',
		'admin.setRepoInSettings': 'Set repo path.',
		'admin.invalidRepo': 'Invalid repo.',
		'admin.importSnippet': 'Import snippet',
		'admin.importSnippetDesc': 'Import a snippet.',
		'admin.importSnippetBtn': 'Import',
		'confirm.cancel': 'Cancel',
	};
	return map[key] ?? key;
};

function makePlugin() {
	return {
		settings: {
			libraryMaintainerMode: true,
			libraryRepoPath: '/test/repo',
			snippetFolderPath: '.radiprotocol/snippets',
		},
		i18n: { t: mockI18n },
	} as any;
}

function makeApp() {
	return {
		vault: {
			getAbstractFileByPath: vi.fn().mockReturnValue(null),
		},
		workspace: {
			on: vi.fn().mockReturnValue({ ref: '' }),
		},
	} as any;
}

function fireKeyDown(el: MockEl, key: string): void {
	for (const h of el._listeners.get('keydown') ?? []) {
		h({ key, preventDefault: () => {}, stopPropagation: () => {} });
	}
}

function setupModal(currentTab: 'snippets' | 'protocols' = 'snippets'): {
	modal: LibraryAdminModal;
	contentEl: MockEl;
	snippetTab: MockEl;
	protocolTab: MockEl;
	tabContainer: MockEl;
	contentArea: MockEl;
} {
	const plugin = makePlugin();
	const app = makeApp();
	const modal = new LibraryAdminModal(app, plugin);
	(modal as any).currentTab = currentTab;
	(modal as any).admin = {
		validateRepoPath: vi.fn().mockResolvedValue({ valid: true }),
		listDirectories: vi.fn().mockResolvedValue([]),
		readSnippetIndex: vi.fn().mockResolvedValue({ snippets: [] }),
		readProtocolIndex: vi.fn().mockResolvedValue({ protocols: [] }),
		readDirectoryDisplayName: vi.fn().mockResolvedValue(null),
		resolveRepoPathPublic: vi.fn((p: string) => p),
	};

	const contentEl = makeEl('div');
	(modal as any).renderAdmin(contentEl);

	const tabContainer = contentEl.children.find((c: MockEl) => c.classList.has('rp-admin-tabs'))!;
	const snippetTab = tabContainer.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
	const protocolTab = tabContainer.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
	const contentArea = contentEl.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-content')!;

	return { modal, contentEl, snippetTab, protocolTab, tabContainer, contentArea };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LibraryAdminModal — tab keyboard navigation', () => {
	it('ArrowRight on snippets tab switches currentTab to protocols', () => {
		const { modal, snippetTab } = setupModal('snippets');
		fireKeyDown(snippetTab, 'ArrowRight');
		expect((modal as any).currentTab).toBe('protocols');
	});

	it('ArrowLeft on protocols tab switches currentTab to snippets', () => {
		const { modal, protocolTab } = setupModal('protocols');
		fireKeyDown(protocolTab, 'ArrowLeft');
		expect((modal as any).currentTab).toBe('snippets');
	});

	it('initial render: tab container has role=tablist', () => {
		const { tabContainer } = setupModal('snippets');
		expect(tabContainer._attrs['role']).toBe('tablist');
	});

	it('initial render: snippet tab has correct ARIA attributes', () => {
		const { snippetTab } = setupModal('snippets');
		expect(snippetTab._attrs['role']).toBe('tab');
		expect(snippetTab._attrs['id']).toBe('rp-admin-tab-snippets');
		expect(snippetTab._attrs['aria-selected']).toBe('true');
		expect(snippetTab._attrs['tabindex']).toBe('0');
		expect(snippetTab._attrs['aria-controls']).toBe('rp-admin-content');
	});

	it('initial render: protocol tab has correct ARIA attributes', () => {
		const { protocolTab } = setupModal('snippets');
		expect(protocolTab._attrs['role']).toBe('tab');
		expect(protocolTab._attrs['id']).toBe('rp-admin-tab-protocols');
		expect(protocolTab._attrs['aria-selected']).toBe('false');
		expect(protocolTab._attrs['tabindex']).toBe('-1');
	});

	it('initial render: content area has role=tabpanel and aria-labelledby', () => {
		const { contentArea } = setupModal('snippets');
		expect(contentArea._attrs['role']).toBe('tabpanel');
		expect(contentArea._attrs['aria-labelledby']).toBe('rp-admin-tab-snippets');
	});

	it('after ArrowRight: ARIA attributes update to protocols tab active', () => {
		const { modal, contentEl } = setupModal('snippets');

		// Dispatch keydown on the snippet tab (captured during setup)
		const snippetTab = contentEl.querySelectorAll('.rp-admin-tab').find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		fireKeyDown(snippetTab, 'ArrowRight');

		expect((modal as any).currentTab).toBe('protocols');

		const tabsAfter = contentEl.querySelectorAll('.rp-admin-tab');
		const snippetTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		const protocolTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		const contentAreaAfter = contentEl.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-content')!;

		expect(snippetTabAfter._attrs['aria-selected']).toBe('false');
		expect(snippetTabAfter._attrs['tabindex']).toBe('-1');
		expect(protocolTabAfter._attrs['aria-selected']).toBe('true');
		expect(protocolTabAfter._attrs['tabindex']).toBe('0');
		expect(contentAreaAfter._attrs['aria-labelledby']).toBe('rp-admin-tab-protocols');
	});

	it('after ArrowLeft: ARIA attributes update to snippets tab active', () => {
		const { modal, contentEl } = setupModal('protocols');

		const protocolTab = contentEl.querySelectorAll('.rp-admin-tab').find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		fireKeyDown(protocolTab, 'ArrowLeft');

		expect((modal as any).currentTab).toBe('snippets');

		const tabsAfter = contentEl.querySelectorAll('.rp-admin-tab');
		const snippetTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		const protocolTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		const contentAreaAfter = contentEl.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-content')!;

		expect(snippetTabAfter._attrs['aria-selected']).toBe('true');
		expect(snippetTabAfter._attrs['tabindex']).toBe('0');
		expect(protocolTabAfter._attrs['aria-selected']).toBe('false');
		expect(protocolTabAfter._attrs['tabindex']).toBe('-1');
		expect(contentAreaAfter._attrs['aria-labelledby']).toBe('rp-admin-tab-snippets');
	});

	it('Home key on protocols tab activates snippets tab', () => {
		const { modal, contentEl } = setupModal('protocols');
		const protocolTab = contentEl.querySelectorAll('.rp-admin-tab').find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		fireKeyDown(protocolTab, 'Home');
		expect((modal as any).currentTab).toBe('snippets');
	});

	it('End key on snippets tab activates protocols tab', () => {
		const { modal, contentEl } = setupModal('snippets');
		const snippetTab = contentEl.querySelectorAll('.rp-admin-tab').find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		fireKeyDown(snippetTab, 'End');
		expect((modal as any).currentTab).toBe('protocols');
	});

	it('Home key on protocols tab updates ARIA attributes to snippets', () => {
		const { contentEl } = setupModal('protocols');
		const protocolTab = contentEl.querySelectorAll('.rp-admin-tab').find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		fireKeyDown(protocolTab, 'Home');

		const tabsAfter = contentEl.querySelectorAll('.rp-admin-tab');
		const snippetTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		const protocolTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		const contentAreaAfter = contentEl.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-content')!;

		expect(snippetTabAfter._attrs['aria-selected']).toBe('true');
		expect(snippetTabAfter._attrs['tabindex']).toBe('0');
		expect(protocolTabAfter._attrs['aria-selected']).toBe('false');
		expect(protocolTabAfter._attrs['tabindex']).toBe('-1');
		expect(contentAreaAfter._attrs['aria-labelledby']).toBe('rp-admin-tab-snippets');
	});

	it('End key on snippets tab updates ARIA attributes to protocols', () => {
		const { contentEl } = setupModal('snippets');
		const snippetTab = contentEl.querySelectorAll('.rp-admin-tab').find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		fireKeyDown(snippetTab, 'End');

		const tabsAfter = contentEl.querySelectorAll('.rp-admin-tab');
		const snippetTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-snippets')!;
		const protocolTabAfter = tabsAfter.find((c: MockEl) => c._attrs['id'] === 'rp-admin-tab-protocols')!;
		const contentAreaAfter = contentEl.children.find((c: MockEl) => c._attrs['id'] === 'rp-admin-content')!;

		expect(snippetTabAfter._attrs['aria-selected']).toBe('false');
		expect(snippetTabAfter._attrs['tabindex']).toBe('-1');
		expect(protocolTabAfter._attrs['aria-selected']).toBe('true');
		expect(protocolTabAfter._attrs['tabindex']).toBe('0');
		expect(contentAreaAfter._attrs['aria-labelledby']).toBe('rp-admin-tab-protocols');
	});
});

describe('LibraryAdminModal — folder rename navigation', () => {
	it('preserves drillPath after renaming a directory (does not navigate into renamed folder)', async () => {
		const plugin = makePlugin();
		const app = makeApp();
		const modal = new LibraryAdminModal(app, plugin);
		(modal as any).currentTab = 'snippets';
		const renameDirectory = vi.fn().mockResolvedValue({ name: 'renamed-cat', path: 'snippets/renamed-cat' });
		(modal as any).admin = {
			validateRepoPath: vi.fn().mockResolvedValue({ valid: true }),
			listDirectories: vi.fn().mockResolvedValue([]),
			readSnippetIndex: vi.fn().mockResolvedValue({ snippets: [] }),
			readProtocolIndex: vi.fn().mockResolvedValue({ protocols: [] }),
			readDirectoryDisplayName: vi.fn().mockResolvedValue(null),
			resolveRepoPathPublic: vi.fn((p: string) => p),
			renameDirectory,
		};
		const refreshAdmin = vi.fn();
		(modal as any).refreshAdmin = refreshAdmin;
		vi.mocked(TextPromptModal.prompt).mockResolvedValueOnce('New Cat');

		// Simulate user being drilled into the snippets root (drillPath empty = root view)
		(modal as any).drillPath = [];

		await (modal as any).handleRenameDirectory('snippets', 'snippets/old-cat', 'Old Cat');

		expect(renameDirectory).toHaveBeenCalledWith('snippets', 'snippets/old-cat', 'New Cat');
		expect(refreshAdmin).toHaveBeenCalledOnce();
		expect((modal as any).drillPath).toEqual([]);
	});

	it('preserves drillPath when drilled into a parent folder and renaming a sibling', async () => {
		const plugin = makePlugin();
		const app = makeApp();
		const modal = new LibraryAdminModal(app, plugin);
		(modal as any).currentTab = 'snippets';
		const renameDirectory = vi.fn().mockResolvedValue({ name: 'new-name', path: 'snippets/chest/new-name' });
		(modal as any).admin = {
			renameDirectory,
		};
		const refreshAdmin = vi.fn();
		(modal as any).refreshAdmin = refreshAdmin;
		vi.mocked(TextPromptModal.prompt).mockResolvedValueOnce('New Name');

		// User is inside snippets/chest
		(modal as any).drillPath = ['chest'];

		await (modal as any).handleRenameDirectory('snippets', 'snippets/chest/old-name', 'Old Name');

		expect(renameDirectory).toHaveBeenCalledWith('snippets', 'snippets/chest/old-name', 'New Name');
		expect(refreshAdmin).toHaveBeenCalledOnce();
		// drillPath should still be ['chest'] — rename of a sibling should not change position
		expect((modal as any).drillPath).toEqual(['chest']);
	});
});

describe('LibraryAdminModal — cancel button localization', () => {
	it('uses the translated cancel label for the create folder prompt', async () => {
		const plugin = makePlugin();
		const app = makeApp();
		const modal = new LibraryAdminModal(app, plugin);
		(modal as any).admin = { createDirectory: vi.fn() };
		vi.mocked(TextPromptModal.prompt).mockResolvedValueOnce(null);

		await (modal as any).handleCreateDirectory('snippets');

		expect(TextPromptModal.prompt).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ cancelText: 'Cancel' }),
		);
	});

	it('uses the translated cancel label for the rename folder prompt', async () => {
		const plugin = makePlugin();
		const app = makeApp();
		const modal = new LibraryAdminModal(app, plugin);
		(modal as any).admin = { renameDirectory: vi.fn() };
		vi.mocked(TextPromptModal.prompt).mockResolvedValueOnce(null);

		await (modal as any).handleRenameDirectory('snippets', 'snippets/chest', 'Chest');

		expect(TextPromptModal.prompt).toHaveBeenCalledWith(
			expect.any(Object),
			expect.objectContaining({ cancelText: 'Cancel' }),
		);
	});
});