import { BLD_LAYOUTS } from "@shared/bldCodes";
import { buildWorkingSnapshot, productGraphicOptions } from '@shared/builderSnapshot';
import type { RenderOptions } from '@/features/shared/graphics/productGraphicRenderer';
import { useRef, useState, useCallback } from "react";
import { Type, Move, Maximize2, Upload, X, ImageIcon, Loader2, FolderOpen, Save, ArrowUp, ArrowDown } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { useBuilderContext } from "../BuilderContext";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "@/features/shared/components/TextStyleEditor";
import { GraphicPreviewView } from "@/features/shared/components/skins/GraphicPreviewView";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/numeric-input";
import { ImageLibraryDialog } from "@/features/shared/components/ImageLibraryDialog";
import { SaveImageToLibraryDialog } from "@/features/shared/components/SaveImageToLibraryDialog";
import { useAdminImageUpload } from "@/features/shared/adminImageLibrary";
import { IMAGE_LIBRARY_ACCEPT } from "@shared/imageLibrary";
import {
  MIN_SAFE_QR_SIZE_PERCENT,
  clampQrPercent,
  sanitizeQrReadableContent,
  getQrSafetyAssessment,
  getQrSafetyClasses,
} from "@/features/adminProducts/shared/qrSafety";

const headerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };
const footerDefaultStyle: TextStyleConfig = { ...defaultTextStyle, text: "", enabled: false };

type ZoneId = "top" | "bottom";

function ZoneEditor({
  state,
  setContent,
  openLibraryFor,
  setSaveImageDataUrl,
}: {
  state: any;
  setContent: (updates: any) => void;
  openLibraryFor: (target: "header" | "footer" | "area") => void;
  setSaveImageDataUrl: (url: string | null) => void;
}) {
  const [activeZone, setActiveZone] = useState<ZoneId>("top");

  const zoneConfig: Record<ZoneId, {
    label: string;
    sublabel: string;
    stateKey: "headerStyle" | "footerStyle";
    libraryTarget: "header" | "footer";
    icon: typeof ArrowUp;
  }> = {
    top: {
      label: "Top Zone",
      sublabel: "Appears at top of graphic",
      stateKey: "headerStyle",
      libraryTarget: "header",
      icon: ArrowUp,
    },
    bottom: {
      label: "Bottom Zone",
      sublabel: "Appears at bottom of graphic",
      stateKey: "footerStyle",
      libraryTarget: "footer",
      icon: ArrowDown,
    },
  };

  const zone = zoneConfig[activeZone];
  const currentStyle = (state.content?.[zone.stateKey] as TextStyleConfig) || headerDefaultStyle;

  return (
    <div className="space-y-3">
      <div className="inline-flex gap-1 p-1 bg-muted rounded-md" data-testid="toggle-zone-selector">
        {(Object.keys(zoneConfig) as ZoneId[]).map((id) => {
          const z = zoneConfig[id];
          const Icon = z.icon;
          const style = (state.content?.[z.stateKey] as TextStyleConfig);
          const isActive = style?.enabled && style?.text?.trim();
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveZone(id)}
              className={`flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-sm text-sm font-medium transition-colors ${
                activeZone === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`button-zone-${id}`}
            >
              <Icon className="h-4 w-4" />
              {z.label}
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      <TextStyleEditor
        key={zone.stateKey}
        label={zone.label}
        sublabel={zone.sublabel}
        maxLength={40}
        style={currentStyle}
        onChange={(updates) => setContent({
          [zone.stateKey]: {
            ...currentStyle,
            ...updates,
          },
        })}
        testIdPrefix={zone.libraryTarget}
        showPositionControls={true}
        previewBackgroundColor={state.selectedColor?.hex || '#1a1a2e'}
        onPickFromLibrary={() => openLibraryFor(zone.libraryTarget)}
        onSaveToLibrary={() => {
          const img = currentStyle?.imageUrl;
          if (img?.startsWith("data:")) setSaveImageDataUrl(img);
        }}
        inline={true}
      />
    </div>
  );
}

export function ProductGraphicTextModule() {
  const imageUpload = useAdminImageUpload();
  const { state, setContent, selectedRole, selectedStore, selectedChannel, selectedCollection } = useBuilderContext();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTarget, setLibraryTarget] = useState<"header" | "footer" | "area" | null>(null);
  const [saveImageDataUrl, setSaveImageDataUrl] = useState<string | null>(null);
  const adminAreaFileRef = useRef<HTMLInputElement>(null);
  const [isAreaUploading, setIsAreaUploading] = useState(false);

  const openLibraryFor = useCallback((target: "header" | "footer" | "area") => {
    setLibraryTarget(target);
    setLibraryOpen(true);
  }, []);

  const handleLibrarySelect = useCallback((url: string) => {
    if (libraryTarget === "header") {
      setContent({ headerStyle: { ...((state.content?.headerStyle as TextStyleConfig) || headerDefaultStyle), imageUrl: url, mode: "image" } });
    } else if (libraryTarget === "footer") {
      setContent({ footerStyle: { ...((state.content?.footerStyle as TextStyleConfig) || footerDefaultStyle), imageUrl: url, mode: "image" } });
    } else if (libraryTarget === "area") {
      setContent({ areaImageUrl: url, areaImageMode: state.content?.areaImageMode || 'behind-qr' });
    }
  }, [libraryTarget, state.content, setContent]);

  const showGraphicText = state.qrProductState === "qr_plus" ||
                          state.qrProductState === "qr_canvas" || 
                          state.qrProductState === "qr_play" || 
                          state.qrProductState === "qr_compose";

  if (!showGraphicText || !state.selectedProduct || !state.content) {
    return null;
  }

  const posX = state.content.qrPositionX ?? 50;
  const posY = state.content.qrPositionY ?? 0;
  const sizeVal = state.content.qrSizePercent ?? 75;
  const adminAreaImageUrl = state.content.areaImageUrl || '';
  const adminAreaImageMode = state.content.areaImageMode || 'behind-qr';
  const areaOffX = state.content.areaImageOffsetX ?? 50;
  const areaOffY = state.content.areaImageOffsetY ?? 50;
  const areaSc = state.content.areaImageScale ?? 100;

  const handleAdminAreaImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (adminAreaFileRef.current) adminAreaFileRef.current.value = "";
    setIsAreaUploading(true);
    try {
      const uploaded = await imageUpload.mutateAsync({ files: [{ file, name: file.name }], folder: 'area-images' });
      if (uploaded.failed.length) throw new Error(uploaded.failed[0].message);
      const result = uploaded.uploaded[0];
      if (!result?.publicUrl) throw new Error("Upload succeeded but no public URL was returned");
      setContent({ areaImageUrl: result.publicUrl, areaImageMode: adminAreaImageMode });
    } catch (err: any) {
      console.error("[AreaImage] Upload failed:", err);
      alert(`Image upload failed: ${err.message || "Unknown error"}. Please try again.`);
    } finally {
      setIsAreaUploading(false);
    }
  };

  const hasHeaderContent = (state.content.headerStyle as TextStyleConfig)?.enabled;
  const hasFooterContent = (state.content.footerStyle as TextStyleConfig)?.enabled;
  const showPreview = hasHeaderContent || hasFooterContent || !!adminAreaImageUrl || state.content.subBottomStyle?.enabled;
  let previewOptions: RenderOptions | undefined;
  let previewError: string | null = null;
  if (showPreview) {
    try {
      const snapshot = buildWorkingSnapshot(state, { selectedRole, selectedStore, selectedChannel, selectedCollection });
      previewOptions = productGraphicOptions(snapshot, state.content.url || 'https://qrgear.app') as RenderOptions;
      if (!previewOptions.providerLayout?.dimensions) throw new Error('Select a print placement to preview its actual dimensions.');
    } catch (error) { previewError = error instanceof Error ? error.message : String(error); }
  }

  const isZoneMode = state.content.graphicLayoutMode === "zone";
  const effectiveQrSizePercent = isZoneMode ? sizeVal / 2 : sizeVal;

  const qrSafety = getQrSafetyAssessment({
    qrSizePercent: effectiveQrSizePercent,
    subBottomEnabled: state.content.subBottomStyle?.enabled || false,
    headerEnabled: !!hasHeaderContent,
    footerEnabled: !!hasFooterContent,
  });

  const qrSafetyClasses = getQrSafetyClasses(qrSafety.status);

  const safeSetContent = (updates: Partial<typeof state.content>) => {
    setContent(sanitizeQrReadableContent(updates));
  };

  return (
    <CollapsibleModule
      title="Graphic Design"
      icon={<Type className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose how to design your product graphic. {BLD_LAYOUTS.Z} locks text to top/bottom. {BLD_LAYOUTS.P} lets you freely position the QR and add an image.
        </p>

        <div className="inline-flex gap-1 p-1 bg-muted rounded-md w-full" data-testid="toggle-layout-mode">
          <button
            type="button"
            onClick={() => setContent({ graphicLayoutMode: "zone" })}
            className={`flex-1 flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-sm text-sm font-medium transition-colors ${
              state.content.graphicLayoutMode === "zone"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-layout-zone"
          >
            <Maximize2 className="h-4 w-4" />
            {BLD_LAYOUTS.Z}
          </button>
          <button
            type="button"
            onClick={() => setContent({ graphicLayoutMode: "freeform" })}
            className={`flex-1 flex items-center justify-center gap-2 px-3 min-h-[44px] rounded-sm text-sm font-medium transition-colors ${
              state.content.graphicLayoutMode === "freeform"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-testid="button-layout-freeform"
          >
            <Move className="h-4 w-4" />
            {BLD_LAYOUTS.P}
          </button>
        </div>

        {!state.content.graphicLayoutMode && (
          <p className="text-sm text-muted-foreground py-1">
            Tap {BLD_LAYOUTS.Z} or {BLD_LAYOUTS.P} to get started.
          </p>
        )}

        {state.content.graphicLayoutMode === "zone" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">QR Size</p>
              <div className="flex gap-2">
                {([['S', 50], ['M', 75], ['L', 90], ['XL', 110]] as const).map(([label, val]) => (
                  <Button
                    key={label}
                    variant={sizeVal === val ? 'default' : 'outline'}
                    size="default"
                    className="flex-1"
                    onClick={() => setContent({ qrSizePercent: val })}
                    data-testid={`button-zone-qr-preset-${label.toLowerCase()}`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" /> Custom
                  </Label>
                  <span className="text-xs text-muted-foreground" data-testid="text-admin-zone-qr-size">{Math.round(sizeVal / 2)}% of width</span>
                </div>
                <Slider
                  value={[sizeVal]}
                  onValueChange={([v]) => setContent({ qrSizePercent: v })}
                  min={40}
                  max={110}
                  step={2}
                  data-testid="slider-admin-zone-qr-size"
                />
              </div>
            </div>
            <ZoneEditor
              state={state}
              setContent={setContent}
              openLibraryFor={openLibraryFor}
              setSaveImageDataUrl={setSaveImageDataUrl}
            />
            <div className="pt-3 border-t">
              <TextStyleEditor
                label="Sub-Bottom CTA"
                sublabel="Small label below QR code (max 20 chars)"
                maxLength={20}
                style={state.content.subBottomStyle}
                onChange={(updates) => setContent({ subBottomStyle: { ...state.content.subBottomStyle, ...updates } })}
                testIdPrefix="sub-bottom"
                showPositionControls={false}
                showPreview={false}
                defaultCollapsed={false}
              />
            </div>
          </div>
        )}

        {state.content.graphicLayoutMode === "freeform" && (
          <div className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">QR Position</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5" /> Left / Right
                  </Label>
                  <span className="text-xs text-muted-foreground" data-testid="text-admin-qr-pos-x">{posX}%</span>
                </div>
                <Slider
                  value={[posX]}
                  onValueChange={([v]) => setContent({ qrPositionX: v })}
                  min={0}
                  max={100}
                  step={1}
                  data-testid="slider-admin-qr-position-x"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5" /> Up / Down
                  </Label>
                  <span className="text-xs text-muted-foreground" data-testid="text-admin-qr-pos-y">{posY}%</span>
                </div>
                <Slider
                  value={[posY]}
                  onValueChange={([v]) => setContent({ qrPositionY: v })}
                  min={0}
                  max={100}
                  step={1}
                  data-testid="slider-admin-qr-position-y"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => safeSetContent({ qrPositionX: 50, qrPositionY: 50, qrSizePercent: 75 })}
                data-testid="button-admin-reset-qr-position"
              >
                Reset Position
              </Button>
            </div>

            <div className="space-y-3 pt-3 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">QR Size</p>
              <div className="flex gap-2">
                {([['S', 32], ['M', 38], ['L', 42], ['XL', 50]] as const).map(([label, val]) => (
                  <Button
                    key={label}
                    variant={sizeVal === val ? 'default' : 'outline'}
                    size="default"
                    className="flex-1"
                    onClick={() => safeSetContent({ qrSizePercent: val })}
                    data-testid={`button-qr-preset-${label.toLowerCase()}`}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" /> Custom
                  </Label>
                  <span className="text-xs text-muted-foreground" data-testid="text-admin-qr-size">{sizeVal}%</span>
                </div>
                <Slider
                  value={[sizeVal]}
                  onValueChange={([v]) => safeSetContent({ qrSizePercent: v })}
                  min={MIN_SAFE_QR_SIZE_PERCENT}
                  max={55}
                  step={1}
                  data-testid="slider-admin-qr-size"
                />
              </div>
            </div>

            <div
              className={`mt-3 rounded-lg border p-3 space-y-2 ${qrSafetyClasses.wrap}`}
              data-testid="panel-admin-qr-safety"
            >
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm font-medium">QR Safety Meter</Label>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${qrSafetyClasses.badge}`}
                  data-testid="badge-admin-qr-safety"
                >
                  {qrSafety.label}
                </span>
              </div>
              <p
                className={`text-xs ${qrSafetyClasses.text}`}
                data-testid="text-admin-qr-safety-summary"
              >
                {qrSafety.summary}
              </p>
              <div className="space-y-1" data-testid="bar-admin-qr-safety-score">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Readability Score</span>
                  <span>{qrSafety.score}/100</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
                  <div
                    className={`h-full transition-all ${
                      qrSafety.status === "safe"
                        ? "bg-emerald-500"
                        : qrSafety.status === "caution"
                          ? "bg-amber-400"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${qrSafety.score}%` }}
                  />
                </div>
              </div>
              {!!qrSafety.tips.length && (
                <ul
                  className="list-disc pl-4 space-y-1 text-[11px] text-muted-foreground"
                  data-testid="list-admin-qr-safety-tips"
                >
                  {qrSafety.tips.map((tip, idx) => (
                    <li key={`${tip}-${idx}`}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/10 p-2">
              <p className="text-[11px] text-blue-100" data-testid="text-admin-qr-guardrail-notice">
                QR size can be adjusted down to {MIN_SAFE_QR_SIZE_PERCENT}%. Scan readability depends on the final print size and the clear border around the code.
              </p>
            </div>
          </div>
        )}

        {showPreview && (
          <div className="flex flex-col items-center py-2">
            <p className="text-xs text-muted-foreground mb-2">Product Graphic Preview</p>
            {previewError ? <p role="alert" className="text-sm text-destructive">{previewError}</p> : <GraphicPreviewView
              renderOptions={previewOptions}
              backgroundColor={state.selectedColor?.hex || '#1a1a2e'}
              headerStyle={(state.content.headerStyle as TextStyleConfig) || headerDefaultStyle}
              footerStyle={(state.content.footerStyle as TextStyleConfig) || footerDefaultStyle}
              showQRCode={true}
              aspectRatio="portrait"
              qrPositionX={posX}
              qrPositionY={posY}
              qrSizePercent={sizeVal}
              areaImageUrl={adminAreaImageUrl}
              areaImageMode={adminAreaImageMode}
              areaImageOffsetX={areaOffX}
              areaImageOffsetY={areaOffY}
              areaImageScale={areaSc}
              subBottomStyle={state.content.subBottomStyle}
              graphicLayoutMode={state.content.graphicLayoutMode || "zone"}
            />}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              This is how your product graphic will appear
            </p>
          </div>
        )}

        {state.content.graphicLayoutMode === "freeform" && (
        <div className="mt-4 pt-4 border-t">
          <div className="pt-3 space-y-3">
            <input
              ref={adminAreaFileRef}
              type="file"
              accept={IMAGE_LIBRARY_ACCEPT}
              onChange={handleAdminAreaImageUpload}
              className="hidden"
              data-testid="input-admin-area-image-file"
            />
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Center Image</Label>
            </div>

            {adminAreaImageUrl ? (
              <div className="space-y-2">
                <div className="border rounded-md p-2 bg-muted/30">
                  <img
                    src={adminAreaImageUrl}
                    alt="Area image"
                    className="w-full max-h-[100px] object-contain rounded"
                    data-testid="img-admin-area-preview"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => adminAreaFileRef.current?.click()}
                    disabled={isAreaUploading}
                    data-testid="button-admin-replace-area-image"
                  >
                    {isAreaUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                    {isAreaUploading ? "Uploading…" : "Replace"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openLibraryFor("area")}
                    data-testid="button-admin-area-library"
                  >
                    <FolderOpen className="h-4 w-4 mr-1" />
                    Library
                  </Button>
                  {adminAreaImageUrl.startsWith("data:") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSaveImageDataUrl(adminAreaImageUrl)}
                      data-testid="button-admin-save-area-to-library"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setContent({ areaImageUrl: '', areaImageOffsetX: 50, areaImageOffsetY: 50, areaImageScale: 100 })}
                    data-testid="button-admin-remove-area-image"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
                <div className="pt-2 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Image Position & Size</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5" /> Left / Right
                      </Label>
                      <span className="text-xs text-muted-foreground" data-testid="text-admin-area-pos-x">{areaOffX}%</span>
                    </div>
                    <Slider
                      value={[areaOffX]}
                      onValueChange={([v]) => setContent({ areaImageOffsetX: v })}
                      min={0}
                      max={100}
                      step={1}
                      data-testid="slider-admin-area-offset-x"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Move className="w-3.5 h-3.5" /> Up / Down
                      </Label>
                      <span className="text-xs text-muted-foreground" data-testid="text-admin-area-pos-y">{areaOffY}%</span>
                    </div>
                    <Slider
                      value={[areaOffY]}
                      onValueChange={([v]) => setContent({ areaImageOffsetY: v })}
                      min={0}
                      max={100}
                      step={1}
                      data-testid="slider-admin-area-offset-y"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm flex items-center gap-1.5">
                        <Maximize2 className="w-3.5 h-3.5" /> Size
                      </Label>
                      <span className="text-xs text-muted-foreground" data-testid="text-admin-area-scale">{areaSc}%</span>
                    </div>
                    <Slider
                      value={[areaSc]}
                      onValueChange={([v]) => setContent({ areaImageScale: v })}
                      min={20}
                      max={200}
                      step={1}
                      data-testid="slider-admin-area-scale"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <div
                  onClick={() => !isAreaUploading && adminAreaFileRef.current?.click()}
                  className={`flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 transition-colors ${isAreaUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/30"}`}
                  data-testid="dropzone-admin-area-image"
                >
                  {isAreaUploading ? <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                  <p className="text-xs text-muted-foreground font-medium">{isAreaUploading ? "Uploading…" : "Upload"}</p>
                  {!isAreaUploading && <p className="text-xs text-muted-foreground/60">PNG, JPG, SVG</p>}
                </div>
                <div
                  onClick={() => openLibraryFor("area")}
                  className="flex-1 border-2 border-dashed rounded-md p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  data-testid="dropzone-admin-area-library"
                >
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground font-medium">Library</p>
                  <p className="text-xs text-muted-foreground/60">Your images</p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      <ImageLibraryDialog
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onSelect={handleLibrarySelect}
      />

      {saveImageDataUrl && (
        <SaveImageToLibraryDialog
          open={!!saveImageDataUrl}
          onClose={() => setSaveImageDataUrl(null)}
          imageDataUrl={saveImageDataUrl}
        />
      )}
    </CollapsibleModule>
  );
}
