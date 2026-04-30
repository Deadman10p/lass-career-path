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
  { value: 1, label: "Strongly Disagree", short: "SD", tone: "bg-rate-1 hover:bg-rate-1 text-white border-rate-1" },
  { value: 2, label: "Disagree", short: "D", tone: "bg-rate-2 hover:bg-rate-2 text-white border-rate-2" },
  { value: 3, label: "Neutral", short: "N", tone: "bg-rate-3 hover:bg-rate-3 text-white border-rate-3" },
  { value: 4, label: "Agree", short: "A", tone: "bg-rate-4 hover:bg-rate-4 text-white border-rate-4" },
  { value: 5, label: "Strongly Agree", short: "SA", tone: "bg-rate-5 hover:bg-rate-5 text-white border-rate-5" },
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
      const [d, cs] = await Promise.all([fetchFullQuestionnaire(id), fetchClusters(id)]);
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
        {/* Sweeping curtain reveal */}
        <motion.div
          aria-hidden
          initial={{ scaleY: 1 }}
          animate={{ scaleY: 0 }}
          transition={{ duration: 0.9, ease: [0.83, 0, 0.17, 1], delay: 0.05 }}
          style={{ transformOrigin: "top" }}
          className="absolute inset-0 z-10 gradient-student"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-student/15 blur-3xl animate-float" />
          <div className="absolute bottom-0 right-0 h-[360px] w-[360px] rounded-full bg-brand-red/10 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-20 mx-auto max-w-xl px-6 text-center"
        >
          <motion.div
            initial={{ opacity: 0, letterSpacing: "0.4em" }}
            animate={{ opacity: 1, letterSpacing: "0.22em" }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="text-[11px] font-semibold uppercase text-student"
          >
            Section {flat[pendingTransitionFrom + 1].sectionIndex + 1} · Up next
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.85 }}
            className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
          >
            {next.sectionTitle}
          </motion.h2>
          {next.sectionDesc && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base"
            >
              {next.sectionDesc}
            </motion.p>
          )}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.15 }}
          >
            <Button onClick={continueAfterTransition} size="lg" className="mt-7 gradient-student text-student-foreground border-0 shadow-glow">
              Continue <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
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

  // question stage — full-screen immersive
  const selected = answers[current.q.id];

  return (
    <div className="relative flex min-h-screen flex-col bg-gradient-to-b from-background via-student-soft/40 to-background overflow-hidden">
      {/* Decorative animated backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-student/10 blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-brand-red/10 blur-3xl animate-float" style={{ animationDelay: "1.2s" }} />
      </div>

      {/* Top bar: progress + section + exit */}
      <div className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-5 py-3 sm:px-8">
          <button
            onClick={() => navigate("/student/dashboard")}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Exit questionnaire"
          >
            ← Exit
          </button>
          <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-student sm:block">
            {current.sectionTitle}
          </div>
          <div className="flex flex-1 items-center gap-3">
            <Progress value={progress} className="h-1.5 flex-1" />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {idx + 1} / {total}
            </span>
          </div>
        </div>
      </div>

      {/* Question fills the screen */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={current.q.id}
            custom={direction}
            initial={{ opacity: 0, y: direction * 60, scale: 0.96, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: direction * -60, scale: 0.96, filter: "blur(8px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto flex w-full max-w-3xl flex-col items-center text-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-student sm:hidden"
            >
              {current.sectionTitle}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.45 }}
              className="text-xs font-medium tabular-nums text-muted-foreground"
            >
              Question {idx + 1}
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="mt-3 font-display text-3xl font-semibold leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              {current.q.statement}
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.5 }}
              className="mt-10 grid w-full max-w-2xl grid-cols-5 gap-2 sm:gap-3"
            >
              {RATINGS.map((r, i) => {
                const isPicked = selected === r.value;
                return (
                  <motion.button
                    key={r.value}
                    onClick={() => handlePick(r.value)}
                    aria-label={`${r.value} - ${r.label}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 + i * 0.05, duration: 0.35 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 transition-all sm:p-4",
                      isPicked
                        ? `${r.tone} scale-105 shadow-glow`
                        : "border-border bg-card/80 backdrop-blur hover:border-foreground/30"
                    )}
                  >
                    <span className={cn("text-2xl font-bold sm:text-3xl md:text-4xl", isPicked ? "text-white" : "text-foreground")}>
                      {r.value}
                    </span>
                    <span className={cn("hidden text-center text-[10px] leading-tight sm:block", isPicked ? "text-white/90" : "text-muted-foreground")}>
                      {r.label}
                    </span>
                    <span className={cn("text-center text-[10px] leading-tight sm:hidden", isPicked ? "text-white/90" : "text-muted-foreground")}>
                      {r.short}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="mt-6 flex w-full max-w-2xl items-center justify-between"
            >
              <Button variant="ghost" size="sm" onClick={goPrev} disabled={idx === 0}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <span className="text-xs text-muted-foreground">
                {selected ? "Auto-advancing…" : "Pick an option"}
              </span>
              <Button variant="ghost" size="sm" onClick={goNext} disabled={!selected}>
                {idx === total - 1 ? "Submit" : "Next"} <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
