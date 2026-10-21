// Run with plain `node migrate.cjs` on the server -- applies any pending
// Prisma migrations to DATABASE_URL. No npm/npx needed.
// (.cjs, not .js: the standalone output's package.json sets
// "type": "module", which would otherwise make Node reject `require`.)
const { spawnSync } = require("child_process")
const path = require("path")
const result = spawnSync(
  process.execPath,
  [path.join(__dirname, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
  { stdio: "inherit", cwd: __dirname },
)
process.exit(result.status ?? 1)
