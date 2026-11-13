export const dynamic = "force-dynamic"

// Liveness check some ZKTeco firmware hits before pushing data.
export async function GET() {
  return new Response("OK", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}