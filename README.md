# RadiProtocol

RadiProtocol is an [Obsidian](https://obsidian.md) plugin for radiologists who want to run structured examination protocols inside their reporting vault. It turns a protocol into a guided clinical checklist: choose the relevant branch, insert prepared report text or snippets, repeat sections for multiple findings, and write the generated text into the active Markdown note.

Protocols are authored as **`.rp.json`** files in the built-in visual protocol editor. Legacy `.canvas` protocol files can still be used and migrated, but new protocol work should use `.rp.json`.

**Latest release:** 1.22.15

## What RadiProtocol helps with

- **Standardized radiology reporting.** Encode local protocols, modality workflows, follow-up recommendations, or structured report templates as reusable decision trees.
- **Guided branching.** Question and answer nodes let the radiologist choose the clinically appropriate path without searching through long static templates.
- **Reusable report fragments.** Snippet nodes insert prepared text from a configurable snippet folder. JSON snippets can ask for typed placeholders such as free text, choice, multi-choice, number, or date.
- **Repeated findings.** Loop nodes support workflows such as multiple lesions, multiple nodules, repeated measurements, or several anatomical levels.
- **Inline note-anchored execution.** The runner opens as a draggable inline panel over the active Markdown note and appends the selected protocol output to that note.
- **Visual protocol authoring.** The protocol editor supports start, question, answer, text-block, snippet, and loop nodes connected as a graph.

## Typical clinical workflow

1. Open or create the Markdown note for the examination report.
2. Run **Run protocol in inline** from the command palette.
3. Select a protocol from the configured protocol folder.
4. Answer each clinical question in the inline runner.
5. Fill snippet placeholders when prompted.
6. Review the generated text appended to the note and edit it as needed before final reporting.

RadiProtocol is a documentation aid. The radiologist remains responsible for clinical judgment, wording, and final report validation.

## Installation

### BRAT (recommended)

1. Install the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. In BRAT settings, choose **Add Beta plugin** and paste the GitHub URL of this repository.
3. Enable **RadiProtocol** in Obsidian's Community plugins list.

### Manual installation

1. Download `main.js`, `styles.css`, and `manifest.json` from the latest GitHub release.
2. Copy those files into `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Reload Obsidian.
4. Enable **RadiProtocol** in Obsidian's Community plugins list.

## Setup

1. Open RadiProtocol settings.
2. Set **Protocol folder** to the vault-relative folder that contains `.rp.json` protocol files.
3. Set **Snippet folder** to the vault-relative folder that contains snippet JSON or Markdown files.
4. Choose the preferred text separator for accumulated report text: newline or space.
5. Select the interface language if needed.

## Creating a protocol

1. Run **Open protocol editor**.
2. Create or open a `.rp.json` protocol file in the configured protocol folder.
3. Add a **Start** node.
4. Add clinical **Question** nodes and connect them to **Answer** nodes or other protocol nodes.
5. Use **Text block** nodes for fixed report text.
6. Use **Snippet** nodes to insert reusable report fragments from a file or folder.
7. Use **Loop** nodes when the same reporting section may need to be repeated.
8. Save the protocol and test it with **Run protocol in inline** on a Markdown note.

For the detailed node and edge model, see [`docs/PROTOCOL-AUTHORING.md`](docs/PROTOCOL-AUTHORING.md).

## Snippets

RadiProtocol supports two snippet types:

- **Markdown snippets**: inserted as written.
- **JSON snippets**: structured snippets with placeholders that are filled during protocol execution.

A snippet node can point to a specific snippet file or to a directory. When it points to a directory, the inline runner lets the user choose one snippet from that directory during execution.

## Existing `.canvas` protocols

Existing JSON Canvas protocol files remain supported for compatibility. Use **Convert Canvas protocol to .rp.json** when you are ready to migrate them to the current protocol format. New protocols should be created as `.rp.json`.

## Documentation

- [`docs/PROTOCOL-AUTHORING.md`](docs/PROTOCOL-AUTHORING.md) — protocol node and edge authoring guide.
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — development and contribution notes.
- [`docs/adr/0001-inline-runner-only.md`](docs/adr/0001-inline-runner-only.md) — inline-only runner architecture decision.

---

# RadiProtocol на русском

RadiProtocol — плагин для [Obsidian](https://obsidian.md), который помогает врачу-рентгенологу выполнять структурированные протоколы исследования прямо в рабочем хранилище. Плагин превращает протокол в пошаговый клинический сценарий: выберите нужную ветку, вставьте готовый текст или сниппет, повторите раздел для нескольких находок и добавьте сформированный текст в активную Markdown-заметку.

Протоколы создаются как файлы **`.rp.json`** во встроенном визуальном редакторе. Старые протоколы `.canvas` всё ещё поддерживаются и могут быть конвертированы, но новые протоколы следует создавать в формате `.rp.json`.

**Последний релиз:** 1.22.15

## Для чего нужен RadiProtocol

- **Стандартизация радиологических заключений.** Можно оформить локальные протоколы, алгоритмы по модальностям, рекомендации по follow-up или шаблоны структурированных заключений как дерево решений.
- **Пошаговые клинические ветвления.** Узлы вопросов и ответов помогают выбрать подходящий клинический путь без поиска по длинным статическим шаблонам.
- **Повторно используемые фрагменты текста.** Узлы сниппетов вставляют подготовленный текст из настроенной папки. JSON-сниппеты могут запрашивать плейсхолдеры: свободный текст, выбор, множественный выбор, число или дату.
- **Повторяющиеся находки.** Узлы циклов подходят для нескольких очагов, узлов, измерений, анатомических уровней или других повторяемых разделов.
- **Inline-запуск поверх заметки.** Runner открывается как перетаскиваемая inline-панель над активной Markdown-заметкой и добавляет выбранный текст протокола в эту заметку.
- **Визуальное создание протоколов.** Редактор протоколов поддерживает узлы старта, вопроса, ответа, текстового блока, сниппета и цикла, соединённые в граф.

## Типичный клинический сценарий

1. Откройте или создайте Markdown-заметку для заключения.
2. Запустите команду **Run protocol in inline** из палитры команд.
3. Выберите протокол из настроенной папки протоколов.
4. Ответьте на клинические вопросы в inline runner.
5. Заполните плейсхолдеры сниппетов, если они появятся.
6. Проверьте добавленный в заметку текст и при необходимости отредактируйте его перед финальным заключением.

RadiProtocol помогает оформлять документацию. Клиническое решение, формулировки и финальная проверка заключения остаются ответственностью врача.

## Установка

### Через BRAT (рекомендуется)

1. Установите [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian42-brat).
2. В настройках BRAT выберите **Add Beta plugin** и вставьте GitHub URL этого репозитория.
3. Включите **RadiProtocol** в списке Community plugins Obsidian.

### Ручная установка

1. Скачайте `main.js`, `styles.css` и `manifest.json` из последнего GitHub release.
2. Скопируйте эти файлы в `<your-vault>/.obsidian/plugins/radiprotocol/`.
3. Перезагрузите Obsidian.
4. Включите **RadiProtocol** в списке Community plugins.

## Настройка

1. Откройте настройки RadiProtocol.
2. Укажите **Protocol folder** — папку в хранилище, где лежат файлы протоколов `.rp.json`.
3. Укажите **Snippet folder** — папку в хранилище, где лежат JSON- или Markdown-сниппеты.
4. Выберите разделитель накопленного текста заключения: новая строка или пробел.
5. При необходимости выберите язык интерфейса.

## Создание протокола

1. Запустите **Open protocol editor**.
2. Создайте или откройте `.rp.json` файл в настроенной папке протоколов.
3. Добавьте узел **Start**.
4. Добавьте клинические узлы **Question** и соедините их с узлами **Answer** или другими узлами протокола.
5. Используйте **Text block** для фиксированного текста заключения.
6. Используйте **Snippet** для вставки повторно используемых фрагментов из файла или папки.
7. Используйте **Loop**, если один и тот же раздел может повторяться.
8. Сохраните протокол и проверьте его командой **Run protocol in inline** на Markdown-заметке.

Подробное описание узлов и связей см. в [`docs/PROTOCOL-AUTHORING.md`](docs/PROTOCOL-AUTHORING.md).

## Сниппеты

RadiProtocol поддерживает два типа сниппетов:

- **Markdown-сниппеты**: вставляются как обычный текст.
- **JSON-сниппеты**: структурированные сниппеты с плейсхолдерами, которые заполняются во время выполнения протокола.

Узел сниппета может ссылаться на конкретный файл или на папку. Если выбрана папка, inline runner во время выполнения предложит выбрать один сниппет из этой папки.

## Существующие `.canvas` протоколы

Старые протоколы JSON Canvas остаются доступными для совместимости. Используйте команду **Convert Canvas protocol to .rp.json**, когда будете готовы перенести их в текущий формат. Новые протоколы следует создавать как `.rp.json`.

## Документация

- [`docs/PROTOCOL-AUTHORING.md`](docs/PROTOCOL-AUTHORING.md) — руководство по узлам и связям протокола.
- [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) — заметки по разработке и участию в проекте.
- [`docs/adr/0001-inline-runner-only.md`](docs/adr/0001-inline-runner-only.md) — решение об inline-only архитектуре runner.

## License

Released under the terms of the [LICENSE](LICENSE) file in this repository.
