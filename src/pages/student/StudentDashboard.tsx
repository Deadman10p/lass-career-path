import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageShell } from "@/components/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Clock, FileQuestion, Sparkles, Trophy } from "lucide-react";
import type { Questionnaire } from "@/lib/types";

interface QItem extends Questionnaire {
  questionCount: number;
  hasResponse?: { id: string; submitted_at: string };
}

export default function StudentDashboard() {
  const { profile, user } = useAuth();
  const [list, setList] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
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
          if (rs && rs[0]) hasResponse = rs[0];
        }
        items.push({ ...(q as Questionnaire), questionCount: count, hasResponse });
      }
      setList(items);
      setLoading(false);
    };
    load();
  }, [user]);

  return (
    <PageShell tone="student" title="Student Portal">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-8">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">
            Hello {profile?.full_name?.split(" ")[0] || "there"}! <span className="text-gradient-primary">Ready to discover your path?</span>
          </h1>
          <p className="mt-2 text-base text-muted-foreground">Pick an inventory below to begin. It only takes a few minutes.</p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">{[0,1].map(i => <Skeleton key={i} className="h-44 w-full rounded-2xl" />)}</div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {list.map((q, idx) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated">
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full gradient-student opacity-15 blur-2xl transition-opacity group-hover:opacity-30" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-xl font-semibold">{q.title}</h3>
                      {q.hasResponse && (
                        <Badge className="bg-success text-white"><Trophy className="mr-1 h-3 w-3" /> Completed</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{q.description || "Discover the careers that match who you are."}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {q.questionCount} questions</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{Math.max(1, Math.ceil(q.questionCount / 5))} min</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button asChild className="gradient-student text-student-foreground border-0">
                        <Link to={`/student/questionnaire/${q.id}/take`}>{q.hasResponse ? "Retake" : "Begin"} <ArrowRight className="ml-1 h-4 w-4" /></Link>
                      </Button>
                      {q.hasResponse && (
                        <Button asChild variant="outline">
                          <Link to={`/student/results/${q.hasResponse.id}`}>View results</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-student text-student-foreground shadow-glow">
        <Sparkles className="h-7 w-7" />
      </div>
      <h3 className="font-display text-lg font-semibold">No questionnaires yet</h3>
      <p className="max-w-sm text-sm text-muted-foreground">Your teacher hasn't published an inventory yet. Check back soon!</p>
    </div>
  );
}
