import { prisma } from "@/lib/db";
import { signUp } from "@/server/services/auth-service";

/** Wipes all rows between tests (schema stays; migrations already applied). */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "ActivityLog", "Settlement", "ExpenseAllocation", "ExpensePayerContribution", "Expense",
     "TripInvitation", "Participant", "Trip", "PasswordResetToken", "Session", "User" CASCADE`,
  );
}

export async function createUser(name: string, email: string) {
  return signUp({ email, password: "correct-horse-battery", name });
}
