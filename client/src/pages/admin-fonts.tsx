import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Settings, Type, Plus, Trash2, Search, Loader2, Check, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

import { adminFetch } from "@/lib/adminFetch";
import { useFonts, loadGoogleFont } from "@/hooks/use-fonts";
import { AVAILABLE_FONTS, DEFAULT_FONTS, SYSTEM_FONTS, FONTS_QUERY_KEY } from "@shared/fonts";

const FONTS_PER_PAGE = 40;

function FontPreview({ font }: { font: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'waiting' | 'loading' | 'ready' | 'error'>('waiting');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => {
      setStatus('loading');
      loadGoogleFont(font).then(() => { if (active) setStatus('ready'); }, () => { if (active) setStatus('error'); });
    };
    if (typeof IntersectionObserver === 'undefined') { load(); return () => { active = false; }; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); }
    });
    if (ref.current) observer.observe(ref.current);
    return () => { active = false; observer.disconnect(); };
  }, [font, attempt]);
  return <div ref={ref} className="flex-1 min-w-0">
    <div className="text-xs text-muted-foreground">{font}{SYSTEM_FONTS.includes(font) ? ' · Device font' : ''}</div>
    {status === 'ready' ? <div className="text-lg truncate" style={{ fontFamily: font }}>The quick brown fox</div>
      : status === 'error' ? <div className="text-sm text-destructive" role="alert">Preview unavailable <Button variant="ghost" className="min-h-[44px]" onClick={() => setAttempt(n => n + 1)}>Retry {font}</Button></div>
      : <div className="text-sm text-muted-foreground" role="status">Loading preview…</div>}
  </div>;
}

function FontManagerInner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dirty = useRef(false);
  const saving = useRef(false);
  const [search, setSearch] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [localFonts, setLocalFonts] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(FONTS_PER_PAGE);
  const { data, isLoading, error, refetch } = useFonts();

  useEffect(() => {
    if (data?.fonts && !dirty.current && !saving.current) setLocalFonts(data.fonts);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (fonts: string[]) => adminFetch<{ success: boolean; fonts: string[] }>("/fonts", { method: "PUT", json: { fonts } }),
    onMutate: async () => { await queryClient.cancelQueries({ queryKey: FONTS_QUERY_KEY }); },
    onSuccess: (result) => {
      dirty.current = false;
      setLocalFonts(result.fonts);
      queryClient.setQueryData(FONTS_QUERY_KEY, { fonts: result.fonts });
      setHasChanges(false);
      toast({ title: "Fonts saved" });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => { saving.current = false; },
  });
  const saveFonts = () => {
    if (saving.current || !dirty.current || error) return;
    saving.current = true;
    saveMutation.mutate([...localFonts]);
  };
  const markChanged = () => { dirty.current = true; setHasChanges(true); };

  const addFont = useCallback((fontName: string) => {
    if (saving.current || error) return;
    if (localFonts.includes(fontName)) {
      toast({ title: "Already added", description: `${fontName} is already in your list.` });
      return;
    }
    setLocalFonts(prev => [...prev, fontName]);
    markChanged();
    toast({ title: "Font added", description: `${fontName} added to your list. Don't forget to save!` });
  }, [localFonts, toast, error]);

  const removeFont = useCallback((fontName: string) => {
    if (saving.current || error) return;
    if (localFonts.length <= 1) {
      toast({ title: "Cannot remove", description: "You need at least one font.", variant: "destructive" });
      return;
    }
    setLocalFonts(prev => prev.filter(f => f !== fontName));
    markChanged();
  }, [localFonts, toast, error]);

  const moveFont = useCallback((index: number, direction: "up" | "down") => {
    if (saving.current || error) return;
    setLocalFonts(prev => {
      const newFonts = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newFonts.length) return prev;
      [newFonts[index], newFonts[swapIndex]] = [newFonts[swapIndex], newFonts[index]];
      return newFonts;
    });
    markChanged();
  }, [error]);

  const resetToDefaults = () => {
    if (saving.current || error) return;
    setLocalFonts([...DEFAULT_FONTS]);
    markChanged();
  };

  const filteredFonts = AVAILABLE_FONTS
    .filter(f => !localFonts.includes(f))
    .filter(f => !search || f.toLowerCase().includes(search.toLowerCase()));

  const visibleFonts = filteredFonts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredFonts.length;

  useEffect(() => {
    setVisibleCount(FONTS_PER_PAGE);
  }, [search]);

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
        className="min-h-[44px]"
        disabled={saveMutation.isPending || !!error}
        onClick={resetToDefaults}
        data-testid="button-reset-fonts"
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        Defaults
      </Button>
      <Button
        size="sm"
        className="min-h-[44px]"
        onClick={saveFonts}
        disabled={!hasChanges || saveMutation.isPending || !!error}
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
      sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}
    >
        {error && <div role="alert" className="border border-destructive rounded-md p-3 mb-4">
          <p>Could not load font settings: {error.message}</p>
          <Button className="min-h-[44px]" variant="outline" onClick={() => refetch()}>Retry loading fonts</Button>
        </div>}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              Active Fonts ({localFonts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
          <div className="space-y-1">
            {localFonts.map((font, index) => (
              <div
                key={font}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border group"
                data-testid={`font-item-${font.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <FontPreview font={font} />
                <div className="order-first flex items-center gap-1 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12" aria-label={`Move ${font} up`}
                    onClick={() => moveFont(index, "up")}
                    disabled={index === 0 || saveMutation.isPending || !!error}
                    data-testid={`button-move-up-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12" aria-label={`Move ${font} down`}
                    onClick={() => moveFont(index, "down")}
                    disabled={index === localFonts.length - 1 || saveMutation.isPending || !!error}
                    data-testid={`button-move-down-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="order-first h-12 w-12" aria-label={`Remove ${font}`}
                    disabled={localFonts.length <= 1 || saveMutation.isPending || !!error}
                    onClick={() => removeFont(font)}
                    data-testid={`button-remove-${font.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              Browse Fonts ({AVAILABLE_FONTS.length.toLocaleString()} available)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">

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

          <div className="text-xs text-muted-foreground mb-2">
            Showing {Math.min(visibleCount, filteredFonts.length)} of {filteredFonts.length} fonts
            {search && ` matching "${search}"`}
          </div>

          <ScrollArea className="h-[28rem]">
            <div className="space-y-1">
              {visibleFonts.map(font => (
                <div key={font} className="flex items-center gap-2 px-3 py-2 rounded-md">
                  <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label={`Add ${font}`}
                    disabled={saveMutation.isPending || !!error} onClick={() => addFont(font)}
                    data-testid={`button-add-font-${font.replace(/\s+/g, '-').toLowerCase()}`}><Plus className="h-4 w-4" /></Button>
                  <FontPreview font={font} />
                </div>
              ))}
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
                    className="min-h-[44px]"
                    onClick={() => setVisibleCount(prev => prev + FONTS_PER_PAGE)}
                    data-testid="button-load-more-fonts"
                  >
                    Load More ({filteredFonts.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
          </CardContent>
        </Card>
    </AdminShell>
  );
}

export default function TestSettings() {
  return <FontManagerInner />;
}
