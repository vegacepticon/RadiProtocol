// Build ПКОП 1.0.0.canvas per 72-05-PLAN.md.
// Single trunk (no contrast — non-contrast spine MSCT).
// 8 sections + 2 loops:
//   - ПОЗВОНКИ findings loop (D-10)
//   - МЕЖПОЗВОНКОВЫЕ ДИСКИ per-segment loop (D-28: L1-L2 → L5-S1, 5 iterations)

import { writeFileSync } from 'node:fs';
import { Canvas, verifyInvariants, reportFindings } from './canvas-builder.mjs';

const c = new Canvas('5'); // ПКОП → prefix '5'

const X = 0;
const X_NORM = -340;
const X_FREE = 340;
const X_SNIP = 720;
const X_LOOP_BODY = 600;
const STEP = 160;

// === Start + procedure text-block ===
let y = -200;
const start = c.start({ x: X, y });
y += STEP;
const procedure = c.textBlock({
  text: '\nМСКТ-исследование пояснично-крестцового отдела позвоночника выполнено по стандартной программе с последующей мультипланарной реконструкцией.',
  x: X, y, height: 160,
});
c.edge({ from: start, to: procedure });
y += 220;

// Helper: standard linear section
function section({ headerText, normText, normHeight, sectionName, snippetSubfolder, snippetLabel = 'Выберу шаблон', y }) {
  const header = c.textBlock({ text: `\n${headerText}`, x: X, y });
  const question = c.question({ text: `${headerText.replace(':', '')} — норма?`, x: X, y: y + STEP });
  const norm = c.answer({ text: normText, displayLabel: 'Норма', x: X_NORM, y: y + STEP * 2, height: normHeight ?? 60 });
  const free = c.answer({ text: `==напишу что не так${sectionName ? ' с ' + sectionName : ''}==`, displayLabel: 'Опишу вручную', x: X_FREE, y: y + STEP * 2, height: 80 });
  c.edge({ from: header, to: question });
  c.edge({ from: question, to: norm, label: 'Норма' });
  c.edge({ from: question, to: free, label: 'Опишу вручную' });
  const branchIds = [norm, free];
  if (snippetSubfolder) {
    const snip = c.snippetFolder({
      subfolderPath: snippetSubfolder, text: snippetSubfolder, snippetLabel,
      x: X_SNIP, y: y + STEP * 2, height: 80,
    });
    c.edge({ from: question, to: snip, label: snippetLabel });
    branchIds.push(snip);
  }
  return { header, branches: branchIds };
}

function converge(branches, target) {
  for (const b of branches) c.edge({ from: b, to: target });
}

// === Section 1: АНОМАЛИИ РАЗВИТИЯ ===
const sec1 = section({ headerText: 'АНОМАЛИИ РАЗВИТИЯ:', normText: 'Не выявлено.', sectionName: 'аномалиями развития', y });
c.edge({ from: procedure, to: sec1.header });
y += STEP * 2 + 200;

// === Section 2: СТАТИКА ===
const sec2 = section({
  headerText: 'СТАТИКА:',
  normText: 'Поясничный лордоз ==лордоз вариант==.\nОсь позвоночника ==ось вариант==, с вершиной угла на уровне ==L уровень== и углом наклона ==угол наклона градусов== градусов (без нагрузки).',
  normHeight: 200, sectionName: 'статикой', y,
});
converge(sec1.branches, sec2.header);
y += STEP * 2 + 260;

// === Section 3: ПОЗВОНКИ + ПОЗВОНКИ findings loop ===
const sec3 = section({
  headerText: 'ПОЗВОНКИ:',
  normText: 'Форма тел поясничных позвонков обычная.\nВысота тел позвонков не изменена.\nКонтуры тел позвонков ровные, целостность кортикальных слоев не нарушена.\nКостная структура позвонков не изменена.\nВнутрителовые узлы (грыжи) Шморля ==L уровни Шморля==.\nСоотношения между позвонками не нарушены. Анте/ ретролистез позвонка ==L листез== до ==мм листеза== мм.\nПризнаки спондилоартроза нерезко/умеренно выражены на уровнях L1-S1, проявляющиеся в неравномерном сужении суставных щелей, субхондральном склерозе, гипертрофии суставных фасеток, деформацией их остеофитами, наличии вакуум-включений.\nПо передним, боковым и задним контурам тел позвонков ==L разрастания== нерезко/ умеренно выражены костные разрастания.\nМежостистое расстояние не уменьшено/ уменьшено на уровнях ==L неоартрозов== с формированием неоартрозов.',
  normHeight: 480, sectionName: 'позвонками', y,
});
converge(sec2.branches, sec3.header);
y += STEP * 2 + 540;

// ПОЗВОНКИ loop
const vertebrateLoop = c.loop({
  text: 'Есть изменения позвонков?',
  headerText: 'Есть изменения позвонков?',
  x: X, y, height: 100,
});
converge(sec3.branches, vertebrateLoop);
const vlNo = c.answer({ text: '', displayLabel: 'Нет', x: X_LOOP_BODY, y, height: 60 });
const vlSnip = c.snippetFolder({ subfolderPath: 'ПОЗВОНОЧНИК', text: 'ПОЗВОНОЧНИК', snippetLabel: 'Выберу шаблон', x: X_LOOP_BODY, y: y + 120, height: 80 });
const vlFree = c.answer({ text: '==опишу изменение позвонков==', displayLabel: 'Опишу вручную', x: X_LOOP_BODY, y: y + 240, height: 80 });
c.edge({ from: vertebrateLoop, to: vlNo, fromSide: 'right', toSide: 'left', label: 'Нет' });
c.edge({ from: vertebrateLoop, to: vlSnip, fromSide: 'right', toSide: 'left', label: 'Выберу шаблон' });
c.edge({ from: vertebrateLoop, to: vlFree, fromSide: 'right', toSide: 'left', label: 'Опишу вручную' });
c.edge({ from: vlNo, to: vertebrateLoop, fromSide: 'left', toSide: 'right' });
c.edge({ from: vlSnip, to: vertebrateLoop, fromSide: 'left', toSide: 'right' });
c.edge({ from: vlFree, to: vertebrateLoop, fromSide: 'left', toSide: 'right' });
y += 380;

// === Section 4: МЕЖПОЗВОНКОВЫЕ ДИСКИ + per-segment loop ===
const sec4Header = c.textBlock({ text: '\nМЕЖПОЗВОНКОВЫЕ ДИСКИ:', x: X, y });
c.edge({ from: vertebrateLoop, to: sec4Header, label: '+Все указано, продолжаем' });
y += STEP;
// norm prefix text-block (always emitted before per-segment loop)
const sec4Prefix = c.textBlock({
  text: 'Субхондральный склероз замыкательных пластинок тел позвонков L1-S1 нерезко/ умеренно выражен.\nНеравномерно снижена высота межпозвонковых дисков L1-L2-L3-L4-L5-S1, больше выражено в сегменте L4-L5 с наименьшей высотой диска до 2-3 мм.',
  x: X, y, height: 180,
});
c.edge({ from: sec4Header, to: sec4Prefix });
y += 240;

// Per-segment loop (D-28: 5 segments L1-L2 → L5-S1)
const discsLoop = c.loop({
  text: 'Опишу следующий сегмент?',
  headerText: 'Опишу следующий сегмент?',
  x: X, y, height: 100,
});
c.edge({ from: sec4Prefix, to: discsLoop });

// 5 body answers — one per segment, each with verbatim text from .md (with ==fill-in== chips)
const segments = [
  {
    label: 'L1-L2',
    text: 'В сегменте L1-L2: диффузное симметричное выбухание диска дорсальным сагиттальным размером до ==мм L1-L2== мм. Межпозвонковые отверстия на уровне диска ==степень сужения отверстий L1-L2== сужены, в том числе за счет остеофитов/ элементов дугоотросчатых суставов. Просвет позвоночного канала на уровне диска ==степень сужения канала L1-L2== сужен. Сагиттальный размер позвоночного канала на уровне диска до ==мм канала L1-L2== мм.',
  },
  {
    label: 'L2-L3',
    text: 'В сегменте L2-L3: диффузное асимметричное ==сторона выбухания L2-L3== выбухание диска дорсальным сагиттальным размером до ==мм L2-L3== мм. Межпозвонковые отверстия ==степень сужения отверстий L2-L3== сужены, больше ==сторона больше L2-L3== в том числе за счет остеофитов/ элементов дугоотросчатых суставов. Просвет позвоночного канала ==степень сужения канала L2-L3== сужен. Сагиттальный размер позвоночного канала до ==мм канала L2-L3== мм.',
  },
  {
    label: 'L3-L4',
    text: 'В сегменте L3-L4: дорсальная центральная субартикулярная фораминальная ==сторона протрузии L3-L4== протрузия диска до ==мм L3-L4== мм. Межпозвонковые отверстия ==степень сужения отверстий L3-L4== сужены, больше ==сторона больше L3-L4==, в том числе за счет остеофитов/ элементов дугоотросчатых суставов. Просвет позвоночного канала ==степень сужения канала L3-L4== сужен. Сагиттальный размер позвоночного канала до ==мм канала L3-L4== мм.',
  },
  {
    label: 'L4-L5',
    text: 'В сегменте L4-L5: дорсальная центральная субартикулярная фораминальная ==сторона экструзии L4-L5== экструзия диска сагиттальным размером ==мм L4-L5== мм, с ==направление миграции L4-L5== миграцией, на фоне диффузного а/симметричного ==сторона выбухания L4-L5== выбухания диска дорсальным сагиттальным размером до ==мм выбухания L4-L5== мм. Межпозвонковые отверстия ==степень сужения отверстий L4-L5== сужены, больше ==сторона больше L4-L5==, в том числе за счет остеофитов/ элементов дугоотросчатых суставов. Просвет позвоночного канала ==степень сужения канала L4-L5== сужен. Сагиттальный размер позвоночного канала до ==мм канала L4-L5== мм.',
  },
  {
    label: 'L5-S1',
    text: 'В сегменте L5-S1: диффузный а/симметричный ==сторона ДО комплекса L5-S1== дискоостеофитный комплекс дорсальным сагиттальным размером до ==мм L5-S1== мм. Межпозвонковые отверстия ==степень сужения отверстий L5-S1== сужены, больше ==сторона больше L5-S1== в том числе за счет остеофитов/ элементов дугоотросчатых суставов. Просвет позвоночного канала ==степень сужения канала L5-S1== сужен. Сагиттальный размер позвоночного канала до ==мм канала L5-S1== мм.',
  },
];

for (let i = 0; i < segments.length; i++) {
  const seg = segments[i];
  const ny = y + 60 + i * 80; // stack body answers vertically on the right
  const segNode = c.answer({
    text: seg.text, displayLabel: seg.label,
    x: X_LOOP_BODY, y: ny, height: 60, // visual height; overflow handled by Obsidian
  });
  c.edge({ from: discsLoop, to: segNode, fromSide: 'right', toSide: 'left', label: seg.label });
  c.edge({ from: segNode, to: discsLoop, fromSide: 'left', toSide: 'right' });
}
y += 60 + segments.length * 80 + 60;

// === Section 5: ПОЗВОНОЧНЫЙ КАНАЛ ===
const sec5 = section({
  headerText: 'ПОЗВОНОЧНЫЙ КАНАЛ:',
  normText: 'Передне-задний размер на уровне тел позвонков до ==размер канала мм== мм (соответствует норме).',
  normHeight: 100, sectionName: 'позвоночным каналом', snippetSubfolder: 'ПОЗВОНОЧНИК', y,
});
c.edge({ from: discsLoop, to: sec5.header, label: '+Все сегменты описаны' });
y += STEP * 2 + 200;

// === Section 6: ИЛЕО-САКРАЛЬНЫЕ СОЧЛЕНЕНИЯ ===
const sec6 = section({
  headerText: 'ИЛЕО-САКРАЛЬНЫЕ СОЧЛЕНЕНИЯ:',
  normText: 'Умеренно сужены, минимальным просветом до ==мм просвета== мм; со склерозом субхондральных слоев, с шиповидными оссификатами по передней поверхности.',
  normHeight: 160, sectionName: 'илео-сакральными сочленениями', y,
});
converge(sec5.branches, sec6.header);
y += STEP * 2 + 240;

// === Section 7: КРЕСТЕЦ ===
const sec7 = section({
  headerText: 'КРЕСТЕЦ:',
  normText: 'Форма, размеры и структура крестца не изменены.\nЦелостность кортикального слоя не нарушена.\nПатологического смещения крестцовых позвонков не выявлено.\nКрестцово-копчиковое сочленение сужено за счет спондилоартроза.\nКостно-деструктивных и костно-травматических изменений не выявлено.',
  normHeight: 280, sectionName: 'крестцом', snippetSubfolder: 'КОСТИ',
  snippetLabel: 'Выберу шаблон по костям', y,
});
converge(sec6.branches, sec7.header);
y += STEP * 2 + 360;

// === Section 8: ПАРАВЕРТЕБРАЛЬНЫЕ МЯГКИЕ ТКАНИ ===
const sec8 = section({
  headerText: 'ПАРАВЕРТЕБРАЛЬНЫЕ МЯГКИЕ ТКАНИ:',
  normText: 'Не изменены.',
  sectionName: 'паравертебральными мягкими тканями', y,
});
converge(sec7.branches, sec8.header);
y += STEP * 2 + 200;

// === Terminal Заключение + Рекомендации (verbatim from ПКОП остеохондроз.md lines 56-68) ===
const terminal = c.textBlock({
  text: '\n## Заключение\nРКТ-признаки нарушения статики поясничного отдела позвоночника.\nДегенеративные изменения межпозвонковых дисков, протрузии дисков ==L-L дисков==.\nОстеохондроз пояснично-крестцового отдела позвоночника 2 степени.\nДеформирующий спондилоартроз.\nДеформирующий спондилез 2 степени.\nВнутрителовые узлы (грыжи) Шморля ==L Шморля==.\nАртроз илеосакральных сочленений 2 степени.\nСпондилоартроз крестцово-копчикового сочленения.\n\n## Рекомендации\nКонсультация направившего специалиста.\nКонсультация невролога, нейрохирурга, ортопеда-травматолога по показаниям.',
  x: X, y, height: 540,
});
converge(sec8.branches, terminal);

// === Verify + write ===
const json = c.toJSON();
const findings = verifyInvariants(json, {
  sectionHeaders: [
    'АНОМАЛИИ РАЗВИТИЯ:', 'СТАТИКА:', 'ПОЗВОНКИ:', 'МЕЖПОЗВОНКОВЫЕ ДИСКИ:',
    'ПОЗВОНОЧНЫЙ КАНАЛ:', 'ИЛЕО-САКРАЛЬНЫЕ СОЧЛЕНЕНИЯ:', 'КРЕСТЕЦ:', 'ПАРАВЕРТЕБРАЛЬНЫЕ МЯГКИЕ ТКАНИ:',
  ],
  // ПКОП Заключение has multiple lines; verify the FIRST line as anchor (full multi-line check would over-constrain since
  // the .md has literal placeholders L-L and L which are converted to ==fill-in== chips)
  zaklyuchenie: 'РКТ-признаки нарушения статики поясничного отдела позвоночника.',
  rekomendatsii: 'Консультация направившего специалиста.',
});
const ok = reportFindings('ПКОП 1.0.0.canvas', findings);

const VAULT_PATH = 'Z:\\documents\\vaults\\TEST-BASE\\Protocols\\ПКОП 1.0.0.canvas';
writeFileSync(VAULT_PATH, JSON.stringify(json, null, '\t'), 'utf8');
console.log(`\n→ wrote ${VAULT_PATH}`);
console.log(`  nodes: ${json.nodes.length}, edges: ${json.edges.length}`);
console.log(`  loops: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'loop').length}, snippets: ${json.nodes.filter(n => n.radiprotocol_nodeType === 'snippet').length}`);
process.exit(ok ? 0 : 1);
