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
import AdminEmailTemplates from "@/pages/admin-email-templates";
import ShopSegment from "@/pages/shop-segment";
import Login from "@/pages/login";
import Register from "@/pages/register";
import QRBasics from "@/pages/qr-basics";
import QRPlus from "@/pages/qr-plus";
import QRCanvas from "@/pages/qr-canvas";
import QRPlay from "@/pages/qr-play";
import QRDynamics from "@/pages/qr-dynamics";
import WeddingQRShirts from "@/pages/wedding-qr-shirts";
import FamilyReunionShirts from "@/pages/family-reunion-shirts";
import ArtistQRApparel from "@/pages/artist-qr-apparel";
import MemorialQRGifts from "@/pages/memorial-qr-gifts";
import MusicianMerch from "@/pages/musician-merch";
import WebsiteQRShirts from "@/pages/website-qr-shirts";
import OfficeQRMug from "@/pages/office-qr-mug";
import LostFoundQR from "@/pages/lost-found-qr";
import NetworkingQRShirts from "@/pages/networking-qr-shirts";
import MedicalAlertQR from "@/pages/medical-alert-qr";
import PersonalItemsQR from "@/pages/personal-items-qr";
import EventQRShirts from "@/pages/event-qr-shirts";
import EverydayQR from "@/pages/everyday-qr";
import BusinessQRPlus from "@/pages/business-qr-plus";
import MemorialVideoShirts from "@/pages/memorial-video-shirts";
import FamilyVideoMessages from "@/pages/family-video-messages";
import VideoTimeCapsule from "@/pages/video-time-capsule";
import AdventQRShirts from "@/pages/advent-qr-shirts";
import BandDynamicMerch from "@/pages/band-dynamic-merch";
import RealtorQRShirts from "@/pages/realtor-qr-shirts";
import BusinessAnalyticsQR from "@/pages/business-analytics-qr";
import NotFound from "@/pages/not-found";
import ScrollToTop from "@/components/ScrollToTop";

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
      <Route path="/admin/email-templates" component={AdminEmailTemplates} />
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
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/qr-basics" component={QRBasics} />
      <Route path="/qr-plus" component={QRPlus} />
      <Route path="/qr-canvas" component={QRCanvas} />
      <Route path="/qr-play" component={QRPlay} />
      <Route path="/qr-dynamics" component={QRDynamics} />
      <Route path="/wedding-qr-shirts" component={WeddingQRShirts} />
      <Route path="/family-reunion-shirts" component={FamilyReunionShirts} />
      <Route path="/artist-qr-apparel" component={ArtistQRApparel} />
      <Route path="/memorial-qr-gifts" component={MemorialQRGifts} />
      <Route path="/musician-merch" component={MusicianMerch} />
      <Route path="/website-qr-shirts" component={WebsiteQRShirts} />
      <Route path="/office-qr-mug" component={OfficeQRMug} />
      <Route path="/lost-found-qr" component={LostFoundQR} />
      <Route path="/networking-qr-shirts" component={NetworkingQRShirts} />
      <Route path="/medical-alert-qr" component={MedicalAlertQR} />
      <Route path="/personal-items-qr" component={PersonalItemsQR} />
      <Route path="/event-qr-shirts" component={EventQRShirts} />
      <Route path="/everyday-qr" component={EverydayQR} />
      <Route path="/business-qr-plus" component={BusinessQRPlus} />
      <Route path="/memorial-video-shirts" component={MemorialVideoShirts} />
      <Route path="/family-video-messages" component={FamilyVideoMessages} />
      <Route path="/video-time-capsule" component={VideoTimeCapsule} />
      <Route path="/advent-qr-shirts" component={AdventQRShirts} />
      <Route path="/band-dynamic-merch" component={BandDynamicMerch} />
      <Route path="/realtor-qr-shirts" component={RealtorQRShirts} />
      <Route path="/business-analytics-qr" component={BusinessAnalyticsQR} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ScrollToTop />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
