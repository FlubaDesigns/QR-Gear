import ProductCard from "./ProductCard";
import tshirtImage from "@assets/generated_images/Product_mockup_white_tee_de332d78.png";
import gymBagImage from "@assets/generated_images/Gym_bag_QR_mockup_9450e53d.png";

const products = [
  {
    id: 1,
    image: tshirtImage,
    name: "Premium T-Shirt",
    price: 24.99,
    madeInUSA: true,
  },
  {
    id: 2,
    image: gymBagImage,
    name: "Gym Duffel Bag",
    price: 39.99,
    madeInUSA: true,
  },
  {
    id: 3,
    image: tshirtImage,
    name: "Baseball Cap",
    price: 19.99,
    madeInUSA: false,
  },
];

export default function FeaturedProducts() {
  return (
    <section className="py-24 px-4 bg-card">
      <div className="container mx-auto max-w-7xl">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-4">
          Featured Products
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Explore our most popular QR code designs on premium products
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
