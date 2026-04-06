/**
 * Minimal Obsidian API mock for vitest.
 * Only stubs the classes/functions used by modules under test.
 * Real Obsidian runtime is only available inside the Obsidian desktop app.
 */

/** Minimal mock element returned by createEl/createDiv */
function makeMockEl(): MockElement {
  const el: MockElement = {
    createEl: (_tag: string, _opts?: unknown) => makeMockEl(),
    createDiv: (_opts?: unknown) => makeMockEl(),
    empty: () => {},
    setText: (_text: string) => {},
    type: '',
    min: '',
  };
  return el;
}

interface MockElement {
  createEl: (tag: string, opts?: unknown) => MockElement;
  createDiv: (opts?: unknown) => MockElement;
  empty: () => void;
  setText: (text: string) => void;
  type: string;
  min: string;
}

/** Mock TextComponent / TextAreaComponent returned by addText / addTextArea */
function makeMockTextComponent(): MockTextComponent {
  const tc: MockTextComponent = {
    inputEl: { type: '', min: '' },
    setValue: (_v: string) => tc,
    onChange: (_cb: (v: string) => void) => tc,
  };
  return tc;
}

interface MockTextComponent {
  inputEl: { type: string; min: string };
  setValue: (v: string) => MockTextComponent;
  onChange: (cb: (v: string) => void) => MockTextComponent;
}

/** Mock DropdownComponent — must support full addOption chaining (8 options) */
function makeMockDropdown(): MockDropdown {
  const drop: MockDropdown = {
    addOption: (_value: string, _display: string) => drop,
    setValue: (_v: string) => drop,
    onChange: (_cb: (v: string) => void) => drop,
  };
  return drop;
}

interface MockDropdown {
  addOption: (value: string, display: string) => MockDropdown;
  setValue: (v: string) => MockDropdown;
  onChange: (cb: (v: string) => void) => MockDropdown;
}

/** Mock ButtonComponent — supports setCta and onClick chaining */
function makeMockButton(): MockButton {
  const btn: MockButton = {
    setButtonText: (_text: string) => btn,
    setCta: () => btn,
    onClick: (_cb: () => void) => btn,
  };
  return btn;
}

interface MockButton {
  setButtonText: (text: string) => MockButton;
  setCta: () => MockButton;
  onClick: (cb: () => void) => MockButton;
}

export class ItemView {
  leaf: unknown;
  contentEl: ReturnType<typeof makeMockEl>;
  constructor(leaf: unknown) {
    this.leaf = leaf;
    this.contentEl = makeMockEl();
  }
  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  getState(): Record<string, unknown> { return {}; }
  setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
}

export class WorkspaceLeaf {}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: ReturnType<typeof makeMockEl>;
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = makeMockEl();
  }
  display(): void {}
}

export class Plugin {
  app: unknown = {};
  manifest: unknown = {};
}

export class Modal {
  app: unknown;
  contentEl: ReturnType<typeof makeMockEl>;
  titleEl: ReturnType<typeof makeMockEl>;
  constructor(app: unknown) {
    this.app = app;
    this.contentEl = makeMockEl();
    this.titleEl = makeMockEl();
  }
  open(): void {}
  close(): void {}
  onOpen(): void {}
  onClose(): void {}
}

export class SuggestModal<T> {
  app: unknown;
  constructor(app: unknown) { this.app = app; }
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: unknown): void {}
  onChooseSuggestion(_item: T, _evt: unknown): void {}
  setPlaceholder(_placeholder: string): void {}
  open(): void {}
  close(): void {}
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class Setting {
  constructor(_containerEl: unknown) {}
  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  setHeading(): this { return this; }
  addText(_cb: (text: MockTextComponent) => void): this {
    _cb(makeMockTextComponent());
    return this;
  }
  addTextArea(_cb: (ta: MockTextComponent) => void): this {
    _cb(makeMockTextComponent());
    return this;
  }
  addDropdown(_cb: (drop: MockDropdown) => void): this {
    _cb(makeMockDropdown());
    return this;
  }
  addSlider(_cb: (slider: unknown) => void): this {
    _cb({ setLimits: () => this, setValue: () => this, onChange: () => this, setDynamicTooltip: () => this });
    return this;
  }
  addButton(_cb: (btn: MockButton) => void): this {
    _cb(makeMockButton());
    return this;
  }
}

/** TFile mock — instanceof checks use this */
export class TFile {
  path: string;
  constructor(path = '') {
    this.path = path;
  }
}
