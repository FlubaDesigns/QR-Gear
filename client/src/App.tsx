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
import CheckoutSuccess from "@/pages/checkout-success";
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
      <Route path="/checkout/success" component={CheckoutSuccess} />
      <Route path="/view/:id" component={ViewImage} />
      <Route path="/dynamic/:slug" component={ViewDynamic} />
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
