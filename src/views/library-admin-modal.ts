// views/library-admin-modal.ts
// Admin UI for managing the local RadiProtocol-Library repo.
// Import from vault, edit metadata, delete, validate, regenerate indexes.
import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { LibraryAdminService } from '../snippets/library-admin';
import type { LibraryAdminSection } from '../snippets/library-admin';
import type { LibrarySnippetEntry } from '../snippets/library-model';
import type { ProtocolLibraryEntry } from '../protocol/protocol-library-model';
import { renderBreadcrumb } from './library-admin/breadcrumb';
import { renderTreeSearch } from './library-admin/search';
import { renderDirectory, renderSearchResults } from './library-admin/tree-renderer';
import {
	SendToRemoteModal,
	TextPromptModal,
	TypeConfirmModal,
	ImportSnippetPickerModal,
	ImportProtocolPickerModal,
	ImportDetailsModal,
	EditSnippetMetadataModal,
	EditProtocolMetadataModal,
} from './library-admin/helper-modals';
import { SEARCH_DEBOUNCE_MS, buildAdminTree, findNodeByDrillPath, collectEntries } from './library-admin/types';
import type { AdminEntry } from './library-admin/types';

type TabId = LibraryAdminSection;

export class LibraryAdminModal extends Modal {
	private plugin: RadiProtocolPlugin;
	private admin: LibraryAdminService | null = null;
	private currentTab: TabId = 'snippets';
	private statusEl: HTMLElement;
	private drillPath: string[] = [];
	private currentQuery = '';
	private searchInputEl: HTMLInputElement | null = null;
	private searchDebounceTimer: number | null = null;

	constructor(app: App, plugin: RadiProtocolPlugin) {
		super(app);
		this.plugin = plugin;
		this.containerEl.addClass('rp-library-admin-modal');
		this.modalEl.addClass('rp-library-admin-modal-container');
		this.statusEl = document.createElement('div');
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Check maintainer mode and repo path
		if (!this.plugin.settings.libraryMaintainerMode) {
			contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });
			contentEl.createEl('p', { text: this.plugin.i18n.t('admin.maintainerModeDisabled') });
			contentEl.createEl('p', { text: this.plugin.i18n.t('admin.enableInSettings') });
			return;
		}

		const repoPath = this.plugin.settings.libraryRepoPath?.trim();
		if (!repoPath) {
			contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });
			contentEl.createEl('p', { text: this.plugin.i18n.t('admin.noRepoPath') });
			contentEl.createEl('p', { text: this.plugin.i18n.t('admin.setRepoInSettings') });
			return;
		}

		this.admin = new LibraryAdminService(repoPath, this.plugin.i18n.t.bind(this.plugin.i18n));

		// Validate repo path
		void this.admin.validateRepoPath().then((result) => {
			if (!result.valid) {
				contentEl.empty();
				contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });
				contentEl.createEl('p', { text: this.plugin.i18n.t('admin.invalidRepo') });
				contentEl.createEl('p', { text: result.error ?? 'Unknown error', cls: 'rp-admin-error' });
				return;
			}
			this.renderAdmin(contentEl);
		});
	}

	private renderAdmin(contentEl: HTMLElement): void {
		contentEl.empty();

		// Title
		contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.title') });

		// Toolbar: Reset to remote + Send to remote
		const toolbar = contentEl.createDiv({ cls: 'rp-admin-toolbar' });

		new Setting(toolbar)
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.resetToRemote'))
				.onClick(() => { void this.handleResetToRemote(); }))
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.sendToRemote'))
				.onClick(() => { void this.handleSendToRemote(); }));

		// Status area
		this.statusEl = contentEl.createDiv({ cls: 'rp-admin-status' });

		// Tab selector
		const tabContainer = contentEl.createDiv({ cls: 'rp-admin-tabs', attr: { role: 'tablist' } });
		const snippetTab = tabContainer.createEl('button', {
			text: this.plugin.i18n.t('admin.snippetsTab'),
			cls: 'rp-admin-tab' + (this.currentTab === 'snippets' ? ' rp-admin-tab-active' : ''),
			attr: { role: 'tab', id: 'rp-admin-tab-snippets', tabindex: this.currentTab === 'snippets' ? '0' : '-1', 'aria-selected': String(this.currentTab === 'snippets'), 'aria-controls': 'rp-admin-content' },
		});
		snippetTab.addEventListener('click', () => {
			this.currentTab = 'snippets';
			this.drillPath = [];
			this.clearSearch();
			this.renderAdminContent(contentEl);
		});

		const protocolTab = tabContainer.createEl('button', {
			text: this.plugin.i18n.t('admin.protocolsTab'),
			cls: 'rp-admin-tab' + (this.currentTab === 'protocols' ? ' rp-admin-tab-active' : ''),
			attr: { role: 'tab', id: 'rp-admin-tab-protocols', tabindex: this.currentTab === 'protocols' ? '0' : '-1', 'aria-selected': String(this.currentTab === 'protocols'), 'aria-controls': 'rp-admin-content' },
		});
		protocolTab.addEventListener('click', () => {
			this.currentTab = 'protocols';
			this.drillPath = [];
			this.clearSearch();
			this.renderAdminContent(contentEl);
		});

		const activateTab = (tab: 'snippets' | 'protocols') => {
			this.currentTab = tab;
			this.drillPath = [];
			this.clearSearch();
			this.renderAdminContent(contentEl);
			const target = tab === 'snippets' ? snippetTab : protocolTab;
			target.focus();
		};
		snippetTab.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'ArrowRight' || e.key === 'End') { e.preventDefault(); activateTab('protocols'); }
			else if (e.key === 'Home') { e.preventDefault(); activateTab('snippets'); }
		});
		protocolTab.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'ArrowLeft' || e.key === 'Home') { e.preventDefault(); activateTab('snippets'); }
			else if (e.key === 'End') { e.preventDefault(); activateTab('protocols'); }
		});

		// Content area
		contentEl.createDiv({ cls: 'rp-admin-content', attr: { id: 'rp-admin-content', role: 'tabpanel', 'aria-labelledby': this.currentTab === 'snippets' ? 'rp-admin-tab-snippets' : 'rp-admin-tab-protocols' } });

		this.renderAdminContent(contentEl);
	}

	private renderAdminContent(contentEl: HTMLElement): void {
		const contentArea = contentEl.querySelector('#rp-admin-content') as HTMLElement;
		if (!contentArea) return;
		contentArea.empty();

		// Update tab active states and ARIA attributes
		const tabs = contentEl.querySelectorAll('.rp-admin-tab');
		tabs.forEach((tab) => {
			tab.removeClass('rp-admin-tab-active');
		});
		const activeIdx = this.currentTab === 'snippets' ? 0 : 1;
		tabs[activeIdx]?.addClass('rp-admin-tab-active');
		tabs.forEach((tab, idx) => {
			tab.setAttr('aria-selected', String(idx === activeIdx));
			tab.setAttr('tabindex', idx === activeIdx ? '0' : '-1');
		});
		contentArea.setAttr('aria-labelledby', this.currentTab === 'snippets' ? 'rp-admin-tab-snippets' : 'rp-admin-tab-protocols');

		if (this.currentTab === 'snippets') {
			this.renderSnippetsTab(contentArea);
		} else {
			this.renderProtocolsTab(contentArea);
		}
	}

	private renderSnippetsTab(contentArea: HTMLElement): void {
		new Setting(contentArea)
			.setName(this.plugin.i18n.t('admin.importSnippet'))
			.setDesc(this.plugin.i18n.t('admin.importSnippetDesc'))
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.importSnippetBtn'))
				.onClick(() => { void this.handleImportSnippet(); }));

		void this.renderTreeTab(contentArea, 'snippets');
	}

	private renderProtocolsTab(contentArea: HTMLElement): void {
		new Setting(contentArea)
			.setName(this.plugin.i18n.t('admin.importProtocol'))
			.setDesc(this.plugin.i18n.t('admin.importProtocolDesc'))
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.importProtocolBtn'))
				.onClick(() => { void this.handleImportProtocol(); }));

		void this.renderTreeTab(contentArea, 'protocols');
	}

	private async renderTreeTab(contentArea: HTMLElement, section: LibraryAdminSection): Promise<void> {
		if (!this.admin) return;
		const treeHost = contentArea.createDiv({ cls: 'rp-admin-tree-root' });

		const searchInput = renderTreeSearch(
			treeHost,
			this.currentQuery,
			this.plugin.i18n.t.bind(this.plugin.i18n),
			(value) => {
				this.currentQuery = value;
				if (this.searchDebounceTimer !== null) clearTimeout(this.searchDebounceTimer);
				this.searchDebounceTimer = setTimeout(() => {
					this.searchDebounceTimer = null;
					this.renderAdminContent(this.contentEl);
				}, SEARCH_DEBOUNCE_MS) as unknown as number;
			},
			() => { void this.handleCreateDirectory(section); },
		);
		this.searchInputEl = searchInput;

		const [directories, entries] = await Promise.all([
			this.admin.listDirectories(section),
			this.readSectionEntries(section),
		]);

		const metaDisplayNameBySlug = new Map<string, string>();
		await Promise.all(directories.map(async (dir) => {
			const absPath = this.admin!.resolveRepoPathPublic(dir.path);
			const metaName = await this.admin!.readDirectoryDisplayName(absPath);
			if (metaName !== null) {
				metaDisplayNameBySlug.set(dir.name, metaName);
			}
		}));

		const tree = buildAdminTree(section, directories, entries, metaDisplayNameBySlug, this.slugToDisplayName.bind(this));
		const body = treeHost.createDiv({ cls: 'rp-admin-tree-body' });

		const rootLabel = section === 'snippets' ? this.plugin.i18n.t('admin.snippetsTab') : this.plugin.i18n.t('admin.protocolsTab');
		renderBreadcrumb(
			body,
			this.drillPath,
			rootLabel,
			{
				onRootClick: () => {
					this.drillPath = [];
					this.clearSearch();
					this.renderAdminContent(this.contentEl);
				},
				onCrumbClick: (index) => {
					this.drillPath = this.drillPath.slice(0, index + 1);
					this.clearSearch();
					this.renderAdminContent(this.contentEl);
				},
			},
		);

		const query = this.currentQuery.trim();
		if (query !== '') {
			renderSearchResults(
				body,
				entries,
				section,
				query,
				this.plugin.i18n.t.bind(this.plugin.i18n),
				(entry) => {
					if (section === 'snippets') this.openEditSnippetModal(entry as LibrarySnippetEntry);
					else this.openEditProtocolModal(entry as ProtocolLibraryEntry);
				},
				(entry) => {
					if (section === 'snippets') void this.handleDeleteSnippet(entry as LibrarySnippetEntry);
					else void this.handleDeleteProtocol(entry as ProtocolLibraryEntry);
				},
			);
		} else {
			const { node, validPath } = findNodeByDrillPath(tree, this.drillPath);
			this.drillPath = validPath;
			renderDirectory(
				body,
				node,
				section,
				this.plugin.i18n.t.bind(this.plugin.i18n),
				(childNode) => {
					this.drillPath = [...validPath, childNode.name];
					this.clearSearch();
					this.renderAdminContent(this.contentEl);
				},
				(childNode, displayName) => {
					void this.handleRenameDirectory(section, childNode.path, displayName);
				},
				(childNode) => {
					void this.handleDeleteDirectory(section, childNode.path);
				},
				(entry) => {
					if (section === 'snippets') this.openEditSnippetModal(entry as LibrarySnippetEntry);
					else this.openEditProtocolModal(entry as ProtocolLibraryEntry);
				},
				(entry) => {
					if (section === 'snippets') void this.handleDeleteSnippet(entry as LibrarySnippetEntry);
					else void this.handleDeleteProtocol(entry as ProtocolLibraryEntry);
				},
				collectEntries(node).length,
			);
		}
	}

	private async readSectionEntries(section: LibraryAdminSection): Promise<AdminEntry[]> {
		if (!this.admin) return [];
		if (section === 'snippets') return (await this.admin.readSnippetIndex())?.snippets ?? [];
		return (await this.admin.readProtocolIndex())?.protocols ?? [];
	}

	private slugToDisplayName(slug: string): string {
		return slug
			.split('-')
			.filter(Boolean)
			.map(name => name.length > 0 ? `${name.charAt(0).toUpperCase()}${name.slice(1)}` : name)
			.join(' ');
	}

	// ─── Snippet actions ────────────────────────────────────────────────

	private async handleImportSnippet(): Promise<void> {
		const folder = this.plugin.settings.snippetFolderPath;
		if (!folder) {
			new Notice(this.plugin.i18n.t('admin.noVaultSnippets'));
			return;
		}

		const vaultFolder = this.app.vault.getAbstractFileByPath(folder);
		if (!(vaultFolder instanceof TFolder)) {
			new Notice(this.plugin.i18n.t('admin.noVaultSnippets'));
			return;
		}

		const modal = new ImportSnippetPickerModal(this.app, folder, this.plugin, async (file) => {
			try {
				const content = await this.app.vault.read(file);
				const parsed = JSON.parse(content);
				const name = typeof parsed.name === 'string' && parsed.name.trim() !== ''
					? parsed.name.trim()
					: file.basename;
				this.openImportSnippetDetailsModal(content, name);
			} catch {
				new Notice(this.plugin.i18n.t('admin.readFailed'));
			}
		});
		modal.open();
	}

	private openImportSnippetDetailsModal(content: string, suggestedName: string): void {
		void this.collectLibraryCategoryNames('snippets').then((categories) => {
			const modal = new ImportDetailsModal(
				this.app,
				this.plugin.i18n.t('admin.importSnippetDetails'),
				suggestedName,
				async (details) => {
					if (!this.admin) return;
					const result = await this.admin.importSnippetFromVault(
						content,
						details.category,
						details.name || suggestedName,
						undefined,
						details.description || undefined,
					);
					if (result) {
						void this.refreshAdmin();
					}
				},
				this.plugin,
				false,
				categories,
			);
			modal.open();
		});
	}

	private openEditSnippetModal(entry: LibrarySnippetEntry): void {
		const modal = new EditSnippetMetadataModal(this.app, entry, this.plugin, async (updates) => {
			if (!this.admin) return;
			const result = await this.admin.updateSnippetMetadata(entry, updates);
			if (result) {
				void this.refreshAdmin();
			}
		});
		modal.open();
	}

	private async handleDeleteSnippet(entry: LibrarySnippetEntry): Promise<void> {
		if (!this.admin) return;
		if (!confirm(this.plugin.i18n.t('admin.confirmDeleteSnippet', { name: entry.name }))) return;
		const ok = await this.admin.deleteSnippet(entry);
		if (ok) {
			void this.refreshAdmin();
		}
	}

	// ─── Protocol actions ───────────────────────────────────────────────

	private async handleImportProtocol(): Promise<void> {
		const folder = this.plugin.settings.protocolFolderPath;
		if (!folder) {
			new Notice(this.plugin.i18n.t('admin.noProtocolFolder'));
			return;
		}

		const files = this.listVaultProtocolFiles(folder);
		if (files.length === 0) {
			new Notice(this.plugin.i18n.t('admin.noVaultProtocols'));
			return;
		}

		const modal = new ImportProtocolPickerModal(this.app, files, this.plugin, async (file) => {
			try {
				const content = await this.app.vault.read(file);
				const parsed = JSON.parse(content);
				const title = typeof parsed.title === 'string' && parsed.title.trim() !== ''
					? parsed.title.trim()
					: file.basename;
				this.openImportProtocolDetailsModal(content, title);
			} catch {
				new Notice(this.plugin.i18n.t('admin.readFailed'));
			}
		});
		modal.open();
	}

	private listVaultProtocolFiles(folderPath: string): TFile[] {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!(folder instanceof TFolder)) return [];
		const out: TFile[] = [];
		const walk = (f: TFolder): void => {
			for (const child of f.children) {
				if (child instanceof TFolder) walk(child);
				else if (child instanceof TFile && child.extension === 'json' && child.name.endsWith('.rp.json')) {
					out.push(child);
				}
			}
		};
		walk(folder);
		return out;
	}

	private openImportProtocolDetailsModal(content: string, suggestedTitle: string): void {
		const modal = new ImportDetailsModal(
			this.app,
			this.plugin.i18n.t('admin.importProtocolDetails'),
			suggestedTitle,
			async (details) => {
				if (!this.admin) return;
				const result = await this.admin.importProtocolFromVault(
					content,
					details.category,
					details.description || undefined,
				);
				if (result) {
					void this.refreshAdmin();
				}
			},
			this.plugin,
			true,
		);
		modal.open();
	}

	private openEditProtocolModal(entry: ProtocolLibraryEntry): void {
		const modal = new EditProtocolMetadataModal(this.app, entry, this.plugin, async (updates) => {
			if (!this.admin) return;
			const result = await this.admin.updateProtocolMetadata(entry, updates);
			if (result) {
				void this.refreshAdmin();
			}
		});
		modal.open();
	}

	private async handleDeleteProtocol(entry: ProtocolLibraryEntry): Promise<void> {
		if (!this.admin) return;
		if (!confirm(this.plugin.i18n.t('admin.confirmDeleteProtocol', { title: entry.title }))) return;
		const ok = await this.admin.deleteProtocol(entry);
		if (ok) {
			void this.refreshAdmin();
		}
	}

	// ─── Directory actions ──────────────────────────────────────────────

	private async handleCreateDirectory(section: LibraryAdminSection): Promise<void> {
		if (!this.admin) return;
		const name = await TextPromptModal.prompt(this.app, {
			title: this.plugin.i18n.t('admin.createFolder'),
			label: this.plugin.i18n.t('admin.createFolderPrompt'),
			confirmText: this.plugin.i18n.t('admin.createFolder'),
			cancelText: this.plugin.i18n.t('common.cancel'),
		});
		if (name === null) return;
		const parentPath = this.currentDirectoryPath(section);
		const created = await this.admin.createDirectory(section, parentPath, name);
		if (created) void this.refreshAdmin();
	}

	private async handleRenameDirectory(section: LibraryAdminSection, dirPath: string, currentDisplayName: string): Promise<void> {
		if (!this.admin) return;
		const name = await TextPromptModal.prompt(this.app, {
			title: this.plugin.i18n.t('admin.rename'),
			label: this.plugin.i18n.t('admin.renameFolderPrompt'),
			initialValue: currentDisplayName,
			confirmText: this.plugin.i18n.t('admin.rename'),
			cancelText: this.plugin.i18n.t('common.cancel'),
		});
		if (name === null) return;
		const renamed = await this.admin.renameDirectory(section, dirPath, name);
		if (renamed) {
			void this.refreshAdmin();
		}
	}

	private async handleDeleteDirectory(section: LibraryAdminSection, dirPath: string): Promise<void> {
		if (!this.admin) return;
		if (!confirm(this.plugin.i18n.t('admin.confirmDeleteFolder', { path: dirPath }))) return;
		const ok = await this.admin.deleteDirectory(section, dirPath);
		if (ok) {
			const deletedPath = dirPath.split('/').filter(Boolean).slice(1);
			if (this.drillPath.join('/') === deletedPath.join('/')) this.drillPath = deletedPath.slice(0, -1);
			void this.refreshAdmin();
		}
	}

	private currentDirectoryPath(section: LibraryAdminSection): string {
		return [section, ...this.drillPath].join('/');
	}

	private clearSearch(): void {
		this.currentQuery = '';
		if (this.searchInputEl) this.searchInputEl.value = '';
		if (this.searchDebounceTimer !== null) {
			clearTimeout(this.searchDebounceTimer);
			this.searchDebounceTimer = null;
		}
	}

	// ─── Toolbar actions ────────────────────────────────────────────────

	private async handleResetToRemote(): Promise<void> {
		if (!this.admin) return;
		const phrase = this.plugin.i18n.t('admin.resetConfirmPhrase');
		const message = this.plugin.i18n.t('admin.resetConfirmMessage', { phrase });
		const confirmed = await TypeConfirmModal.prompt(this.app, {
			title: this.plugin.i18n.t('admin.resetConfirmTitle'),
			message,
			phrase,
			confirmText: this.plugin.i18n.t('confirm.ok'),
			cancelText: this.plugin.i18n.t('confirm.cancel'),
		});
		if (!confirmed) return;
		this.setStatus(this.plugin.i18n.t('admin.resettingToRemote'));
		const result = await this.admin.gitResetToOriginMain();
		if (result.success) {
			let statusText: string;
			if (result.cleanedCount && result.cleanedCount > 0) {
				statusText = this.plugin.i18n.t('admin.resetSuccessDetail', {
					ref: result.ref ?? 'origin/main',
					count: String(result.cleanedCount),
				});
			} else {
				statusText = this.plugin.i18n.t('admin.resetSuccessNoClean', {
					ref: result.ref ?? 'origin/main',
				});
			}
			this.setStatus(statusText);
			new Notice(statusText);
		} else {
			const parts = [result.output];
			if (result.hint) parts.push(result.hint);
			const failureText = parts.filter(Boolean).join('\n');
			this.setStatus(failureText);
			new Notice(failureText, 8000);
		}
		this.refreshAdmin();
	}

	private handleSendToRemote(): void {
		if (!this.admin) return;
		const modal = new SendToRemoteModal(this.app, this.admin, this.plugin.settings.libraryRepoPath ?? '', this.plugin.i18n.t.bind(this.plugin.i18n));
		modal.open();
	}

	private setStatus(text: string): void {
		this.statusEl.setText(text);
	}

	private refreshAdmin(): void {
		this.renderAdmin(this.contentEl);
	}

	// ─── Library category helpers ──────────────────────────────────────

	private async collectLibraryCategoryNames(section: LibraryAdminSection): Promise<string[]> {
		if (!this.admin) return [];
		const names = new Set<string>();
		if (section === 'snippets') {
			const index = await this.admin.readSnippetIndex();
			if (index) {
				for (const entry of index.snippets) {
					if (entry.category) names.add(entry.category);
				}
			}
		} else {
			const directories = await this.admin.listDirectories(section);
			for (const dir of directories) {
				const parts = dir.path.split('/').filter(Boolean);
				if (parts.length === 2) {
					const absPath = this.admin.resolveRepoPathPublic(dir.path);
					const metaName = await this.admin.readDirectoryDisplayName(absPath);
					names.add(metaName ?? dir.name);
				}
			}
		}
		return [...names].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));
	}

	onClose(): void {
		this.clearSearch();
		this.contentEl.empty();
	}
}
