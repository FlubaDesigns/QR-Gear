import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetch } from "@/lib/adminFetch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, RefreshCw, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DiagnosticsResult {
  collections: any[];
  masterCatalog: {
    total: number;
    printifyOnly: number;
    printfulOnly: number;
    bridged: number;
    unclassified: number;
    noProviderMappings: number;
  };
}

interface RepairResult {
  success: boolean;
  dryRun: boolean;
  total: number;
  validIds: number;
  invalidIds: string[];
  missingVariants: string[];
  withUnmapped: string[];
  fixed: number;
}

export function MasterCatalogDebugModule() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);

  const { data: diag, isLoading, refetch } = useQuery<DiagnosticsResult>({
    queryKey: ["/api/admin/master-catalog/diagnostics"],
    queryFn: () => adminFetch("/master-catalog/diagnostics"),
    enabled: expanded,
  });

  const scanMutation = useMutation({
    mutationFn: () =>
      adminFetch("/master-catalog/repair-provider-qrg-mapping", {
        method: "POST",
        json: { dryRun: true },
      }),
    onSuccess: (data: RepairResult) => {
      setRepairResult(data);
      toast({ title: "Scan complete", description: `${data.total} docs scanned. ${data.invalidIds.length} invalid IDs, ${data.missingVariants.length} missing variants.` });
    },
    onError: (e: any) => toast({ title: "Scan failed", description: e.message, variant: "destructive" }),
  });

  const repairMutation = useMutation({
    mutationFn: () =>
      adminFetch("/master-catalog/repair-provider-qrg-mapping", {
        method: "POST",
        json: { dryRun: false },
      }),
    onSuccess: (data: RepairResult) => {
      setRepairResult(data);
      qc.invalidateQueries({ queryKey: ["/api/admin/master-catalog/diagnostics"] });
      toast({ title: "Repair complete", description: `${data.fixed} docs migrated to new providerMappings format.` });
    },
    onError: (e: any) => toast({ title: "Repair failed", description: e.message, variant: "destructive" }),
  });

  const mc = diag?.masterCatalog;
  const hasWarnings = mc && (mc.unclassified > 0 || mc.noProviderMappings > 0);

  return (
    <Card data-testid="card-master-catalog-debug">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <CardTitle className="text-sm font-medium">Master Catalog Diagnostics</CardTitle>
          {hasWarnings && <AlertCircle className="w-4 h-4 text-destructive" />}
        </div>
        {mc && (
          <span className="text-xs text-muted-foreground">{mc.total} docs</span>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading diagnostics…</p>
          ) : mc ? (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <StatCell label="Total" value={mc.total} />
                <StatCell label="Bridged" value={mc.bridged} good />
                <StatCell label="Printify Only" value={mc.printifyOnly} />
                <StatCell label="Printful Only" value={mc.printfulOnly} />
                <StatCell label="Unclassified" value={mc.unclassified} warn={mc.unclassified > 0} />
                <StatCell label="No Mappings" value={mc.noProviderMappings} warn={mc.noProviderMappings > 0} />
              </div>

              {repairResult && (
                <div className="rounded-md border p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    {repairResult.dryRun ? <AlertCircle className="w-3 h-3 text-amber-500" /> : <CheckCircle className="w-3 h-3 text-green-500" />}
                    {repairResult.dryRun ? "Dry-run scan result" : "Repair applied"}
                  </div>
                  <p className="text-muted-foreground">
                    {repairResult.validIds} valid · {repairResult.invalidIds.length} invalid IDs · {repairResult.missingVariants.length} missing variants · {repairResult.withUnmapped.length} with unmapped values
                    {!repairResult.dryRun && ` · ${repairResult.fixed} migrated`}
                  </p>
                  {repairResult.invalidIds.length > 0 && (
                    <p className="text-destructive">Invalid: {repairResult.invalidIds.slice(0, 5).join(", ")}{repairResult.invalidIds.length > 5 ? `…+${repairResult.invalidIds.length - 5}` : ""}</p>
                  )}
                  {repairResult.missingVariants.length > 0 && (
                    <p className="text-amber-600 dark:text-amber-400">Missing qrgVariants: {repairResult.missingVariants.slice(0, 5).join(", ")}{repairResult.missingVariants.length > 5 ? `…+${repairResult.missingVariants.length - 5}` : ""}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="button-mc-refresh"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Refresh
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="button-mc-scan"
                  onClick={() => scanMutation.mutate()}
                  disabled={scanMutation.isPending}
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {scanMutation.isPending ? "Scanning…" : "Dry-Run Scan"}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  data-testid="button-mc-repair"
                  onClick={() => repairMutation.mutate()}
                  disabled={repairMutation.isPending}
                >
                  <Wrench className="w-3 h-3 mr-1" />
                  {repairMutation.isPending ? "Repairing…" : "Apply Repair"}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>QRG format: <code className="bg-muted px-1 rounded">QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]</code></p>
                <p>Doc ID format: <code className="bg-muted px-1 rounded">qrg_STNNN</code> — Design is a separate field, not in identity.</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No data. Click Refresh to load.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function StatCell({ label, value, warn, good }: { label: string; value: number; warn?: boolean; good?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold tabular-nums ${warn ? "text-destructive" : good ? "text-green-600 dark:text-green-400" : ""}`} data-testid={`text-mc-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {value}
      </span>
    </div>
  );
}
