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
    <div 
      className="glass-card product-card hover-elevate" 
      data-testid={`card-product-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="product-card-image">
        <img
          src={image}
          alt={name}
        />
        {madeInUSA && (
          <span className="product-card-badge">
            <UsaFlag className="usa-flag-small" />
            Made in USA
          </span>
        )}
      </div>
      <div className="product-card-content">
        <h3>{name}</h3>
        <p className="product-card-description">
          Starting at <span className="product-card-price-value">${price.toFixed(2)}</span>
        </p>
        <button
          className="product-card-btn-full"
          onClick={() => {
            console.log(`Customize ${name}`);
            onCustomize?.();
          }}
          data-testid={`button-customize-${name.toLowerCase().replace(/\s+/g, '-')}`}
        >
          Customize
        </button>
      </div>
    </div>
  );
}
