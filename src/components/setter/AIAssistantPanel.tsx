import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Check, X, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CareerCluster, FullQuestionnaire } from "@/lib/types";
import ReactMarkdown from "react-markdown";

interface Msg {
  role: "user" | "assistant";
  content: string;
  proposal?: Proposal | null;
}

interface ProposalAction {
  type: "add_question" | "edit_question" | "delete_question" | "add_section" | "edit_section" | "delete_section" | "set_weight";
  section_title?: string;
  section_id?: string;
  question_id?: string;
  question_statement?: string;
  new_statement?: string;
  new_section_title?: string;
  new_section_description?: string;
  cluster_name?: string;
  weight?: number;
}

interface Proposal {
  summary: string;
  actions: ProposalAction[];
}

export function AIAssistantPanel({ open, onOpenChange, doc, clusters, onApplied }: {
  open: boolean; onOpenChange: (v: boolean) => void; doc: FullQuestionnaire; clusters: CareerCluster[]; onApplied: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I can help refine this questionnaire. Try asking me to:\n\n- *“Add 3 questions about teamwork to Section B.”*\n- *“Make question 4 stronger toward Technology & Innovation.”*\n- *“Rewrite Section A to focus on creative interests.”*\n\nI'll always show you the changes first and only apply them if you approve." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: userMsg }]);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          message: userMsg,
          history: msgs.map(m => ({ role: m.role, content: m.content })),
          questionnaire: serialize(doc, clusters),
        },
      });
      if (error) throw error;
      setMsgs((m) => [...m, { role: "assistant", content: data.reply, proposal: data.proposal ?? null }]);
    } catch (e: any) {
      toast.error(e.message || "AI request failed");
      setMsgs((m) => [...m, { role: "assistant", content: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setSending(false);
    }
  };

  const apply = async (proposal: Proposal, idx: number) => {
    setApplying(true);
    try {
      for (const a of proposal.actions) {
        await applyAction(a, doc, clusters);
      }
      toast.success("Changes applied!");
      // Disable proposal in message
      setMsgs((m) => m.map((mm, i) => i === idx ? { ...mm, proposal: null, content: mm.content + "\n\n✅ *Applied.*" } : mm));
      onApplied();
    } catch (e: any) {
      toast.error(e.message || "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  };

  const reject = (idx: number) => {
    setMsgs((m) => m.map((mm, i) => i === idx ? { ...mm, proposal: null, content: mm.content + "\n\n❌ *Discarded.*" } : mm));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 font-display"><Sparkles className="h-5 w-5 text-setter" /> AI Assistant</SheetTitle>
          <SheetDescription>I propose changes — you confirm before they apply.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="space-y-4 p-4">
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-70">
                    {m.role === "user" ? <UserIcon className="h-3 w-3" /> : <Bot className="h-3 w-3" />} {m.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="prose prose-sm max-w-none [&_p]:my-1"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                  {m.proposal && (
                    <div className="mt-3 rounded-lg border border-setter/40 bg-card p-3 text-foreground">
                      <div className="mb-2 text-xs font-semibold text-setter">Proposed changes</div>
                      <div className="mb-2 text-sm">{m.proposal.summary}</div>
                      <ul className="mb-3 space-y-1 text-xs text-muted-foreground">
                        {m.proposal.actions.map((a, j) => <li key={j}>• {describeAction(a)}</li>)}
                      </ul>
                      <div className="flex gap-2">
                        <Button size="sm" disabled={applying} onClick={() => apply(m.proposal!, i)} className="gradient-setter text-setter-foreground border-0">
                          {applying ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />} Apply
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reject(i)}><X className="mr-1 h-3 w-3" /> Reject</Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</div>}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask the assistant…"
              rows={2}
              className="resize-none"
            />
            <Button onClick={send} disabled={sending || !input.trim()} className="gradient-setter text-setter-foreground border-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function serialize(doc: FullQuestionnaire, clusters: CareerCluster[]) {
  return {
    title: doc.title,
    description: doc.description,
    clusters: clusters.map(c => ({ id: c.id, name: c.name, emoji: c.icon_emoji, description: c.description })),
    sections: doc.sections.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      questions: s.questions.map(q => ({
        id: q.id,
        statement: q.statement,
        weights: Object.fromEntries(
          Object.entries(q.weights).map(([cid, w]) => [clusters.find(c => c.id === cid)?.name ?? cid, w])
        ),
      })),
    })),
  };
}

function describeAction(a: ProposalAction): string {
  switch (a.type) {
    case "add_question": return `Add to “${a.section_title}”: “${a.question_statement}”`;
    case "edit_question": return `Rewrite question: “${a.new_statement}”`;
    case "delete_question": return `Delete a question`;
    case "add_section": return `Add section “${a.new_section_title}”`;
    case "edit_section": return `Rename section to “${a.new_section_title}”`;
    case "delete_section": return `Delete a section`;
    case "set_weight": return `Set weight for “${a.cluster_name}” = ${a.weight}`;
  }
}

async function applyAction(a: ProposalAction, doc: FullQuestionnaire, clusters: CareerCluster[]) {
  const findSectionId = (title?: string, id?: string) => id ?? doc.sections.find(s => s.title.toLowerCase() === (title ?? "").toLowerCase())?.id;
  const findClusterId = (name?: string) => clusters.find(c => c.name.toLowerCase() === (name ?? "").toLowerCase())?.id;

  if (a.type === "add_section") {
    const order = doc.sections.length;
    await supabase.from("sections").insert({
      questionnaire_id: doc.id, title: a.new_section_title || "New Section", description: a.new_section_description || "", order_index: order,
    });
  } else if (a.type === "edit_section") {
    const sid = findSectionId(a.section_title, a.section_id);
    if (sid) await supabase.from("sections").update({ title: a.new_section_title, description: a.new_section_description }).eq("id", sid);
  } else if (a.type === "delete_section") {
    const sid = findSectionId(a.section_title, a.section_id);
    if (sid) await supabase.from("sections").delete().eq("id", sid);
  } else if (a.type === "add_question") {
    const sid = findSectionId(a.section_title, a.section_id);
    if (!sid) return;
    const sec = doc.sections.find(s => s.id === sid);
    const order = sec?.questions.length ?? 0;
    await supabase.from("questions").insert({ section_id: sid, statement: a.question_statement || "", order_index: order });
  } else if (a.type === "edit_question") {
    if (a.question_id) await supabase.from("questions").update({ statement: a.new_statement }).eq("id", a.question_id);
  } else if (a.type === "delete_question") {
    if (a.question_id) await supabase.from("questions").delete().eq("id", a.question_id);
  } else if (a.type === "set_weight") {
    const cid = findClusterId(a.cluster_name);
    if (a.question_id && cid && typeof a.weight === "number") {
      await supabase.from("answer_weights").upsert(
        { question_id: a.question_id, career_cluster_id: cid, weight: Math.max(0, Math.min(5, a.weight)) },
        { onConflict: "question_id,career_cluster_id" }
      );
    }
  }
}
