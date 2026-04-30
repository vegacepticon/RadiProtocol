#!/usr/bin/env bash
# Phase 55 — release preflight script.
# Aggregates every per-task SC-1 check from 55-VALIDATION.md into one runnable script.
# Run from repo root. Exits 0 on full green. Uses node -e (no jq dependency).

set -euo pipefail

echo "=== Version alignment ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").version)')" = "1.8.0"
test "$(node -e 'const v=require("./versions.json"); process.stdout.write(Object.keys(v).join(","))')" = "1.8.0"
test "$(node -e 'const v=require("./versions.json"); process.stdout.write(v["1.8.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./package.json").version)')" = "1.8.0"

echo "=== Manifest metadata (D9) ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").author)')" = "vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").authorUrl)')" = "https://github.com/vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").fundingUrl)')" = ""

echo "=== Unchanged fields (D3) ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").minAppVersion)')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./manifest.json").isDesktopOnly.toString())')" = "true"
test "$(node -e 'process.stdout.write(require("./manifest.json").id)')" = "radiprotocol"
test "$(node -e 'process.stdout.write(require("./manifest.json").name)')" = "RadiProtocol"

echo "=== Tag state ==="
if git rev-parse --verify 1.8.0 >/dev/null 2>&1; then
  git tag --list '1.8.0' | grep -qx '1.8.0'
  if git tag -l 'v1.8.0' | grep -q .; then
    echo "FAIL: v-prefixed tag v1.8.0 exists (Pitfall 2)"
    exit 1
  fi
  echo "  tag 1.8.0 present, no v1.8.0 collision"
else
  echo "  tag 1.8.0 not yet created (acceptable pre-Plan 03-03)"
fi

echo "=== Artifact hygiene ==="
if git ls-files styles.css 2>/dev/null | grep -q .; then
  echo "FAIL: styles.css still in git index (Pitfall 3)"
  exit 1
fi
if git ls-files main.js 2>/dev/null | grep -q .; then
  echo "FAIL: main.js still in git index"
  exit 1
fi
test "$(git check-ignore styles.css main.js 2>/dev/null | wc -l | tr -d ' ')" = "2"
grep -Fxq 'styles.css' .gitignore
grep -Fxq 'main.js' .gitignore

echo "=== Build freshness ==="
npm run build
test -s main.js
test -s styles.css

echo "SC-1 local verification: PASS"
