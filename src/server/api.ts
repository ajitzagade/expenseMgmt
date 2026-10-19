import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { DomainError } from "@/domain/money";
import { AppError } from "./errors";
import { rateLimit } from "@/lib/ratelimit";

/** Standard JSON error shape: { error: { code, message } }. */
export function jsonError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;

/**
 * Wraps a route handler with centralized error mapping. Domain and service
 * errors become structured 4xx responses; anything unexpected becomes an
 * opaque 500 (details only in server logs, never in the response).
 */
export function withErrorHandling<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      if (error instanceof AppError) return jsonError(error.status, error.code, error.message);
      if (error instanceof DomainError) return jsonError(400, error.code, error.message);
      console.error(`[api] ${req.method} ${req.nextUrl.pathname} failed:`, error);
      return jsonError(500, "INTERNAL", "Something went wrong. Please try again.");
    }
  };
}

/** Parses and validates a JSON body; 400 with the first issue on failure. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw AppError.badRequest("Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
    throw AppError.badRequest(`${path}${issue.message}`, "VALIDATION");
  }
  return result.data;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Throws 429 when the caller exceeds `limit` requests per window. */
export function enforceRateLimit(req: NextRequest, bucket: string, limit: number, windowMs: number): void {
  const { ok, retryAfterSeconds } = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (!ok) {
    throw new AppError(429, "RATE_LIMITED", `Too many attempts. Try again in ${retryAfterSeconds}s.`);
  }
}
