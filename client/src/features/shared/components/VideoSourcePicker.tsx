import { useState, useRef } from "react";
import { Upload, Link2, Play, X, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { memberFetch } from "@/lib/memberFetch";

export type VideoSourceType = "upload" | "external";

export interface VideoSource {
  type: VideoSourceType;
  videoUrl?: string;
  externalUrl?: string;
  posterUrl?: string;
  duration?: number;
  mimeType?: string;
  fileName?: string;
  platform?: "youtube" | "vimeo" | "direct" | "other";
}

interface VideoSourcePickerProps {
  memberId: string;
  value: VideoSource | null;
  onChange: (source: VideoSource | null) => void;
  onError?: (error: string) => void;
  className?: string;
}

function detectPlatform(url: string): VideoSource["platform"] {
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  if (url.match(/\.(mp4|webm|mov)$/i)) return "direct";
  return "other";
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match ? match[1] : null;
}

export function VideoSourcePicker({
  memberId,
  value,
  onChange,
  onError,
  className
}: VideoSourcePickerProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "link">(value?.type === "external" ? "link" : "upload");
  const [uploading, setUploading] = useState(false);
  const [externalUrl, setExternalUrl] = useState(value?.externalUrl || "");
  const [posterUrl, setPosterUrl] = useState(value?.posterUrl || "");
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      onError?.("Please select a valid video file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      onError?.("Video must be under 100MB");
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const videoData = await base64Promise;

      const data = await memberFetch<any>(`/${memberId}/videos/upload`, {
        method: "POST",
        json: {
          videoData,
          mimeType: file.type,
          fileName: file.name
        }
      });

      onChange({
        type: "upload",
        videoUrl: data.videoUrl,
        posterUrl: data.posterUrl || posterUrl,
        duration: data.duration,
        mimeType: file.type,
        fileName: file.name
      });
    } catch (err: any) {
      onError?.(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handlePosterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onError?.("Please select a valid image file");
      return;
    }

    setUploadingPoster(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const imageData = await base64Promise;

      const data = await memberFetch<any>(`/${memberId}/library/upload`, {
        method: "POST",
        json: {
          assetType: "poster",
          name: `poster-${Date.now()}`,
          imageData,
          mimeType: file.type,
          originalName: file.name
        }
      });
      
      setPosterUrl(data.asset.publicUrl);
      
      if (value) {
        onChange({ ...value, posterUrl: data.asset.publicUrl });
      }
    } catch (err: any) {
      onError?.(err.message || "Poster upload failed");
    } finally {
      setUploadingPoster(false);
    }
  }

  function handleExternalLink() {
    if (!externalUrl.trim()) {
      onError?.("Please enter a video URL");
      return;
    }

    const platform = detectPlatform(externalUrl);
    let derivedPosterUrl = posterUrl;

    if (platform === "youtube") {
      const videoId = getYouTubeId(externalUrl);
      if (videoId && !posterUrl) {
        derivedPosterUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    onChange({
      type: "external",
      externalUrl: externalUrl.trim(),
      posterUrl: derivedPosterUrl || undefined,
      platform
    });
  }

  function handleClear() {
    onChange(null);
    setExternalUrl("");
    setPosterUrl("");
  }

  if (value) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-start gap-4">
          <div className="relative w-32 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
            {value.posterUrl ? (
              <img src={value.posterUrl} alt="Video poster" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <Badge className="absolute bottom-1 right-1 text-xs" variant="secondary">
              {value.type === "upload" ? "Uploaded" : value.platform || "Link"}
            </Badge>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {value.type === "upload" ? (
                <p className="text-sm font-medium truncate">{value.fileName || "Uploaded video"}</p>
              ) : (
                <p className="text-sm font-medium truncate flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {value.platform === "youtube" && "YouTube Video"}
                  {value.platform === "vimeo" && "Vimeo Video"}
                  {value.platform === "direct" && "Direct Link"}
                  {value.platform === "other" && "External Video"}
                </p>
              )}
            </div>
            
            {value.duration && (
              <p className="text-xs text-muted-foreground mt-1">
                Duration: {Math.floor(value.duration / 60)}:{String(value.duration % 60).padStart(2, "0")}
              </p>
            )}

            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => posterInputRef.current?.click()}
                disabled={uploadingPoster}
                data-testid="btn-change-poster"
              >
                {uploadingPoster ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                {value.posterUrl ? "Change Poster" : "Add Poster"}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClear} data-testid="btn-remove-video">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <input
          ref={posterInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePosterUpload}
        />
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "link")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload MP4
          </TabsTrigger>
          <TabsTrigger value="link" data-testid="tab-link">
            <Link2 className="w-4 h-4 mr-2" />
            External Link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-4 space-y-4">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              "hover:border-primary hover:bg-primary/5",
              uploading && "pointer-events-none opacity-50"
            )}
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-dropzone"
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 mx-auto text-primary animate-spin" />
            ) : (
              <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
            )}
            <p className="mt-2 text-sm font-medium">
              {uploading ? "Uploading..." : "Click to upload video"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">MP4, WebM, MOV up to 100MB</p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={handleVideoUpload}
          />
        </TabsContent>

        <TabsContent value="link" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="external-url">Video URL</Label>
            <Input
              id="external-url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or video.mp4 link"
              data-testid="input-external-url"
            />
            <p className="text-xs text-muted-foreground">
              YouTube, Vimeo, or direct video links supported
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="poster-url">Poster Image (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="poster-url"
                value={posterUrl}
                onChange={(e) => setPosterUrl(e.target.value)}
                placeholder="Auto-detected for YouTube/Vimeo"
                className="flex-1"
                data-testid="input-poster-url"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => posterInputRef.current?.click()}
                disabled={uploadingPoster}
                data-testid="btn-upload-poster"
              >
                {uploadingPoster ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={handleExternalLink}
            disabled={!externalUrl.trim()}
            data-testid="btn-use-link"
          >
            <Play className="w-4 h-4 mr-2" />
            Use This Video
          </Button>

          <input
            ref={posterInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePosterUpload}
          />

          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>External videos open in their native player. You won't host the video, saving storage costs.</span>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
