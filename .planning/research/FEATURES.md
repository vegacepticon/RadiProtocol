# Features Research: RadiProtocol

**Domain:** Obsidian plugin -- interactive medical protocol/report generator from Canvas decision trees
**Researched:** 2026-04-05
**Overall confidence:** MEDIUM-HIGH (strong evidence from radiology reporting tools, Obsidian plugin ecosystem, and wizard UX research; some specifics are RadiProtocol-unique with no direct precedent)

---

## Table Stakes (must have for credibility)

Features users expect from day one. Missing any of these makes the plugin feel broken or toy-like.

| Feature | Why Expected | Complexity | Confidence | Notes |
|---------|-------------|------------|------------|-------|
| **One-question-at-a-time runner** | This is the core promise. RadioReport, CLICKVIEW, and every clinical decision-tree tool presents one step at a time. Users will not accept a wall of questions. | Medium | HIGH | ZettelFlow and Cannoli both use canvas-as-workflow; the step-by-step runner pattern is proven. |
| **Live protocol preview** | Radiologists need to see the accumulating report text as they answer. RadioReport and rScriptor both show the report building in real time. Without this, users cannot spot errors until the end. | Medium | HIGH | Every structured reporting tool does this. Non-negotiable. |
| **Preset answer buttons** | Click-to-select from predefined options (e.g., "Right", "Left", "Bilateral"). RadioReport is built entirely on checkboxes and selection tools -- "completely without free text." CLICKVIEW uses voice-activated tiles. Buttons are the desktop equivalent. | Low | HIGH | This is the primary interaction mode for ~80% of protocol steps. |
| **Free-text input fields** | Some findings cannot be enumerated (e.g., "describe additional findings"). Every structured reporting tool includes free-text escape hatches alongside structured fields. | Low | HIGH | Must coexist with preset buttons on the same step when needed. |
| **Step back / undo last answer** | Universal wizard UX requirement. NN/g guidelines: "Always allow users to go back. Forcing forward-only flow frustrates users who made a mistake." PatternFly wizard guidelines agree. | Medium | HIGH | Must revert both the navigation state AND the accumulated protocol text. This is the tricky part -- not just going back, but undoing the text that was appended. |
| **Output to clipboard** | Radiologists paste into PACS/RIS. This is the #1 output path for any tool not integrated with hospital systems. | Low | HIGH | Must be one click / one shortcut. |
| **Output to new note** | Obsidian-native output. Users expect to keep reports in their vault for reference. | Low | HIGH | Configurable output folder in settings. |
| **Canvas-based algorithm authoring** | The entire value proposition. Obsidian Canvas is the visual editor. ZettelFlow and Cannoli both prove canvas-as-workflow-editor is viable in the Obsidian ecosystem. | High | HIGH | Must not break native canvas functionality or corrupt .canvas files. |
| **Node type differentiation** | Users must visually distinguish question nodes, answer nodes, text blocks, and loop markers on the canvas. Color coding at minimum. Advanced Canvas plugin shows this is expected -- it offers extensive node styling (shapes, colors, borders). | Medium | HIGH | Use canvas node colors and/or text prefixes. Do not require users to edit raw JSON. |
| **Configurable output destination** | Settings to choose: clipboard, new note, insert at cursor, or any combination. | Low | MEDIUM | Standard for Obsidian plugins that produce text output. |

## Differentiating Features (what sets RadiProtocol apart)

These features are not expected in a v1 Obsidian plugin, but they are what would make radiologists actually adopt this over their current workflow.

| Feature | Value Proposition | Complexity | Confidence | Notes |
|---------|-------------------|------------|------------|-------|
| **Dynamic snippets with placeholders** | VS Code pioneered this: tab-stop placeholders with defaults, choices, and linked editing. TextExpander adds dropdown menus, date pickers, and optional sections. Combining structured reporting with snippet-style placeholder fill-in is something RadioReport does but no Obsidian plugin does. | High | MEDIUM | This is the "killer feature" -- a snippet like `"The {{lesion_type\|mass,cyst,nodule}} measures {{size}} cm in {{location\|right lobe,left lobe,caudate}}"` that pops up inline fill-in fields during the protocol run. |
| **Visual loop nodes** | Repeating sections (e.g., "describe each lesion") are critical for radiology. No existing Obsidian canvas plugin handles loops. Cannoli supports loops but only for LLM workflows. This is genuinely novel for a canvas-based human workflow tool. | High | MEDIUM | Must feel intuitive: "repeat this section until user says done." Loop state (iteration count, accumulated text per iteration) needs careful UX. |
| **Side panel for node editing** | A dedicated panel to configure node properties (question text, answer options, snippet content, loop settings) without editing raw canvas card text. Modal Form plugin shows form-based configuration is expected in Obsidian. | Medium | HIGH | ZettelFlow uses right-click context menus to "convert to step / edit step." A persistent side panel is more discoverable and faster. |
| **Mid-session save and resume** | Save current position + accumulated text + answer history. Resume later. Enterprise wizard UX research (AppMaster, Oracle Alta) calls this essential for complex multi-step flows. No Obsidian plugin currently does this for canvas workflows. | Medium | MEDIUM | Store as a JSON file in the vault (like snippet storage). Show "resume session" in the command palette. |
| **Start from any node** | Jump into the algorithm at a specific point. Useful when a radiologist knows the first 5 answers and wants to skip ahead, or when re-running just the "liver" section of an abdominal CT protocol. | Medium | MEDIUM | Requires the runner to handle "no prior accumulated text" gracefully. Offer a way to select the starting node from the canvas or a list. |
| **Inline protocol editing during session** | Let users edit the accumulated report text directly while still in the session. If a previous answer produced slightly wrong text, they can fix it without stepping back. | Medium | HIGH | RadioReport and rScriptor both allow this. Critical for radiologist trust -- they need to feel in control of the final text at all times. |
| **Snippet manager UI** | Dedicated tab to create, edit, preview, and delete snippets outside of a protocol run. TextExpander's snippet manager is the gold standard: organized by group, with inline preview showing rendered output with placeholder values. | Medium | MEDIUM | File-based storage (JSON in vault) is the right call per PROJECT.md. The UI should show a live preview as you edit. |
| **Node templates (reusable node structures)** | Save a frequently-used node configuration (e.g., "laterality question" with Left/Right/Bilateral options) and insert it into any canvas. QuickAdd's "template" concept but for canvas nodes. | Medium | LOW | Nice-to-have for power users who build many protocols. Not needed for v1 adoption but high value for long-term engagement. |

## UX Patterns from Similar Tools

### From Obsidian Plugin Ecosystem

**QuickAdd** (HIGH confidence -- well-documented):
- Uses a "choice" paradigm: templates, captures, macros, multis
- Macro chains allow multi-step workflows
- Command palette integration is the primary trigger mechanism
- Lesson for RadiProtocol: command palette to launch a protocol run is expected; ribbon icon as secondary trigger

**Modal Form Plugin** (HIGH confidence):
- Field types: text, number, date, time, slider, toggle, select, multi-select
- Supports skipping fields -- important for optional protocol sections
- Forms can have associated templates for output generation
- Lesson for RadiProtocol: the snippet placeholder UI should support at minimum: free text, number, select (single), multi-select. Date and toggle are nice-to-haves.

**ZettelFlow** (MEDIUM confidence):
- Uses canvas as a workflow definition surface
- Right-click to "convert to step / edit step"
- Actions per step: Prompt (text input), Number, Checkbox
- Steps are connected by canvas edges (arrows)
- Root notes are starting points; plugin auto-detects them
- Lesson for RadiProtocol: the canvas-to-workflow pattern is validated. Edge direction = flow direction. Root nodes (no incoming edges) = protocol entry points.

**Cannoli** (MEDIUM confidence):
- Canvas as directed acyclic graph (DAG) for LLM workflows
- Uses node colors and prefixes to denote node types
- Supports branching and loops (for LLM pipelines)
- Lesson for RadiProtocol: color-coding nodes by type is the established Obsidian convention. DAG validation (checking for valid flow structure) before running is smart.

**Advanced Canvas** (HIGH confidence):
- Adds node styling: shapes, colors, borders, arrows
- Collapsible groups, portals, focus mode, presentation mode
- Lesson for RadiProtocol: do not conflict with Advanced Canvas. Users may have both installed. Use node color/text conventions that do not clash.

### From Wizard/Multi-Step Form UX Research

**NN/g Wizard Guidelines** (HIGH confidence):
- Always show progress (which step, how many remain)
- Always allow going back
- Validate per-step, not at the end
- Keep steps short -- one concept per step

**PatternFly Wizard Component** (HIGH confidence):
- Step sidebar showing all steps with visited/current/future states
- Visited steps are clickable for direct navigation
- "Next" and "Back" buttons always visible
- Optional "Cancel" with confirmation dialog

**Save-and-Resume Pattern** (MEDIUM confidence -- AppMaster, Oracle Alta):
- Create a draft record when session starts
- Persist after each step (not just on explicit save)
- On resume: fetch draft, prefill UI, continue from last step
- Finalize with one action: full validation, then output

### From Developer Snippet Tools

**VS Code Snippets** (HIGH confidence):
- Tab-stop order ($1, $2, ... $0 for final position)
- Placeholders with defaults: `${1:defaultValue}`
- Choice placeholders: `${1|option1,option2,option3|}`
- Linked placeholders: same $N in multiple places edits in sync
- Transformations: auto-capitalize, regex transforms on tab
- Lesson for RadiProtocol: the placeholder syntax should support defaults and choices. Linked editing (same value appears in multiple places) is powerful for radiology (e.g., laterality mentioned in findings and impression).

**TextExpander** (HIGH confidence):
- Five fill-in types: single-line text, multi-line text, date picker, dropdown menu, optional section
- Each fill-in has a label name shown to the user
- Optional sections: include/exclude entire blocks of text
- Lesson for RadiProtocol: the "optional section" concept maps perfectly to conditional protocol text (e.g., "include contrast reaction section only if contrast was used"). Dropdown menus map to multi-select placeholder type.

## Medical Protocol Specifics

### Standard Radiology Report Sections (HIGH confidence)

Based on RSNA RadReport templates and standard radiology practice:

1. **Clinical Indication** -- why the study was ordered
2. **Technique** -- modality, contrast, protocol details
3. **Comparison** -- prior studies reviewed
4. **Findings** -- organ-by-organ or system-by-system observations
5. **Impression** -- summary of key findings, diagnoses, recommendations

RadiProtocol algorithms will typically generate the **Findings** and **Impression** sections, since Technique and Comparison are often dictated separately or auto-populated from PACS/RIS.

### Common Variable Types in Radiology Protocols

| Variable Type | Examples | Best Input Type |
|---------------|----------|-----------------|
| **Laterality** | Right, Left, Bilateral | Preset buttons (3 options) |
| **Measurement** | "2.3 cm", "15 x 10 mm" | Numeric input with unit selector |
| **Anatomic location** | Right upper lobe, Segment 4a, L4-L5 | Dropdown/select from predefined list |
| **Severity/grade** | Mild, Moderate, Severe | Preset buttons (3-5 options) |
| **Presence/absence** | Present, Absent, Indeterminate | Preset buttons (2-3 options) |
| **Morphology** | Solid, Cystic, Mixed, Ground-glass | Preset buttons or multi-select |
| **Enhancement pattern** | Homogeneous, Heterogeneous, Rim, Non-enhancing | Preset buttons |
| **Count** | "3 lesions", "multiple" | Numeric input or preset (single/few/multiple/innumerable) |
| **Free description** | "irregular margins with surrounding edema" | Free-text input |
| **Comparison change** | Stable, Increased, Decreased, New, Resolved | Preset buttons (5 options) |
| **Standard classification** | BI-RADS 1-6, LI-RADS 1-5, Bosniak I-IV, Lung-RADS 1-4 | Preset buttons with associated text blocks |

### Structured Reporting Tiers (MEDIUM confidence -- RSNA/ESR)

The radiology community recognizes three tiers of structure:
- **Tier 1:** Structured layout (headings: Findings, Impression, etc.)
- **Tier 2:** Structured content (dropdowns, checkboxes, decision trees)
- **Tier 3:** Standardized language (RadLex terminology, CDEs)

RadiProtocol operates at **Tier 2** -- structured content via decision trees. This is the sweet spot: more structured than free dictation, but does not require adopting a controlled vocabulary like RadLex (which would limit adoption).

### RSNA Common Data Elements (CDEs) (MEDIUM confidence)

RSNA/ACR CDEs define standardized question-and-answer sets for specific findings. Example: a liver lesion CDE might define:
- Size (numeric, in cm)
- Location (categorical: segments 1-8)
- Signal characteristics (categorical: T1 hypo/iso/hyper, T2 hypo/iso/hyper)
- Enhancement pattern (categorical: arterial hyper, portal washout, etc.)
- Threshold growth (boolean)

RadiProtocol's algorithm structure naturally maps to CDEs. Each CDE set = a subtree of the algorithm. This is not needed for v1 but is a powerful future direction for interoperability.

### Lessons from RadioReport (MEDIUM confidence)

RadioReport is the closest commercial analog to RadiProtocol's concept:
- Uses 23 anatomy-based modules (not finding-based templates)
- Decision tree guides radiologist through analysis
- Enforces mandatory fields, eliminates omissions
- Breast MRI: 10 min with RadioReport vs. 35 min conventional
- Key difference: RadioReport is a standalone web app. RadiProtocol lives inside Obsidian, which means lower barrier to entry but no PACS integration.

### Lessons from rScriptor (MEDIUM confidence)

rScriptor's "Adaptive Structured Reporting" dynamically adjusts templates based on scan type, patient demographics, and unexpected findings. Key insight: if a chest CT shows an incidental gallbladder finding, rScriptor auto-adds a relevant section.

For RadiProtocol, this suggests: algorithms should support **conditional branches** that activate based on earlier answers (e.g., "if contrast was used, show contrast-specific questions"). This is naturally supported by the decision-tree structure.

## Snippet/Placeholder UX Best Practices

### Must-Have Placeholder Features

1. **Labeled fields**: Every placeholder must have a human-readable label (e.g., "Lesion size" not "${1}"). Radiologists will not learn placeholder syntax.

2. **Default values**: Pre-fill with the most common answer. Radiologists should only need to change values that differ from normal. This is the #1 efficiency gain in structured reporting.

3. **Choice/dropdown placeholders**: Enumerated options for categorical variables. VS Code's `${1|opt1,opt2|}` pattern, but presented as buttons or a dropdown -- not as raw syntax.

4. **Tab-through navigation**: After filling one placeholder, Tab (or Enter) moves to the next. VS Code tab-stop order is the proven UX. Do not force mouse clicks between fields.

5. **Live preview**: As placeholders are filled, the rendered snippet text updates in real time. TextExpander does this. Seeing the final text form as you fill fields builds confidence.

### Nice-to-Have Placeholder Features

6. **Linked placeholders**: Same value referenced in multiple places (e.g., laterality in Findings and Impression). VS Code supports this with same-numbered tab stops.

7. **Optional sections**: Entire blocks of text that can be included or excluded. TextExpander's optional section pattern. Maps to conditional protocol text.

8. **Multi-select with join**: Select multiple items from a list, auto-joined with commas or "and". Common in radiology: "There is mild {{findings|atelectasis,effusion,consolidation}} at the {{location|right base,left base,bilateral bases}}."

9. **Numeric validation**: For measurements -- reject non-numeric input, enforce reasonable ranges (a liver lesion is not 500 cm).

### Anti-Patterns in Placeholder UX

- **Raw syntax visible to user**: Never show `${1:foo}` or `{{placeholder}}` in the UI. Always render as labeled input fields.
- **No escape hatch**: Always allow free-text override even for choice fields. Radiology has edge cases that no predefined list covers.
- **Mandatory all-or-nothing**: Let users skip optional placeholders. Not every field is required for every report.

## Anti-Features (what NOT to do, with examples)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **AI/LLM text generation** | Explicitly out of scope per PROJECT.md. Radiologists need to trust that protocol text comes from their algorithms, not from a model that might hallucinate. Cannoli already fills the LLM-on-canvas niche. | Manual algorithm authoring only. Every word in the output must be traceable to a node the user created. |
| **PACS/RIS integration** | Requires HL7/DICOM/FHIR compliance, hospital IT approval, security audits. Out of scope for v1 and probably v2. | Clipboard output. Radiologists already paste from other tools into PACS. |
| **Code/expression syntax in nodes** | PROJECT.md: "authoring algorithms must feel like visual design, not programming." Cannoli uses color prefixes and special syntax. This is fine for developers but alienates radiologists. | Visual configuration only. Side panel with labeled fields, not text-based DSLs. |
| **Overly rigid templates** | The #1 reason structured reporting has "limited adoption" (per European Radiology systematic review): "inflexibility of templates and insufficient customization options." | Every algorithm is user-created and user-editable. No built-in "correct" way to report. |
| **Mobile support** | Out of scope per PROJECT.md. Canvas editing on mobile is already poor in Obsidian. The runner might work on mobile eventually, but authoring will not. | Desktop-first. Do not compromise desktop UX for mobile compatibility. |
| **Multi-user / collaborative editing** | Out of scope per PROJECT.md. Obsidian vaults are single-user by default. Real-time collaboration would require a server. | Single-user local vault. Users can share .canvas files and snippet folders via git/sync. |
| **Version history for snippets/protocols** | Out of scope per PROJECT.md. Adds significant complexity for marginal value when users can use git or Obsidian Sync's version history. | File-based storage in vault. Users manage versions with their existing tools. |
| **Automatic impression generation** | Some tools (rScriptor, Rad AI) auto-generate the Impression from Findings. This requires NLP/AI and is error-prone. | Let the algorithm author define what text appears in each section. The algorithm IS the intelligence, not an AI layer. |
| **Mandatory field enforcement** | RadioReport enforces mandatory fields. For an Obsidian plugin, this would feel hostile. Radiologists should be free to skip sections. | Optional enforcement: algorithm authors can mark fields as required, but the runner should warn, not block. |

## Feature Gap Analysis (what similar tools miss that RadiProtocol can nail)

### Gap 1: No Canvas-Based Protocol Builder Exists

**What is missing:** ZettelFlow uses canvas for note-creation workflows. Cannoli uses canvas for LLM pipelines. Neither uses canvas for guided human Q&A that assembles structured text. RadioReport has the Q&A concept but uses a proprietary web editor, not a visual canvas.

**RadiProtocol opportunity:** Be the first tool that lets a domain expert (radiologist) visually design a decision tree on Obsidian Canvas and then run it as an interactive questionnaire. The visual authoring surface is the differentiator -- it makes the algorithm tangible and editable without code.

### Gap 2: Snippet Placeholders Are Primitive in Obsidian

**What is missing:** Obsidian's Templater and QuickAdd support basic variable substitution but lack VS Code-style tab-stop navigation, choice dropdowns, or linked editing. Modal Form plugin offers form fields but the output is a flat form, not inline snippet editing. TextExpander has rich fill-in types but is a separate app with no Obsidian integration.

**RadiProtocol opportunity:** Build snippet placeholders that feel like VS Code snippets (tab through, choose from options, see live preview) but are configured visually (not with syntax). This bridges the gap between developer-tool power and radiologist-friendly UX.

### Gap 3: No Loop Handling in Canvas Workflows

**What is missing:** Neither ZettelFlow nor any other Obsidian canvas plugin supports repeating sections. Cannoli supports loops but only for LLM API calls. In radiology, loops are essential: "describe each lesion" requires repeating the same question set N times.

**RadiProtocol opportunity:** Visual loop nodes on the canvas. The user marks a group of nodes as a loop region. During the protocol run, the runner repeats that section until the user clicks "Done / No more lesions." Each iteration's text is accumulated (e.g., "Lesion 1: ... Lesion 2: ..."). This is genuinely novel.

### Gap 4: Mid-Session Persistence Is Absent

**What is missing:** No Obsidian workflow plugin saves session state. If you close Obsidian or switch to another task, your protocol run is lost. ZettelFlow creates a note at the end but has no concept of a draft state. Complex radiology protocols can take 5-10 minutes; interruptions are common in clinical settings.

**RadiProtocol opportunity:** Auto-save session state to a JSON file in the vault after each step. On launch, check for incomplete sessions and offer to resume. This is standard in enterprise wizard UX (Oracle Alta, AppMaster patterns) but novel in the Obsidian plugin ecosystem.

### Gap 5: Structured Reporting Tools Are Closed and Expensive

**What is missing:** RadioReport, CLICKVIEW, and rScriptor are proprietary, require institutional licenses, and cannot be customized by individual radiologists. RSNA RadReport provides templates but they are static documents, not interactive runners.

**RadiProtocol opportunity:** Open-source, free, runs locally inside Obsidian, and algorithms are user-authored. A radiologist can build their own protocol in 30 minutes and share it as a .canvas file. This democratizes structured reporting for solo practitioners, residents, and small practices who cannot afford enterprise tools.

### Gap 6: No Bridge Between Visual Design and Structured Output

**What is missing:** Obsidian Canvas is great for visual thinking but has no concept of "running" a canvas as a workflow that produces structured text. The closest tools (Cannoli, ZettelFlow) produce notes or LLM outputs, not structured medical reports with sections, measurements, and classifications.

**RadiProtocol opportunity:** The canvas IS the algorithm. Each node contributes specific text to specific report sections. The visual layout shows the logical flow. The runner turns that visual layout into an interactive experience. This is a direct bridge from visual design to structured clinical output.

## Feature Dependencies

```
Canvas Node Types --> Protocol Runner (runner must understand node types)
Protocol Runner --> Output System (runner produces text, output system delivers it)
Snippet Manager --> Dynamic Snippets in Runner (snippets must exist before they can be used in protocols)
Preset Buttons --> Step Back/Undo (undo must know what text each button appended)
Loop Nodes --> Loop State Management (loops need iteration tracking)
Mid-Session Save --> Session State Model (must define what state to persist)
Side Panel Editor --> Node Type Schema (panel needs to know what fields each node type has)
```

## MVP Recommendation

**Prioritize (v1 must-ship):**
1. One-question-at-a-time runner with preset answer buttons
2. Live protocol preview showing accumulating text
3. Free-text input fields alongside preset buttons
4. Step back / undo last answer
5. Output to clipboard + output to new note
6. Basic canvas node types: question, answer (preset text), free-text input, text block
7. Node color coding for visual differentiation
8. Configurable output destination in settings

**Include if time allows (v1 nice-to-have):**
9. Dynamic snippets with placeholder fill-in (choice + free-text types)
10. Side panel for node configuration
11. Start from any node

**Defer to v2:**
- Visual loop nodes (complex state management)
- Mid-session save/resume (needs session state model)
- Snippet manager UI (snippets can be JSON files edited manually in v1)
- Node templates / reusable structures
- Linked placeholders across report sections
- Optional sections in snippets

## Sources

### Obsidian Plugins
- [QuickAdd](https://github.com/chhoumann/quickadd) -- macro/template workflow plugin
- [Modal Form Plugin](https://github.com/danielo515/obsidian-modal-form) -- form-based data collection
- [ZettelFlow](https://github.com/RafaelGB/Obsidian-ZettelFlow) -- canvas-based note creation workflow
- [Cannoli](https://github.com/DeabLabs/cannoli) -- canvas-based LLM workflow execution
- [Advanced Canvas](https://github.com/Developer-Mike/obsidian-advanced-canvas) -- canvas styling and features
- [JSON Canvas Spec](https://jsoncanvas.org/) -- official canvas file format

### Radiology Structured Reporting
- [RSNA RadReport Templates](https://www.rsna.org/practice-tools/data-tools-and-standards/radreport-reporting-templates)
- [RSNA/ACR Common Data Elements](https://radelement.org/about/)
- [RadioReport](https://radioreport.com/) -- decision-tree structured reporting
- [rScriptor](https://scriptorsoftware.com/2024/03/14/streamline-radiology-reporting-with-rscriptor-a-game-changing-software-solution/) -- adaptive structured reporting
- [CLICKVIEW 9i](https://clickview.com/) -- voice-activated structured reporting
- [Structured reporting systematic review (European Radiology)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8921035/)

### Wizard/Form UX
- [NN/g Wizard Design Guidelines](https://www.nngroup.com/articles/wizards/)
- [PatternFly Wizard Component](https://www.patternfly.org/components/wizard/design-guidelines/)
- [Save-and-Resume Wizard Patterns (AppMaster)](https://appmaster.io/blog/save-and-resume-multi-step-wizard)

### Snippet/Template UX
- [VS Code Snippet Documentation](https://code.visualstudio.com/docs/editing/userdefinedsnippets)
- [TextExpander Fill-In Types](https://textexpander.com/learn/using/snippets/snippet-fill-ins)

### Radiology Report Structure
- [RadiologyInfo.org -- About Your Radiology Report](https://www.radiologyinfo.org/en/info/all-about-your-radiology-report)
- [ContrastConnect -- Findings vs Impression](https://www.contrast-connect.com/blog-post/radiology-report-findings-vs-impression-whats-the-difference)
