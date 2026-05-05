import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Link2, X, Unlink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { adminFetch } from "@/lib/adminFetch";

// ── Regex constants (from canonical schemas) ─────────────────────────────────

const QRG_BLANK_REGEX   = /^[1-6][1-9][0-9]{3}$/;
const BLD_ID_REGEX      = /^BLD-[SU][A-Z]\d-\d{3}$/;
const GRF_ID_REGEX      = /^GRF-(01|02|03|04|05|06|07)-([12345])-(\d{6})$/;
const ASM_ID_REGEX      = /^ASM-\d{6}$/;

function isValidQrgId(id: string): boolean  { return QRG_BLANK_REGEX.test(id); }
function isValidBldId(id: string): boolean  { return BLD_ID_REGEX.test(id); }
function isValidGrfId(id: string): boolean  { return GRF_ID_REGEX.test(id); }
function isValidAsmId(id: string): boolean  { return ASM_ID_REGEX.test(id); }

// Asset slots that require a grfId (not a text value)
function isAssetSlot(type: string): boolean { return type === "img" || type === "qrc"; }
function isTextSlot(type: string): boolean  { return type === "txt" || type === "act"; }

// ── Type colours ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
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

// ── Shared ⚠ badge ───────────────────────────────────────────────────────────

function MissingBadge({ text }: { text: string }) {
  return (
    <Badge variant="destructive" className="text-xs gap-1 font-mono">
      <AlertTriangle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
      <AlertTriangle className="h-3 w-3 shrink-0" />
      {text}
    </p>
  );
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface AssemblyMapping {
  seq:      string;
  type:     string;
  grfId?:   string;
  value?:   string;
  color?:   string;
}

interface Assembly {
  id:          string;
  assemblyId:  string;
  sequence:    number;
  qrgId:       string;
  bldId:       string;
  name?:       string;
  mappings:    AssemblyMapping[];
  packetIds?:  string[];
  source?:     string;
  createdAt?:  string;
  createdBy?:  string;
}

interface FormMapping {
  type:  string;
  grfId: string;
  value: string;
  color: string;
}

const DEFAULT_MAPPING: FormMapping = { type: "txt", grfId: "", value: "", color: "" };

function padSeq(i: number): string {
  return String(i + 1).padStart(2, "0");
}

// ── Mapping form row ──────────────────────────────────────────────────────────

function MappingFormRow({
  mapping,
  index,
  onChange,
  onRemove,
}: {
  mapping:  FormMapping;
  index:    number;
  onChange: (i: number, field: keyof FormMapping, v: string) => void;
  onRemove: (i: number) => void;
}) {
  const needsValue    = isTextSlot(mapping.type);
  const needsGrf      = isAssetSlot(mapping.type);
  const eitherOrGrf   = mapping.type === "vid" || mapping.type === "doc";

  const grfFilled     = mapping.grfId.trim().length > 0;
  const grfInvalid    = grfFilled && !isValidGrfId(mapping.grfId.trim());

  return (
    <div className="rounded-md border bg-muted/30 p-2 space-y-2" data-testid={`row-mapping-${index}`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{padSeq(index)}</span>
        <Select value={mapping.type} onValueChange={(v) => onChange(index, "type", v)}>
          <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-mapping-type-${index}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_LABELS).map(([v, label]) => (
              <SelectItem key={v} value={v} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
          data-testid={`button-remove-mapping-${index}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {(needsValue || eitherOrGrf) && (
        <Input
          value={mapping.value}
          onChange={(e) => onChange(index, "value", e.target.value)}
          placeholder={needsValue ? "Text value (e.g. UNITED STATES NAVY)" : "External URL (vid/doc)"}
          className="h-7 text-xs"
          data-testid={`input-mapping-value-${index}`}
        />
      )}

      {(needsGrf || eitherOrGrf) && (
        <div>
          <Input
            value={mapping.grfId}
            onChange={(e) => onChange(index, "grfId", e.target.value)}
            placeholder="GRF ID (e.g. GRF-03-3-000007)"
            className={`h-7 text-xs font-mono ${grfInvalid ? "border-red-500 dark:border-red-600" : ""}`}
            data-testid={`input-mapping-grfid-${index}`}
          />
          {grfInvalid && (
            <FieldError text="Invalid GRF ID — must match GRF-TT-K-NNNNNN (e.g. GRF-03-3-000007)" />
          )}
        </div>
      )}

      {(needsValue || eitherOrGrf) && (
        <Input
          value={mapping.color}
          onChange={(e) => onChange(index, "color", e.target.value)}
          placeholder="Color override (optional, e.g. #FFFFFF)"
          className="h-7 text-xs font-mono"
          data-testid={`input-mapping-color-${index}`}
        />
      )}
    </div>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [qrgId,    setQrgId]    = useState("");
  const [bldId,    setBldId]    = useState("");
  const [name,     setName]     = useState("");
  const [mappings, setMappings] = useState<FormMapping[]>([
    { type: "img", grfId: "", value: "", color: "" },
    { type: "txt", grfId: "", value: "", color: "" },
    { type: "qrc", grfId: "", value: "", color: "" },
  ]);

  // Inline validation states
  const qrgFilled    = qrgId.trim().length > 0;
  const qrgInvalid   = qrgFilled && !isValidQrgId(qrgId.trim());

  const bldFilled    = bldId.trim().length > 0;
  const bldInvalid   = bldFilled && !isValidBldId(bldId.trim());

  const anyGrfInvalid = mappings.some((m) => {
    const filled = m.grfId.trim().length > 0;
    return filled && !isValidGrfId(m.grfId.trim());
  });

  const mutation = useMutation({
    mutationFn: (payload: object) =>
      adminFetch("/assemblies", { method: "POST", json: payload }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assemblies"] });
      toast({ title: "Assembly created", description: data?.assemblyId });
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create assembly", description: err.message, variant: "destructive" });
    },
  });

  function handleMappingChange(i: number, field: keyof FormMapping, v: string) {
    setMappings(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: v } : m));
  }

  function handleSubmit() {
    // Fix 10 — format guards before any mutation
    if (!qrgId.trim()) {
      toast({ title: "QRG ID is required", variant: "destructive" });
      return;
    }
    if (!isValidQrgId(qrgId.trim())) {
      toast({ title: "Invalid QRG ID", description: "Must match format: [1-6][1-9][0-9]{3} (e.g. 11101)", variant: "destructive" });
      return;
    }
    if (!bldId.trim()) {
      toast({ title: "BLD ID is required", variant: "destructive" });
      return;
    }
    if (!isValidBldId(bldId.trim())) {
      toast({ title: "Invalid BLD ID", description: "Must match format: BLD-[SU][A-Z][0-9]-[0-9]{3} (e.g. BLD-SZ9-001)", variant: "destructive" });
      return;
    }
    if (anyGrfInvalid) {
      toast({ title: "Invalid GRF ID in mappings", description: "Fix all GRF ID errors before submitting.", variant: "destructive" });
      return;
    }
    if (mappings.length === 0) {
      toast({ title: "No mappings", description: "Add at least one mapping slot.", variant: "destructive" });
      return;
    }

    const built = mappings.map((m, i) => {
      const entry: Record<string, string> = { seq: padSeq(i), type: m.type };
      if (m.grfId.trim()) entry.grfId = m.grfId.trim();
      if (m.value.trim()) entry.value = m.value.trim();
      if (m.color.trim()) entry.color = m.color.trim();
      return entry;
    });

    mutation.mutate({
      qrgId:    qrgId.trim(),
      bldId:    bldId.trim(),
      name:     name.trim() || undefined,
      mappings: built,
    });
  }

  const submitBlocked = mutation.isPending || mappings.length === 0 || qrgInvalid || bldInvalid || anyGrfInvalid;

  return (
    <div className="space-y-4" data-testid="form-create-assembly">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">QRG Blank ID</label>
          <Input
            value={qrgId}
            onChange={(e) => setQrgId(e.target.value)}
            placeholder="e.g. 11101"
            className={`font-mono ${qrgInvalid ? "border-red-500 dark:border-red-600" : ""}`}
            data-testid="input-asm-qrgid"
          />
          {qrgInvalid && (
            <FieldError text="Invalid — must match [1-6][1-9][0-9]{3} (e.g. 11101)" />
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">BLD ID</label>
          <Input
            value={bldId}
            onChange={(e) => setBldId(e.target.value)}
            placeholder="e.g. BLD-SZ9-001"
            className={`font-mono ${bldInvalid ? "border-red-500 dark:border-red-600" : ""}`}
            data-testid="input-asm-bldid"
          />
          {bldInvalid && (
            <FieldError text="Invalid — must match BLD-[SU][A-Z][0-9]-[0-9]{3} (e.g. BLD-SZ9-001)" />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name (optional)</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Armed Forces Tee — Zone Build"
          data-testid="input-asm-name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Mappings ({mappings.length})
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMappings(p => [...p, { ...DEFAULT_MAPPING }])}
            data-testid="button-add-mapping"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add slot
          </Button>
        </div>

        {mappings.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2 text-center">
            No mappings — add at least one slot.
          </p>
        ) : (
          <div className="space-y-1.5">
            {mappings.map((m, i) => (
              <MappingFormRow
                key={i}
                mapping={m}
                index={i}
                onChange={handleMappingChange}
                onRemove={(idx) => setMappings(p => p.filter((_, j) => j !== idx))}
              />
            ))}
          </div>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitBlocked}
        className="w-full"
        data-testid="button-submit-assembly"
      >
        {mutation.isPending
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</>
          : "Create Assembly"
        }
      </Button>
    </div>
  );
}

// ── Linked packets panel ──────────────────────────────────────────────────────

function LinkedPackets({ asm, onReload }: { asm: Assembly; onReload: () => void }) {
  const { toast } = useToast();
  const [linkInput, setLinkInput] = useState("");
  const [linking,   setLinking]   = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  const packetIds = asm.packetIds ?? [];

  async function handleLink() {
    const pid = linkInput.trim();
    if (!pid) return;
    setLinking(true);
    try {
      await adminFetch(`/packets/${pid}`, { method: "PATCH", json: { assemblyId: asm.assemblyId } });
      toast({ title: "Packet linked", description: pid });
      setLinkInput("");
      onReload();
    } catch (e: any) {
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(packetId: string) {
    setUnlinking(packetId);
    try {
      await adminFetch(`/packets/${packetId}`, { method: "PATCH", json: { assemblyId: null } });
      toast({ title: "Packet unlinked", description: packetId });
      onReload();
    } catch (e: any) {
      toast({ title: "Unlink failed", description: e.message, variant: "destructive" });
    } finally {
      setUnlinking(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Linked Packets ({packetIds.length})
      </p>

      {packetIds.length === 0 ? (
        <p className="text-xs text-muted-foreground">No packets linked.</p>
      ) : (
        <div className="space-y-1">
          {packetIds.map((pid) => (
            <div key={pid} className="flex items-center gap-2" data-testid={`row-linked-packet-${pid}`}>
              <span className="text-xs font-mono text-foreground flex-1 truncate">{pid}</span>
              <button
                type="button"
                onClick={() => handleUnlink(pid)}
                disabled={unlinking === pid}
                className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                data-testid={`button-unlink-packet-${pid}`}
                title="Unlink this packet"
              >
                {unlinking === pid
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Unlink className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Input
          value={linkInput}
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLink()}
          placeholder="Packet ID to link…"
          className="h-7 text-xs font-mono flex-1"
          data-testid={`input-link-packet-${asm.id}`}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleLink}
          disabled={linking || !linkInput.trim()}
          data-testid={`button-link-packet-${asm.id}`}
        >
          {linking
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Link2 className="h-3.5 w-3.5" />
          }
        </Button>
      </div>
    </div>
  );
}

// ── Assembly card ─────────────────────────────────────────────────────────────

function AssemblyCard({
  asm,
  onDelete,
  onReload,
}: {
  asm:      Assembly;
  onDelete: (assemblyId: string) => void;
  onReload: () => void;
}) {
  const [expanded,        setExpanded]        = useState(false);
  const [showPacketPanel, setShowPacketPanel] = useState(false);

  const mappings  = asm.mappings  ?? [];
  const packetIds = asm.packetIds ?? [];

  // Fix 4 — ASM ID format check
  const asmIdValid = isValidAsmId(asm.assemblyId);
  // Fix 5 — QRG ID format check
  const qrgIdValid = isValidQrgId(asm.qrgId);
  // Fix 6 — BLD ID format check
  const bldIdValid = isValidBldId(asm.bldId);

  return (
    <div className="rounded-md border bg-card" data-testid={`card-asm-${asm.id}`}>
      {/* Header row */}
      <div
        className="flex items-start justify-between gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-xs font-mono font-semibold ${asmIdValid ? "text-foreground" : "text-destructive"}`}
              data-testid={`text-asm-id-${asm.id}`}
            >
              {asm.assemblyId}
            </span>
            {!asmIdValid && <MissingBadge text="INVALID ID" />}

            {qrgIdValid
              ? <Badge variant="outline" className="text-xs font-mono">{asm.qrgId}</Badge>
              : <MissingBadge text={`INVALID QRG: ${asm.qrgId}`} />
            }

            {bldIdValid
              ? <Badge variant="outline" className="text-xs font-mono">{asm.bldId}</Badge>
              : <MissingBadge text={`INVALID BLD: ${asm.bldId}`} />
            }

            {asm.source === "auto_commit" && (
              <Badge variant="secondary" className="text-xs">auto</Badge>
            )}
          </div>

          {asm.name && (
            <p className="text-xs text-muted-foreground truncate" data-testid={`text-asm-name-${asm.id}`}>
              {asm.name}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            {mappings.length} mapping{mappings.length !== 1 ? "s" : ""}
            {packetIds.length > 0 && (
              <span className="ml-2 text-foreground font-medium">
                · {packetIds.length} packet{packetIds.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowPacketPanel(v => !v); setExpanded(true); }}
            data-testid={`button-packets-${asm.id}`}
            title="Manage linked packets"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); onDelete(asm.assemblyId); }}
            data-testid={`button-delete-asm-${asm.id}`}
            title="Delete assembly"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          }
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-3">
          {/* Mappings */}
          {mappings.length === 0 ? (
            <p className="text-xs text-muted-foreground">No mappings recorded.</p>
          ) : (
            <div className="space-y-1.5">
              {mappings.map((m) => {
                // Fix 7 — validate GRF ID on each slot
                const grfPresent  = !!m.grfId;
                const grfValid    = grfPresent && isValidGrfId(m.grfId!);
                const grfInvalid  = grfPresent && !grfValid;

                // Fix 8/9 — asset slots with no grfId are MISSING (not "pending" or imageUrl fallback)
                const assetMissingGrf = isAssetSlot(m.type) && !grfPresent;

                return (
                  <div
                    key={m.seq}
                    className="flex items-start gap-2 text-xs"
                    data-testid={`row-asm-mapping-${asm.id}-${m.seq}`}
                  >
                    <span className="font-mono text-muted-foreground w-5 shrink-0 pt-0.5">{m.seq}</span>
                    <span className={`font-mono px-1.5 py-0.5 rounded shrink-0 ${TYPE_COLORS[m.type] ?? ""}`}>
                      {m.type}
                    </span>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      {/* GRF ID display — Fix 7 */}
                      {grfPresent && (
                        <span className={`font-mono truncate block ${grfInvalid ? "text-destructive" : "text-foreground"}`}>
                          {m.grfId}
                          {grfInvalid && (
                            <span className="ml-1.5 text-destructive font-sans not-italic">[⚠ INVALID GRF]</span>
                          )}
                        </span>
                      )}

                      {/* Fix 8/9 — asset slot missing GRF ID */}
                      {assetMissingGrf && (
                        <MissingBadge text="MISSING GRF ID" />
                      )}

                      {/* Text value */}
                      {m.value && (
                        <span className="text-foreground break-words block">{m.value}</span>
                      )}

                      {/* Fix 8 — no GRF, no value, non-asset slot */}
                      {!grfPresent && !m.value && !isAssetSlot(m.type) && (
                        <MissingBadge text="MISSING" />
                      )}
                    </div>

                    {m.color && (
                      <div className="flex items-center gap-1 shrink-0">
                        <div
                          className="h-3 w-3 rounded-sm border border-border"
                          style={{ backgroundColor: m.color }}
                        />
                        <span className="font-mono text-muted-foreground">{m.color}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Packet link panel */}
          {showPacketPanel && (
            <div className="rounded-md border bg-muted/30 p-2">
              <LinkedPackets asm={asm} onReload={onReload} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function AssembliesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate,   setShowCreate]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [filterQrg,    setFilterQrg]    = useState("");
  const [filterBld,    setFilterBld]    = useState("");

  const queryParams = new URLSearchParams();
  if (filterQrg.trim()) queryParams.set("qrgId", filterQrg.trim());
  if (filterBld.trim()) queryParams.set("bldId", filterBld.trim());
  const qs = queryParams.toString();

  const { data, isLoading, isError, refetch } = useQuery<{ assemblies: Assembly[]; count: number }>({
    queryKey: ["/api/admin/assemblies", qs],
    queryFn: () => adminFetch(`/assemblies${qs ? `?${qs}` : ""}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (assemblyId: string) =>
      adminFetch(`/assemblies/${assemblyId}`, { method: "DELETE" }),
    onSuccess: (_data, assemblyId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/assemblies"] });
      toast({ title: "Deleted", description: assemblyId });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setDeleteTarget(null);
    },
  });

  const assemblies = data?.assemblies ?? [];

  return (
    <div className="space-y-4" data-testid="tab-assemblies">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Assemblies</span>
          {!isLoading && (
            <Badge variant="secondary" className="text-xs">{assemblies.length}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={showCreate ? "secondary" : "default"}
          onClick={() => setShowCreate(v => !v)}
          data-testid="button-toggle-create-asm"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {showCreate ? "Cancel" : "New Assembly"}
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-md border bg-muted/30 p-4">
          <h3 className="text-sm font-medium mb-3">Create Assembly</h3>
          <CreateForm onSuccess={() => setShowCreate(false)} />
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={filterQrg}
          onChange={(e) => setFilterQrg(e.target.value)}
          placeholder="Filter by QRG ID"
          className="h-8 text-xs font-mono"
          data-testid="input-filter-qrgid"
        />
        <Input
          value={filterBld}
          onChange={(e) => setFilterBld(e.target.value)}
          placeholder="Filter by BLD ID"
          className="h-8 text-xs font-mono"
          data-testid="input-filter-bldid"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10" data-testid="loading-assemblies">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-600 dark:text-red-400 py-4 text-center" data-testid="error-assemblies">
          Failed to load assemblies.
        </p>
      )}

      {!isLoading && !isError && assemblies.length === 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center" data-testid="empty-assemblies">
          {filterQrg || filterBld
            ? "No assemblies match this filter."
            : "No assemblies yet. Create one above."
          }
        </p>
      )}

      {!isLoading && assemblies.length > 0 && (
        <div className="space-y-2">
          {assemblies.map((asm) => (
            <AssemblyCard
              key={asm.id}
              asm={asm}
              onDelete={(asmId) => setDeleteTarget(asmId)}
              onReload={() => refetch()}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Assembly</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{" "}
              <span className="font-mono font-semibold">{deleteTarget}</span>?
              This cannot be undone. The assembly must have no linked packets before deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-asm">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-confirm-delete-asm"
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Delete"
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
