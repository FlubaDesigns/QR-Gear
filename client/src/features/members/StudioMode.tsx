import { useWizardContext } from './WizardContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Send, Loader2, Layers } from "lucide-react";
import type { QRType } from "@/features/shared/components/wizardSteps";

export function StudioMode() {
  const {
    selectedProduct, selectedChannel, qrType, setQrType, channelName, setChannelName,
    qrDestination, setQrDestination, isPublishing, handlePublish, setCurrentStep, setWizardTier
  } = useWizardContext();

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Studio Mode
            <Badge className="bg-amber-600 text-white">Pro</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Product</label>
              <div 
                className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => { setCurrentStep('product'); setWizardTier('advanced'); }}
                data-testid="studio-select-product"
              >
                {selectedProduct ? (
                  <div className="flex items-center gap-3">
                    {selectedProduct.thumbnailUrl && (
                      <img src={selectedProduct.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                    )}
                    <span className="text-white text-sm truncate">{selectedProduct.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm">Click to select product...</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Channel</label>
              <div 
                className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 cursor-pointer hover:border-blue-500 transition-colors"
                onClick={() => { setCurrentStep('channel'); setWizardTier('advanced'); }}
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
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">QR Type</label>
              <select
                value={qrType}
                onChange={(e) => setQrType(e.target.value as QRType)}
                className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:border-blue-500 outline-none"
                data-testid="power-qr-type"
              >
                <option value="qr-basic">QR Basic</option>
                <option value="qr-plus">QR Plus</option>
                <option value="qr-canvas">QR Canvas</option>
                <option value="qr-play">QR Play</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Channel</label>
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="My Products"
                className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
                data-testid="power-channel-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">QR Destination URL</label>
            <input
              type="text"
              value={qrDestination}
              onChange={(e) => setQrDestination(e.target.value)}
              placeholder="https://your-website.com or leave empty for default"
              className="w-full p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:border-blue-500 outline-none"
              data-testid="power-qr-destination"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-700">
            <Button
              onClick={handlePublish}
              disabled={isPublishing || !selectedProduct}
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
