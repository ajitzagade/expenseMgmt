import type { Metadata } from "next";
import { requireUserPage } from "@/lib/guards";
import { Avatar, Card } from "@/components/ui";
import { ChangePasswordForm, ProfileForm } from "./profile-client";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUserPage();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.name} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{user.name}</h1>
          <p className="text-sm text-ink-soft">{user.email}</p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-ink">Profile</h2>
        <Card className="mt-3 p-5">
          <ProfileForm initial={{ name: user.name, preferredCurrency: user.preferredCurrency }} />
        </Card>
        <p className="mt-2 text-xs text-ink-soft">
          Changing your name updates how you appear in trips. Your preferred currency is the default for new trips.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Password</h2>
        <Card className="mt-3 p-5">
          <ChangePasswordForm />
        </Card>
        <p className="mt-2 text-xs text-ink-soft">Changing your password signs you out of all other devices.</p>
      </section>
    </div>
  );
}
