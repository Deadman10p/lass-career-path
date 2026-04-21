import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchClusters, fetchFullQuestionnaire } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { computeScores } from "@/lib/scoring";
import type { CareerCluster, FullQuestionnaire, QuestionWithWeights } from "@/lib/types";
import { cn } from "@/lib/utils";

type Stage = "intro" | "question" | "section-transition" | "submitting";

const RATINGS = [
  { value: 1, label: "Strongly Disagree", short: "SD", tone: "bg-rating-1 hover:bg-rating-1 text-white border-rating-1" },
  { value: 2, label: "Disagree", short: "D", tone: "bg-rating-2 hover:bg-rating-2 text-white border-rating-2" },
  { value: 3, label: "Neutral", short: "N", tone: "bg-rating-3 hover:bg-rating-3 text-white border-rating-3" },
  { value: 4, label: "Agree", short: "A", tone: "bg-rating-4 hover:bg-rating-4 text-white border-rating-4" },
  { value: 5, label: "Strongly Agree", short: "SA", tone: "bg-rating-5 hover:bg-rating-5 text-white border-rating-5" },
];

interface FlatItem { sectionIndex: number; sectionTitle: string; sectionDesc: string; q: QuestionWithWeights }

export default function QuestionnaireTake() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [doc, setDoc] = useState<FullQuestionnaire | null>(null);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [direction, setDirection] = useState(1);
  const [pendingTransitionFrom, setPendingTransitionFrom] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [d, cs] = await Promise.all([fetchFullQuestionnaire(id), fetchClusters()]);
      setDoc(d);
      setClusters(cs);
      setLoading(false);
    })();
  }, [id]);

  const flat: FlatItem[] = useMemo(() => {
    if (!doc) return [];
    return doc.sections.flatMap((s, si) =>
      s.questions.map((q) => ({ sectionIndex: si, sectionTitle: s.title, sectionDesc: s.description, q }))
    );
  }, [doc]);

  const total = flat.length;
  const current = flat[idx];
  const progress = total > 0 ? Math.round(((idx + (answers[current?.q.id] ? 1 : 0)) / total) * 100) : 0;

  const handlePick = (val: number) => {
    if (!current) return;
    setAnswers((a) => ({ ...a, [current.q.id]: val }));
    // Auto-advance after 280ms
    setTimeout(() => goNext(), 280);
  };

  const goNext = () => {
    if (idx >= total - 1) {
      submit();
      return;
    }
    const next = flat[idx + 1];
    if (next.sectionIndex !== current.sectionIndex) {
      setPendingTransitionFrom(idx);
      setStage("section-transition");
      return;
    }
    setDirection(1);
    setIdx((i) => i + 1);
  };

  const goPrev = () => {
    if (idx === 0) return;
    setDirection(-1);
    setIdx((i) => i - 1);
  };

  const continueAfterTransition = () => {
    setDirection(1);
    setIdx((i) => i + 1);
    setStage("question");
    setPendingTransitionFrom(null);
  };

  const submit = async () => {
    if (!doc || !user) return;
    if (Object.keys(answers).length < total) {
      toast.error("Please answer every question first.");
      return;
    }
    setStage("submitting");
    try {
      // 1) Insert response
      const { data: resp, error: rErr } = await supabase
        .from("responses")
        .insert({ student_id: user.id, questionnaire_id: doc.id })
        .select().single();
      if (rErr) throw rErr;

      // 2) Insert answers
      const ansRows = Object.entries(answers).map(([qid, rating]) => ({ response_id: resp.id, question_id: qid, rating }));
      const { error: aErr } = await supabase.from("answers").insert(ansRows);
      if (aErr) throw aErr;

      // 3) Compute and persist results
      const ranked = computeScores(doc.sections, answers, clusters);
      const resRows = ranked.map((r) => ({ response_id: resp.id, career_cluster_id: r.cluster.id, total_score: r.total }));
      const { error: resErr } = await supabase.from("results").insert(resRows);
      if (resErr) throw resErr;

      navigate(`/student/results/${resp.id}`);
    } catch (e: any) {
      toast.error(e.message || "Couldn't submit. Try again.");
      setStage("question");
    }
  };

  if (loading) {
    return <PageShell tone="student" title="Student Portal"><Skeleton className="h-72 w-full rounded-2xl" /></PageShell>;
  }
  if (!doc) {
    return <PageShell tone="student" title="Student Portal"><div className="rounded-2xl border border-border bg-card p-6 text-center">Questionnaire not found.</div></PageShell>;
  }
  if (total === 0) {
    return <PageShell tone="student" title="Student Portal"><div className="rounded-2xl border border-border bg-card p-6 text-center">This questionnaire has no questions yet.</div></PageShell>;
  }

  // ---- Stages ----
  if (stage === "intro") {
    return (
      <PageShell tone="student" title="Student Portal">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
            <div className="gradient-student p-8 text-student-foreground sm:p-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <Sparkles className="h-6 w-6" />
              </div>
              <h1 className="mt-4 font-display text-3xl font-semibold sm:text-4xl">{doc.title}</h1>
              {doc.description && <p className="mt-2 text-sm opacity-90 sm:text-base">{doc.description}</p>}
              <div className="mt-5 flex flex-wrap gap-2 text-xs opacity-90">
                <span className="rounded-full bg-white/20 px-3 py-1">{total} questions</span>
                <span className="rounded-full bg-white/20 px-3 py-1">~{Math.max(1, Math.ceil(total / 5))} min</span>
                <span className="rounded-full bg-white/20 px-3 py-1">{doc.sections.length} sections</span>
              </div>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <div>
                <h2 className="font-display text-lg font-semibold">How it works</h2>
                <p className="mt-1 text-sm text-muted-foreground">For each statement, rate how much you agree on a scale of 1 to 5. Be honest — there are no right or wrong answers.</p>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {RATINGS.map((r) => (
                  <div key={r.value} className={cn("flex flex-col items-center gap-1 rounded-lg p-2 text-center text-xs", r.tone)}>
                    <span className="text-lg font-bold">{r.value}</span>
                    <span className="hidden text-[10px] leading-tight sm:block">{r.label}</span>
                    <span className="text-[10px] leading-tight sm:hidden">{r.short}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => setStage("question")} size="lg" className="w-full gradient-student border-0 text-student-foreground shadow-glow">
                Begin <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate("/student/dashboard")}>
                Cancel
              </Button>
            </div>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  if (stage === "section-transition" && pendingTransitionFrom !== null) {
    const next = flat[pendingTransitionFrom + 1];
    return (
      <PageShell tone="student" title="Student Portal">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}>
          <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-elevated sm:p-12">
            <div className="text-xs uppercase tracking-widest text-student">Up next</div>
            <h2 className="mt-3 font-display text-3xl font-semibold">{next.sectionTitle}</h2>
            {next.sectionDesc && <p className="mt-2 text-sm text-muted-foreground">{next.sectionDesc}</p>}
            <Button onClick={continueAfterTransition} size="lg" className="mt-6 gradient-student text-student-foreground border-0 shadow-glow">
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </PageShell>
    );
  }

  if (stage === "submitting") {
    return (
      <PageShell tone="student" title="Student Portal">
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl border border-border bg-card p-12 text-center shadow-elevated">
          <Loader2 className="h-10 w-10 animate-spin text-student" />
          <h2 className="font-display text-xl font-semibold">Crunching the numbers…</h2>
          <p className="text-sm text-muted-foreground">Building your career profile.</p>
        </div>
      </PageShell>
    );
  }

  // question stage
  const selected = answers[current.q.id];

  return (
    <PageShell tone="student" title="Student Portal">
      <div className="mx-auto max-w-2xl">
        {/* Progress */}
        <div className="mb-4 flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{idx + 1} / {total}</span>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elevated">
          <div className="border-b border-border bg-secondary/40 px-5 py-3 text-xs uppercase tracking-widest text-muted-foreground">
            {current.sectionTitle}
          </div>
          <div className="relative min-h-[280px] p-6 sm:p-8">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={current.q.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={{ duration: 0.25 }}
              >
                <h2 className="font-display text-xl font-semibold leading-snug sm:text-2xl">
                  {current.q.statement}
                </h2>

                <div className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-2">
                  {RATINGS.map((r) => {
                    const isPicked = selected === r.value;
                    return (
                      <button
                        key={r.value}
                        onClick={() => handlePick(r.value)}
                        aria-label={`${r.value} - ${r.label}`}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border-2 p-3 transition-all sm:p-4",
                          isPicked ? `${r.tone} scale-105 shadow-glow` : "border-border bg-secondary/30 hover:scale-[1.03] hover:border-foreground/20"
                        )}
                      >
                        <span className={cn("text-2xl font-bold sm:text-3xl", isPicked ? "text-white" : "text-foreground")}>{r.value}</span>
                        <span className={cn("hidden text-center text-[10px] leading-tight sm:block", isPicked ? "text-white/90" : "text-muted-foreground")}>{r.label}</span>
                        <span className={cn("text-center text-[10px] leading-tight sm:hidden", isPicked ? "text-white/90" : "text-muted-foreground")}>{r.short}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-between border-t border-border p-3">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={idx === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <span className="text-xs text-muted-foreground">{selected ? "Auto-advancing…" : "Pick an option"}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={goNext}
              disabled={!selected}
            >
              {idx === total - 1 ? "Submit" : "Next"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
