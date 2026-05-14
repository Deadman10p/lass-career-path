import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown, BookOpen, ScrollText, Compass } from "lucide-react";
import StudentShell from "@/components/student/StudentShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getProfileData } from "@/lib/api";
import type { CareerCluster, ProfileDatum } from "@/lib/types";

interface InvEntry {
  responseId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  submittedAt: string;
  topCluster?: CareerCluster;
  topScore: number;
  ranked: { cluster: CareerCluster; total: number }[];
  data: ProfileDatum[];
  aiOverview?: string;
}

export default function StudentOverall() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<InvEntry[]>([]);
  const [general, setGeneral] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: gp } = await supabase.from("general_profiles").select("*").eq("student_id", user.id).maybeSingle();
      setGeneral(gp?.summary ?? null);

      const { data: responses } = await supabase
        .from("responses").select("*").eq("student_id", user.id).order("submitted_at", { ascending: false });
      const respIds = (responses ?? []).map((r) => r.id);

      const [{ data: results }, { data: insights }, { data: questionnaires }] = await Promise.all([
        respIds.length ? supabase.from("results").select("*").in("response_id", respIds) : Promise.resolve({ data: [] as any[] }),
        respIds.length ? supabase.from("response_insights").select("*").in("response_id", respIds) : Promise.resolve({ data: [] as any[] }),
        supabase.from("questionnaires").select("id, title"),
      ]);
      const titleMap = new Map((questionnaires ?? []).map((q: any) => [q.id, q.title]));
      const clusterIds = Array.from(new Set((results ?? []).map((r: any) => r.career_cluster_id)));
      const { data: clusters } = clusterIds.length
        ? await supabase.from("career_clusters").select("*").in("id", clusterIds)
        : { data: [] as any[] };
      const cmap = new Map<string, CareerCluster>((clusters ?? []).map((c: any) => [c.id, c as CareerCluster]));

      const out: InvEntry[] = [];
      for (const r of responses ?? []) {
        const rs = (results ?? []).filter((x: any) => x.response_id === r.id)
          .map((x: any) => ({ cluster: cmap.get(x.career_cluster_id)!, total: x.total_score }))
          .filter((x) => !!x.cluster).sort((a, b) => b.total - a.total);
        const top = rs[0];
        const ins = (insights ?? []).find((x: any) => x.response_id === r.id);
        const aiByCluster = ins?.summary?.by_cluster ?? {};
        const data = top ? getProfileData(top.cluster, aiByCluster[top.cluster.id]) : [];
        out.push({
          responseId: r.id,
          questionnaireId: r.questionnaire_id,
          questionnaireTitle: titleMap.get(r.questionnaire_id) ?? "Inventory",
          submittedAt: r.submitted_at,
          topCluster: top?.cluster,
          topScore: top?.total ?? 0,
          ranked: rs,
          data,
          aiOverview: ins?.summary?.overview,
        });
      }
      setEntries(out);
      setLoading(false);
    })();
  }, [user]);

  // Cross-inventory aggregate
  const aggregate = useMemo(() => {
    const m = new Map<string, { cluster: CareerCluster; total: number; appearances: number }>();
    for (const e of entries) for (const r of e.ranked) {
      const cur = m.get(r.cluster.id) ?? { cluster: r.cluster, total: 0, appearances: 0 };
      cur.total += r.total; cur.appearances += 1; m.set(r.cluster.id, cur);
    }
    const arr = Array.from(m.values()).sort((a, b) => b.total - a.total);
    return { strengths: arr.slice(0, 3), growth: arr.length > 3 ? arr.slice(-3).reverse() : [] };
  }, [entries]);

  const aggregatedInsights = useMemo(() => {
    const items: { entry: InvEntry; datum: ProfileDatum }[] = [];
    for (const e of entries) for (const d of e.data) items.push({ entry: e, datum: d });
    return items;
  }, [entries]);

  return (
    <StudentShell>
      {loading ? <Skeleton className="h-64 w-full rounded-2xl" /> : (
        <div className="space-y-8">
          {/* Hero */}
          <section className="lass-hero-navy lass-fade-up relative overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14 shadow-elevated">
            <div className="relative z-10 max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
                <Compass className="h-3.5 w-3.5" /> Overall personal profile
              </div>
              <h1 className="mt-3 font-serif-display text-3xl font-semibold leading-tight sm:text-5xl text-white">
                {profile?.full_name ?? "Your"} growth record
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
                A unified picture stitched from {entries.length} inventor{entries.length === 1 ? "y" : "ies"} you've completed —
                where your strengths repeat, where your edges live, and how your different sides fit together.
              </p>
            </div>
          </section>

          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-10 text-center text-sm text-muted-foreground">
              Complete an inventory to start building your overall profile.
              <div className="mt-4"><Button asChild><Link to="/student/questionnaires">Browse inventories</Link></Button></div>
            </div>
          ) : (
            <>
              {/* Strengths / Growth */}
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="lass-fade-up-2 rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-blue))]">
                    <TrendingUp className="h-4 w-4" /> Repeating strengths
                  </div>
                  <ul className="space-y-3">
                    {aggregate.strengths.map((a, i) => {
                      const max = aggregate.strengths[0].total || 1;
                      const pct = Math.round((a.total / max) * 100);
                      return (
                        <li key={a.cluster.id}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="font-serif-display text-base">{i + 1}. {a.cluster.icon_emoji} {a.cluster.name}</span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{a.total} pts · seen {a.appearances}×</span>
                          </div>
                          <div className="lass-bar-track"><div className="lass-bar-fill" style={{ width: `${pct}%` }} /></div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {aggregate.growth.length > 0 && (
                  <div className="lass-fade-up-3 rounded-2xl border border-border bg-card p-6 shadow-card">
                    <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-red))]">
                      <TrendingDown className="h-4 w-4" /> Areas to develop
                    </div>
                    <ul className="space-y-3">
                      {aggregate.growth.map((a) => {
                        const max = aggregate.strengths[0].total || 1;
                        const pct = Math.round((a.total / max) * 100);
                        return (
                          <li key={a.cluster.id}>
                            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                              <span className="font-serif-display text-base">{a.cluster.icon_emoji} {a.cluster.name}</span>
                              <span className="text-[11px] tabular-nums text-muted-foreground">{a.total} pts · seen {a.appearances}×</span>
                            </div>
                            <div className="lass-bar-track"><div className="lass-bar-fill" data-tone="red" style={{ width: `${pct}%` }} /></div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </section>

              {/* Cross-inventory alignments (AI) */}
              {Array.isArray(general?.alignments) && general.alignments.length > 0 && (
                <section className="rounded-2xl border border-[hsl(var(--brand-blue))]/25 bg-[hsl(var(--brand-blue))]/5 p-6 shadow-card">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">
                    <Sparkles className="h-3.5 w-3.5" /> How your inventories speak to each other
                  </div>
                  <ul className="space-y-2">
                    {general.alignments.map((a: string, i: number) => (
                      <li key={i} className="font-serif-display text-base leading-relaxed text-foreground/90">— {a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Insight feed */}
              <section className="space-y-3">
                <div className="flex items-end justify-between">
                  <h2 className="font-serif-display text-2xl">Insight feed</h2>
                  <span className="text-xs text-muted-foreground">{aggregatedInsights.length} card{aggregatedInsights.length === 1 ? "" : "s"}</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {aggregatedInsights.map((f, i) => (
                    <motion.article
                      key={`${f.entry.responseId}-${f.datum.label}-${i}`}
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated"
                    >
                      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[hsl(var(--brand-blue))]/8 blur-2xl" />
                      <div className="relative">
                        <Badge variant="secondary" className="mb-2 text-[10px]">{f.entry.questionnaireTitle}</Badge>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">{f.datum.label}</div>
                        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{f.datum.content}</p>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </section>

              {/* Per-inventory snapshots */}
              <section className="rounded-2xl border border-border bg-card shadow-card">
                <div className="border-b border-border p-5 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-serif-display text-2xl">Inventories on file</h2>
                </div>
                <ul className="divide-y divide-border">
                  {entries.map((e) => (
                    <li key={e.responseId} className="p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-serif-display text-lg">{e.questionnaireTitle}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(e.submittedAt).toLocaleString()}{e.topCluster ? ` · top: ${e.topCluster.icon_emoji} ${e.topCluster.name} (${e.topScore} pts)` : ""}
                          </div>
                          {e.aiOverview && <p className="mt-2 line-clamp-2 font-serif-display italic text-foreground/85">"{e.aiOverview}"</p>}
                        </div>
                        <Button asChild size="sm" variant="outline"><Link to={`/student/results/${e.responseId}`}>Open profile</Link></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1.5 w-full">
                <ScrollText className="h-3 w-3" /> Updated automatically as you complete inventories.
              </div>
            </>
          )}
        </div>
      )}
    </StudentShell>
  );
}
