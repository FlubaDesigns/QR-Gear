import { Play, FolderOpen, Plus, Bookmark, Wand2, CheckCircle2 } from 'lucide-react';
import { useBuilderContext } from '../BuilderContext';

export interface BuilderCommands {
  onOpenSaved: () => void;
  onOpenTemplates: () => void;
  onNew: () => void;
  onSave: () => void;
  onGenerate: () => void;
  onOpenOutput: () => void;
}

export function BuilderCommandStrip(props: BuilderCommands) {
  const { state, busy } = useBuilderContext();
  const hasPacket = !!state.activePacketId;
  const actions = [
    { label: 'Resume', icon: Play, click: props.onOpenSaved, id: 'resume' },
    { label: 'Templates', icon: FolderOpen, click: props.onOpenTemplates, id: 'templates' },
    { label: 'New', icon: Plus, click: props.onNew, id: 'new' },
    { label: 'Save', icon: Bookmark, click: props.onSave, id: 'save', disabled: !state.activeSessionId || !['working', 'artifact_ready'].includes(state.sessionStatus || '') },
    { label: hasPacket ? 'View' : 'Generate', icon: hasPacket ? CheckCircle2 : Wand2,
      click: hasPacket ? props.onOpenOutput : props.onGenerate, id: 'generate' },
  ];
  return <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b" data-testid="builder-command-strip">
    <div className="flex items-stretch divide-x divide-border">
      {actions.map(({ label, icon: Icon, click, id, disabled }) => <button key={id} type="button" onClick={click}
        disabled={!!busy || disabled} data-testid={`button-strip-${id}`}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 min-h-[56px] text-xs font-medium hover-elevate disabled:opacity-40 disabled:cursor-not-allowed">
        <Icon className="h-5 w-5" /><span>{label}</span>
      </button>)}
    </div>
  </div>;
}
