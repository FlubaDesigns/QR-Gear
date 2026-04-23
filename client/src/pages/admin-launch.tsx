import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SEO from "@/components/SEO";
import AdminShell from "@/components/AdminShell";
import {
  Rocket,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Mail,
  Package,
  Globe,
  Brain,
  Shield,
  Info,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SetupItem {
  id: string;
  label: string;
  description: string;
  status: "ok" | "missing" | "warning" | "partial";
  action?: string;
  href: string;
  group: string;
}

interface SetupResponse {
  items: SetupItem[];
  missing: number;
  warnings: number;
  generatedAt: string;
}

// ─── Static advisory items (code-level risks not in env checklist) ────────────

interface Advisory {
  id: string;
  label: string;
  severity: "blocker" | "risk" | "info";
  description: string;
  action: string;
  href: string;
  group: string;
}

const ADVISORIES: Advisory[] = [
  {
    id: "printify-fulfillment-manual",
    label: "Printify order submission is semi-manual",
    severity: "risk",
    description: "After a customer pays, orders must be manually submitted to Printify on some paths. Verify the Stripe webhook auto-submits before your first real order.",
    action: "Test a real checkout end-to-end in Stripe test mode. Confirm the order appears in Printify automatically.",
    href: "/admin/orders",
    group: "Fulfillment",
  },
  {
    id: "no-stock-check",
    label: "No inventory check at add-to-cart",
    severity: "risk",
    description: "Stock validation happens at Printify submission, not at checkout. If a blank goes out of stock, you'll receive the payment and then have to cancel and refund manually.",
    action: "Monitor Printify stock levels before launching. Have a refund process ready.",
    href: "/admin/orders",
    group: "Fulfillment",
  },
  {
    id: "admin-bypass-flag",
    label: "ADMIN_BYPASS flag must be false in production",
    severity: "blocker",
    description: "The ADMIN_BYPASS environment variable bypasses all admin authentication if set to 'true'. Confirm it is not set in your Firebase Functions config.",
    action: "Run: firebase functions:config:get | grep bypass — it should return nothing.",
    href: "/admin/settings",
    group: "Platform",
  },
  {
    id: "client-hardcoded-admin-uids",
    label: "Admin UIDs hardcoded in client code",
    severity: "risk",
    description: "useAuth.ts contains a hardcoded ADMIN_UIDS array on the frontend. Anyone who knows a UID from this list sees the admin UI. Backend auth is still enforced.",
    action: "Remove the hardcoded UIDs from useAuth.ts and rely solely on the backend ADMIN_USER_IDS env check.",
    href: "/admin/settings",
    group: "Platform",
  },
  {
    id: "stripe-webhook-registered",
    label: "Stripe webhook endpoint must be registered",
    severity: "blocker",
    description: "The STRIPE_WEBHOOK_SECRET alone isn't enough — you must also register the endpoint URL in the Stripe dashboard. Without this, order confirmations and payouts won't trigger.",
    action: "In Stripe Dashboard → Developers → Webhooks, add: https://us-central1-qrgear-c1ffd.cloudfunctions.net/api/webhooks/stripe — events: checkout.session.completed, account.updated",
    href: "/admin/settings",
    group: "Payments",
  },
  {
    id: "functions-deployed",
    label: "Firebase Functions must be deployed",
    severity: "blocker",
    description: "The backend (payments, emails, fulfillment, QR dynamics) runs on Firebase Functions. If functions haven't been deployed, nothing works except the static frontend.",
    action: "Run: firebase deploy --only functions --project qrgear-c1ffd from your local machine.",
    href: "/admin/health",
    group: "Platform",
  },
];

// ─── Config ──────────────────────────────────────────────────────────────────

const GROUP_ICONS: Record<string, React.ElementType> = {
  payments: CreditCard,
  Payments: CreditCard,
  email: Mail,
  Email: Mail,
  fulfillment: Package,
  Fulfillment: Package,
  marketplaces: Globe,
  Marketplaces: Globe,
  ai: Brain,
  "AI Brain": Brain,
  platform: Shield,
  Platform: Shield,
};

const STATUS_CONFIG = {
  ok:      { icon: CheckCircle,  color: "text-green-500",  bg: "bg-green-500/10 border-green-500/20",  label: "Connected" },
  missing: { icon: XCircle,      color: "text-red-500",    bg: "bg-red-500/10 border-red-500/20",      label: "Missing" },
  warning: { icon: AlertTriangle,color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20",  label: "Warning" },
  partial: { icon: AlertCircle,  color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20",  label: "Partial" },
};

const SEVERITY_CONFIG = {
  blocker: { icon: XCircle,       color: "text-red-500",   bg: "bg-red-500/10 border-red-500/20",    label: "Blocker" },
  risk:    { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20",label: "Risk" },
  info:    { icon: Info,          color: "text-blue-500",  bg: "bg-blue-500/10 border-blue-500/20",  label: "Info" },
};

// ─── Components ───────────────────────────────────────────────────────────────

function ExpandableItem({
  icon: Icon,
  iconColor,
  title,
  badge,
  badgeBg,
  description,
  action,
  href,
  group,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  badge: string;
  badgeBg: string;
  description: string;
  action?: string;
  href: string;
  group: string;
}) {
  const [open, setOpen] = useState(false);
  const GroupIcon = GROUP_ICONS[group] ?? Shield;

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden" data-testid={`launch-item-${title.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}`}>
      <button
        className="w-full flex items-start gap-3 p-3 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${iconColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium leading-snug">{title}</span>
            <span className="text-xs text-muted-foreground/60 flex items-center gap-1">
              <GroupIcon className="w-3 h-3" /> {group}
            </span>
          </div>
          {!open && action && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{action}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant="outline" className={`text-xs px-1.5 py-0 h-5 ${badgeBg}`}>
            {badge}
          </Badge>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border bg-muted/30">
          <p className="text-sm text-muted-foreground leading-relaxed pt-3">{description}</p>
          {action && (
            <div className="rounded-md bg-background border border-border p-2.5">
              <p className="text-xs font-medium text-foreground mb-1">Fix</p>
              <p className="text-xs text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap break-all">{action}</p>
            </div>
          )}
          <Link href={href}>
            <Button variant="outline" size="sm" className="gap-1.5 mt-1">
              Go to {group} <ExternalLink className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">{count}</Badge>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLaunchPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<SetupResponse>({
    queryKey: ["/api/admin/dashboard/setup"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/dashboard/setup");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });

  const envItems = data?.items ?? [];

  // Combine env items + advisory items into a unified list
  const envBlockers = envItems.filter(i => i.status === "missing" && ["payments", "email"].includes(i.group));
  const envRisks = envItems.filter(i => (i.status === "warning" || i.status === "partial") || (i.status === "missing" && !["payments", "email"].includes(i.group)));
  const envOk = envItems.filter(i => i.status === "ok");

  const advisoryBlockers = ADVISORIES.filter(a => a.severity === "blocker");
  const advisoryRisks = ADVISORIES.filter(a => a.severity === "risk");

  const totalBlockers = envBlockers.length + advisoryBlockers.length;
  const totalRisks = envRisks.length + advisoryRisks.length;
  const isReady = !isLoading && totalBlockers === 0;
  const isLive = isReady && totalRisks === 0;

  const statusLabel = isLoading
    ? "Checking..."
    : totalBlockers > 0
    ? `${totalBlockers} blocker${totalBlockers === 1 ? "" : "s"} — not ready`
    : totalRisks > 0
    ? "Blockers clear — review risks"
    : "Go for launch";

  const statusColor = isLoading
    ? "text-muted-foreground"
    : totalBlockers > 0
    ? "text-red-500"
    : totalRisks > 0
    ? "text-amber-500"
    : "text-green-500";

  const statusBg = isLoading
    ? "bg-muted/50"
    : totalBlockers > 0
    ? "bg-red-500/10 border-red-500/30"
    : totalRisks > 0
    ? "bg-amber-500/10 border-amber-500/30"
    : "bg-green-500/10 border-green-500/30";

  const StatusIcon = isLoading ? Loader2 : totalBlockers > 0 ? XCircle : totalRisks > 0 ? AlertTriangle : CheckCircle;

  return (
    <AdminShell
      title="Pre-Launch Checklist"
      subtitle="Everything that must be in place before accepting real orders"
      icon={Rocket}
      backHref="/admin"
      actions={
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-white hover:bg-white/10"
          data-testid="button-refresh-launch"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      }
    >
      <SEO title="Pre-Launch Checklist | QR Gear Admin" description="Production readiness checklist for QR Gear." />

      <div className="space-y-6">

        {/* Overall status */}
        <Card className={`border ${statusBg}`} data-testid="card-launch-status">
          <CardContent className="p-4 flex items-center gap-3">
            <StatusIcon className={`w-7 h-7 flex-shrink-0 ${statusColor} ${isLoading ? "animate-spin" : ""}`} />
            <div className="flex-1 min-w-0">
              <p className={`text-base font-bold ${statusColor}`} data-testid="text-launch-status">
                {statusLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLoading
                  ? "Checking environment configuration…"
                  : isLive
                  ? "All systems connected. Add products and go live."
                  : totalBlockers > 0
                  ? "Resolve the hard blockers below before taking a real payment."
                  : "No hard blockers. Review the risk items before going live."}
              </p>
            </div>
            {!isLoading && (
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-xs text-muted-foreground">{envOk.length} / {envItems.length} env vars</span>
                <span className="text-xs text-muted-foreground">connected</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hard blockers */}
        {(envBlockers.length > 0 || advisoryBlockers.length > 0) && (
          <Section title="Hard Blockers — Fix Before Any Real Payment" count={totalBlockers}>
            {envBlockers.map(item => {
              const cfg = STATUS_CONFIG[item.status];
              return (
                <ExpandableItem
                  key={item.id}
                  icon={cfg.icon}
                  iconColor={cfg.color}
                  title={item.label}
                  badge={cfg.label}
                  badgeBg={cfg.bg}
                  description={item.description}
                  action={item.action}
                  href={item.href}
                  group={item.group.charAt(0).toUpperCase() + item.group.slice(1)}
                />
              );
            })}
            {advisoryBlockers.map(item => {
              const cfg = SEVERITY_CONFIG[item.severity];
              return (
                <ExpandableItem
                  key={item.id}
                  icon={cfg.icon}
                  iconColor={cfg.color}
                  title={item.label}
                  badge={cfg.label}
                  badgeBg={cfg.bg}
                  description={item.description}
                  action={item.action}
                  href={item.href}
                  group={item.group}
                />
              );
            })}
          </Section>
        )}

        {/* Risk items */}
        {(envRisks.length > 0 || advisoryRisks.length > 0) && (
          <Section title="Risk Items — Should Address Before Launch" count={totalRisks}>
            {envRisks.map(item => {
              const cfg = STATUS_CONFIG[item.status];
              return (
                <ExpandableItem
                  key={item.id}
                  icon={cfg.icon}
                  iconColor={cfg.color}
                  title={item.label}
                  badge={cfg.label}
                  badgeBg={cfg.bg}
                  description={item.description}
                  action={item.action}
                  href={item.href}
                  group={item.group.charAt(0).toUpperCase() + item.group.slice(1)}
                />
              );
            })}
            {advisoryRisks.map(item => {
              const cfg = SEVERITY_CONFIG[item.severity];
              return (
                <ExpandableItem
                  key={item.id}
                  icon={cfg.icon}
                  iconColor={cfg.color}
                  title={item.label}
                  badge={cfg.label}
                  badgeBg={cfg.bg}
                  description={item.description}
                  action={item.action}
                  href={item.href}
                  group={item.group}
                />
              );
            })}
          </Section>
        )}

        {/* Connected items */}
        {envOk.length > 0 && (
          <Section title="Connected" count={envOk.length}>
            {envOk.map(item => {
              const cfg = STATUS_CONFIG[item.status];
              return (
                <ExpandableItem
                  key={item.id}
                  icon={cfg.icon}
                  iconColor={cfg.color}
                  title={item.label}
                  badge={cfg.label}
                  badgeBg={cfg.bg}
                  description={item.description}
                  action={undefined}
                  href={item.href}
                  group={item.group.charAt(0).toUpperCase() + item.group.slice(1)}
                />
              );
            })}
          </Section>
        )}

        {/* Firebase config reference */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold">Setting env vars in Firebase Functions</p>
            <p className="text-xs text-muted-foreground">
              Run these commands locally with Firebase CLI to set production secrets.
              Replace the placeholder values with your real keys.
            </p>
            <div className="rounded-md bg-muted p-3 space-y-1.5 font-mono text-xs leading-relaxed text-muted-foreground overflow-x-auto">
              <p>firebase functions:config:set stripe.secret_key="sk_live_…" \</p>
              <p>{"  "}stripe.webhook_secret="whsec_…" \</p>
              <p>{"  "}resend.api_key="re_…" \</p>
              <p>{"  "}printify.api_key="YOUR_KEY" \</p>
              <p>{"  "}admin.user_ids="YOUR_UID_HERE" \</p>
              <p>{"  "}--project qrgear-c1ffd</p>
            </div>
            <p className="text-xs text-muted-foreground">
              After setting, run <span className="font-mono bg-muted px-1 rounded">firebase deploy --only functions --project qrgear-c1ffd</span> to apply.
            </p>
          </CardContent>
        </Card>

        {/* Timestamp */}
        {data?.generatedAt && (
          <p className="text-xs text-muted-foreground text-center">
            Env check last run: {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </AdminShell>
  );
}
