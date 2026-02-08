import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode,
  Check,
  Upload,
  ImagePlus,
  Play,
  Sparkles,
  Library,
  Smartphone,
  ArrowRight,
  ShoppingBag,
  Crop,
  ChevronLeft,
  Loader2,
  Send,
  User,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { CropUtility } from "../utilities/CropUtility";
import type {
  QRCanvasSaveOption,
  LibraryChoice,
  BackgroundSubStep,
  QRType,
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

export function QRCanvasExplainerStep({
  onUploadClick,
  onLibraryClick
}: {
  onUploadClick: () => void;
  onLibraryClick: () => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">Create Your Landing Page</h2>
        <p className="text-slate-400">When someone scans your QR code, they'll see a beautiful page you design</p>
      </div>
      
      <div className="flex justify-center py-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <QrCode className="w-12 h-12 text-slate-800" />
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-slate-500 whitespace-nowrap">
              Your QR Code
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="w-8 h-8 text-emerald-400 animate-pulse" />
            <Smartphone className="w-6 h-6 text-slate-400" />
          </div>
          
          <div className="relative group">
            <div className="w-32 h-56 bg-gradient-to-b from-slate-700 to-slate-800 rounded-2xl border-2 border-emerald-400 shadow-lg shadow-emerald-400/30 p-2 flex flex-col items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-blue-600/30 rounded-xl flex flex-col items-center justify-center gap-2">
                <ImagePlus className="w-8 h-8 text-white/60" />
                <span className="text-xs text-white/80 text-center px-2">Your favorite picture</span>
              </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-emerald-400 whitespace-nowrap font-medium">
              Landing Page
            </div>
          </div>
        </div>
      </div>
      
      <div className="text-center text-slate-300 text-sm max-w-md mx-auto mt-8">
        Pick your favorite photo, memory, or design. It becomes what people see when they scan.
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
        <Button
          onClick={onUploadClick}
          size="lg"
          className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/30 px-8"
          data-testid="button-upload-new"
        >
          <Upload className="w-5 h-5 mr-2" />
          Upload New
        </Button>
        <Button
          onClick={onLibraryClick}
          size="lg"
          variant="outline"
          className="border-slate-500 text-slate-300 hover:bg-slate-700 px-8"
          data-testid="button-pick-library"
        >
          <Library className="w-5 h-5 mr-2" />
          Pick from Library
        </Button>
      </div>
    </div>
  );
}

export function UrlSourceChoiceStep({
  choice,
  onChoiceChange
}: {
  choice: LibraryChoice;
  onChoiceChange: (choice: LibraryChoice) => void;
}) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">Choose Image Source</h2>
        <p className="text-slate-400">Pick from ready-to-use cropped images or browse raw backgrounds</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto mt-6">
        <button
          onClick={() => onChoiceChange('personal')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
            choice === 'personal'
              ? 'border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
          }`}
          data-testid="button-cropped-library"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              choice === 'personal' ? 'bg-emerald-500' : 'bg-slate-700'
            }`}>
              <Crop className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">Cropped Library</span>
          </div>
          <p className="text-sm text-slate-400">Your saved 9:16 cropped images - ready to use</p>
        </button>
        
        <button
          onClick={() => onChoiceChange('common')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 text-left ${
            choice === 'common'
              ? 'border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
              : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
          }`}
          data-testid="button-raw-library"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              choice === 'common' ? 'bg-emerald-500' : 'bg-slate-700'
            }`}>
              <Library className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-white">Raw Background Library</span>
          </div>
          <p className="text-sm text-slate-400">Browse backgrounds - you'll crop to 9:16</p>
        </button>
      </div>
    </div>
  );
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

export function QRCanvasSaveChoiceStep({
  selected,
  onSelect
}: {
  selected: QRCanvasSaveOption;
  onSelect: (choice: QRCanvasSaveOption) => void;
}) {
  const options: { id: QRCanvasSaveOption; label: string; description: string; icon: React.ReactNode }[] = [
    { id: 'item', label: 'Save Product Graphic', description: 'Save the graphic that goes on the shirt/product', icon: <ShoppingBag className="w-8 h-8" /> },
    { id: 'landing', label: 'Save Landing Page', description: 'Save the background image for the QR landing page', icon: <ImagePlus className="w-8 h-8" /> },
    { id: 'all', label: 'Save Everything', description: 'Save product graphic, landing page, and QR code', icon: <Library className="w-8 h-8" /> },
  ];
  
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-600/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Published Successfully!</h2>
        <p className="text-slate-400">Would you like to save anything to your library?</p>
      </div>
      
      <div className="grid gap-3 max-w-md mx-auto">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onSelect(option.id)}
            className={`p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
              selected === option.id
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
            }`}
            data-testid={`button-canvas-save-${option.id}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              selected === option.id ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300'
            }`}>
              {option.icon}
            </div>
            <div>
              <div className="font-semibold text-white">{option.label}</div>
              <div className="text-sm text-slate-400">{option.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function QRCanvasConfirmStep({
  saveChoice,
  productGraphicUrl,
  backgroundUrl,
  qrGraphicUrl,
  isSaving,
  onDone
}: {
  saveChoice: QRCanvasSaveOption;
  productGraphicUrl: string | null;
  backgroundUrl: string | null;
  qrGraphicUrl: string | null;
  isSaving: boolean;
  onDone: () => void;
}) {
  const getMessage = () => {
    switch (saveChoice) {
      case 'item':
        return { title: 'Product Graphic Saved!', description: 'The graphic for your product has been saved to your library.' };
      case 'landing':
        return { title: 'Landing Page Saved!', description: 'Your landing page background has been saved to your library.' };
      case 'all':
        return { title: 'Everything Saved!', description: 'Your product graphic, landing page, and QR code have been saved to your library.' };
      default:
        return { title: 'Done!', description: 'Your creation is ready.' };
    }
  };
  
  const message = getMessage();
  
  return (
    <div className="text-center space-y-6">
      <div>
        <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{message.title}</h2>
        <p className="text-slate-400">{message.description}</p>
      </div>
      
      <div className="flex flex-wrap justify-center gap-4 max-w-md mx-auto">
        {(saveChoice === 'item' || saveChoice === 'all') && productGraphicUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={productGraphicUrl} alt="Product graphic" className="w-28 h-28 object-contain mx-auto mb-2" />
            <p className="text-xs text-slate-400">Product Graphic</p>
          </div>
        )}
        {(saveChoice === 'landing' || saveChoice === 'all') && backgroundUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={backgroundUrl} alt="Landing page" className="w-28 h-28 object-cover rounded mx-auto mb-2" />
            <p className="text-xs text-slate-400">Landing Page</p>
          </div>
        )}
        {saveChoice === 'all' && qrGraphicUrl && (
          <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
            <img src={qrGraphicUrl} alt="QR Code" className="w-28 h-28 object-contain mx-auto mb-2 bg-white rounded" />
            <p className="text-xs text-slate-400">QR Code</p>
          </div>
        )}
      </div>
      
      <Button
        onClick={onDone}
        disabled={isSaving}
        className="px-8 py-4 bg-green-600 hover:bg-green-700 text-lg"
        data-testid="button-canvas-done"
      >
        {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
        Done
      </Button>
    </div>
  );
}

export function DetailsStep({ 
  title, 
  description,
  onTitleChange,
  onDescriptionChange
}: { 
  title: string;
  description: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-lg font-bold text-white mb-2">Add Your Details</h2>
        <p className="text-slate-400">Give your creation a title and description</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        <div className="space-y-2">
          <Label htmlFor="simple-title" className="text-white text-lg">Title</Label>
          <Input
            id="simple-title"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="My Awesome Creation"
            className="bg-slate-700 border-slate-600 text-white text-lg h-14"
            data-testid="input-simple-title"
          />
          <p className="text-slate-500 text-sm">This appears when people scan your QR code</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="simple-description" className="text-white text-lg">Description (optional)</Label>
          <textarea
            id="simple-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Tell people what this is about..."
            rows={4}
            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-3 resize-none focus:border-blue-500 outline-none"
            data-testid="input-simple-description"
          />
        </div>
      </div>
    </div>
  );
}

export function SimplePreviewStep({ 
  background,
  title,
  description,
  titleVertical,
  titleHorizontal,
  titleColor,
  titleSize,
  titleFont,
  descVertical,
  descHorizontal,
  descColor,
  descSize,
  descFont,
  onGoBack
}: { 
  background: string;
  title: string;
  description?: string;
  titleVertical: number;
  titleHorizontal: number;
  titleColor: string;
  titleSize: string;
  titleFont: string;
  descVertical: number;
  descHorizontal: number;
  descColor: string;
  descSize: string;
  descFont: string;
  onGoBack: () => void;
}) {
  return (
    <div className="text-center space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Your Landing Page</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
      </div>

      <div className="flex justify-center py-2">
        <div className="relative w-44 h-72 rounded-3xl border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
          
          <div className="w-full h-full relative">
            {background ? (
              <img 
                src={background} 
                alt="Background" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900" />
            )}
            
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
              
              {title && (
                <div
                  className="absolute w-full px-2 text-center"
                  style={{
                    bottom: `${titleVertical}%`,
                    left: `${titleHorizontal - 50}%`
                  }}
                >
                  <h3
                    className="font-bold truncate drop-shadow-lg"
                    style={{
                      color: titleColor,
                      fontSize: titleSize,
                      fontFamily: titleFont
                    }}
                  >
                    {title}
                  </h3>
                </div>
              )}
              {description && (
                <div
                  className="absolute w-full px-2 text-center"
                  style={{
                    bottom: `${descVertical}%`,
                    left: `${descHorizontal - 50}%`
                  }}
                >
                  <p
                    className="line-clamp-2 drop-shadow-lg"
                    style={{
                      color: descColor,
                      fontSize: descSize,
                      fontFamily: descFont
                    }}
                  >
                    {description}
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        onClick={onGoBack}
        className="mt-4"
        data-testid="button-preview-change"
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        Make Changes
      </Button>
    </div>
  );
}

export function SimplePublishStep({ 
  isPublishing,
  onPublish,
  title,
  description,
  qrType,
  background,
  titleVertical,
  titleHorizontal,
  titleColor,
  titleSize,
  titleFont,
  descVertical,
  descHorizontal,
  descColor,
  descSize,
  descFont
}: { 
  isPublishing: boolean;
  onPublish: () => void;
  title: string;
  description?: string;
  qrType: QRType;
  background: string;
  titleVertical: number;
  titleHorizontal: number;
  titleColor: string;
  titleSize: string;
  titleFont: string;
  descVertical: number;
  descHorizontal: number;
  descColor: string;
  descSize: string;
  descFont: string;
}) {
  const typeLabel = qrType === 'qr-canvas' ? 'Image Post' : qrType === 'qr-play' ? 'Video Post' : 'Creation';
  
  return (
    <div className="text-center">
      <div className="mb-4">
        <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-600/20 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-green-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Ready to Publish!</h2>
        <p className="text-slate-400 text-sm">Your {typeLabel.toLowerCase()} is ready to share</p>
      </div>

      <div className="flex justify-center mb-4">
        <div className="relative w-44 h-72 rounded-3xl border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
          
          <div className="w-full h-full relative">
            {background ? (
              <img 
                src={background} 
                alt="Background" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                {qrType === 'qr-play' ? <Play className="w-8 h-8 text-slate-500" /> : <ImagePlus className="w-8 h-8 text-slate-500" />}
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
            {title && (
              <div
                className="absolute w-full px-2 text-center"
                style={{
                  bottom: `${titleVertical}%`,
                  left: `${titleHorizontal - 50}%`
                }}
              >
                <h3
                  className="font-bold truncate drop-shadow-lg"
                  style={{
                    color: titleColor,
                    fontSize: titleSize,
                    fontFamily: titleFont
                  }}
                >
                  {title}
                </h3>
              </div>
            )}
            
            {description && (
              <div
                className="absolute w-full px-2 text-center"
                style={{
                  bottom: `${descVertical}%`,
                  left: `${descHorizontal - 50}%`
                }}
              >
                <p
                  className="drop-shadow-md line-clamp-2"
                  style={{
                    color: descColor,
                    fontSize: descSize,
                    fontFamily: descFont
                  }}
                >
                  {description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-slate-400 text-xs mb-4">{typeLabel}</p>

      <Button
        size="lg"
        onClick={onPublish}
        disabled={isPublishing || !title.trim()}
        className="bg-green-600 hover:bg-green-700 text-white px-12 py-6 text-lg"
        data-testid="button-simple-publish"
      >
        {isPublishing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Publishing...
          </>
        ) : (
          <>
            <Send className="w-5 h-5 mr-2" />
            Publish Now
          </>
        )}
      </Button>

      {!title.trim() && (
        <p className="text-amber-400 text-sm mt-4">Please add a title before publishing</p>
      )}
    </div>
  );
}
