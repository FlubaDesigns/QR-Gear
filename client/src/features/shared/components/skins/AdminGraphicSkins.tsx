import { AlertTriangle, Tag, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GRF_CHANNELS, GRF_PURPOSES_BY_CHANNEL, isValidGrfId } from "@shared/GRF_engine";
import type { GrfChannel } from "@shared/GRF_engine";
import type { CardSkinProps, DetailSkinProps } from "./types";

// VVS Skin layer — AdminGraphic data type.
// Card skin: compact tile for horizontal scroll strip.
// Detail skin: full metadata panel rendered inside AdminGraphicShape.

// ── GrfAsset type (matches API shape) ─────────────────────────────────────────

export interface GrfAsset {
  id: string;
  grfId: string;
  name: string;
  publicUrl: string;
  mimeType: string;
  originalFilename?: string | null;
  sourceGrfId?: string | null;
  channel: string;
  purpose: string;
  isActive: boolean;
  description?: string | null;
}

// ── SkinItem mapper ───────────────────────────────────────────────────────────

export function grfAssetToSkinItem(asset: GrfAsset) {
  return {
    id:           asset.grfId || asset.id,
    name:         asset.name || asset.originalFilename || "Untitled",
    primaryImage: asset.publicUrl || "",
    metadata:     { raw: asset } as Record<string, unknown>,
  };
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function resolveChannelLabel(channel: string) {
  const entry = GRF_CHANNELS[channel as GrfChannel];
  return entry ? { label: entry.label, valid: true } : { label: channel || "—", valid: false };
}

function resolvePurposeLabel(channel: string, purpose: string) {
  const entry = GRF_PURPOSES_BY_CHANNEL[channel as GrfChannel]?.[purpose];
  return entry ? { label: entry.label, valid: true } : { label: purpose || "—", valid: false };
}

function isValidMime(mimeType: string) {
  return mimeType?.startsWith("image/") ?? false;
}

function MissingBadge({ text }: { text: string }) {
  return (
    <Badge variant="destructive" className="text-xs gap-1 font-mono">
      <AlertTriangle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

// ── AdminGraphicCardSkin ──────────────────────────────────────────────────────

export function AdminGraphicCardSkin({ item, onClick, actions, isSelected }: CardSkinProps) {
  const raw             = (item.metadata as { raw?: GrfAsset })?.raw;
  const grfId           = raw?.grfId ?? item.id;
  const channel         = raw?.channel ?? "";
  const purpose         = raw?.purpose ?? "";
  const mimeType        = raw?.mimeType ?? "";
  const channelResult   = resolveChannelLabel(channel);
  const purposeResult   = resolvePurposeLabel(channel, purpose);
  const idValid         = isValidGrfId(grfId);
  const mimeValid       = isValidMime(mimeType);
  const hasWarning      = !channelResult.valid || !purposeResult.valid || !idValid || !mimeValid;

  return (
    <div
      className={`group relative cursor-pointer rounded-md overflow-hidden border bg-card hover-elevate transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
      data-testid={`card-graphic-${item.id}`}
    >
      {/* Image */}
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {item.primaryImage ? (
          <img
            src={item.primaryImage}
            alt={item.name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <Tag className="h-8 w-8 text-muted-foreground opacity-40" />
        )}
      </div>

      {/* Top-left badges */}
      <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
        {grfId && (
          <Badge
            className={`text-xs font-mono px-1.5 py-0.5 ${idValid ? "bg-background/90 text-foreground border" : "bg-destructive/90 text-destructive-foreground border-destructive"}`}
          >
            {grfId}
          </Badge>
        )}
        {hasWarning && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0.5 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Schema
          </Badge>
        )}
      </div>

      {/* Archive button — visible on hover */}
      {actions?.onArchive && (
        <button
          type="button"
          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-background/80 text-muted-foreground hover:text-destructive transition-colors invisible group-hover:visible"
          onClick={(e) => { e.stopPropagation(); actions.onArchive!(item.id); }}
          data-testid={`button-archive-graphic-${item.id}`}
          title="Archive"
          aria-label="Archive graphic"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Bottom label */}
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-medium truncate" title={item.name} data-testid={`text-graphic-name-${item.id}`}>
          {item.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {channelResult.valid
            ? channelResult.label
            : <span className="text-destructive font-semibold">NO CHANNEL</span>}
          {" · "}
          {purposeResult.valid
            ? purposeResult.label
            : <span className="text-destructive font-semibold">NO PURPOSE</span>}
        </p>
      </div>
    </div>
  );
}

// ── AdminGraphicDetailSkin ────────────────────────────────────────────────────

export function AdminGraphicDetailSkin({
  item,
  actions,
  isActionPending,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: DetailSkinProps) {
  const raw           = (item.metadata as { raw?: GrfAsset })?.raw;
  const grfId         = raw?.grfId ?? item.id;
  const channel       = raw?.channel ?? "";
  const purpose       = raw?.purpose ?? "";
  const mimeType      = raw?.mimeType ?? "";
  const channelResult = resolveChannelLabel(channel);
  const purposeResult = resolvePurposeLabel(channel, purpose);
  const idValid       = isValidGrfId(grfId);
  const mimeValid     = isValidMime(mimeType);

  return (
    <div className="w-full min-w-0 space-y-3">
      {/* Name + schema badges */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate" data-testid="text-detail-graphic-name">
            {item.name}
          </p>
          {raw?.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{raw.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {channelResult.valid
            ? <Badge variant="secondary" className="text-xs">{channelResult.label}</Badge>
            : <MissingBadge text="MISSING CHANNEL" />}
          {purposeResult.valid
            ? <Badge variant="outline" className="text-xs">{purposeResult.label}</Badge>
            : <MissingBadge text="MISSING PURPOSE" />}
        </div>
      </div>

      {/* Metadata fields */}
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Tag className="h-3.5 w-3.5 flex-shrink-0" />
          <span
            className={`font-mono select-all ${idValid ? "" : "text-destructive font-semibold"}`}
            data-testid="text-detail-graphic-id"
          >
            {grfId}
          </span>
          {!idValid && <MissingBadge text="INVALID ID" />}
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="font-mono">{mimeType}</span>
          {!mimeValid && <MissingBadge text="INVALID MIME" />}
        </div>

        {(channel || purpose) && (
          <div className="text-muted-foreground">
            Ch: <span className="font-mono">{channel}</span>
            {" · "}
            P: <span className="font-mono">{purpose}</span>
          </div>
        )}

        {raw?.originalFilename && (
          <div className="text-muted-foreground">
            File: <span className="font-mono select-all">{raw.originalFilename}</span>
          </div>
        )}

        {raw?.sourceGrfId && (
          <div className="text-muted-foreground">
            Source: <span className="font-mono select-all">{raw.sourceGrfId}</span>
          </div>
        )}
      </div>

      {/* Nav + action buttons */}
      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            disabled={!hasPrev}
            data-testid="button-detail-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            disabled={!hasNext}
            data-testid="button-detail-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {actions?.onArchive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => actions.onArchive!(item.id)}
              disabled={isActionPending}
              data-testid="button-detail-archive"
            >
              {isActionPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Archive
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose} data-testid="button-detail-close">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
