---
title: "Fix long-text padding on Protocol Runner choice buttons"
date: 2026-04-18
priority: medium
---

In Protocol Runner, when choice button text is long and wraps to multiple lines, it currently stretches edge-to-edge and sometimes clips descenders/parentheses ("р", "(", etc.). Add proper internal padding so wrapped text has breathing room and never clips.
