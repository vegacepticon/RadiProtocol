// Canvas builder helper for Phase 72 algorithmic canvases.
// Models the .canvas JSON shape used by ОГК 1.10.0.canvas (the reference template).
// Each builder exposes addNode/addEdge with sequential 16-char hex IDs.

export class Canvas {
  constructor(prefix) {
    this.nodes = [];
    this.edges = [];
    this._nodeCounter = 0;
    this._edgeCounter = 0;
    this._prefix = prefix; // single hex char to namespace IDs across canvases
  }

  _nextNodeId() {
    this._nodeCounter++;
    return this._prefix + this._nodeCounter.toString(16).padStart(15, '0');
  }

  _nextEdgeId() {
    this._edgeCounter++;
    return 'e' + this._prefix + this._edgeCounter.toString(16).padStart(14, '0');
  }

  start({ x, y, width = 250, height = 60 }) {
    const id = this._nextNodeId();
    this.nodes.push({
      id, type: 'text', text: '',
      radiprotocol_nodeType: 'start',
      x, y, width, height, color: '4',
    });
    return id;
  }

  textBlock({ text, x, y, width = 250, height = 60 }) {
    const id = this._nextNodeId();
    this.nodes.push({
      id, type: 'text', text,
      radiprotocol_nodeType: 'text-block',
      x, y, width, height, color: '3',
    });
    return id;
  }

  question({ text, x, y, width = 250, height = 60 }) {
    const id = this._nextNodeId();
    this.nodes.push({
      id, type: 'text', text,
      radiprotocol_nodeType: 'question',
      x, y, width, height, color: '5',
    });
    return id;
  }

  answer({ text, displayLabel, x, y, width = 250, height = 60 }) {
    const id = this._nextNodeId();
    const node = {
      id, type: 'text', text,
      radiprotocol_nodeType: 'answer',
      x, y, width, height, color: '2',
    };
    if (displayLabel != null) node.radiprotocol_displayLabel = displayLabel;
    this.nodes.push(node);
    return id;
  }

  loop({ text, headerText, x, y, width = 250, height = 80 }) {
    const id = this._nextNodeId();
    this.nodes.push({
      id, type: 'text', text,
      radiprotocol_nodeType: 'loop',
      radiprotocol_headerText: headerText ?? text,
      x, y, width, height, color: '1',
    });
    return id;
  }

  snippetFolder({ subfolderPath, snippetLabel, text, x, y, width = 250, height = 60 }) {
    const id = this._nextNodeId();
    this.nodes.push({
      id, type: 'text', text: text ?? subfolderPath,
      radiprotocol_nodeType: 'snippet',
      radiprotocol_subfolderPath: subfolderPath,
      radiprotocol_snippetLabel: snippetLabel,
      x, y, width, height, color: '6',
    });
    return id;
  }

  snippetFile({ snippetPath, snippetLabel, text, x, y, width = 250, height = 60 }) {
    const id = this._nextNodeId();
    this.nodes.push({
      id, type: 'text', text: text ?? snippetPath,
      radiprotocol_nodeType: 'snippet',
      radiprotocol_snippetPath: snippetPath,
      radiprotocol_snippetLabel: snippetLabel,
      x, y, width, height, color: '6',
    });
    return id;
  }

  edge({ from, to, fromSide = 'bottom', toSide = 'top', label }) {
    const id = this._nextEdgeId();
    const e = { id, fromNode: from, fromSide, toNode: to, toSide };
    if (label != null) e.label = label;
    this.edges.push(e);
    return id;
  }

  toJSON() {
    return { nodes: this.nodes, edges: this.edges };
  }
}

// Static invariant checks (I1-I10) per 72-VALIDATION.md
export function verifyInvariants(canvasJSON, spec) {
  const { nodes, edges } = canvasJSON;
  const findings = [];
  const ok = (name) => findings.push({ inv: name, status: 'pass' });
  const fail = (name, msg) => findings.push({ inv: name, status: 'fail', msg });

  // I1: exactly one start node
  const starts = nodes.filter(n => n.radiprotocol_nodeType === 'start');
  if (starts.length === 1) ok('I1'); else fail('I1', `expected 1 start, found ${starts.length}`);

  // I2 + I3: every loop has at least one + edge AND at least one body edge
  const loops = nodes.filter(n => n.radiprotocol_nodeType === 'loop');
  for (const lp of loops) {
    const out = edges.filter(e => e.fromNode === lp.id);
    const plusEdges = out.filter(e => (e.label ?? '').startsWith('+'));
    const bodyEdges = out.filter(e => !(e.label ?? '').startsWith('+'));
    if (plusEdges.length >= 1) ok(`I2[${lp.id}]`);
    else fail(`I2[${lp.id}]`, `loop "${lp.radiprotocol_headerText}" has no +exit edge`);
    if (bodyEdges.length >= 1) ok(`I3[${lp.id}]`);
    else fail(`I3[${lp.id}]`, `loop "${lp.radiprotocol_headerText}" has no body edges`);
  }

  // I4: every snippet has exactly one of subfolderPath / snippetPath
  const snippets = nodes.filter(n => n.radiprotocol_nodeType === 'snippet');
  for (const s of snippets) {
    const hasFolder = s.radiprotocol_subfolderPath != null;
    const hasFile = s.radiprotocol_snippetPath != null;
    if (hasFolder !== hasFile) ok(`I4[${s.id}]`);
    else fail(`I4[${s.id}]`, `snippet has both/neither of subfolderPath, snippetPath (folder=${hasFolder}, file=${hasFile})`);
  }

  // I5: every section header from spec.sectionHeaders appears as a text-block whose text starts with '\n' + header
  if (spec?.sectionHeaders) {
    for (const h of spec.sectionHeaders) {
      const found = nodes.some(n => n.radiprotocol_nodeType === 'text-block' && n.text && n.text.includes(h));
      if (found) ok(`I5[${h}]`);
      else fail(`I5[${h}]`, `section header "${h}" not found in any text-block`);
    }
  }

  // I6 + I7: Заключение and Рекомендации texts appear verbatim
  const raw = JSON.stringify(canvasJSON);
  if (spec?.zaklyuchenie) {
    if (raw.includes(spec.zaklyuchenie)) ok('I6');
    else fail('I6', `Заключение text not found verbatim`);
  }
  if (spec?.rekomendatsii) {
    if (raw.includes(spec.rekomendatsii)) ok('I7');
    else fail('I7', `Рекомендации text not found verbatim`);
  }

  // I8: edge referential integrity
  const nodeIds = new Set(nodes.map(n => n.id));
  let i8Fails = 0;
  for (const e of edges) {
    if (!nodeIds.has(e.fromNode) || !nodeIds.has(e.toNode)) {
      i8Fails++;
      fail('I8', `edge ${e.id} references missing node (from=${e.fromNode}, to=${e.toNode})`);
    }
  }
  if (i8Fails === 0) ok('I8');

  // I9: BFS from start reaches every node
  if (starts.length === 1) {
    const adj = new Map();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) {
      if (adj.has(e.fromNode)) adj.get(e.fromNode).push(e.toNode);
    }
    const visited = new Set();
    const q = [starts[0].id];
    while (q.length) {
      const v = q.shift();
      if (visited.has(v)) continue;
      visited.add(v);
      for (const w of (adj.get(v) || [])) q.push(w);
    }
    const orphans = nodes.filter(n => !visited.has(n.id));
    if (orphans.length === 0) ok('I9');
    else fail('I9', `${orphans.length} unreachable nodes: ${orphans.slice(0, 5).map(n => `${n.id}(${n.radiprotocol_nodeType})`).join(', ')}${orphans.length > 5 ? '…' : ''}`);
  }

  // I10: every '==' pairs on the same line within text fields
  let i10Fails = 0;
  for (const n of nodes) {
    if (n.text == null) continue;
    for (const line of n.text.split('\n')) {
      const count = (line.match(/==/g) || []).length;
      if (count % 2 !== 0) {
        i10Fails++;
        fail('I10', `unmatched == in node ${n.id}: "${line}"`);
        break;
      }
    }
  }
  if (i10Fails === 0) ok('I10');

  return findings;
}

export function reportFindings(canvasName, findings) {
  const passed = findings.filter(f => f.status === 'pass').length;
  const failed = findings.filter(f => f.status === 'fail').length;
  console.log(`\n[${canvasName}] ${passed} pass, ${failed} fail (${findings.length} checks)`);
  for (const f of findings) {
    if (f.status === 'fail') console.log(`  FAIL ${f.inv}: ${f.msg}`);
  }
  return failed === 0;
}
