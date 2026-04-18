import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";
import Home from "@/pages/home";
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
import BuildSuccess from "@/pages/build-success";
import Customs from "@/pages/customs";
import Packet from "@/pages/packet";
import PacketSuccess from "@/pages/packet-success";
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
import AdminSettings from "@/pages/admin-settings";
import ShopSegment from "@/pages/shop-segment";
import ShopProduct from "@/pages/shop-product";
import Login from "@/pages/login";
import Register from "@/pages/register";
import QRBasics from "@/pages/qr-basics";
import QRPlus from "@/pages/qr-plus";
import QRCanvas from "@/pages/qr-canvas";
import QRPlay from "@/pages/qr-play";
import QRDynamics from "@/pages/qr-dynamics";
import QRHistory from "@/pages/qr-history";
import WeddingQRShirts from "@/pages/wedding-qr-shirts";
import Customize from "@/pages/customize";
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
import PrivacyPolicy from "@/pages/privacy";
import TermsOfService from "@/pages/terms";
import NotFound from "@/pages/not-found";
import ScrollToTop from "@/components/ScrollToTop";
import LogoPreview from "@/pages/logo-preview";
import AdminStoreBuilder from "@/pages/admin-store-builder";
import AdminStoreLibrary from "@/pages/admin-store-library";
import AdminARDemo from "@/pages/admin-ar-demo";
import AdminBlanks from "@/pages/admin-blanks";
import AdminMarketplaces from "@/pages/admin-marketplaces";
import AdminExternalSites from "@/pages/admin-external-sites";
import AdminDynamics from "@/pages/admin-dynamics";
import FontManagement from "@/pages/admin-fonts";
import Members from "@/features/members/MembersPage";
import PlayLanding from "@/pages/play";
import ProductLanding from "@/pages/product-landing";
import Member from "@/pages/member";
import RenewPage from "@/pages/renew";
import ClaimPage from "@/pages/claim";
import MyItemPage from "@/pages/my-item";
import BuildPage from "@/pages/build";
import EarnPage from "@/pages/earn";
import DevAuth from "@/pages/dev-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { CartProvider } from "@/contexts/CartContext";

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminAuthProvider apiBase="/api/admin">
        {children}
      </AdminAuthProvider>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/build" component={BuildPage} />
      <Route path="/store" component={Store} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/cart" component={Cart} />
      <Route path="/widget" component={Widget} />
      <Route path="/account" component={Account} />
      <Route path="/members" component={Members} />
      <Route path="/member">{() => <ProtectedRoute requireAdmin={false}><Member /></ProtectedRoute>}</Route>
      <Route path="/admin">{() => <AdminRoute><Admin /></AdminRoute>}</Route>
      <Route path="/admin/products">{() => <AdminRoute><AdminProducts /></AdminRoute>}</Route>
      <Route path="/admin/pricing">{() => <AdminRoute><AdminPricing /></AdminRoute>}</Route>
      <Route path="/admin/library">{() => <AdminRoute><LibraryPage /></AdminRoute>}</Route>
      <Route path="/admin/videos">{() => <AdminRoute><AdminVideos /></AdminRoute>}</Route>
      <Route path="/admin/categories">{() => <AdminRoute><AdminCategories /></AdminRoute>}</Route>
      <Route path="/admin/tags">{() => <AdminRoute><AdminTags /></AdminRoute>}</Route>
      <Route path="/admin/partners">{() => <AdminRoute><AdminPartners /></AdminRoute>}</Route>
      <Route path="/admin/orchestration">{() => <AdminRoute><AdminOrchestration /></AdminRoute>}</Route>
      <Route path="/admin/orders">{() => <AdminRoute><AdminOrders /></AdminRoute>}</Route>
      <Route path="/admin/gifts">{() => <AdminRoute><AdminGifts /></AdminRoute>}</Route>
      <Route path="/admin/dashboard">{() => <AdminRoute><AdminDashboard /></AdminRoute>}</Route>
      <Route path="/admin/coupons">{() => <AdminRoute><AdminCoupons /></AdminRoute>}</Route>
      <Route path="/admin/health">{() => <AdminRoute><AdminHealth /></AdminRoute>}</Route>
      <Route path="/admin/customers">{() => <AdminRoute><AdminCustomers /></AdminRoute>}</Route>
      <Route path="/admin/email-templates">{() => <AdminRoute><AdminEmailTemplates /></AdminRoute>}</Route>
      <Route path="/admin/email-health">{() => <AdminRoute><AdminEmailHealth /></AdminRoute>}</Route>
      <Route path="/admin/manual">{() => <AdminRoute><AdminManual /></AdminRoute>}</Route>
      <Route path="/admin/settings">{() => <AdminRoute><AdminSettings /></AdminRoute>}</Route>
      <Route path="/admin/sales/build">{() => <AdminRoute><StoreBuild /></AdminRoute>}</Route>
      <Route path="/build/success" component={BuildSuccess} />
      <Route path="/build" component={BuildPage} />
      <Route path="/earn" component={EarnPage} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/customize" component={Customize} />
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/renew/:instanceId" component={RenewPage} />
      <Route path="/renew/:instanceId/success" component={RenewPage} />
      <Route path="/claim/:claimCode" component={ClaimPage} />
      <Route path="/my-item/:instanceId" component={MyItemPage} />
      <Route path="/view/:id" component={ViewImage} />
      <Route path="/dynamic/:slug" component={ViewDynamic} />
      <Route path="/customs/:id" component={Customs} />
      <Route path="/p/success" component={PacketSuccess} />
      <Route path="/p/:id" component={Packet} />
      <Route path="/play/:packetId" component={PlayLanding} />
      <Route path="/i/:slug" component={ProductLanding} />
      <Route path="/e/:slug" component={ProductLanding} />
      <Route path="/m/:slug" component={ProductLanding} />
      <Route path="/gifts" component={GiftShop} />
      <Route path="/gift/redeem" component={GiftRedeem} />
      <Route path="/gift/redeem/:code" component={GiftRedeem} />
      <Route path="/shop/product/:linkId" component={ShopProduct} />
      <Route path="/shop/:storeType/:storeName" component={ShopSegment} />
      <Route path="/shop/:storeType/:storeName/:segment" component={ShopSegment} />
      <Route path="/admin/dynamics">{() => <AdminRoute><AdminDynamics /></AdminRoute>}</Route>
      <Route path="/admin/blanks">{() => <AdminRoute><AdminBlanks /></AdminRoute>}</Route>
      <Route path="/admin/marketplaces">{() => <AdminRoute><AdminMarketplaces /></AdminRoute>}</Route>
      <Route path="/admin/external-sites">{() => <AdminRoute><AdminExternalSites /></AdminRoute>}</Route>
      <Route path="/admin/store-builder">{() => <AdminRoute><AdminStoreBuilder /></AdminRoute>}</Route>
      <Route path="/admin/store-library">{() => <AdminRoute><AdminStoreLibrary /></AdminRoute>}</Route>
      <Route path="/admin/ar-demo">{() => <AdminRoute><AdminARDemo /></AdminRoute>}</Route>
      <Route path="/admin/fonts">{() => <AdminRoute><FontManagement /></AdminRoute>}</Route>
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
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/dev-auth" component={DevAuth} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <TooltipProvider>
          <ScrollToTop />
          <Toaster />
          <BreadcrumbTrail />
          <Router />
        </TooltipProvider>
      </CartProvider>
    </QueryClientProvider>
  );
}

export default App;
