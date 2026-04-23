import { PageShell } from "@/components/AppLayout";
import { Compass, FileQuestion, Layers, Scale, Sparkles, Upload, Eye, BarChart3, MessageSquare, Trophy } from "lucide-react";

export default function SetterManual() {
  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl gradient-setter p-6 text-setter-foreground shadow-glow">
          <h1 className="font-display text-3xl font-semibold">LASS Career Path · Counsellor Manual</h1>
          <p className="mt-1 text-sm opacity-90">The school counsellor account (<strong>counsellor@lightacademy.ac.ug</strong>) is the only setter for this site. Use this manual to design, score, publish and review the Light Academy career inventory.</p>
        </div>

        <Section icon={<Sparkles className="h-5 w-5" />} title="0. About this build">
          Students self-register with their <strong>name, class and stream</strong>. Only the counsellor account can edit questionnaires and view results. Use the <strong>Results</strong> link in the header to see all submissions, filtered by class and stream.
        </Section>

        <Section icon={<FileQuestion className="h-5 w-5" />} title="1. Create a questionnaire">
          From your dashboard, click <strong>New Questionnaire</strong>. You'll land in the editor with 4 tabs: <em>Details, Content, Clusters, Weights</em>. Edits autosave as you type. There's also a pre-built sample called <strong>“Light Academy Career Inventory”</strong> you can study or duplicate.
        </Section>

        <Section icon={<Layers className="h-5 w-5" />} title="2. Add sections & questions">
          In <strong>Content</strong>, add sections (e.g. <em>Section A — Interests</em>, <em>Section B — Strengths</em>, <em>Section C — Values</em>). Inside each section, add Likert-style statements students will rate from 1 (Strongly Disagree) to 5 (Strongly Agree). Drag the handle to reorder anything.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Statement style tip:</strong> Write in the first person — <em>“I enjoy…”</em>, <em>“I am good at…”</em>, <em>“I want a career where…”</em>. Keep statements under 25 words and focused on one idea each.
          </div>
        </Section>

        <Section icon={<Compass className="h-5 w-5" />} title="3. Manage clusters (categories)">
          Six career clusters are pre-loaded (Science & Engineering, Helping & People, Practical & Hands-on, Creative & Expressive, Leadership & Communication, Technology & Innovation), but <strong>clusters don't have to be careers</strong>. They are simply the categories a questionnaire scores on — you can repurpose them for learning styles (Visual / Auditory / Kinesthetic), personality traits, values, study habits, or anything else. Edit names, emojis, descriptions, and the list of "possible careers" (or rename that field's contents to suggested study tips, recommended subjects, etc.).
        </Section>

        <Section icon={<Scale className="h-5 w-5" />} title="4. The marking grid (Weights — the most important step)">
          In <strong>Weights</strong>, give each question a weight for each cluster. This is the <strong>marking grid</strong> that turns a student's 1–5 answer into cluster scores.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Scoring formula:</strong> <code>contribution = student_rating × question_weight</code><br />
            <strong>Example:</strong> Student picks <em>Strongly Agree (5)</em> on a question with weight <em>4</em> for a cluster → <code>5 × 4 = 20 points</code> added to that cluster.
            <br /><br />
            We then <strong>sum every contribution</strong> per cluster and rank them. The cluster with the highest total is the student's strongest match.
          </div>
          <div className="mt-3 rounded-lg border border-setter/30 bg-setter/5 p-3 text-sm">
            <strong>Flexible scale:</strong> Weights are now a free numeric input (any non-negative integer). Use whatever scale suits your inventory:
            <ul className="mt-1 list-disc pl-5">
              <li><strong>0–3</strong> — quick coarse mapping.</li>
              <li><strong>0–5</strong> — the classic default; works well for most career inventories.</li>
              <li><strong>0–10 or higher</strong> — when you want fine-grained influence or to mirror an existing scoring sheet exactly.</li>
            </ul>
            The scale you choose only needs to be <em>consistent within a single questionnaire</em>; cluster percentages are calculated relative to the maximum possible for that questionnaire, so big numbers won't break the ranking.
          </div>
          <ul className="mt-3 list-disc pl-5 text-sm">
            <li><strong>0</strong> — this question doesn't relate to that cluster.</li>
            <li><strong>Low values</strong> — weak / secondary signal.</li>
            <li><strong>Mid values</strong> — moderate signal.</li>
            <li><strong>High values</strong> — strong / primary indicator for that cluster.</li>
          </ul>
        </Section>

        <Section icon={<Upload className="h-5 w-5" />} title="5. Bulk import (JSON / PDF / DOCX / XLSX) — adaptive clusters & weights">
          Click <strong>Import</strong> in the editor toolbar to upload a file or paste JSON. The system extracts sections, questions <strong>and (when present) the category weights at the exact scale used in the source document</strong>, and shows you a preview before anything is added.
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li><strong>JSON:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": [{ "statement": "I enjoy…", "weights": { "Visual": 3, "Auditory": 1 } }] }] }`}</code> — the <code>weights</code> field is optional, and category names can be anything (career clusters, learning styles, personality traits…).</li>
            <li><strong>XLSX:</strong> Row 1 headers <code>Section | Question | &lt;Category 1&gt; | &lt;Category 2&gt; | …</code>. Each category column holds a non-negative integer weight at whatever scale your sheet uses.</li>
            <li><strong>PDF / DOCX:</strong> AI extracts sections and questions; if the document contains a scoring grid the category weights are pulled too, preserved exactly as written (no re-scaling, no clamping to 0–5).</li>
          </ul>
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm space-y-1">
            <div><strong>How consent works:</strong> Questions are imported automatically, but <strong>weights are only applied if you tick the “Also apply detected weights” box on the preview screen.</strong> This lets you eyeball a scoring grid before it overwrites anything.</div>
            <div><strong>Cluster matching:</strong> Weight column / key names are matched (case-insensitive) against your existing clusters. Unmatched names are highlighted in red on the preview and silently skipped — fix them by adding/renaming clusters in the <em>Clusters</em> tab and re-importing.</div>
            <div><strong>Weights only?</strong> If you only want to update weights for existing questions, use the AI Assistant (<em>“Set the weight for question 3 on Visual to 7”</em>) — bulk import always appends new sections.</div>
          </div>
        </Section>

        <Section icon={<MessageSquare className="h-5 w-5" />} title="6. AI Assistant — open chat, persistent memory, propose-then-confirm">
          Click <strong>AI Assistant</strong> in the editor to open a free-form chat. It can read your full questionnaire (sections, questions, weights) and you can talk to it like a colleague:
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Ask for opinions: <em>“Is this balanced across all 6 clusters?”</em></li>
            <li>Ask for analysis: <em>“Which questions are too vague?”</em>, <em>“Why does Section C lean toward Helping?”</em></li>
            <li>Brainstorm: <em>“Suggest 3 questions about resilience for Year 10 students.”</em></li>
            <li>Make changes: <em>“Add 3 teamwork questions to Section B,”</em> <em>“Set question 4's weight for Technology to 5,”</em> <em>“Rewrite question 7 to be more specific.”</em></li>
          </ul>
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            Whenever the assistant proposes an actual edit, you'll see a <strong>“Proposed changes”</strong> card. Click <strong>Apply</strong> to commit, or <strong>Reject</strong> to discard. Pure chat or analysis won't trigger a proposal.
          </div>
          <div className="mt-3 rounded-lg border border-setter/30 bg-setter/5 p-3 text-sm space-y-1">
            <div><strong>🧠 Memory:</strong> The assistant now remembers your conversation <em>per questionnaire</em> across sessions (stored locally in your browser). Older turns are automatically <strong>summarised</strong> into a short memory note so the chat never grows stale.</div>
            <div><strong>🔄 Always fresh:</strong> Every time you click <em>Apply</em>, the editor reloads and the assistant immediately gets the new snapshot — including new IDs, statements and weights — so its next suggestion never references stale data.</div>
            <div><strong>Reset:</strong> Use the <em>Reset memory</em> button in the panel header to wipe the conversation and the summary for this questionnaire.</div>
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
