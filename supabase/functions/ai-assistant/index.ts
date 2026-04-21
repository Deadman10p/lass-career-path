import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM = `You are an expert assistant helping a teacher edit a Likert-style career-inventory questionnaire.

You will receive the current questionnaire as JSON (sections, questions with IDs, weights per cluster).
The user will ask you to refine it (add/edit/delete questions or sections, adjust scoring weights, rewrite content).

ALWAYS respond with a JSON object of this exact shape:
{
  "reply": "<short markdown explanation for the user>",
  "proposal": null  // OR an object: { "summary": "...", "actions": [ ... ] }
}

When the user requests edits, include a non-null "proposal" with concrete actions. Each action is one of:
- { "type": "add_question", "section_title": "...", "question_statement": "..." }
- { "type": "edit_question", "question_id": "<uuid>", "new_statement": "..." }
- { "type": "delete_question", "question_id": "<uuid>" }
- { "type": "add_section", "new_section_title": "...", "new_section_description": "..." }
- { "type": "edit_section", "section_id": "<uuid>", "new_section_title": "...", "new_section_description": "..." }
- { "type": "delete_section", "section_id": "<uuid>" }
- { "type": "set_weight", "question_id": "<uuid>", "cluster_name": "<exact cluster name>", "weight": 0..5 }

When the user is just chatting / asking questions, set "proposal" to null.
Use the EXACT IDs from the provided questionnaire when referencing existing items.
Keep statements concise (under 25 words), first-person Likert form (e.g. "I enjoy ...").`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { message, history = [], questionnaire } = await req.json();
    if (!message || !questionnaire) {
      return new Response(JSON.stringify({ error: "missing fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const messages = [
      { role: "system", content: SYSTEM },
      { role: "system", content: "Current questionnaire:\n" + JSON.stringify(questionnaire) },
      ...history.slice(-10),
      { role: "user", content: message },
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
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
