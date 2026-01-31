/**
 * MEMBER QR PLAY PACKET SERVICE
 * 
 * Creates the canonical packet lifecycle for member-scoped video QR products.
 * Follows the same pattern as Canvas packets but with video sources.
 * 
 * USAGE:
 * const result = await createMemberPlayPacket({
 *   memberId: user.id,
 *   videoSource: {
 *     type: "upload",
 *     videoUrl: "/api/member-files/123/video.mp4",
 *     posterUrl: "/api/member-files/123/poster.jpg"
 *   },
 *   textLayers: [
 *     { id: "title", label: "Title", text: "My Video", ... },
 *   ],
 *   textBackdrop: "soft",
 *   onProgress: (step, status) => console.log(`${step}: ${status}`)
 * });
 */

import type { TextLayerConfig, TextBackdrop } from "@/features/shared/components/CanvasTextLayer";
import type { VideoSource } from "@/features/shared/components/VideoSourcePicker";

export type PlaySettings = {
  muted?: boolean;
  loop?: boolean;
  controls?: "minimal" | "full" | "none";
};

export type PlayPacketMetadata = {
  tags?: string[];
  category?: string;
  isPublic?: boolean;
};

export type PlayPacketSource = {
  entryPoint: "wizard" | "quick_create" | "fork" | "template" | "test";
  sourceTemplateId?: string;
  sessionId?: string;
};

export type ProgressStep = "packet" | "share_card" | "publish";
export type ProgressStatus = "started" | "done" | "error";
export type ProgressCallback = (step: ProgressStep, status: ProgressStatus) => void;

export type CreateMemberPlayPacketInput = {
  apiBase?: string;
  memberId: string;
  idempotencyKey?: string;
  mode?: "draft" | "commit";
  rollbackOnError?: boolean;
  onProgress?: ProgressCallback;
  
  videoSource: VideoSource;
  textLayers: TextLayerConfig[];
  textBackdrop?: TextBackdrop;
  playSettings?: PlaySettings;
  
  metadata?: PlayPacketMetadata;
  source?: PlayPacketSource;
};

export type CreateMemberPlayPacketResult = {
  success: boolean;
  packetId?: string;
  libraryLinkId?: string;
  shareCardUrl?: string;
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
    console.error("[MemberVideoService] Rollback failed:", e);
  }
}

export async function createMemberPlayPacket(
  input: CreateMemberPlayPacketInput
): Promise<CreateMemberPlayPacketResult> {
  const { 
    apiBase = "/api", 
    memberId, 
    videoSource,
    textLayers,
    textBackdrop = "off",
    playSettings,
    mode = "commit",
    rollbackOnError = true,
    onProgress,
    metadata,
    source,
  } = input;

  if (!memberId) {
    return { success: false, error: "memberId is required" };
  }
  
  if (!videoSource?.type) {
    return { success: false, error: "videoSource is required" };
  }

  if (videoSource.type === "upload" && !videoSource.videoUrl) {
    return { success: false, error: "videoUrl is required for uploaded videos" };
  }

  if (videoSource.type === "external" && !videoSource.externalUrl) {
    return { success: false, error: "externalUrl is required for external videos" };
  }

  const idem = input.idempotencyKey || `member-play-${memberId}-${Date.now()}`;
  let packetId: string | undefined;

  try {
    // STEP 1: CREATE PLAY PACKET
    onProgress?.("packet", "started");
    
    const packetPayload = {
      memberId,
      videoSource: {
        type: videoSource.type,
        videoUrl: videoSource.videoUrl || null,
        externalUrl: videoSource.externalUrl || null,
        posterUrl: videoSource.posterUrl || null,
        duration: videoSource.duration || null,
        platform: videoSource.platform || null,
        mimeType: videoSource.mimeType || null,
        fileName: videoSource.fileName || null,
      },
      textLayers: textLayers.map(layer => ({
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
        backdrop: layer.backdrop,
      })),
      textBackdrop,
      playSettings: playSettings || { muted: true, loop: true, controls: "minimal" },
      metadata: metadata ?? null,
      source: source ?? { entryPoint: "wizard" },
      status: mode === "draft" ? "draft" : "pending_share_card",
    };

    const packetResp = await httpJSON<{ packetId: string; error?: string }>(
      `${apiBase}/member/play-packets`,
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
    onProgress?.("packet", "done");

    // If draft mode, stop here
    if (mode === "draft") {
      return {
        success: true,
        packetId,
      };
    }

    // STEP 2: GENERATE SHARE CARD
    onProgress?.("share_card", "started");
    
    const shareCardResp = await httpJSON<{
      shareCardUrl?: string;
      error?: string;
    }>(`${apiBase}/member/play-packets/${packetId}/share-card`, {
      method: "POST",
      headers: { "X-Idempotency-Key": idem },
      body: JSON.stringify({ memberId }),
    });

    if (shareCardResp.error) {
      throw new Error(shareCardResp.error);
    }
    
    onProgress?.("share_card", "done");

    // STEP 3: PUBLISH TO LIBRARY
    onProgress?.("publish", "started");
    
    const publishResp = await httpJSON<{
      libraryLinkId?: string;
      shareUrl?: string;
      error?: string;
    }>(`${apiBase}/member/play-packets/${packetId}/publish`, {
      method: "POST",
      headers: { "X-Idempotency-Key": idem },
      body: JSON.stringify({ memberId, metadata }),
    });

    if (publishResp.error) {
      throw new Error(publishResp.error);
    }
    
    onProgress?.("publish", "done");

    return {
      success: true,
      packetId,
      libraryLinkId: publishResp.libraryLinkId,
      shareCardUrl: shareCardResp.shareCardUrl,
      shareUrl: publishResp.shareUrl || `/play/${packetId}`,
    };

  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error("[MemberVideoService] Error:", errorMessage);
    
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

export async function getMemberPlayPackets(
  memberId: string,
  apiBase: string = "/api"
): Promise<{ packets: any[]; error?: string }> {
  try {
    const resp = await httpJSON<{ packets: any[] }>(
      `${apiBase}/member/packets?memberId=${encodeURIComponent(memberId)}`
    );
    // Filter to only QR Play packets
    const playPackets = (resp.packets || []).filter(p => p.kind === "qr_play");
    return { packets: playPackets };
  } catch (err: any) {
    return { packets: [], error: err.message };
  }
}
