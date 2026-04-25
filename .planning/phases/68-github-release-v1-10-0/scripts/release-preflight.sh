#!/usr/bin/env bash
# Phase 68 — release preflight script for v1.10.0.
# Run from repo root. Exits 0 on full green. Uses node -e (no jq dependency).

set -euo pipefail

echo "=== Version alignment ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").version)')" = "1.10.0"
test "$(node -e 'process.stdout.write(Object.keys(require("./versions.json")).sort().join(","))')" = "1.10.0,1.8.0,1.9.0"
test "$(node -e 'process.stdout.write(require("./versions.json")["1.8.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./versions.json")["1.9.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./versions.json")["1.10.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./package.json").version)')" = "1.10.0"

echo "=== Manifest metadata ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").author)')" = "vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").authorUrl)')" = "https://github.com/vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").fundingUrl)')" = ""
test "$(node -e 'process.stdout.write(require("./manifest.json").minAppVersion)')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./manifest.json").isDesktopOnly.toString())')" = "true"
test "$(node -e 'process.stdout.write(require("./manifest.json").id)')" = "radiprotocol"
test "$(node -e 'process.stdout.write(require("./manifest.json").name)')" = "RadiProtocol"

echo "=== Tag state ==="
if git tag -l 'v1.10.0' | grep -q .; then
  echo "FAIL: v-prefixed tag v1.10.0 exists"
  exit 1
fi
if git rev-parse --verify 1.10.0 >/dev/null 2>&1; then
  git tag --list '1.10.0' | grep -qx '1.10.0'
  echo "  tag 1.10.0 present, no v1.10.0 collision"
else
  echo "  tag 1.10.0 not yet created (acceptable pre-Task 68-03-02)"
fi

echo "=== Artifact hygiene ==="
if git ls-files styles.css 2>/dev/null | grep -q .; then
  echo "FAIL: styles.css is in git index"
  exit 1
fi
if git ls-files main.js 2>/dev/null | grep -q .; then
  echo "FAIL: main.js is in git index"
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
