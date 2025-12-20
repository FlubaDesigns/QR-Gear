import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Users, Package, Flag } from "lucide-react";

const stats = [
  {
    icon: QrCode,
    value: "5,000+",
    label: "QR Codes Created",
    colorClass: "icon-bg-ice",
    iconClass: "icon-color-ice",
  },
  {
    icon: Users,
    value: "2,500+",
    label: "Happy Customers",
    colorClass: "icon-bg-accent",
    iconClass: "icon-color-accent",
  },
  {
    icon: Package,
    value: "10,000+",
    label: "Products Shipped",
    colorClass: "icon-bg-ice",
    iconClass: "icon-color-ice",
  },
  {
    icon: Flag,
    value: "100%",
    label: "USA Fulfillment",
    colorClass: "icon-bg-accent",
    iconClass: "icon-color-accent",
  },
];

export default function ImpactStats() {
  return (
    <section className="features">
      <div className="container">
        <div className="center mb-8">
          <h2>Our Impact</h2>
          <p>Join thousands of satisfied customers</p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card 
              key={index}
              className="glass-card border-0 text-center"
              data-testid={`stat-${index}`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${stat.colorClass}`}>
                  <stat.icon className={`w-6 h-6 ${stat.iconClass}`} />
                </div>
                <div className="text-2xl md:text-3xl font-bold mb-1">
                  {stat.value}
                </div>
                <div className="text-sm muted">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
