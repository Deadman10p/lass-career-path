import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface ParsedSection { title: string; description?: string; questions: string[] }

async function aiNormalize(rawText: string): Promise<ParsedSection[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `Extract a Likert-style career questionnaire from the given text. Output JSON: { "sections": [{ "title": "...", "description": "...", "questions": ["..."] }] }. Each question must be a single statement a student would rate 1-5. Group by visible headings/sections. Strip numbering. If no sections detected, use one section called "Imported".` },
        { role: "user", content: rawText.slice(0, 30000) },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const data = await r.json();
  const j = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  return (j.sections ?? []).map((s: any) => ({
    title: s.title || "Imported",
    description: s.description,
    questions: (s.questions || []).map(String).filter(Boolean),
  }));
}

function parseXlsx(b64: string): ParsedSection[] {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  const map = new Map<string, string[]>();
  for (const row of rows) {
    if (!row || !row.length) continue;
    const sec = String(row[0] || "").trim();
    const q = String(row[1] || "").trim();
    if (!sec || !q) continue;
    if (sec.toLowerCase() === "section" && q.toLowerCase() === "question") continue; // header
    if (!map.has(sec)) map.set(sec, []);
    map.get(sec)!.push(q);
  }
  return [...map.entries()].map(([title, questions]) => ({ title, questions }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { filename, mime, base64 } = await req.json();
    if (!base64) return new Response(JSON.stringify({ error: "no file" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ext = (filename || "").split(".").pop()?.toLowerCase();
    let sections: ParsedSection[] = [];

    if (ext === "xlsx" || ext === "xls") {
      sections = parseXlsx(base64);
    } else if (ext === "pdf" || ext === "docx") {
      // Use Gemini multimodal: pass the file directly to AI for extraction
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: `Extract a Likert-style career questionnaire. Output JSON: { "sections": [{ "title": "...", "description": "...", "questions": ["..."] }] }. Strip numbering. Group by document headings.` },
            { role: "user", content: [
              { type: "text", text: `Extract sections and questions from this ${ext.toUpperCase()} file.` },
              { type: "image_url", image_url: { url: `data:${mime || (ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document")};base64,${base64}` } },
            ] },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`AI extraction failed (${r.status}): ${t.slice(0, 200)}`);
      }
      const data = await r.json();
      const j = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
      sections = (j.sections ?? []).map((s: any) => ({
        title: s.title || "Imported",
        description: s.description,
        questions: (s.questions || []).map(String).filter(Boolean),
      }));
    } else {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!sections.length) sections = [{ title: "Imported", questions: [] }];
    return new Response(JSON.stringify({ sections }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
