import {
  generateQRCodeUrl,
  normalizeWizardProduct,
  wizardProductToPacketBoundProduct,
  getDefaultPacketTitle,
  getDefaultPacketDescription,
} from "@/features/shared/components/wizardSteps";
import type { AllowedProduct } from "@/features/shared/components/wizardSteps";

export function executeGeneratePreviewQrCode(ctx: any): string {
  const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
  const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
  ctx.setQrGraphic(qrApiUrl);
  ctx.setProductGraphic(qrApiUrl);
  return qrApiUrl;
}

export async function executeCreatePacketForProduct(ctx: any, product: AllowedProduct): Promise<string | null> {
  try {
    console.log('[Wizard] Creating packet for product:', {
      blueprintId: product.blueprintId,
      printProviderId: product.printProviderId,
      title: product.title,
      memberEarnings: product.memberEarnings,
      retailPrice: product.retailPrice,
      baseCost: product.baseCost,
    });

    const authHeaders = await ctx.getMemberAuthHeaders();
    const placeholderQrUrl = generateQRCodeUrl('placeholder', 200);

    const packetPayload = {
      memberId: ctx.user?.id,
      kind: 'qr_basic',
      background: { url: placeholderQrUrl },
      boundProduct: {
        ...wizardProductToPacketBoundProduct(normalizeWizardProduct(product, 'member')),
      },
      metadata: {},
      source: { entryPoint: 'simple-wizard' },
      status: 'building',
    };

    const res = await fetch(`${ctx.apiBase}/${ctx.user?.id}/packets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(packetPayload),
    });

    if (res.ok) {
      const data = await res.json();
      console.log('[Wizard] Created packet on product select:', data.packetId);
      ctx.setCurrentPacketId(data.packetId);
      return data.packetId;
    } else {
      const errorData = await res.json();
      console.error('[Wizard] Packet creation failed:', errorData);
    }
  } catch (error) {
    console.error('[Wizard] Failed to create packet:', error);
  }
  return null;
}

export async function executeUpdatePacket(ctx: any, updates: Record<string, any>): Promise<boolean> {
  if (!ctx.currentPacketId || !ctx.user?.id) {
    console.warn('[Wizard] No packet or user to update');
    return false;
  }
  try {
    const authHeaders = await ctx.getMemberAuthHeaders();
    const res = await fetch(`${ctx.apiBase}/${ctx.user.id}/packets/${ctx.currentPacketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      console.log('[Wizard] Updated packet:', ctx.currentPacketId, Object.keys(updates));
      return true;
    }
    console.error('[Wizard] Packet update failed:', await res.json());
    return false;
  } catch (error) {
    console.error('[Wizard] Failed to update packet:', error);
    return false;
  }
}

export async function executeSimplePublish(ctx: any): Promise<void> {
  if (!ctx.user?.id) {
    ctx.setShowSignInToPublish(true);
    return;
  }
  if (!ctx.selectedChannel) {
    ctx.toast({ title: 'Select a channel', description: 'Go to My Channels and select or create one first.', variant: 'destructive' });
    return;
  }

  ctx.setIsPublishing(true);
  let resolvedVideoUrl = ctx.playVideoUrl;
  try {
    const authHeaders = await ctx.getMemberAuthHeaders();

    let resolvedChannelId = ctx.selectedChannel.id;
    if (ctx.selectedChannel.id === 'temp-channel') {
      const channelRes = await fetch(`/api/members/${ctx.user.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ name: ctx.selectedChannel.name || 'My Products' }),
      });
      if (channelRes.ok) {
        const channelData = await channelRes.json();
        resolvedChannelId = channelData.id || channelData.channelId;
        ctx.setSelectedChannel({ id: resolvedChannelId, name: ctx.selectedChannel.name || 'My Products' });
      } else {
        throw new Error('Failed to create channel');
      }
    }

    if (ctx.pendingVideoFile && ctx.playVideoUrl?.startsWith('blob:')) {
      const formData = new FormData();
      formData.append('file', ctx.pendingVideoFile);
      formData.append('storeType', 'member');
      const uploadRes = await fetch(`/api/members/${ctx.user.id}/videos/upload`, {
        method: 'POST',
        headers: { ...authHeaders },
        body: formData,
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        if (uploadData.url) {
          resolvedVideoUrl = uploadData.url;
          ctx.setPlayVideoUrl(resolvedVideoUrl);
        }
      }
      ctx.setPendingVideoFile(null);
    }

    const textLines = ctx.textLayoutChoice === 'both' ? 2 : (ctx.textLayoutChoice === 'header' || ctx.textLayoutChoice === 'footer') ? 1 : 0;
    const textUpcharge = textLines * (ctx.pricingSettings?.textLineUpcharge || 2);
    const extraPlacements = Math.max(0, ctx.selectedPlacements.length - 1);
    const placementUpcharge = extraPlacements * (ctx.pricingSettings?.additionalPlacementCost || 4);

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
      qrBasicInputType: ctx.qrType === 'qr-basic' ? (ctx.qrBasicInputType || null) : null,
      qrBasicContent: ctx.qrType === 'qr-basic' ? (ctx.qrBasicContent || null) : null,
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
      textLines,
      textUpcharge,
      placementUpcharge,
      memberEarnings: ctx.runningEarnings,
      source: { entryPoint: 'simple-wizard' },
      itemImage: ctx.qrType === 'qr-canvas' ? (ctx.qrCanvasMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-basic' ? (ctx.qrBasicMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-plus' ? (ctx.qrPlusMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-play' ? (ctx.qrPlayMockup || ctx.productGraphic || null)
        : ctx.qrType === 'qr-compose' ? (ctx.composeMockup || ctx.productGraphic || null)
        : (ctx.productGraphic || null),
    };

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

    if (ctx.currentPacketId) {
      packetData.existingPacketId = ctx.currentPacketId;
      const res = await fetch(`/api/members/${ctx.user.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(packetData)
      });
      if (!res.ok) throw new Error('Failed to publish');
      result = await res.json();
    } else {
      const res = await fetch(`/api/members/${ctx.user.id}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(packetData)
      });
      if (!res.ok) throw new Error('Failed to publish');
      result = await res.json();
    }

    const packetId = result.id || result.packetId || ctx.currentPacketId || null;
    ctx.setPublishedPacketId(packetId);
    ctx.setCurrentPacketId(packetId);
    ctx.incrementPublishCount();

    if (ctx.qrType === 'qr-compose') {
      ctx.setComposeInstanceId(result.composeInstanceId || null);
      ctx.setSimpleStep('compose-confirm');
    } else if (ctx.qrType === 'qr-play') {
      ctx.setSimpleStep('play-save-choice');
    } else if (ctx.qrType === 'qr-canvas') {
      ctx.setPublishedQrGraphicUrl(result.qrGraphic || null);
      ctx.setPublishedProductGraphicUrl(result.productGraphic || null);
      try {
        const saveAuthHeaders = await ctx.getMemberAuthHeaders();
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
            await fetch(`/api/members/${ctx.user.id}/library`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...saveAuthHeaders },
              body: JSON.stringify({
                publicUrl: asset.url,
                storageUrl: asset.url,
                assetType: asset.assetType,
                mediaType: 'image',
                name: asset.name,
                fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
              })
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
  } catch (error) {
    console.error('Simple publish error:', error);
    ctx.toast({ title: 'Publish failed', description: 'Failed to publish. Please try again.', variant: 'destructive' });
  } finally {
    ctx.setIsPublishing(false);
  }
}

export async function executeSaveCanvasToLibrary(ctx: any): Promise<boolean> {
  if (!ctx.user?.id) return false;

  ctx.setIsCanvasSaving(true);
  try {
    const authHeaders = await ctx.getMemberAuthHeaders();
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
        const saveRes = await fetch(`/api/members/${ctx.user.id}/library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            publicUrl: asset.url,
            storageUrl: asset.url,
            assetType: asset.assetType,
            mediaType: 'image',
            name: asset.name,
            fileName: asset.name.replace(/[^a-zA-Z0-9]/g, '_') + '.png'
          })
        });
        if (!saveRes.ok) {
          console.error('[Canvas Save] Failed to save:', asset.assetType);
          ctx.toast({ title: 'Library save warning', description: `Could not save ${asset.assetType} to your library.`, variant: 'destructive' });
        } else {
          console.log('[Canvas Save] Saved to library:', asset.assetType, asset.name);
        }
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
    const authHeaders = await ctx.getMemberAuthHeaders();
    const memberId = ctx.user.id;

    const mimeType = file.type || 'video/mp4';

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
            resolve(data);
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

      xhr.open('POST', `${ctx.apiBase}/${ctx.user.id}/media`);
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

    try {
      const saveRes = await fetch(`/api/members/${memberId}/library/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          assetType: 'video',
          name: `${ctx.simpleTitle || 'QR Play'} - Video`,
          imageData: 'data:text/plain;base64,' + btoa(result.url),
          mimeType: 'text/plain',
          originalName: `video-url-${Date.now()}.txt`,
        })
      });
      if (saveRes.ok) {
        console.log('[QR Play] Video auto-saved to member library');
      }
    } catch (libErr) {
      console.warn('[QR Play] Auto-save to library failed (non-blocking):', libErr);
    }
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
    if (ctx.playVideoUrl && !ctx.playVideoUrl.startsWith('/api/member-files/')) {
      const authHeaders = await ctx.getMemberAuthHeaders();
      const res = await fetch(`/api/members/${ctx.user.id}/library/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          assetType: 'video',
          name: `${ctx.simpleTitle || 'QR Play'} - Video`,
          imageData: 'data:text/plain;base64,' + btoa(ctx.playVideoUrl),
          mimeType: 'text/plain',
          originalName: `video-url-${Date.now()}.txt`,
        })
      });
    }
  } catch (error) {
    console.error('[QR Play] Save to library error:', error);
  } finally {
    ctx.setIsPlaySaving(false);
  }
}

export async function executeFetchPublishedCanvasPlayItems(ctx: any): Promise<void> {
  if (!ctx.user?.id) return;
  ctx.setIsLoadingPublishedItems(true);
  try {
    const authHeaders = await ctx.getMemberAuthHeaders();
    const res = await fetch(`/api/members/${ctx.user.id}/published-items?types=qr-canvas,qr-play`, {
      headers: authHeaders
    });
    if (res.ok) {
      const data = await res.json();
      ctx.setPublishedCanvasPlayItems(data.items || []);
    }
  } catch (error) {
    console.error('[QR Compose] Error fetching published items:', error);
  } finally {
    ctx.setIsLoadingPublishedItems(false);
  }
}

export async function executeGenerateProductMockup(
  ctx: any,
  type: string,
  setMockup: (url: string) => void,
): Promise<void> {
  try {
    const previewUrl = `${window.location.origin}/preview/${Date.now()}`;
    const qrApiUrl = generateQRCodeUrl(previewUrl, 200);
    ctx.setQrGraphic(qrApiUrl);
    console.log(`[${type}] Generated qrGraphic:`, qrApiUrl);

    console.log(`[${type}] Generating productGraphic with textLayoutChoice:`, ctx.textLayoutChoice);
    const productGraphicResult = await ctx.api.generateProductGraphic({
      qrUrl: previewUrl,
      headerStyle: ctx.headerStyle,
      footerStyle: ctx.footerStyle,
      textLayoutChoice: ctx.textLayoutChoice,
      qrColor: 'black',
    });

    let artworkForMockup = qrApiUrl;
    if (productGraphicResult.success && productGraphicResult.productGraphic) {
      ctx.setProductGraphic(productGraphicResult.productGraphic);
      artworkForMockup = productGraphicResult.productGraphic;
      console.log(`[${type}] Generated productGraphic (composite), length:`, productGraphicResult.productGraphic.length);
    } else {
      console.warn(`[${type}] productGraphic generation failed, using qrGraphic as fallback`);
      ctx.setProductGraphic(qrApiUrl);
    }

    const isPrintful = ctx.selectedProductType?.fulfillmentProvider === 'printful';
    if (ctx.selectedProductType?.blueprintId && (ctx.selectedProductType?.printProviderId || isPrintful) && ctx.selectedColor) {
      const effectiveQrSize = (ctx.graphicSize === 'small' || ctx.graphicSize === 'medium' || ctx.graphicSize === 'large') ? ctx.graphicSize : 'medium';
      console.log(`[${type}] Generating mockup with graphicSize:`, ctx.graphicSize, '→ effectiveQrSize:', effectiveQrSize, 'provider:', isPrintful ? 'printful' : 'printify');

      const mockupResult = await ctx.api.generateMockup({
        blueprintId: ctx.selectedProductType.blueprintId,
        printProviderId: ctx.selectedProductType.printProviderId || 99,
        colorName: ctx.selectedColor,
        artworkUrl: artworkForMockup,
        placement: 'front',
        qrSize: effectiveQrSize,
        fulfillmentProvider: isPrintful ? 'printful' : 'printify',
      });

      const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
      if (mockupResult.success && bestUrl) {
        console.log(`[${type}] SUCCESS - Setting mockup to:`, bestUrl);
        setMockup(bestUrl);
      } else {
        console.warn(`[${type}] FAILED - Using QR fallback. Error:`, mockupResult.error);
        setMockup(qrApiUrl);
      }
    } else {
      console.warn(`[${type}] Missing product info for mockup`);
      setMockup(qrApiUrl);
    }
  } catch (error) {
    console.error(`[${type}] Error generating mockup:`, error);
    const fallbackUrl = generateQRCodeUrl('placeholder', 200);
    setMockup(fallbackUrl);
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
  const packetId = await executeCreatePacketForProduct(ctx, product);
  if (!packetId) {
    ctx.toast({ title: 'Packet creation failed', description: 'Could not initialize your product. Please try again.', variant: 'destructive' });
  }

  if (!product.placements || product.placements.length === 0) {
    const prov = product.fulfillmentProvider || 'printify';
    const params = new URLSearchParams({ provider: prov });
    if (prov === 'printify') {
      if (product.blueprintId) params.set('blueprintId', String(product.blueprintId));
      if (product.printProviderId) params.set('printProviderId', String(product.printProviderId));
    } else {
      params.set('productId', String(product.blueprintId));
    }
    fetch(`/api/public/catalog/placements?${params}`)
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
  if (!ctx.user?.id || !ctx.selectedProduct || !ctx.selectedChannel) return;

  ctx.setIsPublishing(true);
  try {
    const authHeaders = await ctx.getMemberAuthHeaders();

    const textLines = ctx.textLayoutChoice === 'both' ? 2 : (ctx.textLayoutChoice === 'header' || ctx.textLayoutChoice === 'footer') ? 1 : 0;
    const textUpcharge = textLines * (ctx.pricingSettings?.textLineUpcharge || 2);
    const extraPlacements = Math.max(0, ctx.selectedPlacements.length - 1);
    const placementUpcharge = extraPlacements * (ctx.pricingSettings?.additionalPlacementCost || 4);
    const baseProductPrice = (ctx.selectedProduct as any).retailPrice || ctx.pricingSettings?.baseRetailPrice || 0;
    const calculatedBasePrice = baseProductPrice + textUpcharge + placementUpcharge;

    const productRes = await fetch(`/api/members/${ctx.user.id}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        printfulProductId: ctx.selectedProduct.productId,
        variantId: ctx.selectedProduct.id,
        qrType: ctx.qrType,
        qrDestination: ctx.qrDestination || ctx.landingPage.url || null,
        headerStyle: ctx.headerStyle.enabled ? ctx.headerStyle : null,
        footerStyle: ctx.footerStyle.enabled ? ctx.footerStyle : null,
        background: ctx.urlGraphic || null,
        landingPage: ctx.landingPage,
        videoUrl: ctx.videoUrl || null,
        channelId: ctx.selectedChannel.id,
        name: ctx.selectedProduct.name,
        price: calculatedBasePrice,
        textLines,
        textUpcharge,
        placementUpcharge,
        memberEarnings: ctx.runningEarnings
      })
    });

    if (!productRes.ok) throw new Error('Failed to create product');

    ctx.setCompletedSteps((prev: Set<any>) => new Set([...Array.from(prev), 'publish']));
    ctx.incrementPublishCount();
    ctx.setViewMode('index');
  } catch (error) {
    console.error('Publish error:', error);
    ctx.toast({ title: 'Publish failed', description: 'Failed to publish. Please try again.', variant: 'destructive' });
  } finally {
    ctx.setIsPublishing(false);
  }
}
