import {
  generateQRCodeUrl,
  SIMPLE_WIZARD_STEPS, QR_BASIC_STEPS, QR_PLUS_STEPS, QR_PLAY_STEPS, QR_COMPOSE_STEPS,
  isQRPlusStep, isQRPlayStep,
} from "@/features/shared/components/wizardSteps";
import { executeUpdatePacket } from "./wizard-context-actions";

export async function executeSimpleNext(ctx: any): Promise<void> {
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  if (ctx.simpleStep === 'product-congrats' && ctx.selectedProductType) {
    ctx.setRunningEarnings((prev: number) => {
      if (prev === 0) {
        return ctx.selectedProductType.memberEarnings || 0;
      }
      return prev;
    });
  }

  if (ctx.simpleStep === 'qr-basic-type') {
    ctx.setSimpleStep('qr-basic-input');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-input') {
    ctx.setIsGeneratingBasicMockup(true);
    try {
      const authHeaders = await ctx.getMemberAuthHeaders();

      const qrContent = ctx.qrBasicContent;
      const qrApiUrl = generateQRCodeUrl(qrContent, 1000);

      if (ctx.currentPacketId) {
        await executeUpdatePacket(ctx, {
          urlContent: ctx.qrBasicInputType === 'url' ? qrContent : null,
          graphicUrl: qrApiUrl,
          textLayers: ctx.qrBasicInputType === 'text' ? [{ text: qrContent, type: 'content' }] : [],
          'boundProduct.color': ctx.selectedColor,
          'boundProduct.size': ctx.selectedShirtSize,
          'boundProduct.blueprintId': ctx.selectedProductType?.blueprintId,
          'boundProduct.printProviderId': ctx.selectedProductType?.printProviderId,
          'metadata.inputType': ctx.qrBasicInputType,
          'metadata.graphicSize': ctx.graphicSize,
          'metadata.placements': ctx.selectedPlacements,
          'metadata.perPlacementSizes': ctx.perPlacementSizes,
          'metadata.qrPositionX': ctx.qrPositionX,
          'metadata.qrPositionY': ctx.qrPositionY,
          'metadata.qrSizePercent': ctx.qrSizePercent,
          'metadata.areaImageUrl': ctx.areaImageUrl || null,
          'metadata.areaImageMode': ctx.areaImageMode,
          status: 'draft',
        });
        console.log('[QR Basic] Updated packet with QR content:', ctx.currentPacketId);
      }

      const isPrintfulBasic = ctx.selectedProductType?.fulfillmentProvider === 'printful';
      if (ctx.selectedProductType?.blueprintId && (ctx.selectedProductType?.printProviderId || isPrintfulBasic) && ctx.selectedColor) {
        const effectiveQrSize = (ctx.graphicSize === 'small' || ctx.graphicSize === 'medium' || ctx.graphicSize === 'large') ? ctx.graphicSize : 'medium';
        console.log('[QR Basic] Generating mockup with graphicSize:', ctx.graphicSize, '→ effectiveQrSize:', effectiveQrSize, 'provider:', isPrintfulBasic ? 'printful' : 'printify');
        const mockupResult = await ctx.api.generateMockup({
          blueprintId: ctx.selectedProductType.blueprintId,
          printProviderId: ctx.selectedProductType.printProviderId || 99,
          colorName: ctx.selectedColor,
          artworkUrl: qrApiUrl,
          placement: 'front',
          qrSize: effectiveQrSize,
          fulfillmentProvider: isPrintfulBasic ? 'printful' : 'printify',
        });

        const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
        if (mockupResult.success && bestUrl) {
          console.log('[QR Basic] Got mockup:', {
            lifestyle: !!mockupResult.lifestyleMockupUrl,
            flat: !!mockupResult.mockupUrl,
            fromCache: mockupResult.fromCache
          });
          ctx.setQrBasicMockup(bestUrl);
        } else {
          console.warn('[QR Basic] Mockup fetch failed:', mockupResult.error);
          ctx.setQrBasicMockup(qrApiUrl);
        }
      } else {
        console.warn('[QR Basic] Missing product info for mockup - blueprintId:', ctx.selectedProductType?.blueprintId, 'printProviderId:', ctx.selectedProductType?.printProviderId, 'color:', ctx.selectedColor);
        ctx.setQrBasicMockup(qrApiUrl);
      }
    } catch (error) {
      console.error('[QR Basic] Error generating mockup:', error);
      ctx.setQrBasicMockup(generateQRCodeUrl(ctx.qrBasicContent, 300));
    } finally {
      ctx.setIsGeneratingBasicMockup(false);
    }
    ctx.setSimpleStep('qr-basic-mockup');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-mockup') {
    ctx.setSimpleStep('qr-basic-save-choice');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-save-choice') {
    await ctx.saveQrBasicToPacket();
    ctx.setSimpleStep('qr-basic-confirm');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-confirm') {
    ctx.setSimpleStep('channel');
    ctx.setCurrentPacketId(null);
    ctx.setQrBasicInputType('');
    ctx.setQrBasicContent('');
    ctx.setQrBasicMockup('');
    ctx.setQrBasicSaveChoice('');
    return;
  }

  if (ctx.simpleStep === 'qr-plus-mockup') {
    ctx.setSimpleStep('qr-plus-save-choice');
    return;
  }
  if (ctx.simpleStep === 'qr-plus-save-choice') {
    await ctx.saveQrPlusToPacket();
    ctx.setSimpleStep('qr-plus-confirm');
    return;
  }
  if (ctx.simpleStep === 'qr-plus-confirm') {
    ctx.setSimpleStep('channel');
    ctx.setCurrentPacketId(null);
    ctx.setQrPlusMockup('');
    ctx.setQrPlusSaveChoice('');
    return;
  }

  if (ctx.simpleStep === 'play-video-source') {
    ctx.setSimpleStep('play-preview');
    return;
  }
  if (ctx.simpleStep === 'play-preview') {
    if (!ctx.user?.id) {
      ctx.setShowSignInToPublish(true);
      return;
    }
    ctx.setIsGeneratingPlayMockup(true);
    ctx.setSimpleStep('play-mockup');
    try {
      await ctx.generateProductMockupForType('qr-play', ctx.setQrPlayMockup);
    } finally {
      ctx.setIsGeneratingPlayMockup(false);
    }
    return;
  }
  if (ctx.simpleStep === 'play-mockup') {
    ctx.setSimpleStep('play-publish');
    return;
  }
  if (ctx.simpleStep === 'play-publish') {
    await ctx.handleSimplePublish();
    return;
  }
  if (ctx.simpleStep === 'play-save-choice') {
    ctx.handlePlayDone();
    return;
  }

  if (ctx.simpleStep === 'url-preview') {
    if (!ctx.user?.id) {
      ctx.setShowSignInToPublish(true);
      return;
    }
    ctx.setIsGeneratingCanvasMockup(true);
    ctx.setSimpleStep('canvas-mockup');
    try {
      await ctx.generateProductMockupForType('qr-canvas', ctx.setQrCanvasMockup);
    } finally {
      ctx.setIsGeneratingCanvasMockup(false);
    }
    return;
  }
  if (ctx.simpleStep === 'canvas-mockup') {
    ctx.setSimpleStep('url-publish');
    return;
  }

  if (ctx.simpleStep === 'canvas-save-choice') {
    await ctx.saveCanvasToLibrary();
    ctx.setSimpleStep('canvas-confirm');
    return;
  }
  if (ctx.simpleStep === 'canvas-confirm') {
    ctx.handleCanvasDone();
    return;
  }

  if (ctx.simpleStep === 'compose-pick-items') {
    if (ctx.composeItems.length < 2) return;
    ctx.setSimpleStep('compose-mode');
    return;
  }
  if (ctx.simpleStep === 'compose-mode') {
    if (!ctx.composeMode) return;
    if (ctx.composeMode === 'scan-to-reveal') {
      ctx.setSimpleStep('compose-order');
    } else {
      ctx.setSimpleStep('compose-durations');
    }
    return;
  }
  if (ctx.simpleStep === 'compose-durations') {
    ctx.setSimpleStep('compose-order');
    return;
  }
  if (ctx.simpleStep === 'compose-order') {
    ctx.setSimpleStep('compose-hosting');
    return;
  }
  if (ctx.simpleStep === 'compose-hosting') {
    if (!ctx.composeHostingTerm) return;
    if (!ctx.user?.id) {
      ctx.setShowSignInToPublish(true);
      return;
    }
    ctx.setIsGeneratingComposeMockup(true);
    ctx.setSimpleStep('compose-mockup');
    try {
      await ctx.generateProductMockupForType('qr-compose', ctx.setComposeMockup);
    } finally {
      ctx.setIsGeneratingComposeMockup(false);
    }
    return;
  }
  if (ctx.simpleStep === 'compose-mockup') {
    ctx.setSimpleStep('compose-preview');
    return;
  }
  if (ctx.simpleStep === 'compose-preview') {
    ctx.setSimpleStep('compose-publish');
    return;
  }
  if (ctx.simpleStep === 'compose-publish') {
    await ctx.handleSimplePublish();
    return;
  }
  if (ctx.simpleStep === 'compose-confirm') {
    ctx.setSimpleStep('channel');
    ctx.setCurrentPacketId(null);
    ctx.setComposeItems([]);
    ctx.setComposeMode('');
    ctx.setComposeHostingTerm('');
    ctx.setComposeMockup('');
    ctx.setComposeInstanceId(null);
    return;
  }

  const stepsArray = ctx.qrType === 'qr-basic' ? QR_BASIC_STEPS
    : ctx.qrType === 'qr-plus' ? QR_PLUS_STEPS
    : ctx.qrType === 'qr-play' ? QR_PLAY_STEPS
    : ctx.qrType === 'qr-compose' ? QR_COMPOSE_STEPS
    : SIMPLE_WIZARD_STEPS;
  const currentIndex = stepsArray.findIndex((s: any) => s.id === ctx.simpleStep);

  if (ctx.simpleStep === 'placement-count') {
    ctx.setCurrentPlacementIndex(0);
    ctx.setGraphicSize('');
  }

  if (ctx.simpleStep === 'graphic-size') {
    ctx.setPerPlacementSizes((prev: any) => ({
      ...prev,
      [ctx.currentPlacement]: ctx.graphicSize
    }));

    if (ctx.currentPlacementIndex < ctx.selectedPlacements.length - 1) {
      ctx.setCurrentPlacementIndex((prev: number) => prev + 1);
      ctx.setGraphicSize('');
      return;
    }
  }

  if (ctx.simpleStep === 'text-choice') {
    ctx.setSimpleStep(ctx.textLayoutChoice === 'footer' ? 'text-edit-footer' : 'text-edit-header');
    return;
  }

  if (ctx.simpleStep === 'text-edit-header') {
    if (ctx.textLayoutChoice === 'header') {
      ctx.setCurrentPlacementIndex(0);
      ctx.setPlacementGraphicChoice('');
      ctx.setPlacementSize('');
      const stepsArr = isQRPlusStep(ctx.simpleStep) ? QR_PLUS_STEPS : isQRPlayStep(ctx.simpleStep) ? QR_PLAY_STEPS : stepsArray;
      const pcIdx = stepsArr.findIndex((s: any) => s.id === 'placement-config');
      if (pcIdx >= 0) {
        ctx.setSimpleStep('placement-config');
        return;
      }
    }
  }
  if (ctx.simpleStep === 'text-edit-footer') {
    ctx.setCurrentPlacementIndex(0);
    ctx.setPlacementGraphicChoice('');
    ctx.setPlacementSize('');
  }

  if (ctx.simpleStep === 'placement-config') {
    const savedSize = ctx.perPlacementSizes[ctx.currentPlacement] || 'medium';
    ctx.setPerPlacementConfigs((prev: any) => ({
      ...prev,
      [ctx.currentPlacement]: {
        graphicChoice: ctx.placementGraphicChoice,
        size: savedSize
      }
    }));

    if (ctx.currentPlacementIndex < ctx.selectedPlacements.length - 1) {
      const nextPlacement = ctx.selectedPlacements[ctx.currentPlacementIndex + 1];
      ctx.setCurrentPlacementIndex((prev: number) => prev + 1);
      ctx.setPlacementGraphicChoice('');
      ctx.setPlacementSize('');
      return;
    }
  }

  if (currentIndex < stepsArray.length - 1) {
    const nextStep = stepsArray[currentIndex + 1].id;
    ctx.setSimpleStep(nextStep);
  }
}

export function executeSimpleBack(ctx: any): void {
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  if (ctx.simpleStep === 'compose-explainer' || ctx.simpleStep === 'platform-acknowledge') {
    ctx.setSimpleStep('canvas-fork');
    return;
  }

  if (ctx.simpleStep === 'qr-basic-type') {
    ctx.setSimpleStep('generate');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-input') {
    ctx.setSimpleStep('qr-basic-type');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-mockup') {
    ctx.setSimpleStep('qr-basic-input');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-save-choice') {
    ctx.setSimpleStep('qr-basic-mockup');
    return;
  }
  if (ctx.simpleStep === 'qr-basic-confirm') {
    ctx.setSimpleStep('qr-basic-save-choice');
    return;
  }

  if (ctx.simpleStep === 'qr-plus-mockup') {
    ctx.setSimpleStep('canvas-fork');
    return;
  }
  if (ctx.simpleStep === 'qr-plus-save-choice') {
    ctx.setSimpleStep('qr-plus-mockup');
    return;
  }
  if (ctx.simpleStep === 'qr-plus-confirm') {
    ctx.setSimpleStep('qr-plus-save-choice');
    return;
  }

  if (ctx.simpleStep === 'play-video-source') {
    ctx.setSimpleStep('canvas-fork');
    return;
  }
  if (ctx.simpleStep === 'play-preview') {
    ctx.setSimpleStep('play-video-source');
    return;
  }
  if (ctx.simpleStep === 'play-mockup') {
    ctx.setSimpleStep('play-preview');
    return;
  }
  if (ctx.simpleStep === 'play-publish') {
    ctx.setSimpleStep(ctx.user?.id ? 'play-mockup' : 'play-preview');
    return;
  }
  if (ctx.simpleStep === 'play-save-choice') {
    return;
  }

  if (ctx.simpleStep === 'compose-pick-items') {
    ctx.setSimpleStep('canvas-fork');
    return;
  }
  if (ctx.simpleStep === 'compose-mode') {
    ctx.setSimpleStep('compose-pick-items');
    return;
  }
  if (ctx.simpleStep === 'compose-durations') {
    ctx.setSimpleStep('compose-mode');
    return;
  }
  if (ctx.simpleStep === 'compose-order') {
    if (ctx.composeMode === 'scan-to-reveal') {
      ctx.setSimpleStep('compose-mode');
    } else {
      ctx.setSimpleStep('compose-durations');
    }
    return;
  }
  if (ctx.simpleStep === 'compose-hosting') {
    ctx.setSimpleStep('compose-order');
    return;
  }
  if (ctx.simpleStep === 'compose-mockup') {
    ctx.setSimpleStep('compose-hosting');
    return;
  }
  if (ctx.simpleStep === 'compose-preview') {
    ctx.setSimpleStep('compose-mockup');
    return;
  }
  if (ctx.simpleStep === 'compose-publish') {
    ctx.setSimpleStep('compose-preview');
    return;
  }
  if (ctx.simpleStep === 'compose-confirm') {
    return;
  }

  if (ctx.simpleStep === 'canvas-fork') {
    if (ctx.wantsHeaderFooter) {
      ctx.setSimpleStep('shirt-preview');
    } else {
      ctx.setSimpleStep('generate');
    }
    return;
  }
  if (ctx.simpleStep === 'canvas-mockup') {
    ctx.setSimpleStep('url-preview');
    return;
  }
  if (ctx.simpleStep === 'url-publish') {
    ctx.setSimpleStep(ctx.user?.id ? 'canvas-mockup' : 'url-preview');
    return;
  }
  if (ctx.simpleStep === 'url-explainer') {
    ctx.setSimpleStep('canvas-fork');
    return;
  }

  if (ctx.simpleStep === 'graphic-size' && ctx.currentPlacementIndex > 0) {
    const prevPlacement = ctx.selectedPlacements[ctx.currentPlacementIndex - 1];
    ctx.setCurrentPlacementIndex((prev: number) => prev - 1);
    ctx.setGraphicSize(ctx.perPlacementSizes[prevPlacement] || '');
    return;
  }

  const stepsArray = ctx.qrType === 'qr-basic' ? QR_BASIC_STEPS
    : ctx.qrType === 'qr-plus' ? QR_PLUS_STEPS
    : ctx.qrType === 'qr-play' ? QR_PLAY_STEPS
    : ctx.qrType === 'qr-compose' ? QR_COMPOSE_STEPS
    : SIMPLE_WIZARD_STEPS;
  const currentIndex = stepsArray.findIndex((s: any) => s.id === ctx.simpleStep);
  if (currentIndex > 0) {
    ctx.setSimpleStep(stepsArray[currentIndex - 1].id);
  }
}
