import { NextResponse } from "next/server";
import { endpointInfo } from "@/lib/ai-client";

export const dynamic = "force-dynamic";

/** Liveness probe plus the model badge data. Never returns keys or the endpoint URL. */
export function GET() {
  return NextResponse.json({ ok: true, ...endpointInfo() });
}
