import { DomainError } from "@/domain/money";

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

/** Converts domain validation failures into 400s; rethrows anything else. */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof DomainError) return new AppError(400, error.code, error.message);
  throw error;
}
