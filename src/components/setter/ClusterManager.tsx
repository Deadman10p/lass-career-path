import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Sparkles, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerCluster } from "@/lib/types";
import { fetchAllClusters } from "@/lib/api";

const DEFAULT_COLORS = ["#4F46E5", "#DC2626", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

export function ClusterManager({ clusters, onChange, questionnaireId }: {
  clusters: CareerCluster[];
  onChange: (c: CareerCluster[]) => void;
  questionnaireId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<CareerCluster[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", emoji: "✨", description: "", possible: "" });

  useEffect(() => {
    fetchAllClusters().then(setTemplates).catch(() => {});
  }, []);

  // Create a brand-new custom cluster owned by THIS questionnaire only.
  const createCustomCluster = async (preset?: { name: string; emoji?: string; description?: string; possible_careers?: string[] }) => {
    setBusy(true);
    const color = DEFAULT_COLORS[clusters.length % DEFAULT_COLORS.length];
    const payload = {
      name: preset?.name ?? draft.name.trim(),
      icon_emoji: preset?.emoji ?? draft.emoji.trim() ?? "✨",
      description: preset?.description ?? draft.description.trim(),
      possible_careers: preset?.possible_careers ?? draft.possible.split(",").map(s => s.trim()).filter(Boolean),
      color_hex: color,
      questionnaire_id: questionnaireId,
    };
    if (!payload.name) { setBusy(false); return toast.error("Give the category a name."); }
    const { data, error } = await supabase.from("career_clusters").insert(payload as any).select().single();
    if (error) { setBusy(false); return toast.error(error.message); }
    await supabase.from("questionnaire_clusters").insert({ questionnaire_id: questionnaireId, career_cluster_id: data.id });
    onChange([...clusters, data as CareerCluster]);
    setDraft({ name: "", emoji: "✨", description: "", possible: "" });
    setShowCreate(false);
    setBusy(false);
    toast.success(`Added “${payload.name}”.`);
  };

  // Clone a template cluster into this questionnaire (so edits don't leak across questionnaires).
  const cloneTemplate = async (tpl: CareerCluster) => {
    if (clusters.find(c => c.name.toLowerCase() === tpl.name.toLowerCase())) {
      return toast.error(`“${tpl.name}” is already on this questionnaire.`);
    }
    await createCustomCluster({
      name: tpl.name,
      emoji: tpl.icon_emoji,
      description: tpl.description,
      possible_careers: tpl.possible_careers ?? [],
    });
  };

  const removeClusterFromQuestionnaire = async (c: CareerCluster) => {
    if (!confirm(`Remove “${c.name}” from this questionnaire? Weights for it on this questionnaire will also be removed.`)) return;
    await supabase.from("questionnaire_clusters").delete()
      .eq("questionnaire_id", questionnaireId)
      .eq("career_cluster_id", c.id);
    // If this cluster is owned by this questionnaire, delete the row entirely (it's not shared).
    if (c.questionnaire_id === questionnaireId) {
      await supabase.from("answer_weights").delete().eq("career_cluster_id", c.id);
      await supabase.from("career_clusters").delete().eq("id", c.id);
    }
    onChange(clusters.filter(x => x.id !== c.id));
  };

  // In-place edit. If the cluster is a shared template (questionnaire_id IS NULL),
  // clone it first so we never affect other questionnaires.
  const update = async (id: string, patch: Partial<CareerCluster>) => {
    const target = clusters.find(c => c.id === id);
    if (!target) return;

    if (target.questionnaire_id == null) {
      // Clone-on-write: detach by creating a private copy, then update that copy.
      const cloned = {
        name: target.name,
        icon_emoji: target.icon_emoji,
        description: target.description,
        possible_careers: target.possible_careers ?? [],
        color_hex: target.color_hex,
        questionnaire_id: questionnaireId,
        ...patch,
      };
      const { data, error } = await supabase.from("career_clusters").insert(cloned as any).select().single();
      if (error) return toast.error(error.message);
      // Move junction + weights from old to new
      await supabase.from("questionnaire_clusters").delete()
        .eq("questionnaire_id", questionnaireId)
        .eq("career_cluster_id", target.id);
      await supabase.from("questionnaire_clusters").insert({ questionnaire_id: questionnaireId, career_cluster_id: data.id });
      // Migrate answer_weights for this questionnaire's questions
      const { data: secs } = await supabase.from("sections").select("id").eq("questionnaire_id", questionnaireId);
      const sIds = (secs ?? []).map((s: any) => s.id);
      if (sIds.length) {
        const { data: qs } = await supabase.from("questions").select("id").in("section_id", sIds);
        const qIds = (qs ?? []).map((x: any) => x.id);
        if (qIds.length) {
          await supabase.from("answer_weights")
            .update({ career_cluster_id: data.id })
            .in("question_id", qIds)
            .eq("career_cluster_id", target.id);
        }
      }
      onChange(clusters.map(c => c.id === id ? (data as CareerCluster) : c));
      return;
    }

    onChange(clusters.map(c => c.id === id ? { ...c, ...patch } : c));
    await supabase.from("career_clusters").update(patch as any).eq("id", id);
  };

  const availableTemplates = templates.filter(t => !clusters.find(c => c.name.toLowerCase() === t.name.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-accent/50 p-4 text-sm text-accent-foreground">
        Categories are independent <strong>per questionnaire</strong> — editing them here will never affect any other questionnaire. Use <em>Create custom category</em> for a brand new one, or pick a starter template to add a private copy.
      </div>

      {clusters.map(c => (
        <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="space-y-1.5 sm:w-24">
              <Label>Emoji</Label>
              <Input value={c.icon_emoji} onChange={(e) => update(c.id, { icon_emoji: e.target.value.slice(0, 4) })} className="text-center text-2xl" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="space-y-1.5"><Label>Name</Label><Input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={c.description} onChange={(e) => update(c.id, { description: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Suggested next steps / possible careers (comma-separated)</Label>
                <Input
                  value={(c.possible_careers ?? []).join(", ")}
                  onChange={(e) => update(c.id, { possible_careers: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}
                  placeholder="Engineer, Data Scientist, Architect"
                />
              </div>
            </div>
            <div>
              <Button size="icon" variant="ghost" onClick={() => removeClusterFromQuestionnaire(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        </div>
      ))}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold">Add a category</h3>
          <Button size="sm" onClick={() => setShowCreate(s => !s)} className="gradient-setter text-setter-foreground border-0">
            <Plus className="mr-1 h-4 w-4" /> Create custom category
          </Button>
        </div>

        {showCreate && (
          <div className="mb-4 grid gap-2 rounded-lg border border-setter/30 bg-setter/5 p-3 sm:grid-cols-[80px_1fr_auto]">
            <Input value={draft.emoji} onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 4) })} className="text-center text-xl" placeholder="✨" />
            <div className="space-y-2">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Category name (e.g. Visual Learner)" />
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="What does this category mean?" />
              <Input value={draft.possible} onChange={(e) => setDraft({ ...draft, possible: e.target.value })} placeholder="Suggested next steps (comma-separated, optional)" />
            </div>
            <Button onClick={() => createCustomCluster()} disabled={busy} className="gradient-setter text-setter-foreground border-0 self-start">
              <Sparkles className="mr-1 h-4 w-4" /> Create
            </Button>
          </div>
        )}

        {availableTemplates.length > 0 && (
          <>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Or start from a template (a private copy is added):</div>
            <div className="flex flex-wrap gap-2">
              {availableTemplates.map(t => (
                <Button key={t.id} variant="outline" size="sm" onClick={() => cloneTemplate(t)} disabled={busy}>
                  <Copy className="mr-1 h-3 w-3" /> {t.icon_emoji} {t.name}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
