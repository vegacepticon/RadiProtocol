// runner/snippet-label.ts
// Phase 75 DEDUP-01 — shared snippet branch label formatting.
import type { SnippetNode } from '../graph/graph-model';

export function isFileBoundSnippetNode(
  snippetNode: SnippetNode,
): snippetNode is SnippetNode & { radiprotocol_snippetPath: string } {
  return typeof snippetNode.radiprotocol_snippetPath === 'string' && snippetNode.radiprotocol_snippetPath !== '';
}

export function snippetBranchLabel(snippetNode: SnippetNode): string {
  if (isFileBoundSnippetNode(snippetNode)) {
    if (snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0) {
      return `📄 ${snippetNode.snippetLabel}`;
    }

    const snippetPath = snippetNode.radiprotocol_snippetPath;
    const fileName = snippetPath.split('/').pop() ?? '';
    const dot = fileName.lastIndexOf('.');
    const stem = dot > 0 ? fileName.slice(0, dot) : fileName;
    return stem.length > 0 ? `📄 ${stem}` : '📄 Snippet';
  }

  return snippetNode.snippetLabel !== undefined && snippetNode.snippetLabel.length > 0
    ? `📁 ${snippetNode.snippetLabel}`
    : '📁 Snippet';
}
