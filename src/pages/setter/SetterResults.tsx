import { useEffect, useMemo, useState } from "react";
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
import { Download, Search, Users, Trophy, Filter, BarChart3, Eye, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface ResultsRow {
  response_id: string;
  student_id: string;
  full_name: string;
  class_name: string | null;
  stream: string | null;
  questionnaire_id: string;
  questionnaire_title: string;
  submitted_at: string;
  topCluster: string | null;
  topScore: number | null;
  scoresByClusterName: Record<string, number>;
}

const ALL = "__ALL__";

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
        return {
          response_id: r.id,
          student_id: r.student_id,
          full_name: prof?.full_name ?? "Unknown student",
          class_name: prof?.class_name ?? null,
          stream: prof?.stream ?? null,
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

  const classes = useMemo(() => Array.from(new Set(rows.map(r => r.class_name).filter(Boolean))) as string[], [rows]);
  const streams = useMemo(() => Array.from(new Set(rows.map(r => r.stream).filter(Boolean))) as string[], [rows]);
  const questionnaires = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => m.set(r.questionnaire_id, r.questionnaire_title));
    return Array.from(m.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter(r => {
      if (classFilter !== ALL && r.class_name !== classFilter) return false;
      if (streamFilter !== ALL && r.stream !== streamFilter) return false;
      if (questionnaireFilter !== ALL && r.questionnaire_id !== questionnaireFilter) return false;
      if (s && !r.full_name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [rows, classFilter, streamFilter, questionnaireFilter, search]);

  const grouped = useMemo(() => {
    const out = new Map<string, ResultsRow[]>();
    filtered.forEach(r => {
      const key = `${r.class_name ?? "—"} · ${r.stream ?? "—"}`;
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(r);
    });
    return Array.from(out.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

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

  return (
    <PageShell tone="setter" title="Counsellor Portal">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Student Results</h1>
          <p className="text-sm text-muted-foreground">All submissions across the school. Filter by class, stream and questionnaire — open any student for a full report.</p>
        </div>
        <Button onClick={exportCsv} size="sm" className="gradient-setter text-setter-foreground border-0 shadow-glow">
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
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
              {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={streamFilter} onValueChange={setStreamFilter}>
            <SelectTrigger><SelectValue placeholder="All streams" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All streams</SelectItem>
              {streams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
          {grouped.map(([groupKey, list]) => (
            <div key={groupKey} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border bg-secondary/40 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-setter text-setter-foreground text-xs font-semibold">{list.length}</div>
                  <div>
                    <h3 className="font-display font-semibold">{groupKey}</h3>
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
