import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings, Type, Plus, Trash2, GripVertical, Search, Loader2, Check, X, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AdminAuthProvider, useAdminAuth } from "@/features/shared/AdminAuthContext";
import { loadGoogleFont, loadGoogleFonts } from "@/hooks/use-fonts";

const POPULAR_GOOGLE_FONTS = [
  "Roboto", "Open Sans", "Lato", "Montserrat", "Oswald", "Raleway",
  "Poppins", "Nunito", "Ubuntu", "Playfair Display", "Merriweather",
  "PT Sans", "Roboto Condensed", "Roboto Slab", "Inter", "Noto Sans",
  "Fira Sans", "Quicksand", "Mulish", "Barlow", "Rubik", "Work Sans",
  "Libre Baskerville", "Josefin Sans", "Archivo", "Bebas Neue",
  "Dancing Script", "Pacifico", "Lobster", "Righteous", "Permanent Marker",
  "Bangers", "Bungee", "Press Start 2P", "Orbitron", "Creepster",
  "Special Elite", "Sacramento", "Great Vibes", "Caveat", "Comfortaa",
  "Abril Fatface", "Fredoka One", "Alfa Slab One", "Anton", "Lilita One",
  "Passion One", "Titan One", "Black Ops One", "Russo One", "Teko",
];

const SYSTEM_FONTS = [
  "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
  "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype",
  "Tahoma", "Lucida Console",
];

function FontManagerInner() {
  const { toast } = useToast();
  const { getAuthHeaders } = useAdminAuth();
  const [search, setSearch] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localFonts, setLocalFonts] = useState<string[]>([]);

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
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/fonts", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ fonts }),
      });
      if (!res.ok) throw new Error(await res.text());
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

  const allAvailableFonts = [...SYSTEM_FONTS, ...POPULAR_GOOGLE_FONTS];
  const browseFonts = allAvailableFonts
    .filter(f => !localFonts.includes(f))
    .filter(f => !search || f.toLowerCase().includes(search.toLowerCase()));

  if (isLoading) {
    return (
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <div className="glass-card flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
            <h1 className="glass-title text-lg flex items-center gap-2" data-testid="text-page-title">
              <Settings className="h-5 w-5 text-blue-400" />
              Font Management
            </h1>
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
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {localFonts.length} font{localFonts.length !== 1 ? 's' : ''} active
            {hasChanges && <span className="text-amber-400 ml-2">(unsaved changes)</span>}
          </p>
        </div>

        <div className="glass-card">
          <h2 className="glass-title text-base flex items-center gap-2 mb-3">
            <Type className="h-5 w-5 text-blue-400" />
            Active Fonts
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
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 className="glass-title text-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-400" />
              Add Fonts
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBrowser(!showBrowser)}
              data-testid="button-toggle-browser"
            >
              {showBrowser ? "Hide" : "Browse"} Google Fonts
            </Button>
          </div>

          {showBrowser && (
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search fonts..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-fonts"
                />
              </div>
              <ScrollArea className="h-80">
                <div className="space-y-1">
                  {browseFonts.map(font => {
                    const isSystem = SYSTEM_FONTS.includes(font);
                    return (
                      <div
                        key={font}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-md hover-elevate cursor-pointer"
                        onClick={() => {
                          if (!isSystem) loadGoogleFont(font);
                          addFont(font);
                        }}
                        data-testid={`button-add-font-${font.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
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
                            onMouseEnter={() => { if (!isSystem) loadGoogleFont(font); }}
                          >
                            The quick brown fox
                          </div>
                        </div>
                        <Plus className="h-4 w-4 text-green-400 flex-shrink-0" />
                      </div>
                    );
                  })}
                  {browseFonts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {search ? "No fonts match your search" : "All fonts already added"}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {!showBrowser && (
            <p className="text-sm text-muted-foreground">
              Click "Browse Google Fonts" to search and add from 50+ popular fonts including system fonts and Google web fonts.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TestSettings() {
  return (
    <AdminAuthProvider apiBase="/api">
      <FontManagerInner />
    </AdminAuthProvider>
  );
}
