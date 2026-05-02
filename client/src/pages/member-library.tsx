import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import SEO from "@/components/SEO";
import {
  ArrowLeft, Library, Package, Loader2, Pencil, RotateCcw,
  Save, X, ChevronRight, Info, Image as ImageIcon,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResolvedFields {
  title?: string;
  description?: string;
  images?: Array<{ url: string; altText?: string } | string>;
  category?: string;
  colors?: string[];
  sizes?: string[];
}

interface MemberLibraryInstance {
  id: string;
  ownerMemberId: string;
  sourceMasterId: string;
  sourceAdminInstanceId: string | null;
  overrides: {
    title?: string;
    description?: string;
  };
  resolved: ResolvedFields;
  baseSnapshot: ResolvedFields;
  status: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  currentPacketId?: string | null;
}

// ─── Authenticated fetch to /api/member/* ────────────────────────────────────

async function memberApiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`/api${path}`, { ...init, headers });

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.error || err?.message || "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(
      `${init.method ?? "GET"} /api${path} → ${res.status}${detail ? ` — ${detail}` : ""}`
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Image helper ─────────────────────────────────────────────────────────────

function getFirstImageUrl(images?: ResolvedFields["images"]): string | null {
  if (!images || images.length === 0) return null;
  const first = images[0];
  if (typeof first === "string") return first;
  return first?.url ?? null;
}

// ─── Item card ────────────────────────────────────────────────────────────────

function LibraryItemCard({
  instance,
  onClick,
}: {
  instance: MemberLibraryInstance;
  onClick: () => void;
}) {
  const title = instance.overrides?.title || instance.resolved?.title || "Untitled Item";
  const description = instance.overrides?.description || instance.resolved?.description || "";
  const imageUrl = getFirstImageUrl(instance.resolved?.images);
  const hasCustomTitle = !!instance.overrides?.title;
  const hasCustomDesc = !!instance.overrides?.description;
  const isPersonalized = hasCustomTitle || hasCustomDesc;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden hover-elevate transition-all group"
      data-testid={`library-item-${instance.id}`}
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-slate-700/50 flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="w-10 h-10 text-slate-500" />
        )}

        {/* Status badge */}
        <Badge
          className={`absolute top-2 right-2 text-[10px] px-1.5 py-0 ${
            instance.status === "active"
              ? "bg-emerald-600 text-white"
              : instance.status === "draft"
              ? "bg-amber-500 text-white"
              : "bg-slate-600 text-white"
          }`}
        >
          {instance.status}
        </Badge>

        {/* Personalized indicator */}
        {isPersonalized && (
          <Badge className="absolute top-2 left-2 text-[10px] px-1.5 py-0 bg-blue-600 text-white">
            Personalized
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-white leading-tight line-clamp-2 flex-1">
            {title}
          </p>
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 group-hover:text-slate-300 transition-colors" />
        </div>
        {description && (
          <p className="text-xs text-slate-400 line-clamp-2">{description}</p>
        )}
        {instance.resolved?.category && (
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">
            {instance.resolved.category}
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Edit panel ──────────────────────────────────────────────────────────────

function EditPanel({
  instance,
  onClose,
  onSaved,
}: {
  instance: MemberLibraryInstance;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();

  const baseTitle = instance.resolved?.title || "";
  const baseDesc = instance.resolved?.description || "";

  const [title, setTitle] = useState(instance.overrides?.title ?? baseTitle);
  const [description, setDescription] = useState(
    instance.overrides?.description ?? baseDesc
  );

  const hasChanges =
    title !== (instance.overrides?.title ?? baseTitle) ||
    description !== (instance.overrides?.description ?? baseDesc);

  const isCustomized =
    !!instance.overrides?.title || !!instance.overrides?.description;

  const imageUrl = getFirstImageUrl(instance.resolved?.images);
  const allImages = instance.resolved?.images ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const overrides: Record<string, string> = {};
      if (title.trim() !== baseTitle) overrides.title = title.trim();
      if (description.trim() !== baseDesc) overrides.description = description.trim();

      return memberApiFetch(`/member/library-instances/${instance.id}`, {
        method: "PATCH",
        body: JSON.stringify({ overrides }),
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Your personalized version has been saved." });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      return memberApiFetch(`/member/library-instances/${instance.id}`, {
        method: "PATCH",
        body: JSON.stringify({ overrides: {} }),
      });
    },
    onSuccess: () => {
      setTitle(baseTitle);
      setDescription(baseDesc);
      toast({ title: "Reset", description: "Restored to the original version." });
      onSaved();
    },
    onError: (err: Error) => {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" data-testid="edit-panel-overlay">
      {/* Backdrop */}
      <button
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close panel"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-white text-sm">Personalize Item</span>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-panel">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info banner */}
          <div className="flex gap-2 p-3 bg-blue-900/30 border border-blue-700/40 rounded-lg">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-200 leading-relaxed">
              You're editing <strong>your personal copy</strong> of this item. The original
              version from the catalog is never changed — only your overrides are saved.
            </p>
          </div>

          {/* Image preview */}
          {allImages.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                Images ({allImages.length})
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.slice(0, 6).map((img, i) => {
                  const url = typeof img === "string" ? img : img?.url;
                  return url ? (
                    <img
                      key={i}
                      src={url}
                      alt={`Item image ${i + 1}`}
                      className="h-20 w-20 object-cover rounded-md shrink-0 border border-slate-700"
                    />
                  ) : null;
                })}
              </div>
            </div>
          )}

          <Separator className="bg-slate-700/50" />

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 uppercase tracking-wide" htmlFor="item-title">
              Title
            </label>
            <Input
              id="item-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={baseTitle || "Enter a title…"}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
              data-testid="input-item-title"
            />
            {baseTitle && title !== baseTitle && (
              <p className="text-[10px] text-slate-500">
                Original: <span className="text-slate-400">{baseTitle}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300 uppercase tracking-wide" htmlFor="item-description">
              Description
            </label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={baseDesc || "Add a description…"}
              rows={4}
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-blue-500 resize-none"
              data-testid="input-item-description"
            />
          </div>

          {/* Read-only metadata */}
          {(instance.resolved?.category ||
            (instance.resolved?.colors ?? []).length > 0 ||
            (instance.resolved?.sizes ?? []).length > 0) && (
            <div className="space-y-3">
              <Separator className="bg-slate-700/50" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Catalog Details (read-only)
              </p>
              {instance.resolved?.category && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-20 shrink-0">Category</span>
                  <Badge className="bg-slate-700 text-slate-300 text-[10px]">
                    {instance.resolved.category}
                  </Badge>
                </div>
              )}
              {(instance.resolved?.colors ?? []).length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-slate-500 w-20 shrink-0 pt-0.5">Colors</span>
                  <div className="flex flex-wrap gap-1">
                    {(instance.resolved.colors ?? []).map((c) => (
                      <Badge key={c} className="bg-slate-700 text-slate-300 text-[10px]">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(instance.resolved?.sizes ?? []).length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-slate-500 w-20 shrink-0 pt-0.5">Sizes</span>
                  <div className="flex flex-wrap gap-1">
                    {(instance.resolved.sizes ?? []).map((s) => (
                      <Badge key={s} className="bg-slate-700 text-slate-300 text-[10px]">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-700 px-5 py-4 flex items-center justify-between gap-3">
          {isCustomized && (
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || saveMutation.isPending}
              data-testid="button-reset-to-original"
            >
              {resetMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
              )}
              Reset to original
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={saveMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white"
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              data-testid="button-save-item"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MemberLibraryPage() {
  const { firebaseUser, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<MemberLibraryInstance | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<{ success: boolean; instances: MemberLibraryInstance[]; count: number }>({
    queryKey: ["/api/member/library-instances"],
    queryFn: () => memberApiFetch("/member/library-instances"),
    enabled: !!firebaseUser,
    retry: 1,
  });

  const instances = data?.instances ?? [];

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/member/library-instances"] });
    setSelected(null);
  };

  // ── Auth guard ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}
      >
        <Card className="bg-slate-800/80 border-slate-700 max-w-sm w-full mx-4">
          <CardContent className="p-8 text-center">
            <Library className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h2 className="text-white font-semibold mb-2">Sign in required</h2>
            <p className="text-slate-400 text-sm mb-4">
              Please sign in to view your library.
            </p>
            <Button onClick={() => setLocation("/login")} data-testid="button-sign-in">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <SEO title="My Library | QR Gear" description="Your personalized product library" />

      <div
        className="min-h-screen"
        style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)" }}
      >
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/60 px-4 py-3 flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/members")}
            className="text-slate-400 hover:text-white shrink-0"
            data-testid="button-back-to-hub"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <Library className="w-5 h-5 text-blue-400 shrink-0" />
            <h1 className="text-white font-semibold text-base truncate">My Library</h1>
            {instances.length > 0 && (
              <Badge className="bg-slate-700 text-slate-300 text-[10px] shrink-0">
                {instances.length}
              </Badge>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Intro card */}
          <Card className="bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-blue-700/40">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
                <Library className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm mb-0.5">Your Product Library</h2>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Items here have been added to your library by the QR Gear team. You can
                  personalize the title and description of each item — your changes only affect
                  your copy. Tap any item to edit it.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <Card className="bg-slate-800/60 border-red-700/40">
              <CardContent className="p-8 text-center">
                <p className="text-red-400 text-sm mb-3">Could not load your library items.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetch()}
                  data-testid="button-retry"
                >
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!isLoading && !isError && instances.length === 0 && (
            <Card className="bg-slate-800/60 border-slate-700 border-dashed">
              <CardContent className="p-12 text-center">
                <Library className="w-14 h-14 mx-auto mb-4 text-slate-600" />
                <h3 className="text-lg font-semibold text-white mb-2">Your library is empty</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">
                  Items will appear here when the QR Gear team adds products to your library.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Grid */}
          {!isLoading && instances.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {instances.map((instance) => (
                <LibraryItemCard
                  key={instance.id}
                  instance={instance}
                  onClick={() => setSelected(instance)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit panel */}
      {selected && (
        <EditPanel
          instance={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
