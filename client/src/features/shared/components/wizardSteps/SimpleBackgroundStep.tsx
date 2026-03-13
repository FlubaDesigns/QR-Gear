import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Check,
  Upload,
  ImagePlus,
  Library,
  Crop,
  ChevronLeft,
  Loader2,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { CropUtility } from "../utilities/CropUtility";
import type {
  BackgroundSubStep,
} from "./wizardTypes";

interface LibraryAsset {
  id: string;
  name: string;
  assetType: string;
  mediaType: string;
  thumbnailUrl: string;
  publicUrl: string;
  width?: number | null;
  height?: number | null;
  isCropped?: boolean;
}

interface SimpleBackgroundStepProps {
  memberId: string;
  background: string;
  onBackgroundSelected: (croppedUrl: string, originalUrl: string, needsCrop: boolean) => void;
  onComplete: () => void;
  initialSubStep?: BackgroundSubStep;
  croppedOnly?: boolean;
}

export function SimpleBackgroundStep({ 
  memberId, 
  background,
  onBackgroundSelected,
  onComplete,
  initialSubStep = 'choice',
  croppedOnly = false
}: SimpleBackgroundStepProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subStep, setSubStep] = useState<BackgroundSubStep>(initialSubStep);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null);
  const [showCrop, setShowCrop] = useState(false);

  const { data: personalAssets = [], isLoading: loadingPersonal, refetch: refetchPersonal } = useQuery<LibraryAsset[]>({
    queryKey: ['/api/members', memberId, 'library', 'background'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/members/${memberId}/library?assetType=background`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.assets || [];
    },
    enabled: !!memberId && (subStep === 'personal-library')
  });

  const { data: commonAssets = [], isLoading: loadingCommon } = useQuery<LibraryAsset[]>({
    queryKey: ['/api/members/common-library', 'background'],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/members/common-library?assetType=background`, { headers });
      if (!res.ok) return [];
      const data = await res.json();
      return data.assets || [];
    },
    enabled: subStep === 'common-library'
  });

  const isAlready916 = (asset: LibraryAsset): boolean => {
    if (asset.isCropped) return true;
    if (asset.width && asset.height) {
      const ratio = asset.width / asset.height;
      const target = 9 / 16;
      return Math.abs(ratio - target) < 0.05;
    }
    return false;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const imageData = await base64Promise;
      clearInterval(progressInterval);
      setUploadProgress(95);

      if (!memberId) {
        setUploadProgress(100);
        const tempAsset = {
          id: `temp-${Date.now()}`,
          publicUrl: imageData,
          name: file.name,
          width: 0,
          height: 0,
          isCropped: false,
        };
        setSelectedAsset(tempAsset as any);
        onBackgroundSelected(imageData, imageData, false);
        onComplete();
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token 
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } 
        : { 'Content-Type': 'application/json' };

      const res = await fetch(`/api/members/${memberId}/library/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assetType: 'background',
          name: file.name,
          imageData,
          mimeType: file.type,
          originalName: file.name
        })
      });

      setUploadProgress(100);

      if (!res.ok) throw new Error('Upload failed');
      
      const data = await res.json();
      if (data.asset) {
        setSelectedAsset(data.asset);
        if (isAlready916(data.asset)) {
          onBackgroundSelected(data.asset.publicUrl, data.asset.publicUrl, false);
          onComplete();
        } else {
          setSubStep('full-or-crop');
        }
      }
    } catch (error) {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAssetSelect = (asset: LibraryAsset) => {
    setSelectedAsset(asset);
    if (croppedOnly || isAlready916(asset)) {
      onBackgroundSelected(asset.publicUrl, asset.publicUrl, false);
      onComplete();
    } else {
      setSubStep('full-or-crop');
    }
  };

  const handleUseFullImage = () => {
    if (selectedAsset) {
      onBackgroundSelected(selectedAsset.publicUrl, selectedAsset.publicUrl, false);
      onComplete();
    }
  };
  
  const filteredPersonalAssets = croppedOnly 
    ? personalAssets.filter(asset => isAlready916(asset))
    : personalAssets;

  const handleCropComplete = async (croppedDataUrl: string) => {
    const originalUrl = selectedAsset?.publicUrl || '';
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: HeadersInit = token 
        ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } 
        : { 'Content-Type': 'application/json' };

      let savedOriginalId = selectedAsset?.id;

      if (selectedAsset && !selectedAsset.id?.startsWith('member-')) {
        try {
          const originalResponse = await fetch(selectedAsset.publicUrl);
          const originalBlob = await originalResponse.blob();
          const originalBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(originalBlob);
          });

          const origRes = await fetch(`/api/members/${memberId}/library/upload`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              assetType: 'background',
              name: selectedAsset.name || 'Background',
              imageData: originalBase64,
              mimeType: 'image/jpeg',
              originalName: selectedAsset.name || 'background.jpg',
              isCropped: false
            })
          });

          if (origRes.ok) {
            const origData = await origRes.json();
            savedOriginalId = origData.asset?.id;
            console.log('[Crop] Saved original background to library:', origData.asset?.publicUrl);
          }
        } catch (origError) {
          console.error('[Crop] Could not save original, continuing with crop:', origError);
        }
      }

      const res = await fetch(`/api/members/${memberId}/library/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assetType: 'background',
          name: `${selectedAsset?.name || 'Image'} (cropped)`,
          imageData: croppedDataUrl,
          mimeType: 'image/png',
          originalName: selectedAsset?.name || 'cropped-image.png',
          isCropped: true,
          originalAssetId: savedOriginalId
        })
      });

      if (res.ok) {
        const data = await res.json();
        const savedUrl = data.asset?.publicUrl || croppedDataUrl;
        console.log('[Crop] Saved cropped image to library:', savedUrl);
        onBackgroundSelected(savedUrl, originalUrl, true);
        refetchPersonal();
      } else {
        console.error('[Crop] Failed to save cropped image, using data URL');
        onBackgroundSelected(croppedDataUrl, originalUrl, true);
      }
    } catch (error) {
      console.error('[Crop] Error saving images:', error);
      onBackgroundSelected(croppedDataUrl, originalUrl, true);
    }
    
    setShowCrop(false);
    onComplete();
  };

  const fetchImageBlob = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  };

  return (
    <div className="space-y-6">
      {subStep === 'choice' && (
        <div className="text-center space-y-8">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Add Your Background</h2>
            <p className="text-slate-400">Every great QR Canvas needs an image</p>
          </div>

          <div className="max-w-sm mx-auto space-y-4">
            <p className="text-lg text-white font-medium">Would you like to upload a new image?</p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-20 text-lg bg-green-600 hover:bg-green-700"
                onClick={() => setSubStep('upload')}
                data-testid="button-bg-upload-yes"
              >
                <Upload className="w-6 h-6 mr-2" />
                Yes
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 text-lg"
                onClick={() => setSubStep('library-choice')}
                data-testid="button-bg-upload-no"
              >
                <Library className="w-6 h-6 mr-2" />
                No
              </Button>
            </div>
          </div>
        </div>
      )}

      {subStep === 'upload' && (
        <div className="text-center space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Upload Your Image</h2>
            <p className="text-slate-400">Choose a photo from your device</p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
            data-testid="input-bg-file"
          />

          {isUploading ? (
            <div className="max-w-sm mx-auto space-y-4">
              <div className="w-24 h-24 mx-auto rounded-full bg-slate-700 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-green-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-slate-400 text-sm">{uploadProgress}% uploaded</p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-sm mx-auto h-48 border-2 border-dashed border-slate-600 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-green-500 hover:bg-green-500/10 transition-all cursor-pointer"
              data-testid="button-bg-upload-trigger"
            >
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center">
                <Upload className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="font-medium text-white text-lg">Tap to upload</p>
                <p className="text-sm text-slate-400">JPG, PNG, or GIF</p>
              </div>
            </button>
          )}

          <Button
            variant="ghost"
            className="text-slate-400"
            onClick={() => setSubStep('choice')}
            data-testid="button-bg-upload-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Go Back
          </Button>
        </div>
      )}

      {subStep === 'library-choice' && (
        <div className="text-center space-y-8">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Pick From Library</h2>
            <p className="text-slate-400">Choose from your saved images or browse common backgrounds</p>
          </div>

          <div className="max-w-sm mx-auto space-y-4">
            <p className="text-lg text-white font-medium">Use your personal library?</p>
            
            <div className="grid grid-cols-2 gap-4">
              <Button
                size="lg"
                className="h-20 text-lg bg-blue-600 hover:bg-blue-700"
                onClick={() => setSubStep('personal-library')}
                data-testid="button-bg-personal-yes"
              >
                <User className="w-6 h-6 mr-2" />
                Yes
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-20 text-lg"
                onClick={() => setSubStep('common-library')}
                data-testid="button-bg-personal-no"
              >
                <Library className="w-6 h-6 mr-2" />
                Common
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            className="text-slate-400"
            onClick={() => setSubStep('choice')}
            data-testid="button-bg-library-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Go Back
          </Button>
        </div>
      )}

      {subStep === 'personal-library' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-2">
              {croppedOnly ? "Your Cropped Images" : "Your Library"}
            </h2>
            <p className="text-slate-400">
              {croppedOnly ? "Ready to use - no cropping needed" : "Select an image to use"}
            </p>
          </div>

          {loadingPersonal ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : filteredPersonalAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                <ImagePlus className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">
                {croppedOnly ? "No cropped images yet - crop some from the raw library first" : "No images in your library yet"}
              </p>
              <Button onClick={() => setSubStep('upload')} data-testid="button-bg-upload-instead">
                <Upload className="w-4 h-4 mr-2" />
                Upload One
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {filteredPersonalAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetSelect(asset)}
                  className="aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-600 hover:border-blue-500 transition-all relative group"
                  data-testid={`button-bg-asset-${asset.id}`}
                >
                  <img 
                    src={asset.thumbnailUrl || asset.publicUrl} 
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  {isAlready916(asset) && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium text-sm">Select</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="text-slate-400"
              onClick={() => setSubStep('library-choice')}
              data-testid="button-bg-personal-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
          </div>
        </div>
      )}

      {subStep === 'common-library' && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-white mb-2">Common Library</h2>
            <p className="text-slate-400">Select from curated backgrounds</p>
          </div>

          {loadingCommon ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : commonAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
                <Library className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400 mb-4">No common backgrounds available</p>
              <Button onClick={() => setSubStep('upload')} data-testid="button-bg-upload-common">
                <Upload className="w-4 h-4 mr-2" />
                Upload Your Own
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {commonAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => handleAssetSelect(asset)}
                  className="aspect-[9/16] rounded-lg overflow-hidden border-2 border-slate-600 hover:border-purple-500 transition-all relative group"
                  data-testid={`button-bg-common-${asset.id}`}
                >
                  <img 
                    src={asset.thumbnailUrl || asset.publicUrl} 
                    alt={asset.name}
                    className="w-full h-full object-cover"
                  />
                  {isAlready916(asset) && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium text-sm">Select</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="text-slate-400"
              onClick={() => setSubStep('library-choice')}
              data-testid="button-bg-common-back"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
          </div>
        </div>
      )}

      {subStep === 'full-or-crop' && selectedAsset && (
        <div className="text-center space-y-6 animate-in fade-in duration-500">
          <div>
            <h2 className="text-lg font-bold text-white mb-2">Use Full Image or Crop?</h2>
            <p className="text-slate-400">You can use your image as-is, or crop it to fit a 9:16 mobile screen</p>
          </div>

          <div className="max-w-xs mx-auto">
            <div className="aspect-[9/16] max-h-48 rounded-lg overflow-hidden border-2 border-slate-600 mx-auto w-fit">
              <img
                src={selectedAsset.thumbnailUrl || selectedAsset.publicUrl}
                alt={selectedAsset.name}
                className="h-full w-auto object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-8"
              onClick={handleUseFullImage}
              data-testid="button-use-full-image"
            >
              <ImagePlus className="w-5 h-5 mr-2" />
              Use Full Image
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-slate-500 text-slate-300 px-8"
              onClick={() => setShowCrop(true)}
              data-testid="button-crop-image"
            >
              <Crop className="w-5 h-5 mr-2" />
              Crop It
            </Button>
          </div>

          <Button
            variant="ghost"
            className="text-slate-400"
            onClick={() => {
              setSelectedAsset(null);
              setSubStep('choice');
            }}
            data-testid="button-full-or-crop-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Pick a Different Image
          </Button>
        </div>
      )}

      {showCrop && selectedAsset && (
        <CropUtility
          asset={{
            id: selectedAsset.id,
            name: selectedAsset.name,
            imageUrl: selectedAsset.publicUrl
          }}
          open={showCrop}
          onOpenChange={(open) => {
            setShowCrop(open);
            if (!open) setSelectedAsset(null);
          }}
          onCropComplete={handleCropComplete}
          fetchImageBlob={fetchImageBlob}
          aspectRatio={9 / 16}
          title="Crop for Mobile Screen"
          allowCropToggle={false}
        />
      )}
    </div>
  );
}
