import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Link2, Play, Loader2, AlertCircle, Check } from "lucide-react";
import type { PlayVideoSource } from "./wizardTypes";
import { ContentRightsCheckbox } from "@/features/shared/components/ContentRightsCheckbox";

export function PlayVideoSourceStep({
  videoUrl,
  onVideoUrlChange,
  onFileUpload,
  isUploading,
  uploadError,
  uploadProgress,
  uploadSuccess,
  contentRightsConfirmed,
  onContentRightsToggle
}: {
  videoUrl: string;
  onVideoUrlChange: (url: string) => void;
  onFileUpload: (file: File) => void;
  isUploading: boolean;
  uploadError: string | null;
  uploadProgress: number;
  uploadSuccess: boolean;
  contentRightsConfirmed?: boolean;
  onContentRightsToggle?: () => void;
}) {
  const [sourceMode, setSourceMode] = useState<'url' | 'upload'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-2">Add Your Video</h2>
        <p className="text-slate-400">This is what plays when someone scans your QR code</p>
      </div>
      
      <div className="flex gap-2 max-w-sm mx-auto">
        <Button
          variant="outline"
          onClick={() => setSourceMode('upload')}
          className={`flex-1 ${sourceMode === 'upload' ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
          data-testid="button-video-upload-tab"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload
        </Button>
        <Button
          variant="outline"
          onClick={() => setSourceMode('url')}
          className={`flex-1 ${sourceMode === 'url' ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
          data-testid="button-video-url-tab"
        >
          <Link2 className="w-4 h-4 mr-2" />
          Paste URL
        </Button>
      </div>
      
      {sourceMode === 'upload' && (
        <div className="max-w-sm mx-auto space-y-4">
          <div 
            onClick={() => !isUploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isUploading 
                ? 'border-emerald-500 bg-emerald-500/5 cursor-wait' 
                : uploadSuccess && videoUrl 
                  ? 'border-emerald-400 bg-emerald-400/5 cursor-pointer hover:border-emerald-300' 
                  : uploadError
                    ? 'border-red-400 bg-red-400/5 cursor-pointer hover:border-red-300'
                    : 'border-slate-600 cursor-pointer hover:border-emerald-400'
            }`}
            data-testid="dropzone-video-upload"
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-emerald-400 font-medium">Uploading... {uploadProgress}%</p>
                <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Please wait, do not close this page</p>
              </div>
            ) : uploadSuccess && videoUrl ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-emerald-400 font-bold text-lg">Video Uploaded!</p>
                <p className="text-xs text-slate-400">Tap to pick a different video</p>
              </div>
            ) : uploadError ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-red-400 font-medium">Upload Failed</p>
                <p className="text-xs text-slate-400">Tap to try again</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-slate-400" />
                <p className="text-slate-300">Tap to select a video</p>
                <p className="text-xs text-slate-500">MP4, MOV, WebM, or most video formats</p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v,video/3gpp,.mp4,.mov,.webm,.m4v,.3gp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileUpload(file);
            }}
            data-testid="input-video-file"
          />
          {uploadError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3" data-testid="text-upload-error">
              <p className="text-red-400 text-sm text-center">{uploadError}</p>
            </div>
          )}
          <p className="text-xs text-slate-500 text-center">
            50MB limit. For larger videos, use the "Paste URL" option to link it here.
          </p>
        </div>
      )}
      
      {sourceMode === 'url' && (
        <div className="max-w-sm mx-auto space-y-3">
          <input
            type="url"
            placeholder="https://example.com/your-video.mp4"
            value={videoUrl}
            onChange={(e) => onVideoUrlChange(e.target.value)}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
            data-testid="input-video-url"
          />
          <p className="text-xs text-slate-500 text-center">
            Paste a direct link to your video file (MP4, WebM, or MOV)
          </p>
        </div>
      )}

      {(videoUrl || uploadSuccess) && onContentRightsToggle && (
        <div className="max-w-sm mx-auto">
          <ContentRightsCheckbox
            confirmed={contentRightsConfirmed ?? false}
            onToggle={onContentRightsToggle}
            contentType="video"
          />
        </div>
      )}
    </div>
  );
}

export function VideoPlayerWithFallback({ videoUrl, testId, objectFit = 'cover' }: { videoUrl: string; testId: string; objectFit?: 'cover' | 'contain' }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return (
      <div className="text-center p-4 flex flex-col items-center justify-center h-full">
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <p className="text-red-400 text-xs font-medium mb-1">Can't play this video</p>
        <p className="text-slate-500 text-xs">Try uploading an MP4 or MOV file instead</p>
      </div>
    );
  }
  
  return (
    <video
      key={videoUrl}
      src={videoUrl}
      className={`w-full h-full ${objectFit === 'contain' ? 'object-contain' : 'object-cover'}`}
      controls
      playsInline
      preload="auto"
      onError={() => setHasError(true)}
      data-testid={testId}
    />
  );
}

export function PlayPreviewStep({
  videoUrl,
  title
}: {
  videoUrl: string;
  title?: string;
}) {
  const [isLandscape, setIsLandscape] = useState(false);
  
  useEffect(() => {
    const mql = window.matchMedia('(orientation: landscape)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsLandscape(e.matches);
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  
  if (isLandscape && videoUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" data-testid="video-landscape-fullscreen">
        <video
          key={videoUrl}
          src={videoUrl}
          className="w-full h-full object-contain"
          controls
          autoPlay
          playsInline
          preload="auto"
          data-testid="video-preview-player-landscape"
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Preview</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
        <p className="text-slate-500 text-xs mt-1">Tip your phone sideways for fullscreen</p>
      </div>
      
      <div className="flex justify-center">
        <div className="w-44 h-72 bg-black rounded-2xl border-2 border-slate-600 p-1 shadow-xl relative overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center">
            {videoUrl ? (
              <VideoPlayerWithFallback videoUrl={videoUrl} testId="video-preview-player" objectFit="contain" />
            ) : (
              <div className="text-slate-500 text-center p-4">
                <Play className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">No video loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayPublishStep({
  videoUrl,
  isPublishing
}: {
  videoUrl: string;
  isPublishing: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [posterReady, setPosterReady] = useState(false);
  
  useEffect(() => {
    const vid = videoRef.current;
    if (vid && videoUrl) {
      vid.currentTime = 0.5;
      vid.addEventListener('seeked', () => setPosterReady(true), { once: true });
    }
  }, [videoUrl]);
  
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="text-center">
        <h2 className="text-lg font-bold text-white mb-1">Ready to Publish</h2>
        <p className="text-slate-400 text-sm">Your video QR experience is ready to go live</p>
        {isPublishing && (
          <div className="flex items-center justify-center gap-2 mt-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span className="text-emerald-400 text-sm font-medium">Publishing...</span>
          </div>
        )}
      </div>
      
      <div className="flex justify-center">
        <div className="w-44 h-72 bg-black rounded-2xl border-2 border-emerald-500 p-1 shadow-xl shadow-emerald-500/20 relative overflow-hidden">
          <div className="w-full h-full rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center relative">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  playsInline
                  muted
                  preload="auto"
                  data-testid="video-publish-snapshot"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-slate-500 text-center p-4">
                <Play className="w-12 h-12 mx-auto mb-2" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <p className="text-center text-slate-500 text-xs">Tap Next to publish</p>
    </div>
  );
}

export function PlayPublishedStep() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Published!</h2>
        <p className="text-slate-400 mb-2">Your QR Play experience is live.</p>
        <p className="text-emerald-400 text-sm">Video saved to your library.</p>
      </div>
    </div>
  );
}
