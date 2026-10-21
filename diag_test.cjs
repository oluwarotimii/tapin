const fs = require("fs")
const wasm = require("./node_modules/prisma/build/diag_wrapper.js")

const datamodel = fs.readFileSync("prisma/schema.prisma", "utf8")

process.env.DATABASE_URL = "postgresql://testuser:testpass@127.0.0.1:5432/testdb"

const payload = {
  prismaSchema: datamodel,
  datasourceOverrides: {},
  ignoreEnvVarErrors: false,
  env: process.env,
}

console.log("Node:", process.version)
console.log("env var count:", Object.keys(process.env).length)
console.log("JSON size:", JSON.stringify(payload).length)
console.log("Calling get_config with the REAL full process.env...")
try {
  const raw = wasm.get_config(JSON.stringify(payload))
  console.log("RAW RESULT:", raw)
} catch (err) {
  console.log("THREW EXCEPTION:")
  console.log(err)
}
