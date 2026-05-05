import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, LayoutTemplate, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";

const MAX_INSTANCES = 9;

const CONTEXT_LABELS: Record<string, string> = {
  S: "Shirt (S)",
  U: "URL (U)",
};

const LAYOUT_LABELS: Record<string, string> = {
  Z: "Zone (Z)",
  P: "Palette (P)",
};

const INSTANCE_TYPE_LABELS: Record<string, string> = {
  txt: "txt — Text",
  img: "img — Image",
  qrc: "qrc — QR Code",
  act: "act — Action / CTA",
  vid: "vid — Video",
  doc: "doc — Document",
};

const TYPE_COLORS: Record<string, string> = {
  txt: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  img: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  qrc: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  act: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  vid: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  doc: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const BLD_ID_REGEX = /^BLD-[SU][A-Z]\d-\d{3}$/;

function isValidBldId(bldId: string): boolean {
  return BLD_ID_REGEX.test(bldId);
}

interface BldInstance {
  seq: string;
  type: string;
  role?: string;
  required?: boolean;
}

interface BldDefinition {
  id: string;
  bldId: string;
  context: string;
  layout?: string;
  name?: string;
  instances?: BldInstance[];
  instanceCount?: number;
  source?: string;
  createdAt?: string;
}

interface FormInstance {
  type: string;
  role: string;
  required: boolean;
}

const DEFAULT_FORM_INSTANCE: FormInstance = { type: "txt", role: "", required: true };

function formatSeq(i: number): string {
  return String(i + 1).padStart(2, "0");
}

function MissingBadge({ text }: { text: string }) {
  return (
    <Badge variant="destructive" className="text-xs gap-1 font-mono">
      <AlertTriangle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

function InstanceRow({
  inst,
  index,
  onChange,
  onRemove,
}: {
  inst: FormInstance;
  index: number;
  onChange: (i: number, field: keyof FormInstance, value: string | boolean) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="grid grid-cols-[2rem_1fr_1fr_auto_auto] gap-2 items-center" data-testid={`row-instance-${index}`}>
      <span className="text-xs font-mono text-muted-foreground text-center">{formatSeq(index)}</span>

      <Select value={inst.type} onValueChange={(v) => onChange(index, "type", v)}>
        <SelectTrigger className="h-8 text-xs" data-testid={`select-type-${index}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(INSTANCE_TYPE_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={inst.role}
        onChange={(e) => onChange(index, "role", e.target.value)}
        placeholder="role (e.g. header)"
        className="h-8 text-xs"
        data-testid={`input-role-${index}`}
      />

      <button
        type="button"
        onClick={() => onChange(index, "required", !inst.required)}
        className={`text-xs px-2 py-1 rounded-md border transition-colors ${
          inst.required
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-muted border-border text-muted-foreground"
        }`}
        data-testid={`toggle-required-${index}`}
        title={inst.required ? "Required — click to make optional" : "Optional — click to make required"}
      >
        {inst.required ? "req" : "opt"}
      </button>

      <button
        type="button"
        onClick={() => onRemove(index)}
        className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
        data-testid={`button-remove-instance-${index}`}
        title="Remove instance"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [context, setContext] = useState("S");
  const [layout, setLayout] = useState("Z");
  const [name, setName] = useState("");
  const [formInstances, setFormInstances] = useState<FormInstance[]>([
    { type: "txt", role: "header", required: true },
    { type: "qrc", role: "qr", required: true },
  ]);

  const isUContext = context === "U";
  const atInstanceCap = formInstances.length >= MAX_INSTANCES;

  function handleContextChange(v: string) {
    setContext(v);
    if (v === "U") {
      setLayout("Z");
    }
  }

  const mutation = useMutation({
    mutationFn: (payload: object) =>
      adminFetch("/bld/create", { method: "POST", json: payload }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bld"] });
      toast({ title: "BLD definition created", description: data?.bldId });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create definition", description: err.message, variant: "destructive" });
    },
  });

  function handleInstanceChange(i: number, field: keyof FormInstance, value: string | boolean) {
    setFormInstances(prev => prev.map((inst, idx) => idx === i ? { ...inst, [field]: value } : inst));
  }

  function handleAddInstance() {
    if (atInstanceCap) return;
    setFormInstances(prev => [...prev, { ...DEFAULT_FORM_INSTANCE }]);
  }

  function handleRemoveInstance(i: number) {
    setFormInstances(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleSubmit() {
    if (isUContext) {
      toast({ title: "U-context not supported", description: "Backend does not yet support U-context BLD creation.", variant: "destructive" });
      return;
    }
    if (formInstances.length === 0) {
      toast({ title: "No instances", description: "Add at least one instance before creating.", variant: "destructive" });
      return;
    }
    if (formInstances.length > MAX_INSTANCES) {
      toast({ title: "Too many instances", description: `BLD v1 supports a maximum of ${MAX_INSTANCES} instances. Current: ${formInstances.length}.`, variant: "destructive" });
      return;
    }
    const instances = formInstances.map((inst, i) => ({
      seq: formatSeq(i),
      type: inst.type,
      ...(inst.role ? { role: inst.role } : {}),
      required: inst.required,
    }));
    mutation.mutate({ context, layout, name: name.trim() || undefined, instances });
  }

  return (
    <div className="space-y-4" data-testid="form-create-bld">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Context</label>
          <Select value={context} onValueChange={handleContextChange}>
            <SelectTrigger data-testid="select-context">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CONTEXT_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Layout</label>
          <Select value={layout} onValueChange={setLayout} disabled={isUContext}>
            <SelectTrigger data-testid="select-layout">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LAYOUT_LABELS).map(([v, label]) => (
                <SelectItem key={v} value={v}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isUContext && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-3 py-2" data-testid="warning-u-context">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            U-context BLD creation is not yet supported by the backend. Layout modes I, V, D are reserved. Switch to S-context to create a definition.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name (optional)</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 3-layer zone shirt"
          data-testid="input-bld-name"
          disabled={isUContext}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Instances ({formInstances.length} / {MAX_INSTANCES})
          </label>
          {atInstanceCap ? (
            <span className="text-xs text-muted-foreground font-medium" data-testid="text-instance-cap">
              Max {MAX_INSTANCES} reached
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddInstance}
              disabled={isUContext}
              data-testid="button-add-instance"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add
            </Button>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-[2rem_1fr_1fr_auto_auto] gap-2 px-0.5">
            <span className="text-xs text-muted-foreground text-center">#</span>
            <span className="text-xs text-muted-foreground">Type</span>
            <span className="text-xs text-muted-foreground">Role</span>
            <span className="text-xs text-muted-foreground">Req</span>
            <span />
          </div>
          {formInstances.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No instances — add at least one.</p>
          ) : (
            formInstances.map((inst, i) => (
              <InstanceRow
                key={i}
                inst={inst}
                index={i}
                onChange={handleInstanceChange}
                onRemove={handleRemoveInstance}
              />
            ))
          )}
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={mutation.isPending || formInstances.length === 0 || isUContext}
        className="w-full"
        data-testid="button-submit-bld"
      >
        {mutation.isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
        ) : (
          "Create Definition"
        )}
      </Button>
    </div>
  );
}

function DefinitionCard({
  def,
  onDelete,
}: {
  def: BldDefinition;
  onDelete: (bldId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const layout = def.layout ?? null;
  const instances = def.instances ?? [];
  const recordedCount = def.instanceCount;
  const actualCount = instances.length;

  const idValid = isValidBldId(def.bldId);
  const layoutMissing = !layout;
  const countMismatch = recordedCount !== undefined && actualCount > 0 && recordedCount !== actualCount;

  return (
    <div className="rounded-md border bg-card" data-testid={`card-bld-${def.id}`}>
      <div
        className="flex items-start justify-between gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-mono font-semibold ${idValid ? "text-foreground" : "text-destructive"}`} data-testid={`text-bld-id-${def.id}`}>
              {def.bldId}
            </span>
            {!idValid && <MissingBadge text="INVALID ID" />}
            <Badge variant="outline" className="text-xs">{def.context ?? "—"}</Badge>
            {layoutMissing
              ? <MissingBadge text="MISSING LAYOUT" />
              : <Badge variant="outline" className="text-xs">{layout}</Badge>
            }
            {countMismatch && <MissingBadge text="COUNT MISMATCH" />}
            {def.source === "admin" && (
              <Badge variant="secondary" className="text-xs">admin</Badge>
            )}
          </div>
          {def.name && def.name !== def.bldId && (
            <p className="text-xs text-muted-foreground truncate" data-testid={`text-bld-name-${def.id}`}>
              {def.name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {recordedCount !== undefined ? recordedCount : actualCount} instance{(recordedCount ?? actualCount) !== 1 ? "s" : ""}
            {countMismatch && (
              <span className="text-destructive ml-1">
                (recorded: {recordedCount}, actual: {actualCount})
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(def.bldId); }}
            data-testid={`button-delete-bld-${def.id}`}
            title="Delete definition"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {expanded && instances.length > 0 && (
        <div className="border-t px-3 py-2 space-y-1">
          {instances.map((inst) => (
            <div key={inst.seq} className="flex items-center gap-2" data-testid={`row-bld-instance-${def.id}-${inst.seq}`}>
              <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">{inst.seq}</span>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${TYPE_COLORS[inst.type] ?? "bg-muted text-muted-foreground"}`}>
                {inst.type}
              </span>
              {inst.role && (
                <span className="text-xs text-muted-foreground truncate">{inst.role}</span>
              )}
              <span className={`ml-auto text-xs ${inst.required ? "text-foreground" : "text-muted-foreground"}`}>
                {inst.required ? "required" : "optional"}
              </span>
            </div>
          ))}
        </div>
      )}

      {expanded && instances.length === 0 && (
        <div className="border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">No flat instances on this record (may use sub-collection).</p>
        </div>
      )}
    </div>
  );
}

export default function BldDefinitionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ definitions: BldDefinition[]; count: number }>({
    queryKey: ["/api/admin/bld"],
    queryFn: () => adminFetch("/bld"),
  });

  const deleteMutation = useMutation({
    mutationFn: (bldId: string) => adminFetch(`/bld/${bldId}`, { method: "DELETE" }),
    onSuccess: (_data, bldId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bld"] });
      toast({ title: "Deleted", description: bldId });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const definitions = data?.definitions ?? [];

  return (
    <div className="space-y-4" data-testid="tab-bld-definitions">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">BLD Definitions</span>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">{definitions.length}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={showCreate ? "secondary" : "default"}
          onClick={() => setShowCreate(v => !v)}
          data-testid="button-toggle-create-bld"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {showCreate ? "Cancel" : "New Definition"}
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-md border bg-muted/30 p-4">
          <h3 className="text-sm font-medium mb-3">Create BLD Definition</h3>
          <CreateForm onSuccess={() => setShowCreate(false)} />
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-10" data-testid="loading-bld">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400 py-4 text-center" data-testid="error-bld">
          Failed to load BLD definitions.
        </p>
      )}

      {!isLoading && !isError && definitions.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center" data-testid="empty-bld">
          No BLD definitions yet. Create one above.
        </p>
      )}

      {!isLoading && definitions.length > 0 && (
        <div className="space-y-2">
          {definitions.map((def) => (
            <DefinitionCard
              key={def.id}
              def={def}
              onDelete={(bldId) => setDeleteTarget(bldId)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete BLD Definition</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-mono font-semibold">{deleteTarget}</span>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-bld">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-bld"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
