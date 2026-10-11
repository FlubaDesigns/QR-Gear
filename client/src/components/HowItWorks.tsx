import { Shirt, Palette, ScanLine } from "lucide-react";

const steps = [
  { icon: Shirt, title: "Choose your gear", description: "Find the item you want to make your own. Pick from its available colors and sizes." },
  { icon: Palette, title: "Make it meaningful", description: "Create the design and choose what your QR shares: a link, an image, or a video." },
  { icon: ScanLine, title: "Wear it. Share it.", description: "Someone spots your gear, scans the code, and discovers the story behind it." },
];

export default function HowItWorks() {
  return (
    <section className="home-section home-process" aria-labelledby="how-it-works-title">
      <div className="row">
        <header className="section-header">
          <p className="kicker">From your idea to their phone</p>
          <h2 id="how-it-works-title">Make something worth scanning.</h2>
        </header>
        <ol className="layout__split-3">
          {steps.map((step, index) => (
            <li className="how-step-card" key={step.title} data-testid={`how-step-${index}`}>
              <div className="how-step-heading"><span className="how-step-number">0{index + 1}</span><step.icon aria-hidden="true" /></div>
              <h3>{step.title}</h3><p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
