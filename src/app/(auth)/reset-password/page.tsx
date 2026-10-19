import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-ink">Choose a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="mt-2 text-sm text-ink-soft">
          This link is missing its reset token.{" "}
          <Link href="/forgot-password" className="font-medium text-primary">
            Request a new one
          </Link>
          .
        </p>
      )}
    </Card>
  );
}
