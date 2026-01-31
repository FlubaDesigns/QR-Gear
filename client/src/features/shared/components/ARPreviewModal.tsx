import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { X, Camera, ZoomIn, ZoomOut, RotateCcw, Smartphone } from "lucide-react";

interface ARPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  productName?: string;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export function ARPreviewModal({ isOpen, onClose, imageUrl, productName }: ARPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 0.5, rotation: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialScale, setInitialScale] = useState(0.5);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setCameraError(null);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setIsLoading(false);
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access in your browser settings."
          : err.name === "NotFoundError"
          ? "No camera found on this device."
          : "Failed to access camera. Please try again."
      );
      setIsLoading(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setTransform({ x: 0, y: 0, scale: 0.5, rotation: 0 });
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - transform.x, y: e.touches[0].clientY - transform.y });
    } else if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
      setInitialScale(transform.scale);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      }));
    } else if (e.touches.length === 2 && initialPinchDistance !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scaleChange = distance / initialPinchDistance;
      const newScale = Math.max(0.1, Math.min(2, initialScale * scaleChange));
      setTransform(prev => ({ ...prev, scale: newScale }));
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setInitialPinchDistance(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setTransform(prev => ({
        ...prev,
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setTransform(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.1) }));
  };

  const handleZoomOut = () => {
    setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }));
  };

  const handleReset = () => {
    setTransform({ x: 0, y: 0, scale: 0.5, rotation: 0 });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-full h-full w-full p-0 bg-black border-0 rounded-none sm:rounded-none" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>{productName || "AR Preview"}</DialogTitle>
        </VisuallyHidden>
        <div 
          ref={containerRef}
          className="relative w-full h-full overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center text-white">
                <Camera className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                <p className="text-lg">Starting camera...</p>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
              <div className="text-center text-white p-6 max-w-md">
                <Smartphone className="h-12 w-12 mx-auto mb-4 text-amber-400" />
                <p className="text-lg mb-4">{cameraError}</p>
                <Button onClick={startCamera} variant="outline" className="mr-2">
                  Try Again
                </Button>
                <Button onClick={onClose} variant="ghost">
                  Close
                </Button>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            data-testid="ar-camera-feed"
          />

          {stream && !cameraError && (
            <div
              className="absolute pointer-events-none select-none"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
                transition: isDragging ? "none" : "transform 0.1s ease-out",
              }}
            >
              <img
                src={imageUrl}
                alt={productName || "Product preview"}
                className="max-w-[80vw] max-h-[60vh] rounded-lg shadow-2xl"
                draggable={false}
                data-testid="ar-product-overlay"
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-20 bg-black/50 text-white hover:bg-black/70 rounded-full"
            onClick={onClose}
            data-testid="button-close-ar"
          >
            <X className="h-6 w-6" />
          </Button>

          {stream && !cameraError && (
            <>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full h-10 w-10"
                  onClick={handleZoomOut}
                  data-testid="button-ar-zoom-out"
                >
                  <ZoomOut className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full h-10 w-10"
                  onClick={handleReset}
                  data-testid="button-ar-reset"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full h-10 w-10"
                  onClick={handleZoomIn}
                  data-testid="button-ar-zoom-in"
                >
                  <ZoomIn className="h-5 w-5" />
                </Button>
              </div>

              <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
                <p className="text-white text-sm text-center">
                  Drag to move • Pinch to zoom
                </p>
              </div>

              {productName && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-4 py-2">
                  <p className="text-white text-sm font-medium">{productName}</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
