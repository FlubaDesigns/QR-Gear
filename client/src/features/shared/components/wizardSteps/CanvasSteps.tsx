import { useState, useRef, useMemo } from "react";
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
import { useLandingPagePreview } from "@/hooks/useLandingPagePreview";
import { CropUtility } from "../utilities/CropUtility";
import type {
  QRCanvasSaveOption,
  LibraryChoice,
  BackgroundSubStep,
  QRType,
} from "./wizardTypes";

export { SimpleBackgroundStep } from "./SimpleBackgroundStep";

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
  const titleStyle = useMemo(() => title ? {
    text: title,
    enabled: true,
    fontFamily: titleFont,
    fontSize: titleSize,
    color: titleColor,
    verticalOffset: titleVertical,
    horizontalOffset: titleHorizontal,
  } : null, [title, titleFont, titleSize, titleColor, titleVertical, titleHorizontal]);

  const descriptionStyle = useMemo(() => description ? {
    text: description,
    enabled: true,
    fontFamily: descFont,
    fontSize: descSize,
    color: descColor,
    verticalOffset: descVertical,
    horizontalOffset: descHorizontal,
  } : null, [description, descFont, descSize, descColor, descVertical, descHorizontal]);

  const { dataUrl, isLoading } = useLandingPagePreview({
    backgroundUrl: background || null,
    titleStyle,
    descriptionStyle,
    enabled: true,
    debounceMs: 200,
  });

  return (
    <div className="text-center space-y-4">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Your Landing Page</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
      </div>

      <div className="flex justify-center py-2">
        <div className="relative w-44 h-72 rounded-3xl border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
          
          <div className="w-full h-full flex items-center justify-center">
            {dataUrl ? (
              <img 
                src={dataUrl} 
                alt="Landing page preview" 
                className="w-full h-full object-contain"
                data-testid="img-simple-preview"
              />
            ) : isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900" />
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
                  left: `${(titleHorizontal - 50) * 0.2}%`
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
                  left: `${(descHorizontal - 50) * 0.2}%`
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
