/**
 * MEMBER CANVAS PACKET SERVICE
 * 
 * Creates the canonical packet → graphics → template → library link lifecycle
 * for member-scoped canvas designs. Mirrors admin flow but member-owned.
 * 
 * USAGE:
 * const result = await createMemberCanvasPacket({
 *   memberId: user.id,
 *   canvas: {
 *     kind: "qr_canvas",
 *     urlContent: "https://example.com",
 *     background: { url: backgroundUrl, crop: { x: 0.1, y: 0.05, w: 0.8, h: 0.8 } },
 *     textLayers: [
 *       { id: "title", label: "Title", text: "My Title", x: 50, y: 35, width: 80, fontSize: 42, color: "#ffffff", visible: true },
 *       { id: "tagline", label: "Tagline", text: "My tagline", x: 50, y: 65, width: 80, fontSize: 22, color: "#d7e9ff", visible: true }
 *     ]
 *   },
 *   onProgress: (step, status) => console.log(`${step}: ${status}`)
 * });
 */

import type { TextLayerConfig } from "@/features/shared/components/CanvasTextLayer";

export type CropRect = { 
  x: number; 
  y: number; 
  w: number; 
  h: number; 
};

export type BoundProduct = {
  blueprintId: number;
  printProviderId: number;
  selectedColor: string;
  selectedSize?: string;
  placementId: string;
};

export type PacketMetadata = {
  tags?: string[];
  category?: string;
  isPublic?: boolean;
};

export type PacketSource = {
  entryPoint: 'wizard' | 'quick_create' | 'fork' | 'template' | 'test';
  sourceTemplateId?: string;
  sessionId?: string;
};

export type ProgressStep = 'packet' | 'graphics' | 'template' | 'library';
export type ProgressStatus = 'started' | 'done' | 'error';
export type ProgressCallback = (step: ProgressStep, status: ProgressStatus) => void;

export type CreateMemberCanvasPacketInput = {
  apiBase?: string;
  memberId: string;
  channelId?: string;  // Channel for catalog organization
  idempotencyKey?: string;
  mode?: 'draft' | 'commit';
  rollbackOnError?: boolean;
  onProgress?: ProgressCallback;
  
  canvas: {
    kind: 'qr_canvas' | 'promo_canvas' | 'social_canvas';
    urlContent?: string;
    background: { 
      url: string; 
      crop?: CropRect | null;
      assetId?: string;
    };
    textLayers: TextLayerConfig[];
    boundProduct?: BoundProduct;
  };
  
  metadata?: PacketMetadata;
  source?: PacketSource;
};

export type CreateMemberCanvasPacketResult = {
  success: boolean;
  packetId?: string;
  graphicsId?: string;
  templateId?: string;
  libraryLinkId?: string;
  compositeUrl?: string;
  qrOnlyUrl?: string;
  shareUrl?: string;
  error?: string;
  rollbackPerformed?: boolean;
};

async function httpJSON<T>(
  url: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  
  return (await res.json()) as T;
}

async function rollbackPacket(apiBase: string, packetId: string, memberId: string): Promise<void> {
  try {
    await fetch(`${apiBase}/member/packets/${packetId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
  } catch (e) {
    console.error("[MemberPacketService] Rollback failed:", e);
  }
}

export async function createMemberCanvasPacket(
  input: CreateMemberCanvasPacketInput
): Promise<CreateMemberCanvasPacketResult> {
  const { 
    apiBase = "/api", 
    memberId,
    channelId,
    canvas, 
    mode = 'commit',
    rollbackOnError = true,
    onProgress,
    metadata,
    source,
  } = input;

  if (!memberId) {
    return { success: false, error: "memberId is required" };
  }
  
  if (!canvas?.background?.url) {
    return { success: false, error: "background.url is required" };
  }

  if (!canvas.textLayers || canvas.textLayers.length === 0) {
    return { success: false, error: "At least one text layer is required" };
  }

  const idem = input.idempotencyKey || `member-${memberId}-${Date.now()}`;
  let packetId: string | undefined;

  try {
    // STEP 1: CREATE PACKET (canonical anchor)
    onProgress?.('packet', 'started');
    
    const packetPayload = {
      memberId,
      kind: canvas.kind,
      urlContent: canvas.urlContent || null,
      background: {
        url: canvas.background.url,
        crop: canvas.background.crop ?? null,
        assetId: canvas.background.assetId ?? null,
      },
      textLayers: canvas.textLayers.map(layer => ({
        id: layer.id,
        label: layer.label,
        text: layer.text,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        fontSize: layer.fontSize,
        color: layer.color,
        fontFamily: layer.fontFamily,
        fontWeight: layer.fontWeight,
        textAlign: layer.textAlign,
        visible: layer.visible,
      })),
      boundProduct: canvas.boundProduct ?? null,
      metadata: metadata ?? null,
      source: source ?? { entryPoint: 'wizard' },
      status: mode === 'draft' ? 'draft' : 'pending_graphics',
    };

    const packetResp = await httpJSON<{ packetId: string; error?: string }>(
      `${apiBase}/member/packets`,
      {
        method: "POST",
        headers: { "X-Idempotency-Key": idem },
        body: JSON.stringify(packetPayload),
      }
    );

    if (!packetResp.packetId) {
      throw new Error(packetResp.error || "Backend did not return packetId");
    }
    
    packetId = packetResp.packetId;
    onProgress?.('packet', 'done');

    // If draft mode, stop here
    if (mode === 'draft') {
      return {
        success: true,
        packetId,
      };
    }

    // STEP 2: CREATE GRAPHICS (composite render)
    onProgress?.('graphics', 'started');
    
    const graphicsResp = await httpJSON<{
      graphicsId?: string;
      compositeUrl?: string;
      qrOnlyUrl?: string;
      error?: string;
    }>(`${apiBase}/member/graphics/create`, {
      method: "POST",
      headers: { "X-Idempotency-Key": idem },
      body: JSON.stringify({ memberId, packetId }),
    });

    if (graphicsResp.error) {
      throw new Error(graphicsResp.error);
    }
    
    onProgress?.('graphics', 'done');

    // STEP 3: SAVE TEMPLATE SNAPSHOT
    onProgress?.('template', 'started');
    
    const titleLayer = canvas.textLayers.find(l => l.id === 'title' || l.label.toLowerCase() === 'title');
    const descLayer = canvas.textLayers.find(l => l.id === 'tagline' || l.id === 'description');
    
    const templateResp = await httpJSON<{ templateId?: string; error?: string }>(
      `${apiBase}/member/templates/save`,
      {
        method: "POST",
        headers: { "X-Idempotency-Key": idem },
        body: JSON.stringify({
          memberId,
          packetId,
          compositeUrl: graphicsResp.compositeUrl ?? null,
          titleText: titleLayer?.text ?? "",
          descriptionText: descLayer?.text ?? "",
          kind: canvas.kind,
          metadata: metadata ?? null,
        }),
      }
    );

    if (templateResp.error) {
      throw new Error(templateResp.error);
    }
    
    onProgress?.('template', 'done');

    // STEP 4: REGISTER IN MEMBER LIBRARY
    onProgress?.('library', 'started');
    
    const libraryLinkResp = await httpJSON<{ libraryLinkId?: string; shareUrl?: string; error?: string }>(
      `${apiBase}/member/library-links`,
      {
        method: "POST",
        headers: { "X-Idempotency-Key": idem },
        body: JSON.stringify({
          memberId,
          packetId,
          channelId: channelId ?? null,
          templateId: templateResp.templateId ?? null,
          compositeUrl: graphicsResp.compositeUrl ?? null,
          qrOnlyUrl: graphicsResp.qrOnlyUrl ?? null,
          boundProduct: canvas.boundProduct ?? null,
          metadata: metadata ?? null,
          status: 'active',
        }),
      }
    );

    if (libraryLinkResp.error) {
      throw new Error(libraryLinkResp.error);
    }
    
    onProgress?.('library', 'done');

    return {
      success: true,
      packetId,
      graphicsId: graphicsResp.graphicsId,
      templateId: templateResp.templateId,
      libraryLinkId: libraryLinkResp.libraryLinkId,
      compositeUrl: graphicsResp.compositeUrl,
      qrOnlyUrl: graphicsResp.qrOnlyUrl,
      shareUrl: libraryLinkResp.shareUrl || `/share/${packetId}`,
    };

  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error("[MemberPacketService] Error:", errorMessage);
    
    // Rollback if we created a packet but failed later
    let rollbackPerformed = false;
    if (rollbackOnError && packetId) {
      await rollbackPacket(apiBase, packetId, memberId);
      rollbackPerformed = true;
    }

    return {
      success: false,
      packetId: rollbackPerformed ? undefined : packetId,
      error: errorMessage,
      rollbackPerformed,
    };
  }
}

export async function getMemberPackets(
  memberId: string,
  apiBase: string = "/api"
): Promise<{ packets: any[]; error?: string }> {
  try {
    const resp = await httpJSON<{ packets: any[] }>(
      `${apiBase}/member/packets?memberId=${encodeURIComponent(memberId)}`
    );
    return { packets: resp.packets || [] };
  } catch (err: any) {
    return { packets: [], error: err.message };
  }
}

export async function getMemberLibrary(
  memberId: string,
  apiBase: string = "/api"
): Promise<{ items: any[]; error?: string }> {
  try {
    const resp = await httpJSON<{ items: any[] }>(
      `${apiBase}/member/library-links?memberId=${encodeURIComponent(memberId)}`
    );
    return { items: resp.items || [] };
  } catch (err: any) {
    return { items: [], error: err.message };
  }
}
