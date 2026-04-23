import { useState, useRef } from "react";
import { Bookmark, BookmarkCheck, Wand2, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBuilderContext } from "../BuilderContext";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

export function BuilderBottomBar() {
  const { state, autoSaveFailed } = useBuilderContext();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();
  const [draftMode, setDraftMode] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!state.selectedProduct) return null;

  const { activeSessionId, activePacketId, sessionStatus } = state;
  const canSaveDraft = !!activeSessionId;
  const hasPacket = !!activePacketId || sessionStatus === "artifact_ready" || sessionStatus === "committed";

  const scrollToCreate = () => {
    const el = document.getElementById("builder-create-section");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openDraftInput = () => {
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

  return (
    <div
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t safe-area-bottom"
      data-testid="builder-bottom-bar"
    >
      {draftMode ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <Input
            ref={inputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveDraft(); if (e.key === "Escape") cancelDraft(); }}
            placeholder="Name this draft…"
            className="flex-1 min-w-0"
            data-testid="input-bottom-bar-draft-name"
          />
          <Button
            size="default"
            onClick={saveDraft}
            disabled={saving || !draftName.trim()}
            data-testid="button-bottom-bar-save-draft-confirm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
          <Button size="icon" variant="ghost" onClick={cancelDraft} data-testid="button-bottom-bar-cancel-draft">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">
          {canSaveDraft && (
            <Button
              variant="outline"
              size="default"
              onClick={openDraftInput}
              className="flex-1 gap-1.5 text-sm"
              data-testid="button-bottom-bar-save-draft"
            >
              {savedName ? (
                <><BookmarkCheck className="h-4 w-4" /><span className="truncate max-w-[80px]">{savedName}</span></>
              ) : (
                <><Bookmark className="h-4 w-4" />Save Draft</>
              )}
            </Button>
          )}

          {hasPacket ? (
            <Button
              variant="outline"
              size="default"
              onClick={scrollToCreate}
              className="flex-1 gap-1.5 text-sm text-green-700 dark:text-green-400 border-green-500/40"
              data-testid="button-bottom-bar-view-packet"
            >
              <CheckCircle2 className="h-4 w-4" />
              View Packet
            </Button>
          ) : (
            <Button
              size="default"
              onClick={scrollToCreate}
              className="flex-1 gap-1.5 text-sm"
              data-testid="button-bottom-bar-create"
            >
              <Wand2 className="h-4 w-4" />
              Create Packet
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
