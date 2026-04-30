import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Loader2, Check, X, Bot, User as UserIcon, Brain, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CareerCluster, FullQuestionnaire } from "@/lib/types";
import ReactMarkdown from "react-markdown";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: Proposal | null;
  hidden?: boolean; // system notes shown faintly or not at all
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

const HISTORY_KEEP = 10;          // keep last N raw turns verbatim
const SUMMARISE_AFTER = 16;       // when total turns exceed this, summarise older ones
const STORAGE_KEY = (qId: string) => `lass-ai-memory-${qId}`;

export function AIAssistantPanel({ open, onOpenChange, doc, clusters, onApplied }: {
  open: boolean; onOpenChange: (v: boolean) => void; doc: FullQuestionnaire; clusters: CareerCluster[]; onApplied: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [memorySummary, setMemorySummary] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persisted memory: load when panel opens / questionnaire changes
  useEffect(() => {
    if (!doc?.id) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(doc.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        setMsgs(parsed.msgs ?? []);
        setMemorySummary(parsed.summary ?? "");
        return;
      }
    } catch {}
    // Fresh greeting
    setMsgs([{
      role: "assistant",
      content: "Hi! I'm your questionnaire co-pilot. **Just chat with me** — ask anything:\n\n- *“What do you think of section B?”*\n- *“Is this questionnaire balanced across clusters?”*\n- *“Which questions are too vague?”*\n- *“Give me ideas for Year 10 students.”*\n\nWhen you ask me to actually **change** something (add, rewrite, set weights, delete…), I'll show you the proposed change first and only apply it if you click Apply.\n\n🧠 *I remember our conversation across sessions for this questionnaire and refresh my view of it after every change.*",
    }]);
    setMemorySummary("");
  }, [doc?.id]);

  // Persist memory whenever it changes
  useEffect(() => {
    if (!doc?.id) return;
    try {
      localStorage.setItem(STORAGE_KEY(doc.id), JSON.stringify({ msgs, summary: memorySummary }));
    } catch {}
  }, [msgs, memorySummary, doc?.id]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [msgs]);

  // Always serialize the *current* (refreshed) doc so memory of the questionnaire is never stale
  const liveSnapshot = useMemo(() => serialize(doc, clusters), [doc, clusters]);

  const buildHistoryForApi = (): { role: string; content: string }[] => {
    const visible = msgs.filter(m => m.role !== "assistant" || m.role === "assistant"); // keep all
    const out: { role: string; content: string }[] = [];
    if (memorySummary) {
      out.push({ role: "system", content: `Conversation memory so far (summary of older turns):\n${memorySummary}` });
    }
    // Include last HISTORY_KEEP turns verbatim
    const tail = visible.slice(-HISTORY_KEEP);
    for (const m of tail) {
      out.push({ role: m.role === "system" ? "system" : m.role, content: m.content });
    }
    return out;
  };

  // Background summarisation when transcript grows
  const maybeSummarise = async (next: Msg[]) => {
    if (next.length < SUMMARISE_AFTER) return;
    const older = next.slice(0, next.length - HISTORY_KEEP);
    if (!older.length) return;
    try {
      const transcript = older.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          message: `Please update the running memory summary. Combine the existing summary with the new older turns below into ONE concise (under 200 words) bullet-style memory of: (1) decisions made, (2) preferences expressed by the teacher, (3) edits already applied. Do NOT include trivial chit-chat. Reply with plain text only — no JSON, no proposal.\n\nEXISTING SUMMARY:\n${memorySummary || "(none yet)"}\n\nOLDER TURNS:\n${transcript}`,
          history: [],
          questionnaire: liveSnapshot,
          mode: "summarise",
        },
      });
      if (error || !data?.reply) return;
      setMemorySummary(String(data.reply).trim());
    } catch { /* silent */ }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    const next = [...msgs, { role: "user" as const, content: userMsg }];
    setMsgs(next);
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          message: userMsg,
          history: buildHistoryForApi(),
          questionnaire: liveSnapshot,
          memory_summary: memorySummary || undefined,
        },
      });
      if (error) throw error;
      const updated: Msg[] = [...next, { role: "assistant", content: data.reply, proposal: data.proposal ?? null }];
      setMsgs(updated);
      maybeSummarise(updated);
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
      let applied = 0;
      const skipped: string[] = [];
      for (const a of proposal.actions) {
        const res = await applyAction(a, doc, clusters);
        if (res.ok) applied++;
        else skipped.push(`${a.type}: ${res.reason}`);
      }
      if (applied === 0) {
        toast.error(`Nothing was applied. ${skipped[0] ?? ""}`);
        console.warn("AI apply skipped all actions:", skipped);
        return;
      }
      if (skipped.length) {
        toast.warning(`Applied ${applied}/${proposal.actions.length}. Skipped: ${skipped.length}`);
        console.warn("AI apply partial skips:", skipped);
      } else {
        toast.success("Changes applied!");
      }
      // Mark proposal as applied AND inject a system note so the AI's next turn knows the doc just changed.
      const note = `[system] Applied changes: ${proposal.summary}. The questionnaire snapshot has been refreshed; use the latest IDs/weights from now on.`;
      setMsgs((m) => {
        const updated = m.map((mm, i) => i === idx ? { ...mm, proposal: null, content: mm.content + "\n\n✅ *Applied.*" } : mm);
        return [...updated, { role: "system", content: note, hidden: true }];
      });
      onApplied(); // triggers reload() in the editor → doc prop refreshes → liveSnapshot recomputes
    } catch (e: any) {
      toast.error(e.message || "Failed to apply changes");
    } finally {
      setApplying(false);
    }
  };

  const reject = (idx: number) => {
    setMsgs((m) => m.map((mm, i) => i === idx ? { ...mm, proposal: null, content: mm.content + "\n\n❌ *Discarded.*" } : mm));
  };

  const clearMemory = () => {
    if (!confirm("Clear the assistant's memory for this questionnaire?")) return;
    try { localStorage.removeItem(STORAGE_KEY(doc.id)); } catch {}
    setMemorySummary("");
    setMsgs([{
      role: "assistant",
      content: "Memory cleared. Starting fresh — what would you like to work on?",
    }]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="flex items-center gap-2 font-display"><Sparkles className="h-5 w-5 text-setter" /> AI Assistant</SheetTitle>
          <SheetDescription className="flex items-center justify-between gap-2">
            <span>I propose changes — you confirm before they apply.</span>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearMemory} title="Clear conversation memory for this questionnaire">
              <Trash2 className="mr-1 h-3 w-3" /> Reset memory
            </Button>
          </SheetDescription>
          {memorySummary && (
            <div className="mt-1 flex items-start gap-1.5 rounded-md border border-border bg-secondary/40 p-2 text-[11px] text-muted-foreground">
              <Brain className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2"><strong className="text-foreground">Memory:</strong> {memorySummary}</span>
            </div>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1" ref={scrollRef as any}>
          <div className="space-y-4 p-4">
            {msgs.filter(m => !m.hidden).map((m, i) => (
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
