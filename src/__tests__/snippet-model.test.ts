import { describe, it, expect } from 'vitest';
import type { SnippetPlaceholder, MdTemplateSnippet } from '../snippets/snippet-model';
import { renderMdTemplateSnippet, slugifyLabel } from '../snippets/snippet-model';

describe('SnippetPlaceholder interface (SNIP-02, D-16)', () => {
  it('has optional options field for choice', () => {
    const p: SnippetPlaceholder = {
      id: 'laterality', label: 'Side', type: 'choice',
      options: ['Left', 'Right', 'Bilateral'],
    };
    expect(p.options).toHaveLength(3);
  });

  it('has optional separator field for choice placeholders (D-02)', () => {
    const p = {
      id: 'findings', label: 'Findings', type: 'choice',
      options: ['cyst', 'mass'], separator: ' and ',
    } as unknown as SnippetPlaceholder & { separator: string };
    expect(p.separator).toBe(' and ');
  });
});

describe('renderMdTemplateSnippet (EXTERNAL-LIB-01)', () => {
  const snippet: MdTemplateSnippet = {
    kind: 'md-template',
    path: '.radiprotocol/snippets/liver-report.md',
    name: 'Liver report',
    template: 'Patient age: {{age}}. Side: {{laterality}}.',
    placeholders: [
      { id: 'age', label: 'Age', type: 'free-text' },
      { id: 'laterality', label: 'Side', type: 'choice', options: ['Left', 'Right'] },
    ],
    validationError: null,
  };

  it('substitutes free-text placeholder tokens', () => {
    const result = renderMdTemplateSnippet(snippet, { age: '45', laterality: 'Left' });
    expect(result).toContain('Patient age: 45');
  });

  it('leaves unfilled tokens as empty string (not as {{id}})', () => {
    const result = renderMdTemplateSnippet(snippet, { age: '', laterality: '' });
    expect(result).not.toContain('{{age}}');
  });
});

describe('renderMdTemplateSnippet choice (D-02, D-05)', () => {
  it('inserts pre-joined choice values verbatim (caller pre-joins with separator)', () => {
    const s: MdTemplateSnippet = {
      kind: 'md-template',
      path: '.radiprotocol/snippets/findings.md',
      name: 'Findings',
      template: 'Findings: {{f}}.',
      placeholders: [{
        id: 'f', label: 'Findings', type: 'choice',
        options: ['cyst', 'mass'], separator: ' and ',
      }],
      validationError: null,
    };
    const result = renderMdTemplateSnippet(s, { f: 'cyst and mass' });
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