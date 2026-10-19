import { z } from "zod";
import { SUPPORTED_CURRENCIES } from "@/domain/money";
import { SPLIT_METHODS } from "@/domain/split";

/** Shared request schemas, used by API routes (and mirrored by UI forms). */

export const emailSchema = z.email("Enter a valid email address").max(254);
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long");
export const nameSchema = z.string().trim().min(1, "Name is required").max(80, "Name is too long");
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  preferredCurrency: currencySchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  preferredCurrency: currencySchema.optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(16).max(128), newPassword: passwordSchema });

// ---------- Trips ----------

const isoDate = z.iso.date("Use the YYYY-MM-DD date format");

export const tripCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Trip name is required").max(80),
    destination: z.string().trim().max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    currency: currencySchema.default("INR"),
    colorIndex: z.number().int().min(0).max(7).default(0),
    /** Guest participants to create alongside the trip, by display name. */
    participantNames: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    /** Registered users from the creator's previous trips to add as members. */
    companionUserIds: z.array(z.string().cuid()).max(50).default([]),
  })
  .refine((t) => !t.startDate || !t.endDate || t.startDate <= t.endDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  });

export const tripUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    destination: z.string().trim().max(120).nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: isoDate.nullable().optional(),
    endDate: isoDate.nullable().optional(),
    colorIndex: z.number().int().min(0).max(7).optional(),
    status: z.enum(["UPCOMING", "ONGOING", "COMPLETED", "ARCHIVED"]).optional(),
  })
  .refine((t) => !t.startDate || !t.endDate || t.startDate <= t.endDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  });

// ---------- Participants & invitations ----------

export const addParticipantSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(80) });
export const renameParticipantSchema = addParticipantSchema;

export const createInvitationSchema = z.object({
  /** Optional guest participant this invite should claim when accepted. */
  participantId: z.string().cuid().optional(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(16).max(128),
  /** Claim this unclaimed guest identity instead of joining as a new participant. */
  claimParticipantId: z.string().cuid().optional(),
});

// ---------- Expenses ----------

/** Suggested categories plus free-form custom ones (short, non-empty). */
export const categorySchema = z.string().trim().min(1).max(30);

const amountMinor = z
  .number()
  .int("Amounts must be whole minor units (e.g. paise)")
  .positive("Amount must be greater than zero")
  .max(1_000_000_000, "Amount is too large");

export const splitParticipantSchema = z.object({
  participantId: z.string().cuid(),
  exactMinor: z.number().int().min(0).max(1_000_000_000).optional(),
  percentBps: z.number().int().min(0).max(10_000).optional(),
  shares: z.number().int().min(1).max(1_000).optional(),
});

export const expenseWriteSchema = z.object({
  title: z.string().trim().min(1, "Give the expense a short title").max(120),
  amountMinor,
  category: categorySchema.default("Miscellaneous"),
  spentAt: z.iso.datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2000).optional(),
  merchant: z.string().trim().max(120).optional(),
  payers: z.array(z.object({ participantId: z.string().cuid(), amountMinor })).min(1).max(50),
  splitMethod: z.enum(SPLIT_METHODS),
  participants: z.array(splitParticipantSchema).min(1, "Select at least one participant").max(50),
});

export const splitPreviewSchema = z.object({
  amountMinor,
  splitMethod: z.enum(SPLIT_METHODS),
  participants: z.array(splitParticipantSchema).min(1).max(50),
});

// ---------- Settlements ----------

export const recordSettlementSchema = z.object({
  fromParticipantId: z.string().cuid(),
  toParticipantId: z.string().cuid(),
  amountMinor,
  method: z.string().trim().max(40).optional(),
  note: z.string().trim().max(500).optional(),
  paidAt: z.iso.datetime({ offset: true }).optional(),
  /** Client-generated UUID so retries never double-record a payment. */
  idempotencyKey: z.uuid().optional(),
});

export const reverseSettlementSchema = z.object({
  reason: z.string().trim().min(1, "Give a short reason for the reversal").max(300),
});
