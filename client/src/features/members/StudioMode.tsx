import { useWizardContext } from './WizardContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Send, Loader2, Layers } from "lucide-react";
import type { QRType } from "@/features/shared/components/wizardSteps";

export function StudioMode() {
  const {
    selectedProductType, selectedChannel, qrType, setQrType, simpleTitle, setSimpleTitle,
    qrBasicContent, setQrBasicContent, setQrBasicInputType, selectedColor, selectedShirtSize, selectedPlacements,
    urlGraphic, playVideoUrl, composeItems, composeHostingTerm,
    isPublishing, handlePublish, setSimpleStep, setWizardTier
  } = useWizardContext();

  const needsSetup = !selectedProductType || !selectedChannel || !selectedColor || !selectedShirtSize || !selectedPlacements.length || !qrType || !simpleTitle.trim()
    || (['qr-basic', 'qr-plus'].includes(qrType) && !qrBasicContent.trim())
    || (qrType === 'qr-canvas' && !urlGraphic) || (qrType === 'qr-play' && !playVideoUrl)
    || (qrType === 'qr-compose' && (composeItems.length < 2 || !composeHostingTerm));

  return (
    <div className="row space-y-4">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Studio Mode
            <Badge className="bg-amber-600 text-white">Pro</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="row space-y-4">
          <div className="layout__split-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Product</label>
              <button type="button"
                className="w-full text-left p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => { setSimpleStep('product'); setWizardTier('advanced'); }}
                data-testid="studio-select-product"
              >
                {selectedProductType ? (
                  <div className="flex items-center gap-3">
                    {selectedProductType.imageUrl && (
                      <img src={selectedProductType.imageUrl} alt={`Selected product: ${selectedProductType.title}`} className="w-10 h-10 rounded object-cover" />
                    )}
                    <span className="text-white text-sm truncate">{selectedProductType.title}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm">Click to select product...</span>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Channel</label>
              <button type="button"
                className="w-full text-left p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => { setSimpleStep('channel'); setWizardTier('advanced'); }}
                data-testid="studio-select-channel"
              >
                {selectedChannel ? (
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-blue-400" />
                    <span className="text-white text-sm">{selectedChannel.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm">Click to select channel...</span>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <label htmlFor="studio-qr-type" className="text-sm font-medium text-slate-300">QR Type</label>
              <select id="studio-qr-type"
                value={qrType}
                onChange={(e) => setQrType(e.target.value as QRType)}
                className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
                data-testid="power-qr-type"
              >
                <option value="" disabled>Select QR type</option>
                <option value="qr-basic">QR Basic</option>
                <option value="qr-plus">QR Plus</option>
                <option value="qr-canvas">QR Canvas</option>
                <option value="qr-play">QR Play</option>
                <option value="qr-compose">QR Compose</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="studio-title" className="text-sm font-medium text-slate-300">Product title</label>
              <input id="studio-title"
                type="text"
                value={simpleTitle}
                onChange={(e) => setSimpleTitle(e.target.value)}
                placeholder="My Products"
                className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                data-testid="power-product-title"
              />
            </div>
          </div>

          {['qr-basic', 'qr-plus'].includes(qrType) && <div className="space-y-2">
            <label htmlFor="studio-destination" className="text-sm font-medium text-slate-300">QR destination or text</label>
            <input id="studio-destination"
              type="text"
              value={qrBasicContent}
              onChange={(e) => { setQrBasicContent(e.target.value); setQrBasicInputType('text'); }}
              placeholder="Enter the destination or text to encode"
              className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
              data-testid="power-qr-destination"
            />
          </div>}
          <Button variant="outline" onClick={() => { setSimpleStep(selectedProductType ? 'color' : 'product'); setWizardTier('advanced'); }}>Configure product, artwork and media</Button>
          {needsSetup && <p role="status" className="text-sm text-slate-300">Complete your channel, product, color, size, placement and QR content before publishing.</p>}

          <div className="flex justify-end pt-4 border-t border-slate-700">
            <Button
              onClick={handlePublish}
              disabled={isPublishing || needsSetup}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="power-publish"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Quick Publish
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
