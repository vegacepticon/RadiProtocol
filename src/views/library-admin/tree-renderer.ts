import { createButton } from '../../utils/dom-helpers';
import type { AdminEntry, AdminTreeNode, I18nFn } from './types';

export function renderFolderTile(
	grid: HTMLElement,
	node: AdminTreeNode,
	t: I18nFn,
	onOpen: () => void,
	onRename: () => void,
	onDelete: () => void,
): void {
	const tile = grid.createDiv({ cls: 'rp-admin-folder-tile' });
	const openBtn = tile.createDiv({ cls: 'rp-admin-folder-tile-open', attr: { tabindex: '0', role: 'button', 'aria-label': node.displayName } });
	const nameEl = openBtn.createEl('span', { cls: 'rp-admin-entry-name' });
	nameEl.createEl('span', { cls: 'rp-admin-row-glyph', text: '\uD83D\uDCC1' }); // Non-translatable folder glyph symbol
	nameEl.createEl('span', { cls: 'rp-admin-row-title', text: node.displayName });
	if (node.displayName !== node.name) {
		openBtn.createEl('span', { cls: 'rp-admin-entry-path', text: node.name });
	}
	openBtn.addEventListener('click', onOpen);
	openBtn.addEventListener('keydown', (e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onOpen();
		}
	});

	const actions = tile.createDiv({ cls: 'rp-admin-folder-tile-actions' });
	createButton(actions, { cls: 'rp-admin-btn rp-admin-btn-edit', text: t('admin.rename'), attr: { 'aria-label': t('admin.rename') } })
		.addEventListener('click', onRename);
	createButton(actions, { cls: 'rp-admin-btn rp-admin-btn-delete', text: t('admin.delete'), attr: { 'aria-label': t('admin.delete') } })
		.addEventListener('click', onDelete);
}

export function renderEntryRow(
	list: HTMLElement,
	entry: AdminEntry,
	section: 'snippets' | 'protocols',
	showPath: boolean,
	t: I18nFn,
	onEdit?: (entry: AdminEntry) => void,
	onDelete?: (entry: AdminEntry) => void,
): void {
	const row = list.createDiv({ cls: 'rp-admin-entry' });
	const info = row.createDiv({ cls: 'rp-admin-entry-info' });
	const nameEl = info.createEl('span', { cls: 'rp-admin-entry-name' });
	nameEl.createEl('span', { cls: 'rp-admin-row-glyph', text: '\uD83D\uDCC4' }); // Non-translatable file glyph symbol
	const entryTitle = 'title' in entry ? entry.title : entry.name;
	nameEl.createEl('span', { cls: 'rp-admin-row-title', text: entryTitle });
	if (section === 'protocols' && 'nodes' in entry) {
		info.createEl('span', {
			text: t('admin.protocolMeta', { nodes: String(entry.nodes ?? 0), edges: String(entry.edges ?? 0) }),
			cls: 'rp-admin-entry-meta',
		});
	}
	info.createEl('span', { text: showPath ? entry.path : entry.path.split('/').pop() ?? entry.path, cls: 'rp-admin-entry-path' });

	const actions = row.createDiv({ cls: 'rp-admin-entry-actions' });
	if (onEdit) {
		const editBtn = actions.createEl('button', { text: t('admin.edit'), cls: 'rp-admin-btn rp-admin-btn-edit', attr: { 'aria-label': t('admin.edit') } });
		editBtn.addEventListener('click', () => { onEdit(entry); });
	}
	if (onDelete) {
		const delBtn = actions.createEl('button', { text: t('admin.delete'), cls: 'rp-admin-btn rp-admin-btn-delete', attr: { 'aria-label': t('admin.delete') } });
		delBtn.addEventListener('click', () => { onDelete(entry); });
	}
}

export function renderDirectory(
	host: HTMLElement,
	node: AdminTreeNode,
	section: 'snippets' | 'protocols',
	t: I18nFn,
	onFolderOpen: (node: AdminTreeNode) => void,
	onFolderRename: (node: AdminTreeNode, displayName: string) => void,
	onFolderDelete: (node: AdminTreeNode) => void,
	onEditEntry: (entry: AdminEntry) => void,
	onDeleteEntry: (entry: AdminEntry) => void,
	entryCount: number,
): void {
	host.createDiv({
		cls: 'rp-admin-directory-meta',
		text: t('admin.directoryCount', { count: String(entryCount) }),
	});

	if (node.children.size > 0) {
		const grid = host.createDiv({ cls: 'rp-admin-folder-grid' });
		for (const child of node.children.values()) {
			renderFolderTile(
				grid,
				child,
				t,
				() => onFolderOpen(child),
				() => onFolderRename(child, child.displayName),
				() => onFolderDelete(child),
			);
		}
	}

	const list = host.createDiv({ cls: 'rp-admin-list rp-admin-tree-list' });
	for (const entry of node.entries) {
		renderEntryRow(list, entry, section, false, t, onEditEntry, onDeleteEntry);
	}
	if (node.children.size === 0 && list.children.length === 0) {
		list.createEl('div', { cls: 'rp-admin-empty', text: t('admin.emptyFolder') });
	}
}

export function renderSearchResults(
	host: HTMLElement,
	entries: AdminEntry[],
	section: 'snippets' | 'protocols',
	query: string,
	t: I18nFn,
	onEdit?: (entry: AdminEntry) => void,
	onDelete?: (entry: AdminEntry) => void,
): void {
	const lower = query.trim().toLowerCase();
	const matches = lower === '' ? entries : entries.filter((entry) => {
		const entryTitle = 'title' in entry ? entry.title : entry.name;
		return `${entryTitle}\n${entry.path}\n${entry.description ?? ''}`.toLowerCase().includes(lower);
	});
	host.createDiv({ cls: 'rp-admin-directory-meta', text: t('admin.searchResults', { count: String(matches.length) }), attr: { 'aria-live': 'polite' } });
	const list = host.createDiv({ cls: 'rp-admin-list rp-admin-tree-list' });
	for (const entry of matches) renderEntryRow(list, entry, section, true, t, onEdit, onDelete);
	if (list.children.length === 0) {
		list.createEl('div', { cls: 'rp-admin-empty', text: t('admin.emptyResults') });
	}
}