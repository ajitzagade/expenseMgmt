/**
 * Development seed: a varied portfolio of demo trips.
 *
 *   Trip                    Days  People  Status     Shows off
 *   ─────────────────────────────────────────────────────────────────────
 *   Lonavala Day Trip        1      2     COMPLETED  smallest group, fully settled
 *   Solo Pondicherry         2      1     COMPLETED  one-person trip, nothing to settle
 *   Goa Weekend Trip         3      4     ONGOING    the reference scenario + part-payment
 *   Rajasthan Road Trip      7      6     ARCHIVED   shares & percentage splits, reversed payment
 *   Himachal Backpacking    10     10     ONGOING    large group, every split type, multi-payer
 *   Andaman Dive Trip        6      5     UPCOMING   future trip with one advance booking
 *
 * All allocations are computed with the real domain split engine, so every
 * trip's books reconcile to the exact paisa. Idempotent and incremental:
 * existing users/trips are reused, missing ones are added.
 * Sign in: ajit@example.com / password123 (also rahul@ / meera@ / vikram@).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeSplit, validatePayerContributions, type SplitMethod, type SplitParticipantInput } from "../src/domain/split";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DAY = 24 * 60 * 60 * 1000;
const today = new Date(new Date().toISOString().slice(0, 10)); // midnight UTC
const daysFromNow = (n: number) => new Date(today.getTime() + n * DAY);
/** Timestamp on day `d` (0-based) of a trip starting `start`, at `hour`. */
const at = (start: Date, d: number, hour: number) => new Date(start.getTime() + d * DAY + hour * 60 * 60 * 1000);

async function ensureUser(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  const passwordHash = await bcrypt.hash("password123", 12);
  return prisma.user.create({ data: { email, passwordHash, name, preferredCurrency: "INR" } });
}

interface TripSpec {
  name: string;
  destination: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: "UPCOMING" | "ONGOING" | "COMPLETED" | "ARCHIVED";
  colorIndex: number;
  createdByEmail: string;
  /** Linked members as [email, display name]; guests as plain names. */
  members: [string, string][];
  guests: string[];
}

async function ensureTrip(spec: TripSpec): Promise<{ id: string; pid: Record<string, string>; created: boolean } > {
  const creator = await prisma.user.findUniqueOrThrow({ where: { email: spec.createdByEmail } });
  const existing = await prisma.trip.findFirst({
    where: { name: spec.name, createdById: creator.id },
    include: { participants: true },
  });
  if (existing) {
    return { id: existing.id, pid: Object.fromEntries(existing.participants.map((p) => [p.name, p.id])), created: false };
  }
  const memberUsers = await Promise.all(spec.members.map(([email]) => prisma.user.findUniqueOrThrow({ where: { email } })));
  const trip = await prisma.trip.create({
    data: {
      name: spec.name,
      destination: spec.destination,
      description: spec.description,
      startDate: spec.startDate,
      endDate: spec.endDate,
      currency: "INR",
      status: spec.status,
      colorIndex: spec.colorIndex,
      createdById: creator.id,
      participants: {
        create: [
          ...spec.members.map(([email, name], i) => ({
            name,
            userId: memberUsers[i].id,
            role: email === spec.createdByEmail ? ("ADMIN" as const) : ("MEMBER" as const),
          })),
          ...spec.guests.map((name) => ({ name })),
        ],
      },
    },
    include: { participants: true },
  });
  await prisma.activityLog.create({
    data: { tripId: trip.id, actorId: creator.id, type: "TRIP_CREATED", message: `created the trip "${trip.name}"` },
  });
  return { id: trip.id, pid: Object.fromEntries(trip.participants.map((p) => [p.name, p.id])), created: true };
}

interface ExpenseSpec {
  title: string;
  category: string;
  amount: number; // minor units
  spentAt: Date;
  method?: SplitMethod;
  payers: [string, number][]; // [participant name, minor units]
  split: (Omit<SplitParticipantInput, "participantId"> & { name: string })[];
  merchant?: string;
  notes?: string;
}

async function addExpense(tripId: string, pid: Record<string, string>, e: ExpenseSpec) {
  const method = e.method ?? "EQUAL";
  const payers = e.payers.map(([name, amountMinor]) => ({ participantId: pid[name], amountMinor }));
  validatePayerContributions(e.amount, payers);
  const allocations = computeSplit({
    method,
    amountMinor: e.amount,
    participants: e.split.map(({ name, ...rest }) => ({ ...rest, participantId: pid[name] })),
  });
  const weightOf = new Map(
    e.split.map((s) => [pid[s.name], method === "PERCENTAGE" ? (s.percentBps ?? null) : method === "SHARES" ? (s.shares ?? null) : null]),
  );
  await prisma.expense.create({
    data: {
      tripId,
      title: e.title,
      category: e.category,
      amountMinor: e.amount,
      spentAt: e.spentAt,
      splitMethod: method,
      merchant: e.merchant,
      notes: e.notes,
      createdByParticipantId: payers[0].participantId,
      payers: { create: payers },
      allocations: {
        create: allocations.map((a) => ({ participantId: a.participantId, amountMinor: a.amountMinor, weight: weightOf.get(a.participantId) ?? null })),
      },
    },
  });
}

async function addSettlement(
  tripId: string,
  pid: Record<string, string>,
  byUserId: string,
  from: string,
  to: string,
  amount: number,
  paidAt: Date,
  opts?: { method?: string; note?: string; reversed?: string },
) {
  await prisma.settlement.create({
    data: {
      tripId,
      fromParticipantId: pid[from],
      toParticipantId: pid[to],
      amountMinor: amount,
      method: opts?.method,
      note: opts?.note,
      paidAt,
      createdByUserId: byUserId,
      ...(opts?.reversed ? { status: "REVERSED", reversedAt: new Date(paidAt.getTime() + DAY), reversalReason: opts.reversed } : {}),
    },
  });
}

async function main() {
  const ajit = await ensureUser("ajit@example.com", "Ajit");
  const rahul = await ensureUser("rahul@example.com", "Rahul");
  const meera = await ensureUser("meera@example.com", "Meera");
  const vikram = await ensureUser("vikram@example.com", "Vikram");

  // ───────────────────────── Goa Weekend Trip (3 days, 4 people, ongoing)
  {
    const start = daysFromNow(-1);
    const t = await ensureTrip({
      name: "Goa Weekend Trip",
      destination: "Goa",
      description: "Long weekend by the beach.",
      startDate: start,
      endDate: daysFromNow(1),
      status: "ONGOING",
      colorIndex: 0,
      createdByEmail: "ajit@example.com",
      members: [["ajit@example.com", "Ajit"], ["rahul@example.com", "Rahul"]],
      guests: ["Amit", "Sneha"],
    });
    if (t.created) {
      const everyone = ["Ajit", "Rahul", "Amit", "Sneha"].map((name) => ({ name }));
      await addExpense(t.id, t.pid, { title: "Hotel", category: "Accommodation", amount: 800000, spentAt: at(start, 0, 12), payers: [["Ajit", 800000]], split: everyone, merchant: "Casa Baga" });
      await addExpense(t.id, t.pid, { title: "Dinner", category: "Food", amount: 240000, spentAt: at(start, 0, 20), payers: [["Rahul", 240000]], split: everyone, merchant: "Thalassa" });
      await addExpense(t.id, t.pid, { title: "Drinks", category: "Drinks", amount: 120000, spentAt: at(start, 0, 22), payers: [["Amit", 120000]], split: [{ name: "Ajit" }, { name: "Amit" }] });
      await addExpense(t.id, t.pid, { title: "Taxi", category: "Transport", amount: 80000, spentAt: at(start, 1, 9), payers: [["Sneha", 80000]], split: [{ name: "Rahul" }, { name: "Sneha" }] });
      await addExpense(t.id, t.pid, { title: "Breakfast", category: "Food", amount: 60000, spentAt: at(start, 1, 10), payers: [["Ajit", 60000]], split: [{ name: "Ajit" }, { name: "Rahul" }, { name: "Sneha" }] });
      await addSettlement(t.id, t.pid, ajit.id, "Amit", "Ajit", 100000, at(start, 1, 18), { method: "UPI", note: "Part payment" });
    }
  }

  // ───────────────────────── Lonavala Day Trip (1 day, 2 people, completed & settled)
  {
    const start = daysFromNow(-20);
    const t = await ensureTrip({
      name: "Lonavala Day Trip",
      destination: "Lonavala",
      description: "Quick monsoon getaway.",
      startDate: start,
      endDate: start,
      status: "COMPLETED",
      colorIndex: 5,
      createdByEmail: "rahul@example.com",
      members: [["rahul@example.com", "Rahul"], ["ajit@example.com", "Ajit"]],
      guests: [],
    });
    if (t.created) {
      const both = [{ name: "Rahul" }, { name: "Ajit" }];
      await addExpense(t.id, t.pid, { title: "Fuel", category: "Fuel", amount: 180000, spentAt: at(start, 0, 7), payers: [["Rahul", 180000]], split: both });
      await addExpense(t.id, t.pid, { title: "Bhushi Dam entry & snacks", category: "Activities", amount: 46000, spentAt: at(start, 0, 11), payers: [["Ajit", 46000]], split: both });
      await addExpense(t.id, t.pid, { title: "Lunch at Rama Krishna", category: "Food", amount: 94000, spentAt: at(start, 0, 14), payers: [["Ajit", 94000]], split: both, merchant: "Rama Krishna" });
      await addExpense(t.id, t.pid, { title: "Chikki & fudge", category: "Shopping", amount: 60000, spentAt: at(start, 0, 17), payers: [["Rahul", 60000]], split: both, merchant: "Maganlal" });
      // Rahul paid 240000, share 190000 -> +50000; Ajit -50000. Settled in full.
      await addSettlement(t.id, t.pid, rahul.id, "Ajit", "Rahul", 50000, at(start, 1, 10), { method: "UPI", note: "Settled in full" });
    }
  }

  // ───────────────────────── Solo Pondicherry (2 days, 1 person, completed)
  {
    const start = daysFromNow(-42);
    const t = await ensureTrip({
      name: "Solo Pondicherry",
      destination: "Puducherry",
      description: "Cafés, cycling and the promenade.",
      startDate: start,
      endDate: daysFromNow(-41),
      status: "COMPLETED",
      colorIndex: 2,
      createdByEmail: "rahul@example.com",
      members: [["rahul@example.com", "Rahul"]],
      guests: [],
    });
    if (t.created) {
      const me = [{ name: "Rahul" }];
      await addExpense(t.id, t.pid, { title: "Bus tickets", category: "Transport", amount: 160000, spentAt: at(start, 0, 6), payers: [["Rahul", 160000]], split: me });
      await addExpense(t.id, t.pid, { title: "Guesthouse", category: "Accommodation", amount: 210000, spentAt: at(start, 0, 12), payers: [["Rahul", 210000]], split: me });
      await addExpense(t.id, t.pid, { title: "Café Des Arts brunch", category: "Food", amount: 52000, spentAt: at(start, 1, 11), payers: [["Rahul", 52000]], split: me, merchant: "Café Des Arts" });
      await addExpense(t.id, t.pid, { title: "Cycle rental", category: "Activities", amount: 20000, spentAt: at(start, 1, 9), payers: [["Rahul", 20000]], split: me });
    }
  }

  // ───────────────────────── Rajasthan Road Trip (7 days, 6 people, archived)
  {
    const start = daysFromNow(-95);
    const t = await ensureTrip({
      name: "Rajasthan Road Trip",
      destination: "Jaipur – Jodhpur – Jaisalmer",
      description: "Forts, dunes and dal baati.",
      startDate: start,
      endDate: daysFromNow(-88),
      status: "ARCHIVED",
      colorIndex: 6,
      createdByEmail: "ajit@example.com",
      members: [["ajit@example.com", "Ajit"], ["meera@example.com", "Meera"], ["vikram@example.com", "Vikram"]],
      guests: ["Kabir", "Tara", "Ishaan"],
    });
    if (t.created) {
      const all6 = ["Ajit", "Meera", "Vikram", "Kabir", "Tara", "Ishaan"].map((name) => ({ name }));
      await addExpense(t.id, t.pid, { title: "Tempo traveller (7 days)", category: "Transport", amount: 4200000, spentAt: at(start, 0, 8), payers: [["Ajit", 4200000]], split: all6, notes: "Driver + tolls included" });
      await addExpense(t.id, t.pid, { title: "Jaipur haveli stay (2 nights)", category: "Accommodation", amount: 2400000, spentAt: at(start, 0, 14), payers: [["Meera", 2400000]], split: all6 });
      await addExpense(t.id, t.pid, { title: "Amber Fort tickets & guide", category: "Tickets", amount: 330000, spentAt: at(start, 1, 10), payers: [["Vikram", 330000]], split: all6 });
      // Couples' rooms by shares: Ajit+Meera and Kabir+Tara took doubles (2 shares each pair), singles 1 each.
      await addExpense(t.id, t.pid, {
        title: "Jodhpur hotel (2 nights)", category: "Accommodation", amount: 1800000, spentAt: at(start, 2, 15),
        method: "SHARES", payers: [["Kabir", 1800000]],
        split: [
          { name: "Ajit", shares: 2 }, { name: "Meera", shares: 2 },
          { name: "Kabir", shares: 2 }, { name: "Tara", shares: 2 },
          { name: "Vikram", shares: 1 }, { name: "Ishaan", shares: 1 },
        ],
        notes: "Doubles count double, singles single",
      });
      await addExpense(t.id, t.pid, { title: "Desert camp + camel safari", category: "Activities", amount: 2100000, spentAt: at(start, 4, 16), payers: [["Tara", 1200000], ["Ishaan", 900000]], split: all6 });
      await addExpense(t.id, t.pid, { title: "Handicrafts & textiles", category: "Shopping", amount: 540000, spentAt: at(start, 5, 17), method: "EXACT", payers: [["Meera", 540000]], split: [
        { name: "Meera", exactMinor: 260000 }, { name: "Tara", exactMinor: 180000 }, { name: "Ajit", exactMinor: 100000 },
      ] });
      await addExpense(t.id, t.pid, { title: "Farewell dinner", category: "Food", amount: 720000, spentAt: at(start, 6, 20), payers: [["Ajit", 720000]], split: all6, merchant: "Trio, Jaisalmer" });
      // Settlements: one mistake reversed, then corrected; trip left with small outstanding balances.
      await addSettlement(t.id, t.pid, ajit.id, "Kabir", "Ajit", 500000, at(start, 7, 9), { method: "Bank", reversed: "Typo — recorded twice" });
      await addSettlement(t.id, t.pid, ajit.id, "Kabir", "Ajit", 50000, at(start, 7, 9), { method: "Bank" });
      await addSettlement(t.id, t.pid, ajit.id, "Vikram", "Ajit", 700000, at(start, 8, 12), { method: "UPI" });
      await addSettlement(t.id, t.pid, ajit.id, "Ishaan", "Meera", 400000, at(start, 8, 18), { method: "Cash" });
    }
  }

  // ───────────────────────── Himachal Backpacking (10 days, 10 people, ongoing)
  {
    const start = daysFromNow(-4);
    const t = await ensureTrip({
      name: "Himachal Backpacking",
      destination: "Manali – Kasol – Spiti",
      description: "Ten days in the mountains with the whole gang.",
      startDate: start,
      endDate: daysFromNow(6),
      status: "ONGOING",
      colorIndex: 3,
      createdByEmail: "vikram@example.com",
      members: [["vikram@example.com", "Vikram"], ["ajit@example.com", "Ajit"], ["rahul@example.com", "Rahul"], ["meera@example.com", "Meera"]],
      guests: ["Dev", "Anya", "Rohit", "Zara", "Karan", "Nisha"],
    });
    if (t.created) {
      const names = ["Vikram", "Ajit", "Rahul", "Meera", "Dev", "Anya", "Rohit", "Zara", "Karan", "Nisha"];
      const all10 = names.map((name) => ({ name }));
      // Day 0: overnight bus, booked by two people together (multi-payer).
      await addExpense(t.id, t.pid, { title: "Volvo bus Delhi → Manali ×10", category: "Flights & Trains", amount: 1500000, spentAt: at(start, 0, 18), payers: [["Vikram", 900000], ["Ajit", 600000]], split: all10 });
      // Day 1: hostel, equal across 10 (awkward remainder handled by engine).
      await addExpense(t.id, t.pid, { title: "Old Manali hostel (2 nights)", category: "Accommodation", amount: 1000001, spentAt: at(start, 1, 11), payers: [["Rahul", 1000001]], split: all10, notes: "₹10,000.01 — odd paisa on purpose" });
      await addExpense(t.id, t.pid, { title: "Group dinner, Café 1947", category: "Food", amount: 620000, spentAt: at(start, 1, 20), payers: [["Meera", 620000]], split: all10, merchant: "Café 1947" });
      // Day 2: river rafting — only 6 went; Karan paid though he skipped it.
      await addExpense(t.id, t.pid, { title: "River rafting ×6", category: "Activities", amount: 540000, spentAt: at(start, 2, 10), payers: [["Karan", 540000]], split: ["Vikram", "Rahul", "Dev", "Anya", "Rohit", "Zara"].map((name) => ({ name })), notes: "Karan paid but sat out" });
      await addExpense(t.id, t.pid, { title: "Rented scooters & fuel", category: "Fuel", amount: 240000, spentAt: at(start, 2, 15), payers: [["Dev", 240000]], split: ["Dev", "Anya", "Karan", "Nisha"].map((name) => ({ name })) });
      // Day 3: drinks for a subset.
      await addExpense(t.id, t.pid, { title: "Drinks at Johnson's", category: "Drinks", amount: 380000, spentAt: at(start, 3, 21), payers: [["Rohit", 380000]], split: ["Vikram", "Ajit", "Rohit", "Zara", "Karan"].map((name) => ({ name })) });
      // Day 3: groceries for the Kasol stay, percentage split by appetite (couples more).
      await addExpense(t.id, t.pid, {
        title: "Groceries for Kasol camp", category: "Groceries", amount: 300000, spentAt: at(start, 3, 12),
        method: "PERCENTAGE", payers: [["Nisha", 300000]],
        split: [
          { name: "Vikram", percentBps: 1500 }, { name: "Ajit", percentBps: 1500 },
          { name: "Rahul", percentBps: 1000 }, { name: "Meera", percentBps: 1000 },
          { name: "Dev", percentBps: 1000 }, { name: "Anya", percentBps: 1000 },
          { name: "Rohit", percentBps: 1000 }, { name: "Zara", percentBps: 1000 },
          { name: "Karan", percentBps: 500 }, { name: "Nisha", percentBps: 500 },
        ],
        notes: "Weighted by who eats how much — it's a thing now",
      });
      // Day 4: camping gear — custom category, exact amounts.
      await addExpense(t.id, t.pid, {
        title: "Camping gear rental", category: "Camping", amount: 450000, spentAt: at(start, 4, 9),
        method: "EXACT", payers: [["Zara", 450000]],
        split: [
          { name: "Zara", exactMinor: 150000 }, { name: "Dev", exactMinor: 100000 },
          { name: "Rohit", exactMinor: 100000 }, { name: "Karan", exactMinor: 100000 },
        ],
        notes: "Tents by size — custom category too",
      });
      // Settlements so far: two partials, one on its way.
      await addSettlement(t.id, t.pid, vikram.id, "Dev", "Rahul", 120000, at(start, 3, 9), { method: "UPI" });
      await addSettlement(t.id, t.pid, vikram.id, "Nisha", "Vikram", 80000, at(start, 4, 13), { method: "Cash", note: "Part payment" });
    }
  }

  // ───────────────────────── Andaman Dive Trip (6 days, 5 people, upcoming)
  {
    const start = daysFromNow(55);
    const t = await ensureTrip({
      name: "Andaman Dive Trip",
      destination: "Havelock Island",
      description: "Open-water certification for the group.",
      startDate: start,
      endDate: daysFromNow(60),
      status: "UPCOMING",
      colorIndex: 4,
      createdByEmail: "meera@example.com",
      members: [["meera@example.com", "Meera"], ["ajit@example.com", "Ajit"], ["vikram@example.com", "Vikram"]],
      guests: ["Tara", "Ishaan"],
    });
    if (t.created) {
      // One advance booking already paid before the trip starts.
      await addExpense(t.id, t.pid, {
        title: "Flight advance (Chennai → Port Blair ×5)", category: "Flights & Trains", amount: 4500000,
        spentAt: daysFromNow(-3),
        payers: [["Meera", 4500000]],
        split: ["Meera", "Ajit", "Vikram", "Tara", "Ishaan"].map((name) => ({ name })),
        notes: "Booked early for the fare",
      });
    }
  }

  const trips = await prisma.trip.count();
  console.log(`Seed complete — ${trips} trips in the database.`);
  console.log("Sign in: ajit@example.com / password123 (others: rahul@, meera@, vikram@ — same password).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
