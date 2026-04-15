---
phase: 34
plan: 05
type: uat
created: 2026-04-15
---

# Phase 34 — UAT (Human Verification Checklist)

> Цель: прогнать все Success Criteria фазы 34 (DnD move, Move to…, F2 inline rename, canvas-ref sync, persistence-across-reload) в реальном Obsidian vault с настоящими `.canvas` файлами.
>
> **Как использовать:** открой этот файл в Obsidian, проставляй галочки по мере прохождения шагов. Любой FAIL — остановись, опиши шаг и поведение, НЕ подписывай Sign-off.

---

## Preflight

- [ ] **P1.** Запущен `npm run dev` в репо; плагин RadiProtocol перезагружен в Obsidian (Settings → Community plugins → RadiProtocol → disable/enable).
- [ ] **P2.** В тестовом vault есть корневая папка сниппетов (см. Settings → RadiProtocol → Snippet root) с **минимум 3 вложенными папками** разной глубины и **минимум 2-мя `.canvas` файлами**, SnippetNode'ы в которых ссылаются на сниппет-папки на разной глубине.
- [ ] **P3.** Сделан git snapshot / ручная копия папки сниппетов (zip или commit) — откат возможен на случай если UAT обнаружит регрессию.

---

## Part A — Drag-and-Drop (MOVE-01, MOVE-02)

> Success Criterion #1: файлы и папки переносятся мышью в дерево SnippetManagerView.

- [ ] **A1.** Перетащить `.json` сниппет-файл на другую папку в дереве. Ожидается: файл появляется в новой папке, исчезает из старой. Перезагрузить Obsidian (Ctrl+R) — файл остался в новой папке.
- [ ] **A2.** Перетащить `.md` сниппет на другую папку. Ожидается: то же поведение, файл сохраняется.
- [ ] **A3.** Перетащить **папку с 2+ вложенными сниппетами** на другую top-level папку. Ожидается: вся поддерево едет целиком, ни один файл не потерян.
- [ ] **A4.** Попытаться перетащить папку саму на себя. Ожидается: drop отклонён (красный `drop-forbidden` outline, курсор not-allowed, vault без изменений).
- [ ] **A5.** Попытаться перетащить папку на одного из своих потомков (`root/a` → `root/a/sub`). Ожидается: drop отклонён, vault без изменений.
- [ ] **A6.** Перетащить файл из **собственного файл-эксплорера Obsidian** (не из нашего дерева) поверх строки в snippet tree. Ожидается: наш drop handler игнорирует drag (класс `.radi-snippet-tree-drop-target` НЕ появляется, Obsidian ведёт себя по умолчанию).

---

## Part B — Context Menu «Переместить в…» (MOVE-03)

> Success Criterion #2, ветка context menu.

- [ ] **B7.** Right-click по файлу → «Переместить в…». Ожидается: открывается SuggestModal со списком всех папок сниппет-дерева; выбрать папку → файл перемещён, Notice «Сниппет перемещён.».
- [ ] **B8.** Right-click по папке `root/foo` → «Переместить в…». Ожидается: в picker **нет** самой `root/foo` и её потомков (`root/foo/*`); остальные папки присутствуют.
- [ ] **B9.** В открытом picker начать печатать — fuzzy/substring фильтр сужает список в реальном времени.
- [ ] **B10.** Escape в picker → никаких перемещений не происходит, диалог закрывается.

---

## Part C — Modal «Папка» dropdown (MOVE-04)

> Success Criterion #2, ветка modal (регрессия Phase 33 → Phase 34).

- [ ] **C11.** Double-click (или context-menu «Редактировать») по сниппету → в модалке изменить поле «Папка» на другую папку → Save. Ожидается: Notice **ровно** «Сниппет перемещён.» — **БЕЗ** суффикса «Обновлено канвасов: N». Файл появляется в новой папке.
- [ ] **C12.** Редактировать тот же сниппет, изменить **только контент** (не трогая dropdown «Папка») → Save. Ожидается: сниппет сохранён на месте, Notice «Сниппет сохранён.» (или эквивалент), **НЕ** «перемещён».

---

## Part D — Inline rename (F2) (RENAME-01, RENAME-02)

> Success Criterion #3: F2 переименование файлов и папок.

- [ ] **D13.** Кликнуть по строке файла в дереве (чтобы row получил focus), нажать **F2**. Ожидается: label заменяется на `<input>`, содержащий basename **без расширения** (выделен). Ввести новое имя, Enter → файл переименован, расширение сохранено.
- [ ] **D14.** F2 на строке файла, Escape. Ожидается: rename отменён, label восстановлен с исходным именем, vault без изменений.
- [ ] **D15.** F2 на файле, ввести новое имя, **кликнуть вне input** (blur). Ожидается: rename закоммичен через blur.
- [ ] **D16.** F2 на файле, ввести новое имя, **Enter**. Ожидается: rename выполнен **ровно один раз** (settled flag защищает от Enter→commit→blur→double-commit).
- [ ] **D17.** Right-click по файлу → «Переименовать». Ожидается: тот же inline-rename flow (input с basename, Enter/Escape/blur работают).
- [ ] **D18.** F2 на **строке папки** → rename папки. Ожидается: папка переименована, содержимое целиком едет под новое имя.
- [ ] **D19.** Right-click по папке → «Переименовать». Ожидается: inline-rename для папки через context menu.
- [ ] **D20.** Попробовать переименовать файл/папку в имя, которое **уже существует** рядом (collision). Ожидается: ошибка в виде русского Notice, исходный файл/папка без изменений.

---

## Part E — Canvas reference sync (MOVE-05, RENAME-03)

> Success Criterion #4: после move/rename **папки**, SnippetNode'ы в `.canvas` по-прежнему резолвятся. File-only move/rename канвас не трогает (SnippetNode хранит только папку).

- [ ] **E21.** Создать `.canvas` с SnippetNode, у которого `radiprotocol_subfolderPath` = `folder-a/subfolder` (через UI: Snippet Node Editor → выбрать папку). Закрыть канвас.
- [ ] **E22.** **Rename `folder-a` → `folder-x`** через F2 в snippet tree. Открыть тот самый `.canvas` заново → SnippetNode всё ещё валиден; открыть runner на этом канвасе → snippet picker находит сниппеты из `folder-x/subfolder`.
- [ ] **E23.** **Переместить `folder-x/subfolder` в `folder-b`** через drag-and-drop в дереве. Открыть канвас снова → SnippetNode по-прежнему резолвится (`radiprotocol_subfolderPath` теперь `folder-b/subfolder`). Runner работает.
- [ ] **E24.** **Глубокая вложенность:** переименовать grandparent-папку, у которой есть вложенные вложенные папки, на которые ссылаются SnippetNode'ы → все descendants канвас-рефов работают после rename.
- [ ] **E25.** **File-only rename (негативная проверка):** переименовать `.json` сниппет-файл. Ожидается: `.canvas` файлы **НЕ** меняются (SnippetNode хранит папку, не файл). Канвас и runner работают как раньше.
- [ ] **E26.** **File-only move (негативная проверка):** перетащить `.json` файл между папками через DnD. Ожидается: `.canvas` файлы НЕ меняются. Runner работает как раньше.

---

## Part F — Persistence + edge cases (Success Criterion #5)

> Success Criterion #5: move/rename переживают полную перезагрузку Obsidian.

- [ ] **F27.** Выполнить микс: 2 DnD move'а файлов, 1 DnD move папки, 1 F2 rename файла, 1 F2 rename папки. **Полностью перезагрузить Obsidian** (Ctrl+R или quit + reopen, не просто disable/enable плагина).
- [ ] **F28.** После reload: expand-state дерева сохранился — папки, которые были раскрыты до move/rename, остались раскрытыми на новых путях (в том числе переименованная папка всё ещё раскрыта).
- [ ] **F29.** Открыть один из перемещённых файлов → контент **byte-for-byte идентичен** до-move версии (сравнить с git snapshot из P3 если сомнения).
- [ ] **F30.** Переместить папку, **которая была раскрыта** в дереве, DnD. Ожидается: после move папка раскрыта на новом месте (expand-state rewrite отработал).
- [ ] **F31.** Быстро подряд (≥ 5 move'ов за 5 секунд) DnD-перетащить несколько файлов. Ожидается: ни один файл не потерян, нет застрявшего `.radi-snippet-tree-drop-target` или `.radi-snippet-tree-drop-forbidden` класса на row'ах, tree перерисовывается корректно.

---

## Sign-off

- [ ] Все шаги Preflight (P1–P3) выполнены
- [ ] Part A (A1–A6) — Success Criterion #1 (DnD move) — PASS
- [ ] Part B (B7–B10) + Part C (C11–C12) — Success Criterion #2 (context menu + modal «Папка») — PASS
- [ ] Part D (D13–D20) — Success Criterion #3 (F2 inline rename, включая ветку контекст-меню «Переименовать») — PASS
- [ ] Part E (E21–E26) — Success Criterion #4 (canvas-ref sync на folder rename/move; file-only no-op) — PASS
- [ ] Part F (F27–F31) — Success Criterion #5 (persistence across Obsidian reload) — PASS

**Подписант:** _______________________  **Дата:** _______________________

**Решение:** ⬜ Approved   ⬜ Rejected (see failure notes)

**Failure notes (если есть):**

```
Step: <номер шага>
Expected: <ожидание>
Actual: <что произошло>
```
