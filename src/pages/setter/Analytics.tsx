import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart3, Download, Users, FileQuestion, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchClusters, fetchFullQuestionnaire } from "@/lib/api";
import type { CareerCluster, FullQuestionnaire } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface ResponseRow {
  id: string;
  student_id: string;
  submitted_at: string;
  full_name: string;
  class_name: string | null;
  topCluster?: string;
  topScore?: number;
  resultsByCluster: Record<string, number>;
}

export default function Analytics() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<FullQuestionnaire | null>(null);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [rows, setRows] = useState<ResponseRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, cs, { data: resps }] = await Promise.all([
        fetchFullQuestionnaire(id),
        fetchClusters(id),
        supabase.from("responses").select("*").eq("questionnaire_id", id).order("submitted_at", { ascending: false }),
      ]);
      setDoc(d);
      setClusters(cs);

      const responseIds = (resps ?? []).map((r) => r.id);
      const studentIds = [...new Set((resps ?? []).map((r) => r.student_id))];

      const [{ data: results }, { data: profiles }] = await Promise.all([
        responseIds.length
          ? supabase.from("results").select("*").in("response_id", responseIds)
          : Promise.resolve({ data: [] as any[] }),
        studentIds.length
          ? supabase.from("profiles").select("user_id, full_name, class_name").in("user_id", studentIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const built: ResponseRow[] = (resps ?? []).map((r: any) => {
        const myResults = (results ?? []).filter((x: any) => x.response_id === r.id);
        const map: Record<string, number> = {};
        myResults.forEach((x: any) => { map[x.career_cluster_id] = x.total_score; });
        const top = myResults.sort((a: any, b: any) => b.total_score - a.total_score)[0];
        const prof = profMap.get(r.student_id) as any;
        return {
          id: r.id,
          student_id: r.student_id,
          submitted_at: r.submitted_at,
          full_name: prof?.full_name ?? "Unknown student",
          class_name: prof?.class_name ?? null,
          topCluster: top ? cs.find((c) => c.id === top.career_cluster_id)?.name : undefined,
          topScore: top?.total_score,
          resultsByCluster: map,
        };
      });
      setRows(built);
      setLoading(false);
    })();
  }, [id]);

  const avgPerCluster = useMemo(() => {
    if (!rows.length) return [];
    return clusters.map((c) => {
      const totals = rows.map((r) => r.resultsByCluster[c.id] ?? 0);
      const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
      return { name: c.name, avg: Math.round(avg * 10) / 10, emoji: c.icon_emoji };
    });
  }, [rows, clusters]);

  const exportCsv = () => {
    if (!rows.length) { toast.error("No responses to export."); return; }
    const headers = ["Student", "Class", "Submitted", "Top cluster", "Top score", ...clusters.map((c) => c.name)];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const row = [
        csvEscape(r.full_name),
        csvEscape(r.class_name ?? ""),
        new Date(r.submitted_at).toISOString(),
        csvEscape(r.topCluster ?? ""),
        String(r.topScore ?? ""),
        ...clusters.map((c) => String(r.resultsByCluster[c.id] ?? 0)),
      ];
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${(doc?.title ?? "questionnaire").replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageShell tone="setter" title="Setter Portal"><Skeleton className="h-72 w-full rounded-2xl" /></PageShell>;
  if (!doc) return <PageShell tone="setter" title="Setter Portal"><div className="rounded-2xl border border-border bg-card p-6">Not found.</div></PageShell>;

  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/setter/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{doc.title}</h1>
          <p className="text-xs text-muted-foreground">Analytics & responses</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><Link to={`/setter/questionnaire/${id}/edit`}>Edit questionnaire</Link></Button>
          <Button onClick={exportCsv} size="sm" className="gradient-setter text-setter-foreground border-0"><Download className="mr-1 h-4 w-4" /> Export CSV</Button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat icon={<Users className="h-4 w-4" />} label="Total responses" value={rows.length} />
        <Stat icon={<FileQuestion className="h-4 w-4" />} label="Questions" value={doc.sections.reduce((a, s) => a + s.questions.length, 0)} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Most common top cluster" valueLabel={mostCommonTop(rows) ?? "—"} />
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold"><BarChart3 className="h-5 w-5 text-setter" /> Average score per cluster</h2>
        {!rows.length ? (
          <div className="rounded-lg bg-secondary/50 p-6 text-center text-sm text-muted-foreground">No responses yet — share the published link with your students.</div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgPerCluster}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} angle={-15} textAnchor="end" height={70} interval={0} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="avg" radius={[8, 8, 0, 0]} fill="hsl(var(--setter))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">Individual responses</h2>
        </div>
        {!rows.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No submissions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Top cluster</TableHead>
                  <TableHead className="text-right">Top score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.class_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(r.submitted_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="secondary">{r.topCluster ?? "—"}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{r.topScore ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Stat({ icon, label, value, valueLabel }: { icon: React.ReactNode; label: string; value?: number; valueLabel?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-setter text-setter-foreground">{icon}</div>
        {label}
      </div>
      <div className="mt-3 font-display text-2xl font-semibold">{valueLabel ?? value}</div>
    </div>
  );
}

function mostCommonTop(rows: ResponseRow[]): string | null {
  if (!rows.length) return null;
  const counts: Record<string, number> = {};
  rows.forEach((r) => { if (r.topCluster) counts[r.topCluster] = (counts[r.topCluster] ?? 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
