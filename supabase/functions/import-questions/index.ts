import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface ParsedQuestion { statement: string; weights?: Record<string, number> }
interface ParsedSection { title: string; description?: string; questions: ParsedQuestion[] }

function normaliseWeights(raw: any): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out[String(k).trim()] = Math.max(0, Math.min(5, Math.round(n)));
  }
  return Object.keys(out).length ? out : undefined;
}

function normaliseQuestions(arr: any[]): ParsedQuestion[] {
  return (arr || []).map((q) => {
    if (typeof q === "string") return { statement: q };
    if (q && typeof q === "object") {
      const statement = String(q.statement ?? q.question ?? q.text ?? "").trim();
      if (!statement) return null as any;
      return { statement, weights: normaliseWeights(q.weights ?? q.scores) };
    }
    return null as any;
  }).filter(Boolean) as ParsedQuestion[];
}

async function aiExtractFromFile(ext: string, base64: string, mime?: string): Promise<ParsedSection[]> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `Extract a Likert-style career questionnaire with optional scoring weights. Output JSON of shape:
{ "sections": [{ "title": "...", "description": "...", "questions": [{ "statement": "...", "weights": { "<cluster name>": 0..5 } }] }] }
Rules:
- Strip leading numbering like "1." or "Q3:" from statements.
- Group by visible headings/sections; if none, use "Imported".
- If the document contains a scoring/weighting grid (e.g. a table mapping each question to clusters with numeric weights), include the "weights" object on each question. Cluster names must be exactly as written in the document. Use integer weights 0–5.
- If no weights are present, omit the "weights" field — do NOT invent values.` },
        { role: "user", content: [
          { type: "text", text: `Extract sections, questions and (if present) cluster weights from this ${ext.toUpperCase()} file.` },
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
  return (j.sections ?? []).map((s: any) => ({
    title: s.title || "Imported",
    description: s.description,
    questions: normaliseQuestions(s.questions || []),
  }));
}

function parseXlsx(b64: string): ParsedSection[] {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wb = XLSX.read(bytes, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  if (!rows.length) return [];

  // Detect header row. Expected: Section | Question | <cluster names...>
  const header = (rows[0] || []).map((c: any) => String(c ?? "").trim());
  const lower = header.map(h => h.toLowerCase());
  const hasHeader = lower[0] === "section" && (lower[1] === "question" || lower[1] === "statement");
  const clusterCols: { idx: number; name: string }[] = [];
  if (hasHeader) {
    for (let i = 2; i < header.length; i++) {
      if (header[i]) clusterCols.push({ idx: i, name: header[i] });
    }
  }

  const start = hasHeader ? 1 : 0;
  const map = new Map<string, ParsedQuestion[]>();
  for (let r = start; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const sec = String(row[0] ?? "").trim();
    const statement = String(row[1] ?? "").trim();
    if (!sec || !statement) continue;
    const weights: Record<string, number> = {};
    for (const c of clusterCols) {
      const v = row[c.idx];
      if (v === null || v === undefined || v === "") continue;
      const n = Number(v);
      if (Number.isFinite(n)) weights[c.name] = Math.max(0, Math.min(5, Math.round(n)));
    }
    const q: ParsedQuestion = { statement };
    if (Object.keys(weights).length) q.weights = weights;
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
      sections = await aiExtractFromFile(ext, base64, mime);
    } else {
      return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!sections.length) sections = [{ title: "Imported", questions: [] }];
    return new Response(JSON.stringify({ sections }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
