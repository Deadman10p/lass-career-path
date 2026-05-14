import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { response_id } = await req.json();
    if (!response_id) throw new Error("response_id required");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: resp } = await sb.from("responses").select("*").eq("id", response_id).maybeSingle();
    if (!resp) throw new Error("response not found");

    const [{ data: results }, { data: answers }, { data: qcRows }, { data: q }] = await Promise.all([
      sb.from("results").select("*").eq("response_id", response_id),
      sb.from("answers").select("*").eq("response_id", response_id),
      sb.from("questionnaire_clusters").select("career_cluster_id").eq("questionnaire_id", resp.questionnaire_id),
      sb.from("questionnaires").select("*").eq("id", resp.questionnaire_id).maybeSingle(),
    ]);
    const clusterIds = (qcRows ?? []).map((r: any) => r.career_cluster_id);
    const { data: clusters } = clusterIds.length
      ? await sb.from("career_clusters").select("*").in("id", clusterIds)
      : { data: [] as any[] };

    const ranked = (results ?? [])
      .map((r: any) => ({ ...r, cluster: (clusters ?? []).find((c: any) => c.id === r.career_cluster_id) }))
      .filter((r: any) => r.cluster)
      .sort((a: any, b: any) => b.total_score - a.total_score);
    const top3 = ranked.slice(0, 3);

    // Build a per-cluster label list pulled from EITHER profile_data (new) OR profile_attributes (legacy) OR questionnaire profile_schema (fallback)
    const clusterLabels = (c: any): string[] => {
      const fromData = Array.isArray(c.profile_data) ? c.profile_data.map((p: any) => String(p?.label ?? "").trim()).filter(Boolean) : [];
      if (fromData.length) return fromData;
      const fromAttrs = c.profile_attributes && typeof c.profile_attributes === "object" ? Object.keys(c.profile_attributes) : [];
      if (fromAttrs.length) return fromAttrs;
      return Array.isArray(q?.profile_schema) && q!.profile_schema!.length ? (q!.profile_schema as string[]) : ["Strengths", "Weaknesses", "Growth Tips"];
    };

    const prompt = `You are an experienced school counsellor writing a personalised, considered profile for a student.
The inventory is "${q?.title}"${q?.description ? ` — ${q?.description}` : ""}. Treat the inventory as it presents itself
(it could be a personality, career interest, learning style, values, aptitude or any other kind of self-assessment).
Do NOT assume DISC, MBTI, or any specific framework unless the inventory clearly is one. Stay neutral and adaptive.

Write like someone who actually read the results and thought about them — not generic advice.
Voice: warm, observant, second person ("you"). Specific. Slightly literary. No bullet lists, no clichés like
"unlock your potential", no horoscope-speak, no excessive hedging. Reference the student's pattern of scores when relevant
(e.g. a clear top, a tight cluster, a low area). Aim for "medium" depth — about 2-3 sentences per label, ~55–90 words.

Top clusters and the labels you must fill for each:
${top3.map((r: any, i: number) => `#${i + 1} id=${r.cluster.id} name="${r.cluster.name}" total=${r.total_score}
  description=${JSON.stringify(r.cluster.description ?? "")}
  labels=${JSON.stringify(clusterLabels(r.cluster))}
  base_profile_data=${JSON.stringify(r.cluster.profile_data ?? [])}
  base_profile_attributes=${JSON.stringify(r.cluster.profile_attributes ?? {})}`).join("\n")}

The student gave ${(answers ?? []).length} ratings across the inventory.

Return ONLY this JSON shape:
{
  "overview": "3-4 sentence personalised opening — name the dominant pattern, what it suggests about how the student moves through the world, and a small honest tension or edge to watch. ~70–110 words.",
  "by_cluster": { "<clusterId>": { "<Label>": "personalised, observant text" } }
}
Use EXACTLY the labels provided per cluster. If a label is generic (e.g. "Strengths"), interpret it through this inventory's lens.
If a label is unusual (e.g. "Communication Style", "Greatest Fear", "Famous Examples"), respect its intent literally.
Never repeat the cluster name as filler. Never start two entries with the same word.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write personalised, observant student profiles. Return only valid JSON. Use the cluster ids provided as keys in by_cluster. Adapt tone to the inventory — never assume a specific framework." },
          { role: "user", content: prompt + "\n\nCluster IDs (use exactly these as keys): " + top3.map((r: any) => r.cluster.id).join(", ") },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const aiData = await aiRes.json();
    let summary: any = {};
    try { summary = JSON.parse(aiData.choices?.[0]?.message?.content ?? "{}"); } catch { summary = {}; }

    await sb.from("response_insights").upsert({
      response_id,
      student_id: resp.student_id,
      questionnaire_id: resp.questionnaire_id,
      summary,
    }, { onConflict: "response_id" });

    // --- Aggregate into general_profiles ---
    const { data: allResp } = await sb.from("responses").select("*").eq("student_id", resp.student_id);
    const respIds = (allResp ?? []).map((r: any) => r.id);
    const { data: allInsights } = respIds.length
      ? await sb.from("response_insights").select("*").in("response_id", respIds)
      : { data: [] as any[] };
    const { data: qTitles } = await sb.from("questionnaires").select("id, title");
    const titleMap = new Map((qTitles ?? []).map((x: any) => [x.id, x.title]));

    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const growth: string[] = [];
    const inventories: any[] = [];
    /** Dynamic aggregation: { [label]: string[] } across every label the AI ever produced for this student. */
    const dynamic: Record<string, string[]> = {};

    for (const r of allResp ?? []) {
      const ins = (allInsights ?? []).find((x: any) => x.response_id === r.id);
      const { data: rs } = await sb.from("results").select("*").eq("response_id", r.id);
      const top = (rs ?? []).sort((a: any, b: any) => b.total_score - a.total_score)[0];
      const topClusterId = top?.career_cluster_id;
      const { data: tc } = topClusterId
        ? await sb.from("career_clusters").select("name").eq("id", topClusterId).maybeSingle()
        : { data: null };
      inventories.push({
        questionnaire_id: r.questionnaire_id,
        title: titleMap.get(r.questionnaire_id) ?? "Inventory",
        top_cluster: tc?.name ?? "—",
        submitted_at: r.submitted_at,
      });
      const byCluster = ins?.summary?.by_cluster ?? {};
      for (const cid of Object.keys(byCluster)) {
        const a = byCluster[cid] || {};
        for (const [label, val] of Object.entries(a)) {
          const text = String(val ?? "").trim();
          if (!text) continue;
          (dynamic[label] ||= []).push(text);
          // Back-compat buckets
          if (label === "Strengths") strengths.push(text);
          else if (label === "Weaknesses") weaknesses.push(text);
          else if (label === "Growth Tips") growth.push(text);
        }
      }
    }

    // Cross-inventory alignment via AI
    let alignments: string[] = [];
    if (inventories.length >= 2) {
      const alignRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return JSON: { alignments: string[] }. 2-4 short bullets identifying strong cross-inventory alignments or contradictions." },
            { role: "user", content: `Student top results across inventories:\n${inventories.map(i => `- ${i.title}: top=${i.top_cluster}`).join("\n")}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      try {
        const ad = await alignRes.json();
        alignments = JSON.parse(ad.choices?.[0]?.message?.content ?? "{}").alignments ?? [];
      } catch { /* ignore */ }
    }

    await sb.from("general_profiles").upsert({
      student_id: resp.student_id,
      inventories_count: inventories.length,
      summary: { strengths, weaknesses, growth, alignments, inventories, dynamic },
    }, { onConflict: "student_id" });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
