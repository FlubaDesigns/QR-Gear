import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { Category, getActiveCategories } from "@/lib/categories";

interface CollectionItem {
  id: number;
  title: string;
  categorySlug: string;
  qrColor: string;
}

const collections: CollectionItem[] = [
  { id: 1, title: "Ten Commandments", categorySlug: "religious", qrColor: "#1a1a1a" },
  { id: 2, title: "Bill of Rights", categorySlug: "political", qrColor: "#1a1a1a" },
  { id: 3, title: "Contact Info", categorySlug: "business", qrColor: "#1a1a1a" },
  { id: 4, title: "Gettysburg Address", categorySlug: "political", qrColor: "#1a1a1a" },
  { id: 5, title: "Lord's Prayer", categorySlug: "religious", qrColor: "#1a1a1a" },
  { id: 6, title: "Team Logo", categorySlug: "sports", qrColor: "#1a1a1a" },
  { id: 7, title: "Concert Promo", categorySlug: "entertainment", qrColor: "#1a1a1a" },
  { id: 8, title: "Custom Message", categorySlug: "custom", qrColor: "#1a1a1a" },
];

export default function PreDesignedCollection() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    try {
      const cats = await getActiveCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCollections = selectedCategory === "all"
    ? collections
    : collections.filter((item) => item.categorySlug === selectedCategory);

  return (
    <section className="py-24 px-4 bg-card">
      <div className="container mx-auto max-w-7xl">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-4">
          Pre-Designed Collections
        </h2>
        <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
          Scan to reveal powerful messages and timeless texts
        </p>

        {loading ? (
          <div className="flex justify-center py-4 mb-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              data-testid="button-filter-all"
            >
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.slug ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.slug)}
                data-testid={`button-filter-${cat.slug}`}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        ) : null}

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-6 pb-4">
            {filteredCollections.length === 0 ? (
              <div className="w-full text-center py-12 text-muted-foreground">
                No items in this category yet.
              </div>
            ) : (
              filteredCollections.map((item) => (
                <Card
                  key={item.id}
                  className="w-72 shrink-0 hover-elevate transition-all duration-200 cursor-pointer"
                  onClick={() => console.log(`View ${item.title}`)}
                  data-testid={`card-collection-${item.id}`}
                >
                  <CardContent className="p-6">
                    <div className="aspect-square bg-muted rounded-lg mb-4 flex items-center justify-center">
                      <div className="w-32 h-32 bg-foreground/90 rounded-sm grid grid-cols-8 grid-rows-8 gap-[2px] p-2">
                        {Array.from({ length: 64 }).map((_, i) => (
                          <div
                            key={i}
                            className={`${Math.random() > 0.5 ? "bg-background" : "bg-foreground"}`}
                          />
                        ))}
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4 capitalize">
                      {item.categorySlug.replace("-", " ")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      data-testid={`button-customize-collection-${item.id}`}
                    >
                      Customize This Design
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  );
}
