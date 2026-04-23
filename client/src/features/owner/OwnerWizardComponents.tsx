import { Button } from "@/components/ui/button";
import { ShoppingCart, DollarSign, Crown, Tag, Users, Sparkles, QrCode, Type, ImagePlus, Play, Layers, ArrowRight, Palette, Crosshair, PenLine, PartyPopper, Check } from "lucide-react";

export interface GuidedCardData {
  icon: React.ReactNode;
  title: string;
  lines: { text: string; highlight?: boolean }[];
  tip?: string;
  buttonText?: string;
}

export const GUIDED_CARDS: Record<string, GuidedCardData> = {
  'welcome': {
    icon: <Sparkles className="w-8 h-8" />,
    title: "Let's Build Your Custom Tee",
    lines: [
      { text: "You're about to design your own t-shirt with a QR code built right into it." },
      { text: "When you or anyone scans it, something cool happens — a video plays, a page opens, whatever you set up.", highlight: true },
      { text: "We'll walk you through every step. No design skills needed." },
      { text: "Takes about 2 minutes. Ready?" },
    ],
    tip: "Introduce the moments that matter — wear them, scan them, share them.",
    buttonText: "Let's Do This",
  },
  'product': {
    icon: <ShoppingCart className="w-8 h-8" />,
    title: "Pick Your Shirt",
    lines: [
      { text: "Here's where you choose which t-shirt style you want." },
      { text: "Each one has a different look and starting price.", highlight: true },
      { text: "Your QR code gets printed right on it — same great quality no matter which you pick." },
      { text: "Tap the one you like and we'll keep going." },
    ],
    tip: "Every style looks great with a QR code — pick the one that fits your vibe.",
  },
  'color': {
    icon: <Palette className="w-8 h-8" />,
    title: "Make It Yours",
    lines: [
      { text: "Time to pick your color and size." },
      { text: "This is YOUR t-shirt — choose what you actually want to wear.", highlight: true },
      { text: "Every color is the same price. No gotchas." },
      { text: "Bigger sizes add a small upcharge — you'll see it update as you go." },
    ],
    tip: "The price updates in real time so there are no surprises at checkout.",
  },
  'type': {
    icon: <QrCode className="w-8 h-8" />,
    title: "What Should Your QR Do?",
    lines: [
      { text: "This is what makes your t-shirt interactive." },
      { text: "Canvas — scanning reveals a full-screen image. A photo, a design, your art — it's like a hidden gallery.", highlight: true },
      { text: "Play — scanning launches a full-screen video. Movement, sound, story — maximum impact." },
      { text: "Basic & Plus are great too — they open a link or add custom text to your shirt." },
    ],
    tip: "Canvas and Play create the biggest reactions — people love scanning and seeing something unexpected.",
  },
  'placement': {
    icon: <Crosshair className="w-8 h-8" />,
    title: "Where Do You Want It?",
    lines: [
      { text: "Now pick where on your t-shirt the QR design goes." },
      { text: "Front, back, or both — totally up to you.", highlight: true },
      { text: "Most people go with front. Back works great if you want a bigger design." },
      { text: "Adding a second spot costs a little extra." },
    ],
  },
  'text': {
    icon: <PenLine className="w-8 h-8" />,
    title: "Add Text or Image",
    lines: [
      { text: "Want words or an image printed on your shirt alongside the QR code?" },
      { text: "A phrase on top, a logo on the bottom — or nothing at all. Totally optional.", highlight: true },
      { text: "This is what people see on your shirt before they scan." },
      { text: "Keep it short and fun, or upload an image. Your call." },
    ],
    tip: "Ideas: \"Scan me\" — \"Watch this\" — \"Our story\" — or upload your logo.",
  },
  'type-confirm-basic': {
    icon: <QrCode className="w-8 h-8" />,
    title: "Nice — You Picked Basic QR",
    lines: [
      { text: "Your QR code will open any link you choose — a website, a social profile, a video, whatever you want." },
      { text: "Simple, clean, and it works every time someone scans your shirt.", highlight: true },
      { text: "Up next we'll figure out where it goes on your shirt and how big you want it." },
      { text: "You'll have choices at every step — nothing is locked in until you say so." },
    ],
    tip: "You can always change the link your QR points to later — even after you get the shirt.",
  },
  'type-confirm-plus': {
    icon: <Type className="w-8 h-8" />,
    title: "Great Choice — QR Plus",
    lines: [
      { text: "QR Plus does everything Basic does, but you also get custom text printed right on the shirt alongside your QR code." },
      { text: "A headline on top, a message underneath — whatever you want people to read before they scan.", highlight: true },
      { text: "Next up, we'll set where everything goes on your shirt and how big it should be." },
      { text: "More choices ahead — we'll walk you through each one." },
    ],
    tip: "Most people use something short like \"Scan Me\" or their brand name.",
  },
  'type-confirm-canvas': {
    icon: <ImagePlus className="w-8 h-8" />,
    title: "You Picked Canvas — Nice",
    lines: [
      { text: "When someone scans your shirt, they'll see a full-screen image — a photo, a design, art, anything you upload." },
      { text: "This is the wow factor. It turns your t-shirt into a window to something bigger.", highlight: true },
      { text: "Coming up, you'll place the QR on your shirt and upload the image people will see when they scan." },
      { text: "We'll walk you through each part — it's easier than you think." },
    ],
    tip: "Think of it like a secret reveal — the shirt is the teaser, the scan is the payoff.",
  },
  'type-confirm-play': {
    icon: <Play className="w-8 h-8" />,
    title: "Play Mode — Love It",
    lines: [
      { text: "When someone scans your shirt, a video plays. Full screen, right on their phone." },
      { text: "A message, a performance, a memory, a promo — whatever story you want to tell.", highlight: true },
      { text: "Next we'll set where the QR goes on your shirt, then you'll upload or link your video." },
      { text: "Every step has choices — we'll guide you through each one." },
    ],
    tip: "Videos hit different. This is the one that makes people stop and pay attention.",
  },
  'type-confirm-compose': {
    icon: <Layers className="w-8 h-8" />,
    title: "Compose — The Power Move",
    lines: [
      { text: "Compose lets you build a rotating playlist of content. Images, videos, whatever you create — it cycles through them on a schedule." },
      { text: "One QR code, unlimited content. It's like having a channel on your shirt.", highlight: true },
      { text: "This one's a bit more advanced, so we'll walk you through setting it up." },
      { text: "But first — you'll need to build some content to put in the rotation." },
    ],
    tip: "Think of it like a TV channel — you're the programmer, and the shirt is the screen.",
  },
  'checkout': {
    icon: <PartyPopper className="w-8 h-8" />,
    title: "You Just Designed a Custom Tee!",
    lines: [
      { text: "Look at that — you picked the shirt, chose your colors, set up your QR code, and built a real product." },
      { text: "Your custom t-shirt is ready to order. One tap and it ships straight to your door.", highlight: true },
      { text: "It's printed just for you. No warehouse, no waiting on stock — made fresh when you order." },
    ],
    tip: "After checkout you'll get a claim code so you can activate your QR when the shirt arrives.",
    buttonText: "Take Me to Checkout",
  },
};

export const GUIDED_STEP_MAP: Record<string, string[]> = {
  'product': ['welcome', 'product'],
  'color': ['color'],
  'type': ['type'],
  'placement-count': ['placement'],
  'generate': ['text'],
};

export function GuidedCard({ data, onContinue }: { data: GuidedCardData; onContinue: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-2 animate-in fade-in duration-500"
      style={{ minHeight: 'calc(60vh - 80px)' }}
      data-testid="guided-chalkboard"
    >
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl border border-sky-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-sky-950/30 to-slate-900" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-6 space-y-5">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-sky-500/20 text-sky-400">
                {data.icon}
              </div>
            </div>

            <h2 className="text-xl font-bold text-white text-center">{data.title}</h2>

            <div className="space-y-3">
              {data.lines.map((line, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed text-center ${
                    line.highlight
                      ? 'text-sky-200 font-medium'
                      : 'text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            {data.tip && (
              <div className="bg-sky-500/10 rounded-lg p-3 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-200/80 leading-relaxed">{data.tip}</p>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={onContinue}
          className="w-full mt-5 bg-sky-600 hover:bg-sky-700 text-white py-6 text-lg font-semibold"
          data-testid="guided-continue"
        >
          {data.buttonText || 'Got It'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export function OwnerCostSummary({ basePrice, sizeCost, placementCost, textCost, total }: {
  basePrice: number; sizeCost: number; placementCost: number; textCost: number; total: number;
}) {
  return (
    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-600 space-y-2">
      <h3 className="text-white font-bold text-sm mb-3">Cost Breakdown</h3>
      <div className="flex justify-between gap-2 text-sm">
        <span className="text-slate-400">Base product</span>
        <span className="text-white">${basePrice.toFixed(2)}</span>
      </div>
      {sizeCost > 0 && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-slate-400">Size upcharge</span>
          <span className="text-white">+${sizeCost.toFixed(2)}</span>
        </div>
      )}
      {placementCost > 0 && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-slate-400">Extra placements</span>
          <span className="text-white">+${placementCost.toFixed(2)}</span>
        </div>
      )}
      {textCost > 0 && (
        <div className="flex justify-between gap-2 text-sm">
          <span className="text-slate-400">Text customization</span>
          <span className="text-white">+${textCost.toFixed(2)}</span>
        </div>
      )}
      <div className="border-t border-slate-600 pt-2 mt-2">
        <div className="flex justify-between gap-2">
          <span className="text-white font-bold">Total</span>
          <span className="text-blue-400 font-bold text-lg">${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

export function MemberConversionPitch({ earnings, onSignUp, onSkip, mockupUrl }: {
  earnings: number; onSignUp: () => void; onSkip: () => void; mockupUrl?: string | null;
}) {
  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-600 space-y-4 overflow-hidden">
      {mockupUrl && (
        <div className="w-full bg-slate-900">
          <img
            src={mockupUrl}
            alt="Your design"
            className="w-full h-36 object-contain"
            data-testid="img-conversion-mockup"
          />
        </div>
      )}
      <div className="px-5 pb-5 space-y-4">
        <div>
          <h3 className="text-white font-bold text-base">Don't lose your work</h3>
          <p className="text-slate-400 text-sm mt-0.5">A free account keeps this design and adds a few things worth having.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-300 text-sm">Your design saved to your account forever</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-300 text-sm">25% off every order you place</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-300 text-sm">Earn 25% when someone else buys your design</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-300 text-sm">Your own QR Gear page to share</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-slate-300 text-sm">Build multi-item QR experiences</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={onSignUp} className="w-full bg-amber-500 text-black font-bold" data-testid="button-become-member">
            Save my design — it's free
          </Button>
          <Button variant="ghost" onClick={onSkip} className="w-full text-slate-400 text-sm" data-testid="button-skip-member">
            Continue to checkout without saving
          </Button>
        </div>
      </div>
    </div>
  );
}
