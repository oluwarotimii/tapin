const fs = require("fs")
const wasm = require("./node_modules/prisma/build/diag_wrapper.js")

const datamodel = fs.readFileSync("prisma/schema.prisma", "utf8")

const payload = {
  prismaSchema: datamodel,
  datasourceOverrides: {},
  ignoreEnvVarErrors: false,
  env: { DATABASE_URL: "postgresql://testuser:testpass@127.0.0.1:5432/testdb" },
}

console.log("Node:", process.version)
console.log("Calling get_config directly (bypassing Prisma CLI wrapper)...")
try {
  const raw = wasm.get_config(JSON.stringify(payload))
  console.log("RAW RESULT:", raw)
} catch (err) {
  console.log("THREW EXCEPTION:")
  console.log(err)
}
