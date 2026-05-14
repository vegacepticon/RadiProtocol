#!/usr/bin/env bash
# cleanup-tags.sh — Удаляет ВСЕ теги и GitHub Releases из репо.
#
# ⚠️ DESTRUCTIVE — перед запуском убедитесь, что:
#   1. Текущий коммит на main — то, что хотите как релиз 1.16.0
#   2. Нет никого, кто ставит плагин через BRAT по старым тегам
#   3. Создан резервный архив тегов (git clone --mirror)
#
# Предварительно: export GITHUB_TOKEN="ghp_..."
#
# Usage:
#   export GITHUB_TOKEN="ghp_..."
#   bash scripts/cleanup-tags.sh vegacepticon RadiProtocol

set -euo pipefail

OWNER="${1:?Owner required (e.g. vegacepticon)}"
REPO="${2:?Repo required (e.g. RadiProtocol)}"
API="https://api.github.com/repos/${OWNER}/${REPO}"

echo "=== Cleanup tags and releases for ${OWNER}/${REPO} ==="
echo ""

# ---- Step 1: List all releases ----
echo "📋 Fetching releases..."
RELEASES=$(gh api "${API}/releases" --jq '.[].id')
RELEASE_COUNT=$(echo "$RELEASES" | wc -l)
echo "   Found ${RELEASE_COUNT} releases."

# ---- Step 2: List all tags ----
echo "📋 Fetching tags..."
TAGS=$(gh api "${API}/tags" --jq '.[].name')
TAG_COUNT=$(echo "$TAGS" | wc -l)
echo "   Found ${TAG_COUNT} tags."

echo ""
echo "=== Will delete ==="
echo "Releases: ${RELEASE_COUNT}"
echo "Tags: ${TAG_COUNT}"
echo ""

# ---- Step 3: Show what will be deleted ----
echo "--- Releases to delete ---"
for id in $RELEASES; do
  NAME=$(gh api "${API}/releases/${id}" --jq '.name // .tag_name')
  echo "  Release #${id}: ${NAME}"
done

echo ""
echo "--- Tags to delete ---"
echo "$TAGS" | while read -r tag; do
  echo "  Tag: ${tag}"
done

echo ""
read -rp "Type YES to confirm deletion of all ${RELEASE_COUNT} releases and ${TAG_COUNT} tags: " CONFIRM

if [ "$CONFIRM" != "YES" ]; then
  echo "Aborted."
  exit 1
fi

# ---- Step 4: Delete releases ----
echo ""
echo "🗑️  Deleting releases..."
for id in $RELEASES; do
  NAME=$(gh api "${API}/releases/${id}" --jq '.name // .tag_name')
  gh api -X DELETE "${API}/releases/${id}"
  echo "  Deleted release: ${NAME}"
done

# ---- Step 5: Delete tags ----
echo ""
echo "🗑️  Deleting remote tags..."
echo "$TAGS" | while read -r tag; do
  gh api -X DELETE "${API}/git/refs/tags/${tag}" 2>/dev/null || true
  echo "  Deleted tag: ${tag}"
done

echo ""
echo "✅ Cleanup complete."
echo ""
echo "Next step: create new release with:"
echo "  gh release create 1.16.0 --title '1.16.0' --notes 'Clean release.'"