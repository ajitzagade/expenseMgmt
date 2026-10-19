import type { Metadata } from "next";
import { requireUserPage } from "@/lib/guards";
import { Card } from "@/components/ui";
import { NewTripForm } from "./new-trip-form";

export const metadata: Metadata = { title: "New trip" };

export default async function NewTripPage() {
  const user = await requireUserPage();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Create a trip</h1>
      <p className="mt-1 text-sm text-ink-soft">Only the name is required — you can fill in the rest later.</p>
      <Card className="mt-6 p-6">
        <NewTripForm defaultCurrency={user.preferredCurrency} userName={user.name} />
      </Card>
    </div>
  );
}
