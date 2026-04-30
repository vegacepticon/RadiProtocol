---
status: partial
phase: 72-canvas-library-full-algorithmic-canvases
source: [72-VERIFICATION.md]
started: 2026-04-30T05:43:44Z
updated: 2026-04-30T05:43:44Z
---

## Current Test

[awaiting human testing — author must open each canvas in Obsidian Protocol Runner and run it end-to-end]

## Tests

### 1. CANVAS-LIB-01 — ГМ canvas end-to-end run
expected: Open `Z:\documents\vaults\TEST-BASE\Protocols\ГМ 1.0.0.canvas`. Run from start. Walk through 7 sections (СРЕДИННЫЕ → ВЕЩЕСТВО → ЛИКВОР → СЕЛЛЯРНАЯ → ПАЗУХИ → ОРБИТЫ → КОСТИ) to terminal. At ВЕЩЕСТВО ГОЛОВНОГО МОЗГА, focal-lesion loop offers 4 picker options (Нет / Выберу шаблон / Опишу вручную / +Все указано, продолжаем). Phase 70 visual hint marks the `+` button. Output contains every section header from `Z:\projects\references\ГМ.md` plus verbatim Заключение «РКТ-признаков патологических изменений в веществе головного мозга не выявлено.» and Рекомендации «Консультация направившего специалиста.»
result: [pending]

### 2. CANVAS-LIB-02 — ОБП full canvas, both contrast branches
expected: Open `ОБП full 1.0.0.canvas`. **Run 1 — Нет (no contrast):** start → пик «Нет» at Контраст → walk ПЕЧЕНЬ→ЖЕЛЧНЫЙ→ПЖ→СЕЛ→КИШ→Аорта-line→ЛУ→МТ→КОСТИ→terminal. Verify ПЕЧЕНЬ + ПОДЖЕЛУДОЧНАЯ ЖЕЛЕЗА loops cycle and exit; СОСУДЫ section is NOT visited. Diff vs `ОБП без контраста.md`. **Run 2 — Да-болюсно (contrast):** Verify СОСУДЫ section IS visited; «Аорта в брюшном отделе...» linear sentence is NOT visited (folded into СОСУДЫ text). Diff vs `ОБП с контрастом.md`. Both runs end with terminal verbatim Заключение «РКТ-признаки патологических изменений органов брюшной полости не выявлены.»
result: [pending]

### 3. CANVAS-LIB-03 — ОЗП canvas, both contrast branches
expected: Open `ОЗП 1.0.0.canvas`. **Run 1 — Нет:** Walk НАДПОЧЕЧНИКИ→ПР.ПОЧКА→ЛЕВ.ПОЧКА→МОЧЕТОЧНИКИ→Жидкости-line→ЛУ→МТ→КОСТИ→terminal. Verify all 3 organ loops cycle and exit; МОЧЕВОЙ ПУЗЫРЬ + СОСУДЫ NOT visited; «Жидкости в забрюшинном...» line IS emitted. Diff vs `ОЗП без контраста.md`. **Run 2 — Да-болюсно:** Verify «положении пациента» line + МОЧЕВОЙ ПУЗЫРЬ + СОСУДЫ ARE visited; standalone «Жидкости...» line NOT emitted. Diff vs `ОЗП с контрастом.md`. Verbatim Заключение «РКТ-признаков патологических изменений органов забрюшинного пространства не выявлено.»
result: [pending]

### 4. CANVAS-LIB-04 — ОМТ full canvas, all 4 sex × contrast paths
expected: Open `ОМТ full 1.0.0.canvas`. Run 4 times — one per gender × contrast combination. **Run 1 (Жен × Нет):** МПУЗ→МАТКА(loop)→ЯИЧ(loop)→КИШ→ЛУ→МТ→КОСТИ→terminal. Diff vs `ОМТ жен без КУ норма.md`. **Run 2 (Жен × Да-болюсно):** + СОСУДЫ + Паховые-каналы line. Diff vs `ОМТ жен с КУ норма.md`. **Run 3 (Муж × Нет):** МПУЗ→ПРЕДСТАТ→СЕМ.ПУЗ→КИШ→ЛУ→МТ→Паховые-каналы→КОСТИ→terminal. Diff vs `ОМТ муж без контраста.md`. **Run 4 (Муж × Да-болюсно):** + СОСУДЫ. Diff vs `ОМТ муж с контрастом.md`. Verify gender-specific organs route correctly (МАТКА/ЯИЧНИКИ on жен only; ПРЕДСТАТ/СЕМ.ПУЗ on муж only). Verbatim Заключение (normalized per RESEARCH §4): «РКТ-признаков патологических изменений органов малого таза не выявлено.»
result: [pending]

### 5. CANVAS-LIB-05 — ПКОП canvas, full disc-segment walk
expected: Open `ПКОП 1.0.0.canvas`. Run from start. Walk АНОМАЛИИ→СТАТИКА→ПОЗВОНКИ (loop pick «Нет» + `+Все указано, продолжаем`)→МЕЖПОЗВОНКОВЫЕ ДИСКИ. **Critical:** at МЕЖПОЗВОНКОВЫЕ ДИСКИ loop, pick all 5 vertebral segments in order (L1-L2 → L2-L3 → L3-L4 → L4-L5 → L5-S1) before `+Все сегменты описаны` exit. Each segment emits its verbatim per-segment text. Continue: ПОЗВОНОЧНЫЙ КАНАЛ→ИЛЕО-САКРАЛЬНЫЕ→КРЕСТЕЦ→ПАРАВЕРТ.МТ→terminal. Diff vs `ПКОП остеохондроз.md` lines 4-69. Verbatim Заключение first line: «РКТ-признаки нарушения статики поясничного отдела позвоночника.»
result: [pending]

### 6. Pitfall sweep across all 5 canvases
expected: For each of the 5 canvases, in Obsidian visually confirm:
  (a) `+`-prefix exit edges of every loop have Phase 70 distinct background (Pitfall 1);
  (b) Every loop body branch returns to its loop header — no body picker option silently advances past the loop (Pitfall 2);
  (c) No snippet picker shows entries from a sister-canvas folder (Pitfall 9 / D-04, D-05) — open each loop's snippet picker and confirm only the canvas's own folder contents appear.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
