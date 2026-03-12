import { Link } from "wouter";
import { DollarSign, Layers, Wand2, Crown, ShoppingCart, Sparkles, ArrowRight, ChevronRight, QrCode, Image, Film, LayoutGrid, Repeat, CheckCircle, Zap, TrendingUp, Shield, Package, HelpCircle, Lightbulb, Megaphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { useState } from "react";

const journeySteps = [
  {
    phase: "Make It",
    icon: Wand2,
    color: "text-amber-400",
    accent: "from-amber-500/20 to-amber-900/10",
    border: "border-amber-500/30",
    headline: "Your idea becomes a real product in minutes.",
    description: "Our guided wizard walks you through every step. Pick your product, choose a color, select a size, and add your custom QR code. No design skills needed. No software to learn. If you can tap a button, you can make a product.",
    details: [
      "Choose from premium t-shirts across Good, Better, and Best quality tiers",
      "Pick your color — Black, White, Navy, Red, Forest Green, or Gray",
      "Add a scannable QR code that links to anything you want",
      "Customize with header and footer text in your choice of fonts and styles",
      "See a real product mockup before you publish",
    ],
  },
  {
    phase: "Store It",
    icon: Layers,
    color: "text-blue-400",
    accent: "from-blue-500/20 to-blue-900/10",
    border: "border-blue-500/30",
    headline: "Build a library of designs you own forever.",
    description: "Every design you create gets saved to your personal library. Come back anytime to view, remix, or republish your work. Your library is your portfolio, your inventory, and your creative history all in one place.",
    details: [
      "Every product graphic, QR code, and mockup automatically saved",
      "Browse your full design history anytime from your dashboard",
      "Reuse designs across different products and placements",
      "Upload your own images and backgrounds to the library",
      "Your creative work is always yours — accessible whenever you need it",
    ],
  },
  {
    phase: "Sell It",
    icon: Megaphone,
    color: "text-purple-400",
    accent: "from-purple-500/20 to-purple-900/10",
    border: "border-purple-500/30",
    headline: "One tap to share. Zero effort to sell.",
    description: "When you publish a design, it goes live immediately. Share it on social media, text it to friends, or post the link anywhere. We handle the storefront, the checkout, the printing, and the shipping. You just spread the word.",
    details: [
      "Products go live in the store the moment you hit publish",
      "Built-in share tools generate social media\u2013ready images and captions",
      "Share via Instagram, Facebook, X, TikTok, or any platform",
      "No inventory to manage — products are printed when they sell",
      "We handle payment processing, printing, and delivery",
    ],
  },
  {
    phase: "Earn From It",
    icon: DollarSign,
    color: "text-green-400",
    accent: "from-green-500/20 to-green-900/10",
    border: "border-green-500/30",
    headline: "Every sale puts money in your pocket.",
    description: "You earn a share of every sale, every time someone buys a product you designed. There is no cap on what you can earn. The more you create and share, the more you make. Design one product or a hundred — each one is a new stream of income.",
    details: [
      "Earn a percentage of every sale automatically",
      "No limit on how many products you can create",
      "Track your earnings in real time from your dashboard",
      "Multiple products = multiple income streams",
      "Your designs keep earning as long as they stay published",
    ],
  },
];

const qrTypes = [
  {
    name: "QR Basic",
    icon: QrCode,
    tagline: "Link to anything",
    description: "Point your QR code to any URL or text. Perfect for business cards on shirts, event promotions, or personal links.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    name: "QR Plus",
    icon: Lightbulb,
    tagline: "QR + custom graphics",
    description: "Add styled header and footer text around your QR code. Choose fonts, colors, and text effects to make your design stand out.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    name: "QR Canvas",
    icon: Image,
    tagline: "Full artwork integration",
    description: "Combine your QR code with uploaded images and custom backgrounds. Create magazine-quality product graphics.",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    name: "QR Play",
    icon: Film,
    tagline: "Video-powered products",
    description: "Link your QR code to video content. Customers scan and watch a video message, promo, tutorial, or memory.",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    name: "QR Compose",
    icon: LayoutGrid,
    tagline: "Rotating playlists",
    description: "Create a playlist of multiple destinations. The QR code rotates through different content each time it is scanned.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
];

const faqs = [
  {
    q: "Does it cost anything to join?",
    a: "Nothing. Membership is completely free. There are no monthly fees, no setup costs, and no hidden charges. You only pay if you decide to buy a product for yourself.",
  },
  {
    q: "How much do I earn per sale?",
    a: "You earn a percentage of the profit on every sale. The exact amount depends on the product tier and any customizations. You can see your earnings estimate for each product before you publish it.",
  },
  {
    q: "Do I need any design experience?",
    a: "Not at all. The guided wizard handles everything. You make choices — pick a product, choose a color, type your text — and we build the product for you. If you can use a phone, you can create a product.",
  },
  {
    q: "Who handles printing and shipping?",
    a: "We do. Products are printed on demand by our fulfillment partners and shipped directly to the customer. You never touch inventory, packing tape, or a shipping label.",
  },
  {
    q: "Can I create more than one product?",
    a: "There is no limit. Create as many products as you want. Each one is a separate income stream. Some members have dozens of designs earning simultaneously.",
  },
  {
    q: "What happens when someone scans the QR code?",
    a: "They are taken to whatever destination you set up — a website, a video, a social media page, a playlist, or any URL. You control where the QR code points.",
  },
  {
    q: "Can I change my product after publishing?",
    a: "You can create new versions anytime. Your library keeps every design you have made, so you can remix, improve, and republish whenever inspiration strikes.",
  },
];

function FAQItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const panelId = `faq-panel-${index}`;
  const buttonId = `faq-button-${index}`;
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden" data-testid={`faq-${index}`}>
      <button
        id={buttonId}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover-elevate"
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`button-faq-toggle-${index}`}
      >
        <span className="text-white font-medium text-sm">{q}</span>
        <HelpCircle className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="px-4 pb-4">
          <p className="text-slate-300 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function EarnPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Make Money From Your Ideas | QR Gear Creator Program"
        description="Turn your creativity into income. Design custom QR merchandise, share it with the world, and earn money every time someone buys your design. Free to join. No inventory, no risk."
        keywords="earn money, creator program, sell merchandise, QR code products, passive income, design and sell, print on demand, no inventory"
      />
      <Navbar />
      <main className="flex-1">

        <section className="relative overflow-hidden py-16 sm:py-24">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-green-900/20" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium" data-testid="badge-creator-program">
                <Crown className="w-4 h-4" />
                QR Gear Creator Program
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Your ideas deserve to<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-green-400">make you money.</span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
                Design custom products with scannable QR codes. Publish them to the store. Earn every time someone buys.
                No inventory. No shipping. No risk. Just your creativity, working for you.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 pt-4">
                <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 min-h-12 w-full sm:w-auto" data-testid="button-earn-join-hero">
                  <Link href="/members">
                    <Crown className="w-5 h-5 mr-2" />
                    Join Free — Start Creating
                  </Link>
                </Button>
                <Button asChild variant="outline" className="text-lg px-8 min-h-12 border-slate-600 w-full sm:w-auto" data-testid="button-earn-learn-more">
                  <a href="#how-it-works">
                    See How It Works
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </a>
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-6 pt-4 text-sm text-slate-400">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> Free to join</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> No design skills needed</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-green-400" /> Earn on every sale</span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-slate-900/50" id="how-it-works">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-bold text-white mb-3">
                Make It. Store It. Sell It. Earn.
              </h2>
              <p className="text-slate-400 max-w-xl mx-auto text-lg">
                Four phases. One simple process. Your path from idea to income.
              </p>
            </div>
            <div className="max-w-4xl mx-auto space-y-8">
              {journeySteps.map((step, i) => (
                <div key={step.phase} className={`rounded-xl border ${step.border} bg-gradient-to-r ${step.accent} overflow-hidden`} data-testid={`section-journey-${step.phase.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="p-6 sm:p-8 space-y-5">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 border border-slate-600">
                        <span className="text-white font-bold">{i + 1}</span>
                      </div>
                      <step.icon className={`w-7 h-7 ${step.color}`} />
                      <h3 className="text-xl sm:text-2xl font-bold text-white">{step.phase}</h3>
                    </div>
                    <p className="text-lg text-white font-medium">{step.headline}</p>
                    <p className="text-slate-300 leading-relaxed">{step.description}</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {step.details.map((detail, j) => (
                        <li key={j} className="flex items-start gap-2.5">
                          <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${step.color}`} />
                          <span className="text-slate-300 text-sm">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Five Ways to Create
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Every QR type is unlocked for members. Mix and match to build exactly what you envision.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {qrTypes.map((qt) => (
                <div
                  key={qt.name}
                  className={`rounded-xl p-5 border ${qt.bg} space-y-3`}
                  data-testid={`card-qr-type-${qt.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <qt.icon className={`w-7 h-7 ${qt.color}`} />
                    <h3 className="text-white font-bold">{qt.name}</h3>
                  </div>
                  <p className={`text-sm font-medium ${qt.color}`}>{qt.tagline}</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{qt.description}</p>
                </div>
              ))}
              <div className="rounded-xl p-5 border border-dashed border-slate-600 flex flex-col items-center justify-center text-center space-y-3">
                <Repeat className="w-7 h-7 text-slate-500" />
                <p className="text-slate-400 text-sm">More product types and formats coming soon</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Owner vs. Member
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Everyone can build and buy. Members take it further and earn.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-blue-500/20 rounded-full p-2">
                      <ShoppingCart className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Owner</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Free</span>
                  </div>
                  <p className="text-slate-400 text-sm">Build products and buy them for yourself. Great for personal use, gifts, and events.</p>
                  <ul className="space-y-2.5">
                    {[
                      "Build custom QR products with the guided wizard",
                      "Purchase products for yourself or as gifts",
                      "Access QR Basic, Plus, Canvas, and Play",
                      "Unlock QR Compose after 2 purchases",
                      "Full product preview with real mockups",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                        <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant="outline" className="w-full mt-2 border-slate-600" data-testid="button-try-builder">
                    <Link href="/build">
                      Try the Builder
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-900/20 to-green-900/20 border-amber-500/30">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-amber-500/20 rounded-full p-2">
                      <Crown className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Member</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">Free to join</span>
                  </div>
                  <p className="text-slate-400 text-sm">Everything owners get, plus the ability to publish, sell, and earn from your designs.</p>
                  <ul className="space-y-2.5">
                    {[
                      { text: "Everything owners get, plus...", bold: false },
                      { text: "Earn money every time someone buys your design", bold: true },
                      { text: "Save designs to your personal library", bold: true },
                      { text: "Share tools for social media promotion", bold: true },
                      { text: "Advanced builder tools and templates", bold: true },
                      { text: "Earnings dashboard to track your income", bold: true },
                      { text: "Create unlimited products across all QR types", bold: true },
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                        {i === 0 ? (
                          <ChevronRight className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                        )}
                        {item.bold ? <strong className="text-white">{item.text}</strong> : item.text}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-black font-bold" data-testid="button-join-comparison">
                    <Link href="/members">
                      <Crown className="w-4 h-4 mr-2" />
                      Become a Member
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Why This Works
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                No guesswork. No risk. Just a straightforward way to turn creativity into cash.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {[
                { icon: Shield, title: "Zero Risk", desc: "Nothing to buy upfront. Products are made only when someone orders. You never invest a dime in inventory.", color: "text-green-400" },
                { icon: Zap, title: "Instant Setup", desc: "Sign up in seconds. Create your first product in minutes. Be live in the store before your coffee gets cold.", color: "text-amber-400" },
                { icon: Package, title: "We Handle Fulfillment", desc: "Printing, packaging, shipping, returns — all handled. You create and promote. We take care of everything else.", color: "text-blue-400" },
                { icon: TrendingUp, title: "Passive Income", desc: "Design it once, earn from it forever. Every product you publish is an asset that keeps paying you as long as it sells.", color: "text-purple-400" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl p-5 bg-slate-800/50 border border-slate-700 space-y-3" data-testid={`card-why-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  <item.icon className={`w-8 h-8 ${item.color}`} />
                  <h3 className="text-white font-bold">{item.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                How the Money Works
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Transparent. Simple. No surprises.
              </p>
            </div>
            <div className="max-w-3xl mx-auto">
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 overflow-hidden">
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center mx-auto">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Production Cost</p>
                      <p className="text-slate-300 text-sm">What it costs to print and ship the product</p>
                    </div>
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                        <Store className="w-6 h-6 text-amber-400" />
                      </div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Retail Price</p>
                      <p className="text-slate-300 text-sm">The price customers pay in the store</p>
                    </div>
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                        <DollarSign className="w-6 h-6 text-green-400" />
                      </div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">Your Earnings</p>
                      <p className="text-slate-300 text-sm">Your share of the profit, paid automatically</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-700 pt-6">
                    <p className="text-slate-300 text-sm leading-relaxed text-center max-w-xl mx-auto">
                      Every product shows your estimated earnings <strong className="text-white">before you publish</strong>. No guessing, no fine print. You see exactly what you will earn per sale, and you can track it all from your earnings dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Common Questions
              </h2>
              <p className="text-slate-400">Everything you need to know before you start</p>
            </div>
            <div className="max-w-2xl mx-auto space-y-3">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} index={i} />
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24 bg-gradient-to-br from-amber-900/20 via-transparent to-green-900/20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="bg-amber-500/20 rounded-full p-4 w-fit mx-auto">
                <Sparkles className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-white">
                Your first product could be<br />earning money today.
              </h2>
              <p className="text-slate-300 text-lg max-w-xl mx-auto">
                Join the QR Gear creator community. Sign up takes seconds. Your first design takes minutes. And once it is live, it keeps earning for as long as people buy it.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 pt-2">
                <Button asChild className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 min-h-12 w-full sm:w-auto" data-testid="button-earn-join-bottom">
                  <Link href="/members">
                    <Crown className="w-5 h-5 mr-2" />
                    Become a Member — It's Free
                  </Link>
                </Button>
                <Button asChild variant="outline" className="text-lg px-8 min-h-12 border-slate-600 w-full sm:w-auto" data-testid="button-earn-build-bottom">
                  <Link href="/build">
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Or Just Buy Something
                  </Link>
                </Button>
              </div>
              <p className="text-slate-500 text-xs">
                No credit card required. No commitments. Start designing immediately.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
