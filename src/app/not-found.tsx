import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-sm text-sm text-ink-soft">
        This page doesn&apos;t exist, or you don&apos;t have access to it. Trips are private to their participants.
      </p>
      <ButtonLink href="/trips">Back to your trips</ButtonLink>
    </main>
  );
}
