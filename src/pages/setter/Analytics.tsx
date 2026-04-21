import { PageShell } from "@/components/AppLayout";
import { useParams } from "react-router-dom";

export default function Analytics() {
  const { id } = useParams();
  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <h1 className="font-display text-2xl font-semibold">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">Charts, response table and CSV export coming next. Questionnaire: {id}</p>
      </div>
    </PageShell>
  );
}
