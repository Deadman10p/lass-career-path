import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM = `You are a friendly, conversational assistant helping a teacher design and refine a Likert-style career-inventory questionnaire.

You will be given the current questionnaire as JSON (sections, questions with IDs, weights per cluster) and a free-form conversation.

YOUR JOB IS TO BE A HELPFUL THINKING PARTNER. That means:
- Default to **chat naturally** — answer questions, explain pedagogy, suggest improvements, brainstorm, critique, give feedback on phrasing or balance.
- Only generate a "proposal" (a concrete edit) when the teacher clearly asks for a change to be applied (e.g. "add", "delete", "rewrite", "rename", "set the weight", "change", "make it…"). When in doubt, suggest in prose first and ask "want me to apply that?".
- When you DO propose a change, keep proposals small and focused — one user request → one proposal.
- Use markdown for clarity (lists, bold, short sections). Be warm and concise.

ALWAYS respond with a JSON object of this exact shape (parseable JSON, nothing else):
{
  "reply": "<your conversational markdown answer>",
  "proposal": null   // OR an object: { "summary": "...", "actions": [ ... ] }
}

A proposal action is one of:
- { "type": "add_question", "section_title": "...", "question_statement": "..." }
- { "type": "edit_question", "question_id": "<uuid>", "new_statement": "..." }
- { "type": "delete_question", "question_id": "<uuid>" }
- { "type": "add_section", "new_section_title": "...", "new_section_description": "..." }
- { "type": "edit_section", "section_id": "<uuid>", "new_section_title": "...", "new_section_description": "..." }
- { "type": "delete_section", "section_id": "<uuid>" }
- { "type": "set_weight", "question_id": "<uuid>", "cluster_name": "<exact cluster name>", "weight": 0..5 }

Rules for proposals:
- Use the EXACT IDs from the provided questionnaire when referencing existing items.
- For statements: keep concise (under 25 words), first-person Likert ("I enjoy ...", "I am good at ...", "I want a career where ...").
- Cluster names must match one of the provided cluster names exactly.
- Weights must be integers from 0 to 5.

If the teacher just chats / asks a question / wants explanation or analysis, set "proposal" to null and answer freely.`;

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
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { parsed = { reply: content, proposal: null }; }

    return new Response(JSON.stringify({
      reply: parsed.reply ?? "Done.",
      proposal: parsed.proposal ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
