import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, DollarSign, Image, Layers, QrCode, LogIn, LogOut, Server, User, Store, Truck } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsHarness } from "@/features/adminProducts/ProductsHarness";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { Badge } from "@/components/ui/badge";

export type FulfillmentProvider = "printify" | "printful";

function AuthModule() {
  const { firebaseUser, isLoading, isAdmin } = useAuth();

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card mb-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-muted-foreground animate-pulse" />
          <span className="text-muted-foreground">Checking authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card mb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5" />
          {firebaseUser ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{firebaseUser.displayName || firebaseUser.email}</span>
              {isAdmin && <Badge variant="secondary">Admin</Badge>}
            </div>
          ) : (
            <span className="text-muted-foreground">Not signed in</span>
          )}
        </div>
        {firebaseUser ? (
          <button
            onClick={handleLogout}
            className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full"
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        ) : (
          <button
            onClick={handleLogin}
            className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full"
            data-testid="button-login"
          >
            <LogIn className="h-5 w-5" />
            Sign In with Google
          </button>
        )}
      </div>
    </div>
  );
}

interface PathwayModuleProps {
  apiBase: string;
  onApiBaseChange: (base: string) => void;
}

function PathwayModule({ apiBase, onApiBaseChange }: PathwayModuleProps) {
  const isDev = apiBase === "/api/test";
  const isProd = apiBase === "/api";

  return (
    <div className="glass-card mb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5" />
          <span className="font-medium">Server Pathway</span>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onApiBaseChange("/api/test")}
            className={`qr-btn qr-btn--touch qr-btn--full ${isDev ? "qr-btn--primary" : "qr-btn--outline"}`}
            data-testid="button-pathway-dev"
          >
            Development
            {isDev && <Badge variant="outline" className="ml-2">Active</Badge>}
          </button>
          <button
            onClick={() => onApiBaseChange("/api")}
            className={`qr-btn qr-btn--touch qr-btn--full ${isProd ? "qr-btn--primary" : "qr-btn--outline"}`}
            data-testid="button-pathway-prod"
          >
            Production
            {isProd && <Badge variant="outline" className="ml-2">Active</Badge>}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-3">
        {isDev 
          ? "Using /api/test endpoints - No authentication required"
          : "Using /api endpoints - Authentication required"
        }
      </p>
    </div>
  );
}

export default function TestProductsPage() {
  const [apiBase, setApiBase] = useState("/api/test");

  return (
    <AdminAuthProvider apiBase={apiBase}>
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <AuthModule />
          <PathwayModule apiBase={apiBase} onApiBaseChange={setApiBase} />

          <div className="glass-card">
            <h1 className="glass-title text-lg mb-4 flex items-center gap-2" data-testid="text-page-title">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              Product Builder
            </h1>
            <div className="flex flex-col gap-3">
              <Link href="/test-store-builder" className="block">
                <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full" data-testid="link-store-builder">
                  <Store className="h-5 w-5" />
                  Store Builder
                </button>
              </Link>
              <Link href="/test-pricing" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-test-pricing">
                  <DollarSign className="h-5 w-5" />
                  Pricing Settings
                </button>
              </Link>
              <Link href="/admin/library?tab=graphics" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-graphics-library">
                  <QrCode className="h-5 w-5" />
                  Graphics Library
                </button>
              </Link>
              <Link href="/admin/library?tab=templates" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-templates-library">
                  <Layers className="h-5 w-5" />
                  Templates Library
                </button>
              </Link>
              <Link href="/admin/library" className="block">
                <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full" data-testid="link-full-library">
                  <Image className="h-5 w-5" />
                  Full Library
                </button>
              </Link>
            </div>
          </div>

          <ProductsHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
