import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { CareerCluster } from "@/lib/types";
import { Download, Search, Users, Trophy, Filter, BarChart3, Eye, TrendingUp, FileArchive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import StudentReportPDFView, { type StudentReportPDFMeta } from "@/components/StudentReportPDFView";
import { exportNodeToPdf } from "@/lib/pdfExport";

interface ResultsRow {
  response_id: string;
  student_id: string;
  full_name: string;
  class_name: string | null;
  class_key: string | null;
  stream: string | null;
  stream_key: string | null;
  questionnaire_id: string;
  questionnaire_title: string;
  submitted_at: string;
  topCluster: string | null;
  topScore: number | null;
  scoresByClusterName: Record<string, number>;
}

const ALL = "__ALL__";

// Normalise free-text class/stream values so "S1C", "s1c", "s1.c", "S1 C" all
// collapse to the same bucket for filtering, grouping and ZIP folder names.
function normaliseKey(v: string | null | undefined): string | null {
  if (!v) return null;
  const k = v.toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return k || null;
}

// Pick the most frequent original spelling for a given normalised key so the
// UI shows a real label (e.g. "S1C") rather than the stripped key.
function pickCanonicalLabels(values: Array<string | null>): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const v of values) {
    const key = normaliseKey(v);
    if (!key || !v) continue;
    if (!counts.has(key)) counts.set(key, new Map());
    const inner = counts.get(key)!;
    inner.set(v, (inner.get(v) ?? 0) + 1);
  }
  const out = new Map<string, string>();
  counts.forEach((inner, key) => {
    let bestLabel = key;
    let bestCount = -1;
    inner.forEach((c, label) => {
      if (c > bestCount || (c === bestCount && label.length > bestLabel.length)) {
        bestCount = c;
        bestLabel = label;
      }
    });
    out.set(key, bestLabel);
  });
  return out;
}

export default function SetterResults() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ResultsRow[]>([]);
  const [classFilter, setClassFilter] = useState<string>(ALL);
  const [streamFilter, setStreamFilter] = useState<string>(ALL);
  const [questionnaireFilter, setQuestionnaireFilter] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: resps }, { data: qs }, { data: allClusters }] = await Promise.all([
        supabase.from("responses").select("*").order("submitted_at", { ascending: false }),
        supabase.from("questionnaires").select("id, title"),
        supabase.from("career_clusters").select("id, name"),
      ]);

      const qMap = new Map((qs ?? []).map((q: any) => [q.id, q.title]));
      const clusterNameById = new Map((allClusters ?? []).map((c: any) => [c.id, c.name as string]));
      const responseIds = (resps ?? []).map(r => r.id);
      const studentIds = [...new Set((resps ?? []).map(r => r.student_id))];

      const [{ data: results }, { data: profiles }] = await Promise.all([
        responseIds.length
          ? supabase.from("results").select("*").in("response_id", responseIds)
          : Promise.resolve({ data: [] as any[] }),
        studentIds.length
          ? supabase.from("profiles").select("user_id, full_name, class_name, stream").in("user_id", studentIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      const built: ResultsRow[] = (resps ?? []).map((r: any) => {
        const myResults = (results ?? []).filter((x: any) => x.response_id === r.id);
        const map: Record<string, number> = {};
        myResults.forEach((x: any) => {
          const name = clusterNameById.get(x.career_cluster_id) ?? "Unknown";
          map[name] = (map[name] ?? 0) + x.total_score;
        });
        const sorted = [...myResults].sort((a, b) => b.total_score - a.total_score);
        const top = sorted[0];
        const prof = profMap.get(r.student_id) as any;
        const className = prof?.class_name ?? null;
        const stream = prof?.stream ?? null;
        return {
          response_id: r.id,
          student_id: r.student_id,
          full_name: prof?.full_name ?? "Unknown student",
          class_name: className,
          class_key: normaliseKey(className),
          stream: stream,
          stream_key: normaliseKey(stream),
          questionnaire_id: r.questionnaire_id,
          questionnaire_title: qMap.get(r.questionnaire_id) ?? "Untitled questionnaire",
          submitted_at: r.submitted_at,
          topCluster: top ? (clusterNameById.get(top.career_cluster_id) ?? null) : null,
          topScore: top?.total_score ?? null,
          scoresByClusterName: map,
        };
      });

      setRows(built);
      setLoading(false);
    })();
  }, []);

  const classLabelByKey = useMemo(() => pickCanonicalLabels(rows.map(r => r.class_name)), [rows]);
  const streamLabelByKey = useMemo(() => pickCanonicalLabels(rows.map(r => r.stream)), [rows]);

  const classes = useMemo(() => {
    const keys = Array.from(new Set(rows.map(r => r.class_key).filter(Boolean))) as string[];
    return keys
      .map(k => ({ key: k, label: classLabelByKey.get(k) ?? k }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, classLabelByKey]);

  const streams = useMemo(() => {
    const keys = Array.from(new Set(rows.map(r => r.stream_key).filter(Boolean))) as string[];
    return keys
      .map(k => ({ key: k, label: streamLabelByKey.get(k) ?? k }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, streamLabelByKey]);

  const questionnaires = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => m.set(r.questionnaire_id, r.questionnaire_title));
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (classFilter !== ALL && r.class_key !== classFilter) return false;
      if (streamFilter !== ALL && r.stream_key !== streamFilter) return false;
      if (questionnaireFilter !== ALL && r.questionnaire_id !== questionnaireFilter) return false;
      if (s && !r.full_name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, classFilter, streamFilter, questionnaireFilter, search]);

  const grouped = useMemo(() => {
    const out = new Map<string, { label: string; rows: ResultsRow[] }>();
    filtered.forEach(r => {
      const ck = r.class_key ?? "__NONE__";
      const sk = r.stream_key ?? "__NONE__";
      const key = `${ck}::${sk}`;
      const classLabel = r.class_key ? (classLabelByKey.get(r.class_key) ?? r.class_name ?? "—") : "—";
      const streamLabel = r.stream_key ? (streamLabelByKey.get(r.stream_key) ?? r.stream ?? "—") : "—";
      const label = `${classLabel} · ${streamLabel}`;
      if (!out.has(key)) out.set(key, { label, rows: [] });
      out.get(key)!.rows.push(r);
    });
    return Array.from(out.entries())
      .map(([k, v]) => [k, v.label, v.rows] as const)
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [filtered, classLabelByKey, streamLabelByKey]);

  const topClusterCounts = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(r => { if (r.topCluster) m[r.topCluster] = (m[r.topCluster] ?? 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  // Aggregated category results across the filtered set (avg score per category name)
  const aggregateByCategory = useMemo(() => {
    const totals: Record<string, { sum: number; n: number }> = {};
    filtered.forEach(r => {
      Object.entries(r.scoresByClusterName).forEach(([name, score]) => {
        if (!totals[name]) totals[name] = { sum: 0, n: 0 };
        totals[name].sum += score;
        totals[name].n += 1;
      });
    });
    return Object.entries(totals)
      .map(([name, { sum, n }]) => ({ name, avg: Math.round((sum / n) * 10) / 10, count: n }))
      .sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const exportCsv = () => {
    if (!filtered.length) { toast.error("Nothing to export with the current filters."); return; }
    const allCats = Array.from(new Set(filtered.flatMap(r => Object.keys(r.scoresByClusterName)))).sort();
    const headers = ["Student", "Class", "Stream", "Questionnaire", "Submitted", "Top category", "Top score", ...allCats];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        esc(r.full_name), esc(r.class_name ?? ""), esc(r.stream ?? ""),
        esc(r.questionnaire_title), new Date(r.submitted_at).toISOString(),
        esc(r.topCluster ?? ""), String(r.topScore ?? ""),
        ...allCats.map(n => String(r.scoresByClusterName[n] ?? 0)),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lass-results-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- Bulk PDF export -----
  type BulkItem = {
    response_id: string;
    full_name: string;
    class_name: string | null;
    stream: string | null;
    questionnaire_title: string;
  };
  const [bulkQueue, setBulkQueue] = useState<BulkItem[]>([]);
  const [bulkIndex, setBulkIndex] = useState(0);
  const [bulkRunning, setBulkRunning] = useState(false);
  const bulkRef = useRef<{ zip: any; failures: string[] } | null>(null);

  const sanitize = (s: string) => s.replace(/[^a-z0-9-_.]+/gi, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "report";

  const startBulkExport = async () => {
    if (!filtered.length) { toast.error("Nothing to export with the current filters."); return; }
    if (bulkRunning) return;
    try {
      const { default: JSZip } = await import("jszip");
      bulkRef.current = { zip: new JSZip(), failures: [] };
      const queue: BulkItem[] = filtered.map(r => ({
        response_id: r.response_id,
        full_name: r.full_name,
        class_name: r.class_name,
        stream: r.stream,
        questionnaire_title: r.questionnaire_title,
      }));
      setBulkQueue(queue);
      setBulkIndex(0);
      setBulkRunning(true);
      toast.info(`Preparing ${queue.length} PDF${queue.length === 1 ? "" : "s"}…`);
    } catch (e) {
      toast.error("Could not initialise bulk export.");
    }
  };

  const finishBulkExport = useCallback(async () => {
    const state = bulkRef.current;
    if (!state) return;
    try {
      const blob = await state.zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lass-reports-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      if (state.failures.length) {
        toast.warning(`Exported with ${state.failures.length} failure${state.failures.length === 1 ? "" : "s"}. See console for details.`);
        // eslint-disable-next-line no-console
        console.warn("Bulk export failures:", state.failures);
      } else {
        toast.success("All reports exported.");
      }
    } catch {
      toast.error("Failed to assemble ZIP file.");
    } finally {
      bulkRef.current = null;
      setBulkRunning(false);
      setBulkQueue([]);
      setBulkIndex(0);
    }
  }, []);

  const handleBulkReady = useCallback(
    async (node: HTMLDivElement, meta: StudentReportPDFMeta) => {
      const state = bulkRef.current;
      const current = bulkQueue[bulkIndex];
      if (!state || !current) return;
      try {
        const pdfBlob = await exportNodeToPdf(node);
        const folder = sanitize(current.class_name || "Unassigned");
        const qFolder = sanitize(current.questionnaire_title || "Inventory");
        const file = `${sanitize(meta.studentName)}-${current.response_id.slice(0, 8)}.pdf`;
        state.zip.folder(folder)!.folder(qFolder)!.file(file, pdfBlob);
      } catch (e: any) {
        state.failures.push(`${current.full_name}: ${e?.message ?? "render failed"}`);
      }
      const next = bulkIndex + 1;
      if (next >= bulkQueue.length) {
        await finishBulkExport();
      } else {
        setBulkIndex(next);
      }
    },
    [bulkIndex, bulkQueue, finishBulkExport],
  );

  const handleBulkError = useCallback(
    (err: string) => {
      const state = bulkRef.current;
      const current = bulkQueue[bulkIndex];
      if (state && current) state.failures.push(`${current.full_name}: ${err}`);
      const next = bulkIndex + 1;
      if (next >= bulkQueue.length) {
        finishBulkExport();
      } else {
        setBulkIndex(next);
      }
    },
    [bulkIndex, bulkQueue, finishBulkExport],
  );

  return (
    <PageShell tone="setter" title="Counsellor Portal">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Student Results</h1>
          <p className="text-sm text-muted-foreground">All submissions across the school. Filter by class, stream and questionnaire — open any student for a full report.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv} size="sm" variant="outline">
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={startBulkExport} size="sm" disabled={bulkRunning || !filtered.length} className="gradient-setter text-setter-foreground border-0 shadow-glow">
            {bulkRunning ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Exporting {bulkIndex + 1}/{bulkQueue.length}…</>
            ) : (
              <><FileArchive className="mr-1.5 h-4 w-4" /> Download all PDFs (ZIP)</>
            )}
          </Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total submissions" value={filtered.length} loading={loading} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Most common top category" valueLabel={topClusterCounts[0]?.[0] ?? "—"} loading={loading} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Distinct classes" value={new Set(filtered.map(r => r.class_name).filter(Boolean)).size} loading={loading} />
      </div>

      <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-brand-red" /> Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All classes</SelectItem>
              {classes.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={streamFilter} onValueChange={setStreamFilter}>
            <SelectTrigger><SelectValue placeholder="All streams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All streams</SelectItem>
              {streams.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={questionnaireFilter} onValueChange={setQuestionnaireFilter}>
            <SelectTrigger><SelectValue placeholder="All questionnaires" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All questionnaires</SelectItem>
              {questionnaires.map(([id, title]) => <SelectItem key={id} value={id}>{title}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search student name…" className="pl-8" />
          </div>
        </div>
      </div>

      {/* AGGREGATED CATEGORY RESULTS */}
      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-setter text-setter-foreground">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Aggregated category results</h2>
            <p className="text-xs text-muted-foreground">
              Average score per category across the {filtered.length} filtered submission{filtered.length === 1 ? "" : "s"}
              {classFilter !== ALL && ` · class ${classFilter}`}
              {streamFilter !== ALL && ` · stream ${streamFilter}`}.
              {questionnaireFilter === ALL && " (Compare within a single questionnaire for the cleanest view.)"}
            </p>
          </div>
        </div>
        {!aggregateByCategory.length ? (
          <div className="rounded-lg bg-secondary/40 p-6 text-center text-sm text-muted-foreground">No data for the current filters yet.</div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const max = Math.max(...aggregateByCategory.map(a => a.avg), 1);
              return aggregateByCategory.map(a => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="w-40 truncate text-sm font-medium">{a.name}</div>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-setter" style={{ width: `${(a.avg / max) * 100}%` }} />
                  </div>
                  <div className="w-24 text-right text-xs tabular-nums text-muted-foreground">avg {a.avg} · n={a.count}</div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
          No student submissions match these filters yet.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([groupKey, groupLabel, list]) => (
            <div key={groupKey} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-setter text-setter-foreground text-xs font-semibold">{list.length}</div>
                  <div>
                    <h3 className="font-display font-semibold">{groupLabel}</h3>
                    <p className="text-xs text-muted-foreground">{list.length} submission{list.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Questionnaire</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Top category</TableHead>
                      <TableHead className="text-right">Top score</TableHead>
                      <TableHead className="w-[1%] text-right">Report</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(r => (
                      <TableRow key={r.response_id}>
                        <TableCell className="font-medium">{r.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.questionnaire_title}</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="secondary">{r.topCluster ?? "—"}</Badge></TableCell>
                        <TableCell className="text-right tabular-nums">{r.topScore ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" className="gradient-setter text-setter-foreground border-0">
                            <Link to={`/setter/response/${r.response_id}`}><Eye className="mr-1 h-3.5 w-3.5" /> View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hidden off-screen mount used by the bulk PDF exporter. Renders one report at a time. */}
      {bulkRunning && bulkQueue[bulkIndex] && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            left: "-10000px",
            top: 0,
            width: 920,
            pointerEvents: "none",
          }}
        >
          <StudentReportPDFView
            key={bulkQueue[bulkIndex].response_id}
            responseId={bulkQueue[bulkIndex].response_id}
            onReady={handleBulkReady}
            onError={handleBulkError}
          />
        </div>
      )}
    </PageShell>
  );
}

function StatCard({ icon, label, value, valueLabel, loading }: { icon: React.ReactNode; label: string; value?: number; valueLabel?: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-setter text-setter-foreground">{icon}</div>
        {label}
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-20" /> : <div className="mt-3 font-display text-2xl font-semibold">{valueLabel ?? value}</div>}
    </div>
  );
}

function esc(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
