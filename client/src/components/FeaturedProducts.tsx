import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QRButton } from "@/components/QRButton";
import UsaFlag from "./UsaFlag";
import tshirtImage from "@assets/generated_images/Product_mockup_white_tee_de332d78.png";
import gymBagImage from "@assets/generated_images/Gym_bag_QR_mockup_9450e53d.png";

const products = [
  {
    id: 1,
    image: tshirtImage,
    name: "Premium T-Shirt",
    price: 24.99,
    madeInUSA: true,
    description: "Soft cotton blend with your custom QR code",
  },
  {
    id: 2,
    image: gymBagImage,
    name: "Gym Duffel Bag",
    price: 39.99,
    madeInUSA: true,
    description: "Durable bag with private QR for your contact info",
  },
  {
    id: 3,
    image: tshirtImage,
    name: "Baseball Cap",
    price: 19.99,
    madeInUSA: false,
    description: "Classic cap with front-panel QR code",
  },
];

export default function FeaturedProducts() {
  return (
    <section className="features">
      <div className="container">
        <div className="center mb-8">
          <h2>Featured Products</h2>
          <p>Explore our most popular QR code designs on premium products</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card 
              key={product.id} 
              className="glass-card border-0 overflow-hidden hover-elevate transition-all duration-200"
              data-testid={`card-product-${product.id}`}
            >
              <div className="relative aspect-square">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                {product.madeInUSA && (
                  <Badge 
                    className="absolute top-3 right-3 gap-1.5"
                    variant="secondary"
                  >
                    <UsaFlag className="w-4 h-3" />
                    USA Made
                  </Badge>
                )}
              </div>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                <p className="text-sm mb-4 muted">{product.description}</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Build to see price
                  </span>
                  <Link href="/creator">
                    <Button 
                      size="sm"
                      variant="outline"
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

        <div className="center mt-12">
          <Link href="/gallery">
            <QRButton 
              variant="accent"
              data-testid="button-view-all-products"
            >
              View All Products
            </QRButton>
          </Link>
        </div>
      </div>
    </section>
  );
}
