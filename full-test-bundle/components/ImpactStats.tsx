import { QrCode, Users, Package, Flag } from "lucide-react";

const stats = [
  {
    icon: QrCode,
    value: "5,000+",
    label: "QR Codes Created",
    color: "ice",
  },
  {
    icon: Users,
    value: "2,500+",
    label: "Happy Customers",
    color: "accent",
  },
  {
    icon: Package,
    value: "10,000+",
    label: "Products Shipped",
    color: "ice",
  },
  {
    icon: Flag,
    value: "100%",
    label: "USA Fulfillment",
    color: "accent",
  },
];

export default function ImpactStats() {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-header">
          <h2>Our Impact</h2>
          <p>Join thousands of satisfied customers</p>
        </div>
        
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="glass-card stat-card"
              data-testid={`stat-${index}`}
            >
              <div className={`stat-card-icon icon-bg-${stat.color}`}>
                <stat.icon className={`icon-color-${stat.color}`} />
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
