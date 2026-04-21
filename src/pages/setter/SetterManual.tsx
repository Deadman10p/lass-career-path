import { PageShell } from "@/components/AppLayout";
import { Compass, FileQuestion, Layers, Scale, Sparkles, Upload, Eye, BarChart3 } from "lucide-react";

export default function SetterManual() {
  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl gradient-setter p-6 text-setter-foreground shadow-glow">
          <h1 className="font-display text-3xl font-semibold">Setter Manual</h1>
          <p className="mt-1 text-sm opacity-90">Everything you need to design a great career inventory for your students.</p>
        </div>

        <Section icon={<FileQuestion className="h-5 w-5" />} title="1. Create a questionnaire">
          From the dashboard, click <strong>New Questionnaire</strong>. You'll land in the editor with 4 steps: <em>Details, Content, Clusters, Weights</em>. Edits autosave as you type.
        </Section>

        <Section icon={<Layers className="h-5 w-5" />} title="2. Add sections & questions">
          In <strong>Content</strong>, add sections (e.g. <em>Interests, Strengths, Values</em>). Inside each section, add Likert-style statements students will rate from 1 (Strongly Disagree) to 5 (Strongly Agree). Drag the handle to reorder anything.
        </Section>

        <Section icon={<Compass className="h-5 w-5" />} title="3. Manage career clusters">
          Six clusters are pre-loaded (Science & Engineering, Helping & People, Practical & Hands-on, Creative & Expressive, Leadership & Communication, Technology & Innovation). Edit names, emojis, descriptions, and the list of possible careers. You can add or remove clusters as needed.
        </Section>

        <Section icon={<Scale className="h-5 w-5" />} title="4. Set the scoring weights (the most important step!)">
          In <strong>Weights</strong>, give each question a weight (0–5) for each cluster.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Formula:</strong> <code>contribution = student_rating × question_weight</code><br />
            <strong>Example:</strong> A student answers <em>Strongly Agree (5)</em> to a question with weight <em>4</em> for "Technology & Innovation" → <code>5 × 4 = 20 points</code> added to that cluster.
          </div>
          A weight of 0 means "this question doesn't relate to that cluster". A weight of 5 means "this question is a strong indicator for that cluster".
        </Section>

        <Section icon={<Upload className="h-5 w-5" />} title="5. Bulk import (JSON / PDF / DOCX / XLSX)">
          Click <strong>Import</strong> in the editor toolbar to upload a file or paste JSON. The system extracts sections and questions and shows you a preview before anything is added.
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li><strong>JSON:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": ["…"] }] }`}</code></li>
            <li><strong>XLSX:</strong> Column A = section title (repeat per row), Column B = question statement.</li>
            <li><strong>PDF / DOCX:</strong> Text is extracted and grouped by headings into sections.</li>
          </ul>
        </Section>

        <Section icon={<Sparkles className="h-5 w-5" />} title="6. AI Assistant — propose then confirm">
          Click <strong>AI Assistant</strong> in the editor to chat with an AI that can read your questionnaire. Ask things like:
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>"Add 3 questions about teamwork to Section B."</li>
            <li>"Make question 4 stronger toward Technology & Innovation."</li>
            <li>"Rewrite Section A to focus on creative interests."</li>
          </ul>
          The assistant always shows the proposed changes first. Nothing is applied until you click <strong>Apply</strong>.
        </Section>

        <Section icon={<Eye className="h-5 w-5" />} title="7. Publish to students">
          When ready, toggle <strong>Published</strong>. Only published questionnaires appear on student dashboards. You can switch back to draft any time.
        </Section>

        <Section icon={<BarChart3 className="h-5 w-5" />} title="8. View analytics">
          From the dashboard, open <strong>Analytics</strong> on any questionnaire to see total responses, average cluster scores, an individual response table, and export everything to CSV.
        </Section>
      </div>
    </PageShell>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-setter text-setter-foreground">{icon}</div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-foreground/80">{children}</div>
    </div>
  );
}
