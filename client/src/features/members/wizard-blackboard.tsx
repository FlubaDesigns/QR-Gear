import { Button } from "@/components/ui/button";
import {
  Sparkles, ArrowRight, Store, DollarSign,
  QrCode, Type, ImagePlus, Play,
  Check, Palette, Ruler, Lightbulb, PartyPopper
} from "lucide-react";
import type { QRType } from "@/features/shared/components/wizardSteps/wizardTypes";

export interface BlackboardData {
  icon: React.ReactNode;
  title: string;
  lines: { text: string; highlight?: boolean }[];
  tip?: string;
  buttonText?: string;
}

export const BLACKBOARD_CONTENT: Record<string, BlackboardData> = {
  'bb-welcome': {
    icon: <Sparkles className="w-8 h-8" />,
    title: "Hey, You Made It!",
    lines: [
      { text: "You're about to build your first product." },
      { text: "It takes about 2 minutes. No art degree required.", highlight: true },
      { text: "We'll walk you through every single step." },
      { text: "Ready? Let's do this." },
    ],
    tip: "Seriously, this is going to be fun. We promise.",
    buttonText: "Let's Go!",
  },
  'bb-channels': {
    icon: <Store className="w-8 h-8" />,
    title: "First Up: Channels",
    lines: [
      { text: "A channel is your personal storefront — like having your own little shop inside QR Gear." },
      { text: "You can create channels for different themes, events, or brands.", highlight: true },
      { text: "All of your products live inside a channel. Customers browse your channel to see what you've made." },
      { text: "Think: \"Summer Promo,\" \"Tech Events,\" or just \"My Cool Stuff.\"" },
    ],
    tip: "You can have as many channels as you want. Start with one — you can always add more later.",
  },
  'bb-pricing': {
    icon: <DollarSign className="w-8 h-8" />,
    title: "Let's Talk Earnings",
    lines: [
      { text: "On the next page, you'll pick a product. Each one shows an earnings amount — that's your starting number." },
      { text: "That number only goes up from here.", highlight: true },
      { text: "1. Pick a bigger size — your earnings go up." },
      { text: "2. Add text or graphics — your earnings go up." },
      { text: "3. Choose a premium QR type — your earnings go up." },
      { text: "We handle manufacturing and shipping. You just design and collect." },
    ],
    tip: "Think of the product price as your starting line. Every customization is a bonus.",
  },
  'bb-zones': {
    icon: <Palette className="w-8 h-8" />,
    title: "Colors & Your Mockup",
    lines: [
      { text: "Pick a color for your product mockup." },
      { text: "This is what shoppers see when browsing your store." },
      { text: "Don't overthink it — customers pick their own color at checkout.", highlight: true },
      { text: "All colors, same price. No gotchas." },
    ],
  },
  'bb-earnings': {
    icon: <Ruler className="w-8 h-8" />,
    title: "Size Matters (For Your Wallet)",
    lines: [
      { text: "Bigger sizes cost a tiny bit more to make." },
      { text: "That extra cost gets passed to the customer." },
      { text: "Which means... bigger sizes = bigger earnings for you.", highlight: true },
      { text: "Pick any size for your mockup. Customers choose theirs at checkout." },
    ],
    tip: "Watch the +$ bonus on each size button — that's your extra earnings.",
  },
  'bb-qr-intro': {
    icon: <QrCode className="w-8 h-8" />,
    title: "The Secret Sauce",
    lines: [
      { text: "This is what makes QR Gear different from everything else." },
      { text: "There are four QR types, and each one adds more to the experience." },
      { text: "We're going to walk through each one so you can pick the right fit.", highlight: true },
      { text: "You can off-ramp at any point — or keep going to see what's next." },
    ],
    tip: "No pressure. You can always upgrade your QR type later.",
  },
  'bb-whats-next': {
    icon: <Lightbulb className="w-8 h-8" />,
    title: "Almost There!",
    lines: [
      { text: "After this tutorial, you'll jump into the real builder." },
      { text: "The builder lets you customize everything in detail." },
      { text: "Upload images, add text or images, preview your product live.", highlight: true },
      { text: "Don't worry — you can always edit before publishing." },
    ],
    tip: "Think of this tutorial as your warm-up lap. The race starts next.",
  },
  'bb-finish': {
    icon: <PartyPopper className="w-8 h-8" />,
    title: "You Did It!",
    lines: [
      { text: "You just completed the guided walkthrough." },
      { text: "From here on out, things get faster and quieter.", highlight: true },
      { text: "You're all set! Create another product anytime." },
      { text: "The training wheels are coming off. You've got this." },
    ],
    tip: "After your first publish, Advanced and Studio modes unlock too.",
    buttonText: "Start",
  },
};

export function BlackboardCard({
  data,
  onContinue,
}: {
  data: BlackboardData;
  onContinue: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center px-2 animate-in fade-in duration-500"
      style={{ minHeight: 'calc(70vh - 80px)' }}
      data-testid="tutorial-blackboard"
    >
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-6 space-y-5">
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-400">
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
                      ? 'text-emerald-200 font-medium'
                      : 'text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            {data.tip && (
              <div className="bg-emerald-500/10 rounded-lg p-3 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-200/80 leading-relaxed">{data.tip}</p>
              </div>
            )}
          </div>
        </div>

        <Button
          onClick={onContinue}
          className="w-full mt-5 bg-emerald-600 text-white py-6 text-lg font-semibold"
          data-testid="tutorial-continue"
        >
          {data.buttonText || 'Continue'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}

export const QR_TYPE_CARDS: Record<string, {
  type: QRType;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  lines: { text: string; highlight?: boolean }[];
  tip: string;
  nextStep: string;
}> = {
  'bb-qr-basic': {
    type: 'qr-basic',
    icon: <QrCode className="w-8 h-8" />,
    iconBg: 'bg-slate-600',
    title: "QR Basic",
    lines: [
      { text: "The simplest option. A clean QR code that links anywhere you want." },
      { text: "No internet connection needed to scan — the destination is baked right into the code." },
      { text: "Perfect for linking to a website, menu, social profile, or contact info.", highlight: true },
      { text: "It's free of platform fees and works forever. Simple, reliable, done." },
    ],
    tip: "Great for getting started. You can always upgrade to a fancier type later.",
    nextStep: 'bb-qr-plus',
  },
  'bb-qr-plus': {
    type: 'qr-plus',
    icon: <Type className="w-8 h-8" />,
    iconBg: 'bg-blue-600',
    title: "QR Plus",
    lines: [
      { text: "Everything in Basic, plus custom header and footer text printed right on the product." },
      { text: "Like QR Basic, the content is baked right into the code — no server needed.", highlight: true },
      { text: "Add a tagline above, a call-to-action below. Make your merchandise say something." },
      { text: "People see your message before they even scan. That's powerful." },
    ],
    tip: "This is the sweet spot for most creators. Professional look, easy setup.",
    nextStep: 'bb-qr-canvas',
  },
  'bb-qr-canvas': {
    type: 'qr-canvas',
    icon: <ImagePlus className="w-8 h-8" />,
    iconBg: 'bg-purple-600',
    title: "QR Canvas",
    lines: [
      { text: "Now we're cooking. When someone scans, they see a full-screen image moment." },
      { text: "Upload a photo, design, or artwork — it becomes the landing experience.", highlight: true },
      { text: "Think product launches, event flyers, portfolio pieces, or promotional images." },
      { text: "Your QR code becomes a window into something visual and memorable." },
    ],
    tip: "Canvas moments are great for visual storytelling. Show, don't just link.",
    nextStep: 'bb-qr-play',
  },
  'bb-qr-play': {
    type: 'qr-play',
    icon: <Play className="w-8 h-8" />,
    iconBg: 'bg-rose-600',
    title: "QR Play",
    lines: [
      { text: "The showstopper. When someone scans, they watch a video." },
      { text: "Upload your own video or link one — it plays right on the landing page.", highlight: true },
      { text: "Perfect for tutorials, behind-the-scenes, music videos, product demos, or personal messages." },
      { text: "Imagine handing someone a t-shirt that plays a video. That's QR Play." },
    ],
    tip: "Video gets 10x more engagement than static content. Just saying.",
    nextStep: 'bb-qr-congrats',
  },
};

export function QRTypeBlackboard({
  step,
  onChoose,
  onContinue,
}: {
  step: string;
  onChoose: (type: QRType) => void;
  onContinue: () => void;
}) {
  const card = QR_TYPE_CARDS[step];
  if (!card) return null;
  const isLast = step === 'bb-qr-play';

  return (
    <div
      className="flex flex-col items-center justify-center px-2 animate-in fade-in duration-500"
      style={{ minHeight: 'calc(70vh - 80px)' }}
      data-testid={`tutorial-qr-${card.type}`}
    >
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900" />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative p-6 space-y-5">
            <div className="flex justify-center">
              <div className={`p-3 rounded-full ${card.iconBg} text-white`}>
                {card.icon}
              </div>
            </div>

            <h2 className="text-xl font-bold text-white text-center">{card.title}</h2>

            <div className="space-y-3">
              {card.lines.map((line, i) => (
                <p
                  key={i}
                  className={`text-sm leading-relaxed text-center ${
                    line.highlight
                      ? 'text-emerald-200 font-medium'
                      : 'text-slate-300'
                  }`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            <div className="bg-emerald-500/10 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-200/80 leading-relaxed">{card.tip}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <Button
            onClick={() => onChoose(card.type)}
            className="w-full bg-emerald-600 text-white py-6 text-lg font-semibold"
            data-testid={`tutorial-choose-${card.type}`}
          >
            <Check className="w-5 h-5 mr-2" />
            Choose {card.title}
          </Button>
          {!isLast && (
            <Button
              onClick={onContinue}
              variant="outline"
              className="w-full py-5 text-base text-slate-300 border-slate-600"
              data-testid={`tutorial-show-more-${card.type}`}
            >
              Show Me More
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
