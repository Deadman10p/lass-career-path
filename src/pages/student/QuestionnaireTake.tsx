import { PageShell } from "@/components/AppLayout";
import { useParams } from "react-router-dom";

export default function QuestionnaireTake() {
  const { id } = useParams();
  return (
    <PageShell tone="student" title="Student Portal">
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        <h1 className="font-display text-2xl font-semibold">Questionnaire flow</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The full one-question-at-a-time take experience is coming next. Questionnaire ID: <code>{id}</code>
        </p>
      </div>
    </PageShell>
  );
}
