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

export default function AdminSettings() {
  const { toast } = useToast();
  const [newPrintfulKey, setNewPrintfulKey] = useState("");
  const [showKey, setShowKey] = useState(false);

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
      </div>
    </AdminShell>
  );
}
