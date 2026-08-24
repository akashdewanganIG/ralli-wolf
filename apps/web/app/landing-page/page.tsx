import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function LandingPage() {
  return (
    <PageShell>
      <PageHeader
        title="Landing page"
        description="Create and publish web pages that collect enquiries from visitors."
        descriptionInline
      />
      <p className="text-sm text-muted-foreground">
        This is a placeholder for your landing page builder.
      </p>
    </PageShell>
  );
}
