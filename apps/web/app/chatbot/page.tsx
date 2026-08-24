import { PageHeader } from "@repo/ui/components/ui/page-header";
import { PageShell } from "@repo/ui/components/ui/page-shell";

export default function ChatbotPage() {
  return (
    <PageShell>
      <PageHeader
        title="Chatbot"
        description="Set up the automatic assistant that replies to visitors on your website."
        descriptionInline
      />
      <p className="text-sm text-muted-foreground">
        This is a placeholder for your chatbot configuration.
      </p>
    </PageShell>
  );
}
