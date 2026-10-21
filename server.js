// cPanel/Passenger entry point. "next start" expects its own CLI flags for
// the port, but Passenger spawns the app directly and only tells it which
// port to listen on via the PORT env var — this thin wrapper bridges that.
// Not used by `pnpm dev`/Vercel; only needed for the cPanel deployment path.
const { createServer } = require("http")
const next = require("next")

const port = process.env.PORT || 3000
const app = next({ dev: false })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`TapIn listening on port ${port}`)
  })
})
