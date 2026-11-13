export const dynamic = "force-dynamic"

// The device polls this for pending commands. We don't issue any, so the
// correct response is a bare "OK" — it tells the terminal there's nothing to
// do and keeps the connection healthy. Command support (e.g. forcing a sync)
// can be added later by returning "C:<id>:<command>" here and receiving the
// result on /iclock/devicecmd.
export async function GET() {
  return new Response("OK", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}