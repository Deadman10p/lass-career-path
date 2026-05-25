import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import StudentShell from "@/components/student/StudentShell";
import { ReportSkin } from "@/components/ReportSkin";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, RotateCcw, ArrowLeft, Sparkles, Trophy, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchClusters, fetchActiveClusterIdsForQuestionnaire, fetchFullQuestionnaire, getProfileData } from "@/lib/api";
import type { CareerCluster, FullQuestionnaire } from "@/lib/types";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";

interface ResultRow { career_cluster_id: string; total_score: number }
interface Ranked { cluster: CareerCluster; total: number; percent: number }

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function toneFromHex(hex?: string): "blue" | "red" | "green" | "amber" | "purple" {
  if (!hex) return "blue";
  const h = hex.toLowerCase();
  if (/^#?(d|e|f|c)/.test(h.replace("#", "")[0] ?? "")) {
    // Heuristic: warm reds/ambers vs cool
  }
  // simple HSL parse
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

export default function ResultsPage() {
  const { responseId = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [doc, setDoc] = useState<FullQuestionnaire | null>(null);
  const [questionnaireId, setQuestionnaireId] = useState<string>("");
  const [submittedAt, setSubmittedAt] = useState<string>("");
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [insight, setInsight] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: resp } = await supabase.from("responses").select("*").eq("id", responseId).maybeSingle();
      if (!resp) { setLoading(false); return; }
      setQuestionnaireId(resp.questionnaire_id);
      setSubmittedAt(resp.submitted_at);
      const [d, cs, { data: rs }, activeSet, { data: ins }] = await Promise.all([
        fetchFullQuestionnaire(resp.questionnaire_id),
        fetchClusters(resp.questionnaire_id),
        supabase.from("results").select("*").eq("response_id", responseId),
        fetchActiveClusterIdsForQuestionnaire(resp.questionnaire_id),
        supabase.from("response_insights").select("*").eq("response_id", responseId).maybeSingle(),
      ]);
      setDoc(d);
      setClusters(cs);
      setResults((rs ?? []) as ResultRow[]);
      setActiveIds(activeSet);
      setInsight(ins?.summary ?? null);
      setLoading(false);
    })();
  }, [responseId]);

  const ranked: Ranked[] = useMemo(() => {
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

  const totalPoints = useMemo(() => ranked.reduce((s, r) => s + r.total, 0), [ranked]);

  useEffect(() => {
    if (!loading && ranked.length) {
      const t = setTimeout(() => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.3 } });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [loading, ranked.length]);

  const downloadPdf = async () => {
    if (!printRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `lass-results-${(profile?.full_name ?? "student").replace(/\s+/g, "-")}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(printRef.current).save();
  };

  if (loading) {
    return <StudentShell><Skeleton className="h-96 w-full rounded-2xl" /></StudentShell>;
  }
  if (!ranked.length) {
    return <StudentShell><div className="rounded-2xl border border-border bg-card p-6 text-center">No results found.</div></StudentShell>;
  }

  const top = ranked[0];
  const strengths = ranked.slice(0, 2);
  const growth = ranked.length > 2 ? ranked.slice(-2).reverse() : [];
  const radarData = ranked.map((r) => ({ cluster: r.cluster.name.length > 16 ? r.cluster.name.slice(0, 14) + "…" : r.cluster.name, value: r.percent }));

  return (
    <StudentShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/student/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/student/questionnaire/${questionnaireId}/take`)}><RotateCcw className="mr-1 h-4 w-4" /> Retake</Button>
          <Button size="sm" onClick={downloadPdf} className="gradient-student text-student-foreground border-0 shadow-glow"><Download className="mr-1 h-4 w-4" /> Download PDF</Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-6">
        {/* HERO — premium navy */}
        <section className="lass-hero-navy lass-fade-up relative overflow-hidden rounded-[28px] px-6 py-10 sm:px-12 sm:py-14 shadow-elevated">
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
              <Trophy className="h-3.5 w-3.5" /> {doc?.title ?? "Inventory"} · Results
            </div>
            <h1 className="mt-3 font-serif-display text-4xl font-semibold leading-tight sm:text-5xl">
              {profile?.full_name?.split(" ")[0] || "Student"}, your profile is ready.
            </h1>
            <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              A clear, schema-driven picture of your strengths, your growth edges, and what to explore next.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="lass-glow-badge inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[hsl(var(--brand-red))]" />
                <span className="font-serif-display text-lg leading-none">{totalPoints}</span>
                <span className="text-[11px] uppercase tracking-widest text-[hsl(var(--brand-blue))]/70">total points</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/5 px-3 py-1.5 text-xs text-white/85 backdrop-blur">
                <span className="text-base">{top.cluster.icon_emoji}</span>
                <span>Top match · {top.cluster.name}</span>
              </div>
            </div>
          </div>

          {/* Floating top-cluster medallion */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="pointer-events-none absolute right-6 top-6 hidden h-32 w-32 items-center justify-center rounded-full bg-white/10 text-5xl shadow-[0_18px_50px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/20 backdrop-blur sm:flex"
            aria-hidden
          >
            {top.cluster.icon_emoji}
          </motion.div>
        </section>

        {/* STRENGTH / GROWTH PANELS */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="lass-fade-up-2 rounded-2xl border border-border bg-card p-6 shadow-card">
            <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-blue))]">
              <TrendingUp className="h-4 w-4" /> Strength analysis
            </div>
            <ul className="space-y-4">
              {strengths.map((r, i) => (
                <li key={r.cluster.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="font-serif-display text-lg">{i + 1}. {r.cluster.icon_emoji} {r.cluster.name}</span>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.total} pts</span>
                  </div>
                  <div className="lass-bar-track">
                    <div className="lass-bar-fill" data-tone={toneFromHex(r.cluster.color_hex)} style={{ width: `${r.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {growth.length > 0 ? (
            <div className="lass-fade-up-3 rounded-2xl border border-border bg-card p-6 shadow-card">
              <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[hsl(var(--brand-red))]">
                <TrendingDown className="h-4 w-4" /> Areas for growth
              </div>
              <ul className="space-y-4">
                {growth.map((r) => (
                  <li key={r.cluster.id}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="font-serif-display text-lg">{r.cluster.icon_emoji} {r.cluster.name}</span>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.total} pts</span>
                    </div>
                    <div className="lass-bar-track">
                      <div className="lass-bar-fill" data-tone="red" style={{ width: `${r.percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="lass-fade-up-3 rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-sm text-muted-foreground">
              Not enough categories in this inventory to compute growth areas yet.
            </div>
          )}
        </section>

        {/* RADAR — only active clusters */}
        <section className="lass-fade-up-3 rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="mb-1 font-serif-display text-2xl">Your profile shape</h3>
          <p className="mb-4 text-xs text-muted-foreground">Built from {ranked.length} active categor{ranked.length === 1 ? "y" : "ies"} in this inventory.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="cluster" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="#1B3A6B" fill="#4A90D9" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* INSIGHTS STACK — schema-driven cards from profile_data of TOP cluster */}
        {(() => {
          const aiAttrs = insight?.by_cluster?.[top.cluster.id] as Record<string, string> | undefined;
          const data = getProfileData(top.cluster, aiAttrs);
          if (!data.length) return null;
          return (
            <section className="lass-fade-up-4 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="font-serif-display text-2xl">Insights stack</h3>
                  <p className="text-xs text-muted-foreground">Personalised cards drawn from your strongest category.</p>
                </div>
                <span className="text-xs text-muted-foreground">{top.cluster.name}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.map((d, i) => (
                  <motion.article
                    key={`${d.label}-${i}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.5 }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elevated"
                  >
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[hsl(var(--brand-blue))]/8 blur-2xl transition-opacity group-hover:opacity-80" />
                    <div className="relative">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]">{d.label}</div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{d.content}</p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </section>
          );
        })()}

        {insight?.overview && (
          <section className="lass-fade-up-4 rounded-2xl border border-[hsl(var(--brand-blue))]/25 bg-[hsl(var(--brand-blue))]/5 p-6 shadow-card">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--brand-blue))]"><Sparkles className="h-3.5 w-3.5" /> Personalised summary</div>
            <p className="font-serif-display text-lg leading-relaxed italic text-foreground/90">"{insight.overview}"</p>
          </section>
        )}

        {/* ALL CATEGORIES with custom bars */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h3 className="mb-4 font-serif-display text-2xl">All categories ranked</h3>
          <ul className="space-y-4">
            {ranked.map((r, i) => (
              <li key={r.cluster.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 text-xs font-semibold tabular-nums text-muted-foreground">#{i + 1}</span>
                    <span className="text-xl">{r.cluster.icon_emoji}</span>
                    <span className="truncate font-medium">{r.cluster.name}</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.total} pts · {r.percent}%</span>
                </div>
                <div className="lass-bar-track">
                  <div className="lass-bar-fill" data-tone={toneFromHex(r.cluster.color_hex)} style={{ width: `${r.percent}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* LETTERED SECTIONS — debiased headers */}
        {doc && doc.sections.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h3 className="mb-4 font-serif-display text-2xl">Inventory map</h3>
            <ol className="space-y-3">
              {doc.sections.map((sec, i) => (
                <li key={sec.id} className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4">
                  <span className="lass-section-letter shrink-0">{LETTERS[i] ?? i + 1}</span>
                  <div className="min-w-0">
                    <div className="font-serif-display text-base">Section {LETTERS[i] ?? i + 1}</div>
                    {sec.description && <div className="mt-0.5 text-xs text-muted-foreground">{sec.description}</div>}
                    <div className="mt-1 text-[11px] text-muted-foreground">{sec.questions.length} statement{sec.questions.length === 1 ? "" : "s"}</div>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[11px] text-muted-foreground">Section names are intentionally hidden as letters to prevent answer bias.</p>
          </section>
        )}

        <div className="text-center text-xs text-muted-foreground print:mt-4">
          Generated {submittedAt ? new Date(submittedAt).toLocaleString() : ""} · {profile?.full_name} {profile?.class_name ? `· ${profile.class_name}` : ""}
        </div>
      </div>
    </StudentShell>
  );
}
