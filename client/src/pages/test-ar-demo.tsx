import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, Box } from "lucide-react";
import { useLocation } from "wouter";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        'ios-src'?: string;
        poster?: string;
        alt?: string;
        ar?: boolean;
        'ar-modes'?: string;
        'ar-scale'?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        'shadow-intensity'?: string;
        'environment-image'?: string;
        exposure?: string;
        loading?: string;
      }, HTMLElement>;
    }
  }
}

export default function TestARDemo() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Load model-viewer script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/test-store-builder")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold">AR Demo - Google model-viewer</h1>
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Box className="h-4 w-4" />
            <span>Sample 3D Model - Astronaut Helmet</span>
          </div>
          
          <div className="aspect-square w-full max-w-md mx-auto bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg overflow-hidden">
            <model-viewer
              src="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
              ios-src="https://modelviewer.dev/shared-assets/models/Astronaut.usdz"
              alt="A 3D model of an astronaut"
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="auto"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              environment-image="neutral"
              exposure="1"
              loading="eager"
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800 dark:text-blue-200">How to use AR</span>
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-disc list-inside">
              <li><strong>On phone:</strong> Tap the AR button (cube icon) in the corner of the viewer</li>
              <li><strong>Android:</strong> Opens Google Scene Viewer - place object on any surface</li>
              <li><strong>iPhone:</strong> Opens Apple Quick Look - same surface placement</li>
              <li><strong>Desktop:</strong> Shows QR code to scan with your phone</li>
            </ul>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">What This Means For Products</h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              For t-shirts and apparel, we would generate a simple 3D model - a flat plane 
              with your mockup image as the texture. This lets customers:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Place the product on their table, floor, or wall</li>
              <li>See it at actual size in their space</li>
              <li>Walk around it and view from any angle</li>
              <li>Take photos/videos to share</li>
            </ul>
            <p className="pt-2">
              The 3D file generation would happen on the server when you create a packet, 
              storing GLB (Android) and USDZ (iOS) files alongside the mockup images.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
