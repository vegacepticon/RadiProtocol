import { describe, it, expect } from 'vitest';
import type { SnippetFile, SnippetPlaceholder } from '../snippets/snippet-model';
import { renderSnippet, slugifyLabel } from '../snippets/snippet-model';

describe('SnippetPlaceholder interface (SNIP-02, D-16)', () => {
  it('has optional options field for choice', () => {
    const p: SnippetPlaceholder = {
      id: 'laterality', label: 'Side', type: 'choice',
      options: ['Left', 'Right', 'Bilateral'],
    };
    expect(p.options).toHaveLength(3);
  });

  it('has optional separator field for choice placeholders (D-02)', () => {
    const p: SnippetPlaceholder = {
      id: 'findings', label: 'Findings', type: 'choice',
      options: ['cyst', 'mass'], separator: ' and ',
    } as SnippetPlaceholder;
    expect(p.separator).toBe(' and ');
  });
});

describe('renderSnippet (SNIP-02)', () => {
  const snippet: SnippetFile = {
    kind: 'json',
    path: '.radiprotocol/snippets/liver-report.json',
    id: 'liver-report',
    name: 'Liver report',
    template: 'Patient age: {{age}}. Side: {{laterality}}.',
    placeholders: [
      { id: 'age', label: 'Age', type: 'free-text' },
      { id: 'laterality', label: 'Side', type: 'choice', options: ['Left', 'Right'] },
    ],
    validationError: null,
  } as SnippetFile;

  it('substitutes free-text placeholder tokens', () => {
    const result = renderSnippet(snippet, { age: '45', laterality: 'Left' });
    expect(result).toContain('Patient age: 45');
  });

  it('leaves unfilled tokens as empty string (not as {{id}})', () => {
    const result = renderSnippet(snippet, { age: '', laterality: '' });
    expect(result).not.toContain('{{age}}');
  });
});

describe('renderSnippet choice (D-02, D-05)', () => {
  it('inserts pre-joined choice values verbatim (caller pre-joins with separator)', () => {
    const s: SnippetFile = {
      kind: 'json',
      path: '.radiprotocol/snippets/findings.json',
      id: 'findings', name: 'Findings',
      template: 'Findings: {{f}}.',
      placeholders: [{
        id: 'f', label: 'Findings', type: 'choice',
        options: ['cyst', 'mass'], separator: ' and ',
      }],
      validationError: null,
    } as SnippetFile;
    const result = renderSnippet(s, { f: 'cyst and mass' });
    expect(result).toBe('Findings: cyst and mass.');
  });
});

describe('slugifyLabel (D-04)', () => {
  it('converts "Patient age" to "patient-age"', () => {
    expect(slugifyLabel('Patient age')).toBe('patient-age');
  });

  it('converts "Size (mm)" to "size-mm"', () => {
    expect(slugifyLabel('Size (mm)')).toBe('size-mm');
  });

  it('converts Cyrillic label to cyrillic slug', () => {
    expect(slugifyLabel('Возраст пациента')).toBe('возраст-пациента');
  });
});
