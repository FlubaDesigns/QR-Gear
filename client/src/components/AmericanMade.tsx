import { Badge } from "@/components/ui/badge";
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
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="rounded-lg overflow-hidden">
            <img
              src={factoryImage}
              alt="American manufacturing facility"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
              Proudly Supporting American Manufacturing
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              We believe in quality, fair wages, and supporting American workers. 
              Many of our products are manufactured right here in the USA.
            </p>
            <div className="space-y-3 mb-8">
              {categories.map((category, index) => (
                <div key={index} className="flex items-center gap-3">
                  <UsaFlag className="w-6 h-4" />
                  <span className="font-medium">{category}</span>
                </div>
              ))}
            </div>
            <Badge className="gap-2" variant="secondary">
              <UsaFlag className="w-5 h-3" />
              <span>Look for the flag on product pages</span>
            </Badge>
          </div>
        </div>
      </div>
    </section>
  );
}
