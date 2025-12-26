import { Link } from "wouter";
import { QRButton } from "@/components/QRButton";
import UsaFlag from "./UsaFlag";
import tshirtImage from "@assets/generated_images/Product_mockup_white_tee_de332d78.png";
import gymBagImage from "@assets/generated_images/Gym_bag_QR_mockup_9450e53d.png";

const products = [
  {
    id: 1,
    image: tshirtImage,
    name: "Premium T-Shirt",
    madeInUSA: true,
    description: "Soft cotton blend with your custom QR code",
  },
  {
    id: 2,
    image: gymBagImage,
    name: "Gym Duffel Bag",
    madeInUSA: true,
    description: "Durable bag with private QR for your contact info",
  },
  {
    id: 3,
    image: tshirtImage,
    name: "Baseball Cap",
    madeInUSA: false,
    description: "Classic cap with front-panel QR code",
  },
];

export default function FeaturedProducts() {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-header">
          <h2>Featured Products</h2>
          <p>Explore our most popular QR code designs on premium products</p>
        </div>

        <div className="products-grid">
          {products.map((product) => (
            <div 
              key={product.id} 
              className="glass-card product-card hover-elevate"
              data-testid={`card-product-${product.id}`}
            >
              <div className="product-card-image">
                <img
                  src={product.image}
                  alt={product.name}
                />
                {product.madeInUSA && (
                  <span className="product-card-badge">
                    <UsaFlag className="usa-flag-small" />
                    USA
                  </span>
                )}
              </div>
              <div className="product-card-content">
                <h3>{product.name}</h3>
                <p className="product-card-description">{product.description}</p>
                <div className="product-card-footer">
                  <span className="product-card-price">Build to see price</span>
                  <Link href="/creator">
                    <button 
                      className="product-card-btn"
                      data-testid={`button-customize-${product.id}`}
                    >
                      Customize
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-cta">
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
