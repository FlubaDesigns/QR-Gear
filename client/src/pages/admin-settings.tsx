import { useQuery, useMutation } from "@tanstack/react-query";
import AdminShell from "@/components/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    status: "valid" | "invalid" | "unknown" | "not_configured" | "not_checked";
    source: string;
    updatedAt: string | null;
  };
  printify: {
    masked: string;
    status: "valid" | "invalid" | "unknown" | "not_configured" | "not_checked";
    source: string;
  };
}

function StatusBadge({ status }: { status: "valid" | "invalid" | "unknown" | "not_configured" | "not_checked" }) {
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
      {status === "not_configured" ? "Not Configured" : "Not Checked"}
    </Badge>
  );
}

export default function AdminSettings() {
  const { toast } = useToast();

  const { data: keyStatus, error, isLoading } = useQuery<ApiKeyStatus>({
    queryKey: ["/api/admin/api-keys"],
    refetchInterval: 30000,
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
      subtitle="Provider status and integration settings"
      icon={Settings}
      backHref="/admin"
      backLabel="RUN"
      sectionNav={<AdminSectionSubNav items={SYSTEM_SUBNAV} />}
    >
      <div className="space-y-6 max-w-2xl">
        {error && <p role="alert">Settings could not load: {error.message}</p>}
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
                      (Managed by Fluba Cortex)
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
                  <p className="text-sm">Provider credentials are managed in Fluba Cortex.</p>
                  <a href="https://flubadesigns.com/admin/cortex" target="_blank" rel="noopener noreferrer" className="underline" data-testid="link-cortex-provider-keys">Manage provider keys in Fluba Cortex</a>
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
              <span className="text-xs text-muted-foreground">(Managed by Fluba Cortex)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Manage the Printify key in Fluba Cortex using the link above.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
