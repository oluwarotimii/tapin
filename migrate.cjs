const { spawnSync } = require("child_process")
const path = require("path")
const result = spawnSync(
  process.execPath,
  [path.join(__dirname, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
  { stdio: "inherit", cwd: __dirname },
)
process.exit(result.status ?? 1)
