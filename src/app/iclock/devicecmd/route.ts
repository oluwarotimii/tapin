export const dynamic = "force-dynamic"

// Result callback for commands we issued via /iclock/getrequest. We don't
// issue commands yet, but the terminal expects an acknowledgement for any
// command result it posts, so always answer OK.
export async function POST(req: Request) {
  await req.text().catch(() => "")
  return new Response("OK", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}