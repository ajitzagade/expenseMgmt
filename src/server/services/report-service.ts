import "server-only";
import { prisma } from "@/lib/db";
import { suggestSettlements, type SuggestedTransfer } from "@/domain/settlement";
import { formatMinor, type CurrencyCode } from "@/domain/money";
import { getCategoryBreakdown, getTripFinancials, type ParticipantWithBalance } from "./balance-service";

export interface TripReport {
  trip: {
    id: string;
    name: string;
    destination: string | null;
    startDate: string | null;
    endDate: string | null;
    currency: CurrencyCode;
    status: string;
  };
  generatedAt: string;
  participants: ParticipantWithBalance[];
  totalSpentMinor: number;
  expenseCount: number;
  categoryBreakdown: { category: string; totalMinor: number; count: number }[];
  expenses: {
    id: string;
    title: string;
    category: string;
    spentAt: string;
    amountMinor: number;
    payers: { name: string; amountMinor: number }[];
    allocations: { name: string; amountMinor: number }[];
  }[];
  completedSettlements: { fromName: string; toName: string; amountMinor: number; paidAt: string }[];
  remainingTransfers: (SuggestedTransfer & { fromName: string; toName: string })[];
}

export async function getTripReport(tripId: string): Promise<TripReport> {
  const [trip, financials, expenses, categoryBreakdown, settlements] = await Promise.all([
    prisma.trip.findUniqueOrThrow({ where: { id: tripId } }),
    getTripFinancials(tripId),
    prisma.expense.findMany({
      where: { tripId },
      orderBy: [{ spentAt: "asc" }, { id: "asc" }],
      include: {
        payers: { include: { participant: { select: { name: true } } } },
        allocations: { include: { participant: { select: { name: true } } } },
      },
    }),
    getCategoryBreakdown(tripId),
    prisma.settlement.findMany({
      where: { tripId, status: "CONFIRMED" },
      orderBy: { paidAt: "asc" },
      include: { fromParticipant: { select: { name: true } }, toParticipant: { select: { name: true } } },
    }),
  ]);

  const nameOf = new Map(financials.participants.map((p) => [p.id, p.name]));
  const suggestions = financials.reconciliationMinor === 0 ? suggestSettlements(financials.balances.values()) : [];

  return {
    trip: {
      id: trip.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: trip.endDate?.toISOString().slice(0, 10) ?? null,
      currency: trip.currency as CurrencyCode,
      status: trip.status,
    },
    generatedAt: new Date().toISOString(),
    participants: financials.participants,
    totalSpentMinor: financials.totalSpentMinor,
    expenseCount: financials.expenseCount,
    categoryBreakdown,
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      spentAt: e.spentAt.toISOString(),
      amountMinor: e.amountMinor,
      payers: e.payers.map((p) => ({ name: p.participant.name, amountMinor: p.amountMinor })),
      allocations: e.allocations.map((a) => ({ name: a.participant.name, amountMinor: a.amountMinor })),
    })),
    completedSettlements: settlements.map((s) => ({
      fromName: s.fromParticipant.name,
      toName: s.toParticipant.name,
      amountMinor: s.amountMinor,
      paidAt: s.paidAt.toISOString(),
    })),
    remainingTransfers: suggestions.map((t) => ({
      ...t,
      fromName: nameOf.get(t.fromParticipantId) ?? "?",
      toName: nameOf.get(t.toParticipantId) ?? "?",
    })),
  };
}

function csvEscape(value: string | number): string {
  let s = String(value);
  // Neutralize spreadsheet formula injection: a leading =, @, or a +/- that
  // is not a plain number gets a quote prefix so Excel/Sheets treat it as text.
  if (/^[=@]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s))) {
    s = `'${s}`;
  }
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvEscape).join(",");
}

/** Renders the final report as CSV (amounts in major units, e.g. rupees). */
export function reportToCsv(report: TripReport): string {
  const c = report.trip.currency;
  const major = (minor: number) => (minor / 100).toFixed(2);
  const lines: string[] = [];

  lines.push(csvRow(["Trip report", report.trip.name]));
  lines.push(csvRow(["Destination", report.trip.destination ?? ""]));
  lines.push(csvRow(["Dates", `${report.trip.startDate ?? "-"} to ${report.trip.endDate ?? "-"}`]));
  lines.push(csvRow(["Currency", c]));
  lines.push(csvRow(["Total expenses", major(report.totalSpentMinor)]));
  lines.push("");

  lines.push("Participants");
  lines.push(csvRow(["Name", "Paid", "Share of expenses", "Settlements paid", "Settlements received", "Net balance", "Outstanding"]));
  for (const p of report.participants) {
    lines.push(
      csvRow([
        p.name,
        major(p.paidMinor),
        major(p.allocatedMinor),
        major(p.settlementsPaidMinor),
        major(p.settlementsReceivedMinor),
        major(p.netMinor),
        major(p.outstandingMinor),
      ]),
    );
  }
  lines.push("");

  lines.push("Category breakdown");
  lines.push(csvRow(["Category", "Total", "Expenses"]));
  for (const cat of report.categoryBreakdown) {
    lines.push(csvRow([cat.category, major(cat.totalMinor), cat.count]));
  }
  lines.push("");

  lines.push("Expenses");
  lines.push(csvRow(["Date", "Title", "Category", "Amount", "Paid by", "Split between"]));
  for (const e of report.expenses) {
    lines.push(
      csvRow([
        e.spentAt.slice(0, 10),
        e.title,
        e.category,
        major(e.amountMinor),
        e.payers.map((p) => `${p.name} ${formatMinor(p.amountMinor, c)}`).join("; "),
        e.allocations
          .filter((a) => a.amountMinor > 0)
          .map((a) => `${a.name} ${formatMinor(a.amountMinor, c)}`)
          .join("; "),
      ]),
    );
  }
  lines.push("");

  lines.push("Completed settlements");
  lines.push(csvRow(["Date", "From", "To", "Amount"]));
  for (const s of report.completedSettlements) {
    lines.push(csvRow([s.paidAt.slice(0, 10), s.fromName, s.toName, major(s.amountMinor)]));
  }
  lines.push("");

  lines.push("Remaining suggested transfers");
  lines.push(csvRow(["From", "To", "Amount"]));
  for (const t of report.remainingTransfers) {
    lines.push(csvRow([t.fromName, t.toName, major(t.amountMinor)]));
  }

  return lines.join("\n");
}
