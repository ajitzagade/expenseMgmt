import "server-only";
import { createHash } from "node:crypto";

/**
 * Hash for single-use capability tokens (invites, password resets). The raw
 * token is a 192+ bit random secret that only ever lives in the URL; storing
 * its SHA-256 means a database leak reveals nothing usable.
 * (Session tokens use a separate SESSION_SECRET-peppered hash in lib/session.)
 */
export function sha256Hex(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
