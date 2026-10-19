import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-ink">Reset your password</h1>
      <p className="mt-1 text-sm text-ink-soft">We&apos;ll send a reset link to your email if an account exists.</p>
      <ForgotPasswordForm />
      <p className="mt-5 text-center text-sm">
        <Link href="/login" className="text-ink-soft hover:text-ink">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
