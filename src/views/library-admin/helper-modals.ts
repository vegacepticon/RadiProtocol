import { Modal, Setting, App, AbstractInputSuggest, TFile } from 'obsidian';
import type RadiProtocolPlugin from '../../main';
import type { LibrarySnippetEntry } from '../../snippets/library-model';
import type { ProtocolLibraryEntry } from '../../protocol/protocol-library-model';
import { SnippetTreePicker } from '../snippet-tree-picker';
import type { Translator } from '../../i18n';
import { defaultT } from '../../i18n';

/** Confirmation dialog using an Obsidian modal instead of window.confirm(). */
export class ConfirmModal extends Modal {
	private readonly t: Translator;

	constructor(
		app: App,
		private readonly message: string,
		private readonly onConfirm: () => void,
		private readonly onCancel: () => void,
		t?: Translator,
	) {
		super(app);
		this.t = t ?? defaultT;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('p', { text: this.message });

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(this.t('confirm.ok'))
				.setCta()
				.onClick(() => {
					this.close();
					this.onConfirm();
				}))
			.addButton(btn => btn
				.setButtonText(this.t('confirm.cancel'))
				.onClick(() => {
					this.close();
					this.onCancel();
				}));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Modal showing instructions for updating the library via git. */
export class UpdateInstructionsModal extends Modal {
	private readonly t: Translator;

	constructor(app: App, t?: Translator) {
		super(app);
		this.t = t ?? defaultT;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: this.t('admin.updateInstructionsTitle') });

		for (let i = 1; i <= 6; i++) {
			contentEl.createEl('pre', { text: this.t(`admin.updateSteps.${i}`), cls: 'rp-admin-instructions-step' });
		}

		contentEl.createEl('hr');
		contentEl.createEl('p', {
			text: this.t('admin.resetToLocalNotice'),
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class TextPromptModal extends Modal {
	private result: string | null = null;
	private didSubmit = false;

	static prompt(
		app: App,
		opts: { title: string; label: string; initialValue?: string; confirmText: string; cancelText: string },
	): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new TextPromptModal(app, opts, resolve);
			modal.open();
		});
	}

	private constructor(
		app: App,
		private readonly opts: { title: string; label: string; initialValue?: string; confirmText: string; cancelText: string },
		private readonly resolve: (value: string | null) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.opts.title });

		const setting = new Setting(contentEl)
			.setName(this.opts.label);

		let value = this.opts.initialValue ?? '';
		setting.addText(text => {
			text.setValue(value);
			text.onChange(next => { value = next; });
			setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(this.opts.confirmText)
				.setCta()
				.onClick(() => {
					this.didSubmit = true;
					this.result = value.trim();
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText(this.opts.cancelText)
				.onClick(() => {
					this.didSubmit = true;
					this.result = null;
					this.close();
				}));
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(this.didSubmit ? this.result : null);
	}
}

export class ImportSnippetPickerModal extends Modal {
	private picker: SnippetTreePicker | null = null;

	constructor(
		app: App,
		private rootPath: string,
		private plugin: RadiProtocolPlugin,
		private onSelect: (file: TFile) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.selectSnippet') });

		const pickerHost = contentEl.createDiv();
		this.picker = new SnippetTreePicker({
			app: this.app,
			snippetService: this.plugin.snippetService,
			container: pickerHost,
			mode: 'file-only',
			rootPath: this.rootPath,
			onSelect: (result) => {
				if (result.kind !== 'file') return;
				const vaultPath = result.relativePath
					? `${this.rootPath}/${result.relativePath}`
					: this.rootPath;
				const file = this.app.vault.getAbstractFileByPath(vaultPath);
				if (file instanceof TFile) {
					this.close();
					this.onSelect(file);
				}
			},
			t: this.plugin.i18n.t.bind(this.plugin.i18n),
		});
		void this.picker.mount();
	}

	onClose(): void {
		this.picker?.unmount();
		this.picker = null;
		this.contentEl.empty();
	}
}

export class ImportProtocolPickerModal extends Modal {
	constructor(
		app: App,
		private files: TFile[],
		private plugin: RadiProtocolPlugin,
		private onSelect: (file: TFile) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.plugin.i18n.t('admin.selectProtocol') });

		for (const file of this.files) {
			new Setting(contentEl)
				.setName(file.basename)
				.setDesc(file.path)
				.addButton(btn => btn
					.setButtonText(this.plugin.i18n.t('admin.select'))
					.onClick(() => {
						this.close();
						this.onSelect(file);
					}));
		}
	}
}

export class ImportDetailsModal extends Modal {
	private nameInput: string;
	private categoryInput: string;
	private descriptionInput: string;

	constructor(
		app: App,
		title: string,
		suggestedName: string,
		private onSubmit: (details: { name: string; category: string; description: string }) => void,
		private plugin: RadiProtocolPlugin,
		private isProtocol = false,
		private existingCategories: string[] = [],
	) {
		super(app);
		this.nameInput = suggestedName;
		this.categoryInput = '';
		this.descriptionInput = '';
		this.titleEl.setText(title);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.nameLabel'))
			.addText(text => text
				.setValue(this.nameInput)
				.onChange(v => { this.nameInput = v; }));

    new Setting(contentEl)
      .setName(this.plugin.i18n.t('admin.categoryLabel'))
			.addText(text => {
				text
					.setPlaceholder(this.isProtocol ? 'e.g. CT, X-ray' : 'e.g. ГМ, Грудная клетка')
					.onChange(v => { this.categoryInput = v; });
				if (this.existingCategories.length > 0) {
					new LibraryCategorySuggest(this.app, text.inputEl, this.existingCategories);
				}
			});

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.descriptionLabel'))
			.addText(text => text
				.setPlaceholder(this.plugin.i18n.t('admin.descriptionPlaceholder'))
				.onChange(v => { this.descriptionInput = v; }));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.importConfirm'))
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit({
						name: this.nameInput,
						category: this.categoryInput,
						description: this.descriptionInput,
					});
				}));
	}
}

/** Autocomplete suggest for library category (directory display names). */
class LibraryCategorySuggest extends AbstractInputSuggest<string> {
	private readonly inputElRef: HTMLInputElement;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		private categories: string[],
	) {
		super(app, inputEl);
		this.inputElRef = inputEl;
	}

	protected getSuggestions(query: string): string[] {
		const lower = query.trim().toLowerCase();
		if (lower === '') return this.categories.slice(0, 20);
		return this.categories
			.filter(c => c.toLowerCase().includes(lower))
			.slice(0, 20);
	}

	renderSuggestion(category: string, el: HTMLElement): void {
		el.createEl('div', { text: category });
	}

	selectSuggestion(category: string, evt: MouseEvent | KeyboardEvent): void {
		this.setValue(category);
		this.inputElRef.dispatchEvent(new Event('input', { bubbles: true }));
		super.selectSuggestion(category, evt);
	}
}

export class EditSnippetMetadataModal extends Modal {
	private categoryInput: string;
	private descriptionInput: string;

	constructor(
		app: App,
		private entry: LibrarySnippetEntry,
		private plugin: RadiProtocolPlugin,
		private onSubmit: (updates: { category?: string; description?: string }) => void,
	) {
		super(app);
		this.categoryInput = entry.category;
		this.descriptionInput = entry.description;
		this.titleEl.setText(plugin.i18n.t('admin.editSnippet', { name: entry.name }));
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.nameLabel'))
			.setDesc(this.entry.name)
			.setDisabled(true);

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.categoryLabel'))
			.addText(text => text
				.setValue(this.categoryInput)
				.onChange(v => { this.categoryInput = v; }));

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.descriptionLabel'))
			.addText(text => text
				.setValue(this.descriptionInput)
				.onChange(v => { this.descriptionInput = v; }));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.save'))
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit({
						category: this.categoryInput,
						description: this.descriptionInput,
					});
				}));
	}
}

export class EditProtocolMetadataModal extends Modal {
	private descriptionInput: string;

	constructor(
		app: App,
		private entry: ProtocolLibraryEntry,
		private plugin: RadiProtocolPlugin,
		private onSubmit: (updates: { description?: string }) => void,
	) {
		super(app);
		this.descriptionInput = entry.description ?? '';
		this.titleEl.setText(plugin.i18n.t('admin.editProtocol', { title: entry.title }));
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.nameLabel'))
			.setDesc(this.entry.title)
			.setDisabled(true);

		new Setting(contentEl)
			.setName(this.plugin.i18n.t('admin.descriptionLabel'))
			.addText(text => text
				.setValue(this.descriptionInput)
				.onChange(v => { this.descriptionInput = v; }));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText(this.plugin.i18n.t('admin.save'))
				.setCta()
				.onClick(() => {
					this.close();
					this.onSubmit({ description: this.descriptionInput });
				}));
	}
}
