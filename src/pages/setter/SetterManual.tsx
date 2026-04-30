import { PageShell } from "@/components/AppLayout";
import { Compass, FileQuestion, Layers, Scale, Sparkles, Upload, Eye, BarChart3, MessageSquare, Trophy, ClipboardList, Users } from "lucide-react";

export default function SetterManual() {
  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl gradient-setter p-6 text-setter-foreground shadow-glow">
          <h1 className="font-display text-3xl font-semibold">LASS Career Path · Counsellor Manual</h1>
          <p className="mt-1 text-sm opacity-90">The school counsellor account (<strong>counsellor@lightacademy.ac.ug</strong>) is the only setter for this site. Use this manual end-to-end to design, score, publish, and review any inventory at Light Academy.</p>
        </div>

        <Section icon={<Sparkles className="h-5 w-5" />} title="0. About this build">
          Students self-register with their <strong>name, class and stream</strong>. Only the counsellor account can edit questionnaires and view results. Use the <strong>Results</strong> link in the header for a school-wide view (filtered by class & stream), or open <strong>Analytics</strong> on a single questionnaire for its own stats. From either view you can open a student's <strong>full individual report</strong>.
        </Section>

        <Section icon={<FileQuestion className="h-5 w-5" />} title="1. Create a questionnaire">
          From your dashboard, click <strong>New Questionnaire</strong>. The editor has 4 tabs: <em>Details, Content, Clusters, Weights</em>. Edits autosave as you type.
        </Section>

        <Section icon={<Layers className="h-5 w-5" />} title="2. Add sections & questions">
          In <strong>Content</strong>, add sections and Likert-style statements (rated 1–5). Drag the handle to reorder.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Tip:</strong> Use first-person phrasing — <em>“I enjoy…”</em>, <em>“I am good at…”</em>. Keep statements under 25 words, one idea each.
          </div>
        </Section>

        <Section icon={<Compass className="h-5 w-5" />} title="3. Categories — independent per questionnaire">
          Categories (a.k.a. clusters) are the buckets students get scored on. They can be careers, learning styles, personality traits, values — anything.
          <div className="mt-3 rounded-lg border border-setter/30 bg-setter/5 p-3 text-sm space-y-1">
            <div><strong>🔒 Each questionnaire owns its own categories.</strong> Renaming, editing or deleting a category here will <em>never</em> change another questionnaire.</div>
            <div><strong>Create custom category</strong> — make a brand-new category that exists only on this questionnaire.</div>
            <div><strong>Start from a template</strong> — picking one of the suggested templates makes a <em>private copy</em> for this questionnaire (so editing it stays local).</div>
            <div>Removing a custom category deletes it for good (and removes its weights). Removing a template-clone is the same — only this questionnaire is affected.</div>
          </div>
        </Section>

        <Section icon={<Scale className="h-5 w-5" />} title="4. The marking grid (Weights — the most important step)">
          In <strong>Weights</strong>, give each question a weight for each category. This is the <strong>marking grid</strong> that turns a 1–5 answer into category scores.
          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Scoring formula:</strong> <code>contribution = student_rating × question_weight</code><br />
            <strong>Example:</strong> Student picks <em>Strongly Agree (5)</em> on a question with weight <em>4</em> for a category → <code>5 × 4 = 20 points</code>.
            All contributions are summed per category and ranked. Top category = strongest match.
          </div>
          <div className="mt-3 rounded-lg border border-setter/30 bg-setter/5 p-3 text-sm">
            <strong>Flexible scale:</strong> Weights are a free numeric input (any non-negative integer). Use 0–3, 0–5, 0–10, or whatever the source document uses. The scale only needs to be <em>consistent within a single questionnaire</em>.
          </div>
        </Section>

        <Section icon={<Upload className="h-5 w-5" />} title="5. Bulk import (JSON / PDF / DOCX / XLSX) — adaptive categories & weights">
          Click <strong>Import</strong> in the editor toolbar to upload a file or paste JSON. The system extracts sections, questions, and (when present) the category weights at the exact scale used in the source document, then shows a preview before anything is added.

          <div className="mt-3 rounded-lg bg-accent p-3 text-sm">
            <strong>Simple JSON format:</strong>
            <pre className="mt-2 overflow-auto rounded bg-background p-2 text-[11px]">{`{
  "sections": [
    {
      "title": "Section A — Interests",
      "description": "Optional section description",
      "questions": [
        {
          "statement": "I enjoy solving puzzles.",
          "weights": {
            "Visual Learner": 3,
            "Auditory Learner": 1,
            "Kinesthetic Learner": 0
          }
        },
        {
          "statement": "I learn best by doing.",
          "weights": { "Kinesthetic Learner": 5, "Visual Learner": 1 }
        }
      ]
    }
  ]
}`}</pre>
            <ul className="mt-2 list-disc pl-5 text-xs">
              <li>Category names inside <code>weights</code> can be <strong>anything</strong> — they are matched (case-insensitive) against this questionnaire's existing categories.</li>
              <li>Integers only, any non-negative scale. The numbers are preserved exactly.</li>
              <li>Both <code>weights</code> and <code>description</code> are optional.</li>
            </ul>
          </div>

          <div className="mt-3 rounded-lg bg-primary/5 p-3 text-sm border border-primary/30">
            <strong>🆕 Enhanced JSON with cluster metadata (emoji, description, careers):</strong>
            <pre className="mt-2 overflow-auto rounded bg-background p-2 text-[11px]">{`{
  "sections": [
    {
      "title": "Career Interests",
      "questions": [
        {
          "statement": "I love working with numbers and data.",
          "weights": {
            "STEM": {
              "value": 5,
              "icon_emoji": "🔬",
              "description": "Science, Technology, Engineering & Mathematics careers",
              "possible_careers": ["Data Scientist", "Software Engineer", "Research Scientist"]
            }
          }
        },
        {
          "statement": "I enjoy helping people solve their problems.",
          "weights": {
            "Healthcare": {
              "value": 4,
              "icon_emoji": "🏥",
              "description": "Health and medical professions",
              "possible_careers": ["Doctor", "Nurse", "Therapist"]
            },
            "Education": {
              "value": 3,
              "icon_emoji": "📚",
              "description": "Teaching and educational roles",
              "possible_careers": ["Teacher", "Counselor", "Trainer"]
            }
          }
        }
      ]
    }
  ]
}`}</pre>
            <ul className="mt-2 list-disc pl-5 text-xs">
              <li>Use an <strong>object</strong> instead of a number to include emoji, description, and career suggestions.</li>
              <li><code>value</code>: the weight (required if using object format)</li>
              <li><code>icon_emoji</code>: emoji for the cluster (defaults to ✨)</li>
              <li><code>description</code>: what this cluster means (shown in results)</li>
              <li><code>possible_careers</code>: array of suggested careers/next steps</li>
              <li>New clusters will be auto-created with all this metadata when you import!</li>
            </ul>
          </div>

          <ul className="mt-3 list-disc pl-5 text-sm">
            <li><strong>XLSX:</strong> Row 1 headers <code>Section | Question | &lt;Category 1&gt; | &lt;Category 2&gt; | …</code>.</li>
            <li><strong>PDF / DOCX:</strong> AI extracts sections + questions; if a scoring grid is present the category weights are pulled too.</li>
          </ul>

          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-2">
            <div><strong>🆕 New: Replace categories on import.</strong> When the document contains category names that don't exist on this questionnaire yet, the preview shows them in red. You then have two consent toggles:</div>
            <ul className="list-disc pl-5 text-xs">
              <li><strong>Also apply detected weights</strong> — applies the weights that match existing categories.</li>
              <li><strong>⚠ Replace categories with the ones in this document</strong> — <em>deletes the current categories on this questionnaire</em> (and their weights) and creates fresh categories from <em>every</em> name found in the import. This is scoped to <strong>this questionnaire only</strong> — other questionnaires are untouched.</li>
            </ul>
            <div>Use replace when you're importing a brand-new inventory whose categories should fully take over.</div>
          </div>
        </Section>

        <Section icon={<MessageSquare className="h-5 w-5" />} title="6. AI Assistant — open chat, persistent memory, propose-then-confirm">
          Click <strong>AI Assistant</strong> for a free-form chat partner. Ask for opinions, analysis, brainstorming, or actual edits (it shows <em>Proposed changes</em> you must Apply or Reject).
          <div className="mt-3 rounded-lg border border-setter/30 bg-setter/5 p-3 text-sm space-y-1">
            <div><strong>🧠 Memory:</strong> remembered per questionnaire across sessions; older turns are auto-summarised.</div>
            <div><strong>🔄 Always fresh:</strong> the assistant gets a new snapshot after every Apply.</div>
            <div><strong>Reset memory</strong> wipes both the chat and the summary for this questionnaire.</div>
          </div>
        </Section>

        <Section icon={<Eye className="h-5 w-5" />} title="7. Publish to students">
          Toggle <strong>Published</strong>. Only published questionnaires appear on student dashboards. You can switch back to draft any time without losing responses.
        </Section>

        <Section icon={<Trophy className="h-5 w-5" />} title="8. What students see">
          Students answer one statement at a time with auto-advance and smooth section transitions. After submission they get a celebratory results page with a radar chart, ranked categories, three personalised insight cards and a <strong>Download PDF</strong> button.
        </Section>

        <Section icon={<Users className="h-5 w-5" />} title="9. Results — school-wide view">
          From the header, open <strong>Results</strong>. You'll see:
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li><strong>Filters</strong> for class, stream and questionnaire — these flow through every panel.</li>
            <li><strong>Aggregated category results</strong> — average score per category for the filtered cohort, with a horizontal bar for quick comparison. Tip: pick a single questionnaire in the filter for the cleanest view, since different questionnaires use different categories.</li>
            <li><strong>Submissions grouped by class · stream</strong> — every student in that group with their top category and score.</li>
            <li><strong>Export CSV</strong> — every student × every category column.</li>
          </ul>
        </Section>

        <Section icon={<ClipboardList className="h-5 w-5" />} title="10. Individual student reports">
          From <strong>Results</strong> or from any questionnaire's <strong>Analytics</strong>, click <em>View</em> on a row to open the student's full report:
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li>Hero card with strongest category and top score.</li>
            <li>Radar + bar charts of every category.</li>
            <li>Personalised insight cards.</li>
            <li>Ranked accordion for every category (description + suggested next steps).</li>
            <li><strong>Every answer</strong> the student picked, listed section by section with the rating colour-coded — perfect for one-on-one counselling sessions and progress tracking.</li>
          </ul>
        </Section>

        <Section icon={<BarChart3 className="h-5 w-5" />} title="11. Per-questionnaire analytics">
          Open <strong>Analytics</strong> on any questionnaire for total responses, average score per category (bar chart), most common top category, and the response table. Use <em>Export CSV</em> for a spreadsheet (one row per student, one column per category).
        </Section>

        <Section icon={<Users className="h-5 w-5" />} title="12. Production checklist & troubleshooting">
          <ul className="list-disc pl-5 text-sm space-y-1">
            <li><strong>Only one setter:</strong> sign-up is students-only. The counsellor account (<code>counsellor@lightacademy.ac.ug</code>) is the sole setter — created automatically the first time the app boots.</li>
            <li><strong>Students self-register</strong> with full name, class and stream. These are used for filtering in Results.</li>
            <li><strong>Email confirmation:</strong> for fastest classroom rollout, keep email auto-confirm <em>on</em> for students; turn off later if you want stricter verification.</li>
            <li><strong>“new row violates row-level security”</strong> when creating a questionnaire → it means your account doesn't yet have the <em>setter</em> profile row. Sign out, sign back in as the counsellor, and try again. (The app heals this on first counsellor login.)</li>
            <li><strong>Backups:</strong> use <em>Export CSV</em> from each questionnaire's Analytics page at the end of every term.</li>
            <li><strong>Resetting a questionnaire:</strong> deleting it from the dashboard removes its sections, questions, weights, categories and student responses for that questionnaire only — all other questionnaires stay intact.</li>
          </ul>
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
