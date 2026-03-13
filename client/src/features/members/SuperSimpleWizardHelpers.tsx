import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles, ArrowRight, Store, Package, DollarSign,
  QrCode, Type, ImagePlus, Play, TrendingUp, Check,
  Palette, Ruler, Loader2, PartyPopper, Lightbulb,
  Eye, EyeOff
} from "lucide-react";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";
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
      { text: "Upload images, add text, preview your product live.", highlight: true },
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

export const PRE_STEP_BLACKBOARDS: Record<string, string[]> = {
  'channel': ['bb-welcome', 'bb-channels'],
  'product': ['bb-pricing'],
  'color': ['bb-zones'],
  'size': ['bb-earnings'],
  'type': ['bb-qr-intro'],
};

export const POST_STEP_BLACKBOARDS: Record<string, string[]> = {
  'channel': ['bb-channel-congrats'],
  'product-congrats': ['bb-product-congrats'],
  'color': ['bb-color-congrats'],
  'size': ['bb-size-congrats'],
};

export const SUPER_SIMPLE_FINAL_CONFIRM_STEPS = ['qr-basic-confirm', 'qr-plus-confirm', 'canvas-confirm', 'play-save-choice', 'compose-confirm'];

export function WizardSignInGate({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      if (mode === 'sign-up') {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('That email already has an account. Try signing in instead.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      onSuccess();
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google sign in failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-center space-y-4">
      <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-emerald-600/20 flex items-center justify-center">
        <Sparkles className="w-6 h-6 text-emerald-400" />
      </div>
      <h2 className="text-lg font-bold text-white">Your creation is ready!</h2>
      <p className="text-slate-400 text-sm">
        {mode === 'sign-up'
          ? 'Create a free account to publish it. Your work is saved right here — just sign up and it goes live.'
          : 'Sign in to publish your creation. Everything you built is right here waiting.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        {error && <div className="text-red-400 text-sm text-center bg-red-500/10 rounded-md p-2">{error}</div>}

        <div>
          <label className="text-slate-400 text-xs block mb-1">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-md bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            data-testid="input-wizard-email"
          />
        </div>

        <div>
          <label className="text-slate-400 text-xs block mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              className="w-full rounded-md bg-slate-800 border border-slate-600 text-white px-3 py-2 text-sm pr-10 focus:outline-none focus:border-emerald-500"
              placeholder={mode === 'sign-up' ? 'Create a password' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              data-testid="input-wizard-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-2 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          data-testid="button-wizard-auth-submit"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {mode === 'sign-up' ? 'Create Account & Publish' : 'Sign In & Publish'}
        </button>
      </form>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-700" />
        <span className="text-slate-500 text-xs">or</span>
        <div className="flex-1 h-px bg-slate-700" />
      </div>

      <button
        onClick={handleGoogle}
        disabled={isLoading}
        className="w-full rounded-md bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 text-sm disabled:opacity-50"
        data-testid="button-wizard-google-auth"
      >
        Continue with Google
      </button>

      <p className="text-slate-500 text-xs">
        {mode === 'sign-up' ? (
          <>Already have an account?{' '}
            <button className="text-emerald-400 underline" onClick={() => { setMode('sign-in'); setError(''); }} data-testid="button-switch-to-signin">Sign in</button>
          </>
        ) : (
          <>Don't have an account?{' '}
            <button className="text-emerald-400 underline" onClick={() => { setMode('sign-up'); setError(''); }} data-testid="button-switch-to-signup">Create one</button>
          </>
        )}
      </p>

      <button
        onClick={onCancel}
        className="text-slate-500 text-xs underline"
        data-testid="button-wizard-auth-cancel"
      >
        Go back
      </button>
    </div>
  );
}
