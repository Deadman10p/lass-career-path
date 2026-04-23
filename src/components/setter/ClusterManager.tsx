import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CareerCluster } from "@/lib/types";
import { fetchAllClusters } from "@/lib/api";

export function ClusterManager({ clusters, onChange, questionnaireId }: { 
  clusters: CareerCluster[]; 
  onChange: (c: CareerCluster[]) => void;
  questionnaireId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [allClusters, setAllClusters] = useState<CareerCluster[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  // Load all available clusters for the "Add" dialog
  useEffect(() => {
    const loadAll = async () => {
      setLoadingAll(true);
      try {
        const cs = await fetchAllClusters();
        setAllClusters(cs);
      } catch (e) {
        console.error(e);
      }
      setLoadingAll(false);
    };
    loadAll();
  }, []);

  const addClusterToQuestionnaire = async (clusterId: string) => {
    setBusy(true);
    const { error } = await supabase.from("questionnaire_clusters").insert({
      questionnaire_id: questionnaireId,
      career_cluster_id: clusterId,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    
    // Add the cluster to the local state
    const clusterToAdd = allClusters.find(c => c.id === clusterId);
    if (clusterToAdd && !clusters.find(c => c.id === clusterId)) {
      onChange([...clusters, clusterToAdd]);
    }
  };

  const removeClusterFromQuestionnaire = async (id: string) => {
    if (!confirm("Remove this cluster from the questionnaire? Weights for it will also be removed.")) return;
    await supabase.from("questionnaire_clusters").delete()
      .eq("questionnaire_id", questionnaireId)
      .eq("career_cluster_id", id);
    onChange(clusters.filter(c => c.id !== id));
  };

  const update = async (id: string, patch: Partial<CareerCluster>) => {
    onChange(clusters.map(c => c.id === id ? { ...c, ...patch } : c));
    await supabase.from("career_clusters").update(patch as any).eq("id", id);
  };

  // Get clusters not yet added to this questionnaire
  const availableClusters = allClusters.filter(c => !clusters.find(existing => existing.id === c.id));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-accent/50 p-4 text-sm text-accent-foreground">
        Clusters are the categories students get scored on. They don't have to be career-specific — use them for learning styles, personality traits, values, or any grouping your inventory measures. Add clusters from the global pool or edit their details.
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
              <Button size="icon" variant="ghost" onClick={() => removeClusterFromQuestionnaire(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        </div>
      ))}
      
      <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
        <h3 className="mb-3 font-semibold">Add Cluster to this Questionnaire</h3>
        {loadingAll ? (
          <p className="text-sm text-muted-foreground">Loading available clusters...</p>
        ) : availableClusters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No more clusters available. Create new ones in the dashboard first.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableClusters.map(c => (
              <Button 
                key={c.id} 
                variant="outline" 
                size="sm" 
                onClick={() => addClusterToQuestionnaire(c.id)}
                disabled={busy}
              >
                <Plus className="mr-1 h-3 w-3" /> {c.icon_emoji} {c.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
