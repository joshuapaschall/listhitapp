#!/usr/bin/env bash
set -e

# Ensure pnpm is installed
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed. Please install pnpm first." >&2
  exit 1
fi

# Determine if node_modules exists
if [ -d node_modules ]; then
  echo "node_modules directory already exists. Skipping install."
  exit 0
fi

echo "Installing dependencies with pnpm..."
pnpm install
