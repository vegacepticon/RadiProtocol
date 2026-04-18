---
title: "Preserve textarea scroll position after choice insertion in Runner"
date: 2026-04-18
priority: high
---

In Protocol Runner, when the main textarea has grown large enough to show a scrollbar, selecting a new choice and inserting text currently scrolls the textarea back to the top. User has to scroll down again every time.

Expected: after inserting new text, the textarea should either keep the previous scroll position or scroll to the insertion point (end of newly inserted content) — never jump to the top.
