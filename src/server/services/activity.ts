import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Appends an audit entry. Always called inside the same transaction as the
 * change it describes, so the audit trail can never drift from the data.
 */
export async function logActivity(
  tx: Tx,
  entry: {
    tripId: string;
    actorId: string | null;
    type: string;
    message: string;
    data?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tx.activityLog.create({
    data: {
      tripId: entry.tripId,
      actorId: entry.actorId,
      type: entry.type,
      message: entry.message,
      data: entry.data,
    },
  });
}
