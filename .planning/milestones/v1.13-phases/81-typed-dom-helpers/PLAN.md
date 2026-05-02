# Phase 81: Typed dom-helpers Module

## Goal
Eliminate repetitive `as HTMLButtonElement` / `as HTMLInputElement` / `as HTMLTextAreaElement` casts at hot-path DOM call sites by introducing typed wrapper functions.

## Scope
- Ne...