import { PageShell } from "@/components/AppLayout";
import { Compass, FileQuestion, Layers, Scale, Sparkles, Upload, Eye, BarChart3, MessageSquare, Trophy } from "lucide-react";

export default function SetterManual() {
  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl gradient-setter p-6 text-setter-foreground shadow-glow">
          <h1 className="font-display text-3xl font-semibold">Setter Manual</h1>
          <p className="mt-1 text-sm opacity-90">Everything you need to design, score, publish and analyse a career inventory for your students.</p>
        </div>

        <Section icon={<FileQuestion className="h-5 w-5" />} title="1. Create a questionnaire">
          From your dashboard, click <strong>New Questionnaire</strong>. You'll land in the editor with 4 tabs: <em>Details, Content, Clusters, Weights</em>. Edits autosave as you type. There's also a pre-built sample called <strong>“Light Academy Career Inventory”</strong> you can study or duplicate.
        </Section>

        <Section icon={<Layers className="h-5 w-5" />} title="2. Add sections & questions">
          In <strong>Content</strong>, add sections (e.g. <em>Section A — Interests</em>, <em>Section B — Strengths</em>, <em>Section C — Values</em>). Inside each section, add Likert-style statements students will rate from 1 (Strongly Disagree) to 5 (Strongly Agree). Drag the handle to reorder anything.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Statement style tip:</strong> Write in the first person — <em>“I enjoy…”</em>, <em>“I am good at…”</em>, <em>“I want a career where…”</em>. Keep statements under 25 words and focused on one idea each.
          </div>
        </Section>

        <Section icon={<Compass className="h-5 w-5" />} title="3. Manage career clusters">
          Six clusters are pre-loaded: Science & Engineering, Helping & People, Practical & Hands-on, Creative & Expressive, Leadership & Communication, Technology & Innovation. Edit names, emojis, descriptions, and the list of possible careers. You can add or remove clusters as needed.
        </Section>

        <Section icon={<Scale className="h-5 w-5" />} title="4. The marking grid (Weights — the most important step)">
          In <strong>Weights</strong>, give each question a weight (0–5) for each cluster. This is the <strong>marking grid</strong> that turns a student's 1–5 answer into cluster scores.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Scoring formula:</strong> <code>contribution = student_rating × question_weight</code><br />
            <strong>Example:</strong> Student picks <em>Strongly Agree (5)</em> on a question with weight <em>4</em> for "Technology & Innovation" → <code>5 × 4 = 20 points</code> added to that cluster.
            <br /><br />
            We then <strong>sum every contribution</strong> per cluster and rank them. The cluster with the highest total is the student's strongest match.
          </div>
          <ul className="mt-3 list-disc pl-5 text-sm">
            <li><strong>0</strong> — this question doesn't relate to that cluster.</li>
            <li><strong>1–2</strong> — weak / secondary signal.</li>
            <li><strong>3</strong> — moderate signal.</li>
            <li><strong>4–5</strong> — strong / primary indicator for that cluster.</li>
          </ul>
          <div className="mt-3 text-sm">
            Most questions should clearly point at <em>one</em> cluster (weight 4–5) and lightly at one or two others (weight 1–2). A few "values" or "strengths" questions may spread across several clusters.
          </div>
        </Section>

        <Section icon={<Upload className="h-5 w-5" />} title="5. Bulk import (JSON / PDF / DOCX / XLSX)">
          Click <strong>Import</strong> in the editor toolbar to upload a file or paste JSON. The system extracts sections and questions and shows you a preview before anything is added.
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li><strong>JSON:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": ["…"] }] }`}</code></li>
            <li><strong>XLSX:</strong> Column A = section title (repeat per row), Column B = question statement.</li>
            <li><strong>PDF / DOCX:</strong> Sent to AI for extraction — sections and questions are auto-grouped from headings.</li>
          </ul>
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            After import, head to the <strong>Weights</strong> tab to assign cluster weights for the new questions — they default to 0 (no contribution) until you set them.
          </div>
        </Section>

        <Section icon={<MessageSquare className="h-5 w-5" />} title="6. AI Assistant — open chat with propose-then-confirm">
          Click <strong>AI Assistant</strong> in the editor to open a free-form chat. It can read your full questionnaire (sections, questions, weights) and you can talk to it like a colleague:
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Ask for opinions: <em>“Is this balanced across all 6 clusters?”</em></li>
            <li>Ask for analysis: <em>“Which questions are too vague?”</em>, <em>“Why does Section C lean toward Helping?”</em></li>
            <li>Brainstorm: <em>“Suggest 3 questions about resilience for Year 10 students.”</em></li>
            <li>Make changes: <em>“Add 3 teamwork questions to Section B,”</em> <em>“Set question 4's weight for Technology to 5,”</em> <em>“Rewrite question 7 to be more specific.”</em></li>
          </ul>
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            Whenever the assistant proposes an actual edit, you'll see a <strong>“Proposed changes”</strong> card with a list of what will happen. Click <strong>Apply</strong> to commit, or <strong>Reject</strong> to discard. Pure chat or analysis won't trigger a proposal.
          </div>
        </Section>

        <Section icon={<Eye className="h-5 w-5" />} title="7. Publish to students">
          When ready, toggle <strong>Published</strong>. Only published questionnaires appear on student dashboards. You can switch back to draft any time without losing responses.
        </Section>

        <Section icon={<Trophy className="h-5 w-5" />} title="8. What students see">
          Students go through a <strong>one-question-at-a-time</strong> flow with auto-advance, smooth transitions between sections and a progress bar. After submission they get a celebratory results page with a radar chart, ranked clusters, three personalised insight cards and a <strong>Download PDF</strong> button.
        </Section>

        <Section icon={<BarChart3 className="h-5 w-5" />} title="9. View analytics">
          From the dashboard, open <strong>Analytics</strong> on any questionnaire to see total responses, average scores per cluster (bar chart), the most common top cluster, and an individual response table with name, class, date, and top cluster. Click <strong>Export CSV</strong> for a full spreadsheet (one row per student, one column per cluster).
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
