import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Smartphone, Box, Loader2, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

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

async function generateGLBFromImage(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const scene = new THREE.Scene();
      
      // Calculate aspect ratio from image
      const aspectRatio = img.width / img.height;
      const width = 0.4; // 40cm wide (realistic t-shirt size)
      const height = width / aspectRatio;
      
      // Create plane geometry
      const geometry = new THREE.PlaneGeometry(width, height);
      
      // Create texture from loaded image
      const texture = new THREE.Texture(img);
      texture.needsUpdate = true;
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // Create material with the texture
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
      });
      
      // Create mesh and add to scene
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = "ProductImage";
      scene.add(mesh);
      
      // Export to GLB
      const exporter = new GLTFExporter();
      exporter.parse(
        scene,
        (result) => {
          if (result instanceof ArrayBuffer) {
            const blob = new Blob([result], { type: "model/gltf-binary" });
            const url = URL.createObjectURL(blob);
            resolve(url);
          } else {
            reject(new Error("Expected binary GLB output"));
          }
        },
        (error) => reject(error),
        { binary: true }
      );
    };
    
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

export default function TestARDemo() {
  const [, navigate] = useLocation();
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modelViewerRef = useRef<HTMLElement>(null);

  // Use a CORS-friendly sample image for the demo
  // In production, we use Firebase Storage URLs which allow CORS
  const sampleMockupUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&q=80";

  useEffect(() => {
    // Load model-viewer script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js';
    document.head.appendChild(script);

    return () => {
      if (glbUrl) {
        URL.revokeObjectURL(glbUrl);
      }
      document.head.removeChild(script);
    };
  }, []);

  const handleGenerateModel = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const url = await generateGLBFromImage(sampleMockupUrl);
      setGlbUrl(url);
    } catch (err: any) {
      console.error("GLB generation failed:", err);
      setError(err.message || "Failed to generate 3D model");
    } finally {
      setIsGenerating(false);
    }
  };

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
          <h1 className="text-xl font-bold">AR Demo - T-Shirt with Graphic</h1>
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Box className="h-4 w-4" />
            <span>T-Shirt Mockup → 3D Model → AR Preview</span>
          </div>

          {!glbUrl ? (
            <div className="space-y-4">
              <div className="aspect-square w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
                <img 
                  src={sampleMockupUrl} 
                  alt="T-shirt mockup" 
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
              
              <Button 
                onClick={handleGenerateModel} 
                disabled={isGenerating}
                className="w-full"
                data-testid="button-generate-3d"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating 3D Model...
                  </>
                ) : (
                  <>
                    <Box className="h-4 w-4 mr-2" />
                    Generate 3D Model for AR
                  </>
                )}
              </Button>
              
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>3D model generated! Tap the AR button (cube icon) to view in your space.</span>
              </div>
              
              <div className="aspect-square w-full max-w-md mx-auto bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 rounded-lg overflow-hidden">
                <model-viewer
                  ref={modelViewerRef as any}
                  src={glbUrl}
                  poster={sampleMockupUrl}
                  alt="T-shirt with custom graphic"
                  ar
                  ar-modes="webxr scene-viewer quick-look"
                  ar-scale="fixed"
                  camera-controls
                  auto-rotate
                  shadow-intensity="1"
                  environment-image="neutral"
                  exposure="1"
                  loading="eager"
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              
              <Button 
                variant="outline"
                onClick={() => {
                  if (glbUrl) URL.revokeObjectURL(glbUrl);
                  setGlbUrl(null);
                }}
                className="w-full"
              >
                Reset
              </Button>
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-blue-800 dark:text-blue-200">How AR Works</span>
            </div>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-disc list-inside">
              <li>The mockup image is converted to a 3D plane (like a poster)</li>
              <li>model-viewer displays it with spin/zoom controls</li>
              <li><strong>On phone:</strong> Tap the AR button to place it in your room</li>
              <li>The image appears at real-world scale (~40cm wide)</li>
            </ul>
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h2 className="font-semibold">Production Implementation</h2>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>For production, we would:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Generate GLB files server-side when packets are created</li>
              <li>Store them in Firebase Storage alongside mockups</li>
              <li>Also generate USDZ files for better iOS Quick Look support</li>
              <li>Add AR button to product pages and Store Builder</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
