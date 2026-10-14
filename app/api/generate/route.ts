import { NextResponse } from "next/server";
import { AiError, aiConfig, chat } from "@/lib/ai-client";
import { generateListing } from "@/lib/generate";
import { createRateLimiter } from "@/lib/rate-limit";
import { generateRequestSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const limiter = createRateLimiter(10, 60_000);

function fail(error: string, message: string, status: number, headers: HeadersInit = {}) {
  return NextResponse.json({ error, message }, { status, headers });
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = limiter(ip);
  if (!rate.allowed) {
    return fail("rate_limited", "Too many requests. Please wait a moment and try again.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) {
    return fail("too_large", "Those photos are too big. Try smaller ones.", 413);
  }
  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return fail("too_large", "Those photos are too big. Try smaller ones.", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(bodyText);
  } catch {
    return fail("bad_request", "Request body must be JSON.", 400);
  }
  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return fail("bad_request", "Please add 1 to 3 photos (JPEG, PNG or WebP) and pick a style.", 400);
  }

  const { model } = aiConfig();
  const started = performance.now();
  try {
    const { listing: full, attempts } = await generateListing(parsed.data, chat);
    // "seen" only grounds the model's writing; the seller does not need it.
    const { seen: _seen, ...listing } = full;
    void _seen;
    const ms = Math.round(performance.now() - started);
    console.log(
      `[oja] generated style=${parsed.data.style} images=${parsed.data.images.length} model=${model} attempts=${attempts} ms=${ms}`,
    );
    return NextResponse.json({ listing, ms, model, attempts });
  } catch (err) {
    const ms = Math.round(performance.now() - started);
    if (err instanceof AiError) {
      console.error(`[oja] failed code=${err.code} ms=${ms}`);
      return fail(err.code, err.message, err.code === "timeout" ? 504 : 502);
    }
    console.error(`[oja] failed unexpected ms=${ms}`);
    return fail("internal", "Something went wrong on our side.", 500);
  }
}
