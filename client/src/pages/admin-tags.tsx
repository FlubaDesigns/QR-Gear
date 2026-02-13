import { useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Plus, Check, X, Tag } from "lucide-react";
import type { ProductCategory } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

function ProductTagsContent() {
  const { toast } = useToast();
  
  const { data: categories, isLoading, refetch } = useQuery<ProductCategory[]>({
    queryKey: ["/api/admin/product-categories"],
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/product-categories/seed");
      return res.json();
    },
    onSuccess: (data) => {
      refetch();
      toast({
        title: "Categories Seeded",
        description: `Created ${data.created} default product categories.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to seed categories.",
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
  });

  const groupedCategories = {
    season: categories?.filter(c => c.taxonomyType === "season") || [],
    holiday: categories?.filter(c => c.taxonomyType === "holiday") || [],
    occasion: categories?.filter(c => c.taxonomyType === "occasion") || [],
    other: categories?.filter(c => c.taxonomyType === "other") || [],
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Product Categories</CardTitle>
          <CardDescription>
            Organize products by seasons, holidays, and occasions
          </CardDescription>
        </div>
        <Button
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
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
        {(!categories || categories.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No product categories yet.</p>
            <p className="text-sm">Click "Seed Defaults" to add standard categories.</p>
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
                      <Badge
                        key={cat.id}
                        variant={cat.isActive ? "default" : "outline"}
                        className="gap-2 px-4 py-3 cursor-pointer text-base min-h-[48px] flex items-center"
                        onClick={() => toggleMutation.mutate({ id: cat.id, isActive: !cat.isActive })}
                        data-testid={`badge-category-${cat.slug}`}
                      >
                        {cat.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        {cat.name}
                      </Badge>
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
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      toast({ title: "User ID copied to clipboard" });
    }
  };

  return (
    <div className="min-h-screen">
      <BreadcrumbTrail />
      <div className="bg-slate-900 dark:bg-slate-950 text-white">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin")}
                className="text-white hover:bg-white/10 h-12 w-12"
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Tag className="h-6 w-6 text-amber-400" />
                <div>
                  <h1 className="text-xl font-bold font-heading" data-testid="text-page-title">
                    Product Tags
                  </h1>
                  <p className="text-xs text-slate-400">
                    Manage product tags and categories
                  </p>
                </div>
              </div>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Logged in as</p>
                  <p className="text-sm font-medium">{user.email || user.id}</p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={copyUserId}
                  className="font-mono text-xs border-slate-600 text-slate-300 hover:bg-slate-800 h-12 px-4"
                  data-testid="button-copy-user-id"
                >
                  Copy ID
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        <ProductTagsContent />
      </main>
    </div>
  );
}
