import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminShell from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Settings,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Activity,
  Mail,
  Users,
  BookOpen,
  Heart,
  DatabaseZap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SYSTEM_SUBNAV } from "@/components/admin/adminNavConfig";

interface ApiKeyStatus {
  printful: {
    masked: string;
    status: "valid" | "invalid" | "unknown";
    source: "dashboard" | "env";
    updatedAt: string | null;
  };
  printify: {
    masked: string;
    status: "valid" | "invalid" | "unknown";
    source: string;
  };
}

function StatusBadge({ status }: { status: "valid" | "invalid" | "unknown" }) {
  if (status === "valid") {
    return (
      <Badge className="bg-green-600/20 text-green-400 gap-1">
        <CheckCircle className="w-3 h-3" />
        Active
      </Badge>
    );
  }
  if (status === "invalid") {
    return (
      <Badge className="bg-red-600/20 text-red-400 gap-1">
        <XCircle className="w-3 h-3" />
        Expired / Invalid
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-600/20 text-yellow-400 gap-1">
      <AlertCircle className="w-3 h-3" />
      Unknown
    </Badge>
  );
}

interface MigrationConflict {
  map: string;
  canonicalId: string;
  keptKey: string;
  droppedLegacyKeys: string[];
}

interface MigrationReport {
  catalogId: string;
  catalogName: string;
  migrated: { from: string; to: string }[];
  unresolvable: string[];
  conflicts: MigrationConflict[];
  skipped: number;
  changed: boolean;
}

interface MigrationResult {
  success: boolean;
  catalogsScanned: number;
  catalogsChanged: number;
  totalMigrated: number;
  totalUnresolvable: number;
  totalConflicts: number;
  report: MigrationReport[];
}

export default function AdminSettings() {
  const { toast } = useToast();
  const [newPrintfulKey, setNewPrintfulKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [expandedCatalogs, setExpandedCatalogs] = useState<Set<string>>(new Set());

  const { data: keyStatus, isLoading } = useQuery<ApiKeyStatus>({
    queryKey: ["/api/admin/api-keys"],
    refetchInterval: 30000,
  });

  const updateKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const res = await apiRequest("POST", "/api/admin/api-keys", {
        provider: "printful",
        apiKey,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Printful API key updated and verified" });
      setNewPrintfulKey("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update key",
        description: error.message || "The key may be invalid",
        variant: "destructive",
      });
    },
  });

  const testKeyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/api-keys/test", {
        provider: "printful",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Printful key is valid", description: `Connected to ${data.stores} store(s)` });
      } else {
        toast({ title: "Printful key is invalid", description: data.error, variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
    },
    onError: (error: any) => {
      toast({ title: "Test failed", description: error.message, variant: "destructive" });
    },
  });

  const migrateLegacyIdsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/catalogs/migrate-legacy-ids", {});
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Migration failed");
      }
      return res.json() as Promise<MigrationResult>;
    },
    onSuccess: (data) => {
      setMigrationResult(data);
      if (data.totalMigrated === 0 && data.totalUnresolvable === 0) {
        toast({ title: "All catalog IDs are already canonical", description: "No migration needed." });
      } else if (data.totalUnresolvable > 0) {
        toast({
          title: `Migration complete — ${data.totalUnresolvable} ID(s) need manual review`,
          description: `${data.totalMigrated} ID(s) migrated across ${data.catalogsChanged} catalog(s).`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Migration complete",
          description: `${data.totalMigrated} ID(s) migrated across ${data.catalogsChanged} catalog(s).`,
        });
      }
    },
    onError: (error: any) => {
      toast({ title: "Migration failed", description: error.message, variant: "destructive" });
    },
  });

  function toggleCatalogExpanded(catalogId: string) {
    setExpandedCatalogs((prev) => {
      const next = new Set(prev);
      if (next.has(catalogId)) next.delete(catalogId);
      else next.add(catalogId);
      return next;
    });
  }

  return (
    <AdminShell
      title="Settings"
      subtitle="Manage API keys and integrations"
      icon={Settings}
      backHref="/admin"
      backLabel="RUN"
      sectionNav={<AdminSectionSubNav items={SYSTEM_SUBNAV} />}
    >
      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="w-4 h-4" />
              Printful API Key
            </CardTitle>
            {keyStatus && <StatusBadge status={keyStatus.printful.status} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking key status...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">Current key:</span>
                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono" data-testid="text-printful-key-masked">
                      {keyStatus?.printful.masked || "(not set)"}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      ({keyStatus?.printful.source === "dashboard" ? "Set from dashboard" : "From environment"})
                    </span>
                  </div>
                  {keyStatus?.printful.updatedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last updated: {new Date(keyStatus.printful.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => testKeyMutation.mutate()}
                    disabled={testKeyMutation.isPending}
                    data-testid="button-test-printful-key"
                  >
                    {testKeyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1" />
                    )}
                    Test Current Key
                  </Button>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium">Update Printful API Key</p>
                  <p className="text-xs text-muted-foreground">
                    Get your key from{" "}
                    <a
                      href="https://www.printful.com/dashboard/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 underline"
                    >
                      Printful Dashboard &rarr; Settings &rarr; API
                    </a>
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showKey ? "text" : "password"}
                        placeholder="Paste new Printful API key here"
                        value={newPrintfulKey}
                        onChange={(e) => setNewPrintfulKey(e.target.value)}
                        className="pr-10"
                        data-testid="input-printful-key"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                        data-testid="button-toggle-key-visibility"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button
                      onClick={() => updateKeyMutation.mutate(newPrintfulKey)}
                      disabled={!newPrintfulKey || newPrintfulKey.length < 10 || updateKeyMutation.isPending}
                      data-testid="button-save-printful-key"
                    >
                      {updateKeyMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The key will be validated against Printful before saving. If valid, it takes effect immediately — no deploy needed.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Key className="w-4 h-4" />
              Printify API Key
            </CardTitle>
            {keyStatus && <StatusBadge status={keyStatus.printify.status} />}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Current key:</span>
              <code className="bg-muted px-2 py-1 rounded text-xs font-mono" data-testid="text-printify-key-masked">
                {keyStatus?.printify.masked || "(not set)"}
              </code>
              <span className="text-xs text-muted-foreground">(From environment)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The Printify key is managed through environment variables. Contact support to update.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DatabaseZap className="w-4 h-4" />
              Catalog ID Migration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scans all catalog documents and migrates any legacy blank IDs (provider keys like{" "}
              <code className="bg-muted px-1 rounded text-xs">py_123</code>,{" "}
              <code className="bg-muted px-1 rounded text-xs">pf_456</code>, plain numerics) to
              their canonical <code className="bg-muted px-1 rounded text-xs">qrg_STNNN</code>{" "}
              form. Overlay map keys are re-keyed in the same pass. IDs that cannot be resolved are
              flagged for manual review and never silently dropped.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => migrateLegacyIdsMutation.mutate()}
              disabled={migrateLegacyIdsMutation.isPending}
              data-testid="button-migrate-legacy-ids"
            >
              {migrateLegacyIdsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <DatabaseZap className="w-4 h-4 mr-1" />
              )}
              {migrateLegacyIdsMutation.isPending ? "Migrating…" : "Run Migration"}
            </Button>

            {migrationResult && (
              <div className="space-y-3 pt-2 border-t" data-testid="section-migration-result">
                <div className="flex flex-wrap gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Catalogs scanned:{" "}
                    <strong data-testid="text-migration-scanned">{migrationResult.catalogsScanned}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Updated:{" "}
                    <strong data-testid="text-migration-changed">{migrationResult.catalogsChanged}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    IDs migrated:{" "}
                    <strong data-testid="text-migration-migrated">{migrationResult.totalMigrated}</strong>
                  </span>
                  {migrationResult.totalUnresolvable > 0 && (
                    <span className="text-destructive font-medium">
                      Unresolvable (manual review):{" "}
                      <strong data-testid="text-migration-unresolvable">{migrationResult.totalUnresolvable}</strong>
                    </span>
                  )}
                  {migrationResult.totalConflicts > 0 && (
                    <span className="text-yellow-400 font-medium">
                      Conflicts resolved (canonical kept):{" "}
                      <strong data-testid="text-migration-conflicts">{migrationResult.totalConflicts}</strong>
                    </span>
                  )}
                </div>

                {migrationResult.report.filter((r) => r.changed || r.unresolvable.length > 0 || r.conflicts.length > 0).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Per-catalog details
                    </p>
                    {migrationResult.report
                      .filter((r) => r.changed || r.unresolvable.length > 0 || r.conflicts.length > 0)
                      .map((r) => {
                        const isExpanded = expandedCatalogs.has(r.catalogId);
                        return (
                          <div
                            key={r.catalogId}
                            className="rounded-md border bg-muted/30 overflow-hidden"
                            data-testid={`section-catalog-migration-${r.catalogId}`}
                          >
                            <button
                              className="w-full flex items-center justify-between px-3 py-2 text-sm text-left"
                              onClick={() => toggleCatalogExpanded(r.catalogId)}
                              data-testid={`button-expand-catalog-${r.catalogId}`}
                            >
                              <span className="font-medium">{r.catalogName}</span>
                              <div className="flex items-center gap-2 flex-wrap">
                                {r.migrated.length > 0 && (
                                  <Badge className="bg-green-600/20 text-green-400 text-xs">
                                    {r.migrated.length} migrated
                                  </Badge>
                                )}
                                {r.unresolvable.length > 0 && (
                                  <Badge className="bg-red-600/20 text-red-400 text-xs">
                                    {r.unresolvable.length} unresolvable
                                  </Badge>
                                )}
                                {r.conflicts.length > 0 && (
                                  <Badge className="bg-yellow-600/20 text-yellow-400 text-xs">
                                    {r.conflicts.length} conflict{r.conflicts.length !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-3 pb-3 space-y-2 border-t">
                                {r.migrated.length > 0 && (
                                  <div className="space-y-1 pt-2">
                                    <p className="text-xs font-medium text-green-400">Migrated</p>
                                    {r.migrated.map((m, i) => (
                                      <div
                                        key={i}
                                        className="text-xs font-mono text-muted-foreground flex items-center gap-2"
                                        data-testid={`text-migrated-${r.catalogId}-${i}`}
                                      >
                                        <code className="bg-muted px-1 rounded">{m.from}</code>
                                        <span>&rarr;</span>
                                        <code className="bg-muted px-1 rounded">{m.to}</code>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {r.conflicts.length > 0 && (
                                  <div className="space-y-1 pt-2">
                                    <p className="text-xs font-medium text-yellow-400">
                                      Overlay conflicts — canonical entry kept, legacy dropped
                                    </p>
                                    {r.conflicts.map((c, i) => (
                                      <div
                                        key={i}
                                        className="text-xs font-mono text-muted-foreground"
                                        data-testid={`text-conflict-${r.catalogId}-${i}`}
                                      >
                                        <span className="text-muted-foreground/60">[{c.map}]</span>{" "}
                                        <code className="bg-muted px-1 rounded">{c.canonicalId}</code>
                                        {" — dropped: "}
                                        {c.droppedLegacyKeys.map((k) => (
                                          <code key={k} className="bg-muted px-1 rounded mr-1">{k}</code>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {r.unresolvable.length > 0 && (
                                  <div className="space-y-1 pt-2">
                                    <p className="text-xs font-medium text-destructive">
                                      Unresolvable — requires manual review
                                    </p>
                                    {r.unresolvable.map((id, i) => (
                                      <code
                                        key={i}
                                        className="block text-xs font-mono bg-muted px-1 rounded text-destructive"
                                        data-testid={`text-unresolvable-${r.catalogId}-${i}`}
                                      >
                                        {id}
                                      </code>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}

                {migrationResult.totalMigrated === 0 && migrationResult.totalUnresolvable === 0 && migrationResult.totalConflicts === 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    All catalog blank IDs are already in canonical format.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
