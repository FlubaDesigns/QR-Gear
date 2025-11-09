import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import UsaFlag from "./UsaFlag";

interface ProductCardProps {
  image: string;
  name: string;
  price: number;
  madeInUSA?: boolean;
  onCustomize?: () => void;
}

export default function ProductCard({
  image,
  name,
  price,
  madeInUSA = false,
  onCustomize,
}: ProductCardProps) {
  return (
    <Card className="group hover-elevate transition-all duration-200" data-testid={`card-product-${name.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="p-0 relative">
        <div className="aspect-square overflow-hidden rounded-t-lg">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        {madeInUSA && (
          <Badge className="absolute top-3 right-3 gap-1 bg-background/90 backdrop-blur-sm">
            <UsaFlag className="w-4 h-3" />
            <span className="text-xs">Made in USA</span>
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <h3 className="font-semibold text-lg mb-1">{name}</h3>
        <p className="text-muted-foreground">
          Starting at <span className="font-semibold text-foreground">${price.toFixed(2)}</span>
        </p>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Button
          className="w-full"
          onClick={() => {
            console.log(`Customize ${name}`);
            onCustomize?.();
          }}
          data-testid={`button-customize-${name.toLowerCase().replace(/\s+/g, '-')}`}
        >
          Customize
        </Button>
      </CardFooter>
    </Card>
  );
}
