import { Smartphone, Type, Image, Video, RefreshCw } from "lucide-react";

const steps = [
  {
    icon: Smartphone,
    title: "Scan with Any Phone",
    description: "Point your camera at the QR code. A link appears — tap it. That's it. No app download needed. Works on iPhone, Android, any modern phone.",
  },
  {
    icon: Type,
    title: "Add Header & Footer Text or Image",
    description: "Want context? Add custom text or an image above or below your QR code. A name, a date, a logo, a call-to-action — printed over and under your code on the product.",
  },
  {
    icon: Image,
    title: "Show Your Image",
    description: "When scanned, the QR code opens a page on our site displaying your chosen image. A photo, artwork, or design — beautifully presented and always available.",
  },
  {
    icon: Video,
    title: "Play Your Video",
    description: "Share a video message, a memory, or a performance. Scan the code and your video plays instantly. Perfect for tributes, promotions, or personal moments.",
  },
  {
    icon: RefreshCw,
    title: "Go Dynamic & Update Anytime",
    description: "With QR Dynamics, the code points to a page you control. Change your image, video, or message whenever you want — no reprinting needed. Your content stays fresh.",
  },
];

export default function HowItWorks() {
  return (
    <section className="home-section">
      <div className="container">
        <div className="section-header">
          <h2>How It Works</h2>
          <p>From scan to story in seconds</p>
        </div>

        <div className="how-it-works-grid">
          {steps.map((step, index) => (
            <div 
              key={index} 
              className="glass-card how-step-card"
              data-testid={`how-step-${index}`}
            >
              <div className="how-step-number">{index + 1}</div>
              <div className="how-step-icon icon-bg-ice">
                <step.icon className="icon-color-ice" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
