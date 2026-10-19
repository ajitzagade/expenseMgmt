import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireTripPage } from "@/lib/guards";
import { getTripReport } from "@/server/services/report-service";
import { ButtonLink, Card } from "@/components/ui";
import { Money } from "@/components/money";
import { formatDate, formatDateRange } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Trip report" };

export default async function ReportPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  await requireTripPage(tripId);
  const report = await getTripReport(tripId);
  const c = report.trip.currency;

  return (
    <div className="mt-6 space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Final report</h2>
          <p className="text-sm text-ink-soft">A complete, shareable summary of this trip&apos;s money.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`/api/trips/${tripId}/report?format=csv`} variant="secondary">
            <Download className="size-4" aria-hidden />
            Download CSV
          </ButtonLink>
          <PrintButton />
        </div>
      </div>

      {/* Printable report body */}
      <div className="space-y-6">
        <Card className="p-5">
          <h3 className="text-xl font-semibold text-ink">{report.trip.name}</h3>
          <p className="mt-1 text-sm text-ink-soft">
            {report.trip.destination ? `${report.trip.destination} · ` : ""}
            {formatDateRange(report.trip.startDate, report.trip.endDate)} · {report.participants.length} people ·{" "}
            {report.expenseCount} expenses
          </p>
          <p className="mt-3 text-sm text-ink-soft">Total spent</p>
          <p className="text-3xl font-semibold text-ink">
            <Money minor={report.totalSpentMinor} currency={c} />
          </p>
        </Card>

        <Card className="overflow-x-auto p-5">
          <h3 className="font-medium text-ink">Per-person summary</h3>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-medium">Person</th>
                <th className="py-2 pr-3 text-right font-medium">Paid</th>
                <th className="py-2 pr-3 text-right font-medium">Share</th>
                <th className="py-2 pr-3 text-right font-medium">Net</th>
                <th className="py-2 pr-3 text-right font-medium">Settled</th>
                <th className="py-2 text-right font-medium">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {report.participants.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">
                    {p.name}
                    {!p.isActive && <span className="ml-1 text-xs font-normal text-ink-soft">(left)</span>}
                  </td>
                  <td className="py-2 pr-3 text-right"><Money minor={p.paidMinor} currency={c} /></td>
                  <td className="py-2 pr-3 text-right"><Money minor={p.allocatedMinor} currency={c} /></td>
                  <td className="py-2 pr-3 text-right"><Money minor={p.netMinor} currency={c} signed /></td>
                  <td className="py-2 pr-3 text-right">
                    <Money minor={p.settlementsPaidMinor - p.settlementsReceivedMinor} currency={c} signed />
                  </td>
                  <td className="py-2 text-right font-medium"><Money minor={p.outstandingMinor} currency={c} signed /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-ink-soft">Positive = should receive money · Negative = owes money.</p>
        </Card>

        <Card className="p-5">
          <h3 className="font-medium text-ink">Spending by category</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {report.categoryBreakdown.map((cat) => (
              <li key={cat.category} className="flex items-center justify-between">
                <span className="text-ink">
                  {cat.category} <span className="text-xs text-ink-soft">({cat.count})</span>
                </span>
                <Money minor={cat.totalMinor} currency={c} className="font-medium" />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-medium text-ink">Remaining transfers to settle</h3>
          {report.remainingTransfers.length === 0 ? (
            <p className="mt-2 text-sm text-positive">Fully settled — nothing left to pay.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {report.remainingTransfers.map((t, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-ink">
                    <span className="font-medium">{t.fromName}</span> pays <span className="font-medium">{t.toName}</span>
                  </span>
                  <Money minor={t.amountMinor} currency={c} className="font-medium" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {report.completedSettlements.length > 0 && (
          <Card className="p-5">
            <h3 className="font-medium text-ink">Completed settlements</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {report.completedSettlements.map((s, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-ink">
                    {s.fromName} paid {s.toName} <span className="text-xs text-ink-soft">({formatDate(s.paidAt)})</span>
                  </span>
                  <Money minor={s.amountMinor} currency={c} className="font-medium" />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="overflow-x-auto p-5">
          <h3 className="font-medium text-ink">All expenses</h3>
          <table className="mt-3 w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Expense</th>
                <th className="py-2 pr-3 font-medium">Paid by</th>
                <th className="py-2 pr-3 font-medium">Shared by</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.map((e) => (
                <tr key={e.id} className="border-b border-line/60 align-top last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-ink-soft">{formatDate(e.spentAt)}</td>
                  <td className="py-2 pr-3 font-medium text-ink">
                    {e.title}
                    <span className="ml-1 text-xs font-normal text-ink-soft">({e.category})</span>
                  </td>
                  <td className="py-2 pr-3 text-ink-soft">{e.payers.map((p) => p.name).join(", ")}</td>
                  <td className="py-2 pr-3 text-ink-soft">
                    {e.allocations.filter((a) => a.amountMinor > 0).map((a) => a.name).join(", ")}
                  </td>
                  <td className="py-2 text-right"><Money minor={e.amountMinor} currency={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <p className="text-xs text-ink-soft">
          Generated {formatDate(report.generatedAt)} · Balances derive from recorded expenses and confirmed settlements. All
          participant balances reconcile to zero.
        </p>
      </div>
    </div>
  );
}
