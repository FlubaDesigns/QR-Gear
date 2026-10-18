import { saveMemberVideo } from '@/lib/memberVideo';
import { requireMemberMediaUpload } from '@shared/memberMedia';
import { previewMemberBuild, publishMemberBuild } from '@/lib/memberBuild';
import {
  generateQRCodeUrl,
  normalizeWizardProduct,
  wizardProductToPacketBoundProduct,
  getDefaultPacketTitle,
  getDefaultPacketDescription,
  getAuthHeaders,
} from "@/features/shared/components/wizardSteps";
import type { AllowedProduct } from "@/features/shared/components/wizardSteps";
import { memberFetch } from "@/lib/memberFetch";

export function executeGeneratePreviewQrCode(ctx: any): string {
  const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
  const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
  ctx.setQrGraphic(qrApiUrl);
  ctx.setProductGraphic(qrApiUrl);
  return qrApiUrl;
}

export async function resolvePendingVideo(ctx: any): Promise<string> {
  let resolvedVideoUrl = ctx.playVideoUrl;
    if (ctx.pendingVideoFile && ctx.playVideoUrl?.startsWith('blob:')) {
      const formData = new FormData();
      formData.append('file', ctx.pendingVideoFile);
      formData.append('storeType', 'member');
      const uploadData = await memberFetch<any>(`/${ctx.user.id}/media`, {
        method: 'POST',
        body: formData,
      });
      const uploaded = requireMemberMediaUpload(uploadData);
      resolvedVideoUrl = uploaded.url;
      ctx.setPlayVideoUrl(resolvedVideoUrl);
      ctx.setVideoUrl(resolvedVideoUrl);
      ctx.setPendingVideoFile(null);
    }

  return resolvedVideoUrl;
}

export async function previewCanonicalMemberContext(ctx: any) {
  if (!ctx.user?.id) throw new Error('Sign in before generating your product preview.');
  if (ctx.selectedChannel?.id === 'temp-channel') {
    const channel = await ctx.api.createChannel(ctx.user.id, ctx.selectedChannel.name || 'My Products');
    ctx.setSelectedChannel(channel); ctx = { ...ctx, selectedChannel: channel };
  }
  const video = await resolvePendingVideo(ctx);
  return previewMemberBuild(ctx.user.id, memberBuildInput(ctx, undefined, video));
}

export async function executeSimplePublish(ctx: any): Promise<boolean> {
  if (!ctx.user?.id) {
    ctx.setShowSignInToPublish(true);
    return false;
  }
  if (!ctx.selectedChannel) {
    ctx.toast({ title: 'Select a channel', description: 'Go to My Channels and select or create one first.', variant: 'destructive' });
    return false;
  }

  ctx.setIsPublishing(true);
  let resolvedVideoUrl = ctx.playVideoUrl;
  try {
    let resolvedChannelId = ctx.selectedChannel.id;
    if (ctx.selectedChannel.id === 'temp-channel') {
      const channelData = await memberFetch<any>(`/${ctx.user.id}/channels`, {
        method: 'POST',
        json: { name: ctx.selectedChannel.name || 'My Products' },
      });
      resolvedChannelId = channelData.id || channelData.channelId;
      ctx.setSelectedChannel({ id: resolvedChannelId, name: ctx.selectedChannel.name || 'My Products' });
    }

    resolvedVideoUrl = await resolvePendingVideo(ctx);

    const packetData = memberBuildInput(ctx, resolvedChannelId, resolvedVideoUrl);

    console.log('[UnifiedPublish] Publishing packet:', {
      existingPacketId: ctx.currentPacketId,
      qrType: ctx.qrType,
      blueprintId: ctx.selectedProductType?.blueprintId,
      color: ctx.selectedColor,
      placements: ctx.selectedPlacements,
      graphicSize: ctx.graphicSize,
      textLayout: ctx.textLayoutChoice,
      earnings: ctx.runningEarnings,
    });

    let result: any;

    packetData.existingPacketId = ctx.currentPacketId;
    packetData.graphicLayoutMode = ctx.graphicLayoutMode;
    result = await publishMemberBuild(ctx.user.id, packetData);

    const packetId = result.id || result.packetId || ctx.currentPacketId || null;
    ctx.setPublishedBuild(result);
    ctx.setPublishedPacketId(packetId);
    ctx.setCurrentPacketId(packetId);
    ctx.incrementPublishCount();
    ctx.api.invalidateMembers();

    if (ctx.qrType === 'qr-compose') {
      ctx.setComposeInstanceId(result.composeInstanceId || null);
      ctx.setSimpleStep('compose-confirm');
    } else if (ctx.qrType === 'qr-play') {
      ctx.setSimpleStep('play-save-choice');
    } else if (ctx.qrType === 'qr-canvas') {
      ctx.setPublishedQrGraphicUrl(result.qrGraphic || null);
      ctx.setPublishedProductGraphicUrl(result.productGraphic || null);
      try {
        const assetsToSave: { url: string; assetType: string; name: string }[] = [];
        if (result.productGraphic) {
          assetsToSave.push({ url: result.productGraphic, assetType: 'graphic', name: `${ctx.simpleTitle || 'Canvas'} - Product Graphic` });
        }
        if (ctx.urlGraphic) {
          assetsToSave.push({ url: ctx.urlGraphic, assetType: 'background', name: `${ctx.simpleTitle || 'Canvas'} - Landing Page` });
        }
        if (result.qrGraphic) {
          assetsToSave.push({ url: result.qrGraphic, assetType: 'graphic', name: `${ctx.simpleTitle || 'Canvas'} - QR Code` });
        }
        for (const asset of assetsToSave) {
          try {
            await memberFetch(`/${ctx.user.id}/library`, {
              method: 'POST',
              json: {
                publicUrl: asset.url,
                storageUrl: asset.url,
                assetType: asset.assetType,
                mediaType: 'image',
                name: asset.name,
                fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
              },
            });
          } catch (err) {
            console.error('[Canvas Auto-Save] Failed:', asset.assetType, err);
            ctx.toast({ title: 'Auto-save warning', description: `Could not auto-save ${asset.assetType} to your library.`, variant: 'destructive' });
          }
        }
      } catch (saveErr) {
        console.error('[Canvas Auto-Save] Error:', saveErr);
        ctx.toast({ title: 'Auto-save warning', description: 'Could not auto-save assets to your library.', variant: 'destructive' });
      }
      ctx.setSimpleStep('canvas-confirm');
    } else if (ctx.qrType === 'qr-basic') {
    } else if (ctx.qrType === 'qr-plus') {
    } else {
      ctx.setSimpleStep('channel');
      ctx.setViewMode('index');
      ctx.setCurrentPacketId(null);
      ctx.setSimpleTitle('');
      ctx.setSimpleDescription('');
      ctx.setQrType('');
      ctx.setContentRightsConfirmed(false);
      ctx.setUrlGraphic('');
      ctx.setProductGraphic('');
    }
    return true;
  } catch (error) {
    console.error('Simple publish error:', error);
    ctx.toast({ title: 'Publish failed', description: error instanceof Error ? error.message : 'Failed to publish. Please try again.', variant: 'destructive' });
    return false;
  } finally {
    ctx.setIsPublishing(false);
  }
}

export async function executeSaveCanvasToLibrary(ctx: any): Promise<boolean> {
  if (!ctx.user?.id) return false;

  ctx.setIsCanvasSaving(true);
  try {
    const assetsToSave: { url: string; assetType: string; name: string }[] = [];

    if ((ctx.canvasSaveChoice === 'item' || ctx.canvasSaveChoice === 'all') && ctx.publishedProductGraphicUrl) {
      assetsToSave.push({
        url: ctx.publishedProductGraphicUrl,
        assetType: 'graphic',
        name: `${ctx.simpleTitle || 'Canvas'} - Product Graphic`
      });
    }

    if ((ctx.canvasSaveChoice === 'landing' || ctx.canvasSaveChoice === 'all') && ctx.urlGraphic) {
      assetsToSave.push({
        url: ctx.urlGraphic,
        assetType: 'background',
        name: `${ctx.simpleTitle || 'Canvas'} - Landing Page`
      });
    }

    if (ctx.canvasSaveChoice === 'all' && ctx.publishedQrGraphicUrl) {
      assetsToSave.push({
        url: ctx.publishedQrGraphicUrl,
        assetType: 'graphic',
        name: `${ctx.simpleTitle || 'Canvas'} - QR Code`
      });
    }

    for (const asset of assetsToSave) {
      try {
        await memberFetch(`/${ctx.user.id}/library`, {
          method: 'POST',
          json: {
            publicUrl: asset.url,
            storageUrl: asset.url,
            assetType: asset.assetType,
            mediaType: 'image',
            name: asset.name,
            fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
          },
        });
        console.log('[Canvas Save] Saved to library:', asset.assetType, asset.name);
      } catch (err) {
        console.error('[Canvas Save] Failed to save:', asset.assetType, err);
        ctx.toast({ title: 'Library save warning', description: `Could not save ${asset.assetType} to your library.`, variant: 'destructive' });
      }
    }

    return true;
  } finally {
    ctx.setIsCanvasSaving(false);
  }
}

export async function executeVideoFileUpload(ctx: any, file: File): Promise<void> {
  const MAX_SIZE = 50 * 1024 * 1024;
  const MIN_SIZE = 10 * 1024;
  if (file.size > MAX_SIZE) {
    ctx.setVideoUploadError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 50MB. For larger videos, use the "Paste URL" option instead.`);
    return;
  }
  if (file.size < MIN_SIZE) {
    ctx.setVideoUploadError('This file is too small to be a valid video. Please select the actual video file from your camera roll.');
    return;
  }

  const rejectedExtensions = /\.(ts|m3u8|m3u)$/i;
  if (rejectedExtensions.test(file.name)) {
    ctx.setVideoUploadError('This file type (.ts stream) is not supported. Please select an MP4 or MOV video from your camera roll instead.');
    return;
  }

  if (file.type === 'video/mp2t' || file.type === 'video/mp2ts' || file.type === 'video/MP2T') {
    ctx.setVideoUploadError('Transport stream (.ts) files are not supported. Please select an MP4 or MOV video from your camera roll instead.');
    return;
  }

  const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/3gpp', 'video/3gpp2', 'video/x-m4v', 'video/x-matroska'];
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp)$/i.test(file.name);
  if (!isVideo && !allowedTypes.includes(file.type)) {
    ctx.setVideoUploadError('Please upload a video file (MP4, MOV, WebM, M4V, or 3GP).');
    return;
  }

  ctx.setVideoUploadError(null);
  ctx.setVideoUploadSuccess(false);

  if (!ctx.user?.id) {
    try {
      ctx.setIsUploadingVideo(true);
      ctx.setVideoUploadProgress(0);
      const blobUrl = URL.createObjectURL(file);
      ctx.setPendingVideoFile(file);
      ctx.setVideoUploadProgress(100);
      ctx.setPlayVideoUrl(blobUrl);
      ctx.setVideoUploadSuccess(true);
    } catch (err) {
      ctx.setVideoUploadError('Failed to load video. Please try again.');
    } finally {
      ctx.setIsUploadingVideo(false);
    }
    return;
  }

  ctx.setIsUploadingVideo(true);
  ctx.setVideoUploadProgress(0);

  try {
    const memberId = ctx.user.id;
    const authHeaders = await getAuthHeaders();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('storeType', 'member');

    const result = await new Promise<{ url: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          ctx.setVideoUploadProgress(pct);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(requireMemberMediaUpload(data));
          } catch {
            reject(new Error('Invalid server response'));
          }
        } else {
          let msg = 'Upload failed';
          try {
            const errData = JSON.parse(xhr.responseText);
            msg = errData.error || msg;
          } catch {}
          reject(new Error(msg));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error - check your connection and try again'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'));
      });

      xhr.open('POST', `/api/members/${memberId}/media`);
      const authHeader = (authHeaders as any)['Authorization'];
      if (authHeader) {
        xhr.setRequestHeader('Authorization', authHeader);
      }
      xhr.send(formData);
    });

    ctx.setPlayVideoUrl(result.url);
    ctx.setVideoUrl(result.url);
    ctx.setVideoUploadSuccess(true);
    console.log('[QR Play] Video uploaded successfully:', result.url);

  } catch (error: any) {
    console.error('[QR Play] Video upload error:', error);
    ctx.setVideoUploadError(error?.message || 'Failed to upload video. Please try again.');
    ctx.setVideoUploadSuccess(false);
  } finally {
    ctx.setIsUploadingVideo(false);
  }
}

export async function executeSavePlayToLibrary(ctx: any): Promise<void> {
  if (!ctx.user?.id || ctx.playSaveChoice === 'skip') return;

  ctx.setIsPlaySaving(true);
  try {
    if (!ctx.playVideoUrl) throw new Error('Choose a video first.');
    await saveMemberVideo(ctx.user.id, ctx.playVideoUrl, `${ctx.simpleTitle || 'QR Play'} - Video`);
  } catch (error) {
    ctx.toast({ title: 'Video was not saved to the library', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    throw error;
  } finally {
    ctx.setIsPlaySaving(false);
  }
}

export async function executeFetchPublishedCanvasPlayItems(ctx: any): Promise<void> {
  if (!ctx.user?.id) return;
  ctx.setIsLoadingPublishedItems(true);
  try {
    const data = await memberFetch<any>(`/${ctx.user.id}/published-items?types=qr-canvas,qr-play`);
    ctx.setPublishedCanvasPlayItems(data.items || []);
  } catch (error) {
    console.error('[QR Compose] Error fetching published items:', error);
  } finally {
    ctx.setIsLoadingPublishedItems(false);
  }
}

export async function executeGenerateProductMockup(ctx: any, type: string, setMockup: (url: string) => void): Promise<boolean> {
  try {
    const result = await previewCanonicalMemberContext({ ...ctx, qrType: type });
    const url = result.lifestyleMockupUrl || result.mockupUrl;
    if (!url) throw new Error('The supplier did not return a product preview. Please retry.');
    setMockup(url); ctx.setProductGraphic(result.productGraphic);
    return true;
  } catch (error) {
    setMockup('');
    ctx.toast({ title: 'Preview failed', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    return false;
  }
}

export async function executeHandleProductSelect(ctx: any, product: AllowedProduct): Promise<void> {
  ctx.setSelectedProductType(product);
  if (!ctx.simpleTitle) {
    ctx.setSimpleTitle(getDefaultPacketTitle(product.title));
  }
  if (!ctx.simpleDescription) {
    ctx.setSimpleDescription(getDefaultPacketDescription(product.title));
  }
  // Product selection stays in the local draft. The shared publish flow creates the packet.

  if (!product.placements || product.placements.length === 0) {
    const prov = product.fulfillmentProvider;
    if (!prov || !product.canonicalBlankKey) throw new Error('Reload the QRG member catalog.');
    const params = new URLSearchParams({ provider: prov });
    if (prov === 'printify') {
      if (product.blueprintId) params.set('blueprintId', String(product.blueprintId));
      if (product.printProviderId) params.set('printProviderId', String(product.printProviderId));
    } else {
      params.set('productId', String(product.blueprintId));
    }
    fetch(`/api/members/product-options/${encodeURIComponent(product.canonicalBlankKey)}`)
      .then(r => r.json())
      .then(data => {
        if (data.placements && data.placements.length > 0) {
          ctx.setSelectedProductType((prev: any) => prev ? { ...prev, placements: data.placements } : prev);
        }
      })
      .catch(err => console.warn('[WizardContext] Failed to fetch placements:', err));
  }
}

export async function executeHandlePublish(ctx: any): Promise<void> {
  if (!ctx.selectedProductType) {
    ctx.toast({ title: 'Select a QRG product', description: 'Choose a product from the member catalog before publishing.', variant: 'destructive' });
    return;
  }
  await executeSimplePublish(ctx);
}

export function memberBuildInput(ctx: any, resolvedChannelId = ctx.selectedChannel?.id, resolvedVideoUrl = ctx.playVideoUrl) {
  const packetData: Record<string, any> = {
      packetType: ctx.qrType,
      title: ctx.simpleTitle,
      description: ctx.simpleDescription,
      channelId: resolvedChannelId,
      storeId: ctx.user.id,
      status: 'published',
      boundProduct: ctx.selectedProductType
        ? wizardProductToPacketBoundProduct(normalizeWizardProduct(ctx.selectedProductType, 'member'))
        : null,
      selectedColor: ctx.selectedColor || null,
      selectedShirtSize: ctx.selectedShirtSize || null,
      selectedPlacements: ctx.selectedPlacements.length > 0 ? ctx.selectedPlacements : null,
      perPlacementConfigs: Object.keys(ctx.perPlacementConfigs).length > 0 ? ctx.perPlacementConfigs : null,
      perPlacementSizes: Object.keys(ctx.perPlacementSizes).length > 0 ? ctx.perPlacementSizes : null,
      graphicSize: ctx.graphicSize || null,
      textLayoutChoice: ctx.textLayoutChoice || null,
      headerText: ctx.headerStyle.enabled ? ctx.headerStyle.text : null,
      footerText: ctx.footerStyle.enabled ? ctx.footerStyle.text : null,
      headerStyle: ctx.headerStyle.enabled ? ctx.headerStyle : null,
      footerStyle: ctx.footerStyle.enabled ? ctx.footerStyle : null,
      qrType: ctx.qrType || null,
      qrDestination: ctx.qrDestination || null,
      qrGraphic: ctx.qrGraphic || null,
      productGraphic: ctx.productGraphic || null,
      background: ctx.urlGraphic || null,
      originalUrlGraphic: ctx.originalUrlGraphic || null,
      videoUrl: ctx.qrType === 'qr-play' ? (resolvedVideoUrl || ctx.videoUrl) : null,
      qrBasicInputType: ['qr-basic', 'qr-plus'].includes(ctx.qrType) ? (ctx.qrBasicInputType || null) : null,
      qrBasicContent: ['qr-basic', 'qr-plus'].includes(ctx.qrType) ? (ctx.qrBasicContent || null) : null,
      qrBasicMockup: ctx.qrType === 'qr-basic' ? (ctx.qrBasicMockup || null) : null,
      qrBasicSaveChoice: ctx.qrType === 'qr-basic' ? (ctx.qrBasicSaveChoice || null) : null,
      qrPlusMockup: ctx.qrType === 'qr-plus' ? (ctx.qrPlusMockup || null) : null,
      qrPlusSaveChoice: ctx.qrType === 'qr-plus' ? (ctx.qrPlusSaveChoice || null) : null,
      qrCanvasMockup: ctx.qrType === 'qr-canvas' ? (ctx.qrCanvasMockup || null) : null,
      qrPlayMockup: ctx.qrType === 'qr-play' ? (ctx.qrPlayMockup || null) : null,
      composeMockup: ctx.qrType === 'qr-compose' ? (ctx.composeMockup || null) : null,
      composeItems: ctx.qrType === 'qr-compose' ? ctx.composeItems : null,
      composeMode: ctx.qrType === 'qr-compose' ? (ctx.composeMode || 'auto-rotate') : null,
      composeHostingTerm: ctx.qrType === 'qr-compose' ? (ctx.composeHostingTerm || null) : null,
      qrPositionX: ctx.qrPositionX,
      qrPositionY: ctx.qrPositionY,
      qrSizePercent: ctx.qrSizePercent,
      areaImageUrl: ctx.areaImageUrl || null,
      areaImageMode: ctx.areaImageMode,
      source: { entryPoint: 'simple-wizard' },
      itemImage: ctx.qrType === 'qr-canvas' ? (ctx.qrCanvasMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-basic' ? (ctx.qrBasicMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-plus' ? (ctx.qrPlusMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-play' ? (ctx.qrPlayMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-compose' ? (ctx.composeMockup || ctx.productGraphic || null)
        : (ctx.productGraphic || null),
    };
  packetData.existingPacketId = ctx.currentPacketId;
  packetData.graphicLayoutMode = ctx.graphicLayoutMode;
  return packetData;
}

const savedMemberGraphics = new Set<string>();
/** Respect the chosen save action; a graphic-only save never publishes an item. */
export async function executeSaveQrChoice(ctx: any, plus: boolean): Promise<boolean> {
  if (!ctx.user?.id) { ctx.setShowSignInToPublish(true); return false; }
  const choice = plus ? ctx.qrPlusSaveChoice : ctx.qrBasicSaveChoice;
  if (!['item', 'graphic', 'both'].includes(choice)) return false;
  try {
    if (choice === 'graphic' || choice === 'both') {
      const publicUrl = ctx.productGraphic;
      if (!publicUrl) throw new Error('Refresh your product preview before saving the graphic.');
      const key = `${ctx.user.id}:${publicUrl}`;
      if (!savedMemberGraphics.has(key)) {
        const name = `${ctx.simpleTitle || 'QR Gear'} — ${plus ? 'QR Plus' : 'QR Basic'} graphic`;
        await memberFetch(`/${ctx.user.id}/library`, { method: 'POST', json: {
          publicUrl, storageUrl: publicUrl, assetType: 'graphic', mediaType: 'image', name,
          fileName: `${plus ? 'qr-plus' : 'qr-basic'}-graphic.png`,
        } });
        savedMemberGraphics.add(key);
      }
    }
    if (choice !== 'graphic') return await executeSimplePublish(ctx);
    ctx.api.invalidateMembers();
    return true;
  } catch (error) {
    ctx.toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Please retry.', variant: 'destructive' });
    return false;
  }
}
