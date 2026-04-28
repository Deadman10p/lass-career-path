import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ArrowLeft, Trophy, User as UserIcon, Calendar, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchClusters, fetchFullQuestionnaire } from "@/lib/api";
import { generateInsights } from "@/lib/scoring";
import type { CareerCluster, FullQuestionnaire } from "@/lib/types";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
} from "recharts";

interface ResultRow { career_cluster_id: string; total_score: number }
interface AnswerRow { question_id: string; rating: number }

export default function SetterStudentReport() {
  const { responseId = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [doc, setDoc] = useState<FullQuestionnaire | null>(null);
  const [student, setStudent] = useState<{ full_name: string; class_name: string | null; stream: string | null } | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: resp } = await supabase.from("responses").select("*").eq("id", responseId).maybeSingle();
      if (!resp) { setLoading(false); return; }
      setSubmittedAt(resp.submitted_at);

      const [d, cs, { data: rs }, { data: ans }, { data: prof }] = await Promise.all([
        fetchFullQuestionnaire(resp.questionnaire_id),
        fetchClusters(resp.questionnaire_id),
        supabase.from("results").select("*").eq("response_id", responseId),
        supabase.from("answers").select("*").eq("response_id", responseId),
        supabase.from("profiles").select("full_name, class_name, stream").eq("user_id", resp.student_id).maybeSingle(),
      ]);
      setDoc(d);
      setClusters(cs);
      setResults((rs ?? []) as ResultRow[]);
      setAnswers((ans ?? []) as AnswerRow[]);
      setStudent(prof as any);
      setLoading(false);
    })();
  }, [responseId]);

  const ranked = useMemo(() => {
    if (!clusters.length) return [];
    const arr = clusters.map(c => {
      const r = results.find(x => x.career_cluster_id === c.id);
      return { cluster: c, total: r?.total_score ?? 0, max: 0, percent: 0 };
    }).sort((a, b) => b.total - a.total);
    const maxTotal = Math.max(...arr.map(r => r.total), 1);
    return arr.map(r => ({ ...r, percent: Math.round((r.total / maxTotal) * 100) }));
  }, [clusters, results]);

  const ratingByQ = useMemo(() => {
    const m = new Map<string, number>();
    answers.forEach(a => m.set(a.question_id, a.rating));
    return m;
  }, [answers]);

  if (loading) return <PageShell tone="setter" title="Counsellor Portal"><Skeleton className="h-96 w-full rounded-2xl" /></PageShell>;
  if (!ranked.length) return <PageShell tone="setter" title="Counsellor Portal"><div className="rounded-2xl border border-border bg-card p-6 text-center">No data found for this response.</div></PageShell>;

  const top = ranked[0];
  const insights = generateInsights(ranked);
  const radarData = ranked.map(r => ({ cluster: r.cluster.name.split(" & ")[0], value: r.percent }));
  const barData = ranked.map(r => ({ name: r.cluster.name, score: r.total }));
  const ratingLabel = (n: number) => ["", "Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"][n] || "—";

  return (
    <PageShell tone="setter" title="Counsellor Portal">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1 h-4 w-4" /> Back</Button>
      </div>

      <div className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl gradient-setter p-8 text-setter-foreground shadow-glow">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-90">
            <ClipboardList className="h-4 w-4" /> Detailed student report
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{student?.full_name ?? "Student"}</h1>
          <div className="mt-2 flex flex-wrap gap-3 text-sm opacity-90">
            <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {student?.class_name ?? "—"} · {student?.stream ?? "—"}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(submittedAt).toLocaleString()}</span>
            <span>· {doc?.title ?? ""}</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-3 rounded-xl bg-white/15 px-4 py-2 backdrop-blur">
            <Trophy className="h-5 w-5" />
            <div>
              <div className="text-[11px] uppercase tracking-widest opacity-80">Strongest category</div>
              <div className="font-display text-lg font-semibold">{top.cluster.icon_emoji} {top.cluster.name} · {top.total} pts</div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-display font-semibold">Profile shape</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="cluster" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="hsl(var(--setter))" fill="hsl(var(--setter))" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 font-display font-semibold">Score per category</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="score" radius={[0, 8, 8, 0]} fill="hsl(var(--setter))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {insights.map((ins, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <p className="text-sm text-foreground/90">{ins}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border p-5">
            <h3 className="font-display text-lg font-semibold">All categories ranked</h3>
          </div>
          <Accordion type="single" collapsible className="px-2 pb-2">
            {ranked.map((r, i) => (
              <AccordionItem key={r.cluster.id} value={r.cluster.id} className="border-border">
                <AccordionTrigger className="px-3 hover:no-underline">
                  <div className="flex w-full items-center gap-3 pr-4">
                    <span className="w-6 text-xs font-semibold text-muted-foreground">#{i + 1}</span>
                    <span className="text-2xl">{r.cluster.icon_emoji}</span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium">{r.cluster.name}</div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-setter" style={{ width: `${r.percent}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{r.total} pts</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-4 pt-1">
                  <p className="text-sm text-muted-foreground">{r.cluster.description}</p>
                  {r.cluster.possible_careers?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.cluster.possible_careers.slice(0, 12).map(c => <span key={c} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{c}</span>)}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Per-question answers */}
        {doc && (
          <div className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border p-5">
              <h3 className="font-display text-lg font-semibold">Every answer</h3>
              <p className="text-xs text-muted-foreground">Section by section, exactly what the student picked.</p>
            </div>
            <div className="divide-y divide-border">
              {doc.sections.map(sec => (
                <div key={sec.id} className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="secondary">{sec.title}</Badge>
                    <span className="text-xs text-muted-foreground">{sec.questions.length} questions</span>
                  </div>
                  <ul className="space-y-1.5">
                    {sec.questions.map((q, i) => {
                      const r = ratingByQ.get(q.id) ?? 0;
                      return (
                        <li key={q.id} className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-2.5 text-sm">
                          <span className="w-6 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                          <span className="flex-1">{q.statement || <em className="text-muted-foreground">(empty)</em>}</span>
                          <Badge className={r >= 4 ? "bg-success text-white" : r === 3 ? "" : r >= 1 ? "bg-destructive/20 text-destructive" : ""} variant={r === 3 ? "secondary" : "default"}>
                            {r ? `${r} · ${ratingLabel(r)}` : "—"}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
