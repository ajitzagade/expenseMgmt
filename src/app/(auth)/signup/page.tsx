import type { Metadata } from "next";
import Link from "next/link";
import { redirectIfSignedIn } from "@/lib/guards";
import { Card } from "@/components/ui";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  await redirectIfSignedIn();
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-ink-soft">Takes less than a minute.</p>
      <SignupForm />
      <p className="mt-5 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
