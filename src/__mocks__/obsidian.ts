/**
 * Minimal Obsidian API mock for vitest.
 * Only stubs the classes/functions used by modules under test.
 * Real Obsidian runtime is only available inside the Obsidian desktop app.
 */

export class ItemView {
  leaf: unknown;
  contentEl: {
    createEl: () => unknown;
    empty: () => void;
  };
  constructor(leaf: unknown) {
    this.leaf = leaf;
    this.contentEl = {
      createEl: () => ({}),
      empty: () => {},
    };
  }
  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getState(): Record<string, unknown> { return {}; }
  setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
}

export class WorkspaceLeaf {}

export class PluginSettingTab {
  app: unknown;
  plugin: unknown;
  containerEl: {
    empty: () => void;
    createEl: () => unknown;
  };
  constructor(app: unknown, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = {
      empty: () => {},
      createEl: () => ({}),
    };
  }
  display(): void {}
}

export class Plugin {
  app: unknown = {};
  manifest: unknown = {};
}

export class Modal {
  app: unknown;
  contentEl: {
    createEl: () => unknown;
    empty: () => void;
  };
  constructor(app: unknown) {
    this.app = app;
    this.contentEl = {
      createEl: () => ({}),
      empty: () => {},
    };
  }
  open(): void {}
  close(): void {}
}

export class SuggestModal<T> {
  app: unknown;
  constructor(app: unknown) { this.app = app; }
  getSuggestions(_query: string): T[] { return []; }
  renderSuggestion(_item: T, _el: unknown): void {}
  onChooseSuggestion(_item: T, _evt: unknown): void {}
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
  addText(_cb: (text: unknown) => void): this {
    _cb({ setValue: () => this, onChange: () => this, inputEl: {} });
    return this;
  }
  addDropdown(_cb: (drop: unknown) => void): this {
    _cb({ addOption: () => ({ addOption: () => ({}) }), setValue: () => this, onChange: () => this });
    return this;
  }
  addSlider(_cb: (slider: unknown) => void): this {
    _cb({ setLimits: () => this, setValue: () => this, onChange: () => this, setDynamicTooltip: () => this });
    return this;
  }
  addButton(_cb: (btn: unknown) => void): this {
    _cb({ setButtonText: () => this, onClick: () => this });
    return this;
  }
  setHeading(): this { return this; }
}
