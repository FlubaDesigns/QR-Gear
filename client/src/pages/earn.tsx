import { Link } from "wouter";
import { DollarSign, Palette, Share2, BarChart3, Layers, Wand2, Crown, ShoppingCart, Users, Sparkles, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";

const memberBenefits = [
  {
    icon: DollarSign,
    title: "Earn From Every Sale",
    description: "Design a product once. Every time someone buys it, you earn a share of the sale. Your creativity pays you over and over.",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: Layers,
    title: "Your Personal Design Library",
    description: "Save every design you create. Build a collection of products you can come back to, remix, and share anytime.",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: Share2,
    title: "Built-In Share Tools",
    description: "Get ready-made social media images and pre-written share captions. One tap to post your products and start driving sales.",
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: Wand2,
    title: "Advanced Builder Tools",
    description: "Unlock powerful creation tools: background libraries, image cropping, video integration, and custom QR compositions.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Palette,
    title: "All QR Types Unlocked",
    description: "Create with every QR product type - Basic, Plus, Canvas, Play, and Compose. Mix images, video, and rotating playlists.",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
  {
    icon: BarChart3,
    title: "Track Your Earnings",
    description: "See what's selling, how much you've earned, and which designs are performing best. All from your member dashboard.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/20",
  },
];

const howItWorks = [
  { step: 1, title: "Sign up for free", description: "Create your member account in seconds. No fees, no commitments." },
  { step: 2, title: "Design your product", description: "Use the guided wizard to pick a product, choose colors, add QR content, and customize." },
  { step: 3, title: "Publish and share", description: "Your product goes live in the store. Share it on social media with one tap." },
  { step: 4, title: "Earn on every sale", description: "When someone buys your design, you earn money. It's that simple." },
];

export default function EarnPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="Make Money From Your Ideas | QR Gear Creator Program"
        description="Turn your creativity into income. Design custom QR merchandise, share it with the world, and earn money every time someone buys your design. Free to join."
        keywords="earn money, creator program, sell merchandise, QR code products, passive income, design and sell"
      />
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden py-16 sm:py-24">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-green-900/20" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium" data-testid="badge-creator-program">
                <Crown className="w-4 h-4" />
                Creator Program
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
                Got an idea?<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-green-400">Turn it into income.</span>
              </h1>
              <p className="text-lg text-slate-300 max-w-xl mx-auto">
                Design custom QR merchandise, share it with the world, and earn money every time someone buys your creation. No inventory. No shipping. Just your creativity.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                <Link href="/members">
                  <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 min-h-12" data-testid="button-earn-join-hero">
                    <Crown className="w-5 h-5 mr-2" />
                    Join Free
                  </Button>
                </Link>
                <Link href="/build">
                  <Button variant="outline" className="text-lg px-8 min-h-12 border-slate-600" data-testid="button-earn-try-builder">
                    Try the Builder First
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Owner vs. Member
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Everyone can build and buy. Members take it further.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="rounded-xl p-6 bg-slate-800/50 border border-slate-700 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-blue-500/20 rounded-full p-2">
                    <ShoppingCart className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Owner</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Free</span>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    Build custom QR products with the guided wizard
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    Purchase products for yourself
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    Access QR Basic, Plus, Canvas, and Play
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <ChevronRight className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    Unlock QR Compose after 2 purchases
                  </li>
                </ul>
              </div>

              <div className="rounded-xl p-6 bg-gradient-to-br from-amber-900/20 to-green-900/20 border border-amber-500/30 space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-amber-500/20 rounded-full p-2">
                    <Crown className="w-6 h-6 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Member</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">Free to join</span>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <ChevronRight className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    Everything owners get, plus...
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <DollarSign className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <strong className="text-white">Earn money</strong> every time someone buys your design
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <Layers className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    Save designs to your <strong className="text-white">personal library</strong>
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <Share2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <strong className="text-white">Share tools</strong> for social media promotion
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <Wand2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <strong className="text-white">Advanced builder</strong> tools and templates
                  </li>
                  <li className="flex items-start gap-2 text-slate-300 text-sm">
                    <BarChart3 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <strong className="text-white">Earnings dashboard</strong> to track your income
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                What Members Get
              </h2>
              <p className="text-slate-400">Tools to turn your creativity into a business</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {memberBenefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className={`rounded-xl p-5 border ${benefit.bg} space-y-3`}
                  data-testid={`card-benefit-${benefit.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <benefit.icon className={`w-8 h-8 ${benefit.color}`} />
                  <h3 className="text-white font-bold">{benefit.title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                How It Works
              </h2>
              <p className="text-slate-400">From idea to income in four steps</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {howItWorks.map((item) => (
                <div key={item.step} className="text-center space-y-3" data-testid={`step-${item.step}`}>
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto">
                    <span className="text-amber-400 font-bold text-lg">{item.step}</span>
                  </div>
                  <h3 className="text-white font-bold">{item.title}</h3>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12 sm:py-16 bg-gradient-to-br from-amber-900/20 via-transparent to-green-900/20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="bg-amber-500/20 rounded-full p-4 w-fit mx-auto">
                <Sparkles className="w-10 h-10 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                Ready to start earning?
              </h2>
              <p className="text-slate-300">
                Join the QR Gear creator community. It's free, it's simple, and your first design could be earning money today.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/members">
                  <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-lg px-8 min-h-12" data-testid="button-earn-join-bottom">
                    <Crown className="w-5 h-5 mr-2" />
                    Become a Member
                  </Button>
                </Link>
                <Link href="/build">
                  <Button variant="outline" className="text-lg px-8 min-h-12 border-slate-600" data-testid="button-earn-build-bottom">
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Or Just Buy Something
                  </Button>
                </Link>
              </div>
              <p className="text-slate-500 text-xs">
                No credit card required to join. Start designing immediately.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
