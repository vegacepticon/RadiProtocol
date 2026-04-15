---
phase: 34
plan: 05
type: uat
created: 2026-04-15
completed: 2026-04-15
status: approved
signer: Роман
---

# Phase 34 — UAT (Human Verification Checklist)

> Цель: прогнать все Success Criteria фазы 34 (DnD move, Move to…, F2 inline rename, canvas-ref sync, persistence-across-reload) в реальном Obsidian vault с настоящими `.canvas` файлами.
>
> **Итоговое решение (2026-04-15): APPROVED.** UAT прошёл после двух post-UAT фиксов (`77b62c1`, `fd0d50d`) — см. раздел Sign-off.

---

## Preflight

- [+] **P1.** Запущен `npm run dev` в репо; плагин RadiProtocol перезагружен в Obsidian.
- [+] **P2.** В тестовом vault есть корневая папка сниппетов с несколькими вложенными папками разной глубины и минимум 2 `.canvas` файлами со SnippetNode'ами на разной глубине.
- [-] **P3.** Git snapshot / ручная копия папки сниппетов — пользователь сознательно пропустил шаг (не требуется для итогового approval).

---

## Part A — Drag-and-Drop (MOVE-01, MOVE-02) — PASS

- [+] **A1.** Перетащить `.json` сниппет-файл на другую папку → файл переехал, переживает Ctrl+R.
- [+] **A2.** Перетащить `.md` сниппет на другую папку → то же поведение.
- [+] **A3.** Перетащить папку с 2+ вложенными сниппетами → поддерево едет целиком.
- [+] **A4.** Попытка drop'а папки самой на себя → отклонено (красный outline, без изменений).
- [+] **A5.** Попытка drop'а папки на своего потомка → отклонено.
- [+] **A6.** Drop из встроенного file explorer'а Obsidian → наш handler игнорирует.

---

## Part B — Context Menu «Переместить в…» (MOVE-03) — PASS

- [+] **B7.** ПКМ по файлу → «Переместить в…» → SuggestModal со списком папок → выбор → файл перемещён, Notice «Сниппет перемещён.».
- [+] **B8.** ПКМ по папке `root/foo` → picker без самой `root/foo` и потомков.
- [+] **B9.** Ввод в picker → fuzzy/substring фильтр в реальном времени.
- [+] **B10.** Escape → перемещение не выполняется.

---

## Part C — Modal «Папка» dropdown (MOVE-04) — PASS

- [+] **C11.** В модалке изменить «Папка» → Save → Notice ровно «Сниппет перемещён.» (без «Обновлено канвасов: N»), файл в новой папке.
- [+] **C12.** Изменить только контент → Save → сниппет сохранён, без «перемещён».

---

## Part D — Inline rename (F2 + ПКМ) (RENAME-01, RENAME-02) — PASS

> **Контекст результата:** во время первой итерации UAT пользователь не видел реакции на F2. Причина — `startInlineRename` читал родителя через `.parent` (существующий только в мок-DOM тестов), а в реальном Obsidian нужен `parentElement`; транзиентный `<input>` аппендился внутрь скрытого `<label>`. Post-UAT фикс `77b62c1` (`fix(34-05): use parentElement in startInlineRename so F2/ПКМ rename works in real DOM`) восстановил реальный-DOM путь без поломки 10 mock-тестов.
>
> Дополнительно: пользователь обнаружил, что на его установке Obsidian хоткей F2 был занят нативной командой — отвязал её через Settings → Hotkeys, после чего F2 стал отрабатывать. ПКМ-меню «Переименовать» работает безусловно на любой инсталляции.

- [+] **D13.** F2 на файле → `<input>` с basename без расширения → Enter → переименовано.
- [+] **D14.** F2 → Escape → rename отменён.
- [+] **D15.** F2 → ввод → blur вне input → commit через blur.
- [+] **D16.** F2 → Enter → commit ровно один раз (settled-guard работает).
- [+] **D17.** ПКМ по файлу → «Переименовать» → тот же inline-rename flow.
- [+] **D18.** F2 на папке → папка переименована с содержимым.
- [+] **D19.** ПКМ по папке → «Переименовать» → работает.
- [+] **D20.** Rename в уже существующее имя → русский Notice об ошибке, исходник не тронут.

---

## Part E — Canvas reference sync (MOVE-05, RENAME-03) — PASS

> **Важный контекст для истории:** несколько пунктов этой секции изначально проверялись пользователем через НАТИВНЫЙ rename в file explorer'е Obsidian, а не через F2/ПКМ в нашем snippet tree. Нативный rename **не проходит через наши rename-события** и, следовательно, не триггерит `rewriteCanvasRefs` — это ожидаемо и вне scope фазы 34 (мы ловим собственные UI-события, а не vault-level rename'ы). После переключения на нашу F2 / drag-and-drop / ПКМ-«Переместить в…» все Canvas-ссылки обновляются корректно, Runner резолвит сниппеты из новых путей.
>
> Дополнительно: post-UAT фикс `fd0d50d` (`fix(34-05): modal save preserves pure name rename via renameSnippet`) починил баг в Plan 34-04, из-за которого modal save на pure-name-rename вызывал `moveSnippet` на ту же папку и название терялось; теперь handleSave декомпозирует delta на три ветки (save-in-place / moveSnippet / renameSnippet) и Notice выбирается адекватно («Сниппет перемещён.», «Сниппет переименован.», «Сниппет перемещён и переименован.»).

- [+] **E21.** Создать `.canvas` со SnippetNode `radiprotocol_subfolderPath = folder-a/subfolder`.
- [+] **E22.** F2-rename `folder-a` → `folder-x` → канвас по-прежнему резолвится, runner находит сниппеты из `folder-x/subfolder`.
- [+] **E23.** DnD-переместить `folder-x/subfolder` в `folder-b` → Notice об обновлении канваса, snippet находится, Runner работает.
- [+] **E24.** Глубокая вложенность: rename grandparent-папки через F2 → все descendants рефов работают.
- [+] **E25.** File-only rename `.json` сниппета (через UI, post-fix `fd0d50d`) → `.canvas` не меняется, Notice «Сниппет переименован.».
- [+] **E26.** File-only move `.json` через DnD → `.canvas` не меняется, Runner работает.

---

## Part F — Persistence + edge cases (Success Criterion #5) — PASS

- [+] **F27.** Mix: 2 DnD-файла, 1 DnD-папка, 1 F2 rename файла, 1 F2 rename папки → полная перезагрузка Obsidian → всё на новых путях.
- [+] **F28.** Expand-state дерева сохранён — раскрытые папки остались раскрытыми на новых путях (в т.ч. переименованные).
- [+] **F29.** Контент перемещённого файла byte-for-byte идентичен до-move версии.
- [+] **F30.** Move папки в раскрытом состоянии → раскрыта на новом месте.
- [+] **F31.** ≥ 5 DnD move'ов за 5 секунд → все файлы на месте, нет «прилипших» `.radi-snippet-tree-drop-target` классов, tree перерисован.

---

## Sign-off

- [+] Все шаги Preflight (P1–P3) выполнены (P3 пропущен сознательно).
- [+] Part A (A1–A6) — Success Criterion #1 (DnD move) — **PASS**
- [+] Part B (B7–B10) + Part C (C11–C12) — Success Criterion #2 (context menu + modal «Папка») — **PASS**
- [+] Part D (D13–D20) — Success Criterion #3 (F2 inline rename + ПКМ «Переименовать») — **PASS** (после фикса `77b62c1`)
- [+] Part E (E21–E26) — Success Criterion #4 (canvas-ref sync на folder rename/move; file-only no-op) — **PASS** (после фикса `fd0d50d`)
- [+] Part F (F27–F31) — Success Criterion #5 (persistence across Obsidian reload) — **PASS**

**Подписант:** Роман  **Дата:** 2026-04-15

**Решение:** ✅ **Approved**   ⬜ Rejected

### Post-UAT фиксы, вошедшие в approval

| Commit | Что исправлено |
|---|---|
| `77b62c1` | `fix(34-05): use parentElement in startInlineRename so F2/ПКМ rename works in real DOM` — восстановлен реальный-DOM путь inline-rename. |
| `fd0d50d` | `fix(34-05): modal save preserves pure name rename via renameSnippet` — декомпозиция delta в modal handleSave, pure-rename больше не теряется. |

### Failure notes

Отсутствуют — все секции закрыты PASS.

### Known limitations (follow-up, не блокирующее)

- **Node Editor panel stale `subfolderPath` display после folder-move.** После перемещения/переименования папки, на которую ссылается выделенный SnippetNode, панель Node Editor продолжает показывать старый `subfolderPath` до тех пор, пока пользователь не выберет другой узел и не вернётся обратно. Под капотом данные корректны (`.canvas` JSON обновлён через `rewriteCanvasRefs`, Runner резолвит из нового пути), это чисто cosmetic panel-refresh gap в **соседнем** компоненте, не регрессия фазы 34. См. `34-VERIFICATION.md` § Follow-up work.
