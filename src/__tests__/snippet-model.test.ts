import { describe, it, expect } from 'vitest';
import type { SnippetFile, SnippetPlaceholder } from '../snippets/snippet-model';
import { renderSnippet, slugifyLabel } from '../snippets/snippet-model';

describe('SnippetPlaceholder interface (SNIP-02, D-16)', () => {
  it('has optional options field for choice/multi-choice', () => {
    const p: SnippetPlaceholder = {
      id: 'laterality', label: 'Side', type: 'choice',
      options: ['Left', 'Right', 'Bilateral'],
    };
    expect(p.options).toHaveLength(3);
  });

  it('has optional unit field for number placeholders', () => {
    const p: SnippetPlaceholder = {
      id: 'size', label: 'Size', type: 'number', unit: 'mm',
    };
    expect(p.unit).toBe('mm');
  });

  it('has optional joinSeparator field for multi-choice placeholders', () => {
    const p: SnippetPlaceholder = {
      id: 'findings', label: 'Findings', type: 'multi-choice', joinSeparator: ' and ',
    };
    expect(p.joinSeparator).toBe(' and ');
  });
});

describe('renderSnippet (SNIP-02)', () => {
  const snippet: SnippetFile = {
    id: 'liver-report',
    name: 'Liver report',
    template: 'Patient age: {{age}}. Side: {{laterality}}. Size: {{size}}.',
    placeholders: [
      { id: 'age', label: 'Age', type: 'free-text' },
      { id: 'laterality', label: 'Side', type: 'choice', options: ['Left', 'Right'] },
      { id: 'size', label: 'Size', type: 'number', unit: 'mm' },
    ],
  };

  it('substitutes free-text placeholder tokens', () => {
    const result = renderSnippet(snippet, { age: '45', laterality: 'Left', size: '12' });
    expect(result).toContain('Patient age: 45');
  });

  it('renders number placeholder with unit suffix', () => {
    const result = renderSnippet(snippet, { age: '45', laterality: 'Left', size: '12' });
    expect(result).toContain('Size: 12 mm');
  });

  it('leaves unfilled tokens as empty string (not as {{id}})', () => {
    const result = renderSnippet(snippet, { age: '', laterality: '', size: '' });
    expect(result).not.toContain('{{age}}');
  });
});

describe('renderSnippet multi-choice (SNIP-02)', () => {
  it('joins multi-choice values with joinSeparator', () => {
    const s: SnippetFile = {
      id: 'findings', name: 'Findings', template: 'Findings: {{f}}.',
      placeholders: [{ id: 'f', label: 'Findings', type: 'multi-choice', joinSeparator: ' and ' }],
    };
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
});
