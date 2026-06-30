import { useEffect, useMemo, useRef, useState } from "react";
import { ReportSkin } from "@/components/ReportSkin";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchClusters,
  fetchActiveClusterIdsForQuestionnaire,
  fetchFullQuestionnaire,
  getProfileData,
} from "@/lib/api";
import type { CareerCluster, FullQuestionnaire } from "@/lib/types";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { Sparkles, Trophy, TrendingUp, TrendingDown } from "lucide-react";

interface ResultRow {
  career_cluster_id: string;
  total_score: number;
}

function toneFromHex(hex?: string): "blue" | "red" | "green" | "amber" | "purple" {
  if (!hex) return "blue";
  const m = hex.replace("#", "");
  if (m.length < 6) return "blue";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if (r > g && r > b && r - b > 40) return "red";
  if (g > r && g > b) return "green";
  if (r > 180 && g > 140 && b < 120) return "amber";
  if (b > r && b > g && r > 80 && r > 60) return "purple";
  return "blue";
}

export interface StudentReportPDFMeta {
  studentName: string;
  className: string | null;
  stream: string | null;
  questionnaireTitle: string;
  submittedAt: string;
}

interface Props {
  responseId: string;
  /** Called once the report has fully rendered (data fetched, fonts/charts mounted). */
  onReady: (node: HTMLDivElement, meta: StudentReportPDFMeta) => void;
  /** Called when the report cannot be rendered (no data, fetch error, etc.). */
  onError?: (err: string) => void;
}

/**
 * Off-screen, deterministic renderer for a student's report — produces the
 * same visible blocks the student PDF download captures, but without any
 * animations or buttons. Used by SetterResults to bulk-export PDFs into a ZIP.
 */
export default function StudentReportPDFView({ responseId, onReady, onError }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [doc, setDoc] = useState<FullQuestionnaire | null>(null);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [insight, setInsight] = useState<any>(null);
  const [meta, setMeta] = useState<StudentReportPDFMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: resp } = await supabase
          .from("responses")
          .select("*")
          .eq("id", responseId)
          .maybeSingle();
        if (!resp) {
          if (!cancelled) onError?.("Response not found");
          return;
        }
        const [d, cs, { data: rs }, activeSet, { data: ins }, { data: prof }] =
          await Promise.all([
            fetchFullQuestionnaire(resp.questionnaire_id),
            fetchClusters(resp.questionnaire_id),
            supabase.from("results").select("*").eq("response_id", responseId),
            fetchActiveClusterIdsForQuestionnaire(resp.questionnaire_id),
            supabase
              .from("response_insights")
              .select("*")
              .eq("response_id", responseId)
              .maybeSingle(),
            supabase
              .from("profiles")
              .select("full_name, class_name, stream")
              .eq("user_id", resp.student_id)
              .maybeSingle(),
          ]);
        if (cancelled) return;
        setDoc(d);
        setClusters(cs);
        setResults((rs ?? []) as ResultRow[]);
        setActiveIds(activeSet);
        setInsight((ins as any)?.summary ?? null);
        setMeta({
          studentName: (prof as any)?.full_name ?? "Student",
          className: (prof as any)?.class_name ?? null,
          stream: (prof as any)?.stream ?? null,
          questionnaireTitle: d?.title ?? "Inventory",
          submittedAt: resp.submitted_at,
        });
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) onError?.(e?.message ?? "Failed to load report");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [responseId, onError]);

  const ranked = useMemo(() => {
    if (!clusters.length) return [];
    const arr = clusters
      .filter((c) => activeIds.has(c.id))
      .map((c) => {
        const r = results.find((x) => x.career_cluster_id === c.id);
        return { cluster: c, total: r?.total_score ?? 0, percent: 0 };
      })
      .sort((a, b) => b.total - a.total);
    const maxTotal = Math.max(...arr.map((r) => r.total), 1);
    return arr.map((r) => ({ ...r, percent: Math.round((r.total / maxTotal) * 100) }));
  }, [clusters, results, activeIds]);

  const totalPoints = useMemo(
    () => ranked.reduce((s, r) => s + r.total, 0),
    [ranked],
  );

  // Once everything is rendered, give recharts/fonts a couple of frames to settle, then signal ready.
  useEffect(() => {
    if (loading || !ranked.length || !meta || !printRef.current) return;
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      if (cancelled) return;
      await document.fonts?.ready;
      // Two RAFs for layout + Recharts ResponsiveContainer to size itself.
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (cancelled || !printRef.current) return;
      onReady(printRef.current, meta);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [loading, ranked, meta, onReady]);

  if (loading || !ranked.length || !meta) return null;

  const top = ranked[0];
  const strengths = ranked.slice(0, 2);
  const growth = ranked.length > 2 ? ranked.slice(-2).reverse() : [];
  const radarData = ranked.map((r) => ({
    cluster: r.cluster.name.length > 16 ? r.cluster.name.slice(0, 14) + "…" : r.cluster.name,
    value: r.percent,
  }));

  return (
    <ReportSkin style={(doc as any)?.report_style} dominantColor={top.cluster.color_hex}>
      <div ref={printRef} className="space-y-6 bg-background p-6" style={{ width: 880 }}>
        <section
          data-pdf-section
          className="lass-hero-navy relative overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14 shadow-elevated"
        >
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
              <Trophy className="h-3.5 w-3.5" /> {doc?.title ?? "Inventory"} · Results
            </div>
            <h1 className="mt-3 font-serif-display text-4xl font-semibold leading-tight sm:text-5xl">
              {meta.studentName.split(" ")[0] || "Student"}, your profile is ready.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              A clear, schema-driven picture of your strengths, your growth edges, and what to explore next.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="lass-glow-badge inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[hsl(var(--brand-red))]" />
                <span className="font-serif-display text-lg leading-none">{totalPoints}</span>
                <span className="text-[11px] uppercase tracking-widest text-[hsl(var(--brand-blue))]/70">
                  total points
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
                <span className="text-base">{top.cluster.icon_emoji}</span>
                <span>Top match · {top.cluster.name}</span>
              </div>
            </div>
          </div>
        </section>

        <section data-pdf-section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-blue))]">
              <TrendingUp className="h-4 w-4" /> Strength analysis
            </div>
            <ul className="space-y-4">
              {strengths.map((r, i) => (
                <li key={r.cluster.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-serif-display text-lg">
                      {i + 1}. {r.cluster.icon_emoji} {r.cluster.name}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {r.total} pts
                    </span>
                  </div>
                  <div className="lass-bar-track">
                    <div
                      className="lass-bar-fill"
                      data-tone={toneFromHex(r.cluster.color_hex)}
                      style={{ width: `${r.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {growth.length > 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-red))]">
                <TrendingDown className="h-4 w-4" /> Areas for growth
              </div>
              <ul className="space-y-4">
                {growth.map((r) => (
                  <li key={r.cluster.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="font-serif-display text-lg">
                        {r.cluster.icon_emoji} {r.cluster.name}
                      </span>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {r.total} pts
                      </span>
                    </div>
                    <div className="lass-bar-track">
                      <div
                        className="lass-bar-fill"
                        data-tone="red"
                        style={{ width: `${r.percent}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
              Not enough categories in this inventory to compute growth areas yet.
            </div>
          )}
        </section>

        <section data-pdf-section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="mb-1 font-serif-display text-2xl">Your profile shape</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Built from {ranked.length} active categor{ranked.length === 1 ? "y" : "ies"} in this
            inventory.
          </p>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="cluster"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#1B3A6B" fill="#4A90D9" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {(() => {
          const aiAttrs = insight?.by_cluster?.[top.cluster.id] as
            | Record<string, string>
            | undefined;
          const data = getProfileData(top.cluster, aiAttrs);
          if (!data.length) return null;
          return (
            <section data-pdf-section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="font-serif-display text-2xl">Insights stack</h3>
                  <p className="text-xs text-muted-foreground">
                    Personalised cards drawn from your strongest category.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{top.cluster.name}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((d, i) => (
                  <article
                    key={`${d.label}-${i}`}
                    className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
                  >
                    <div className="relative">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">
                        {d.label}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{d.content}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })()}

        {ranked.length > 1 && (() => {
          const second = ranked[1];
          const aiAttrs = insight?.by_cluster?.[second.cluster.id] as Record<string, string> | undefined;
          const data = getProfileData(second.cluster, aiAttrs);
          if (!data.length) return null;
          return (
            <section data-pdf-section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="font-serif-display text-2xl">Secondary category</h3>
                  <p className="text-xs text-muted-foreground">
                    Where your interests also pull — a real, weighted part of your profile.
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {second.cluster.icon_emoji} {second.cluster.name}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((d, i) => (
                  <article
                    key={`sec-${d.label}-${i}`}
                    className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
                  >
                    <div className="relative">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-red))]">
                        {d.label}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{d.content}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })()}

        {insight?.combined && ranked.length > 1 && (
          <section
            data-pdf-section
            className="rounded-2xl border border-[hsl(var(--brand-red))]/25 bg-[hsl(var(--brand-blue))]/5 p-6 shadow-card"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">
              <Sparkles className="h-3.5 w-3.5" /> Combined perspective
              <span className="text-muted-foreground/80 normal-case tracking-normal font-normal">
                · {ranked[0].cluster.name} × {ranked[1].cluster.name}
              </span>
            </div>
            <p className="font-serif-display text-base leading-relaxed text-foreground/90">
              {insight.combined}
            </p>
          </section>
        )}

        {insight?.overview && (
          <section
            data-pdf-section
            className="rounded-2xl border border-[hsl(var(--brand-blue))]/25 bg-[hsl(var(--brand-blue))]/5 p-6 shadow-card"
          >
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">
              <Sparkles className="h-3.5 w-3.5" /> Personalised summary
            </div>
            <p className="font-serif-display text-lg leading-relaxed italic text-foreground/90">
              "{insight.overview}"
            </p>
          </section>
        )}

        <div data-pdf-section className="text-center text-xs text-muted-foreground">
          Generated {new Date(meta.submittedAt).toLocaleString()} · {meta.studentName}
          {meta.className ? ` · ${meta.className}` : ""}
          {meta.stream ? ` · ${meta.stream}` : ""}
        </div>
      </div>
    </ReportSkin>
  );
}
