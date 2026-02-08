import { useState, useEffect } from "react";
import { 
  Store, Package, DollarSign, Palette, Ruler, QrCode, 
  ChevronDown, ChevronUp, Lightbulb, TrendingUp, Shield,
  Eye, Sparkles, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SimpleWizardStep } from "./wizardTypes";

interface BlackboardContent {
  icon: React.ReactNode;
  title: string;
  lines: { text: string; highlight?: boolean; icon?: React.ReactNode }[];
  tip?: string;
}

const BLACKBOARD_CONTENT: Partial<Record<SimpleWizardStep, BlackboardContent>> = {
  'channel': {
    icon: <Store className="w-6 h-6" />,
    title: "What's a Channel?",
    lines: [
      { text: "A channel is your personal storefront.", icon: <Store className="w-4 h-4" /> },
      { text: "Think of it like a shop within the shop.", icon: <Eye className="w-4 h-4" /> },
      { text: "Each channel groups your products together.", icon: <Package className="w-4 h-4" /> },
      { text: 'Example: "Summer Promo" or "Tech Events"', highlight: true },
    ],
    tip: "You can create multiple channels for different themes or events.",
  },
  'product': {
    icon: <Package className="w-6 h-6" />,
    title: "Transparent Pricing",
    lines: [
      { text: "Every product shows exactly what you'll earn.", icon: <DollarSign className="w-4 h-4" /> },
      { text: "Printify manufactures and ships for us.", icon: <Package className="w-4 h-4" /> },
      { text: "You get 25% of profit on every sale.", highlight: true, icon: <TrendingUp className="w-4 h-4" /> },
      { text: "No hidden fees. No surprises.", icon: <Shield className="w-4 h-4" /> },
    ],
    tip: "Bigger products and premium sizes earn you even more.",
  },
  'product-congrats': {
    icon: <DollarSign className="w-6 h-6" />,
    title: "How Your Earnings Work",
    lines: [
      { text: "Customer pays the retail price.", icon: <DollarSign className="w-4 h-4" /> },
      { text: "Printify's manufacturing cost is deducted.", icon: <Package className="w-4 h-4" /> },
      { text: "You earn 25% of the remaining profit.", highlight: true, icon: <TrendingUp className="w-4 h-4" /> },
      { text: "Earnings grow as you add extras.", icon: <Sparkles className="w-4 h-4" /> },
    ],
    tip: "Text, extra placements, and bigger sizes all boost your earnings.",
  },
  'color': {
    icon: <Palette className="w-6 h-6" />,
    title: "About Colors",
    lines: [
      { text: "Pick the color for your display mockup.", icon: <Palette className="w-4 h-4" /> },
      { text: "This is what shoppers see in the store.", icon: <Eye className="w-4 h-4" /> },
      { text: "Customers choose their own color at checkout.", highlight: true },
      { text: "All colors are the same price.", icon: <DollarSign className="w-4 h-4" /> },
    ],
  },
  'size': {
    icon: <Ruler className="w-6 h-6" />,
    title: "Size & Earnings",
    lines: [
      { text: "Pick a size for your display mockup.", icon: <Ruler className="w-4 h-4" /> },
      { text: "Bigger sizes cost a bit more to make.", icon: <Package className="w-4 h-4" /> },
      { text: "That extra cost means extra earnings for you!", highlight: true, icon: <TrendingUp className="w-4 h-4" /> },
      { text: "Customers pick their own size at checkout.", icon: <Eye className="w-4 h-4" /> },
    ],
    tip: "Watch the +$ bonus on each size button - that's your extra earnings.",
  },
  'type': {
    icon: <QrCode className="w-6 h-6" />,
    title: "Your QR Experience",
    lines: [
      { text: "This is what makes QR Gear special.", icon: <Sparkles className="w-4 h-4" /> },
      { text: "Basic: A simple QR code on the product.", icon: <QrCode className="w-4 h-4" /> },
      { text: "Canvas/Play: A living image or video behind the QR.", highlight: true },
      { text: "Compose: A rotating playlist of content!", icon: <Sparkles className="w-4 h-4" /> },
    ],
    tip: "Start simple with QR Basic, then explore Canvas and Play as you grow.",
  },
};

function hasSeenBlackboards(userId: string): boolean {
  return localStorage.getItem(`bb_seen_${userId}`) === 'true';
}

function markBlackboardsSeen(userId: string): void {
  localStorage.setItem(`bb_seen_${userId}`, 'true');
}

export function BlackboardPanel({ 
  step, 
  userId,
  forceShow = false
}: { 
  step: SimpleWizardStep;
  userId: string;
  forceShow?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (userId) {
      setSeen(hasSeenBlackboards(userId));
    }
  }, [userId]);

  const content = BLACKBOARD_CONTENT[step];
  if (!content) return null;
  if (seen && !forceShow) return null;

  return (
    <div 
      className="mb-4 animate-in fade-in slide-in-from-top-3 duration-500"
      data-testid={`blackboard-${step}`}
    >
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950/40 to-slate-900" />
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        <div className="relative p-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between gap-2 text-left"
            data-testid={`blackboard-toggle-${step}`}
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Lightbulb className="w-4 h-4" />
              </div>
              <span className="text-emerald-300 font-semibold text-sm">{content.title}</span>
            </div>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-emerald-400/60" />
            ) : (
              <ChevronDown className="w-4 h-4 text-emerald-400/60" />
            )}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 animate-in fade-in duration-300">
              {content.lines.map((line, i) => (
                <div 
                  key={i} 
                  className={`flex items-start gap-2.5 ${line.highlight ? 'pl-2 border-l-2 border-emerald-400/40' : ''}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {line.icon && (
                    <span className="text-emerald-400/70 mt-0.5 flex-shrink-0">{line.icon}</span>
                  )}
                  <p className={`text-sm leading-relaxed ${
                    line.highlight 
                      ? 'text-emerald-200 font-medium' 
                      : 'text-slate-300/90'
                  }`}>
                    {line.text}
                  </p>
                </div>
              ))}

              {content.tip && (
                <div className="mt-3 flex items-start gap-2 bg-emerald-500/10 rounded-lg p-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-200/80 leading-relaxed">{content.tip}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DismissBlackboardsButton({ userId }: { userId: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        markBlackboardsSeen(userId);
        window.location.reload();
      }}
      className="text-slate-500 hover:text-slate-300 text-xs"
      data-testid="button-dismiss-blackboards"
    >
      <Eye className="w-3 h-3 mr-1" />
      Hide tips
    </Button>
  );
}

export function ResetBlackboardsButton({ userId }: { userId: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        localStorage.removeItem(`bb_seen_${userId}`);
        window.location.reload();
      }}
      className="text-slate-500 hover:text-slate-300 text-xs"
      data-testid="button-reset-blackboards"
    >
      <Lightbulb className="w-3 h-3 mr-1" />
      Show tips again
    </Button>
  );
}
