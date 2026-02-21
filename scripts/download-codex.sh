#!/usr/bin/env bash
# Download Codex binaries from lukilabs/craft-agents-codex GitHub releases.
#
# Usage:
#   ./scripts/download-codex.sh              # downloads latest release
#   ./scripts/download-codex.sh craft-v0.4.1 # downloads specific tag
#
# Platforms downloaded:
#   darwin-arm64, darwin-x64, linux-x64, win32-x64
#
# Output:
#   vendor/codex/darwin-arm64/codex
#   vendor/codex/darwin-x64/codex
#   vendor/codex/linux-x64/codex
#   vendor/codex/win32-x64/codex.exe

set -euo pipefail

REPO="lukilabs/craft-agents-codex"
VENDOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/vendor/codex"
TAG="${1:-}"

# Resolve tag (use latest if not specified)
if [ -z "$TAG" ]; then
  echo "Fetching latest release tag..."
  TAG=$(gh release view --repo "$REPO" --json tagName -q .tagName)
  echo "Latest tag: $TAG"
fi

echo "Downloading Codex $TAG from $REPO..."

# Platform → asset filename map
# Format: "platform-arch|asset-name|binary-name"
declare -a PLATFORMS=(
  "darwin-arm64|codex-aarch64-apple-darwin.tar.gz|codex"
  "darwin-x64|codex-x86_64-apple-darwin.tar.gz|codex"
  "linux-x64|codex-x86_64-unknown-linux-gnu.tar.gz|codex"
  "win32-x64|codex-x86_64-pc-windows-msvc.zip|codex.exe"
)

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

for entry in "${PLATFORMS[@]}"; do
  IFS='|' read -r PLATFORM ASSET BINARY <<< "$entry"
  DEST_DIR="$VENDOR_DIR/$PLATFORM"
  DEST_BIN="$DEST_DIR/$BINARY"

  echo ""
  echo "→ $PLATFORM ($ASSET)"

  # Skip if already downloaded for this version
  # (check via a version marker file)
  VERSION_FILE="$DEST_DIR/.version"
  if [ -f "$DEST_BIN" ] && [ -f "$VERSION_FILE" ] && [ "$(cat "$VERSION_FILE")" = "$TAG" ]; then
    echo "  Already up to date ($TAG), skipping."
    continue
  fi

  mkdir -p "$DEST_DIR"

  # Download asset
  ASSET_PATH="$TMP_DIR/$ASSET"
  gh release download "$TAG" \
    --repo "$REPO" \
    --pattern "$ASSET" \
    --output "$ASSET_PATH"

  # Extract binary
  echo "  Extracting..."
  if [[ "$ASSET" == *.tar.gz ]]; then
    tar -xzf "$ASSET_PATH" -C "$TMP_DIR"
    # The binary is directly in the archive root
    cp "$TMP_DIR/$BINARY" "$DEST_BIN"
  elif [[ "$ASSET" == *.zip ]]; then
    unzip -o -q "$ASSET_PATH" -d "$TMP_DIR"
    cp "$TMP_DIR/$BINARY" "$DEST_BIN"
  fi

  # Make executable (Unix only)
  if [ "$BINARY" != "codex.exe" ]; then
    chmod +x "$DEST_BIN"
  fi

  # Write version marker
  echo "$TAG" > "$VERSION_FILE"

  echo "  Saved to $DEST_BIN"
done

echo ""
echo "Done! Codex $TAG binaries are in vendor/codex/"
