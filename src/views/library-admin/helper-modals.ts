import { Modal, Setting, App, AbstractInputSuggest, TFile, Notice } from 'obsidian';
import type RadiProtocolPlugin from '../../main';
import type { LibrarySnippetEntry } from '../../snippets/library-model';
import type { ProtocolLibraryEntry } from '../../protocol/protocol-library-model';
import type { LibraryAdminService } from '../../snippets/library-admin';
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

/** Modal for preparing a "Send to remote" / PR-request from local library changes. */
export class SendToRemoteModal extends Modal {
	private readonly t: Translator;
	private readonly admin: LibraryAdminService;
	private statusText = '';
	private diffText = '';
	private branchText = '';
	private untrackedFiles: string[] = [];
	private remoteUrl: string | null = null;
	private isClean = false;
	private isSending = false;
	private readonly repoPath: string;

	constructor(app: App, admin: LibraryAdminService, repoPath: string, t?: Translator) {
		super(app);
		this.admin = admin;
		this.repoPath = repoPath;
		this.t = t ?? defaultT;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t('admin.sendToRemoteTitle') });

		const loadingEl = contentEl.createEl('p', { text: this.t('admin.sendLoading') });
		void this.loadStatus().then(() => {
			loadingEl.remove();
			this.renderContent(contentEl);
		});
	}

	private async loadStatus(): Promise<void> {
		const [statusResult, diffResult, branchResult, remoteResult] = await Promise.all([
			this.admin.gitStatus(),
			this.admin.gitDiffStat(),
			this.admin.gitBranch(),
			this.admin.getRemoteHttpUrl(),
		]);
		this.statusText = statusResult.success ? statusResult.output : '';
		this.diffText = diffResult.success ? diffResult.output : '';
		this.branchText = branchResult;
		this.remoteUrl = remoteResult;
		this.isClean = this.statusText.trim() === '';

		const untracked = await this.admin.gitUntracked();
		this.untrackedFiles = untracked;
	}

	private renderContent(contentEl: HTMLElement): void {
		contentEl.empty();
		contentEl.createEl('h2', { text: this.t('admin.sendToRemoteTitle') });

		if (this.isClean) {
			contentEl.createEl('p', { text: this.t('admin.sendNoChanges') });
			contentEl.createEl('p', {
				text: this.t('admin.sendNoChangesHint'),
				cls: 'rp-admin-send-hint',
			});
			return;
		}

		contentEl.createEl('p', { text: this.t('admin.sendChangesIntro') });

		if (this.statusText) {
			const statusContainer = contentEl.createDiv({ cls: 'rp-admin-send-section' });
			statusContainer.createEl('h3', { text: this.t('admin.sendStatusSection') });
			statusContainer.createEl('pre', { text: this.statusText, cls: 'rp-admin-send-output' });
		}

		if (this.diffText) {
			const diffContainer = contentEl.createDiv({ cls: 'rp-admin-send-section' });
			diffContainer.createEl('h3', { text: this.t('admin.sendDiffSection') });
			diffContainer.createEl('pre', { text: this.diffText, cls: 'rp-admin-send-output' });
		}

		if (this.untrackedFiles.length > 0 && this.untrackedFiles.length <= 20) {
			const untrackedContainer = contentEl.createDiv({ cls: 'rp-admin-send-section' });
			untrackedContainer.createEl('h3', { text: this.t('admin.sendUntrackedSection') });
			untrackedContainer.createEl('pre', { text: this.untrackedFiles.join('\n'), cls: 'rp-admin-send-output' });
		}

		contentEl.createEl('hr');

		if (this.remoteUrl) {
			const autoDiv = contentEl.createDiv({ cls: 'rp-admin-send-section' });
			autoDiv.createEl('p', { text: this.t('admin.sendAutoIntro') });

			new Setting(autoDiv)
				.setName(this.t('admin.sendBranchLabel'))
				.addText(text => text
					.setValue(this.suggestBranchName())
					.setPlaceholder(this.t('admin.sendBranchPlaceholder'))
					.onChange(v => { this.branchNameInput = v.trim(); }));

			new Setting(autoDiv)
				.setName(this.t('admin.sendCommitLabel'))
				.addText(text => text
					.setValue(this.t('admin.sendDefaultCommitMessage'))
					.onChange(v => { this.commitMessageInput = v; }));

			new Setting(autoDiv)
				.addButton(btn => btn
					.setButtonText(this.t('admin.sendPushButton'))
					.setCta()
					.onClick(() => { void this.handleSend(); }));

			contentEl.createEl('hr');
		}

		contentEl.createEl('p', {
			text: this.remoteUrl ? this.t('admin.sendManualIntro') : this.t('admin.sendManualIntroNoRemote'),
			cls: 'rp-admin-send-hint',
		});

		const steps = this.getManualSteps();
		for (let i = 0; i < steps.length; i++) {
			contentEl.createEl('pre', {
				text: steps[i],
				cls: 'rp-admin-send-step',
			});
		}
	}

	private branchNameInput = '';
	private commitMessageInput = '';

	private suggestBranchName(): string {
		return this.branchText && this.branchText !== 'main' && this.branchText !== 'master'
			? this.branchText
			: 'library-update';
	}

	private getManualSteps(): string[] {
		const steps = [
			this.t('admin.sendStep1', { path: this.repoPath }),
			this.t('admin.sendStep2'),
			this.t('admin.sendStep3'),
			this.t('admin.sendStep4'),
		];
		if (this.remoteUrl) {
			steps.push(this.t('admin.sendStep5', { url: this.remoteUrl }));
		} else {
			steps.push(this.t('admin.sendStep5NoUrl'));
		}
		return steps;
	}

	private async handleSend(): Promise<void> {
		if (this.isSending) return;
		this.isSending = true;

		const branchName = this.branchNameInput || this.suggestBranchName();
		const commitMessage = this.commitMessageInput || this.t('admin.sendDefaultCommitMessage');

		this.setStatus(this.t('admin.sendSending'));
		const result = await this.admin.gitCommitAndPushBranch(branchName, commitMessage);
		this.isSending = false;

		if (result.success) {
			const url = result.branchUrl ?? this.remoteUrl ?? '';
			const detail = url
				? this.t('admin.sendSuccessWithUrl', { url })
				: this.t('admin.sendSuccess');
			this.setStatus(detail);
			new Notice(detail);

			this.isClean = true;
			const { contentEl } = this;
			contentEl.empty();
			contentEl.createEl('h2', { text: this.t('admin.sendToRemoteTitle') });
			contentEl.createEl('p', { text: this.t('admin.sendSuccess') });
			if (url) {
				const link = contentEl.createEl('a', {
					text: this.t('admin.openPullRequest'),
					attr: { href: url, target: '_blank', rel: 'noopener' },
				});
				link.addClass('rp-admin-send-pr-link');
			}
		} else {
			const failureText = [result.output, result.hint].filter(Boolean).join('\n');
			this.setStatus(failureText);
			new Notice(failureText, 8000);
		}
	}

	private setStatus(text: string): void {
		this.statusEl = this.statusEl ?? document.createElement('div');
		this.statusEl.setText(text);
	}

	private statusEl: HTMLElement | null = null;

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
				.setButtonText(this.opts.confirmText) // Caller-supplied localized label
				.setCta()
				.onClick(() => {
					this.didSubmit = true;
					this.result = value.trim();
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText(this.opts.cancelText) // Caller-supplied localized label
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

export class TypeConfirmModal extends Modal {
	private didConfirm = false;
	private confirmBtn: HTMLButtonElement | null = null;

	static prompt(
		app: App,
		opts: { title: string; message: string; phrase: string; confirmText: string; cancelText: string; t?: Translator },
	): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new TypeConfirmModal(app, opts, resolve);
			modal.open();
		});
	}

	constructor(
		app: App,
		private readonly opts: { title: string; message: string; phrase: string; confirmText: string; cancelText: string; t?: Translator },
		private readonly resolve: (value: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: this.opts.title });
		contentEl.createEl('p', { text: this.opts.message });

		new Setting(contentEl)
			.addText(text => {
				text.onChange(next => {
					if (this.confirmBtn) {
						this.confirmBtn.disabled = next !== this.opts.phrase;
					}
				});
				setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText(this.opts.confirmText);
				btn.setCta();
				btn.buttonEl.disabled = true;
				this.confirmBtn = btn.buttonEl;
				btn.onClick(() => {
					this.didConfirm = true;
					this.close();
				});
			})
			.addButton(btn => btn
				.setButtonText(this.opts.cancelText) // Caller-supplied localized label
				.onClick(() => {
					this.close();
				}));
	}

	onClose(): void {
		this.contentEl.empty();
		this.resolve(this.didConfirm);
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
					.setPlaceholder(this.isProtocol ? this.plugin.i18n.t('admin.categoryPlaceholderProtocol') : this.plugin.i18n.t('admin.categoryPlaceholderSnippet'))
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
