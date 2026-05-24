import { createInput } from '../../utils/dom-helpers';
import type { I18nFn } from './types';

export function renderTreeSearch(
	host: HTMLElement,
	query: string,
	t: I18nFn,
	onInput: (value: string) => void,
	onCreateFolder: () => void,
): HTMLInputElement {
	const toolbar = host.createDiv({ cls: 'rp-admin-tree-toolbar' });
	const searchInput = createInput(toolbar, {
		cls: 'rp-admin-search-input',
		type: 'text',
		placeholder: t('admin.searchPlaceholder'),
		value: query,
		attr: { 'aria-label': t('admin.searchPlaceholder') },
	});
	searchInput.addEventListener('input', () => { onInput(searchInput.value); });

	const newFolderBtn = toolbar.createEl('button', {
		cls: 'rp-admin-btn rp-admin-create-folder-btn',
		text: t('admin.createFolder'),
		attr: { 'aria-label': t('admin.createFolder') },
	});
	newFolderBtn.addEventListener('click', onCreateFolder);

	return searchInput;
}
