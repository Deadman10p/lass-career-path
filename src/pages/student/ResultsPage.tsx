import { PageShell } from "@/components/AppLayout";
import { useParams } from "react-router-dom";

export default function ResultsPage() {
  const { responseId } = useParams();
  return (
    <PageShell tone="student" title="Student Portal">
      <div className="rounded-2xl gradient-celebration p-8 text-center shadow-card">
        <h1 className="font-display text-3xl font-semibold">Your results</h1>
        <p className="mt-2 text-sm text-muted-foreground">Response: {responseId}</p>
        <p className="mt-4 text-sm text-muted-foreground">Full radar chart, ranked clusters, insights and PDF export are coming next.</p>
      </div>
    </PageShell>
  );
}
