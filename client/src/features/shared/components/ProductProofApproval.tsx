import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ProductProofApproval({ checked, onChange, warnings = [] }: {
  checked: boolean; onChange: (checked: boolean) => void; warnings?: string[];
}) {
  return <div className="space-y-3">
    {warnings.map(warning => <p key={warning} role="alert" className="text-sm text-amber-600 dark:text-amber-300">{warning}</p>)}
    <label className="flex min-h-12 items-start gap-3 py-3 text-sm">
      <input type="checkbox" required checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" data-testid="approve-product-proof" />
      <span>I approve this exact proof, including the design, text color, product color and size, for printing.</span>
    </label>
  </div>;
}

export function ProductProofDialog({ proof, onClose }: { proof: any; onClose: (approved: boolean) => void }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => setChecked(false), [proof.proofId]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(false); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogTitle>Approve your product proof</DialogTitle>
      <ProductProofImages proof={proof} />
      <p>{proof.selectedColor} · {proof.selectedSize}</p>
      <ProductProofApproval checked={checked} onChange={setChecked} warnings={proof.warnings} />
      <Button className="min-h-12" disabled={!checked} onClick={() => onClose(true)}>Approve and continue</Button>
      <Button className="min-h-12" variant="outline" onClick={() => onClose(false)}>Back to editing</Button>
    </DialogContent>
  </Dialog>;
}

export function ProductProofImages({ proof }: { proof: any }) {
  const images = Object.keys(proof.mockupUrls || {}).length ? proof.mockupUrls : { product: proof.mockupUrl };
  return <div className="flex flex-wrap gap-3">{Object.entries(images).map(([placement, url]) => <figure key={placement} className="min-w-0 flex-1">
    <img src={url as string} alt={`${placement} proof in ${proof.selectedColor}`} className="max-h-80 w-full object-contain" />
    <figcaption className="text-center text-sm capitalize">{placement.replaceAll('_', ' ')}</figcaption>
  </figure>)}</div>;
}
