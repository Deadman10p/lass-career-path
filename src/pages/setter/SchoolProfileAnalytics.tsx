import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GP {
  student_id: string;
  inventories_count: number;
  summary: any;
  full_name?: string;
  class_name?: string | null;
  stream?: string | null;
}

export default function SchoolProfileAnalytics() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GP[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: gps } = await supabase.from("general_profiles").select("*");
      const ids = (gps ?? []).map((g: any) => g.student_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("user_id, full_name, class_name, stream").in("user_id", ids)
        : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      setRows((gps ?? []).map((g: any) => ({ ...g, ...(pmap.get(g.student_id) ?? {}) })));
      setLoading(false);
    })();
  }, []);

  const aggregate = (key: "strengths" | "weaknesses" | "growth" | "alignments") => {
    const counts: Record<string, number> = {};
    rows.forEach(r => (r.summary?.[key] ?? []).forEach((s: string) => {
      const k = s.trim();
      if (k) counts[k] = (counts[k] ?? 0) + 1;
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  };

  const topStrengths = aggregate("strengths");
  const topWeaknesses = aggregate("weaknesses");
  const topAlignments = aggregate("alignments");

  return (
    <PageShell tone="setter" title="Counsellor Portal">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div>
          <Button asChild variant="ghost" size="sm"><Link to="/setter/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link></Button>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">School-Wide Profile Analytics</h1>
          <p className="text-sm text-muted-foreground">Aggregated AI insights across every inventory each student has taken.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Stat icon={<Users className="h-4 w-4" />} label="Students with profiles" value={rows.length} loading={loading} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Total inventories taken" value={rows.reduce((s, r) => s + (r.inventories_count ?? 0), 0)} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ListCard title="Most common strengths" items={topStrengths} loading={loading} />
        <ListCard title="Most common weaknesses" items={topWeaknesses} loading={loading} />
        <ListCard title="Cross-inventory alignments" items={topAlignments} loading={loading} icon={<Sparkles className="h-4 w-4 text-setter" />} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-5"><h2 className="font-display text-lg font-semibold">Per-student profiles</h2></div>
        {loading ? <div className="p-5"><Skeleton className="h-32 w-full" /></div> : !rows.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No general profiles yet — students need to complete an inventory first.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(r => (
              <li key={r.student_id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{r.full_name ?? "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{r.class_name ?? "—"} · {r.stream ?? "—"} · {r.inventories_count} inventor{r.inventories_count === 1 ? "y" : "ies"}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(r.summary?.alignments ?? []).slice(0, 2).map((a: string, i: number) => (
                    <Badge key={i} variant="secondary" className="max-w-xs truncate">{a}</Badge>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

function Stat({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: number; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-setter text-setter-foreground">{icon}</div>
        {label}
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <div className="mt-3 font-display text-2xl font-semibold">{value}</div>}
    </div>
  );
}

function ListCard({ title, items, loading, icon }: { title: string; items: [string, number][]; loading?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex items-center gap-2 font-display font-semibold">{icon}{title}</div>
      {loading ? <Skeleton className="h-32 w-full" /> : !items.length ? (
        <div className="text-sm text-muted-foreground">No data yet.</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map(([label, n]) => (
            <li key={label} className="flex items-start justify-between gap-2 text-sm">
              <span className="flex-1">{label}</span>
              <Badge variant="secondary" className="shrink-0">{n}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
