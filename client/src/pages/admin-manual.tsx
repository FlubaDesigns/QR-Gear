import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Book,
  ChevronRight,
  Search,
  FolderOpen,
  ShoppingCart,
  Package,
  Gift,
  Mail,
  BarChart3,
  Layers,
  HelpCircle,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import AdminSectionSubNav from "@/components/admin/AdminSectionSubNav";
import { SYSTEM_SUBNAV } from "@/components/admin/adminNavConfig";

interface ManualSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

const sections: ManualSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Book,
    content: (
      <div className="space-y-4">
        <p>Access the admin panel by navigating to <code className="px-2 py-1 bg-muted rounded">/admin</code> in your browser or clicking "Admin" in the navigation menu.</p>
      </div>
    ),
  },
  {
    id: "categories",
    title: "Managing Categories",
    icon: FolderOpen,
    content: (
      <div className="space-y-6">
        <p>Categories help organize your products and pre-designed collections. Users can filter products by category on the homepage.</p>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Viewing Categories</h4>
          <p>When you open the admin panel, you'll see a table showing all your categories with:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Icon</strong> - Visual identifier for the category</li>
            <li><strong>Name</strong> - The category display name</li>
            <li><strong>Description</strong> - Brief description (visible on larger screens)</li>
            <li><strong>Status</strong> - Toggle switch showing if category is active/visible</li>
            <li><strong>Actions</strong> - Edit and delete buttons</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Adding Default Categories</h4>
          <p>If starting fresh with no categories:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click the <strong>"Seed Defaults"</strong> button</li>
            <li>This adds six starter categories: Religious, Political, Sports, Business, Entertainment, Custom</li>
          </ol>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Creating a New Category</h4>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click the <strong>"Add Category"</strong> button (top right)</li>
            <li>Fill in the form: Name, Description, Icon, and Active status</li>
            <li>Click <strong>"Create"</strong> to save</li>
          </ol>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Tips</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Start with defaults</strong> - Use "Seed Defaults" to get started quickly</li>
            <li><strong>Keep it simple</strong> - 5-8 categories is usually enough</li>
            <li><strong>Hide, don't delete</strong> - Toggle a category inactive instead of deleting</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "products",
    title: "Fulfillment Providers",
    icon: Package,
    content: <div className="space-y-4"><p>Choose the default provider in Admin Products → Tools. Each product can retain its own provider choice in the product builder.</p><p>Use System → Settings to inspect configured credentials and run a connection check. A saved key or a connected catalog does not prove a paid order can be printed.</p><p>Every product requires its inside label. Prices use the saved Admin Pricing settings and the selected provider's saved costs.</p></div>,
  },
  {
    id: "orchestration",
    title: "Multi-Provider Orchestration",
    icon: Layers,
    content: <div className="space-y-4"><p>Analytics reads recorded QR scans. Health shows recorded connection checks, including when a provider has never been checked or has no credential configured.</p><p>Automatic provider selection, bulk marketplace publishing, rule-based repricing and profit forecasting are not connected to a verified execution service. These actions report their unavailable status.</p><p>Use Admin Pricing to preview and apply saved product pricing, Products to select fulfillment, and Marketplaces for the existing account and listing workflow. Sandbox blocks real purchases and printing.</p></div>,
  },
  {
    id: "gifts",
    title: "Gift Mode",
    icon: Gift,
    content: (
      <div className="space-y-6">
        <p>Gift Mode lets customers purchase gift packages that recipients can redeem and customize.</p>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Creating a Gift Package</h4>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Go to the Packages tab in <code className="px-1 bg-muted rounded">/admin/gifts</code></li>
            <li>Tap "Create Package"</li>
            <li>Fill in: Name, Description, Type, Price, Expiration Days</li>
            <li>Toggle "Active" to make available</li>
            <li>Tap "Create"</li>
          </ol>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Gift Code Format</h4>
          <p className="text-muted-foreground">Codes follow the format: <code className="px-2 py-1 bg-muted rounded">GIFT-XXXX-XXXX-XXXX</code></p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Redemption Flow</h4>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Recipient visits <code className="px-1 bg-muted rounded">/redeem</code></li>
            <li>Enters their gift code</li>
            <li>Customizes their product (size, color, QR content)</li>
            <li>Enters shipping address</li>
            <li>Order is created for fulfillment</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "orders",
    title: "Order Management",
    icon: ShoppingCart,
    content: (
      <div className="space-y-6">
        <p>View and manage orders from all channels in one place at <code className="px-2 py-1 bg-muted rounded">/admin/orders</code>.</p>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Order List Shows</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Order ID</strong> - Unique identifier</li>
            <li><strong>Channel</strong> - Where the order came from (Etsy, eBay, Amazon, Direct)</li>
            <li><strong>Customer</strong> - Buyer name</li>
            <li><strong>Items</strong> - Products ordered</li>
            <li><strong>Status</strong> - Current fulfillment status</li>
            <li><strong>Provider</strong> - Which print provider is handling it</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Filtering</h4>
          <p className="text-muted-foreground">Use filters to find specific orders by channel, status, date range, or provider.</p>
        </div>
      </div>
    ),
  },
  {
    id: "email",
    title: "Transactional Email",
    icon: Mail,
    content: (
      <div className="space-y-6">
        <p>QR Gear sends order confirmations, shipping notices, and activation emails through Resend.</p>
        <p>Use System → Email for order and shipping templates and send logs. If no template is saved, the built-in email is used. A disabled template stops that email.</p>
        <p>Sent means Resend accepted the email; it does not confirm inbox delivery. Failed sends show their error in the log. Use the order page to resend a confirmation or shipping notice.</p>
      </div>
    ),
  },
  {
    id: "analytics",
    title: "QR Analytics",
    icon: BarChart3,
    content: (
      <div className="space-y-6">
        <p>Open the Analytics tab to inspect recorded QR scans at <code className="px-2 py-1 bg-muted rounded">/admin/orchestration</code>.</p>
        
        <div className="space-y-3">
          <h4 className="font-semibold">Available Metrics</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>Total Scans</strong> - All-time scan count</li>
            <li><strong>Scans Today</strong> - Today's activity</li>
            <li><strong>Top Products</strong> - Most scanned QR codes</li>
            <li><strong>Scan Locations</strong> - Geographic distribution</li>
            <li><strong>Scan Timeline</strong> - Activity over time</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    icon: HelpCircle,
    content: (
      <div className="space-y-6">
        <div className="space-y-3">
          <h4 className="font-semibold">Categories not loading?</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Check your internet connection</li>
            <li>Click the "Refresh" button</li>
            <li>Verify Firebase credentials are configured correctly</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Can't create categories?</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Ensure Firebase Firestore has proper security rules</li>
            <li>Check browser console for error messages</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Categories not showing on storefront?</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Verify the category is toggled to "Active"</li>
            <li>Refresh the homepage</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold">Need More Help?</h4>
          <p className="text-muted-foreground">Contact support if you encounter issues not covered in this manual.</p>
        </div>
      </div>
    ),
  },
];

export default function AdminManual() {
  const [activeSection, setActiveSection] = useState<string>("getting-started");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = sections.filter(
    (section) =>
      section.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <AdminShell
      title="Admin Manual"
      subtitle="Complete guide to managing QR Gear"
      icon={Book}
      backHref="/admin"
      backLabel="Back"
      sectionNav={<AdminSectionSubNav items={SYSTEM_SUBNAV} />}
    >
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border bg-background text-sm"
                data-testid="input-search-manual"
              />
            </div>

            <Card>
              <ScrollArea className="h-[calc(100vh-280px)]">
                <CardContent className="p-2">
                  <nav className="space-y-1">
                    {filteredSections.map((section) => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => setActiveSection(section.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                          data-testid={`button-section-${section.id}`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {section.title}
                          </span>
                          {isActive && (
                            <ChevronRight className="h-4 w-4 ml-auto flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </CardContent>
              </ScrollArea>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              {currentSection && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 pb-4 border-b">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <currentSection.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold" data-testid="text-section-title">
                      {currentSection.title}
                    </h2>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {currentSection.content}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </AdminShell>
  );
}
