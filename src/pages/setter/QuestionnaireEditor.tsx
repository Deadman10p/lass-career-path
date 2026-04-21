import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageShell } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, GripVertical, Save, Upload, Sparkles, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchClusters, fetchFullQuestionnaire } from "@/lib/api";
import type { CareerCluster, FullQuestionnaire, SectionWithQuestions, QuestionWithWeights } from "@/lib/types";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClusterManager } from "@/components/setter/ClusterManager";
import { AIAssistantPanel } from "@/components/setter/AIAssistantPanel";
import { ImportDialog } from "@/components/setter/ImportDialog";
import { cn } from "@/lib/utils";

export default function QuestionnaireEditor() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<FullQuestionnaire | null>(null);
  const [clusters, setClusters] = useState<CareerCluster[]>([]);
  const [tab, setTab] = useState("details");
  const [aiOpen, setAiOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const reload = async () => {
    setLoading(true);
    const [d, cs] = await Promise.all([fetchFullQuestionnaire(id), fetchClusters()]);
    setDoc(d);
    setClusters(cs);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [id]);

  // Auto-save on details/title changes (debounced)
  const detailsTimer = useRef<number | null>(null);
  const updateDetails = (patch: Partial<FullQuestionnaire>) => {
    if (!doc) return;
    setDoc({ ...doc, ...patch });
    if (detailsTimer.current) clearTimeout(detailsTimer.current);
    detailsTimer.current = window.setTimeout(async () => {
      setSaving(true);
      await supabase.from("questionnaires").update({
        title: patch.title ?? doc.title,
        description: patch.description ?? doc.description,
      }).eq("id", id);
      setSaving(false);
    }, 600);
  };

  const togglePublish = async (val: boolean) => {
    if (!doc) return;
    setDoc({ ...doc, is_published: val });
    await supabase.from("questionnaires").update({ is_published: val }).eq("id", id);
    toast.success(val ? "Published — students can now take this." : "Moved to draft.");
  };

  const addSection = async () => {
    if (!doc) return;
    const order = doc.sections.length;
    const { data, error } = await supabase.from("sections")
      .insert({ questionnaire_id: id, title: `Section ${String.fromCharCode(65 + order)}`, description: "", order_index: order })
      .select().single();
    if (error) return toast.error(error.message);
    setDoc({ ...doc, sections: [...doc.sections, { ...(data as any), questions: [] }] });
  };

  const updateSection = async (sectionId: string, patch: Partial<SectionWithQuestions>) => {
    if (!doc) return;
    setDoc({ ...doc, sections: doc.sections.map(s => s.id === sectionId ? { ...s, ...patch } : s) });
    await supabase.from("sections").update({ title: patch.title, description: patch.description }).eq("id", sectionId);
  };

  const deleteSection = async (sectionId: string) => {
    if (!doc) return;
    if (!confirm("Delete this section and all its questions?")) return;
    await supabase.from("sections").delete().eq("id", sectionId);
    setDoc({ ...doc, sections: doc.sections.filter(s => s.id !== sectionId) });
  };

  const addQuestion = async (sectionId: string) => {
    if (!doc) return;
    const sec = doc.sections.find(s => s.id === sectionId);
    if (!sec) return;
    const order = sec.questions.length;
    const { data, error } = await supabase.from("questions")
      .insert({ section_id: sectionId, statement: "", order_index: order }).select().single();
    if (error) return toast.error(error.message);
    setDoc({
      ...doc,
      sections: doc.sections.map(s => s.id === sectionId
        ? { ...s, questions: [...s.questions, { ...(data as any), weights: {} }] }
        : s),
    });
  };

  const updateQuestion = async (qId: string, statement: string) => {
    if (!doc) return;
    setDoc({
      ...doc,
      sections: doc.sections.map(s => ({ ...s, questions: s.questions.map(q => q.id === qId ? { ...q, statement } : q) })),
    });
    await supabase.from("questions").update({ statement }).eq("id", qId);
  };

  const deleteQuestion = async (qId: string) => {
    if (!doc) return;
    await supabase.from("questions").delete().eq("id", qId);
    setDoc({
      ...doc,
      sections: doc.sections.map(s => ({ ...s, questions: s.questions.filter(q => q.id !== qId) })),
    });
  };

  const setWeight = async (qId: string, clusterId: string, weight: number) => {
    if (!doc) return;
    setDoc({
      ...doc,
      sections: doc.sections.map(s => ({
        ...s,
        questions: s.questions.map(q => q.id === qId ? { ...q, weights: { ...q.weights, [clusterId]: weight } } : q),
      })),
    });
    await supabase.from("answer_weights")
      .upsert({ question_id: qId, career_cluster_id: clusterId, weight }, { onConflict: "question_id,career_cluster_id" });
  };

  const handleSectionDragEnd = async (e: DragEndEvent) => {
    if (!doc || !e.over || e.active.id === e.over.id) return;
    const oldIdx = doc.sections.findIndex(s => s.id === e.active.id);
    const newIdx = doc.sections.findIndex(s => s.id === e.over!.id);
    const reordered = arrayMove(doc.sections, oldIdx, newIdx).map((s, i) => ({ ...s, order_index: i }));
    setDoc({ ...doc, sections: reordered });
    await Promise.all(reordered.map(s => supabase.from("sections").update({ order_index: s.order_index }).eq("id", s.id)));
  };

  const handleQuestionDragEnd = async (sectionId: string, e: DragEndEvent) => {
    if (!doc || !e.over || e.active.id === e.over.id) return;
    const sec = doc.sections.find(s => s.id === sectionId);
    if (!sec) return;
    const oldIdx = sec.questions.findIndex(q => q.id === e.active.id);
    const newIdx = sec.questions.findIndex(q => q.id === e.over!.id);
    const reordered = arrayMove(sec.questions, oldIdx, newIdx).map((q, i) => ({ ...q, order_index: i }));
    setDoc({ ...doc, sections: doc.sections.map(s => s.id === sectionId ? { ...s, questions: reordered } : s) });
    await Promise.all(reordered.map(q => supabase.from("questions").update({ order_index: q.order_index }).eq("id", q.id)));
  };

  const totalQuestions = doc?.sections.reduce((sum, s) => sum + s.questions.length, 0) ?? 0;

  if (loading) return <PageShell tone="setter" title="Setter Portal"><div className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div></PageShell>;
  if (!doc) return <PageShell tone="setter" title="Setter Portal"><p>Not found.</p></PageShell>;

  return (
    <PageShell tone="setter" title="Setter Portal">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <button onClick={() => navigate("/setter/dashboard")} className="text-xs text-muted-foreground hover:text-foreground">← Back to dashboard</button>
          <h1 className="mt-1 truncate font-display text-2xl font-semibold sm:text-3xl">{doc.title || "Untitled"}</h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <Badge variant={doc.is_published ? "default" : "secondary"} className={doc.is_published ? "bg-success text-white" : ""}>
              {doc.is_published ? "Published" : "Draft"}
            </Badge>
            <span>{doc.sections.length} sections · {totalQuestions} questions</span>
            {saving && <span className="inline-flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> saving…</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <Switch checked={doc.is_published} onCheckedChange={togglePublish} id="pub" />
            <Label htmlFor="pub" className="cursor-pointer text-sm">Published</Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><Upload className="mr-1.5 h-4 w-4" /> Import</Button>
          <Button size="sm" className="gradient-setter text-setter-foreground border-0 shadow-glow" onClick={() => setAiOpen(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" /> AI Assistant
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="details">1. Details</TabsTrigger>
          <TabsTrigger value="content">2. Content</TabsTrigger>
          <TabsTrigger value="clusters">3. Clusters</TabsTrigger>
          <TabsTrigger value="weights">4. Weights</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={doc.title} onChange={(e) => updateDetails({ title: e.target.value })} placeholder="e.g. Light Academy Career Inventory" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" rows={4} value={doc.description} onChange={(e) => updateDetails({ description: e.target.value })} placeholder="Briefly explain what students will discover." />
              </div>
              <div className="rounded-lg bg-accent/50 p-4 text-sm text-accent-foreground">
                <strong>Tip:</strong> Move on to step 2 to add sections and questions. Then go to step 3 to manage career clusters and step 4 to set the scoring weights.
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-5">
          <div className="space-y-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={doc.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {doc.sections.map((sec) => (
                  <SectionCard
                    key={sec.id}
                    section={sec}
                    onUpdate={(patch) => updateSection(sec.id, patch)}
                    onDelete={() => deleteSection(sec.id)}
                    onAddQuestion={() => addQuestion(sec.id)}
                    onUpdateQuestion={updateQuestion}
                    onDeleteQuestion={deleteQuestion}
                    onQuestionDragEnd={(e) => handleQuestionDragEnd(sec.id, e)}
                    sensors={sensors}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button onClick={addSection} variant="outline" className="w-full border-dashed">
              <Plus className="mr-1.5 h-4 w-4" /> Add Section
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="clusters" className="mt-5">
          <ClusterManager clusters={clusters} onChange={setClusters} />
        </TabsContent>

        <TabsContent value="weights" className="mt-5">
          <WeightsMatrix doc={doc} clusters={clusters} onSet={setWeight} />
        </TabsContent>
      </Tabs>

      <AIAssistantPanel open={aiOpen} onOpenChange={setAiOpen} doc={doc} clusters={clusters} onApplied={reload} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} questionnaireId={id} onImported={reload} />
    </PageShell>
  );
}

function SectionCard({ section, onUpdate, onDelete, onAddQuestion, onUpdateQuestion, onDeleteQuestion, onQuestionDragEnd, sensors }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div ref={setNodeRef} style={style} className="rounded-2xl border border-border bg-card shadow-card">
      <div className="flex items-start gap-2 border-b border-border p-4">
        <button {...attributes} {...listeners} className="mt-2 cursor-grab text-muted-foreground hover:text-foreground touch-none"><GripVertical className="h-4 w-4" /></button>
        <div className="flex-1 space-y-2">
          <Input value={section.title} onChange={(e) => onUpdate({ title: e.target.value })} className="border-0 bg-transparent px-0 font-display text-lg font-semibold focus-visible:ring-0" placeholder="Section title" />
          <Textarea value={section.description} onChange={(e) => onUpdate({ description: e.target.value })} rows={1} className="resize-none border-0 bg-transparent px-0 text-sm text-muted-foreground focus-visible:ring-0" placeholder="Optional description" />
        </div>
        <Button size="icon" variant="ghost" onClick={() => setCollapsed(c => !c)}>{collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}</Button>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </div>
      {!collapsed && (
        <div className="space-y-2 p-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onQuestionDragEnd}>
            <SortableContext items={section.questions.map((q: any) => q.id)} strategy={verticalListSortingStrategy}>
              {section.questions.map((q: QuestionWithWeights, i: number) => (
                <QuestionRow key={q.id} q={q} index={i} onChange={(s) => onUpdateQuestion(q.id, s)} onDelete={() => onDeleteQuestion(q.id)} />
              ))}
            </SortableContext>
          </DndContext>
          <Button onClick={onAddQuestion} variant="ghost" size="sm" className="w-full"><Plus className="mr-1 h-4 w-4" /> Add Question</Button>
        </div>
      )}
    </div>
  );
}

function QuestionRow({ q, index, onChange, onDelete }: { q: QuestionWithWeights; index: number; onChange: (s: string) => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3">
      <button {...attributes} {...listeners} className="mt-2 cursor-grab text-muted-foreground hover:text-foreground touch-none"><GripVertical className="h-4 w-4" /></button>
      <div className="mt-2 w-6 text-xs font-medium text-muted-foreground">{index + 1}.</div>
      <Textarea value={q.statement} onChange={(e) => onChange(e.target.value)} rows={1} className="min-h-[36px] flex-1 resize-none bg-background" placeholder='e.g. "I enjoy solving puzzles or working with numbers."' />
      <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
    </div>
  );
}

function WeightsMatrix({ doc, clusters, onSet }: { doc: FullQuestionnaire; clusters: CareerCluster[]; onSet: (qId: string, cId: string, w: number) => void }) {
  const all = doc.sections.flatMap(s => s.questions.map(q => ({ section: s.title, q })));
  if (!all.length) return <EmptyHint title="No questions yet" body="Go to step 2 and add questions before assigning weights." />;
  if (!clusters.length) return <EmptyHint title="No clusters" body="Go to step 3 and add at least one career cluster." />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-accent/50 p-4 text-sm text-accent-foreground">
        Set how strongly each question contributes to each career cluster. <strong>0 = no link, 5 = strongest link.</strong> A student rating of 5 × weight of 4 = 20 points to that cluster.
      </div>
      {all.map(({ section, q }, i) => (
        <div key={q.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="mb-3">
            <div className="text-xs text-muted-foreground">{section}</div>
            <div className="font-medium">{i + 1}. {q.statement || <span className="italic text-muted-foreground">(empty question)</span>}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {clusters.map(c => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2">
                <span className="text-lg">{c.icon_emoji}</span>
                <div className="flex-1 truncate text-sm font-medium">{c.name}</div>
                <div className="flex gap-1">
                  {[0,1,2,3,4,5].map(w => (
                    <button
                      key={w}
                      onClick={() => onSet(q.id, c.id, w)}
                      className={cn(
                        "h-7 w-7 rounded-md text-xs font-semibold transition-all",
                        (q.weights[c.id] ?? 0) === w
                          ? "gradient-setter text-setter-foreground shadow-glow scale-110"
                          : "bg-background text-muted-foreground hover:bg-accent"
                      )}
                    >{w}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <h3 className="font-display font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
