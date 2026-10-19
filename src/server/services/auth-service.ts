import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { AppError } from "@/server/errors";
import { isSupportedCurrency } from "@/domain/money";
import { sendMail } from "@/server/mailer";

const BCRYPT_ROUNDS = 12;
// Compared against when the email is unknown, so login timing does not reveal
// whether an account exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  preferredCurrency: string;
}

function toPublic(user: { id: string; email: string; name: string; preferredCurrency: string }): PublicUser {
  return { id: user.id, email: user.email, name: user.name, preferredCurrency: user.preferredCurrency };
}

export async function signUp(input: { email: string; password: string; name: string; preferredCurrency?: string }): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const currency = input.preferredCurrency ?? "INR";
  if (!isSupportedCurrency(currency)) throw AppError.badRequest("Unsupported currency");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw AppError.conflict("An account with this email already exists", "EMAIL_TAKEN");
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, name: input.name.trim(), preferredCurrency: currency },
  });
  return toPublic(user);
}

export async function verifyLogin(email: string, password: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw AppError.unauthorized("Incorrect email or password");
  return toPublic(user);
}

export async function updateProfile(
  userId: string,
  input: { name?: string; preferredCurrency?: string },
): Promise<PublicUser> {
  if (input.preferredCurrency !== undefined && !isSupportedCurrency(input.preferredCurrency)) {
    throw AppError.badRequest("Unsupported currency");
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.preferredCurrency !== undefined ? { preferredCurrency: input.preferredCurrency } : {}),
    },
  });
  return toPublic(user);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw AppError.badRequest("Current password is incorrect", "WRONG_PASSWORD");
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // Changing the password signs out every other device.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Always succeeds from the caller's perspective (no account enumeration).
 * The reset link is delivered through the configured mailer; the development
 * mailer logs it to the server console.
 */
export async function requestPasswordReset(email: string, appOrigin: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return;
  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashResetToken(token), userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  });
  const url = `${appOrigin}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Reset your TripSplit password",
    text: `Hi ${user.name},\n\nUse this link to reset your password (valid for 30 minutes):\n${url}\n\nIf you didn't request this, you can ignore this email.`,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw AppError.badRequest("This reset link is invalid or has expired", "INVALID_RESET_TOKEN");
  }
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
}
