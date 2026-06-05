import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, Check, X, Bot, User as UserIcon, Brain, Trash2, Paperclip, ChevronDown, FileText, Image as ImageIcon, FileCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CareerCluster, FullQuestionnaire, ReportStyle } from "@/lib/types";
import ReactMarkdown from "react-markdown";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  proposal?: Proposal | null;
  hidden?: boolean; // system notes shown faintly or not at all
}

interface ProposalAction {
  type:
    | "add_question" | "edit_question" | "delete_question"
    | "add_section" | "edit_section" | "delete_section"
    | "set_weight" | "set_meta"
    | "add_cluster" | "edit_cluster" | "delete_cluster"
    | "set_cluster_profile_datum" | "remove_cluster_profile_datum"
    | "export_json"
    | "set_report_style" | "set_synthesis_style";
  section_title?: string;
  section_id?: string;
  question_id?: string;
  question_statement?: string;
  new_statement?: string;
  new_section_title?: string;
  new_section_description?: string;
  cluster_name?: string;
  name?: string;
  cluster_id?: string;
  new_name?: string;
  weight?: number;
  weights?: Record<string, number>;
  // meta
  title?: string;
  description?: string;
  is_published?: boolean;
  profile_schema?: string[];
  // cluster fields
  icon_emoji?: string;
  possible_careers?: string[];
  color_hex?: string;
  profile_attributes?: Record<string, string>;
  profile_data?: { label: string; content: string }[];
  // profile datum
  label?: string;
  content?: string;
  // export
  filename?: string;
  // report style / synthesis style
  report_style?: ReportStyle;
  synthesis_style?: string;
}

interface Proposal {
  summary: string;
  actions: ProposalAction[];
}

interface Attachment {
  name: string;
  mime: string;
  kind: "image" | "pdf" | "html" | "text";
  dataUrl?: string;
  text?: string;
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── Smart auto-scroll: only auto-follow when the user is already near the bottom.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      setAtBottom(near);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  // Auto-scroll on new messages only if user is at bottom; also observe layout growth (e.g. proposals expanding).
  useEffect(() => {
    if (atBottom) scrollToBottom("smooth");
  }, [msgs, sending, atBottom, scrollToBottom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (atBottom) scrollToBottom("auto"); });
    ro.observe(el);
    Array.from(el.children).forEach(c => ro.observe(c as Element));
    return () => ro.disconnect();
  }, [atBottom, scrollToBottom, msgs.length]);

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
    if ((!input.trim() && !attachments.length) || sending) return;
    const userMsg = input.trim() || "(see attached file)";
    const attached = attachments;
    setInput("");
    setAttachments([]);
    const attachNote = attached.length
      ? "\n\n" + attached.map(a => `📎 *${a.kind.toUpperCase()}* — ${a.name}`).join("\n")
      : "";
    const next = [...msgs, { role: "user" as const, content: userMsg + attachNote }];
    setMsgs(next);
    setSending(true);
    setAtBottom(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          message: userMsg,
          history: buildHistoryForApi(),
          questionnaire: liveSnapshot,
          memory_summary: memorySummary || undefined,
          attachments: attached,
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

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const next: Attachment[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (file.size > 12 * 1024 * 1024) { toast.error(`"${file.name}" is over 12MB`); continue; }
      const mime = file.type || "";
      const lower = file.name.toLowerCase();
      try {
        if (mime.startsWith("image/")) {
          const dataUrl = await fileToDataUrl(file);
          next.push({ name: file.name, mime, kind: "image", dataUrl });
        } else if (mime === "application/pdf" || lower.endsWith(".pdf")) {
          const dataUrl = await fileToDataUrl(file);
          next.push({ name: file.name, mime: "application/pdf", kind: "pdf", dataUrl });
        } else if (mime === "text/html" || lower.endsWith(".html") || lower.endsWith(".htm")) {
          const text = await file.text();
          next.push({ name: file.name, mime: "text/html", kind: "html", text });
        } else if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".css") || lower.endsWith(".json")) {
          const text = await file.text();
          next.push({ name: file.name, mime: mime || "text/plain", kind: "text", text });
        } else {
          toast.error(`"${file.name}" — unsupported type (HTML, image, PDF, text only)`);
        }
      } catch (e: any) {
        toast.error(`Could not read "${file.name}": ${e?.message ?? e}`);
      }
    }
    if (next.length) setAttachments(a => [...a, ...next]);
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
        <div className="relative flex-1 overflow-hidden">
          <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
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
          </div>
          {!atBottom && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => { setAtBottom(true); scrollToBottom("smooth"); }}
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card/95 px-3 shadow-md backdrop-blur"
            >
              <ChevronDown className="mr-1 h-4 w-4" /> Jump to latest
            </Button>
          )}
        </div>

        <div className="border-t border-border p-3">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={i} className="group flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 py-1 pl-2 pr-1 text-[11px]">
                  {a.kind === "image" ? <ImageIcon className="h-3 w-3" /> : a.kind === "pdf" ? <FileText className="h-3 w-3" /> : <FileCode className="h-3 w-3" />}
                  <span className="max-w-[140px] truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(arr => arr.filter((_, j) => j !== i))}
                    className="rounded-full p-0.5 hover:bg-background"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".html,.htm,text/html,image/*,application/pdf,.pdf,text/plain,.txt,.md,.json,.css"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Attach HTML / image / PDF"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask the assistant… or drop an HTML mockup, image, or PDF."
              rows={2}
              className="flex-1 resize-none"
            />
            <Button onClick={send} disabled={sending || (!input.trim() && !attachments.length)} className="gradient-setter text-setter-foreground border-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function serialize(doc: FullQuestionnaire, clusters: CareerCluster[]) {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    is_published: doc.is_published,
    profile_schema: (doc as any).profile_schema ?? [],
    report_style: (doc as any).report_style ?? {},
    synthesis_style: (doc as any).synthesis_style ?? "",
    clusters: clusters.map(c => ({
      id: c.id,
      name: c.name,
      icon_emoji: c.icon_emoji,
      description: c.description,
      possible_careers: c.possible_careers ?? [],
      color_hex: c.color_hex,
      profile_attributes: c.profile_attributes ?? {},
      profile_data: Array.isArray(c.profile_data) ? c.profile_data : [],
    })),
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

function buildImportJson(doc: FullQuestionnaire, clusters: CareerCluster[]) {
  return {
    title: doc.title,
    description: doc.description,
    profile_schema: (doc as any).profile_schema ?? [],
    clusters: clusters.map(c => ({
      name: c.name,
      icon_emoji: c.icon_emoji,
      description: c.description,
      possible_careers: c.possible_careers ?? [],
      color_hex: c.color_hex,
      profile_attributes: c.profile_attributes ?? {},
      profile_data: Array.isArray(c.profile_data) ? c.profile_data : [],
    })),
    sections: doc.sections.map(s => ({
      title: s.title,
      description: s.description,
      questions: s.questions.map(q => ({
        statement: q.statement,
        weights: Object.fromEntries(
          Object.entries(q.weights)
            .map(([cid, w]) => [clusters.find(c => c.id === cid)?.name, w])
            .filter(([n]) => !!n) as [string, number][],
        ),
      })),
    })),
  };
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function describeAction(a: ProposalAction): string {
  switch (a.type) {
    case "add_question": return `Add to "${a.section_title ?? "first section"}": "${a.question_statement}"`;
    case "edit_question": return `Rewrite question: "${a.new_statement}"`;
    case "delete_question": return `Delete a question`;
    case "add_section": return `Add section "${a.new_section_title}"`;
    case "edit_section": return `Edit section "${a.new_section_title ?? a.section_id}"`;
    case "delete_section": return `Delete a section`;
    case "set_weight": return `Set weight for "${a.cluster_name}" = ${a.weight}`;
    case "set_meta": {
      const bits = [];
      if (a.title) bits.push(`title → "${a.title}"`);
      if (a.description !== undefined) bits.push(`description updated`);
      if (typeof a.is_published === "boolean") bits.push(a.is_published ? "publish" : "unpublish");
      if (a.profile_schema) bits.push(`profile schema (${a.profile_schema.length} fields)`);
      return `Update questionnaire: ${bits.join(", ") || "metadata"}`;
    }
    case "add_cluster": return `Add cluster "${a.name ?? a.cluster_name}" ${a.icon_emoji ?? ""}`.trim();
    case "edit_cluster": return `Edit cluster "${a.cluster_name ?? a.cluster_id}"${a.new_name ? ` → "${a.new_name}"` : ""}`;
    case "delete_cluster": return `Delete cluster "${a.cluster_name ?? a.cluster_id}"`;
    case "set_cluster_profile_datum": return `Set "${a.label}" on cluster "${a.cluster_name}"`;
    case "remove_cluster_profile_datum": return `Remove "${a.label}" from cluster "${a.cluster_name}"`;
    case "export_json": return `Download import-ready JSON${a.filename ? ` (${a.filename})` : ""}`;
    case "set_report_style": {
      const keys = a.report_style ? Object.keys(a.report_style) : [];
      return `Restyle report UI (${keys.length ? keys.join(", ") : "preset"})`;
    }
    case "set_synthesis_style": return `Update profile-writing style (${(a.synthesis_style || "").length} chars of guidance)`;
  }
}


async function applyAction(
  a: ProposalAction,
  doc: FullQuestionnaire,
  clusters: CareerCluster[],
): Promise<{ ok: boolean; reason?: string }> {
  const norm = (s?: string) => (s ?? "").trim().toLowerCase();
  const findSection = (title?: string, id?: string) => {
    if (id) {
      const byId = doc.sections.find(s => s.id === id);
      if (byId) return byId;
    }
    const t = norm(title);
    if (!t) return undefined;
    return (
      doc.sections.find(s => norm(s.title) === t) ??
      doc.sections.find(s => norm(s.title).includes(t) || t.includes(norm(s.title)))
    );
  };
  const findQuestion = (id?: string, statement?: string) => {
    if (id) {
      for (const s of doc.sections) {
        const q = s.questions.find(q => q.id === id);
        if (q) return q;
      }
    }
    const t = norm(statement);
    if (!t) return undefined;
    for (const s of doc.sections) {
      const q = s.questions.find(q => norm(q.statement) === t);
      if (q) return q;
    }
    for (const s of doc.sections) {
      const q = s.questions.find(q => norm(q.statement).includes(t) || t.includes(norm(q.statement)));
      if (q) return q;
    }
    return undefined;
  };
  const findClusterId = (name?: string) => {
    const t = norm(name);
    if (!t) return undefined;
    return (
      clusters.find(c => norm(c.name) === t)?.id ??
      clusters.find(c => norm(c.name).includes(t) || t.includes(norm(c.name)))?.id
    );
  };

  try {
    if (a.type === "add_section") {
      const order = doc.sections.length;
      const { error } = await supabase.from("sections").insert({
        questionnaire_id: doc.id,
        title: a.new_section_title || "New Section",
        description: a.new_section_description || "",
        order_index: order,
      });
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "edit_section") {
      const sec = findSection(a.section_title, a.section_id);
      if (!sec) return { ok: false, reason: `section not found (${a.section_title ?? a.section_id})` };
      const patch: { title?: string; description?: string } = {};
      if (a.new_section_title) patch.title = a.new_section_title;
      if (a.new_section_description !== undefined) patch.description = a.new_section_description;
      if (!Object.keys(patch).length) return { ok: false, reason: "no changes provided" };
      const { error } = await supabase.from("sections").update(patch).eq("id", sec.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "delete_section") {
      const sec = findSection(a.section_title, a.section_id);
      if (!sec) return { ok: false, reason: `section not found` };
      const { error } = await supabase.from("sections").delete().eq("id", sec.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "add_question") {
      let sec = findSection(a.section_title, a.section_id);
      // Fallback: if no section specified or matched, use the first section (or create one)
      if (!sec) {
        if (doc.sections.length > 0) {
          sec = doc.sections[0];
        } else {
          const { data: created, error: secErr } = await supabase
            .from("sections")
            .insert({ questionnaire_id: doc.id, title: a.section_title || "Section 1", description: "", order_index: 0 })
            .select()
            .single();
          if (secErr || !created) return { ok: false, reason: secErr?.message || "could not create section" };
          sec = { ...created, questions: [] } as any;
        }
      }
      const order = sec!.questions?.length ?? 0;
      const { data: qIns, error } = await supabase.from("questions").insert({
        section_id: sec!.id,
        statement: a.question_statement || a.new_statement || "",
        order_index: order,
      }).select().single();
      if (error) return { ok: false, reason: error.message };
      // Optional weights bundled with the question
      if (qIns && a.weights && typeof a.weights === "object") {
        const rows = Object.entries(a.weights)
          .map(([name, w]) => ({ question_id: qIns.id, career_cluster_id: findClusterId(name), weight: Math.max(0, Math.min(5, Math.round(Number(w)))) }))
          .filter(r => r.career_cluster_id && Number.isFinite(r.weight)) as any[];
        if (rows.length) await supabase.from("answer_weights").upsert(rows, { onConflict: "question_id,career_cluster_id" });
      }
      return { ok: true };
    }

    if (a.type === "edit_question") {
      const q = findQuestion(a.question_id, a.question_statement);
      if (!q) return { ok: false, reason: `question not found` };
      if (!a.new_statement) return { ok: false, reason: "no new statement" };
      const { error } = await supabase.from("questions").update({ statement: a.new_statement }).eq("id", q.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "delete_question") {
      const q = findQuestion(a.question_id, a.question_statement);
      if (!q) return { ok: false, reason: `question not found` };
      const { error } = await supabase.from("questions").delete().eq("id", q.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "set_weight") {
      const q = findQuestion(a.question_id, a.question_statement);
      const cid = findClusterId(a.cluster_name);
      if (!q) return { ok: false, reason: "question not found" };
      if (!cid) return { ok: false, reason: `cluster "${a.cluster_name}" not found` };
      if (typeof a.weight !== "number") return { ok: false, reason: "weight missing" };
      const { error } = await supabase.from("answer_weights").upsert(
        { question_id: q.id, career_cluster_id: cid, weight: Math.max(0, Math.min(5, Math.round(a.weight))) },
        { onConflict: "question_id,career_cluster_id" },
      );
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "set_meta") {
      const patch: any = {};
      if (typeof a.title === "string") patch.title = a.title;
      if (typeof a.description === "string") patch.description = a.description;
      if (typeof a.is_published === "boolean") patch.is_published = a.is_published;
      if (Array.isArray(a.profile_schema)) patch.profile_schema = a.profile_schema;
      if (!Object.keys(patch).length) return { ok: false, reason: "no metadata changes" };
      const { error } = await supabase.from("questionnaires").update(patch).eq("id", doc.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "add_cluster") {
      const name = (a.name || a.cluster_name || "").trim();
      if (!name) return { ok: false, reason: "cluster name missing" };
      if (findClusterId(name)) return { ok: false, reason: `cluster "${name}" already exists` };
      const palette = ["#4F46E5","#DC2626","#0EA5E9","#10B981","#F59E0B","#8B5CF6","#EC4899"];
      const { data: ins, error } = await supabase.from("career_clusters").insert({
        name,
        icon_emoji: a.icon_emoji || "✨",
        description: a.description || "",
        possible_careers: a.possible_careers ?? [],
        color_hex: a.color_hex || palette[clusters.length % palette.length],
        profile_attributes: a.profile_attributes ?? {},
        profile_data: a.profile_data ?? [],
        questionnaire_id: doc.id,
      } as any).select().single();
      if (error || !ins) return { ok: false, reason: error?.message || "insert failed" };
      const { error: jErr } = await supabase.from("questionnaire_clusters").insert({ questionnaire_id: doc.id, career_cluster_id: ins.id });
      if (jErr) return { ok: false, reason: jErr.message };
      return { ok: true };
    }

    if (a.type === "edit_cluster") {
      const cid = a.cluster_id || findClusterId(a.cluster_name);
      if (!cid) return { ok: false, reason: `cluster not found (${a.cluster_name ?? a.cluster_id})` };
      const patch: any = {};
      if (a.new_name) patch.name = a.new_name;
      if (a.icon_emoji !== undefined) patch.icon_emoji = a.icon_emoji;
      if (a.description !== undefined) patch.description = a.description;
      if (Array.isArray(a.possible_careers)) patch.possible_careers = a.possible_careers;
      if (a.color_hex) patch.color_hex = a.color_hex;
      if (a.profile_attributes && typeof a.profile_attributes === "object") patch.profile_attributes = a.profile_attributes;
      if (Array.isArray(a.profile_data)) patch.profile_data = a.profile_data;
      if (!Object.keys(patch).length) return { ok: false, reason: "no cluster changes" };
      const { error } = await supabase.from("career_clusters").update(patch).eq("id", cid);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "delete_cluster") {
      const cid = a.cluster_id || findClusterId(a.cluster_name);
      if (!cid) return { ok: false, reason: "cluster not found" };
      await supabase.from("questionnaire_clusters").delete().eq("questionnaire_id", doc.id).eq("career_cluster_id", cid);
      const { error } = await supabase.from("career_clusters").delete().eq("id", cid);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "set_cluster_profile_datum" || a.type === "remove_cluster_profile_datum") {
      const cid = a.cluster_id || findClusterId(a.cluster_name);
      if (!cid) return { ok: false, reason: "cluster not found" };
      const cluster = clusters.find(c => c.id === cid);
      if (!cluster) return { ok: false, reason: "cluster not in snapshot" };
      const label = (a.label || "").trim();
      if (!label) return { ok: false, reason: "label missing" };
      const current = Array.isArray(cluster.profile_data) ? [...cluster.profile_data] : [];
      const idx = current.findIndex((d: any) => String(d?.label ?? "").trim().toLowerCase() === label.toLowerCase());
      if (a.type === "remove_cluster_profile_datum") {
        if (idx === -1) return { ok: false, reason: "label not found" };
        current.splice(idx, 1);
      } else {
        const content = (a.content || "").trim();
        if (!content) return { ok: false, reason: "content missing" };
        if (idx === -1) current.push({ label, content });
        else current[idx] = { label, content };
      }
      const { error } = await supabase.from("career_clusters").update({ profile_data: current } as any).eq("id", cid);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "export_json") {
      const fname = (a.filename && a.filename.trim()) || `${(doc.title || "questionnaire").replace(/[^\w.-]+/g, "-").toLowerCase()}.json`;
      const json = buildImportJson(doc, clusters);
      downloadJson(fname, json);
      return { ok: true };
    }

    if (a.type === "set_report_style") {
      if (!a.report_style || typeof a.report_style !== "object") return { ok: false, reason: "report_style missing" };
      // Merge with whatever is already saved so partial proposals don't wipe other keys.
      const current = ((doc as any).report_style ?? {}) as Record<string, any>;
      const merged = sanitizeReportStyle({ ...current, ...a.report_style });
      const { error } = await supabase.from("questionnaires").update({ report_style: merged } as any).eq("id", doc.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    if (a.type === "set_synthesis_style") {
      if (typeof a.synthesis_style !== "string") return { ok: false, reason: "synthesis_style missing" };
      const { error } = await supabase.from("questionnaires").update({ synthesis_style: a.synthesis_style } as any).eq("id", doc.id);
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    }

    return { ok: false, reason: `unknown action ${(a as any).type}` };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "exception" };
  }
}

function sanitizeReportStyle(style: ReportStyle): ReportStyle {
  const clean: ReportStyle = { ...style };
  if (clean.accent && clean.accent.includes("--lass-cluster-dominant-color")) {
    clean.accent = "var(--lass-cluster-dominant-color)";
  }
  if (clean.customCss) {
    clean.customCss = clean.customCss
      .replace(/<\/?style[^>]*>/gi, "")
      .replace(/@import[^;]+;/gi, "")
      .replace(/(^|})\s*(html|body|h[1-6]|p|div|section|span)\s*\{[^}]*\}/gi, "$1")
      .replace(/\.lass-report-skin\s+(h[1-6]|p|div|section|span|body|html)\s*\{[^}]*\}/gi, "")
      .replace(/--(background|foreground|card|card-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|border|ring|student|setter|brand-red|brand-blue|brand-black)\s*:[^;]+;/gi, "")
      .trim();
  }
  return clean;
}

