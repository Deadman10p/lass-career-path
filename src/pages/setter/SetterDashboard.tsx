import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, FileText, Eye, BarChart3, Pencil, FileQuestion, CheckCircle2, Users, BookOpen, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createBlankQuestionnaire } from "@/lib/api";
import type { Questionnaire } from "@/lib/types";

export default function SetterDashboard() {
  const { user } = useAuth();
  const [list, setList] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseCount, setResponseCount] = useState(0);

  const load = async () => {
    setLoading(true);
    const [{ data: qs }, { count }] = await Promise.all([
      supabase.from("questionnaires").select("*").order("updated_at", { ascending: false }),
      supabase.from("responses").select("id", { count: "exact", head: true }),
    ]);
    setList((qs ?? []) as Questionnaire[]);
    setResponseCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!user) return;
    try {
      const id = await createBlankQuestionnaire(user.id);
      window.location.href = `/setter/questionnaire/${id}/edit`;
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (qId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This will also delete all sections, questions, and responses.`)) return;
    try {
      console.log("Deleting questionnaire:", qId);
      const { error } = await supabase.from("questionnaires").delete().eq("id", qId);
      if (error) {
        console.error("Delete error:", error);
        throw error;
      }
      console.log("Delete successful, reloading...");
      toast.success("Questionnaire deleted");
      load();
    } catch (e: any) {
      console.error("Delete failed:", e);
      toast.error(e.message || "Failed to delete");
    }
  };

  const published = list.filter((q) => q.is_published).length;
  const drafts = list.length - published;

  return (
    <PageShell tone="setter" title="Setter Portal">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Build, edit and analyse your career inventories.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/setter/manual"><BookOpen className="mr-1.5 h-4 w-4"/>Manual</Link></Button>
            <Button onClick={handleCreate} className="gradient-setter text-setter-foreground border-0 shadow-glow">
              <Plus className="mr-1.5 h-4 w-4" /> New Questionnaire
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <StatCard icon={<FileText className="h-4 w-4" />} label="Total questionnaires" value={list.length} loading={loading} tone="setter" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Published" value={published} sub={`${drafts} draft${drafts === 1 ? "" : "s"}`} loading={loading} tone="setter" />
          <StatCard icon={<Users className="h-4 w-4" />} label="Student responses" value={responseCount} loading={loading} tone="setter" />
        </div>

        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border p-4 sm:p-5">
            <h2 className="font-display text-lg font-semibold">Your questionnaires</h2>
          </div>
          {loading ? (
            <div className="space-y-3 p-4 sm:p-5">{[0,1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState onCreate={handleCreate} />
          ) : (
            <ul className="divide-y divide-border">
              {list.map((q) => (
                <li key={q.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display font-medium">{q.title}</h3>
                      <Badge variant={q.is_published ? "default" : "secondary"} className={q.is_published ? "bg-success text-white" : ""}>
                        {q.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{q.description || "No description yet"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Updated {new Date(q.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild variant="outline" size="sm"><Link to={`/setter/questionnaire/${q.id}/analytics`}><BarChart3 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Analytics</span></Link></Button>
                    <Button asChild size="sm" className="gradient-setter text-setter-foreground border-0"><Link to={`/setter/questionnaire/${q.id}/edit`}><Pencil className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Edit</span></Link></Button>
                    <Button variant="outline" size="icon" onClick={() => handleDelete(q.id, q.title)} title="Delete questionnaire"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </PageShell>
  );
}

function StatCard({ icon, label, value, sub, loading, tone }: { icon: React.ReactNode; label: string; value: number; sub?: string; loading?: boolean; tone: "setter" | "student" }) {
  const grad = tone === "setter" ? "gradient-setter" : "gradient-student";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${grad} text-primary-foreground`}>{icon}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-16" /> : <div className="mt-3 font-display text-3xl font-semibold">{value}</div>}
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-setter text-setter-foreground shadow-glow"><FileQuestion className="h-7 w-7" /></div>
      <h3 className="font-display text-lg font-semibold">No questionnaires yet</h3>
      <p className="max-w-sm text-sm text-muted-foreground">Create your first questionnaire — add sections, questions, and a scoring map for career clusters.</p>
      <Button onClick={onCreate} className="mt-2 gradient-setter text-setter-foreground border-0 shadow-glow">
        <Sparkles className="mr-1.5 h-4 w-4" /> Create your first one
      </Button>
    </div>
  );
}
