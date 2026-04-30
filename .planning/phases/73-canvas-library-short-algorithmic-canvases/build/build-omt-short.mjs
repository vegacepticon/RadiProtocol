// Build ОМТ short 1.0.0.canvas per 73-03-PLAN.md.
// Source templates:
//   - Z:\projects\references\short - ОГК ОБП ОМТ жен.md lines 15-17 (Жен sub-flow)
//   - Z:\projects\references\short - ОГК ОБП ОМТ муж.md lines 17-21 (Муж sub-flow)
// Reference shape: Phase 72 build-omt.mjs sex fan-out skeleton minus the Контраст inner fan-out (D-06).
//   - 2-way (Жен/Муж) instead of 4-way (sex × contrast)
//   - Per-sex sub-flows are linear section() chains (no loops per D-04)
//   - Both sub-flows converge to ONE shared terminal Заключение + Рекомендации (D-07)

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from '../../72-canvas-library-full-algorithmic-canvases/build/canvas-builder.mjs';

const c = new Canvas('8'); // ОМТ short → prefix '8'

const X_FEM = -1500;     // female trunk x-anchor
const X_MUZH = 1500;     // male trunk x-anchor
const NORM_DX = -340;
const FREE_DX = 340;
const SNIP_DX = 720;
const STEP = 160;

// Trunk-aware section helper (verbatim from Phase 72 build-omt.mjs lines 22-40)
function section(c, { trunkX, headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: trunkX, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: trunkX, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: trunkX + NORM_DX, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, displayLabel: 'Опишу вручную', x: trunkX + FREE_DX, y: y + STEP * 2, height: 80 });
  c.edge({ from: header, to: question });
  c.edge({ from: question, to: norm, label: 'Норма' });
  c.edge({ from: question, to: free, label: 'Опишу вручную' });
  const branchIds = [norm, free];
  if (snippetSubfolder) {
    const snip = c.snippetFolder({
      subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
      x: trunkX + SNIP_DX, y: y + STEP * 2, height: 80,
    });
    c.edge({ from: question, to: snip, label: snippetLabel });
    branchIds.push(snip);
  }
  return { header, branches: branchIds };
}

function converge(c, branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}

// ============================================================
// Sex fan-out at top — D-05 (NO procedure preamble per Pattern S5; NO Контраст fan-out per D-06)
// ============================================================
const start = c.start({ x: 0, y: -400 });
const qSex = c.question({ text: 'Пол пациента?', x: 0, y: -240 });
c.edge({ from: start, to: qSex });

const aFem = c.answer({ text: '', displayLabel: 'Жен', x: X_FEM, y: -80 });
const aMuzh = c.answer({ text: '', displayLabel: 'Муж', x: X_MUZH, y: -80 });
c.edge({ from: qSex, to: aFem, label: 'Жен' });
c.edge({ from: qSex, to: aMuzh, label: 'Муж' });

// ============================================================
// Жен sub-flow on X_FEM trunk — verbatim from short-жен MD lines 15-17
// 4 sections: МАТКА → ПРИДАТКИ → ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ → КОСТНЫЕ СТРУКТУРЫ
// ============================================================
let yFem = 200;

// МАТКА — D-12 chips: ==размер тела матки мм==, ==размер шейки матки мм==
const fem_uterus = section(c, {
  trunkX: X_FEM,
  headerText: 'МАТКА:',
  normText: 'Тело матки в поперечнике до ==размер тела матки мм== мм. Шейка матки до ==размер шейки матки мм== мм.',
  normHeight: 80,
  sectionName: 'маткой',
  snippetSubfolder: 'ОМТ',
  y: yFem,
});
c.edge({ from: aFem, to: fem_uterus.header });
yFem += STEP * 2 + 200;

// ПРИДАТКИ — D-12 chips: ==придатки справа==, ==придатки слева==
const fem_adnexa = section(c, {
  trunkX: X_FEM,
  headerText: 'ПРИДАТКИ:',
  normText: 'Придатки: справа - ==придатки справа==, слева - ==придатки слева==.',
  sectionName: 'придатками',
  snippetSubfolder: 'ОМТ',
  y: yFem,
});
converge(c, fem_uterus.branches, fem_adnexa.header);
yFem += STEP * 2 + 200;

// ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ — verbatim Жен MD line 16
const fem_lymph = section(c, {
  trunkX: X_FEM,
  headerText: 'ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ:',
  normText: 'Подвздошные лимфоузлы не увеличены.',
  sectionName: 'подвздошными лимфоузлами',
  snippetSubfolder: 'ОМТ',
  y: yFem,
});
converge(c, fem_adnexa.branches, fem_lymph.header);
yFem += STEP * 2 + 200;

// КОСТНЫЕ СТРУКТУРЫ — D-11: hardcoded text-block (no КОСТИ snippet picker), Жен MD line 17
const fem_bones = section(c, {
  trunkX: X_FEM,
  headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-деструктивных изменений не выявлено.',
  sectionName: 'костными структурами',
  y: yFem,
});
converge(c, fem_lymph.branches, fem_bones.header);
yFem += STEP * 2 + 200;

// ============================================================
// Муж sub-flow on X_MUZH trunk — verbatim from short-муж MD lines 17-21
// 4 sections: ПРОСТАТА → СЕМЕННЫЕ ПУЗЫРЬКИ → ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ → КОСТНЫЕ СТРУКТУРЫ
// ============================================================
let yMuzh = 200;

// ПРОСТАТА — D-12 chip: ==размер простаты мм==
const muzh_prostate = section(c, {
  trunkX: X_MUZH,
  headerText: 'ПРОСТАТА:',
  normText: 'Простата в поперечнике до ==размер простаты мм== мм.',
  sectionName: 'простатой',
  snippetSubfolder: 'ОМТ',
  y: yMuzh,
});
c.edge({ from: aMuzh, to: muzh_prostate.header });
yMuzh += STEP * 2 + 200;

// СЕМЕННЫЕ ПУЗЫРЬКИ — verbatim Муж MD line 17 (second sentence)
const muzh_seminal = section(c, {
  trunkX: X_MUZH,
  headerText: 'СЕМЕННЫЕ ПУЗЫРЬКИ:',
  normText: 'Семенные пузырьки интактны. Окружающая клетчатка не изменена.',
  sectionName: 'семенными пузырьками',
  snippetSubfolder: 'ОМТ',
  y: yMuzh,
});
converge(c, muzh_prostate.branches, muzh_seminal.header);
yMuzh += STEP * 2 + 200;

// ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ — verbatim Муж MD line 19
const muzh_lymph = section(c, {
  trunkX: X_MUZH,
  headerText: 'ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ:',
  normText: 'Подвздошные лимфоузлы не увеличены.',
  sectionName: 'подвздошными лимфоузлами',
  snippetSubfolder: 'ОМТ',
  y: yMuzh,
});
converge(c, muzh_seminal.branches, muzh_lymph.header);
yMuzh += STEP * 2 + 200;

// КОСТНЫЕ СТРУКТУРЫ — D-11 hardcoded, Муж MD line 21
const muzh_bones = section(c, {
  trunkX: X_MUZH,
  headerText: 'КОСТНЫЕ СТРУКТУРЫ:',
  normText: 'Костно-деструктивных изменений не выявлено.',
  sectionName: 'костными структурами',
  y: yMuzh,
});
converge(c, muzh_lymph.branches, muzh_bones.header);
yMuzh += STEP * 2 + 200;

// ============================================================
// Shared terminal Заключение/Рекомендации — D-07: both sub-trunks converge to ONE node
// Verbatim from short MD lines 19-26; trailing-space `РКТ-признаки ` becomes `РКТ-признаки ==диагноз==` per D-13.
// ============================================================
const yTerm = Math.max(yFem, yMuzh) + 200;
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаки ==диагноз==\n\n## Рекомендации\nКонсультация направившего специалиста.',
  x: 0, y: yTerm, height: 240,
});
converge(c, fem_bones.branches, terminal);
converge(c, muzh_bones.branches, terminal);

// ============================================================
// Verify + write
// ============================================================
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: [
    'МАТКА:', 'ПРИДАТКИ:', 'ПРОСТАТА:', 'СЕМЕННЫЕ ПУЗЫРЬКИ:',
    'ПОДВЗДОШНЫЕ ЛИМФОУЗЛЫ:', 'КОСТНЫЕ СТРУКТУРЫ:',
  ],
  zaklyuchenie: 'РКТ-признаки',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ОМТ short 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ОМТ short 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
