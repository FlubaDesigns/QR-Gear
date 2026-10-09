import { Wand2, CheckCircle2, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBuilderContext } from '../BuilderContext';
import type { BuilderCommands } from './BuilderCommandStrip';

export function BuilderBottomBar({ onSave, onGenerate, onOpenOutput }: Pick<BuilderCommands, 'onSave' | 'onGenerate' | 'onOpenOutput'>) {
  const { state, busy } = useBuilderContext();
  const hasPacket = !!state.activePacketId;
  return <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t safe-area-bottom" data-testid="builder-bottom-bar">
    <div className="flex items-center gap-2 px-3 py-2">
      <Button variant="outline" className="flex-1 gap-1.5" onClick={onSave}
        disabled={!!busy || !state.activeSessionId || !['working', 'artifact_ready'].includes(state.sessionStatus || '')}
        data-testid="button-bottom-bar-save-draft"><Bookmark className="h-4 w-4" />Save Draft</Button>
      <Button className="flex-1 gap-1.5" onClick={hasPacket ? onOpenOutput : onGenerate} disabled={!!busy}
        data-testid={hasPacket ? 'button-bottom-bar-view-packet' : 'button-bottom-bar-create'}>
        {hasPacket ? <><CheckCircle2 className="h-4 w-4" />View Packet</> : <><Wand2 className="h-4 w-4" />Generate</>}
      </Button>
    </div>
  </div>;
}
