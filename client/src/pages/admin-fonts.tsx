import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Type, Plus, Trash2, GripVertical, Search, Loader2, Check, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useAdminAuth } from "@/features/shared/AdminAuthContext";
import { authFetch } from "@/features/adminAuth/authFetch";
import { loadGoogleFont, loadGoogleFonts } from "@/hooks/use-fonts";
import { GOOGLE_FONT_FAMILIES } from "@/data/google-fonts-list";

const SYSTEM_FONTS = [
  "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
  "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype",
  "Tahoma", "Lucida Console",
];

const FONTS_PER_PAGE = 40;

function FontManagerInner() {
  const { toast } = useToast();
  const { getAuthHeaders } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [localFonts, setLocalFonts] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(FONTS_PER_PAGE);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedFontsRef = useRef<Set<string>>(new Set());

  const { data, isLoading } = useQuery<{ fonts: string[] }>({
    queryKey: ["/api/fonts"],
  });

  useEffect(() => {
    if (data?.fonts) {
      setLocalFonts(data.fonts);
      loadGoogleFonts(data.fonts);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (fonts: string[]) => {
      const res = await authFetch("/api/admin/fonts", getAuthHeaders, {
        method: "PUT",
        body: JSON.stringify({ fonts }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fonts"] });
      setHasChanges(false);
      toast({ title: "Fonts saved", description: "Font list updated successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const addFont = useCallback((fontName: string) => {
    if (localFonts.includes(fontName)) {
      toast({ title: "Already added", description: `${fontName} is already in your list.` });
      return;
    }
    loadGoogleFont(fontName);
    setLocalFonts(prev => [...prev, fontName]);
    setHasChanges(true);
    toast({ title: "Font added", description: `${fontName} added to your list. Don't forget to save!` });
  }, [localFonts, toast]);

  const removeFont = useCallback((fontName: string) => {
    if (localFonts.length <= 1) {
      toast({ title: "Cannot remove", description: "You need at least one font.", variant: "destructive" });
      return;
    }
    setLocalFonts(prev => prev.filter(f => f !== fontName));
    setHasChanges(true);
  }, [localFonts, toast]);

  const moveFont = useCallback((index: number, direction: "up" | "down") => {
    setLocalFonts(prev => {
      const newFonts = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newFonts.length) return prev;
      [newFonts[index], newFonts[swapIndex]] = [newFonts[swapIndex], newFonts[index]];
      return newFonts;
    });
    setHasChanges(true);
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = [
      "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
      "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype",
    ];
    setLocalFonts(defaults);
    setHasChanges(true);
  }, []);

  const allBrowseFonts = [...SYSTEM_FONTS, ...GOOGLE_FONT_FAMILIES];
  const filteredFonts = allBrowseFonts
    .filter(f => !localFonts.includes(f))
    .filter(f => !search || f.toLowerCase().includes(search.toLowerCase()));

  const visibleFonts = filteredFonts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredFonts.length;

  useEffect(() => {
    setVisibleCount(FONTS_PER_PAGE);
  }, [search]);

  const lazyLoadFont = useCallback((fontName: string) => {
    if (SYSTEM_FONTS.includes(fontName)) return;
    if (loadedFontsRef.current.has(fontName)) return;
    loadedFontsRef.current.add(fontName);
    loadGoogleFont(fontName);
  }, []);

  if (isLoading) {
    return (
      <AdminShell title="Font Management" icon={Settings}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </div>
      </AdminShell>
    );
  }

  const actionButtons = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={resetToDefaults}
        data-testid="button-reset-fonts"
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        Defaults
      </Button>
      <Button
        size="sm"
        onClick={() => saveMutation.mutate(localFonts)}
        disabled={!hasChanges || saveMutation.isPending}
        data-testid="button-save-fonts"
      >
        {saveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Check className="h-4 w-4 mr-1" />
        )}
        Save
      </Button>
    </div>
  );

  return (
    <AdminShell
      title="Font Management"
      icon={Settings}
      subtitle={`${localFonts.length} font${localFonts.length !== 1 ? 's' : ''} active${hasChanges ? ' (unsaved changes)' : ''}`}
      actions={actionButtons}
    >
        <div className="glass-card">
          <h2 className="glass-title text-base flex items-center gap-2 mb-3">
            <Type className="h-5 w-5 text-blue-400" />
            Active Fonts ({localFonts.length})
          </h2>
          <div className="space-y-1">
            {localFonts.map((font, index) => (
              <div
                key={font}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-background/30 border border-white/5 group"
                data-testid={`font-item-${font.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{font}</div>
                  <div className="text-lg truncate" style={{ fontFamily: font }}>
                    The quick brown fox
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveFont(index, "up")}
                    disabled={index === 0}
                    data-testid={`button-move-up-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => moveFont(index, "down")}
                    disabled={index === localFonts.length - 1}
                    data-testid={`button-move-down-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFont(font)}
                    data-testid={`button-remove-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card">
          <h2 className="glass-title text-base flex items-center gap-2 mb-3">
            <Plus className="h-5 w-5 text-green-400" />
            Browse Google Fonts ({GOOGLE_FONT_FAMILIES.length.toLocaleString()} available)
          </h2>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all Google Fonts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search-fonts"
            />
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            Showing {Math.min(visibleCount, filteredFonts.length)} of {filteredFonts.length} fonts
            {search && ` matching "${search}"`}
          </div>

          <ScrollArea className="h-[28rem]" ref={scrollRef}>
            <div className="space-y-1">
              {visibleFonts.map(font => {
                const isSystem = SYSTEM_FONTS.includes(font);
                return (
                  <div
                    key={font}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => {
                      if (!isSystem) loadGoogleFont(font);
                      addFont(font);
                    }}
                    onMouseEnter={() => lazyLoadFont(font)}
                    data-testid={`button-add-font-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{font}</span>
                        {isSystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">System</span>
                        )}
                        {!isSystem && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Google</span>
                        )}
                      </div>
                      <div
                        className="text-lg truncate"
                        style={{ fontFamily: isSystem ? font : `"${font}", sans-serif` }}
                      >
                        The quick brown fox
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-green-400 flex-shrink-0" />
                  </div>
                );
              })}
              {visibleFonts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {search ? `No fonts match "${search}"` : "All fonts already added"}
                </div>
              )}
              {hasMore && (
                <div className="pt-3 pb-1 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(prev => prev + FONTS_PER_PAGE)}
                    data-testid="button-load-more-fonts"
                  >
                    Load More ({filteredFonts.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
    </AdminShell>
  );
}

export default function TestSettings() {
  return <FontManagerInner />;
}
