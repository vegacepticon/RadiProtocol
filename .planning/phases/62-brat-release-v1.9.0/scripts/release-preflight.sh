#!/usr/bin/env bash
# Phase 62 — release preflight script for v1.9.0.
# Adapted from Phase 55's preflight with two deltas:
#   - version asserts against 1.9.0 (not 1.8.0)
#   - versions.json key set must be {1.8.0, 1.9.0} (two keys — D4 PRESERVE)
# Run from repo root. Exits 0 on full green. Uses node -e (no jq dependency).

set -euo pipefail

echo "=== Version alignment ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").version)')" = "1.9.0"
test "$(node -e 'process.stdout.write(Object.keys(require("./versions.json")).sort().join(","))')" = "1.8.0,1.9.0"
test "$(node -e 'process.stdout.write(require("./versions.json")["1.8.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./versions.json")["1.9.0"])')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./package.json").version)')" = "1.9.0"

echo "=== Manifest metadata (D9 — locked by Phase 55) ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").author)')" = "vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").authorUrl)')" = "https://github.com/vegacepticon"
test "$(node -e 'process.stdout.write(require("./manifest.json").fundingUrl)')" = ""

echo "=== Unchanged fields (D3) ==="
test "$(node -e 'process.stdout.write(require("./manifest.json").minAppVersion)')" = "1.5.7"
test "$(node -e 'process.stdout.write(require("./manifest.json").isDesktopOnly.toString())')" = "true"
test "$(node -e 'process.stdout.write(require("./manifest.json").id)')" = "radiprotocol"
test "$(node -e 'process.stdout.write(require("./manifest.json").name)')" = "RadiProtocol"

echo "=== Tag state ==="
if git rev-parse --verify 1.9.0 >/dev/null 2>&1; then
  git tag --list '1.9.0' | grep -qx '1.9.0'
  if git tag -l 'v1.9.0' | grep -q .; then
    echo "FAIL: v-prefixed tag v1.9.0 exists (Phase 55 Pitfall 2)"
    exit 1
  fi
  echo "  tag 1.9.0 present, no v1.9.0 collision"
else
  echo "  tag 1.9.0 not yet created (acceptable pre-Task 62-02-04)"
fi

echo "=== Artifact hygiene (D5 — unchanged from Phase 55) ==="
if git ls-files styles.css 2>/dev/null | grep -q .; then
  echo "FAIL: styles.css still in git index (Phase 55 Pitfall 3)"
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
