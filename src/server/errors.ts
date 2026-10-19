import { DomainError } from "@/domain/money";
import { Prisma } from "@/generated/prisma/client";

/**
 * Service-layer error with an HTTP status. Thrown by services, mapped to a
 * JSON error response by the API layer. Messages are safe to show to users.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, code = "BAD_REQUEST"): AppError {
    return new AppError(400, code, message);
  }
  static unauthorized(message = "You need to sign in"): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You don't have access to this"): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found"): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message: string, code = "CONFLICT"): AppError {
    return new AppError(409, code, message);
  }
}

/**
 * True when the error is a Postgres unique-constraint violation on `column`.
 * Used to resolve idempotency races: two concurrent requests with the same
 * key both pass the pre-check; the loser's INSERT lands here and is answered
 * with the winner's row instead of a 500.
 */
export function isUniqueViolation(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const meta = error.meta as Record<string, unknown> | undefined;
  // Engine-dependent shapes: a column array, a constraint-name string, or
  // (driver adapters) a nested { constraint: { index } } / { fields }.
  const target = meta?.target;
  if (Array.isArray(target)) return (target as string[]).includes(column);
  if (typeof target === "string") return target.includes(column);
  const cause = (meta?.driverAdapterError as { cause?: { constraint?: { index?: string; fields?: string[] } } } | undefined)
    ?.cause;
  if (typeof cause?.constraint?.index === "string") return cause.constraint.index.includes(column);
  if (Array.isArray(cause?.constraint?.fields)) return cause.constraint.fields.includes(column);
  return false;
}

/** Converts domain validation failures into 400s; rethrows anything else. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DomainError) return new AppError(400, error.code, error.message);
  throw error;
}
