import { CHAIN_ID } from "@/lib/config";

/** Liveness probe. Static so the route also exists in the STATIC_EXPORT build. */
export const dynamic = "force-static";

export function GET() {
  return Response.json({ ok: true, service: "verdictloop-console", chainId: CHAIN_ID });
}
