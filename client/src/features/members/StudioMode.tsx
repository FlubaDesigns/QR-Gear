import { useWizardContext } from './WizardContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Zap, Send } from 'lucide-react';

export function studioMissingRequirements(ctx: any): string[] {
  const missing: string[] = [];
  if (!['qr-basic', 'qr-plus', 'qr-canvas', 'qr-play', 'qr-compose'].includes(ctx.qrType)) missing.push('QR type');
  if (!ctx.selectedProductType) missing.push('product');
  if (!ctx.selectedChannel) missing.push('channel');
  if (!ctx.selectedColor || !ctx.selectedShirtSize) missing.push('color and size');
  if (!ctx.selectedPlacements?.length) missing.push('print placement');
  if (!ctx.simpleTitle?.trim()) missing.push('title');
  if (['qr-basic', 'qr-plus'].includes(ctx.qrType) && !(ctx.qrBasicContent || ctx.qrDestination)?.trim()) missing.push('QR content');
  if (ctx.qrType === 'qr-canvas' && !ctx.urlGraphic) missing.push('Canvas background');
  if (ctx.qrType === 'qr-play' && !(ctx.playVideoUrl || ctx.videoUrl)) missing.push('Play media');
  if (ctx.qrType === 'qr-compose' && ((ctx.composeItems?.length || 0) < 2 || !ctx.composeMode || !ctx.composeHostingTerm)) missing.push('Compose playlist and hosting term');
  return missing;
}
export function StudioMode() {
  const ctx = useWizardContext(), product = ctx.selectedProductType;
  const missing = studioMissingRequirements(ctx);
  const configure = (step: 'product' | 'channel' | 'type') => { ctx.setSimpleStep(step); ctx.setWizardTier('advanced'); };
  return <Card className="bg-slate-800/50 border-slate-700">
    <CardHeader><CardTitle className="text-white flex items-center gap-2"><Zap className="text-amber-400" />Studio Mode</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" className="min-h-12" onClick={() => configure('product')} data-testid="studio-select-product">{product?.title || 'Select Product'}</Button>
        <Button variant="outline" className="min-h-12" onClick={() => configure('channel')} data-testid="studio-select-channel">{ctx.selectedChannel?.name || 'Select Channel'}</Button>
      </div>
      <label className="block text-slate-300">Product title<input className="block w-full p-3 bg-slate-700 rounded text-white" value={ctx.simpleTitle} onChange={e => ctx.setSimpleTitle(e.target.value)} /></label>
      <p className="text-slate-300">{ctx.qrType} · {ctx.selectedColor || 'Choose color'} · {ctx.selectedShirtSize || 'Choose size'}</p>
      {['qr-basic', 'qr-plus'].includes(ctx.qrType) && <label className="block text-slate-300">QR destination or text<input className="block w-full p-3 bg-slate-700 rounded text-white" value={ctx.qrBasicContent || ctx.qrDestination} onChange={e => { ctx.setQrBasicContent(e.target.value); ctx.setQrDestination(e.target.value); }} data-testid="power-qr-destination" /></label>}
      <Button variant="outline" className="min-h-12 w-full" onClick={() => configure('type')}>Configure QR Content and Artwork</Button>
      {missing.length > 0 && <p className="text-amber-300" role="status">Complete: {missing.join(', ')}.</p>}
      <Button onClick={ctx.handlePublish} disabled={ctx.isPublishing || missing.length > 0} className="min-h-12 w-full" data-testid="power-publish">
        {ctx.isPublishing ? <><Loader2 className="animate-spin mr-2" />Publishing…</> : <><Send className="mr-2" />Quick Publish</>}
      </Button>
    </CardContent>
  </Card>;
}
