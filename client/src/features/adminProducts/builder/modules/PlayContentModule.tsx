import { useState, useRef, useCallback } from "react";
import { Play, Link2, Upload, CheckSquare, Square, AlertCircle, Video, Image as ImageIcon } from "lucide-react";
import { CollapsibleModule } from "@/features/shared/components/CollapsibleModule";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useBuilderContext } from "../BuilderContext";
import { MediaPreviewView } from "@/features/shared/components/skins/MediaPreviewView";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_TYPES = "video/mp4,video/webm,video/quicktime,image/gif,image/webp";

export function PlayContentModule() {
  const { state, setContent } = useBuilderContext();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    setUploadError(null);
    
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      setUploadError("Please select a video or animated image file");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setContent({
      playMediaFile: file,
      playMediaPreview: objectUrl,
      playMediaMimeType: file.type,
    });
  }, [setContent]);

  if (state.qrProductState !== "qr_play" || !state.selectedProduct || !state.content) {
    return null;
  }

  const handleSourceChange = (source: "url" | "upload") => {
    setContent({
      playMediaSource: source,
      playMediaUrl: "",
      playMediaFile: null,
      playMediaPreview: "",
      playMediaMimeType: "",
    });
    setUploadError(null);
  };

  const handleUrlChange = (url: string) => {
    setContent({ playMediaUrl: url });
    setUploadError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleClearMedia = () => {
    setContent({
      playMediaFile: null,
      playMediaPreview: "",
      playMediaMimeType: "",
      playMediaUrl: "",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePermissionToggle = () => {
    setContent({ playPermissionConfirmed: !state.content.playPermissionConfirmed });
  };

  const hasMedia = state.content.playMediaSource === "url" 
    ? !!state.content.playMediaUrl 
    : !!state.content.playMediaPreview;

  const isVideo = state.content.playMediaMimeType?.startsWith("video/");
  const permissionConfirmed = state.content.playPermissionConfirmed;

  return (
    <CollapsibleModule
      title="Play Media"
      icon={<Play className="h-4 w-4" />}
      className="bg-muted/30"
      defaultOpen
    >
      <div className="space-y-6">
        {/* Step 1: Permission Checkbox - MUST be confirmed first */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Content Rights</p>
          <p className="text-sm text-muted-foreground">
            Before uploading, confirm you have the rights to use this content
          </p>
          
          <div 
            className={`flex items-start gap-3 p-4 rounded-lg cursor-pointer transition-colors ${
              permissionConfirmed 
                ? "bg-green-500/10 border border-green-500/30" 
                : "bg-muted/50 border border-muted-foreground/20"
            }`}
            onClick={handlePermissionToggle}
            data-testid="play-permission-checkbox"
          >
            {permissionConfirmed ? (
              <CheckSquare className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Square className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">
                I confirm I have the rights to use this content
              </p>
              <p className="text-xs text-muted-foreground">
                By checking this box, you confirm that you own the content or have permission to use it commercially.
              </p>
            </div>
          </div>
        </div>

        {/* Step 2: Source Selection - Only shown after permission confirmed */}
        {permissionConfirmed && (
          <>
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm font-medium">Media Source</p>
              <p className="text-sm text-muted-foreground">
                Choose how to provide your video or animated content
              </p>
              
              <div className="grid grid-cols-2 gap-3">
                <Card
                  className={`p-4 cursor-pointer hover-elevate transition-all ${
                    state.content.playMediaSource === "url" ? "ring-2 ring-primary bg-primary/5" : ""
                  }`}
                  onClick={() => handleSourceChange("url")}
                  data-testid="play-source-url"
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Link2 className={`h-6 w-6 ${state.content.playMediaSource === "url" ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-medium text-sm">External URL</p>
                    <p className="text-xs text-muted-foreground">YouTube, Vimeo, etc.</p>
                  </div>
                </Card>
                
                <Card
                  className={`p-4 cursor-pointer hover-elevate transition-all ${
                    state.content.playMediaSource === "upload" ? "ring-2 ring-primary bg-primary/5" : ""
                  }`}
                  onClick={() => handleSourceChange("upload")}
                  data-testid="play-source-upload"
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <Upload className={`h-6 w-6 ${state.content.playMediaSource === "upload" ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="font-medium text-sm">Upload File</p>
                    <p className="text-xs text-muted-foreground">MP4, WebM, GIF (max 100MB)</p>
                  </div>
                </Card>
              </div>
            </div>

            {/* URL Input */}
            {state.content.playMediaSource === "url" && (
              <div className="space-y-2">
                <Label htmlFor="play-media-url" className="flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5" />
                  Video URL
                </Label>
                <Input
                  id="play-media-url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={state.content.playMediaUrl || ""}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="min-h-[44px]"
                  data-testid="input-play-media-url"
                />
                <p className="text-xs text-muted-foreground">
                  Paste a YouTube, Vimeo, or direct video link
                </p>
              </div>
            )}

            {/* File Upload */}
            {state.content.playMediaSource === "upload" && (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileInputChange}
                  className="hidden"
                  data-testid="input-play-file"
                />
                
                {!state.content.playMediaPreview ? (
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    data-testid="play-upload-dropzone"
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium">Drop your file here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      MP4, WebM, MOV, GIF, or WebP (max 100MB)
                    </p>
                    {isUploading && (
                      <p className="text-xs text-primary mt-2">Loading...</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <MediaPreviewView
                      mediaUrl={state.content.playMediaPreview}
                      mimeType={state.content.playMediaMimeType}
                      onClear={handleClearMedia}
                    />
                    <div className="flex items-center gap-1 text-muted-foreground text-xs px-2">
                      {isVideo ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                      <span>{state.content.playMediaFile?.name}</span>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4" />
                    {uploadError}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Status Summary */}
        {hasMedia && permissionConfirmed && (
          <div className="p-3 bg-green-500/10 rounded-md border border-green-500/30">
            <p className="text-sm text-green-700 dark:text-green-400">
              Media ready - Permission confirmed
            </p>
          </div>
        )}
      </div>
    </CollapsibleModule>
  );
}
