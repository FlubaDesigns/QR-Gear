import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SYSTEM_SUBNAV } from "@/components/admin/adminNavConfig";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Mail, Edit, Trash2, Send, Clock, CheckCircle, XCircle } from "lucide-react";
import type { EmailTemplate, EmailLog } from "@shared/schema";

const EMAIL_TRIGGERS = [
  { value: "order_confirmation", label: "Order Confirmation", description: "When order is placed" },
  { value: "order_shipped", label: "Order Shipped", description: "When tracking number added" },
  { value: "hosting_expiring_30", label: "Hosting Expiring (30 days)", description: "30 days before QR hosting expires" },
  { value: "hosting_expiring_7", label: "Hosting Expiring (7 days)", description: "7 days before expiration" },
  { value: "hosting_expired", label: "Hosting Expired", description: "When hosting has expired" },
  { value: "welcome", label: "Welcome", description: "When user signs up" },
  { value: "password_reset", label: "Password Reset", description: "Password reset request" },
];

const TEMPLATE_VARIABLES = {
  order_confirmation: ["customerName", "orderNumber", "orderTotal", "orderDate", "items"],
  order_shipped: ["customerName", "orderNumber", "trackingNumber", "carrier", "trackingUrl"],
  hosting_expiring_30: ["customerName", "imageTitle", "expirationDate", "renewalUrl"],
  hosting_expiring_7: ["customerName", "imageTitle", "expirationDate", "renewalUrl"],
  hosting_expired: ["customerName", "imageTitle", "renewalUrl"],
  welcome: ["customerName", "email"],
  password_reset: ["customerName", "resetUrl"],
};

export default function AdminEmailTemplates() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    trigger: "",
    name: "",
    subject: "",
    htmlContent: "",
    textContent: "",
    description: "",
    isEnabled: true,
  });

  const { data: templatesData, isLoading: loadingTemplates } = useQuery<{ templates: EmailTemplate[] } | EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });
  const templates: EmailTemplate[] = Array.isArray(templatesData)
    ? templatesData
    : (templatesData as any)?.templates ?? [];

  const { data: logsData, isLoading: loadingLogs } = useQuery<{ logs: EmailLog[] } | EmailLog[]>({
    queryKey: ["/api/admin/email-logs"],
  });
  const logs: EmailLog[] = Array.isArray(logsData)
    ? logsData
    : (logsData as any)?.logs ?? [];

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/admin/email-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      setIsCreateOpen(false);
      resetForm();
      toast({ title: "Template created successfully" });
    },
    onError: (err: any) => toast({ title: "Failed to create template", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) =>
      apiRequest("PATCH", `/api/admin/email-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      setSelectedTemplate(null);
      toast({ title: "Template updated successfully" });
    },
    onError: (err: any) => toast({ title: "Failed to update template", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/email-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (err: any) => toast({ title: "Failed to delete template", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setFormData({ trigger: "", name: "", subject: "", htmlContent: "", textContent: "", description: "", isEnabled: true });
  };

  const openEditDialog = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      trigger: template.trigger,
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent || "",
      description: template.description || "",
      isEnabled: template.isEnabled ?? true,
    });
  };

  const handleSave = () => {
    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><CheckCircle className="w-3 h-3 mr-1" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <AdminShell
      title="Email Templates"
      subtitle="Manage email templates and view logs"
      icon={Mail}
      sectionNav={<AdminSectionSubNav items={SYSTEM_SUBNAV} />}
    >
        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="min-h-12">
            <TabsTrigger value="templates" className="min-h-10 px-6" data-testid="tab-templates">
              <Mail className="w-4 h-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="logs" className="min-h-10 px-6" data-testid="tab-logs">
              <Clock className="w-4 h-4 mr-2" />
              Email Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-muted-foreground">
                {templates.length} template{templates.length !== 1 ? "s" : ""} configured
              </p>
              <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="min-h-12" data-testid="button-create-template">
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>

            {loadingTemplates ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-6 bg-muted rounded w-1/2" /></CardHeader>
                    <CardContent><div className="h-4 bg-muted rounded w-3/4" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first email template to get started.</p>
                  <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {templates.map((template) => (
                  <Card key={template.id} data-testid={`card-template-${template.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2">
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {template.name}
                          {template.isEnabled ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{template.description || EMAIL_TRIGGERS.find(t => t.value === template.trigger)?.description}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(template)} className="min-h-10 min-w-10" data-testid={`button-edit-${template.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(template.id)} className="min-h-10 min-w-10 text-destructive hover:text-destructive" data-testid={`button-delete-${template.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{template.trigger}</Badge>
                        </div>
                        <p className="text-muted-foreground truncate"><strong>Subject:</strong> {template.subject}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <p className="text-muted-foreground">Recent email activity ({logs.length} logs)</p>

            {loadingLogs ? (
              <Card className="animate-pulse">
                <CardContent className="py-8"><div className="h-4 bg-muted rounded w-1/2 mx-auto" /></CardContent>
              </Card>
            ) : logs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No emails sent yet</h3>
                  <p className="text-muted-foreground">Email logs will appear here once emails are sent.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <Card key={log.id} data-testid={`log-${log.id}`}>
                    <CardContent className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.recipientEmail}</span>
                            {getStatusBadge(log.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{log.subject}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(log.sentAt).toLocaleString()}
                        </div>
                      </div>
                      {log.errorMessage && (
                        <p className="mt-2 text-sm text-destructive">{log.errorMessage}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

      <Dialog open={isCreateOpen || !!selectedTemplate} onOpenChange={(open) => { if (!open) { setIsCreateOpen(false); setSelectedTemplate(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? "Edit Template" : "Create Email Template"}</DialogTitle>
            <DialogDescription>
              {selectedTemplate ? "Update the email template settings." : "Configure a new email template for automated sending."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trigger">Trigger Event</Label>
                <Select value={formData.trigger} onValueChange={(v) => setFormData({ ...formData, trigger: v })}>
                  <SelectTrigger className="min-h-12" data-testid="select-trigger">
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TRIGGERS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Order Confirmation Email"
                  className="min-h-12"
                  data-testid="input-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Email Subject</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="e.g., Your order #{{orderNumber}} is confirmed!"
                className="min-h-12"
                data-testid="input-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of when this template is used"
                className="min-h-12"
                data-testid="input-description"
              />
            </div>

            {formData.trigger && TEMPLATE_VARIABLES[formData.trigger as keyof typeof TEMPLATE_VARIABLES] && (
              <div className="space-y-2">
                <Label>Available Variables</Label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_VARIABLES[formData.trigger as keyof typeof TEMPLATE_VARIABLES].map((v) => (
                    <Badge key={v} variant="outline" className="font-mono text-xs">{`{{${v}}}`}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="htmlContent">HTML Content</Label>
              <Textarea
                id="htmlContent"
                value={formData.htmlContent}
                onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                placeholder="<html>...</html>"
                className="min-h-[200px] font-mono text-sm"
                data-testid="textarea-html"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="textContent">Plain Text Content (Optional)</Label>
              <Textarea
                id="textContent"
                value={formData.textContent}
                onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
                placeholder="Plain text version for email clients that don't support HTML"
                className="min-h-[100px]"
                data-testid="textarea-text"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="isEnabled"
                checked={formData.isEnabled}
                onCheckedChange={(v) => setFormData({ ...formData, isEnabled: v })}
                data-testid="switch-enabled"
              />
              <Label htmlFor="isEnabled">Template is active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); setSelectedTemplate(null); }} className="min-h-12" data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.trigger || !formData.name || !formData.subject || !formData.htmlContent || createMutation.isPending || updateMutation.isPending}
              className="min-h-12"
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : selectedTemplate ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
