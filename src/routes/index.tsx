import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UPI Payment Gateway | Self-hosted Verification" },
      {
        name: "description",
        content:
          "Self-hosted UPI payment gateway with automatic notification-based verification, QR checkout and an admin console.",
      },
      { property: "og:title", content: "UPI Payment Gateway | Self-hosted Verification" },
      {
        property: "og:description",
        content:
          "Self-hosted UPI payment gateway with automatic notification-based verification, QR checkout and an admin console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">UPI Payment Gateway</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Self-hosted UPI collection with automatic payment verification from your phone&apos;s
        notifications.
      </p>
      <div className="flex gap-3">
        <a
          href="/checkout.html"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open checkout
        </a>
        <a
          href="/admin.html"
          className="rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          Admin console
        </a>
      </div>
    </main>
  );
}
