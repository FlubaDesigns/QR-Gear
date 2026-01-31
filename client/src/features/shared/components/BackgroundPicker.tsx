import { useState, useRef } from "react";
import { ImagePlus, Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/lib/firebase";

export interface BackgroundPickerProps {
  backgroundUrl: string;
  onBackgroundChange: (url: string) => void;
  memberId?: string;
  title?: string;
  subtitle?: string;
}

export function BackgroundPicker({
  backgroundUrl,
  onBackgroundChange,
  memberId,
  title = "Background Image",
  subtitle = "Upload or enter a URL for your background",
}: BackgroundPickerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !memberId) return;

    setIsUploading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/members/${memberId}/assets/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        onBackgroundChange(data.url);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onBackgroundChange(urlInput.trim());
      setUrlInput('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400">{subtitle}</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-600">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ImagePlus className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Background Image</span>
          </div>

          {memberId && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full"
                data-testid="button-upload-background"
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {isUploading ? 'Uploading...' : 'Upload Image'}
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="Or paste image URL..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-slate-700/50 border-slate-600 text-white"
              data-testid="input-background-url"
            />
            <Button onClick={handleUrlSubmit} disabled={!urlInput.trim()}>
              Use
            </Button>
          </div>

          {backgroundUrl && (
            <div className="relative">
              <div className="aspect-video rounded-lg overflow-hidden border border-slate-600">
                <img 
                  src={backgroundUrl} 
                  alt="Selected background" 
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={() => onBackgroundChange('')}
                data-testid="button-clear-background"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
