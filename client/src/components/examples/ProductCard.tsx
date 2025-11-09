import ProductCard from "../ProductCard";
import productImage from "@assets/generated_images/Product_mockup_white_tee_de332d78.png";

export default function ProductCardExample() {
  return (
    <div className="max-w-sm">
      <ProductCard
        image={productImage}
        name="Classic T-Shirt"
        price={24.99}
        madeInUSA={true}
      />
    </div>
  );
}
