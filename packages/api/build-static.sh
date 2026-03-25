#!/bin/bash
# Build and copy static assets into api/public/ for single-server serving
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

echo "Building admin..."
cd packages/admin && npm run build && cd "$ROOT"

echo "Building widget..."
cd packages/widget && npm run build && cd "$ROOT"

echo "Copying assets to api/public/..."
# Save demo page before wiping
cp packages/api/public/demo/index.html /tmp/demo-index.html 2>/dev/null || true

rm -rf packages/api/public
mkdir -p packages/api/public/admin packages/api/public/widget packages/api/public/demo

cp -r packages/admin/dist/* packages/api/public/admin/
cp packages/widget/dist/roofing-widget.js packages/api/public/widget/
cp /tmp/demo-index.html packages/api/public/demo/index.html 2>/dev/null || true

echo "Done."
