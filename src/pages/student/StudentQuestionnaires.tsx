import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileQuestion, Trophy, Clock, ListChecks } from "lucide-react";
import StudentShell from "@/components/student/StudentShell";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Questionnaire } from "@/lib/types";

interface QItem extends Questionnaire {
  questionCount: number;
  hasResponse?: { id: string; submitted_at: string };
}

const TABS = ["All", "Taken", "Not taken"] as const;
type Tab = typeof TABS[number];

export default function StudentQuestionnaires() {
  const { user } = useAuth();
  const [list, setList] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("All");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: qs } = await supabase
        .from("questionnaires").select("*").eq("is_published", true).order("created_at", { ascending: false });
      const items: QItem[] = [];
      for (const q of qs ?? []) {
        const { data: secs } = await supabase.from("sections").select("id").eq("questionnaire_id", q.id);
        const sIds = (secs ?? []).map((s) => s.id);
        let count = 0;
        if (sIds.length) {
          const { count: c } = await supabase.from("questions").select("id", { head: true, count: "exact" }).in("section_id", sIds);
          count = c ?? 0;
        }
        let hasResponse: QItem["hasResponse"];
        if (user) {
          const { data: rs } = await supabase
            .from("responses").select("id, submitted_at").eq("student_id", user.id).eq("questionnaire_id", q.id)
            .order("submitted_at", { ascending: false }).limit(1);
          if (rs?.[0]) hasResponse = rs[0];
        }
        items.push({ ...(q as Questionnaire), questionCount: count, hasResponse });
      }
      setList(items);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    if (tab === "Taken") return list.filter((q) => q.hasResponse);
    if (tab === "Not taken") return list.filter((q) => !q.hasResponse);
    return list;
  }, [list, tab]);

  return (
    <StudentShell>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5" /> Questionnaires
        </div>
        <h1 className="mt-2 font-serif-display text-3xl font-semibold sm:text-4xl">All inventories</h1>
        <p className="mt-1 text-sm text-muted-foreground">Take a new one or revisit something you've already completed.</p>
      </div>

      <div className="mb-5 inline-flex rounded-full border border-border bg-card p-1 shadow-card">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
              tab === t ? "bg-[hsl(var(--brand-blue))] text-white shadow-sm" : "text-foreground/70 hover:text-foreground",
            ].join(" ")}
          >{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
          Nothing to show in this view.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((q, i) => (
            <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated">
                <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full ${q.hasResponse ? "bg-[hsl(var(--brand-blue))]/8" : "bg-[hsl(var(--brand-red))]/8"} blur-2xl`} />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif-display text-2xl leading-tight">{q.title}</h3>
                    {q.hasResponse && <Badge className="bg-success text-white"><Trophy className="mr-1 h-3 w-3" /> Done</Badge>}
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{q.description || "Discover the categories that match who you are."}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {q.questionCount} questions</span>
                    <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{Math.max(1, Math.ceil(q.questionCount / 5))} min</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" className="gradient-student text-student-foreground border-0">
                      <Link to={`/student/questionnaire/${q.id}/take`}>{q.hasResponse ? "Retake" : "Begin"} <ArrowRight className="ml-1 h-4 w-4" /></Link>
                    </Button>
                    {q.hasResponse && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/student/results/${q.hasResponse.id}`}>View profile</Link>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </StudentShell>
  );
}
