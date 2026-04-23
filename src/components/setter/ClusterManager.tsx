import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerCluster } from "@/lib/types";

export function ClusterManager({ clusters, onChange }: { clusters: CareerCluster[]; onChange: (c: CareerCluster[]) => void }) {
  const [busy, setBusy] = useState(false);

  const addCluster = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("career_clusters").insert({
      name: "New Cluster", description: "", icon_emoji: "✨", possible_careers: [],
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange([...clusters, data as CareerCluster]);
  };

  const update = async (id: string, patch: Partial<CareerCluster>) => {
    onChange(clusters.map(c => c.id === id ? { ...c, ...patch } : c));
    await supabase.from("career_clusters").update(patch as any).eq("id", id);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this cluster? Weights for it will also be removed.")) return;
    await supabase.from("career_clusters").delete().eq("id", id);
    onChange(clusters.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-accent/50 p-4 text-sm text-accent-foreground">
        Clusters are the categories students get scored on. They don't have to be career-specific — use them for learning styles, personality traits, values, or any grouping your inventory measures. Edit, add or remove freely.
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
                <Label>Possible careers (comma-separated)</Label>
                <Input
                  value={(c.possible_careers ?? []).join(", ")}
                  onChange={(e) => update(c.id, { possible_careers: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })}
                  placeholder="Engineer, Data Scientist, Architect"
                />
              </div>
            </div>
            <div>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        </div>
      ))}
      <Button onClick={addCluster} disabled={busy} variant="outline" className="w-full border-dashed">
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />} Add Cluster
      </Button>
    </div>
  );
}
