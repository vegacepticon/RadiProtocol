import type { LibraryAdminSection } from '../../snippets/library-admin';
import type { LibrarySnippetEntry } from '../../snippets/library-model';
import type { ProtocolLibraryEntry } from '../../protocol/protocol-library-model';

export type TabId = LibraryAdminSection;
export type AdminEntry = LibrarySnippetEntry | ProtocolLibraryEntry;

export const SEARCH_DEBOUNCE_MS = 120;
export const GLYPH_FOLDER = '\uD83D\uDCC1';
export const GLYPH_JSON = '\uD83D\uDCC4';

export interface AdminTreeNode {
	name: string;
	displayName: string;
	path: string;
	children: Map<string, AdminTreeNode>;
	entries: AdminEntry[];
}

export type I18nFn = (key: string, params?: Record<string, string>) => string;

export function entryTitle(entry: AdminEntry): string {
	return 'title' in entry ? entry.title : entry.name;
}

export function nodePath(parentPath: string, name: string): string {
	return parentPath === '' ? name : `${parentPath}/${name}`;
}

export function collectEntries(node: AdminTreeNode): AdminEntry[] {
	const entries = [...node.entries];
	for (const child of node.children.values()) entries.push(...collectEntries(child));
	return entries;
}

export function sortTree(node: AdminTreeNode): void {
	node.entries.sort((a, b) => entryTitle(a).localeCompare(entryTitle(b), undefined, { sensitivity: 'base' }));
	const sortedChildren = [...node.children.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru', { sensitivity: 'base' }));
	node.children = new Map(sortedChildren.map(child => [child.name, child]));
	for (const child of node.children.values()) sortTree(child);
}

export function buildAdminTree(
	section: LibraryAdminSection,
	directories: import('../../snippets/library-admin').LibraryAdminDirectoryEntry[],
	entries: AdminEntry[],
	metaDisplayNameBySlug?: Map<string, string>,
	slugToDisplayName?: (slug: string) => string,
): AdminTreeNode {
	const rootName = section === 'snippets' ? 'snippets' : 'protocols';
	const root: AdminTreeNode = { name: rootName, displayName: rootName, path: rootName, children: new Map(), entries: [] };

	const categoryBySlug = new Map<string, string>();
	if (section === 'snippets') {
		for (const entry of entries) {
			const s = entry as LibrarySnippetEntry;
			if (s.category) {
				const dirPart = s.path.split('/')[1] ?? '';
				if (dirPart && !categoryBySlug.has(dirPart)) categoryBySlug.set(dirPart, s.category);
			}
		}
	}

	const ensureNode = (relPath: string): AdminTreeNode => {
		const parts = relPath.split('/').filter(Boolean).slice(1);
		let node = root;
		for (const part of parts) {
			let child = node.children.get(part);
			if (!child) {
				const readableName = metaDisplayNameBySlug?.get(part) ?? categoryBySlug.get(part) ?? (slugToDisplayName ? slugToDisplayName(part) : part);
				child = { name: part, displayName: readableName, path: nodePath(node.path, part), children: new Map(), entries: [] };
				node.children.set(part, child);
			}
			node = child;
		}
		return node;
	};
	for (const directory of directories) ensureNode(directory.path);
	for (const entry of entries) ensureNode(entry.path.split('/').slice(0, -1).join('/')).entries.push(entry);
	sortTree(root);
	return root;
}

export function findNodeByDrillPath(root: AdminTreeNode, drillPath: string[]): { node: AdminTreeNode; validPath: string[] } {
	let node = root;
	const validPath: string[] = [];
	for (const segment of drillPath) {
		const child = node.children.get(segment);
		if (!child) break;
		validPath.push(segment);
		node = child;
	}
	return { node, validPath };
}

export function filterEntries(entries: AdminEntry[], query: string): AdminEntry[] {
	const lower = query.trim().toLowerCase();
	if (lower === '') return entries;
	return entries.filter((entry) => `${entryTitle(entry)}\n${entry.path}\n${entry.description ?? ''}`.toLowerCase().includes(lower));
}
