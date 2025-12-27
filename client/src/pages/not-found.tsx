import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, AlertCircle, QrCode } from "lucide-react";
import { Link } from "wouter";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 p-4">
      <BreadcrumbTrail />
      <div className="flex-1 flex items-center justify-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
      </div>
      
      <Card className="w-full max-w-md backdrop-blur-xl bg-white/10 border-white/20 shadow-2xl relative z-10">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <QrCode className="h-20 w-20 text-white/30" />
              <AlertCircle className="h-8 w-8 text-orange-400 absolute -bottom-1 -right-1" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-2">404</h1>
          <h2 className="text-xl font-semibold text-white/90 mb-4">Page Not Found</h2>
          
          <p className="text-white/70 mb-8">
            Looks like this QR code leads nowhere. Let's get you back on track.
          </p>
          
          <Link href="/">
            <Button 
              size="lg" 
              className="qr-touch-48 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold gap-2"
              data-testid="button-go-home"
            >
              <Home className="h-5 w-5" />
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
