import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package, Library } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { StoreLibraryHarness } from "@/features/adminProducts/storeLibrary/StoreLibraryHarness";

export default function TestStoresPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <div className="container mx-auto py-6 space-y-6">
        <Card className="border-blue-500/50 bg-blue-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-600" data-testid="text-page-title">
              <Library className="h-5 w-5" />
              Test Stores (No Auth Required)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Browse and manage stores by type (internal, external, member). 
              Use the lightbox to move products between stores and channels.
            </p>
            <div className="flex gap-2">
              <Link href="/test-products">
                <Button variant="outline" size="sm" data-testid="link-test-products">
                  <Package className="h-4 w-4 mr-2" />
                  Products
                </Button>
              </Link>
              <Link href="/test-library">
                <Button variant="outline" size="sm" data-testid="link-test-library">
                  <Library className="h-4 w-4 mr-2" />
                  Library
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <StoreLibraryHarness />
      </div>
    </AdminAuthProvider>
  );
}
