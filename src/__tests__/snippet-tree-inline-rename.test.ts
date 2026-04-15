// Phase 34 Plan 00 — Wave 0 contract stub.
// Plan 03 MUST replace every `it.todo` below with a real `it` test covering
// the enumerated scenario. Plan 05's verification asserts zero `it.todo`
// remain in this file before the phase can be marked complete.
import { describe, it } from 'vitest';

describe('SnippetManagerView — F2 inline rename (Phase 34 Plan 03)', () => {
  describe('enter rename', () => {
    it.todo('F2 on focused file row replaces label span with input');
    it.todo('F2 on focused folder row replaces label span with input');
    it.todo('context menu Переименовать triggers same path');
    it.todo('input is focused and basename (without extension) selected');
  });
  describe('commit', () => {
    it.todo('Enter commits via snippetService.renameSnippet');
    it.todo('Enter commits via snippetService.renameFolder');
    it.todo('settled flag prevents Enter+blur double-commit');
  });
  describe('cancel', () => {
    it.todo('Escape restores original label without service call');
    it.todo('blur with empty value reverts without service call');
  });
});
