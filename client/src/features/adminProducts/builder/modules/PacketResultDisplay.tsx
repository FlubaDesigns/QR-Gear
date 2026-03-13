import { Check, QrCode, Image, DollarSign, ArrowRight, Link2, Shirt, ListChecks, Trash2, Store, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ImageModalView } from "@/features/shared/components/views/ModalView";
import type { PricingBreakdown } from "../types";

interface PacketResult {
  packetId: string;
  landingPageUrl: string;
  landingPageSnapshotUrl: string;
  productGraphicUrl: string;
  qrOnlyUrl: string;
  pricing: PricingBreakdown;
  priorityMockupUrl?: string | null;
  priorityMockupLoading?: boolean;
  priorityMockupError?: string | null;
}

interface PacketResultDisplayProps {
  packetResult: PacketResult;
  selectedColor: { name: string; hex: string } | null;
  selectedStore: { id: string; name: string } | null;
  selectedChannel: { id: string; name: string } | null;
  isPlayMode: boolean;
  isBasicsOrPlusMode: boolean;
  pricingSettings: any;
  isDeleting: boolean;
  thumbnailLightbox: string | null;
  onThumbnailLightbox: (url: string | null) => void;
  onNext: () => void;
  onReset: () => void;
  onDelete: () => void;
}

export function PacketResultDisplay({
  packetResult,
  selectedColor,
  selectedStore,
  selectedChannel,
  isPlayMode,
  isBasicsOrPlusMode,
  pricingSettings,
  isDeleting,
  thumbnailLightbox,
  onThumbnailLightbox,
  onNext,
  onReset,
  onDelete,
}: PacketResultDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
        <Check className="h-6 w-6" />
        <span className="font-bold text-lg">Packet Created Successfully</span>
      </div>

      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-300 dark:border-blue-700">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Shirt className="h-5 w-5" />
            Digital Proof - Your Product Preview
          </p>
          <div 
            className="rounded-lg p-4 flex items-center justify-center min-h-[200px]"
            style={{ backgroundColor: selectedColor?.hex || '#f9fafb' }}
          >
            {packetResult.priorityMockupLoading ? (
              <div className="flex flex-col items-center gap-2 text-white/80">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-sm">Generating preview...</span>
              </div>
            ) : packetResult.priorityMockupUrl ? (
              <img
                src={packetResult.priorityMockupUrl}
                alt="Product Preview"
                className="max-w-full max-h-[300px] h-auto object-contain rounded"
                data-testid="img-priority-mockup"
              />
            ) : (
              <div 
                className="relative rounded-lg overflow-hidden"
              >
                <div 
                  className="absolute inset-0"
                  style={{ backgroundColor: selectedColor?.hex || '#333333' }}
                />
                <img
                  src={packetResult.productGraphicUrl}
                  alt="Product Graphic Preview"
                  className="relative z-10 max-w-[200px] h-auto object-contain"
                  data-testid="img-packet-product-graphic-fallback"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <p className="text-base font-semibold mb-3 flex items-center gap-2 text-green-700 dark:text-green-300">
            <ListChecks className="h-5 w-5" />
            Completed Steps
          </p>
          <div className="space-y-2 text-base">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Packet created with pricing data</span>
            </div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>QR code generated</span>
            </div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Composite graphic saved</span>
            </div>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Mockup queue started for all colors</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedStore && selectedChannel && (
        <Card className="bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-700">
          <CardContent className="p-4">
            <p className="text-base font-semibold mb-2 flex items-center gap-2 text-purple-800 dark:text-purple-200">
              <Store className="h-5 w-5" />
              Assigned to Store
            </p>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
              <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                {selectedStore.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Channel: {selectedChannel.name}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
        <CardContent className="p-3">
          <p className="text-xs font-medium mb-2 flex items-center gap-1 text-blue-700 dark:text-blue-300">
            <Link2 className="h-3 w-3" />
            Landing Page URL
          </p>
          <p className="text-sm font-mono bg-white dark:bg-gray-900 p-2 rounded border break-all">
            {packetResult.landingPageUrl}
          </p>
        </CardContent>
      </Card>

      <p className="text-base font-bold mb-3">Generated Thumbnails</p>
      <div className="grid grid-cols-2 gap-3">
        {!isPlayMode && !isBasicsOrPlusMode && (
          <Card className="overflow-hidden">
            <CardContent className="p-3">
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Image className="h-4 w-4" />
                Landing Page
              </p>
              {packetResult.landingPageSnapshotUrl ? (
                <button 
                  type="button"
                  className="w-full bg-gray-900 rounded p-1 flex items-center justify-center min-h-[100px] cursor-pointer hover-elevate"
                  onClick={() => onThumbnailLightbox(packetResult.landingPageSnapshotUrl)}
                  data-testid="btn-landing-snapshot"
                >
                  <img
                    src={packetResult.landingPageSnapshotUrl}
                    alt="Landing Page Snapshot"
                    className="w-full max-w-[80px] h-auto object-contain"
                    data-testid="img-packet-landing-snapshot"
                  />
                </button>
              ) : (
                <div className="bg-gray-900 rounded p-1 flex items-center justify-center min-h-[100px]">
                  <span className="text-xs text-gray-400">N/A</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Image className="h-4 w-4" />
              Product Graphic
            </p>
            <button 
              type="button"
              className="w-full rounded p-1 flex items-center justify-center min-h-[100px] cursor-pointer relative"
              style={{ backgroundColor: selectedColor?.hex || '#f9fafb' }}
              onClick={() => onThumbnailLightbox(packetResult.productGraphicUrl)}
              data-testid="btn-product-graphic"
            >
              <img
                src={packetResult.productGraphicUrl}
                alt="Product Graphic"
                className="relative z-10 w-full max-w-[80px] h-auto object-contain"
                data-testid="img-packet-product-graphic"
              />
            </button>
            <p className="text-xs text-muted-foreground mt-1 text-center" data-testid="text-swatch-color">
              On {selectedColor?.name || 'selected color'}
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden col-span-2">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </p>
            <div className="flex justify-center">
              <button 
                type="button"
                className="rounded p-3 flex items-center justify-center cursor-pointer hover-elevate bg-white border"
                onClick={() => onThumbnailLightbox(packetResult.qrOnlyUrl)}
                data-testid="btn-qr-code"
              >
                <img
                  src={packetResult.qrOnlyUrl}
                  alt="QR Code"
                  className="w-full max-w-[200px] h-auto"
                  data-testid="img-packet-qr"
                />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mt-3 text-center">
              Black on white - readable on any product color
            </p>
          </CardContent>
        </Card>

        <Card className="overflow-hidden col-span-2">
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shirt className="h-4 w-4" />
              Mockup Preview
            </p>
            {packetResult.priorityMockupLoading ? (
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center min-h-[120px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : packetResult.priorityMockupUrl ? (
              <button 
                type="button"
                className="w-full bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center min-h-[120px] cursor-pointer hover-elevate"
                onClick={() => onThumbnailLightbox(packetResult.priorityMockupUrl!)}
                data-testid="btn-mockup"
              >
                <img
                  src={packetResult.priorityMockupUrl}
                  alt="Product Mockup"
                  className="w-full max-w-[200px] h-auto object-contain"
                  data-testid="img-packet-mockup"
                />
              </button>
            ) : packetResult.priorityMockupError ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-3 min-h-[120px]">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Mockup Failed</p>
                <p className="text-xs text-red-600 dark:text-red-400">{packetResult.priorityMockupError}</p>
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 rounded p-2 flex items-center justify-center min-h-[120px]">
                <span className="text-xs text-gray-400">Generating...</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pricingSettings && (
        <Card className="border-2">
          <CardContent className="p-4 space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4" />
              Itemized Pricing
            </h4>
            
            <div className="flex justify-between text-base font-semibold">
              <span>Provider Cost</span>
              <span className="text-lg">${packetResult.pricing.baseProductCost.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Extra Placements</span>
              <span>
                {packetResult.pricing.placementCost > 0 ? `+$${packetResult.pricing.placementCost.toFixed(2)}` : '$0.00'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Text Lines</span>
              <span>
                {packetResult.pricing.textUpcharge > 0 ? `+$${packetResult.pricing.textUpcharge.toFixed(2)}` : '$0.00'}
              </span>
            </div>
            
            <div className="flex justify-between text-sm border-t pt-2">
              <span>Subtotal</span>
              <span className="font-medium">${packetResult.pricing.subtotal.toFixed(2)}</span>
            </div>
            
            <div className="bg-muted/50 rounded px-2 py-2 -mx-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span>Your Markup</span>
                <span className="font-bold text-base">{packetResult.pricing.markupPercent}%</span>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <span>Calculated</span>
                <span>+${packetResult.pricing.markupAmount.toFixed(2)}</span>
              </div>
              {packetResult.pricing.markupFixed > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Fixed markup included</span>
                  <span>+${packetResult.pricing.markupFixed.toFixed(2)}</span>
                </div>
              )}
            </div>
            
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Customer Price</span>
              <span>${packetResult.pricing.customerPrice.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-5 pt-8">
        <button
          type="button"
          onClick={onNext}
          className="qr-btn qr-btn--primary qr-btn--touch qr-btn--xxl qr-btn--full"
          data-testid="button-next-store-builder"
        >
          <ArrowRight className="h-7 w-7" />
          Continue to Store Builder
        </button>
        <button
          type="button"
          onClick={onReset}
          className="qr-btn qr-btn--outline qr-btn--touch qr-btn--xl qr-btn--full"
          data-testid="button-create-another"
        >
          Create Another Product
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          className={`qr-btn qr-btn--ghost qr-btn--touch qr-btn--xl qr-btn--full ${isDeleting ? 'opacity-50' : ''}`}
          style={{ color: '#ef4444' }}
          data-testid="button-delete-packet"
        >
          {isDeleting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Trash2 className="h-6 w-6" />
          )}
          Delete This Packet
        </button>
      </div>

      {thumbnailLightbox && (
        <div data-testid="lightbox-thumbnail">
          <ImageModalView
            imageUrl={thumbnailLightbox}
            onClose={() => onThumbnailLightbox(null)}
          />
        </div>
      )}
    </div>
  );
}
