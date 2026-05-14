import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileQuestion, Sparkles, Trophy, Clock, ScrollText, ListChecks } from "lucide-react";
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
  topClusterName?: string;
  topClusterEmoji?: string;
  aiOverview?: string;
}

export default function StudentDashboard() {
  const { profile, user } = useAuth();
  const [list, setList] = useState<QItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        let item: QItem = { ...(q as Questionnaire), questionCount: count };
        if (user) {
          const { data: rs } = await supabase
            .from("responses").select("id, submitted_at").eq("student_id", user.id).eq("questionnaire_id", q.id)
            .order("submitted_at", { ascending: false }).limit(1);
          const r = rs?.[0];
          if (r) {
            item.hasResponse = r;
            // top cluster + AI overview
            const [{ data: results }, { data: ins }] = await Promise.all([
              supabase.from("results").select("career_cluster_id, total_score").eq("response_id", r.id).order("total_score", { ascending: false }).limit(1),
              supabase.from("response_insights").select("summary").eq("response_id", r.id).maybeSingle(),
            ]);
            if (results?.[0]) {
              const { data: cc } = await supabase.from("career_clusters").select("name, icon_emoji").eq("id", results[0].career_cluster_id).maybeSingle();
              item.topClusterName = cc?.name;
              item.topClusterEmoji = cc?.icon_emoji;
            }
            item.aiOverview = (ins?.summary as any)?.overview;
          }
        }
        items.push(item);
      }
      setList(items);
      setLoading(false);
    })();
  }, [user]);

  const completed = useMemo(() => list.filter((q) => q.hasResponse), [list]);
  const newOnes = useMemo(() => list.filter((q) => !q.hasResponse), [list]);

  return (
    <StudentShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {/* Hero greeting */}
        <section className="lass-hero-navy lass-fade-up relative mb-8 overflow-hidden rounded-[28px] px-6 py-9 sm:px-10 sm:py-12 shadow-elevated">
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/70">
              <Sparkles className="h-3.5 w-3.5" /> Highlights
            </div>
            <h1 className="mt-3 font-serif-display text-3xl font-semibold leading-tight sm:text-5xl text-white">
              Hello {profile?.full_name?.split(" ")[0] || "there"}.
            </h1>
            <p className="mt-3 text-sm text-white/80 sm:text-base">
              {completed.length === 0
                ? "You haven't completed any inventories yet — pick one below to start building your profile."
                : `You've completed ${completed.length} inventor${completed.length === 1 ? "y" : "ies"}. Here's what stands out.`}
            </p>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-44 rounded-2xl" /><Skeleton className="h-44 rounded-2xl" /></div>
        ) : (
          <div className="space-y-10">
            {/* Highlights from completed */}
            <section>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <ScrollText className="h-3.5 w-3.5" /> Profile highlights
              </div>
              {completed.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-8 text-center text-sm text-muted-foreground">
                  Once you complete an inventory, your top match and a short narrative summary will appear here.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {completed.slice(0, 4).map((q, i) => (
                    <motion.article
                      key={q.id}
                      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated"
                    >
                      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[hsl(var(--brand-blue))]/8 blur-2xl transition-opacity group-hover:opacity-80" />
                      <div className="relative">
                        <Badge className="bg-success text-white"><Trophy className="mr-1 h-3 w-3" /> Completed</Badge>
                        <h3 className="mt-2 font-serif-display text-2xl leading-tight">{q.title}</h3>
                        {q.topClusterName && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs">
                            <span className="text-base">{q.topClusterEmoji}</span>
                            <span className="font-medium">Top match · {q.topClusterName}</span>
                          </div>
                        )}
                        {q.aiOverview && (
                          <p className="mt-3 line-clamp-3 font-serif-display text-sm italic leading-relaxed text-foreground/85">"{q.aiOverview}"</p>
                        )}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button asChild size="sm" className="gradient-student text-student-foreground border-0">
                            <Link to={`/student/results/${q.hasResponse!.id}`}>Open profile <ArrowRight className="ml-1 h-4 w-4" /></Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/student/questionnaire/${q.id}/take`}>Retake</Link>
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  ))}
                </div>
              )}
            </section>

            {/* Untaken inventories */}
            <section>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <ListChecks className="h-3.5 w-3.5" /> Inventories to explore
              </div>
              {newOnes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center text-sm text-muted-foreground">
                  You're all caught up. Check back soon for new inventories.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {newOnes.slice(0, 4).map((q, i) => (
                    <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated">
                        <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[hsl(var(--brand-red))]/8 blur-2xl transition-opacity group-hover:opacity-80" />
                        <div className="relative">
                          <h3 className="font-serif-display text-2xl leading-tight">{q.title}</h3>
                          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{q.description || "Discover the categories that match who you are."}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {q.questionCount} questions</span>
                            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> ~{Math.max(1, Math.ceil(q.questionCount / 5))} min</span>
                          </div>
                          <Button asChild size="sm" className="mt-4 gradient-student text-student-foreground border-0">
                            <Link to={`/student/questionnaire/${q.id}/take`}>Begin <ArrowRight className="ml-1 h-4 w-4" /></Link>
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
              {(newOnes.length > 4 || completed.length > 4) && (
                <div className="mt-4 text-right">
                  <Button asChild variant="ghost" size="sm"><Link to="/student/questionnaires">See all inventories <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
                </div>
              )}
            </section>
          </div>
        )}
      </motion.div>
    </StudentShell>
  );
}
