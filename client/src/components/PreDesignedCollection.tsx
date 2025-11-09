import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const collections = [
  {
    id: 1,
    title: "Ten Commandments",
    category: "Faith-Based",
    qrColor: "#1a1a1a",
  },
  {
    id: 2,
    title: "Bill of Rights",
    category: "Patriotic",
    qrColor: "#1a1a1a",
  },
  {
    id: 3,
    title: "Contact Info",
    category: "Practical",
    qrColor: "#1a1a1a",
  },
  {
    id: 4,
    title: "Gettysburg Address",
    category: "Patriotic",
    qrColor: "#1a1a1a",
  },
];

export default function PreDesignedCollection() {
  return (
    <section className="py-24 px-4 bg-card">
      <div className="container mx-auto max-w-7xl">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-4">
          Pre-Designed Collections
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Scan to reveal powerful messages and timeless texts
        </p>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-6 pb-4">
            {collections.map((item) => (
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
                  <p className="text-sm text-muted-foreground mb-4">
                    {item.category}
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
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  );
}
