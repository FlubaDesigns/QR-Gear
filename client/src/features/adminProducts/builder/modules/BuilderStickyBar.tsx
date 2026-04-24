import { useState, useRef } from "react";
import { Play, FolderOpen, Plus, Bookmark, BookmarkCheck, Wand2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

interface CommandButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  testId: string;
  active?: boolean;
  disabled?: boolean;
}

function CommandButton({ icon: Icon, label, onClick, testId, active, disabled }: CommandButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 min-h-[56px] text-xs font-medium transition-colors hover-elevate active-elevate-2 ${
        active ? "text-primary" : "text-foreground"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </button>
  );
}

interface BuilderCommandStripProps {
  onOpenSaved: () => void;
  onOpenTemplates: () => void;
  onOpenOutput: () => void;
}

export function BuilderCommandStrip({ onOpenSaved, onOpenTemplates, onOpenOutput }: BuilderCommandStripProps) {
  const { state, resetBuilder } = useBuilderContext();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();
  const [draftMode, setDraftMode] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { activeSessionId } = state;
  const canSaveDraft = !!activeSessionId;

  const openDraftInput = () => {
    if (!canSaveDraft) {
      toast({ title: "No active session", description: "Select a product first to enable saving.", variant: "destructive" });
      return;
    }
    setDraftName(savedName || "");
    setDraftMode(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelDraft = () => {
    setDraftMode(false);
    setDraftName("");
  };

  const saveDraft = async () => {
    if (!activeSessionId) return;
    const name = draftName.trim();
    if (!name) { inputRef.current?.focus(); return; }
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${apiBase}/build-sessions/${activeSessionId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ draftName: name }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSavedName(name);
      setDraftMode(false);
      setDraftName("");
      toast({ title: "Draft saved", description: `"${name}" saved.` });
    } catch {
      toast({ title: "Could not save draft", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (draftMode) {
    return (
      <div
        className="sticky top-0 z-50 px-3 py-2 bg-background/95 backdrop-blur border-b flex items-center gap-2"
        data-testid="builder-command-strip"
      >
        <Input
          ref={inputRef}
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") saveDraft(); if (e.key === "Escape") cancelDraft(); }}
          placeholder="Name this draft…"
          className="flex-1 min-w-0"
          data-testid="input-command-strip-draft-name"
        />
        <Button
          size="default"
          onClick={saveDraft}
          disabled={saving || !draftName.trim()}
          data-testid="button-command-strip-save-confirm"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </Button>
        <Button size="icon" variant="ghost" onClick={cancelDraft} data-testid="button-command-strip-cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b"
      data-testid="builder-command-strip"
    >
      <div className="flex items-stretch divide-x divide-border">
        <CommandButton icon={Play} label="Resume" onClick={onOpenSaved} testId="button-strip-resume" />
        <CommandButton icon={FolderOpen} label="Templates" onClick={onOpenTemplates} testId="button-strip-templates" />
        <CommandButton icon={Plus} label="New" onClick={resetBuilder} testId="button-strip-new" />
        <CommandButton
          icon={savedName ? BookmarkCheck : Bookmark}
          label={savedName ? "Saved" : "Save"}
          onClick={openDraftInput}
          testId="button-strip-save"
          active={!!savedName}
        />
        <CommandButton icon={Wand2} label="Generate" onClick={onOpenOutput} testId="button-strip-generate" />
      </div>
    </div>
  );
}
