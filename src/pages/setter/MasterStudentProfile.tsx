import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Sparkles, Filter, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getProfileData } from "@/lib/api";
import type { CareerCluster, ProfileDatum } from "@/lib/types";

interface ClusterScoreLite { cluster: CareerCluster; total: number }
interface InventoryEntry {
  responseId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  submittedAt: string;
  ranked: ClusterScoreLite[];
  topCluster?: CareerCluster;
  topScore: number;
  data: ProfileDatum[];
  aiOverview?: string;
}

function inferKind(title: string): string {
  const t = title.toLowerCase();
  if (/(personality|temperament|big[-\s]?five|mbti|disc)/.test(t)) return "Personality";
  if (/(career|holland|interest|riasec|aptitude)/.test(t)) return "Career";
  if (/(learning|study|vark)/.test(t)) return "Learning";
  if (/(values|motivation)/.test(t)) return "Values";
  return "General";
}

export default function MasterStudentProfile() {
  const { studentId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [filter, setFilter] = useState<string>("All");

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

      const clusterIds = Array.from(new Set((results ?? []).map((r: any) => r.career_cluster_id)));
      const { data: clusters } = clusterIds.length
        ? await supabase.from("career_clusters").select("*").in("id", clusterIds)
        : { data: [] as any[] };
      const cmap = new Map<string, CareerCluster>((clusters ?? []).map((c: any) => [c.id, c as CareerCluster]));

      const out: InventoryEntry[] = [];
      for (const r of responses ?? []) {
        const rs = (results ?? []).filter((x: any) => x.response_id === r.id)
          .map((x: any) => ({ cluster: cmap.get(x.career_cluster_id)!, total: x.total_score }))
          .filter((x) => !!x.cluster)
          .sort((a, b) => b.total - a.total);
        const top = rs[0];
        const ins = (insights ?? []).find((x: any) => x.response_id === r.id);
        const aiByCluster = ins?.summary?.by_cluster ?? {};
        const data = top ? getProfileData(top.cluster, aiByCluster[top.cluster.id]) : [];
        out.push({
          responseId: r.id,
          questionnaireId: r.questionnaire_id,
          questionnaireTitle: titleMap.get(r.questionnaire_id) ?? "Inventory",
          submittedAt: r.submitted_at,
          ranked: rs,
          topCluster: top?.cluster,
          topScore: top?.total ?? 0,
          data,
          aiOverview: ins?.summary?.overview,
        });
      }
      setEntries(out);
      setLoading(false);
    })();
  }, [studentId]);

  const kinds = useMemo(() => {
    const set = new Set<string>(["All"]);
    entries.forEach((e) => set.add(inferKind(e.questionnaireTitle)));
    return Array.from(set);
  }, [entries]);

  const filtered = useMemo(
    () => filter === "All" ? entries : entries.filter((e) => inferKind(e.questionnaireTitle) === filter),
    [entries, filter],
  );

  // Aggregate insight feed: every profile_data card across filtered tests
  const feed = useMemo(() => {
    const items: { entry: InventoryEntry; datum: ProfileDatum }[] = [];
    for (const e of filtered) for (const d of e.data) items.push({ entry: e, datum: d });
    return items;
  }, [filtered]);

  // Cross-test top strengths / growth (sum totals per cluster)
  const aggregate = useMemo(() => {
    const m = new Map<string, { cluster: CareerCluster; total: number; appearances: number }>();
    for (const e of filtered) {
      for (const r of e.ranked) {
        const cur = m.get(r.cluster.id) ?? { cluster: r.cluster, total: 0, appearances: 0 };
        cur.total += r.total;
        cur.appearances += 1;
        m.set(r.cluster.id, cur);
      }
    }
    const arr = Array.from(m.values()).sort((a, b) => b.total - a.total);
    return { strengths: arr.slice(0, 3), growth: arr.length > 3 ? arr.slice(-3).reverse() : [] };
  }, [filtered]);

  const totalPoints = useMemo(() => filtered.reduce((s, e) => s + e.topScore, 0), [filtered]);

  return (
    <PageShell tone="setter" title="Counsellor Portal">
      <div className="mb-5 flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link to="/setter/school-profile"><ArrowLeft className="mr-1 h-4 w-4" /> School profiles</Link></Button>
      </div>

      {loading ? <Skeleton className="h-64 w-full rounded-2xl" /> : (
        <div className="space-y-6">
          {/* HERO */}
          <section className="lass-hero-navy lass-fade-up relative overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14 shadow-elevated">
            <div className="relative z-10 max-w-3xl">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
                <BookOpen className="h-3.5 w-3.5" /> Master student profile
              </div>
              <h1 className="mt-3 font-serif-display text-4xl font-semibold leading-tight sm:text-5xl">{student?.full_name ?? "Student"}</h1>
              <div className="mt-2 text-sm text-white/80">{student?.class_name ?? "—"} · {student?.stream ?? "—"} · {entries.length} inventor{entries.length === 1 ? "y" : "ies"} on record</div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="lass-glow-badge inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[hsl(var(--brand-red))]" />
                  <span className="font-serif-display text-lg leading-none">{totalPoints}</span>
                  <span className="text-[11px] uppercase tracking-widest text-[hsl(var(--brand-blue))]/70">aggregated pts</span>
                </div>
              </div>
            </div>
          </section>

          {/* FILTER */}
          <div className="lass-fade-up-2 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
            <span className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Filter by test type</span>
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={[
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
                  filter === k
                    ? "bg-[hsl(var(--brand-blue))] text-white shadow-md"
                    : "bg-secondary text-foreground/70 hover:bg-secondary/70",
                ].join(" ")}
              >
                {k}
              </button>
            ))}
          </div>

          {/* CROSS-TEST STRENGTHS / GROWTH */}
          {(aggregate.strengths.length > 0) && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="lass-fade-up-2 rounded-2xl border border-border bg-card p-6 shadow-card">
                <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-blue))]">
                  <TrendingUp className="h-4 w-4" /> Cross-test strengths
                </div>
                <ul className="space-y-3">
                  {aggregate.strengths.map((a, i) => {
                    const max = aggregate.strengths[0].total || 1;
                    const pct = Math.round((a.total / max) * 100);
                    return (
                      <li key={a.cluster.id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <span className="font-serif-display text-base">{i + 1}. {a.cluster.icon_emoji} {a.cluster.name}</span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{a.total} pts · {a.appearances}×</span>
                        </div>
                        <div className="lass-bar-track">
                          <div className="lass-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {aggregate.growth.length > 0 && (
                <div className="lass-fade-up-3 rounded-2xl border border-border bg-card p-6 shadow-card">
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-red))]">
                    <TrendingDown className="h-4 w-4" /> Areas for growth
                  </div>
                  <ul className="space-y-3">
                    {aggregate.growth.map((a) => {
                      const max = aggregate.strengths[0].total || 1;
                      const pct = Math.round((a.total / max) * 100);
                      return (
                        <li key={a.cluster.id}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="font-serif-display text-base">{a.cluster.icon_emoji} {a.cluster.name}</span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{a.total} pts · {a.appearances}×</span>
                          </div>
                          <div className="lass-bar-track">
                            <div className="lass-bar-fill" data-tone="red" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* AGGREGATED INSIGHT FEED */}
          <section className="lass-fade-up-3 space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="font-serif-display text-2xl">Insight feed</h2>
              <span className="text-xs text-muted-foreground">{feed.length} card{feed.length === 1 ? "" : "s"} · {filter}</span>
            </div>
            {feed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                No insights captured for this filter yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {feed.map((f, i) => (
                  <motion.article
                    key={`${f.entry.responseId}-${f.datum.label}-${i}`}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.45 }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated"
                  >
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[hsl(var(--brand-blue))]/8 blur-2xl" />
                    <div className="relative">
                      <Badge variant="secondary" className="mb-2 text-[10px]">{inferKind(f.entry.questionnaireTitle)}</Badge>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">{f.datum.label}</div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{f.datum.content}</p>
                      <div className="mt-3 text-[11px] text-muted-foreground">{f.entry.questionnaireTitle}</div>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </section>

          {/* PER-INVENTORY SNAPSHOTS */}
          <section className="lass-fade-up-4 rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border p-5"><h2 className="font-serif-display text-2xl">Per-inventory snapshots</h2></div>
            {!filtered.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Nothing matches the current filter.</div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((e) => (
                  <li key={e.responseId} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-serif-display text-lg">{e.questionnaireTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(e.submittedAt).toLocaleString()} · top: {e.topCluster?.icon_emoji} {e.topCluster?.name ?? "—"} ({e.topScore} pts)
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline"><Link to={`/setter/response/${e.responseId}`}>Open report</Link></Button>
                    </div>
                    {e.aiOverview && <p className="mt-2 font-serif-display italic text-foreground/85">"{e.aiOverview}"</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
