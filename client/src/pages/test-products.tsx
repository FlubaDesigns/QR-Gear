import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Image } from "lucide-react";
import { AdminAuthProvider } from "@/features/shared/AdminAuthContext";
import { ProductsProvider } from "@/features/adminProducts/ProductsContext";
import { BuilderHarness } from "@/features/adminProducts/builder/BuilderHarness";

export default function TestProductsPage() {
  return (
    <AdminAuthProvider apiBase="/api/test">
      <ProductsProvider>
        <div className="container mx-auto py-6 space-y-6">
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                Test Products (No Auth Required)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This is a public test version of the product builder for debugging. 
                Skips Role/Store/Channel selection and goes directly to the builder.
              </p>
              <Link href="/test-library">
                <Button variant="outline" size="sm" data-testid="link-test-library">
                  <Image className="h-4 w-4 mr-2" />
                  Go to Library
                </Button>
              </Link>
            </CardContent>
          </Card>

          <BuilderHarness />
        </div>
      </ProductsProvider>
    </AdminAuthProvider>
  );
}
