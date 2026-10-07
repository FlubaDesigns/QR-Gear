import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Check, X, Tag } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { BUILD_SUBNAV } from "@/components/admin/adminNavConfig";
import { parseProductTags, type ProductTag } from "@shared/productTags";
import { useAuth } from "@/hooks/useAuth";

export function ProductTagsContent() {
  const { toast } = useToast();
  
  const { data: categories, isLoading, isFetching, isError, refetch } = useQuery<ProductTag[]>({
    queryKey: ["/api/admin/product-categories"],
    queryFn: async () => parseProductTags(await (await apiRequest("GET", "/api/admin/product-categories")).json()),
    select: parseProductTags,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/product-categories/seed");
      return res.json();
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Tags seeded",
        description: `Created ${data.created} default tags.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed tags.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await apiRequest("PUT", `/api/admin/product-categories/${id}`, { isActive });
    },
    onSuccess: () => {
      refetch();
    },
    onError: () => toast({ title: "Save failed", description: "Could not update the tag. Please try again.", variant: "destructive" }),
  });

  const groupedCategories = {
    season: categories?.filter(c => c.taxonomyType === "season") || [],
    holiday: categories?.filter(c => c.taxonomyType === "holiday") || [],
    occasion: categories?.filter(c => c.taxonomyType === "occasion") || [],
    other: categories?.filter(c => !["season", "holiday", "occasion"].includes(c.taxonomyType)) || [],
  };

  const busy = seedMutation.isPending || toggleMutation.isPending || isFetching;

  if (isLoading) {
    return (
      <Card className="min-w-0 max-w-full">
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 max-w-full">
      <CardHeader className="flex flex-col items-start gap-4 lg:flex-row lg:justify-between">
        <div>
          <CardTitle>Product Tags</CardTitle>
          <CardDescription>
            Organize products by seasons, holidays, and occasions
          </CardDescription>
        </div>
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={busy || isError}
          className="h-12 px-6"
          data-testid="button-seed-categories"
        >
          {seedMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Plus className="w-5 h-5 mr-2" />
          )}
          Seed Defaults
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {isError ? (
          <div role="alert" className="space-y-3"><p>Could not load tags. Please retry.</p><Button className="h-12" onClick={() => refetch()} disabled={isFetching}>Retry</Button></div>
        ) : (!categories || categories.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No tags yet.</p>
            <p className="text-sm">Click "Seed Defaults" to add standard tags.</p>
          </div>
        ) : (
          <>
            {Object.entries(groupedCategories).map(([taxonomyType, cats]) => (
              cats.length > 0 && (
                <div key={taxonomyType}>
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                    {taxonomyType === "season" ? "Seasons" :
                     taxonomyType === "holiday" ? "Holidays" :
                     taxonomyType === "occasion" ? "Occasions" : "Other Themes"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {cats.map(cat => (
                      <Button
                        key={cat.id}
                        variant={cat.isActive ? "default" : "outline"}
                        className="gap-2 max-w-full h-auto px-4 py-3 text-base min-h-[48px] whitespace-normal text-left [overflow-wrap:anywhere]"
                        disabled={busy}
                        aria-pressed={cat.isActive === true}
                        onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                        data-testid={`badge-category-${cat.slug}`}
                      >
                        {cat.isActive ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                        <span className="min-w-0">{cat.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminTags() {
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  const actionButtons = user ? (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <p className="text-xs text-muted-foreground">Logged in as</p>
        <p className="text-sm font-medium">{user.email || user.id}</p>
      </div>
      <Button 
        variant="outline" 
        onClick={copyUserId}
        className="font-mono text-xs h-12 px-4"
        data-testid="button-copy-user-id"
      >
        Copy ID
      </Button>
    </div>
  ) : undefined;

  return (
    <AdminShell
      title="Product Tags"
      subtitle="Manage seasons, holidays, and occasions"
      icon={Tag}
      backHref="/admin"
      backLabel="Back"
      actions={actionButtons}
      sectionNav={<AdminSectionSubNav items={BUILD_SUBNAV} />}
    >
      <ProductTagsContent />
    </AdminShell>
  );
}
