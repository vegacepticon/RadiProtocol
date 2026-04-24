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

interface MockInputEvent {
  type: string;
  bubbles?: boolean;
}

interface MockInputEl {
  type: string;
  min: string;
  value: string;
  addEventListener: (type: string, cb: (evt: MockInputEvent) => void) => void;
  dispatchEvent: (evt: MockInputEvent) => boolean;
}

const mockTextComponents: MockTextComponent[] = [];
const mockAbstractInputSuggestInstances: AbstractInputSuggest<unknown>[] = [];

function makeMockInputEl(): MockInputEl {
  const listeners = new Map<string, Array<(evt: MockInputEvent) => void>>();
  return {
    type: '',
    min: '',
    value: '',
    addEventListener: (type: string, cb: (evt: MockInputEvent) => void) => {
      const existing = listeners.get(type) ?? [];
      existing.push(cb);
      listeners.set(type, existing);
    },
    dispatchEvent: (evt: MockInputEvent) => {
      for (const cb of listeners.get(evt.type) ?? []) {
        cb(evt);
      }
      return true;
    },
  };
}

/** Mock TextComponent / TextAreaComponent returned by addText / addTextArea */
function makeMockTextComponent(): MockTextComponent {
  const inputEl = makeMockInputEl();
  const tc: MockTextComponent = {
    inputEl,
    setValue: (v: string) => {
      inputEl.value = v;
      return tc;
    },
    onChange: (cb: (v: string) => void) => {
      inputEl.addEventListener('input', () => cb(inputEl.value));
      return tc;
    },
  };
  mockTextComponents.push(tc);
  return tc;
}

interface MockTextComponent {
  inputEl: MockInputEl;
  setValue: (v: string) => MockTextComponent;
  onChange: (cb: (v: string) => void) => MockTextComponent;
}

export function __resetObsidianMocks(): void {
  mockTextComponents.length = 0;
  mockAbstractInputSuggestInstances.length = 0;
}

export function __getMockTextComponents(): MockTextComponent[] {
  return mockTextComponents;
}

export function __getMockAbstractInputSuggestInstances(): AbstractInputSuggest<unknown>[] {
  return mockAbstractInputSuggestInstances;
}

export class AbstractInputSuggest<T> {
  app: unknown;
  textInputEl: MockInputEl;
  limit = 100;
  selected: T | null = null;
  constructor(app: unknown, textInputEl: MockInputEl) {
    this.app = app;
    this.textInputEl = textInputEl;
    mockAbstractInputSuggestInstances.push(this as AbstractInputSuggest<unknown>);
  }
  setValue(value: string): void {
    this.textInputEl.value = value;
  }
  getValue(): string {
    return this.textInputEl.value;
  }
  protected getSuggestions(_query: string): T[] | Promise<T[]> { return []; }
  selectSuggestion(value: T, _evt: MouseEvent | KeyboardEvent): void {
    this.selected = value;
  }
  onSelect(_callback: (value: T, evt: MouseEvent | KeyboardEvent) => unknown): this { return this; }
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

/** TFile mock — instanceof checks use this. Phase 59: added extension + basename for canvas-file filtering. */
export class TFile {
  path: string;
  extension: string;
  basename: string;
  constructor(path = '') {
    this.path = path;
    const parts = path.split('/');
    const leaf = parts[parts.length - 1] ?? '';
    const dot = leaf.lastIndexOf('.');
    this.extension = dot >= 0 ? leaf.slice(dot + 1) : '';
    this.basename = dot >= 0 ? leaf.slice(0, dot) : leaf;
  }
}

/** Mock setIcon — no-op stub matching Obsidian's signature.
 * Real runtime injects an <svg> into the element; tests only verify call wiring. */
export function setIcon(_el: unknown, _iconId: string): void {
  // no-op
}

/** TFolder mock — Phase 59: added for main.ts::resolveProtocolCanvasFiles tests. */
export class TFolder {
  path: string;
  name: string;
  children: Array<TFile | TFolder>;
  constructor(path = '', children: Array<TFile | TFolder> = []) {
    this.path = path;
    this.name = path.split('/').pop() ?? '';
    this.children = children;
  }
}
