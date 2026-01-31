import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NexusConsole from "@/components/NexusConsole";
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
import LibraryPage from "@/features/adminLibrary/LibraryPage";
import AdminVideos from "@/pages/admin-videos";
import AdminCategories from "@/pages/admin-categories";
import AdminTags from "@/pages/admin-tags";
import AdminPartners from "@/pages/admin-partners";
import AdminOrchestration from "@/pages/admin-orchestration";
import AdminOrders from "@/pages/admin-orders";
import StoreBuild from "@/pages/store-build";
import Checkout from "@/pages/checkout";
import CheckoutSuccess from "@/pages/checkout-success";
import Customs from "@/pages/customs";
import Packet from "@/pages/packet";
import GiftShop from "@/pages/gift-shop";
import GiftRedeem from "@/pages/gift-redeem";
import AdminGifts from "@/pages/admin-gifts";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminCoupons from "@/pages/admin-coupons";
import AdminHealth from "@/pages/admin-health";
import AdminCustomers from "@/pages/admin-customers";
import AdminEmailTemplates from "@/pages/admin-email-templates";
import AdminEmailHealth from "@/pages/admin-email-health";
import AdminManual from "@/pages/admin-manual";
import ShopSegment from "@/pages/shop-segment";
import Login from "@/pages/login";
import Register from "@/pages/register";
import QRBasics from "@/pages/qr-basics";
import QRPlus from "@/pages/qr-plus";
import QRCanvas from "@/pages/qr-canvas";
import QRPlay from "@/pages/qr-play";
import QRDynamics from "@/pages/qr-dynamics";
import QRHistory from "@/pages/qr-history";
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
import LogoPreview from "@/pages/logo-preview";
import TestImages from "@/pages/test-images";
import AdminTestImages from "@/pages/admin-test-images";
import AdminTestUpload from "@/pages/admin-test-upload";
import TestLibrary from "@/pages/test-library";
import TestProducts from "@/pages/test-products";
import TestStores from "@/pages/test-stores";
import TestStoreBuilder from "@/pages/test-store-builder";
import TestARDemo from "@/pages/test-ar-demo";
import TestDynamics from "@/pages/test-dynamics";
import TestPricing from "@/pages/test-pricing";
import TestSettings from "@/pages/test-settings";
import TestMembers from "@/pages/test-members";
import TestCanvasPacket from "@/pages/test-canvas-packet";
import TestQRPlay from "@/pages/test-qr-play";
import PlayLanding from "@/pages/play";
import ProductLanding from "@/pages/product-landing";
import Member from "@/pages/member";
import { ProtectedRoute } from "@/components/ProtectedRoute";

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
      <Route path="/member" component={Member} />
      <Route path="/admin">{() => <ProtectedRoute><Admin /></ProtectedRoute>}</Route>
      <Route path="/admin/products">{() => <ProtectedRoute><AdminProducts /></ProtectedRoute>}</Route>
      <Route path="/admin/pricing">{() => <ProtectedRoute><AdminPricing /></ProtectedRoute>}</Route>
      <Route path="/admin/library">{() => <ProtectedRoute><LibraryPage /></ProtectedRoute>}</Route>
      <Route path="/admin/videos">{() => <ProtectedRoute><AdminVideos /></ProtectedRoute>}</Route>
      <Route path="/admin/categories">{() => <ProtectedRoute><AdminCategories /></ProtectedRoute>}</Route>
      <Route path="/admin/tags">{() => <ProtectedRoute><AdminTags /></ProtectedRoute>}</Route>
      <Route path="/admin/partners">{() => <ProtectedRoute><AdminPartners /></ProtectedRoute>}</Route>
      <Route path="/admin/orchestration">{() => <ProtectedRoute><AdminOrchestration /></ProtectedRoute>}</Route>
      <Route path="/admin/orders">{() => <ProtectedRoute><AdminOrders /></ProtectedRoute>}</Route>
      <Route path="/admin/gifts">{() => <ProtectedRoute><AdminGifts /></ProtectedRoute>}</Route>
      <Route path="/admin/dashboard">{() => <ProtectedRoute><AdminDashboard /></ProtectedRoute>}</Route>
      <Route path="/admin/coupons">{() => <ProtectedRoute><AdminCoupons /></ProtectedRoute>}</Route>
      <Route path="/admin/health">{() => <ProtectedRoute><AdminHealth /></ProtectedRoute>}</Route>
      <Route path="/admin/customers">{() => <ProtectedRoute><AdminCustomers /></ProtectedRoute>}</Route>
      <Route path="/admin/email-templates">{() => <ProtectedRoute><AdminEmailTemplates /></ProtectedRoute>}</Route>
      <Route path="/admin/email-health">{() => <ProtectedRoute><AdminEmailHealth /></ProtectedRoute>}</Route>
      <Route path="/admin/manual">{() => <ProtectedRoute><AdminManual /></ProtectedRoute>}</Route>
      <Route path="/admin/test-images">{() => <ProtectedRoute><AdminTestImages /></ProtectedRoute>}</Route>
      <Route path="/admin/sales/build">{() => <ProtectedRoute><StoreBuild /></ProtectedRoute>}</Route>
      <Route path="/checkout" component={Checkout} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/view/:id" component={ViewImage} />
      <Route path="/dynamic/:slug" component={ViewDynamic} />
      <Route path="/customs/:id" component={Customs} />
      <Route path="/p/:id" component={Packet} />
      <Route path="/play/:packetId" component={PlayLanding} />
      <Route path="/i/:slug" component={ProductLanding} />
      <Route path="/e/:slug" component={ProductLanding} />
      <Route path="/m/:slug" component={ProductLanding} />
      <Route path="/gifts" component={GiftShop} />
      <Route path="/gift/redeem" component={GiftRedeem} />
      <Route path="/gift/redeem/:code" component={GiftRedeem} />
      <Route path="/shop/:storeType/:storeName" component={ShopSegment} />
      <Route path="/shop/:storeType/:storeName/:segment" component={ShopSegment} />
      <Route path="/test-images" component={TestImages} />
      <Route path="/test-upload" component={AdminTestUpload} />
      <Route path="/test-library" component={TestLibrary} />
      <Route path="/test-products" component={TestProducts} />
      <Route path="/test-stores" component={TestStores} />
      <Route path="/test-dynamics" component={TestDynamics} />
      <Route path="/test-pricing" component={TestPricing} />
      <Route path="/test-store-builder" component={TestStoreBuilder} />
      <Route path="/test-ar-demo" component={TestARDemo} />
      <Route path="/test-settings" component={TestSettings} />
      <Route path="/test-members">{() => <ProtectedRoute><TestMembers /></ProtectedRoute>}</Route>
      <Route path="/test-canvas-packet" component={TestCanvasPacket} />
      <Route path="/test-qr-play" component={TestQRPlay} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/qr-basics" component={QRBasics} />
      <Route path="/qr-plus" component={QRPlus} />
      <Route path="/qr-canvas" component={QRCanvas} />
      <Route path="/qr-play" component={QRPlay} />
      <Route path="/qr-dynamics" component={QRDynamics} />
      <Route path="/qr-history" component={QRHistory} />
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
      <Route path="/logo-preview" component={LogoPreview} />
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
        <NexusConsole />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
