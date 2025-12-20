import { Card, CardContent } from "@/components/ui/card";
import { QrCode, Users, Package, Flag } from "lucide-react";

const stats = [
  {
    icon: QrCode,
    value: "5,000+",
    label: "QR Codes Created",
    iconBgClass: "stat-icon-cyan",
    iconColorClass: "icon-color-cyan",
  },
  {
    icon: Users,
    value: "2,500+",
    label: "Happy Customers",
    iconBgClass: "stat-icon-gold",
    iconColorClass: "icon-color-gold",
  },
  {
    icon: Package,
    value: "10,000+",
    label: "Products Shipped",
    iconBgClass: "stat-icon-cyan",
    iconColorClass: "icon-color-cyan",
  },
  {
    icon: Flag,
    value: "100%",
    label: "USA Fulfillment",
    iconBgClass: "stat-icon-gold",
    iconColorClass: "icon-color-gold",
  },
];

export default function ImpactStats() {
  return (
    <section className="py-20 px-4 impact-stats-bg">
      <div className="container mx-auto max-w-5xl">
        <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-4 text-white">
          Our Impact
        </h2>
        <p className="text-center text-white/70 mb-12 max-w-2xl mx-auto">
          Join thousands of satisfied customers who trust QR Gear for their custom merchandise
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card 
              key={index}
              className="bg-white/5 border-white/10 backdrop-blur-sm text-center"
              data-testid={`stat-${index}`}
            >
              <CardContent className="p-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${stat.iconBgClass}`}>
                  <stat.icon className={`w-6 h-6 ${stat.iconColorClass}`} />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-white/60">
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
