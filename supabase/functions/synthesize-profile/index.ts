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

    const prompt = `You are a school career counsellor synthesising a personalised report.
Questionnaire: "${q?.title}" — ${q?.description ?? ""}
Schema attributes to fill per cluster: ${JSON.stringify(q?.profile_schema ?? ["Strengths", "Weaknesses", "Growth Tips"])}

Top clusters and totals:
${top3.map((r: any) => `- ${r.cluster.name} (${r.total_score} pts): base attrs=${JSON.stringify(r.cluster.profile_attributes ?? {})}`).join("\n")}

The student gave ${(answers ?? []).length} ratings. Write JSON of shape:
{ "overview": "2-3 sentence personalised summary", "by_cluster": { "<clusterId>": { "<AttributeKey>": "personalised text" } } }
Keep each attribute under 240 chars, warm and specific.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Return only valid JSON. Use the cluster ids provided as keys in by_cluster." },
          { role: "user", content: prompt + "\n\nCluster IDs: " + top3.map((r: any) => r.cluster.id).join(", ") },
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
        if (a.Strengths) strengths.push(a.Strengths);
        if (a.Weaknesses) weaknesses.push(a.Weaknesses);
        if (a["Growth Tips"]) growth.push(a["Growth Tips"]);
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
      summary: { strengths, weaknesses, growth, alignments, inventories },
    }, { onConflict: "student_id" });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
