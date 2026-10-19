/**
 * Development seed: the reference "Goa Weekend Trip" scenario.
 *
 * Sign in as ajit@example.com / password123 (or rahul@example.com) to explore
 * a trip with mixed splits, guests, and a partial settlement already recorded.
 *
 * Idempotent: skips if the demo user already exists. Never run in production.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  if (await prisma.user.findUnique({ where: { email: "ajit@example.com" } })) {
    console.log("Seed data already present — nothing to do.");
    return;
  }
  const passwordHash = await bcrypt.hash("password123", 12);
  const ajit = await prisma.user.create({
    data: { email: "ajit@example.com", passwordHash, name: "Ajit", preferredCurrency: "INR" },
  });
  const rahul = await prisma.user.create({
    data: { email: "rahul@example.com", passwordHash, name: "Rahul", preferredCurrency: "INR" },
  });

  const trip = await prisma.trip.create({
    data: {
      name: "Goa Weekend Trip",
      destination: "Goa",
      description: "Long weekend by the beach.",
      startDate: new Date("2026-11-06"),
      endDate: new Date("2026-11-08"),
      currency: "INR",
      status: "ONGOING",
      createdById: ajit.id,
      participants: {
        create: [
          { name: "Ajit", userId: ajit.id, role: "ADMIN" },
          { name: "Rahul", userId: rahul.id },
          { name: "Amit" }, // guests — can claim their identity via invite link
          { name: "Sneha" },
        ],
      },
    },
    include: { participants: true },
  });
  const pid = Object.fromEntries(trip.participants.map((p) => [p.name, p.id]));
  const everyone = ["Ajit", "Rahul", "Amit", "Sneha"];

  const expenses: {
    title: string;
    category: string;
    amount: number;
    payer: string;
    sharers: string[];
    daysAgoOffset: number;
  }[] = [
    { title: "Hotel", category: "Accommodation", amount: 800000, payer: "Ajit", sharers: everyone, daysAgoOffset: 0 },
    { title: "Dinner", category: "Food", amount: 240000, payer: "Rahul", sharers: everyone, daysAgoOffset: 1 },
    { title: "Drinks", category: "Drinks", amount: 120000, payer: "Amit", sharers: ["Ajit", "Amit"], daysAgoOffset: 1 },
    { title: "Taxi", category: "Transport", amount: 80000, payer: "Sneha", sharers: ["Rahul", "Sneha"], daysAgoOffset: 2 },
    { title: "Breakfast", category: "Food", amount: 60000, payer: "Ajit", sharers: ["Ajit", "Rahul", "Sneha"], daysAgoOffset: 2 },
  ];

  for (const e of expenses) {
    // Equal split with deterministic remainder: all amounts here divide evenly.
    const share = Math.floor(e.amount / e.sharers.length);
    const remainder = e.amount - share * e.sharers.length;
    await prisma.expense.create({
      data: {
        tripId: trip.id,
        title: e.title,
        category: e.category,
        amountMinor: e.amount,
        spentAt: new Date(Date.UTC(2026, 10, 6 + e.daysAgoOffset, 12)),
        splitMethod: "EQUAL",
        createdByParticipantId: pid[e.payer] ?? pid["Ajit"],
        payers: { create: [{ participantId: pid[e.payer], amountMinor: e.amount }] },
        allocations: {
          create: e.sharers.map((name, i) => ({
            participantId: pid[name],
            amountMinor: share + (i < remainder ? 1 : 0),
          })),
        },
      },
    });
  }

  await prisma.settlement.create({
    data: {
      tripId: trip.id,
      fromParticipantId: pid["Amit"],
      toParticipantId: pid["Ajit"],
      amountMinor: 100000,
      method: "UPI",
      note: "Part payment",
      createdByUserId: ajit.id,
    },
  });

  await prisma.activityLog.create({
    data: { tripId: trip.id, actorId: ajit.id, type: "TRIP_CREATED", message: `created the trip "${trip.name}"` },
  });

  console.log("Seeded the Goa Weekend Trip demo.");
  console.log("Sign in with ajit@example.com / password123 (admin) or rahul@example.com / password123.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
