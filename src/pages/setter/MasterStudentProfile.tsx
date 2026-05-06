import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfileData } from "@/lib/api";
import type { CareerCluster, ProfileDatum } from "@/lib/types";

interface InventoryEntry {
  responseId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  submittedAt: string;
  topCluster?: CareerCluster;
  topScore: number;
  data: ProfileDatum[];
  aiOverview?: string;
}

export default function MasterStudentProfile() {
  const { studentId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [grouped, setGrouped] = useState<Record<string, ProfileDatum[]>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles").select("full_name, class_name, stream").eq("user_id", studentId).maybeSingle();
      setStudent(prof);

      const { data: responses } = await supabase
        .from("responses").select("*").eq("student_id", studentId).order("submitted_at", { ascending: false });
      const respIds = (responses ?? []).map((r: any) => r.id);

      const [{ data: results }, { data: insights }, { data: questionnaires }] = await Promise.all([
        respIds.length ? supabase.from("results").select("*").in("response_id", respIds) : Promise.resolve({ data: [] as any[] }),
        respIds.length ? supabase.from("response_insights").select("*").in("response_id", respIds) : Promise.resolve({ data: [] as any[] }),
        supabase.from("questionnaires").select("id, title"),
      ]);
      const titleMap = new Map((questionnaires ?? []).map((q: any) => [q.id, q.title]));

      // collect cluster ids
      const clusterIds = Array.from(new Set((results ?? []).map((r: any) => r.career_cluster_id)));
      const { data: clusters } = clusterIds.length
        ? await supabase.from("career_clusters").select("*").in("id", clusterIds)
        : { data: [] as any[] };
      const cmap = new Map<string, CareerCluster>((clusters ?? []).map((c: any) => [c.id, c as CareerCluster]));

      const labelMap: Record<string, ProfileDatum[]> = {};
      const out: InventoryEntry[] = [];

      for (const r of responses ?? []) {
        const rs = (results ?? []).filter((x: any) => x.response_id === r.id)
          .sort((a: any, b: any) => b.total_score - a.total_score);
        const top = rs[0];
        const ins = (insights ?? []).find((x: any) => x.response_id === r.id);
        const aiByCluster = ins?.summary?.by_cluster ?? {};
        const cluster = top ? cmap.get(top.career_cluster_id) : undefined;
        const data = cluster ? getProfileData(cluster, aiByCluster[cluster.id]) : [];

        for (const d of data) {
          if (!labelMap[d.label]) labelMap[d.label] = [];
          labelMap[d.label].push({ label: cluster?.name ?? "", content: d.content });
        }

        out.push({
          responseId: r.id,
          questionnaireId: r.questionnaire_id,
          questionnaireTitle: titleMap.get(r.questionnaire_id) ?? "Inventory",
          submittedAt: r.submitted_at,
          topCluster: cluster,
          topScore: top?.total_score ?? 0,
          data,
          aiOverview: ins?.summary?.overview,
        });
      }
      setEntries(out);
      setGrouped(labelMap);
      setLoading(false);
    })();
  }, [studentId]);

  return (
    <PageShell tone="setter" title="Counsellor Portal">
      <div className="mb-5 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/setter/school-profile"><ArrowLeft className="mr-1 h-4 w-4" /> School profiles</Link></Button>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-2xl" /> : (
        <>
          <div className="mb-6 rounded-3xl gradient-setter p-8 text-setter-foreground shadow-glow">
            <div className="text-xs uppercase tracking-widest opacity-90 flex items-center gap-2"><BookOpen className="h-4 w-4" /> Master student profile</div>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{student?.full_name ?? "Student"}</h1>
            <div className="mt-1 text-sm opacity-90">{student?.class_name ?? "—"} · {student?.stream ?? "—"} · {entries.length} inventor{entries.length === 1 ? "y" : "ies"}</div>
          </div>

          {/* GROWTH RECORD: dynamic labels aggregated across all inventories */}
          {!!Object.keys(grouped).length && (
            <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2 font-display font-semibold"><Sparkles className="h-4 w-4 text-setter" /> Growth Record</div>
              <div className="grid gap-4 lg:grid-cols-2">
                {Object.entries(grouped).map(([label, items]) => (
                  <div key={label} className="rounded-xl border border-border bg-secondary/30 p-4">
                    <div className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</div>
                    <ul className="space-y-2 text-sm">
                      {items.map((it, i) => (
                        <li key={i} className="leading-snug">
                          <Badge variant="secondary" className="mr-2 align-middle">{it.label}</Badge>
                          <span>{it.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border p-5"><h2 className="font-display text-lg font-semibold">Per-inventory snapshots</h2></div>
            {!entries.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">This student hasn't completed any inventories yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {entries.map(e => (
                  <li key={e.responseId} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-display font-semibold">{e.questionnaireTitle}</div>
                        <div className="text-xs text-muted-foreground">{new Date(e.submittedAt).toLocaleString()} · top: {e.topCluster?.icon_emoji} {e.topCluster?.name ?? "—"} ({e.topScore} pts)</div>
                      </div>
                      <Button asChild size="sm" variant="outline"><Link to={`/setter/response/${e.responseId}`}>Open report</Link></Button>
                    </div>
                    {e.aiOverview && <p className="mt-2 text-sm text-foreground/90">{e.aiOverview}</p>}
                    {!!e.data.length && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {e.data.map((d, i) => (
                          <div key={`${d.label}-${i}`} className="rounded-lg border border-border bg-secondary/30 p-3">
                            <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{d.label}</div>
                            <p className="mt-1 text-xs">{d.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
