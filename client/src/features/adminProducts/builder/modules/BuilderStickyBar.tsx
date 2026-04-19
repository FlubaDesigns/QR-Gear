import { useState, useRef } from "react";
import { Loader2, CheckCircle2, Clock, ChevronsDownUp, ChevronsUpDown, Bookmark, BookmarkCheck, X, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBuilderContext } from "../BuilderContext";
import { useCollapseAll } from "@/features/shared/components/CollapsibleModule";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { useToast } from "@/hooks/use-toast";

export function BuilderStickyBar() {
  const { state, autoSaveFailed } = useBuilderContext();
  const { collapseAll, expandAll } = useCollapseAll();
  const { getAuthHeaders, apiBase } = useAdminAuth();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draftMode, setDraftMode] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedName, setSavedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!state.selectedProduct) return null;

  const { activeSessionId, activePacketId, sessionStatus } = state;
  const productTitle = state.selectedProduct.title;
  const brand = state.selectedProduct.brand;
  const canSaveDraft = !!activeSessionId;

  const handleToggle = () => {
    if (isCollapsed) {
      expandAll();
      setIsCollapsed(false);
    } else {
      collapseAll();
      setIsCollapsed(true);
    }
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
    if (!name) {
      inputRef.current?.focus();
      return;
    }
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
      toast({ title: "Draft saved", description: `"${name}" will appear on your Run dashboard.` });
    } catch {
      toast({ title: "Could not save draft", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="sticky top-0 z-50 px-3 py-2 bg-background/95 backdrop-blur border-b"
      data-testid="builder-sticky-bar"
    >
      {draftMode && canSaveDraft ? (
        <div className="flex items-center gap-2 w-full">
          <Input
            ref={inputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") saveDraft(); if (e.key === "Escape") cancelDraft(); }}
            placeholder="Name this draft…"
            className="flex-1 min-w-0 h-8 text-sm px-3"
            data-testid="input-draft-name"
          />
          <Button
            size="sm"
            onClick={saveDraft}
            disabled={saving || !draftName.trim()}
            data-testid="button-save-draft-confirm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={cancelDraft}
            data-testid="button-cancel-draft"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium truncate leading-tight"
            data-testid="sticky-bar-product-title"
          >
            {productTitle}
          </p>
          {brand && (
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {brand}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            data-testid="button-collapse-all"
            className="text-xs text-muted-foreground gap-1.5"
          >
            {isCollapsed ? (
              <>
                <ChevronsUpDown className="h-3.5 w-3.5" />
                Expand All
              </>
            ) : (
              <>
                <ChevronsDownUp className="h-3.5 w-3.5" />
                Collapse All
              </>
            )}
          </Button>

          {canSaveDraft && (
            <Button
              variant={savedName ? "ghost" : "outline"}
              size="sm"
              onClick={openDraftInput}
              data-testid="button-save-draft"
              className={`text-xs gap-1.5 ${savedName ? "text-primary" : ""}`}
            >
              {savedName ? (
                <>
                  <BookmarkCheck className="h-3.5 w-3.5" />
                  <span className="truncate max-w-24">{savedName}</span>
                </>
              ) : (
                <>
                  <Bookmark className="h-3.5 w-3.5" />
                  Name draft
                </>
              )}
            </Button>
          )}

          {activeSessionId === null && state.selectedProduct && (
            <Badge variant="outline" className="text-xs gap-1" data-testid="sticky-badge-starting">
              <Loader2 className="h-3 w-3 animate-spin" />
              Starting…
            </Badge>
          )}
          {activeSessionId && sessionStatus === "working" && !autoSaveFailed && (
            <Badge variant="outline" className="text-xs gap-1" data-testid="sticky-badge-working">
              <Clock className="h-3 w-3 text-amber-500" />
              In progress
            </Badge>
          )}
          {autoSaveFailed && (
            <Badge variant="outline" className="text-xs gap-1 border-red-500/40 text-red-600 dark:text-red-400" data-testid="sticky-badge-save-failed">
              <AlertTriangle className="h-3 w-3" />
              Save failed
            </Badge>
          )}
          {activeSessionId && sessionStatus === "artifact_ready" && (
            <Badge
              variant="outline"
              className="text-xs gap-1 border-green-500/40 text-green-700 dark:text-green-400"
              data-testid="sticky-badge-artifact-ready"
            >
              <CheckCircle2 className="h-3 w-3" />
              Packet ready
            </Badge>
          )}
          {activeSessionId && sessionStatus === "committed" && (
            <Badge
              variant="outline"
              className="text-xs gap-1 border-blue-500/40 text-blue-700 dark:text-blue-400"
              data-testid="sticky-badge-committed"
            >
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
