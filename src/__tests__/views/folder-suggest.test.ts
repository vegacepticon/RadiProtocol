import { describe, expect, it } from 'vitest';
import { AbstractInputSuggest } from 'obsidian';
import { FolderSuggest, getFolderSuggestions } from '../../views/folder-suggest';

function makeApp(paths: string[]) {
  return {
    vault: {
      getAllFolders: (includeRoot?: boolean) => [
        ...(includeRoot ? [{ path: '' }] : []),
        ...paths.map(path => ({ path })),
      ],
    },
  };
}

function makeInputEl() {
  const listeners = new Map<string, Array<(evt: Event) => void>>();
  return {
    value: '',
    addEventListener: (type: string, cb: (evt: Event) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), cb]);
    },
    dispatchEvent: (evt: Event) => {
      for (const cb of listeners.get(evt.type) ?? []) {
        cb(evt);
      }
      return true;
    },
  } as HTMLInputElement;
}

function makeRenderEl() {
  const calls: Array<{ tag: string; opts?: { text?: string } }> = [];
  let htmlWrites = 0;
  const el = {
    calls,
    getHtmlWrites: () => htmlWrites,
    createEl: (tag: string, opts?: { text?: string }) => {
      calls.push({ tag, opts });
      return {};
    },
  };
  Object.defineProperty(el, 'innerHTML', {
    set: () => {
      htmlWrites += 1;
    },
  });
  return {
    ...el,
  } as unknown as HTMLElement & {
    calls: Array<{ tag: string; opts?: { text?: string } }>;
    getHtmlWrites: () => number;
  };
}

describe('FolderSuggest', () => {
  it('imports and extends AbstractInputSuggest', () => {
    const suggest = new FolderSuggest(makeApp(['Protocols']) as never, makeInputEl());
    expect(suggest).toBeInstanceOf(AbstractInputSuggest);
  });

  it('enumerates non-root folders, sorts alphabetically, and includes nested folders', () => {
    const suggestions = getFolderSuggestions(makeApp(['Snippets', '', 'Protocols/MR', 'Protocols/CT']) as never, '');
    expect(suggestions).toEqual(['Protocols/CT', 'Protocols/MR', 'Snippets']);
  });

  it('filters by case-insensitive substring while preserving prefix matches', () => {
    const app = makeApp(['Protocols/CT', 'Output/ct-archive', 'Snippets', 'Reports']);
    expect(getFolderSuggestions(app as never, 'ct')).toEqual(['Output/ct-archive', 'Protocols/CT']);
    expect(getFolderSuggestions(app as never, 'pro')).toEqual(['Protocols/CT']);
  });

  it('returns an empty list for zero-match queries and missing vault APIs', () => {
    expect(getFolderSuggestions(makeApp(['Protocols']) as never, 'zzz')).toEqual([]);
    expect(getFolderSuggestions({ vault: {} } as never, 'pro')).toEqual([]);
  });

  it('renders suggestion text with createEl instead of innerHTML', () => {
    const suggest = new FolderSuggest(makeApp(['Protocols/CT']) as never, makeInputEl());
    const el = makeRenderEl();

    suggest.renderSuggestion('Protocols/CT', el);

    expect(el.calls).toEqual([{ tag: 'div', opts: { text: 'Protocols/CT' } }]);
    expect(el.getHtmlWrites()).toBe(0);
  });

  it('selecting a suggestion sets the input value and dispatches input', () => {
    const inputEl = makeInputEl();
    const seen: string[] = [];
    inputEl.addEventListener('input', () => seen.push(inputEl.value));
    const suggest = new FolderSuggest(makeApp(['Protocols/CT']) as never, inputEl);

    suggest.selectSuggestion('Protocols/CT', {} as KeyboardEvent);

    expect(inputEl.value).toBe('Protocols/CT');
    expect(seen).toEqual(['Protocols/CT']);
  });
});
