# Phase 1: Project Scaffold and Canvas Parsing Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the Q&A.

**Date:** 2026-04-05
**Phase:** 01-project-scaffold-and-canvas-parsing-foundation
**Mode:** discuss

## Areas Discussed

### Dev Vault Path

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| How should npm run dev know where to copy files? | .env file / Hardcoded in esbuild.config.mjs / npm script argument | .env file |

### Test Fixture Strategy

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Where should canvas fixtures for Vitest live? | Fixture files in repo / Inline JSON in test files / Separate test-vault/ directory | Fixture files in repo |
| Minimal or representative fixtures? | Minimal (3–5 nodes) / Representative (realistic protocol) | Minimal |

### Scaffold Scope

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| How much to scaffold now? | Phase 1 modules only / Full src/ structure upfront | Full src/ structure upfront |

### noUncheckedIndexedAccess

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Keep enabled or disable? | Keep it enabled / Disable it | Keep it enabled |

## Corrections Made

No corrections — all recommendations accepted.
