import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM = `You are a friendly, conversational assistant helping a teacher design and refine any Likert-style inventory (career, personality, learning style, values…).

You will be given the current questionnaire as JSON (metadata, clusters with full profile metadata, sections, questions with IDs, weights per cluster) and a free-form conversation.

YOUR JOB IS TO BE A HELPFUL THINKING PARTNER. That means:
- Default to **chat naturally** — answer questions, explain pedagogy, suggest improvements, brainstorm, critique.
- Only generate a "proposal" when the teacher clearly asks for a change to be applied. When in doubt, suggest in prose first and ask "want me to apply that?".
- If the teacher says make/update/change/adjust/set the report look, report UI, colours, styling, output wording, or synthesis style, that IS a clear request: return an apply-ready proposal immediately.
- You can edit ANY part of the questionnaire: title/description, sections, questions, weights, clusters (name, emoji, description, careers, color, profile_data cards, profile_attributes), publish state, profile_schema — and you can also EXPORT the whole questionnaire as an import-compatible JSON file the teacher can download and re-import.
- Keep proposals focused, but you may batch related actions in one proposal.
- Use markdown for clarity. Be warm and concise.

ALWAYS respond with a JSON object of this exact shape (parseable JSON, nothing else):
{
  "reply": "<conversational markdown>",
  "proposal": null   // OR { "summary": "...", "actions": [ ... ] }
}

A proposal action is one of:
- { "type": "set_meta", "title"?: "...", "description"?: "...", "is_published"?: true|false, "profile_schema"?: ["..."] }
- { "type": "add_section", "new_section_title": "...", "new_section_description"?: "..." }
- { "type": "edit_section", "section_id": "<uuid>", "new_section_title"?: "...", "new_section_description"?: "..." }
- { "type": "delete_section", "section_id": "<uuid>" }
- { "type": "add_question", "section_title"?: "...", "section_id"?: "<uuid>", "question_statement": "...", "weights"?: { "<cluster name>": 0..5 } }
- { "type": "edit_question", "question_id": "<uuid>", "new_statement": "..." }
- { "type": "delete_question", "question_id": "<uuid>" }
- { "type": "set_weight", "question_id": "<uuid>", "cluster_name": "<exact cluster name>", "weight": 0..5 }
- { "type": "add_cluster", "name": "...", "icon_emoji"?: "🔬", "description"?: "...", "possible_careers"?: ["..."], "color_hex"?: "#4F46E5", "profile_data"?: [{ "label": "Strengths", "content": "..." }], "profile_attributes"?: { "key": "value" } }
- { "type": "edit_cluster", "cluster_id"?: "<uuid>", "cluster_name"?: "<existing name>", "new_name"?: "...", "icon_emoji"?: "...", "description"?: "...", "possible_careers"?: ["..."], "color_hex"?: "...", "profile_attributes"?: { ... } }
- { "type": "delete_cluster", "cluster_id"?: "<uuid>", "cluster_name"?: "..." }
- { "type": "set_cluster_profile_datum", "cluster_name": "...", "label": "Strengths", "content": "..." }
- { "type": "remove_cluster_profile_datum", "cluster_name": "...", "label": "Strengths" }
- { "type": "export_json", "filename"?: "my-inventory.json" }
- { "type": "set_report_style", "report_style": { "accent"?: "#4F46E5", "heroBg"?: "linear-gradient(135deg,#0f172a,#1e293b)", "heroTextColor"?: "#ffffff", "fontDisplay"?: "'Playfair Display', serif", "fontBody"?: "'DM Sans', sans-serif", "cardRadius"?: "1.5rem", "heroRadius"?: "28px", "tone"?: "warm|cool|editorial|minimal|vivid", "customCss"?: ".lass-report-skin .lass-bar-fill { ... }" } }
   // ↑ Updates the look of BOTH the student Results page AND the counsellor's Individual Report. customCss is scoped to .lass-report-skin so it only affects the report surfaces.
   // SAFETY: never output full-page CSS such as body/html/:root, never style bare h1/p/div/section/span, never hide/reposition [data-pdf-section], never use opacity/filter/transform for report sections, and keep customCss small. For dominant-cluster color adaptation, use var(--lass-cluster-dominant-color) in accent/heroBg; the app resolves it safely for screen and PDF.
   // When the user attaches an HTML mockup or screenshot, derive concrete values from it and propose them here.
- { "type": "set_synthesis_style", "synthesis_style": "Plain-English guidance on tone, vocabulary, length, methodology, what to emphasise or avoid when the AI writes the student's profile. Free text, up to ~600 words." }
   // ↑ Updates how the synthesis AI writes the final profile output (wording, methodology, voice, framing).

Rules:
- Use EXACT IDs from the provided snapshot when referencing existing items.
- Statements: concise (<25 words), first-person Likert phrasing.
- Cluster names must match one of the provided cluster names exactly (or, for add_cluster, be a new name).
- Weights are integers 0..5 in this app, but interpret the user's described scale and clamp.
- When the user attaches HTML, an image, or a PDF: read it carefully. If it shows a desired report look, propose set_report_style. If it describes wording/voice for the output, propose set_synthesis_style. If it contains questionnaire content, propose add_question/add_section/add_cluster actions.

If the teacher just chats, set "proposal" to null.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- AuthN + AuthZ: only setters may use the assistant ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: prof } = await sb.from("profiles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (prof?.role !== "setter") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { message, history = [], questionnaire, memory_summary, mode, attachments = [] } = await req.json();
    if (!message || !questionnaire) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const isSummarise = mode === "summarise";

    // Build multimodal user content if attachments are present.
    // attachments: [{ name, mime, kind: "image"|"pdf"|"html"|"text", dataUrl?: string, text?: string }]
    const userParts: any[] = [{ type: "text", text: message }];
    for (const a of (attachments || []).slice(0, 6)) {
      try {
        if ((a.kind === "image" || a.kind === "pdf") && a.dataUrl) {
          userParts.push({ type: "image_url", image_url: { url: a.dataUrl } });
          userParts.push({ type: "text", text: `↑ attached ${a.kind.toUpperCase()} file: ${a.name || "(file)"}` });
        } else if ((a.kind === "html" || a.kind === "text") && typeof a.text === "string") {
          const snippet = a.text.length > 60000 ? a.text.slice(0, 60000) + "\n…(truncated)" : a.text;
          userParts.push({ type: "text", text: `Attached ${a.kind.toUpperCase()} file "${a.name || "(file)"}":\n\n\`\`\`${a.kind}\n${snippet}\n\`\`\`` });
        }
      } catch { /* ignore one bad attachment */ }
    }

    const messages: any[] = isSummarise
      ? [
          { role: "system", content: "You are a memory compressor. Reply with plain text only (no JSON, no markdown headings)." },
          { role: "user", content: message },
        ]
      : [
          { role: "system", content: SYSTEM },
          { role: "system", content: "Current questionnaire (use these EXACT IDs when proposing edits — this snapshot is always the latest after any prior applied changes):\n" + JSON.stringify(questionnaire) },
          ...(memory_summary ? [{ role: "system", content: `Long-term memory of this conversation so far:\n${memory_summary}` }] : []),
          ...history.slice(-12),
          { role: "user", content: userParts.length === 1 ? message : userParts },
        ];

    const body: any = {
      model: "google/gemini-2.5-flash",
      messages,
    };
    if (!isSummarise) body.response_format = { type: "json_object" };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify(body),
    });

    if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (r.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: "AI gateway error", detail: t }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    if (isSummarise) {
      return new Response(JSON.stringify({ reply: String(content).trim(), proposal: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let parsed: any = {};
    try { parsed = JSON.parse(content || "{}"); } catch { parsed = { reply: content, proposal: null }; }

    return new Response(JSON.stringify({
      reply: parsed.reply ?? "Done.",
      proposal: parsed.proposal ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
