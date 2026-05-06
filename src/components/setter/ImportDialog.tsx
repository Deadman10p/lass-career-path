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

interface ProfileDatum { label: string; content: string }
interface ParsedQuestion { statement: string; weights?: Record<string, any> }
interface ParsedSection { title: string; description?: string; questions: ParsedQuestion[] }
interface ClusterInfo {
  name: string;
  icon_emoji?: string;
  description?: string;
  possible_careers?: string[];
  profile_attributes?: Record<string, string>;
  profile_data?: ProfileDatum[];
}
interface ParsedDoc {
  sections: ParsedSection[];
  clusters: ClusterInfo[];
  profile_schema: string[];
}

export function ImportDialog({ open, onOpenChange, questionnaireId, onImported }: {
  open: boolean; onOpenChange: (v: boolean) => void; questionnaireId: string; onImported: () => void;
}) {
  const [mode, setMode] = useState<"file" | "json">("file");
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ParsedSection[] | null>(null);
  const [parsedClusters, setParsedClusters] = useState<ClusterInfo[]>([]);
  const [profileSchema, setProfileSchema] = useState<string[]>([]);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [applyWeights, setApplyWeights] = useState(true);
  const [detectedClusters, setDetectedClusters] = useState<Map<string, ClusterInfo>>(new Map());

  useEffect(() => { if (open) fetchClusters(questionnaireId).then(setClusters).catch(() => {}); }, [open, questionnaireId]);

  const reset = () => { setFile(null); setJsonText(""); setPreview(null); setParsedClusters([]); setProfileSchema([]); setApplyWeights(true); setDetectedClusters(new Map()); };

  // Build cluster name → id map (case-insensitive)
  const clusterIdByName = useMemo(() => {
    const m = new Map<string, string>();
    clusters.forEach(c => m.set(c.name.trim().toLowerCase(), c.id));
    return m;
  }, [clusters]);

  // Stats for preview - collect all detected cluster names from weights with metadata
  const stats = useMemo(() => {
    if (!preview) return null;
    let total = 0, withWeights = 0;
    const allDetected = new Set<string>();
    const unknown = new Set<string>();
    const matched = new Set<string>();
    const clusterInfoMap = new Map<string, ClusterInfo>();
    
    preview.forEach(s => s.questions.forEach(q => {
      total++;
      if (q.weights && Object.keys(q.weights).length) {
        withWeights++;
        Object.keys(q.weights).forEach(name => {
          allDetected.add(name);
          if (clusterIdByName.has(name.trim().toLowerCase())) {
            matched.add(name);
          } else {
            unknown.add(name);
            // Extract cluster info from first occurrence
            if (!clusterInfoMap.has(name)) {
              // Try to get emoji and description from the weight value if it's an object
              const weightVal = q.weights![name];
              if (typeof weightVal === 'object' && weightVal !== null) {
                clusterInfoMap.set(name, {
                  name,
                  icon_emoji: (weightVal as any).icon_emoji ?? '✨',
                  description: (weightVal as any).description ?? '',
                  possible_careers: (weightVal as any).possible_careers ?? [],
                  profile_data: Array.isArray((weightVal as any).profile_data) ? (weightVal as any).profile_data : [],
                });
              } else {
                clusterInfoMap.set(name, { name, icon_emoji: '✨', description: '', possible_careers: [] });
              }
            }
          }
        });
      }
    }));
    setDetectedClusters(clusterInfoMap);
    return { total, withWeights, unknown: [...unknown], matched: [...matched], allDetected: [...allDetected] };
  }, [preview, clusterIdByName]);

  const parse = async () => {
    setBusy(true);
    try {
      let parsed: ParsedDoc = { sections: [], clusters: [], profile_schema: [] };
      if (mode === "json") {
        parsed = normalizeJson(JSON.parse(jsonText));
      } else {
        if (!file) throw new Error("Choose a file");
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "json") {
          const txt = await file.text();
          parsed = normalizeJson(JSON.parse(txt));
        } else if (["pdf", "docx", "xlsx", "xls"].includes(ext || "")) {
          const buf = await file.arrayBuffer();
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
          parsed = { sections: data.sections as ParsedSection[], clusters: [], profile_schema: [] };
        } else {
          throw new Error("Unsupported file type. Use JSON, PDF, DOCX, or XLSX.");
        }
      }
      if (!parsed.sections.length) throw new Error("No questions found.");
      setPreview(parsed.sections);
      setParsedClusters(parsed.clusters);
      setProfileSchema(parsed.profile_schema);
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
      // Build effective name -> cluster_id map for THIS questionnaire.
      let effectiveMap = new Map(clusterIdByName);

      // If applying weights, auto-create any missing clusters from the import
      if (applyWeights && stats?.allDetected?.length) {
        const colors = ["#4F46E5","#DC2626","#0EA5E9","#10B981","#F59E0B","#8B5CF6","#EC4899"];
        let colorIndex = clusters.length % colors.length;
        
        console.log("Starting cluster auto-creation. Detected clusters:", stats.allDetected);
        console.log("Existing clusters map:", Array.from(effectiveMap.entries()));
        console.log("Detected cluster info:", Array.from(detectedClusters.entries()));
        
        // Create any missing clusters
        for (const name of stats.allDetected) {
          const normalizedName = name.trim().toLowerCase();
          console.log("Processing cluster:", name, "normalized:", normalizedName);
          
          if (!effectiveMap.has(normalizedName)) {
            // Prefer rich cluster info from top-level "clusters" array if present
            const topLevel = parsedClusters.find(pc => pc.name.trim().toLowerCase() === normalizedName);
            const clusterInfo = topLevel ?? detectedClusters.get(name) ?? { name, icon_emoji: '✨', description: '', possible_careers: [] };

            const { data, error } = await supabase.from("career_clusters").insert({
              name,
              icon_emoji: clusterInfo.icon_emoji ?? '✨',
              description: clusterInfo.description ?? `Auto-created from import`,
              possible_careers: clusterInfo.possible_careers ?? [],
              profile_attributes: clusterInfo.profile_attributes ?? {},
              profile_data: clusterInfo.profile_data ?? [],
              color_hex: colors[colorIndex++ % colors.length],
              questionnaire_id: questionnaireId,
            } as any).select().single();
            
            if (error) {
              console.error("Failed to create cluster:", error);
              throw error;
            }
            
            console.log("Cluster created successfully:", name, "ID:", data.id);
            
            // Check if junction already exists before inserting
            const { data: existingJunction } = await supabase
              .from("questionnaire_clusters")
              .select("id")
              .eq("questionnaire_id", questionnaireId)
              .eq("career_cluster_id", data.id)
              .maybeSingle();
            
            if (!existingJunction) {
              console.log("Creating junction for cluster:", name);
              const junctionResult = await supabase.from("questionnaire_clusters").insert({
                questionnaire_id: questionnaireId, career_cluster_id: data.id,
              });
              
              if (junctionResult.error) {
                console.error("Failed to create junction:", junctionResult.error);
                throw junctionResult.error;
              }
              console.log("Junction created successfully for:", name);
            } else {
              console.log("Junction already exists for:", name);
            }
            
            effectiveMap.set(normalizedName, data.id);
            console.log("Updated effectiveMap. Now has:", Array.from(effectiveMap.entries()));
          } else {
            console.log("Cluster already exists in map:", name);
          }
        }
        
        console.log("Final effectiveMap after auto-creation:", Array.from(effectiveMap.entries()));
      }

      // Persist profile_schema on the questionnaire if provided
      if (profileSchema.length) {
        await supabase.from("questionnaires").update({ profile_schema: profileSchema } as any).eq("id", questionnaireId);
      }

      // For existing clusters that match an entry in parsedClusters, merge profile_attributes
      for (const pc of parsedClusters) {
        const existingId = effectiveMap.get(pc.name.trim().toLowerCase());
        if (!existingId) continue;
        const patch: any = {};
        if (pc.profile_attributes && Object.keys(pc.profile_attributes).length) patch.profile_attributes = pc.profile_attributes;
        if (pc.profile_data && pc.profile_data.length) patch.profile_data = pc.profile_data;
        if (Object.keys(patch).length) {
          await supabase.from("career_clusters").update(patch).eq("id", existingId);
        }
      }

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
              const cid = effectiveMap.get(name.trim().toLowerCase());
              if (!cid) continue;
              // Handle both simple number weights and detailed object format
              let num: number;
              if (val !== null && typeof val === 'object' && 'value' in (val as any)) {
                num = Number((val as any).value);
              } else {
                num = Number(val);
              }
              if (!Number.isFinite(num)) continue;
              weightRows.push({ question_id: row.id, career_cluster_id: cid, weight: Math.max(0, Math.round(num)) });
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
          <DialogDescription>Upload a file or paste JSON. The AI will extract sections, questions and (when present) category weights for you to review before insert. Categories can be career clusters, learning styles, personality traits — whatever the source document uses. Weights are kept at the exact scale of the document (e.g. 0–3, 0–5, 0–10).</DialogDescription>
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
                  <div><strong>Simple JSON:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": [{ "statement": "I enjoy…", "weights": { "Science & Engineering": 4 } }] }] }`}</code></div>
                  <div><strong>Detailed JSON with cluster info:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": [{ "statement": "I love math", "weights": { "STEM": { "value": 5, "icon_emoji": "🔬", "description": "Science and technology careers", "possible_careers": ["Engineer", "Data Scientist"] } } }] }] }`}</code></div>
                  <div><strong>XLSX:</strong> Row 1 headers: <code>Section | Question | &lt;Cluster 1&gt; | &lt;Cluster 2&gt; | …</code> — weight columns are optional.</div>
                  <div><strong>PDF / DOCX:</strong> AI extracts sections and questions; if a scoring grid is present it will pull weights too.</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>JSON</Label>
                <Textarea rows={10} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='{ "sections": [ { "title": "Career Interests", "questions": [ { "statement": "I love working with numbers", "weights": { "STEM": { "value": 5, "icon_emoji": "🔬", "description": "Science and technology careers", "possible_careers": ["Engineer", "Data Scientist"] } } }, { "statement": "I enjoy helping people", "weights": { "Healthcare": { "value": 4, "icon_emoji": "🏥", "description": "Medical professions", "possible_careers": ["Doctor", "Nurse"] }, "Education": 3 } } ] } ] }' className="font-mono text-xs" />
                <div className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> Use simple weights like <code>{`{"STEM": 5}`}</code> or detailed format with emoji/description: <code>{`{"STEM": {"value": 5, "icon_emoji": "🔬", "description": "Science careers", "possible_careers": ["Engineer"]}}`}</code>
                </div>
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
                                  {n}
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

            {stats && (
              <div className="rounded-lg border border-border bg-muted p-3 text-sm space-y-2">
                <div className="font-semibold">Preview Summary</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>Total Questions: <strong>{stats.total}</strong></div>
                  <div>With Weights: <strong>{stats.withWeights}</strong></div>
                </div>
                {stats.matched.length > 0 && (
                  <div className="text-xs">
                    <strong className="text-success">Matched Clusters:</strong> {stats.matched.join(", ")}
                  </div>
                )}
                {stats.unknown.length > 0 && (
                  <div className="text-xs">
                    <strong className="text-destructive">New Clusters to Create:</strong> {stats.unknown.join(", ")}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox id="weights" checked={applyWeights} onCheckedChange={(v) => setApplyWeights(!!v)} />
              <Label htmlFor="weights" className="text-sm cursor-pointer">
                Auto-create missing clusters and import weights
              </Label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { reset(); setPreview(null); }}>Back</Button>
              <Button onClick={apply} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Confirm Import
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function normalizeJson(data: any): ParsedDoc {
  const empty: ParsedDoc = { sections: [], clusters: [], profile_schema: [] };
  if (!data) return empty;
  const extractClusters = (d: any): ClusterInfo[] => {
    if (!d || typeof d !== "object") return [];
    const arr = d.clusters || d.categories || d.cluster_definitions;
    if (!Array.isArray(arr)) return [];
    return arr.map((c: any) => ({
      name: String(c.name ?? c.title ?? "").trim(),
      icon_emoji: c.icon_emoji ?? c.emoji ?? "✨",
      description: c.description ?? "",
      possible_careers: Array.isArray(c.possible_careers) ? c.possible_careers : [],
      profile_attributes: (c.profile_attributes && typeof c.profile_attributes === "object") ? c.profile_attributes : {},
      profile_data: Array.isArray(c.profile_data)
        ? c.profile_data
            .map((p: any) => ({ label: String(p?.label ?? "").trim(), content: String(p?.content ?? "").trim() }))
            .filter((p: ProfileDatum) => p.label && p.content)
        : [],
    })).filter((c: ClusterInfo) => c.name);
  };
  const extractSchema = (d: any): string[] => {
    if (Array.isArray(d?.profile_schema)) return d.profile_schema.map((x: any) => String(x));
    return [];
  };
  const sectionsFrom = (arr: any[]): ParsedSection[] => arr.map((s) => ({
    title: s.title || "Untitled",
    description: s.description,
    questions: (s.questions || []).map((q: any) => ({ statement: q.statement || q.question || "", weights: q.weights })),
  }));

  if (Array.isArray(data)) return { ...empty, sections: sectionsFrom(data) };
  if ("sections" in data) {
    return {
      sections: sectionsFrom(data.sections || []),
      clusters: extractClusters(data),
      profile_schema: extractSchema(data),
    };
  }
  if ("title" in data || "statement" in data) {
    return { ...empty, sections: [{ title: data.title || "Untitled", description: data.description, questions: [{ statement: data.statement || data.question || "", weights: data.weights }] }] };
  }
  return empty;
}