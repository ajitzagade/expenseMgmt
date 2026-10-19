import type { Metadata } from "next";
import { requireUserPage } from "@/lib/guards";
import { ButtonLink, Card } from "@/components/ui";

export const metadata: Metadata = { title: "Welcome" };

const steps = [
  {
    title: "Create a trip",
    body: "Name it, pick the currency, and add your travel mates by name — they don't need accounts yet.",
  },
  {
    title: "Add expenses as you go",
    body: "Enter the amount, who paid, and who shared it. Equal, exact, percentage, or share-based splits — every expense can be different.",
  },
  {
    title: "Settle up at the end",
    body: "TripSplit tracks everyone's balance live and suggests the fewest transfers to square things off.",
  },
];

export default async function WelcomePage() {
  const user = await requireUserPage();
  return (
    <div className="mx-auto max-w-lg py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Hi {user.name.split(" ")[0]}, here&apos;s how it works</h1>
      <div className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <Card key={step.title} className="flex gap-4 p-5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <div>
              <h2 className="font-medium text-ink">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/trips/new" size="lg">
          Create your first trip
        </ButtonLink>
        <ButtonLink href="/trips" size="lg" variant="secondary">
          Skip for now
        </ButtonLink>
      </div>
      <p className="mt-4 text-sm text-ink-soft">Joining someone else&apos;s trip? Open the invite link they shared with you.</p>
    </div>
  );
}
