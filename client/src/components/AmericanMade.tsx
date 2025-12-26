import UsaFlag from "./UsaFlag";
import factoryImage from "@assets/generated_images/American_manufacturing_facility_interior_e6af6a81.png";

const categories = [
  "Premium T-Shirts",
  "Baseball Caps",
  "Hoodies & Sweatshirts",
  "Tote Bags",
];

export default function AmericanMade() {
  return (
    <section className="usa-section">
      <div className="container">
        <div className="usa-grid">
          <div className="usa-image">
            <img
              src={factoryImage}
              alt="American manufacturing facility"
            />
          </div>
          <div className="usa-content">
            <h2>Proudly Supporting American Manufacturing</h2>
            <p>
              We believe in quality, fair wages, and supporting American workers. 
              Many of our products are manufactured right here in the USA.
            </p>
            <div className="usa-categories">
              {categories.map((category, index) => (
                <div key={index} className="usa-category">
                  <UsaFlag className="usa-flag-small" />
                  <span>{category}</span>
                </div>
              ))}
            </div>
            <span className="usa-badge">
              <UsaFlag className="usa-flag-small" />
              Look for the flag on product pages
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
