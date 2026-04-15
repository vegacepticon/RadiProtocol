// Phase 34 Plan 00 — Wave 0 contract stub.
// Plan 02 MUST replace every `it.todo` below with a real `it` test covering
// the enumerated scenario. Plan 05's verification asserts zero `it.todo`
// remain in this file before the phase can be marked complete.
import { describe, it } from 'vitest';

describe('SnippetManagerView — drag-and-drop (Phase 34 Plan 02)', () => {
  describe('dragstart', () => {
    it.todo('sets application/x-radi-snippet-file MIME on file row');
    it.todo('sets application/x-radi-snippet-folder MIME on folder row');
    it.todo('adds is-dragging class to source row');
  });
  describe('dragover guard', () => {
    it.todo('preventDefault ONLY when our MIME is present');
    it.todo('rejects dragover from foreign MIME (e.g. text/plain only)');
    it.todo('adds drop-target class on valid hover');
  });
  describe('drop', () => {
    it.todo('file onto folder → calls snippetService.moveSnippet');
    it.todo('folder onto folder → calls snippetService.moveFolder');
    it.todo('folder dropped on itself → rejected, no service call');
    it.todo('folder dropped on own descendant → rejected, no service call');
    it.todo('drop on file-row redirects to parent folder');
  });
  describe('context menu Move to…', () => {
    it.todo('opens FolderPickerModal with all folders except source subtree');
    it.todo('selecting a folder calls moveSnippet / moveFolder');
  });
});
