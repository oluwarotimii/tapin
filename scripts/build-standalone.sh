#!/usr/bin/env bash
# Builds the self-contained dist deployed to the `prod` branch for cPanel
# (no npm/npx on the target host — see AGENTS.md's cPanel deployment notes).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Generating Prisma client (bundled binaries for common cPanel hosts)..."
npx prisma generate

echo "==> Building in standalone mode..."
TAPIN_BUILD_STANDALONE=1 npx next build

DIST=".next/standalone"

echo "==> Copying static assets and public/ into the standalone output..."
mkdir -p "$DIST/.next/static"
cp -r .next/static/. "$DIST/.next/static/"
mkdir -p "$DIST/public"
cp -r public/. "$DIST/public/"
rm -f "$DIST/public/downloads/"*.exe

echo "==> Copying the Prisma schema..."
mkdir -p "$DIST/prisma"
cp -r prisma/. "$DIST/prisma/"

echo "==> Bundling the Prisma CLI for the one-time migration step..."
PRISMA_VERSION=$(node -e "console.log(require('./node_modules/prisma/package.json').version)")
PRISMA_SCRATCH=$(mktemp -d)
(cd "$PRISMA_SCRATCH" && npm init -y >/dev/null 2>&1 && npm install "prisma@${PRISMA_VERSION}" --omit=dev --no-audit --no-fund >/dev/null 2>&1)
mkdir -p "$DIST/node_modules/prisma" "$DIST/node_modules/@prisma"
cp -rL "$PRISMA_SCRATCH/node_modules/prisma/." "$DIST/node_modules/prisma/"
cp -rL "$PRISMA_SCRATCH/node_modules/@prisma/." "$DIST/node_modules/@prisma/"
for src in "$PRISMA_SCRATCH"/node_modules/*/; do
  name=$(basename "$src")
  [ "$name" = "prisma" ] && continue
  [ "$name" = "@prisma" ] && continue
  [ -e "$DIST/node_modules/$name" ] && continue
  cp -rL "$src" "$DIST/node_modules/$name"
done
rm -rf "$PRISMA_SCRATCH"

cat > "$DIST/migrate.cjs" <<'EOF'
const { spawnSync } = require("child_process")
const path = require("path")
const result = spawnSync(
  process.execPath,
  [path.join(__dirname, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
  { stdio: "inherit", cwd: __dirname },
)
process.exit(result.status ?? 1)
EOF

echo "==> Trimming unused Prisma engine binaries..."
rm -f "$DIST/node_modules/prisma/build/query_engine_bg."{mysql,sqlite,sqlserver,cockroachdb}.wasm
rm -f "$DIST/node_modules/prisma/build/query_compiler_bg."{mysql,sqlite,sqlserver,cockroachdb}.wasm
rm -f "$DIST/node_modules/prisma/libquery_engine-"*.so.node
rm -rf "$DIST/node_modules/prisma/build/public"
find "$DIST/node_modules/prisma" "$DIST/node_modules/@prisma" -name "*.map" -delete

# Next's standalone tracer copies .env*/*.env files as "runtime-needed" —
# this would otherwise leak real DB credentials into the prod branch. The
# server must get DATABASE_URL etc. from cPanel's own env var UI instead.
echo "==> Removing any copied .env files (secrets belong only in cPanel's env UI)..."
find "$DIST" -maxdepth 1 -iname ".env*" -delete

echo "==> Standalone dist ready at $DIST"
du -sh "$DIST"
