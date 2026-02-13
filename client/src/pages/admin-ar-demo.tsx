import { useEffect, useState, useRef } from "react";
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
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
            <Box className="h-5 w-5 text-blue-400" />
            AR Demo
          </h1>
          <button
            className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xl"
            onClick={() => navigate("/admin/store-builder")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
            Back to Store Builder
          </button>
        </div>

        <div className="glass-card">
          <div className="flex items-center gap-2 text-base text-blue-200 mb-4">
            <Smartphone className="h-5 w-5" />
            <span>T-Shirt Mockup → 3D Model → AR Preview</span>
          </div>

          {!glbUrl ? (
            <div className="space-y-4">
              <div className="aspect-square w-full bg-slate-800/50 rounded-lg overflow-hidden">
                <img 
                  src={sampleMockupUrl} 
                  alt="T-shirt mockup" 
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                />
              </div>
              
              <button 
                className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xxl"
                onClick={handleGenerateModel} 
                disabled={isGenerating}
                data-testid="button-generate-3d"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Generating 3D Model...
                  </>
                ) : (
                  <>
                    <Box className="h-5 w-5" />
                    Generate 3D Model for AR
                  </>
                )}
              </button>
              
              {error && (
                <p className="text-base text-red-400 text-center">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400 text-base">
                <CheckCircle className="h-5 w-5" />
                <span>3D model generated! Tap the AR button to view in your space.</span>
              </div>
              
              <div className="aspect-square w-full bg-gradient-to-b from-slate-700 to-slate-800 rounded-lg overflow-hidden">
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
              
              <button 
                className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full qr-btn--xl"
                onClick={() => {
                  if (glbUrl) URL.revokeObjectURL(glbUrl);
                  setGlbUrl(null);
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        <div className="glass-card">
          <h2 className="glass-title text-base flex items-center gap-2 mb-3">
            <Smartphone className="h-5 w-5 text-blue-400" />
            How AR Works
          </h2>
          <ul className="text-base text-blue-200 space-y-2 list-disc list-inside">
            <li>The mockup image is converted to a 3D plane</li>
            <li>model-viewer displays it with spin/zoom controls</li>
            <li><strong>On phone:</strong> Tap AR button to place it in your room</li>
            <li>The image appears at real-world scale (~40cm wide)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
