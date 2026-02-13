import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { nexusFetch } from "@/lib/nexusFetch";
import Navbar from "@/components/Navbar";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Footer from "@/components/Footer";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Filter, X } from "lucide-react";
import UsaFlag from "@/components/UsaFlag";
import type { Product, ProductCategory } from "@shared/schema";

export default function Store() {
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedHoliday, setSelectedHoliday] = useState<string>("");
  const [selectedOccasion, setSelectedOccasion] = useState<string>("");
  const [selectedOther, setSelectedOther] = useState<string>("");
  const [usaOnly, setUsaOnly] = useState<boolean>(false);

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const { data: seasons } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories", "season"],
    queryFn: async () => {
      const res = await nexusFetch("/api/product-categories?taxonomy=season", { source: "store:categories:season", tries: 3 });
      return res.json();
    },
  });

  const { data: holidays } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories", "holiday"],
    queryFn: async () => {
      const res = await nexusFetch("/api/product-categories?taxonomy=holiday", { source: "store:categories:holiday", tries: 3 });
      return res.json();
    },
  });

  const { data: occasions } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories", "occasion"],
    queryFn: async () => {
      const res = await nexusFetch("/api/product-categories?taxonomy=occasion", { source: "store:categories:occasion", tries: 3 });
      return res.json();
    },
  });

  const { data: otherCategories } = useQuery<ProductCategory[]>({
    queryKey: ["/api/product-categories", "other"],
    queryFn: async () => {
      const res = await nexusFetch("/api/product-categories?taxonomy=other", { source: "store:categories:other", tries: 3 });
      return res.json();
    },
  });

  const getActiveCategoryId = () => {
    if (selectedSeason && selectedSeason !== "all") return selectedSeason;
    if (selectedHoliday && selectedHoliday !== "all") return selectedHoliday;
    if (selectedOccasion && selectedOccasion !== "all") return selectedOccasion;
    if (selectedOther && selectedOther !== "all") return selectedOther;
    return null;
  };

  const activeCategoryId = getActiveCategoryId();

  const { data: categoryProducts } = useQuery<Product[]>({
    queryKey: ["/api/category-products", activeCategoryId],
    queryFn: async () => {
      if (!activeCategoryId) return null;
      const res = await nexusFetch(`/api/product-categories/${activeCategoryId}/products`, { source: "store:category:products", tries: 3 });
      return res.json();
    },
    enabled: !!activeCategoryId,
  });

  const enabledProducts = products?.filter(p => p.isEnabled) || [];
  
  // Apply category filter first, then USA filter
  let displayProducts = activeCategoryId
    ? (categoryProducts || [])
    : enabledProducts;
  
  // Apply USA filter if active
  if (usaOnly) {
    displayProducts = displayProducts.filter(p => p.madeInUSA);
  }

  const hasActiveFilters = !!activeCategoryId || usaOnly;

  const clearFilters = () => {
    setSelectedSeason("");
    setSelectedHoliday("");
    setSelectedOccasion("");
    setSelectedOther("");
    setUsaOnly(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Shop QR Products | QR Gear"
        description="Browse our collection of merchandise for your custom QR codes. T-shirts, hats, mugs, bags and more ready for customization. USA options available."
        keywords="QR code products, custom merchandise, promotional items, QR shirts, QR hats"
      />
      <Navbar />
      <BreadcrumbTrail />
      <main className="flex-1 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <PageBreadcrumb currentPage="Shop" />
        <div className="container py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Shop QR Products</h1>
            <p className="text-muted-foreground">Browse our collection and create your custom QR gear</p>
          </div>

          <Card className="mb-8 glass-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Filter by Category</span>
                {hasActiveFilters && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-auto gap-1 text-muted-foreground"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </Button>
                )}
              </div>
              
              <div className="mb-4">
                <Button
                  variant={usaOnly ? "default" : "outline"}
                  size="lg"
                  className={`min-h-[48px] gap-2 text-base font-semibold px-6 ${usaOnly ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                  onClick={() => setUsaOnly(!usaOnly)}
                  data-testid="button-usa-filter"
                >
                  <UsaFlag className="w-6 h-5" />
                  Made in USA
                  {usaOnly && <X className="w-4 h-4 ml-1" />}
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Season</label>
                  <Select value={selectedSeason} onValueChange={(v) => { setSelectedSeason(v); setSelectedHoliday(""); setSelectedOccasion(""); setSelectedOther(""); }}>
                    <SelectTrigger data-testid="select-season">
                      <SelectValue placeholder="All Seasons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Seasons</SelectItem>
                      {seasons?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Holiday</label>
                  <Select value={selectedHoliday} onValueChange={(v) => { setSelectedHoliday(v); setSelectedSeason(""); setSelectedOccasion(""); setSelectedOther(""); }}>
                    <SelectTrigger data-testid="select-holiday">
                      <SelectValue placeholder="All Holidays" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Holidays</SelectItem>
                      {holidays?.map(h => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Occasion</label>
                  <Select value={selectedOccasion} onValueChange={(v) => { setSelectedOccasion(v); setSelectedSeason(""); setSelectedHoliday(""); setSelectedOther(""); }}>
                    <SelectTrigger data-testid="select-occasion">
                      <SelectValue placeholder="All Occasions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Occasions</SelectItem>
                      {occasions?.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Theme</label>
                  <Select value={selectedOther} onValueChange={(v) => { setSelectedOther(v); setSelectedSeason(""); setSelectedHoliday(""); setSelectedOccasion(""); }}>
                    <SelectTrigger data-testid="select-theme">
                      <SelectValue placeholder="All Themes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Themes</SelectItem>
                      {otherCategories?.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="glass-card">
                  <Skeleton className="aspect-square" />
                  <CardContent className="p-4">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayProducts.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-xl font-semibold mb-2 text-foreground">
                  {hasActiveFilters ? "No products in this category" : "No products available"}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {hasActiveFilters 
                    ? "Try selecting a different category or clear filters to see all products." 
                    : "Check back soon for new products!"}
                </p>
                {hasActiveFilters && (
                  <Button onClick={clearFilters} data-testid="button-clear-filters-empty">
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="glass-card overflow-hidden hover-elevate transition-all duration-200"
                    data-testid={`card-product-${product.id}`}
                  >
                    <div className="relative aspect-square bg-muted">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      {product.madeInUSA && (
                        <Badge 
                          className="absolute top-3 right-3 gap-1.5"
                          variant="secondary"
                        >
                          <UsaFlag className="w-4 h-3" />
                          USA
                        </Badge>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-foreground mb-1 truncate">{product.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                        {product.description || `Custom QR ${product.category}`}
                      </p>
                      
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Build to see price</span>
                        <Link href="/build">
                          <Button 
                            size="sm"
                            data-testid={`button-customize-${product.id}`}
                          >
                            Customize
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
