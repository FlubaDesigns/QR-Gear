import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus,
  Loader2,
  Trash2,
  Play,
  Pause,
  Eye,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { RepricingStats } from "./orchestration-types";

export function RepricingTabContent() {
  const { toast } = useToast();

  const { data: repricingStats, isLoading: repricingStatsLoading } = useQuery<RepricingStats>({
    queryKey: ["/api/admin/orchestration/repricing/stats"],
  });

  const { data: repricingRules = [], isLoading: repricingRulesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/orchestration/repricing/rules"],
  });

  const { data: repricingHistory = [], isLoading: repricingHistoryLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/orchestration/repricing/history"],
  });

  const [createRuleDialogOpen, setCreateRuleDialogOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDescription, setNewRuleDescription] = useState("");
  const [newRuleActionType, setNewRuleActionType] = useState("adjust_margin");
  const [newRuleTargetMargin, setNewRuleTargetMargin] = useState("");
  const [newRuleMarginThreshold, setNewRuleMarginThreshold] = useState("");

  const createRuleMutation = useMutation({
    mutationFn: async () => {
      const params: any = {
        name: newRuleName.trim(),
        description: newRuleDescription.trim() || undefined,
        actionType: newRuleActionType,
        conditions: {},
        actionParams: {},
      };
      if (newRuleMarginThreshold) {
        params.conditions.marginBelow = parseFloat(newRuleMarginThreshold);
      }
      if (newRuleTargetMargin) {
        params.actionParams.targetMarginPercent = parseFloat(newRuleTargetMargin);
      }
      return apiRequest("POST", "/api/admin/orchestration/repricing/rules", params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      setCreateRuleDialogOpen(false);
      setNewRuleName("");
      setNewRuleDescription("");
      setNewRuleTargetMargin("");
      setNewRuleMarginThreshold("");
      toast({ title: "Rule Created", description: "Repricing rule created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("POST", `/api/admin/orchestration/repricing/rules/${ruleId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      toast({ title: "Rule Updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiRequest("DELETE", `/api/admin/orchestration/repricing/rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      toast({ title: "Rule Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const runRepricingMutation = useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/orchestration/repricing/run", { dryRun });
      return res.json() as Promise<{ dryRun: boolean; productsAffected: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/repricing/stats"] });
      if (data.dryRun) {
        toast({
          title: "Preview Complete",
          description: `${data.productsAffected} products would be affected`,
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orchestration/master-products"] });
        toast({
          title: "Repricing Complete",
          description: `${data.productsAffected} products updated`,
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-semibold">Auto-Repricing Rules</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => runRepricingMutation.mutate({ dryRun: true })}
            disabled={runRepricingMutation.isPending}
            variant="outline"
            className="h-12"
            data-testid="button-preview-repricing"
          >
            {runRepricingMutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Eye className="w-5 h-5 mr-2" />
            )}
            Preview Changes
          </Button>
          <Button
            onClick={() => runRepricingMutation.mutate({ dryRun: false })}
            disabled={runRepricingMutation.isPending}
            className="h-12"
            data-testid="button-run-repricing"
          >
            {runRepricingMutation.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Play className="w-5 h-5 mr-2" />
            )}
            Apply Rules
          </Button>
        </div>
      </div>

      {repricingStatsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold" data-testid="text-total-rules">{repricingStats?.totalRules || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-active-rules">{repricingStats?.activeRules || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Products Adjusted (24h)</p>
                <p className="text-2xl font-bold" data-testid="text-products-adjusted">{repricingStats?.productsAdjusted24h || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Avg Price Change</p>
                <p className="text-2xl font-bold" data-testid="text-avg-change">${repricingStats?.avgPriceChange?.toFixed(2) || '0.00'}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <CardTitle className="text-base">Repricing Rules</CardTitle>
              <Dialog open={createRuleDialogOpen} onOpenChange={setCreateRuleDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-12" data-testid="button-create-rule">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Repricing Rule</DialogTitle>
                    <DialogDescription>
                      Set up automatic price adjustments based on conditions.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="rule-name">Rule Name</Label>
                      <Input
                        id="rule-name"
                        value={newRuleName}
                        onChange={(e) => setNewRuleName(e.target.value)}
                        placeholder="e.g., Protect Amazon Margins"
                        data-testid="input-rule-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rule-description">Description</Label>
                      <Textarea
                        id="rule-description"
                        value={newRuleDescription}
                        onChange={(e) => setNewRuleDescription(e.target.value)}
                        placeholder="What this rule does..."
                        data-testid="input-rule-description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="action-type">Action Type</Label>
                        <Select value={newRuleActionType} onValueChange={setNewRuleActionType}>
                          <SelectTrigger id="action-type" data-testid="select-action-type">
                            <SelectValue placeholder="Select action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="adjust_margin">Adjust to Target Margin</SelectItem>
                            <SelectItem value="increase_percent">Increase by Percent</SelectItem>
                            <SelectItem value="decrease_percent">Decrease by Percent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="target-margin">Target Margin %</Label>
                        <Input
                          id="target-margin"
                          type="number"
                          value={newRuleTargetMargin}
                          onChange={(e) => setNewRuleTargetMargin(e.target.value)}
                          placeholder="50"
                          data-testid="input-target-margin"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="margin-threshold">Trigger When Margin Below %</Label>
                      <Input
                        id="margin-threshold"
                        type="number"
                        value={newRuleMarginThreshold}
                        onChange={(e) => setNewRuleMarginThreshold(e.target.value)}
                        placeholder="20"
                        data-testid="input-margin-threshold"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateRuleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createRuleMutation.mutate()}
                      disabled={createRuleMutation.isPending || !newRuleName.trim()}
                      data-testid="button-submit-rule"
                    >
                      {createRuleMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Create Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {repricingRulesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !repricingRules || repricingRules.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No repricing rules configured. Create a rule to automate price adjustments.
                </p>
              ) : (
                <div className="space-y-3">
                  {repricingRules.map((rule: any) => (
                    <div
                      key={rule.id}
                      className={`p-4 rounded-md border ${rule.isActive ? 'border-green-500/30 bg-green-500/5' : 'border-muted bg-muted/20'}`}
                      data-testid={`rule-${rule.id}`}
                    >
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{rule.name}</h4>
                            <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                              {rule.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {rule.description || `${rule.actionType} - Priority ${rule.priority || 0}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="min-h-12 min-w-12"
                            onClick={() => toggleRuleMutation.mutate(rule.id)}
                            disabled={toggleRuleMutation.isPending}
                            data-testid={`button-toggle-rule-${rule.id}`}
                          >
                            {rule.isActive ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="min-h-12 min-w-12 text-destructive hover:text-destructive"
                            onClick={() => deleteRuleMutation.mutate(rule.id)}
                            disabled={deleteRuleMutation.isPending}
                            data-testid={`button-delete-rule-${rule.id}`}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Price Changes</CardTitle>
            </CardHeader>
            <CardContent>
              {repricingHistoryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !repricingHistory || repricingHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No price changes recorded yet. Run the repricing engine to see history here.
                </p>
              ) : (
                <div className="space-y-2">
                  {repricingHistory.slice(0, 10).map((entry: any) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-md bg-muted/30 flex items-center justify-between gap-4"
                      data-testid={`history-${entry.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{entry.productTitle || 'Unknown Product'}</p>
                        <p className="text-xs text-muted-foreground">{entry.reason}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <p className="text-muted-foreground line-through">${parseFloat(entry.previousPrice || 0).toFixed(2)}</p>
                          <p className="font-medium text-green-600">${parseFloat(entry.newPrice || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {entry.previousMargin ? `${parseFloat(entry.previousMargin).toFixed(1)}%` : '-'}
                          </p>
                          <p className="text-xs font-medium">
                            {entry.newMargin ? `${parseFloat(entry.newMargin).toFixed(1)}%` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
