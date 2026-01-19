import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Store, Package, DollarSign, QrCode, Layers, Image, User, LogIn, LogOut, Server } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreBuilderHarness } from "@/features/storeBuilder/StoreBuilderHarness";
import { useAuth } from "@/hooks/useAuth";
import { auth } from "@/lib/firebase";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { Badge } from "@/components/ui/badge";

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5" />
          {firebaseUser ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">{firebaseUser.displayName || firebaseUser.email}</span>
              {isAdmin && <Badge variant="secondary">Admin</Badge>}
            </div>
          ) : (
            <span className="text-muted-foreground">Not signed in</span>
          )}
        </div>
        {firebaseUser ? (
          <button
            onClick={handleLogout}
            className="qr-btn qr-btn--outline qr-btn--touch"
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
        ) : (
          <button
            onClick={handleLogin}
            className="qr-btn qr-btn--primary qr-btn--touch"
            data-testid="button-login"
          >
            <LogIn className="h-4 w-4 mr-2" />
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5" />
          <span className="font-medium">Server Pathway</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onApiBaseChange("/api/test")}
            className={`qr-btn qr-btn--touch ${isDev ? "qr-btn--primary" : "qr-btn--outline"}`}
            data-testid="button-pathway-dev"
          >
            Development
            {isDev && <Badge variant="outline" className="ml-2">Active</Badge>}
          </button>
          <button
            onClick={() => onApiBaseChange("/api")}
            className={`qr-btn qr-btn--touch ${isProd ? "qr-btn--primary" : "qr-btn--outline"}`}
            data-testid="button-pathway-prod"
          >
            Production
            {isProd && <Badge variant="outline" className="ml-2">Active</Badge>}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-2">
        {isDev 
          ? "Using /api/test endpoints - No authentication required for API calls"
          : "Using /api endpoints - Authentication required for API calls"
        }
      </p>
    </div>
  );
}

export default function TestStoreBuilderPage() {
  const [apiBase, setApiBase] = useState("/api/test");

  return (
    <AdminAuthProvider apiBase={apiBase}>
      <div className="page-wrap">
        <div className="container mobile-compact mobile-compact-stack">
          <AuthModule />
          <PathwayModule apiBase={apiBase} onApiBaseChange={setApiBase} />

          <div className="glass-card">
            <div className="flex items-start gap-4 flex-wrap">
              <div className="glass-icon">
                <Store className="h-6 w-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="glass-title text-xl mb-2" data-testid="text-page-title">
                  Store Builder
                </h1>
                <p className="glass-body mb-4">
                  Assign saved product packages to stores and channels. 
                  Load a product from Products Builder first.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/test-products">
                    <button className="qr-btn qr-btn--primary qr-btn--touch" data-testid="link-test-products">
                      <Package className="h-5 w-5 mr-2" />
                      Products
                    </button>
                  </Link>
                  <Link href="/test-pricing">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-test-pricing">
                      <DollarSign className="h-5 w-5 mr-2" />
                      Pricing
                    </button>
                  </Link>
                  <Link href="/admin/library?tab=graphics">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-graphics-library">
                      <QrCode className="h-5 w-5 mr-2" />
                      Graphics
                    </button>
                  </Link>
                  <Link href="/admin/library?tab=templates">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-templates-library">
                      <Layers className="h-5 w-5 mr-2" />
                      Templates
                    </button>
                  </Link>
                  <Link href="/admin/library">
                    <button className="qr-btn qr-btn--outline qr-btn--touch" data-testid="link-full-library">
                      <Image className="h-5 w-5 mr-2" />
                      Library
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <StoreBuilderHarness />
        </div>
      </div>
    </AdminAuthProvider>
  );
}
