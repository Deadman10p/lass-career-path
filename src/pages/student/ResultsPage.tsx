import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Download, RotateCcw, ArrowLeft, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchClusters } from "@/lib/api";
import { generateInsights, type ClusterScore } from "@/lib/scoring";
import type { CareerCluster } from "@/lib/types";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

interface ResultRow { career_cluster_id: string; total_score: number }

export default function ResultsPage() {
  const { responseId = "" } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [questionnaireId, setQuestionnaireId] = useState<string>("");
  const [submittedAt, setSubmittedAt] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [cs, { data: resp }, { data: rs }] = await Promise.all([
        fetchClusters(questionnaireId || undefined),
        supabase.from("responses").select("*").eq("id", responseId).maybeSingle(),
        supabase.from("results").select("*").eq("response_id", responseId),
      ]);
      setClusters(cs);
      setResults((rs ?? []) as ResultRow[]);
      if (resp) {
        setQuestionnaireId(resp.questionnaire_id);
        setSubmittedAt(resp.submitted_at);
      }
      setLoading(false);
    })();
  }, [responseId]);

  const ranked: ClusterScore[] = useMemo(() => {
    if (!clusters.length || !results.length) return [];
    // Compute max possible per cluster from current weights
    return clusters
      .map((c) => {
        const r = results.find((x) => x.career_cluster_id === c.id);
        const total = r?.total_score ?? 0;
        return { cluster: c, total, max: 0, percent: 0 };
      })
      .sort((a, b) => b.total - a.total);
  }, [clusters, results]);

  // Normalise so the top cluster = 100%, others relative to it (for visual)
  const ranked100 = useMemo(() => {
    if (!ranked.length) return [];
    const maxTotal = Math.max(...ranked.map((r) => r.total), 1);
    return ranked.map((r) => ({ ...r, percent: Math.round((r.total / maxTotal) * 100) }));
  }, [ranked]);

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
    return <PageShell tone="student" title="Student Portal"><Skeleton className="h-96 w-full rounded-2xl" /></PageShell>;
  }
  if (!ranked.length) {
    return <PageShell tone="student" title="Student Portal"><div className="rounded-2xl border border-border bg-card p-6 text-center">No results found.</div></PageShell>;
  }

  const top = ranked100[0];
  const insights = generateInsights(ranked100);
  const radarData = ranked100.map((r) => ({ cluster: r.cluster.name.split(" & ")[0], value: r.percent, full: 100 }));
  const barData = ranked100.map((r) => ({ name: r.cluster.name, score: r.total, color: r.cluster.color_hex }));

  return (
    <PageShell tone="student" title="Student Portal">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate("/student/dashboard")}><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/student/questionnaire/${questionnaireId}/take`)}><RotateCcw className="mr-1 h-4 w-4" /> Retake</Button>
          <Button size="sm" onClick={downloadPdf} className="gradient-student text-student-foreground border-0 shadow-glow"><Download className="mr-1 h-4 w-4" /> Download PDF</Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-5">
        {/* HERO */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="overflow-hidden rounded-3xl gradient-celebration p-8 shadow-elevated sm:p-12">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-student">
            <Trophy className="h-4 w-4" /> Your top match
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
            Your Results are Ready, {profile?.full_name?.split(" ")[0] || "Student"}!
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-5xl">{top.cluster.icon_emoji}</span>
            <div>
              <div className="text-xs text-muted-foreground">Strongest category</div>
              <div className="font-display text-2xl font-semibold">{top.cluster.name}</div>
            </div>
          </div>
        </motion.div>

        {/* TOP CLUSTER CARD */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
          className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Where you stand out</h2>
            <Badge className="bg-success text-white">{top.total} pts</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{top.cluster.description}</p>
          {top.cluster.possible_careers?.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Suggested next steps</div>
              <div className="flex flex-wrap gap-2">
                {top.cluster.possible_careers.map((career) => (
                  <span key={career} className="rounded-full bg-student/10 px-3 py-1 text-xs font-medium text-student">{career}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* CHARTS */}
        <div className="grid gap-4 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-display font-semibold">Your profile shape</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="cluster" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--student))" fill="hsl(var(--student))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}
            className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-display font-semibold">Score per category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]} fill="hsl(var(--student))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* INSIGHTS */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          className="grid gap-3 sm:grid-cols-3">
          {insights.map((ins, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <Sparkles className="h-5 w-5 text-student" />
              <p className="mt-2 text-sm text-foreground/90">{ins}</p>
            </div>
          ))}
        </motion.div>

        {/* RANKED LIST */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}
          className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border p-5">
            <h3 className="font-display text-lg font-semibold">All categories ranked</h3>
            <p className="text-xs text-muted-foreground">Tap any to see suggested next steps.</p>
          </div>
          <Accordion type="single" collapsible className="px-2 pb-2">
            {ranked100.map((r, i) => (
              <AccordionItem key={r.cluster.id} value={r.cluster.id} className="border-border">
                <AccordionTrigger className="px-3 hover:no-underline">
                  <div className="flex w-full items-center gap-3 pr-4">
                    <span className="w-6 text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    <span className="text-2xl">{r.cluster.icon_emoji}</span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium">{r.cluster.name}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-student" style={{ width: `${r.percent}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.total} pts</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-4 pt-1">
                  <p className="text-sm text-muted-foreground">{r.cluster.description}</p>
                  {r.cluster.possible_careers?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.cluster.possible_careers.slice(0, 8).map((c) => (
                        <span key={c} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{c}</span>
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>

        <div className="text-center text-xs text-muted-foreground print:mt-4">
          Generated {submittedAt ? new Date(submittedAt).toLocaleString() : ""} · {profile?.full_name} {profile?.class_name ? `· ${profile.class_name}` : ""}
        </div>
      </div>
    </PageShell>
  );
}
