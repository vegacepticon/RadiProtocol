// views/plugin-menu-view.ts
// Persistent right-sidebar plugin menu. Lists the plugin's primary commands so
// they can be invoked directly without the command palette. The view holds no
// session state: every item dispatches the corresponding registered command via
// app.commands.executeCommandById, so behavior stays identical to the palette.
import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import type RadiProtocolPlugin from '../main';

export const PLUGIN_MENU_VIEW_TYPE = 'radiprotocol-plugin-menu';

/**
 * Minimal typed surface of the Obsidian command registry. The public typings
 * (obsidian 1.12.x) do not expose `commands` on `App`, so the view casts once
 * through this contract instead of leaking an untyped `any` at the call site.
 */
interface CommandRegistry {
  executeCommandById(commandId: string): void;
}

interface PluginMenuAction {
  /** Fully-qualified command id (`<plugin-id>:<command-id>`). */
  commandId: string;
  icon: string;
  labelKey: string;
}

const PLUGIN_MENU_ACTIONS: PluginMenuAction[] = [
  { commandId: 'radiprotocol:run-protocol-inline', icon: 'play', labelKey: 'pluginMenu.runProtocol' },
  { commandId: 'radiprotocol:start-from-node', icon: 'list-start', labelKey: 'pluginMenu.startFromNode' },
  { commandId: 'radiprotocol:open-protocol-editor', icon: 'workflow', labelKey: 'pluginMenu.openProtocolEditor' },
  { commandId: 'radiprotocol:insert-snippet', icon: 'text-cursor-input', labelKey: 'pluginMenu.insertSnippet' },
  { commandId: 'radiprotocol:create-snippet', icon: 'scissors', labelKey: 'pluginMenu.createSnippet' },
  { commandId: 'radiprotocol:open-snippet-manager', icon: 'folder-open', labelKey: 'pluginMenu.openSnippetManager' },
  { commandId: 'radiprotocol:open-community-library', icon: 'library', labelKey: 'pluginMenu.openCommunityLibrary' },
  { commandId: 'radiprotocol:export-protocol-as-library-package', icon: 'upload', labelKey: 'pluginMenu.exportProtocolPackage' },
];

/**
 * Persistent right-sidebar menu shell. Unlike the transient sidebar runner,
 * this view is durable workspace state: main.ts registers it before
 * onLayoutReady and never detaches it on unload, so Obsidian restores the leaf
 * across restarts by itself.
 */
export class PluginMenuView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return PLUGIN_MENU_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.i18n.t('pluginMenu.title');
  }

  getIcon(): string {
    return 'layout-list';
  }

  async onOpen(): Promise<void> {
    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    this.contentEl.empty();
    this.contentEl.addClass('rp-plugin-menu-view');

    const header = this.contentEl.createDiv({ cls: 'rp-plugin-menu-header' });
    header.createEl('h3', { text: t('pluginMenu.title') });

    const list = this.contentEl.createDiv({ cls: 'rp-plugin-menu-list' });
    for (const action of PLUGIN_MENU_ACTIONS) {
      const item = list.createEl('button', {
        cls: 'rp-plugin-menu-item',
        attr: { type: 'button', 'aria-label': t(action.labelKey) },
      });
      const iconEl = item.createEl('span', { cls: 'rp-plugin-menu-item-icon' });
      setIcon(iconEl, action.icon);
      item.createEl('span', { cls: 'rp-plugin-menu-item-label', text: t(action.labelKey) });
      this.registerDomEvent(item, 'click', () => {
        (this.app as unknown as { commands: CommandRegistry }).commands.executeCommandById(action.commandId);
      });
    }
  }

  async onClose(): Promise<void> {
    this.contentEl.removeClass('rp-plugin-menu-view');
    this.contentEl.empty();
  }
}
