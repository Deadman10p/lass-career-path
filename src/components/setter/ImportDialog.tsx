import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, FileJson, FileText, Sheet as SheetIcon, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ParsedSection { title: string; description?: string; questions: string[] }

export function ImportDialog({ open, onOpenChange, questionnaireId, onImported }: {
  open: boolean; onOpenChange: (v: boolean) => void; questionnaireId: string; onImported: () => void;
}) {
  const [mode, setMode] = useState<"file" | "json">("file");
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ParsedSection[] | null>(null);

  const reset = () => { setFile(null); setJsonText(""); setPreview(null); };

  const parse = async () => {
    setBusy(true);
    try {
      let result: ParsedSection[] = [];
      if (mode === "json") {
        const j = JSON.parse(jsonText);
        result = normalizeJson(j);
      } else {
        if (!file) throw new Error("Choose a file");
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "json") {
          const txt = await file.text();
          result = normalizeJson(JSON.parse(txt));
        } else if (["pdf", "docx", "xlsx", "xls"].includes(ext || "")) {
          // upload base64 to edge function for parsing
          const buf = await file.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          const { data, error } = await supabase.functions.invoke("import-questions", {
            body: { filename: file.name, mime: file.type, base64 },
          });
          if (error) throw error;
          result = data.sections as ParsedSection[];
        } else {
          throw new Error("Unsupported file type. Use JSON, PDF, DOCX, or XLSX.");
        }
      }
      if (!result.length) throw new Error("No questions found.");
      setPreview(result);
    } catch (e: any) {
      toast.error(e.message || "Failed to parse");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      // Find current max section order
      const { data: existing } = await supabase.from("sections").select("order_index").eq("questionnaire_id", questionnaireId).order("order_index", { ascending: false }).limit(1);
      let nextOrder = (existing?.[0]?.order_index ?? -1) + 1;
      for (const sec of preview) {
        const { data: created, error } = await supabase.from("sections")
          .insert({ questionnaire_id: questionnaireId, title: sec.title, description: sec.description ?? "", order_index: nextOrder++ })
          .select().single();
        if (error) throw error;
        const rows = sec.questions.map((statement, i) => ({ section_id: created.id, statement, order_index: i }));
        if (rows.length) {
          const { error: qErr } = await supabase.from("questions").insert(rows);
          if (qErr) throw qErr;
        }
      }
      toast.success(`Imported ${preview.reduce((s, x) => s + x.questions.length, 0)} questions.`);
      onImported();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><Upload className="h-5 w-5" /> Bulk Import Questions</DialogTitle>
          <DialogDescription>Upload a file or paste JSON. The AI will extract sections and questions for you to review before insert.</DialogDescription>
        </DialogHeader>

        {!preview && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}><FileType2 className="mr-1.5 h-4 w-4" /> Upload file</Button>
              <Button variant={mode === "json" ? "default" : "outline"} onClick={() => setMode("json")}><FileJson className="mr-1.5 h-4 w-4" /> Paste JSON</Button>
            </div>
            {mode === "file" ? (
              <div className="space-y-2">
                <Label>Choose a file (JSON / PDF / DOCX / XLSX)</Label>
                <Input type="file" accept=".json,.pdf,.docx,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <div className="text-xs text-muted-foreground">
                  <strong>JSON format:</strong> <code>{`{ "sections": [{ "title": "Interests", "questions": ["…"] }] }`}</code><br />
                  <strong>XLSX:</strong> Column A = section title, Column B = question.<br />
                  <strong>PDF/DOCX:</strong> Text is extracted and grouped by headings.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>JSON</Label>
                <Textarea rows={10} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder='{"sections":[{"title":"Section A","questions":["I enjoy puzzles."]}]}' className="font-mono text-xs" />
              </div>
            )}
            <DialogFooter>
              <Button onClick={parse} disabled={busy || (mode === "file" ? !file : !jsonText.trim())}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Parse & Preview
              </Button>
            </DialogFooter>
          </>
        )}

        {preview && (
          <>
            <div className="max-h-72 overflow-auto rounded-lg border border-border bg-secondary/40 p-3">
              {preview.map((s, i) => (
                <div key={i} className="mb-3 last:mb-0">
                  <div className="font-display font-semibold">{s.title}</div>
                  {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
                  <ol className="mt-1 list-decimal pl-5 text-sm">
                    {s.questions.map((q, j) => <li key={j} className="py-0.5">{q}</li>)}
                  </ol>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {preview.length} section{preview.length === 1 ? "" : "s"} · {preview.reduce((a, s) => a + s.questions.length, 0)} questions will be appended.
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>Back</Button>
              <Button onClick={apply} disabled={busy} className="gradient-setter text-setter-foreground border-0">
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Import
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function normalizeJson(j: any): ParsedSection[] {
  if (Array.isArray(j)) {
    // array of sections
    return j.map((s) => ({ title: s.title || "Section", description: s.description, questions: (s.questions || []).map(String) }));
  }
  if (j.sections && Array.isArray(j.sections)) {
    return j.sections.map((s: any) => ({ title: s.title || "Section", description: s.description, questions: (s.questions || []).map(String) }));
  }
  if (Array.isArray(j.questions)) {
    return [{ title: j.title || "Imported Section", description: j.description, questions: j.questions.map(String) }];
  }
  throw new Error("Unrecognised JSON shape.");
}
