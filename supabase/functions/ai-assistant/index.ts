import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM = `You are a friendly, conversational assistant helping a teacher design and refine any Likert-style inventory (career, personality, learning style, values…).

You will be given the current questionnaire as JSON (metadata, clusters with full profile metadata, sections, questions with IDs, weights per cluster) and a free-form conversation.

YOUR JOB IS TO BE A HELPFUL THINKING PARTNER. That means:
- Default to **chat naturally** — answer questions, explain pedagogy, suggest improvements, brainstorm, critique.
- Only generate a "proposal" when the teacher clearly asks for a change to be applied. When in doubt, suggest in prose first and ask "want me to apply that?".
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
- { "type": "set_cluster_profile_datum", "cluster_name": "...", "label": "Strengths", "content": "..." }   // adds or replaces a single profile_data card
- { "type": "remove_cluster_profile_datum", "cluster_name": "...", "label": "Strengths" }
- { "type": "export_json", "filename"?: "my-inventory.json" }   // bundles the entire questionnaire (sections, questions, weights, clusters with all metadata, profile_schema) into a file the user can download and re-import via Bulk Import

Rules:
- Use EXACT IDs from the provided snapshot when referencing existing items.
- Statements: concise (<25 words), first-person Likert phrasing.
- Cluster names must match one of the provided cluster names exactly (or, for add_cluster, be a new name).
- Weights are integers 0..5 in this app, but interpret the user's described scale and clamp.

If the teacher just chats, set "proposal" to null.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history = [], questionnaire, memory_summary, mode } = await req.json();
    if (!message || !questionnaire) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const isSummarise = mode === "summarise";

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
          { role: "user", content: message },
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
