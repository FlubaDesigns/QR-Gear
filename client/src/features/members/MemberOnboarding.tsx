import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles, ArrowRight, ArrowLeft, Wand2, GraduationCap,
  UserCircle, Share2, DollarSign, Rocket, Heart,
  Smartphone, ShoppingBag, Package, Coffee, HardHat,
  Megaphone, Users, Globe, Search, MessageSquare,
  Shirt, CupSoda, BaggageClaim, Tag, Loader2,
  Instagram, Facebook, Youtube, Mail, QrCode, Check,
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import { auth } from "@/lib/firebase";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_MEMBER_PROFIT_SHARE, formatProfitSharePercent } from "@shared/constants";

interface OnboardingData {
  useCase: string;
  productInterests: string[];
  fullName: string;
  storeName: string;
  creatorSlug: string;
  country: string;
  socialSurfaces: string[];
  primarySocial: string;
  socialHandle: string;
  attributionSource: string;
  termsAccepted: boolean;
}

interface MemberOnboardingProps {
  onComplete: (data: OnboardingData) => void;
  userId: string;
}

const USE_CASES = [
  { id: "small-business", label: "Small Business Owner", icon: <ShoppingBag className="w-5 h-5" /> },
  { id: "event-planner", label: "Event Planner", icon: <Megaphone className="w-5 h-5" /> },
  { id: "creator", label: "Creator / Influencer", icon: <Sparkles className="w-5 h-5" /> },
  { id: "nonprofit", label: "Nonprofit", icon: <Heart className="w-5 h-5" /> },
  { id: "other", label: "Something Else", icon: <Globe className="w-5 h-5" /> },
];

const PRODUCT_CATEGORY_MAP: Record<string, { label: string; icon: JSX.Element }> = {
  "tee": { label: "T-Shirts", icon: <Shirt className="w-5 h-5" /> },
  "shirt": { label: "T-Shirts", icon: <Shirt className="w-5 h-5" /> },
  "t-shirt": { label: "T-Shirts", icon: <Shirt className="w-5 h-5" /> },
  "hoodie": { label: "Hoodies", icon: <Package className="w-5 h-5" /> },
  "hat": { label: "Hats", icon: <HardHat className="w-5 h-5" /> },
  "cap": { label: "Hats", icon: <HardHat className="w-5 h-5" /> },
  "mug": { label: "Mugs", icon: <CupSoda className="w-5 h-5" /> },
  "bag": { label: "Bags", icon: <BaggageClaim className="w-5 h-5" /> },
  "tote": { label: "Bags", icon: <BaggageClaim className="w-5 h-5" /> },
  "phone": { label: "Phone Cases", icon: <Smartphone className="w-5 h-5" /> },
  "case": { label: "Phone Cases", icon: <Smartphone className="w-5 h-5" /> },
  "poster": { label: "Posters", icon: <Package className="w-5 h-5" /> },
  "sticker": { label: "Stickers", icon: <Tag className="w-5 h-5" /> },
};

function detectProductCategories(products: { title: string }[]): { id: string; label: string; icon: JSX.Element; count: number }[] {
  const found = new Map<string, { label: string; icon: JSX.Element; count: number }>();
  for (const product of products) {
    const titleLower = (product.title || '').toLowerCase();
    let matched = false;
    for (const [keyword, meta] of Object.entries(PRODUCT_CATEGORY_MAP)) {
      if (titleLower.includes(keyword)) {
        const existing = found.get(meta.label);
        if (existing) {
          existing.count++;
        } else {
          found.set(meta.label, { ...meta, count: 1 });
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      const existing = found.get("Other");
      if (existing) {
        existing.count++;
      } else {
        found.set("Other", { label: "Other", icon: <Package className="w-5 h-5" />, count: 1 });
      }
    }
  }
  return Array.from(found.entries()).map(([, val]) => ({
    id: val.label.toLowerCase().replace(/\s+/g, '-'),
    label: val.label,
    icon: val.icon,
    count: val.count,
  }));
}

const SOCIAL_PLATFORMS = [
  { id: "instagram", label: "Instagram", icon: <Instagram className="w-5 h-5" /> },
  { id: "facebook", label: "Facebook", icon: <Facebook className="w-5 h-5" /> },
  { id: "tiktok", label: "TikTok", icon: <SiTiktok className="w-5 h-5" /> },
  { id: "x", label: "X", icon: <MessageSquare className="w-5 h-5" /> },
  { id: "youtube", label: "YouTube", icon: <Youtube className="w-5 h-5" /> },
  { id: "email-text", label: "Email / Text", icon: <Mail className="w-5 h-5" /> },
  { id: "qr-print", label: "QR Code (in-person)", icon: <QrCode className="w-5 h-5" /> },
];

const ATTRIBUTION_OPTIONS = [
  "Social media",
  "Friend or referral",
  "Search engine",
  "Event or conference",
  "Other",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30);
}

export function MemberOnboarding({ onComplete, userId }: MemberOnboardingProps) {
  const { data: pricingSettings } = useQuery<{ memberProfitShare?: number; baseRetailPrice?: number }>({
    queryKey: ['/api/pricing-settings'],
  });
  const { data: allowedProductsData } = useQuery<{ products: { title: string }[] }>({
    queryKey: ['/api/members/allowed-products'],
  });
  const dynamicCategories = detectProductCategories(allowedProductsData?.products || []);
  const profitShare = pricingSettings?.memberProfitShare ?? DEFAULT_MEMBER_PROFIT_SHARE;
  const exampleRetailPrice = pricingSettings?.baseRetailPrice ?? 29.99;
  const shareLabel = formatProfitSharePercent(profitShare);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    useCase: "",
    productInterests: [],
    fullName: "",
    storeName: "",
    creatorSlug: "",
    country: "",
    socialSurfaces: [],
    primarySocial: "",
    socialHandle: "",
    attributionSource: "",
    termsAccepted: false,
  });

  const totalSteps = 11;
  const progress = ((step + 1) / totalSteps) * 100;

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true;
      case 1: return true;
      case 2: return !!data.useCase;
      case 3: return data.productInterests.length > 0;
      case 4:
        return data.fullName.length >= 2 && data.storeName.length >= 2 && data.creatorSlug.length >= 3 && !!data.country;
      case 5: return data.socialSurfaces.length === 0 || data.socialHandle.length >= 2;
      case 6: return true;
      case 7: return data.termsAccepted;
      case 8: return true;
      case 9: return true;
      case 10: return true;
      default: return true;
    }
  };

  const saveProfileToServer = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/members/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data),
      });
    } catch (e) {
      console.error('Failed to save member profile:', e);
    }
  };

  const handleNext = async () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      setSaving(true);
      await saveProfileToServer();
      setSaving(false);
      onComplete(data);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleProductInterest = (id: string) => {
    setData(prev => ({
      ...prev,
      productInterests: prev.productInterests.includes(id)
        ? prev.productInterests.filter(p => p !== id)
        : [...prev.productInterests, id],
    }));
  };

  const toggleSocial = (id: string) => {
    setData(prev => ({
      ...prev,
      socialSurfaces: prev.socialSurfaces.includes(id)
        ? prev.socialSurfaces.filter(s => s !== id)
        : [...prev.socialSurfaces, id],
    }));
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-onboarding-title">Welcome to your Creator Workspace</h2>
            <div className="max-w-md mx-auto space-y-3 text-left">
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-300">This is where you create products and publish them for sharing.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-300">You share your products on social media and anywhere you can post a link.</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <p className="text-slate-300">When people buy, checkout and fulfillment are handled through our platform.</p>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-learning-contract">We'll walk you through it — on purpose</h2>
            <div className="max-w-md mx-auto space-y-4 text-left">
              <p className="text-slate-300">We start slow for your first item so you can learn the system without stress.</p>
              <div className="space-y-2">
                <p className="text-slate-300">Each item you create builds skill and speed:</p>
                <ul className="space-y-1 ml-4">
                  <li className="text-emerald-400 flex items-center gap-2"><ArrowRight className="w-3 h-3" /> Fewer prompts</li>
                  <li className="text-emerald-400 flex items-center gap-2"><ArrowRight className="w-3 h-3" /> Fewer explanations</li>
                  <li className="text-emerald-400 flex items-center gap-2"><ArrowRight className="w-3 h-3" /> More control</li>
                </ul>
              </div>
              <div className="p-3 bg-blue-900/30 rounded-lg border border-blue-500/30">
                <p className="text-blue-200 text-sm">This first pass is the <span className="font-semibold text-white">Super Simple</span> version. It runs once. After that, it gets faster, quieter, and easier — because by then you won't need the hand-holding.</p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-violet-600 rounded-full flex items-center justify-center">
              <Users className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">What best describes you?</h2>
            <p className="text-slate-400">This helps us tailor your experience.</p>
            <div className="max-w-md mx-auto grid grid-cols-1 gap-3">
              {USE_CASES.map(uc => (
                <button
                  key={uc.id}
                  onClick={() => setData(prev => ({ ...prev, useCase: uc.id }))}
                  className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    data.useCase === uc.id
                      ? "border-emerald-500 bg-emerald-900/30"
                      : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                  }`}
                  data-testid={`usecase-${uc.id}`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    data.useCase === uc.id ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600/50 text-slate-400"
                  }`}>
                    {uc.icon}
                  </div>
                  <span className={data.useCase === uc.id ? "text-white font-medium" : "text-slate-300"}>{uc.label}</span>
                  {data.useCase === uc.id && <Check className="w-5 h-5 text-emerald-400 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center">
              <Package className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">What products interest you?</h2>
            <p className="text-slate-400">
              {dynamicCategories.length > 0
                ? "Pick as many as you like. You can always change this later."
                : "Loading available products..."}
            </p>
            {dynamicCategories.length > 0 && (
              <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
                {dynamicCategories.map(cat => {
                  const selected = data.productInterests.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleProductInterest(cat.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                        selected
                          ? "border-amber-500 bg-amber-900/30"
                          : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                      }`}
                      data-testid={`product-interest-${cat.id}`}
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        selected ? "bg-amber-500/20 text-amber-400" : "bg-slate-600/50 text-slate-400"
                      }`}>
                        {cat.icon}
                      </div>
                      <span className={`text-sm ${selected ? "text-white font-medium" : "text-slate-300"}`}>{cat.label}</span>
                      <span className="text-xs text-slate-500">{cat.count} {cat.count === 1 ? 'style' : 'styles'}</span>
                      {selected && <Check className="w-4 h-4 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            )}
            {dynamicCategories.length === 0 && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-cyan-500 to-teal-600 rounded-full flex items-center justify-center">
              <UserCircle className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Creator Identity</h2>
            <p className="text-slate-400">This is how you'll appear to customers.</p>
            <div className="max-w-md mx-auto space-y-4 text-left">
              <div className="space-y-2">
                <Label className="text-slate-300">Full Name <span className="text-red-400">*</span></Label>
                <Input
                  value={data.fullName}
                  onChange={e => setData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Your real name"
                  className="bg-slate-700/50 border-slate-600 text-white"
                  data-testid="input-full-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Store Name <span className="text-red-400">*</span></Label>
                <Input
                  value={data.storeName}
                  onChange={e => {
                    const name = e.target.value;
                    setData(prev => ({
                      ...prev,
                      storeName: name,
                      creatorSlug: slugify(name),
                    }));
                  }}
                  placeholder="What customers will see"
                  className="bg-slate-700/50 border-slate-600 text-white"
                  data-testid="input-store-name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Creator Handle <span className="text-red-400">*</span></Label>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-sm">qrgear.com/</span>
                  <Input
                    value={data.creatorSlug}
                    onChange={e => setData(prev => ({ ...prev, creatorSlug: slugify(e.target.value) }))}
                    placeholder="your-handle"
                    className="bg-slate-700/50 border-slate-600 text-white"
                    data-testid="input-creator-slug"
                  />
                </div>
                <p className="text-xs text-slate-500">Lowercase letters, numbers, and dashes only</p>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Country <span className="text-red-400">*</span></Label>
                <select
                  value={data.country}
                  onChange={e => setData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full rounded-md bg-slate-700/50 border border-slate-600 text-white px-3 py-2 text-sm"
                  data-testid="select-country"
                >
                  <option value="">Select country</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="AU">Australia</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pink-500 to-rose-600 rounded-full flex items-center justify-center">
              <Share2 className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Where will you share your links?</h2>
            <p className="text-slate-400">Pick the platforms you'll use to promote your products. Optional but recommended.</p>
            <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
              {SOCIAL_PLATFORMS.map(sp => {
                const selected = data.socialSurfaces.includes(sp.id);
                return (
                  <button
                    key={sp.id}
                    onClick={() => toggleSocial(sp.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                      selected
                        ? "border-pink-500 bg-pink-900/30"
                        : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                    }`}
                    data-testid={`social-${sp.id}`}
                  >
                    <div className={selected ? "text-pink-400" : "text-slate-400"}>{sp.icon}</div>
                    <span className={`text-sm ${selected ? "text-white font-medium" : "text-slate-300"}`}>{sp.label}</span>
                  </button>
                );
              })}
            </div>
            {data.socialSurfaces.length > 0 && (
              <div className="max-w-md mx-auto space-y-4 text-left">
                <div className="space-y-2">
                  <Label className="text-slate-300">Primary platform</Label>
                  <select
                    value={data.primarySocial}
                    onChange={e => setData(prev => ({ ...prev, primarySocial: e.target.value }))}
                    className="w-full rounded-md bg-slate-700/50 border border-slate-600 text-white px-3 py-2 text-sm"
                    data-testid="select-primary-social"
                  >
                    <option value="">Select primary</option>
                    {data.socialSurfaces.map(id => {
                      const platform = SOCIAL_PLATFORMS.find(p => p.id === id);
                      return <option key={id} value={id}>{platform?.label || id}</option>;
                    })}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Your @ handle</Label>
                  <Input
                    value={data.socialHandle}
                    onChange={e => setData(prev => ({ ...prev, socialHandle: e.target.value }))}
                    placeholder="@yourhandle"
                    className="bg-slate-700/50 border-slate-600 text-white"
                    data-testid="input-social-handle"
                  />
                  <p className="text-xs text-slate-500">Used in Share Kit assets ("follow me @handle")</p>
                </div>
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold text-white">Here's What You're Building</h2>
            <p className="text-slate-400">Real products with real QR codes that link to real experiences.</p>
            <div className="max-w-sm mx-auto relative py-8">
              <div className="flex items-end justify-center gap-8">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-28 rounded-xl border-2 border-slate-500 bg-slate-700/50 flex items-center justify-center relative">
                    <Smartphone className="w-8 h-8 text-slate-400" />
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-slate-500 rounded-full" />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Scan QR</p>
                </div>

                <div className="flex flex-col items-center gap-1 mb-8">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-1 h-1 rounded-full bg-emerald-400/60" />
                    ))}
                  </div>
                  <ArrowRight className="w-6 h-6 text-emerald-400" />
                </div>

                <div className="flex flex-col items-center">
                  <div className="w-32 h-44 rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-slate-800 to-slate-700 flex flex-col items-center justify-center p-3 relative">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-slate-500 rounded-full" />
                    <QrCode className="w-10 h-10 text-emerald-400 mb-2" />
                    <div className="w-full h-2 bg-emerald-500/30 rounded mb-1" />
                    <div className="w-3/4 h-2 bg-emerald-500/20 rounded mb-1" />
                    <div className="w-1/2 h-2 bg-emerald-500/10 rounded" />
                    <Badge variant="secondary" className="mt-2 text-xs">Live Experience</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Your product</p>
                </div>
              </div>
            </div>
            <div className={`max-w-md mx-auto grid gap-3 ${dynamicCategories.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {dynamicCategories.length > 0 ? dynamicCategories.map(cat => (
                <div key={cat.id} className="p-3 bg-white/5 rounded-lg text-center">
                  <div className="w-6 h-6 text-blue-400 mx-auto mb-1">{cat.icon}</div>
                  <p className="text-xs text-slate-400">{cat.label}</p>
                </div>
              )) : (
                <div className="p-3 bg-white/5 rounded-lg text-center col-span-3">
                  <Loader2 className="w-6 h-6 text-slate-400 mx-auto mb-1 animate-spin" />
                  <p className="text-xs text-slate-400">Loading...</p>
                </div>
              )}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <DollarSign className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">How you get paid (later)</h2>
            <div className="max-w-md mx-auto space-y-4 text-left">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-slate-300">When products you create sell through our platform, you earn <span className="text-emerald-400 font-bold">at least {shareLabel}</span> of the profit.</p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-slate-300">Once you make a sale, we'll verify your email and ask where to send your payment. Simple as that.</p>
              </div>
              <div className="flex items-center gap-3 p-4 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                <Checkbox
                  id="terms"
                  checked={data.termsAccepted}
                  onCheckedChange={(checked) => setData(prev => ({ ...prev, termsAccepted: !!checked }))}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm text-white cursor-pointer">
                  I understand and agree
                </label>
              </div>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-blue-600 rounded-full flex items-center justify-center">
              <Search className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">How'd you find us?</h2>
            <p className="text-slate-400">Just curious — helps us know what's working.</p>
            <div className="max-w-md mx-auto grid grid-cols-1 gap-3">
              {ATTRIBUTION_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setData(prev => ({ ...prev, attributionSource: opt }))}
                  className={`flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    data.attributionSource === opt
                      ? "border-indigo-500 bg-indigo-900/30"
                      : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                  }`}
                  data-testid={`attribution-${opt.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className={data.attributionSource === opt ? "text-white font-medium" : "text-slate-300"}>{opt}</span>
                  {data.attributionSource === opt && <Check className="w-5 h-5 text-indigo-400 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        );

      case 9:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full flex items-center justify-center">
              <Tag className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white" data-testid="text-member-perk-title">Creator Perk: {shareLabel} Off Your Own Creations</h2>
            <div className="max-w-md mx-auto space-y-4">
              <div className="p-5 bg-gradient-to-br from-amber-900/30 to-yellow-900/20 rounded-xl border border-amber-500/30">
                <p className="text-lg text-white font-medium mb-2">Get your own creations at {shareLabel} off — order a sample, build personal inventory, or just get one for yourself.</p>
                <p className="text-slate-300 text-sm">This creator discount mirrors your profit share. One constant, zero confusion.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <p className="text-2xl font-bold text-amber-400" data-testid="text-example-retail">${exampleRetailPrice.toFixed(2)}</p>
                  <p className="text-xs text-slate-500 line-through">Retail price</p>
                </div>
                <div className="p-4 bg-emerald-900/20 rounded-lg text-center border border-emerald-500/30">
                  <p className="text-2xl font-bold text-emerald-400" data-testid="text-example-member">${(exampleRetailPrice * (1 - profitShare)).toFixed(2)}</p>
                  <p className="text-xs text-emerald-300">Your price</p>
                </div>
              </div>
              <p className="text-sm text-slate-400">Same percentage you earn on sales. Win-win by design.</p>
            </div>
          </div>
        );

      case 10:
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center">
              <Rocket className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Let's create your first item</h2>
            <div className="max-w-md mx-auto space-y-4">
              <p className="text-slate-300">We'll guide you through the <span className="text-emerald-400 font-semibold">Super Simple</span> version once.</p>
              <p className="text-slate-300">After that, you'll move faster with fewer prompts.</p>
              <div className="p-4 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                <p className="text-emerald-200 text-sm">Takes about 2 minutes. No art degree required.</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const stepLabels = [
    "Welcome", "How It Works", "About You", "Products",
    "Identity", "Sharing", "Inspiration", "Earnings",
    "Attribution", "Member Perk", "Launch",
  ];

  const ctaLabels: Record<number, string> = {
    10: "Start Super Simple",
  };

  return (
    <div className="max-w-2xl mx-auto px-4">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500">{stepLabels[step]}</p>
          <p className="text-xs text-slate-500">{step + 1} of {totalSteps}</p>
        </div>
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 md:p-8">
          {renderStep()}

          <div className="flex items-center justify-between mt-8 gap-4">
            {step > 0 ? (
              <Button
                variant="ghost"
                onClick={handleBack}
                className="text-slate-400 hover:text-white"
                data-testid="button-onboarding-back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}

            <Button
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6"
              data-testid="button-onboarding-next"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Setting up...</>
              ) : (
                <>
                  {ctaLabels[step] || "Continue"}
                  {step === 10 ? <Wand2 className="w-4 h-4 ml-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
