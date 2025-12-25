import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Creator from "@/pages/creator";
import Store from "@/pages/store";
import Gallery from "@/pages/gallery";
import Cart from "@/pages/cart";
import Widget from "@/pages/widget";
import Account from "@/pages/account";
import ViewImage from "@/pages/view-image";
import ViewDynamic from "@/pages/view-dynamic";
import Admin from "@/pages/admin";
import AdminProducts from "@/pages/admin-products";
import AdminPricing from "@/pages/admin-pricing";
import AdminBackgrounds from "@/pages/admin-backgrounds";
import AdminVideos from "@/pages/admin-videos";
import AdminCategories from "@/pages/admin-categories";
import AdminTags from "@/pages/admin-tags";
import AdminPartners from "@/pages/admin-partners";
import AdminOrchestration from "@/pages/admin-orchestration";
import AdminOrders from "@/pages/admin-orders";
import StoreBuild from "@/pages/store-build";
import CheckoutSuccess from "@/pages/checkout-success";
import Customs from "@/pages/customs";
import GiftShop from "@/pages/gift-shop";
import GiftRedeem from "@/pages/gift-redeem";
import AdminGifts from "@/pages/admin-gifts";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminCoupons from "@/pages/admin-coupons";
import AdminHealth from "@/pages/admin-health";
import AdminCustomers from "@/pages/admin-customers";
import ShopSegment from "@/pages/shop-segment";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/creator" component={Creator} />
      <Route path="/store" component={Store} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/cart" component={Cart} />
      <Route path="/widget" component={Widget} />
      <Route path="/account" component={Account} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/pricing" component={AdminPricing} />
      <Route path="/admin/backgrounds" component={AdminBackgrounds} />
      <Route path="/admin/videos" component={AdminVideos} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/tags" component={AdminTags} />
      <Route path="/admin/partners" component={AdminPartners} />
      <Route path="/admin/orchestration" component={AdminOrchestration} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/gifts" component={AdminGifts} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/coupons" component={AdminCoupons} />
      <Route path="/admin/health" component={AdminHealth} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/sales/build" component={StoreBuild} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/view/:id" component={ViewImage} />
      <Route path="/dynamic/:slug" component={ViewDynamic} />
      <Route path="/customs/:id" component={Customs} />
      <Route path="/gifts" component={GiftShop} />
      <Route path="/gift/redeem" component={GiftRedeem} />
      <Route path="/gift/redeem/:code" component={GiftRedeem} />
      <Route path="/shop/:storeType/:storeName" component={ShopSegment} />
      <Route path="/shop/:storeType/:storeName/:segment" component={ShopSegment} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
