import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Upload, FileJson, FileType2, Scale } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchClusters } from "@/lib/api";
import type { CareerCluster } from "@/lib/types";

interface ParsedQuestion { statement: string; weights?: Record<string, number> }
interface ParsedSection { title: string; description?: string; questions: ParsedQuestion[] }

export function ImportDialog({ open, onOpenChange, questionnaireId, onImported }: {
  open: boolean; onOpenChange: (v: boolean) => void; questionnaireId: string; onImported: () => void;
}) {
  const [mode, setMode] = useState<"file" | "json">("file");
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ParsedSection[] | null>(null);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [applyWeights, setApplyWeights] = useState(true);

  useEffect(() => { if (open) fetchClusters().then(setClusters).catch(() => {}); }, [open]);

  const reset = () => { setFile(null); setJsonText(""); setPreview(null); setApplyWeights(true); };

  // Build cluster name → id map (case-insensitive)
  const clusterIdByName = useMemo(() => {
    const m = new Map<string, string>();
    clusters.forEach(c => m.set(c.name.trim().toLowerCase(), c.id));
    return m;
  }, [clusters]);

  // Stats for preview
  const stats = useMemo(() => {
    if (!preview) return null;
    let total = 0, withWeights = 0;
    const unknown = new Set<string>();
    const matched = new Set<string>();
    preview.forEach(s => s.questions.forEach(q => {
      total++;
      if (q.weights && Object.keys(q.weights).length) {
        withWeights++;
        Object.keys(q.weights).forEach(name => {
          if (clusterIdByName.has(name.trim().toLowerCase())) matched.add(name);
          else unknown.add(name);
        });
      }
    }));
    return { total, withWeights, unknown: [...unknown], matched: [...matched] };
  }, [preview, clusterIdByName]);

  const parse = async () => {
    setBusy(true);
    try {
      let result: ParsedSection[] = [];
      if (mode === "json") {
        const j = JSON.parse(jsonText);
        result = normalizeJson(j);
      } else {
        if (!file) throw new Error("Choose a file");
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "json") {
          const txt = await file.text();
          result = normalizeJson(JSON.parse(txt));
        } else if (["pdf", "docx", "xlsx", "xls"].includes(ext || "")) {
          const buf = await file.arrayBuffer();
          // Chunked base64 to avoid call-stack overflow on large files
          let binary = "";
          const bytes = new Uint8Array(buf);
          const CHUNK = 0x8000;
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
          }
          const base64 = btoa(binary);
          const { data, error } = await supabase.functions.invoke("import-questions", {
            body: { filename: file.name, mime: file.type, base64 },
          });
          if (error) throw error;
          result = data.sections as ParsedSection[];
        } else {
          throw new Error("Unsupported file type. Use JSON, PDF, DOCX, or XLSX.");
        }
      }
      if (!result.length) throw new Error("No questions found.");
      setPreview(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to parse");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const { data: existing } = await supabase.from("sections").select("order_index").eq("questionnaire_id", questionnaireId).order("order_index", { ascending: false }).limit(1);
      let nextOrder = (existing?.[0]?.order_index ?? -1) + 1;
      let weightRows: { question_id: string; career_cluster_id: string; weight: number }[] = [];

      for (const sec of preview) {
        const { data: created, error } = await supabase.from("sections")
          .insert({ questionnaire_id: questionnaireId, title: sec.title, description: sec.description ?? "", order_index: nextOrder++ })
          .select().single();
        if (error) throw error;
        if (!sec.questions.length) continue;
        const rows = sec.questions.map((q, i) => ({ section_id: created.id, statement: q.statement, order_index: i }));
        const { data: insertedQs, error: qErr } = await supabase.from("questions").insert(rows).select();
        if (qErr) throw qErr;

        if (applyWeights && insertedQs) {
          insertedQs.forEach((row: any, i: number) => {
            const w = sec.questions[i]?.weights;
            if (!w) return;
            for (const [name, val] of Object.entries(w)) {
              const cid = clusterIdByName.get(name.trim().toLowerCase());
              if (!cid) continue;
              weightRows.push({ question_id: row.id, career_cluster_id: cid, weight: Math.max(0, Math.min(5, Math.round(Number(val)))) });
            }
          });
        }
      }

      if (weightRows.length) {
        const { error: wErr } = await supabase.from("answer_weights").insert(weightRows);
        if (wErr) throw wErr;
      }

      const totalQ = preview.reduce((s, x) => s + x.questions.length, 0);
      toast.success(`Imported ${totalQ} questions${weightRows.length ? ` and ${weightRows.length} weights` : ""}.`);
      onImported();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><Upload className="h-5 w-5" /> Bulk Import Questions</DialogTitle>
          <DialogDescription>Upload a file or paste JSON. The AI will extract sections, questions and (when present) cluster weights for you to review before insert.</DialogDescription>
        </DialogHeader>

        {!preview && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}><FileType2 className="mr-1.5 h-4 w-4" /> Upload file</Button>
              <Button variant={mode === "json" ? "default" : "outline"} onClick={() => setMode("json")}><FileJson className="mr-1.5 h-4 w-4" /> Paste JSON</Button>
            </div>
            {mode === "file" ? (
              <div className="space-y-2">
                <Label>Choose a file (JSON / PDF / DOCX / XLSX)</Label>
                <Input type="file" accept=".json,.pdf,.docx,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong>JSON:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": [{ "statement": "I enjoy…", "weights": { "Science & Engineering": 4 } }] }] }`}</code></div>
                  <div><strong>XLSX:</strong> Row 1 headers: <code>Section | Question | &lt;Cluster 1&gt; | &lt;Cluster 2&gt; | …</code> — weight columns are optional.</div>
                  <div><strong>PDF / DOCX:</strong> AI extracts sections and questions; if a scoring grid is present it will pull weights too.</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>JSON</Label>
                <Textarea rows={10} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='{"sections":[{"title":"Section A","questions":[{"statement":"I enjoy puzzles.","weights":{"Science & Engineering":5}}]}]}' className="font-mono text-xs" />
              </div>
            )}
            <DialogFooter>
              <Button onClick={parse} disabled={busy || (mode === "file" ? !file : !jsonText.trim())}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Parse & Preview
              </Button>
            </DialogFooter>
          </>
        )}

        {preview && (
          <>
            <div className="max-h-72 overflow-auto rounded-lg border border-border bg-secondary/40 p-3">
              {preview.map((s, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="font-display font-semibold">{s.title}</div>
                  {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                  <ol className="mt-1 list-decimal pl-5 text-sm">
                    {s.questions.map((q, j) => (
                      <li key={j} className="py-0.5">
                        {q.statement}
                        {q.weights && Object.keys(q.weights).length > 0 && (
                          <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                            {Object.entries(q.weights).map(([n, w]) => {
                              const known = clusterIdByName.has(n.trim().toLowerCase());
                              return (
                                <span key={n} className={`rounded px-1.5 py-0.5 text-[10px] ${known ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`} title={known ? "Cluster matched" : "No matching cluster — will be skipped"}>
                                  {n}: {w}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div>
                {preview.length} section{preview.length === 1 ? "" : "s"} · {stats?.total ?? 0} questions will be appended.
                {stats && stats.withWeights > 0 && <> · <strong className="text-foreground">{stats.withWeights}</strong> include weights.</>}
              </div>
              {stats && stats.unknown.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                  Unknown cluster name{stats.unknown.length === 1 ? "" : "s"} — these weights will be skipped: {stats.unknown.join(", ")}.
                  Add or rename matching clusters in the <em>Clusters</em> tab to import them.
                </div>
              )}
            </div>

            {stats && stats.withWeights > 0 && (
              <label className="flex items-start gap-2 rounded-lg border border-setter/30 bg-setter/5 p-3 text-sm">
                <Checkbox checked={applyWeights} onCheckedChange={(v) => setApplyWeights(!!v)} className="mt-0.5" />
                <div>
                  <div className="flex items-center gap-1.5 font-medium"><Scale className="h-3.5 w-3.5" /> Also apply detected weights</div>
                  <div className="text-xs text-muted-foreground">Questions are imported automatically. Weights are only applied with your consent so you can review them first.</div>
                </div>
              </label>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={apply} disabled={busy} className="gradient-setter text-setter-foreground border-0">
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Import
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function normalizeJson(j: any): ParsedSection[] {
  const normSection = (s: any): ParsedSection => ({
    title: s.title || "Section",
    description: s.description,
    questions: (s.questions || []).map((q: any) => {
      if (typeof q === "string") return { statement: q };
      return { statement: String(q.statement ?? q.question ?? q.text ?? ""), weights: q.weights ?? q.scores };
    }).filter((q: ParsedQuestion) => q.statement.trim().length > 0),
  });
  if (Array.isArray(j)) return j.map(normSection);
  if (j.sections && Array.isArray(j.sections)) return j.sections.map(normSection);
  if (Array.isArray(j.questions)) return [normSection(j)];
  throw new Error("Unrecognised JSON shape.");
}
