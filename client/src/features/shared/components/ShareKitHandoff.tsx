import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  Copy, 
  Download, 
  ExternalLink, 
  QrCode, 
  Share2,
  Plus,
  Image,
  Mail,
  MessageCircle
} from "lucide-react";
import { SiFacebook, SiLinkedin, SiWhatsapp } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";

export interface ShareKitData {
  packetId: string;
  shareUrl: string;
  qrImageUrl?: string;
  previewUrl?: string;
  compositeUrl?: string;
  channelName?: string;
  title?: string;
  description?: string;
  shareImageSquareUrl?: string;
  shareImageLinkUrl?: string;
  shareCaption?: string;
}

interface ShareKitHandoffProps {
  data: ShareKitData;
  onCreateAnother?: () => void;
  onViewLibrary?: () => void;
  onRegenerateAssets?: () => void;
  baseUrl?: string;
  showAdminControls?: boolean;
}

export function ShareKitHandoff({
  data,
  onCreateAnother,
  onViewLibrary,
  onRegenerateAssets,
  baseUrl = "",
  showAdminControls = false
}: ShareKitHandoffProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fullShareUrl = data.shareUrl.startsWith("http") 
    ? data.shareUrl 
    : `${baseUrl || window.location.origin}${data.shareUrl}`;

  const defaultCaption = data.shareCaption || 
    `Check this out!\n${data.title || ''}\n\n${data.description ? data.description.slice(0, 100) + '...' : ''}\n\n${fullShareUrl}`;

  const hasSocialImages = data.shareImageSquareUrl || data.shareImageLinkUrl;

  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  function downloadFile(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-500" />
          Published Successfully!
          {data.channelName && (
            <Badge variant="secondary" className="ml-2">
              {data.channelName}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.title && (
          <p className="text-lg font-medium">{data.title}</p>
        )}

        <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground block mb-1">Share Link</label>
              <p className="text-sm truncate font-mono">{fullShareUrl}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(fullShareUrl, "shareUrl")}
              data-testid="btn-copy-share-url"
            >
              {copiedField === "shareUrl" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-xs text-muted-foreground block mb-1">Packet ID</label>
              <p className="text-sm truncate font-mono">{data.packetId}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(data.packetId, "packetId")}
              data-testid="btn-copy-packet-id"
            >
              {copiedField === "packetId" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {hasSocialImages && (
          <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-lg p-4 border border-indigo-500/20">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Social Media Assets
            </p>
            <div className="grid grid-cols-2 gap-3">
              {data.shareImageSquareUrl && (
                <Button
                  variant="default"
                  className="flex items-center gap-2"
                  onClick={() => downloadFile(data.shareImageSquareUrl!, `square-${data.packetId}.png`)}
                  data-testid="btn-download-square"
                >
                  <Image className="h-4 w-4" />
                  Square (1080x1080)
                </Button>
              )}
              {data.shareImageLinkUrl && (
                <Button
                  variant="default"
                  className="flex items-center gap-2"
                  onClick={() => downloadFile(data.shareImageLinkUrl!, `link-${data.packetId}.png`)}
                  data-testid="btn-download-link"
                >
                  <Image className="h-4 w-4" />
                  Link Preview (1200x630)
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Use Square for Instagram/Facebook posts, Link Preview for sharing links
            </p>
          </div>
        )}

        {!hasSocialImages && showAdminControls && onRegenerateAssets && (
          <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
            <p className="text-sm text-amber-200 mb-2">Social images not generated yet</p>
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerateAssets}
              data-testid="btn-regenerate-assets"
            >
              <Download className="h-4 w-4 mr-2" />
              Generate Social Images
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {data.qrImageUrl && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => downloadFile(data.qrImageUrl!, `qr-${data.packetId}.png`)}
              data-testid="btn-download-qr"
            >
              <QrCode className="h-4 w-4" />
              Download QR
            </Button>
          )}

          {(data.previewUrl || data.compositeUrl) && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => downloadFile(data.previewUrl || data.compositeUrl!, `preview-${data.packetId}.png`)}
              data-testid="btn-download-preview"
            >
              <Image className="h-4 w-4" />
              Download Preview
            </Button>
          )}

          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => window.open(fullShareUrl, "_blank")}
            data-testid="btn-view-live"
          >
            <ExternalLink className="h-4 w-4" />
            View Live
          </Button>

          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              if (navigator.share) {
                navigator.share({ url: fullShareUrl, title: data.title || "Check this out!" });
              } else {
                copyToClipboard(fullShareUrl, "shareUrl");
              }
            }}
            data-testid="btn-share"
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>

        {/* Social Share Buttons - NO API REQUIRED */}
        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs text-muted-foreground mb-3">Share on Social</p>
          <div className="grid grid-cols-5 gap-2">
            {/* X / Twitter */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const text = encodeURIComponent(data.title || "Check this out!");
                const url = encodeURIComponent(fullShareUrl);
                window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "width=600,height=400");
              }}
              data-testid="btn-share-x"
              title="Share on X"
            >
              <FaXTwitter className="h-4 w-4" />
            </Button>

            {/* Facebook */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const url = encodeURIComponent(fullShareUrl);
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "width=600,height=400");
              }}
              data-testid="btn-share-facebook"
              title="Share on Facebook"
            >
              <SiFacebook className="h-4 w-4" />
            </Button>

            {/* LinkedIn */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const url = encodeURIComponent(fullShareUrl);
                window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank", "width=600,height=400");
              }}
              data-testid="btn-share-linkedin"
              title="Share on LinkedIn"
            >
              <SiLinkedin className="h-4 w-4" />
            </Button>

            {/* WhatsApp */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const text = encodeURIComponent(`${data.title || "Check this out!"} ${fullShareUrl}`);
                window.open(`https://wa.me/?text=${text}`, "_blank");
              }}
              data-testid="btn-share-whatsapp"
              title="Share on WhatsApp"
            >
              <SiWhatsapp className="h-4 w-4" />
            </Button>

            {/* Email */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => {
                const subject = encodeURIComponent(data.title || "Check this out!");
                const body = encodeURIComponent(`${data.title || "Check this out!"}\n\n${fullShareUrl}`);
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
              }}
              data-testid="btn-share-email"
              title="Share via Email"
            >
              <Mail className="h-4 w-4" />
            </Button>
          </div>

          {/* Copy Caption */}
          <div className="mt-3 space-y-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => copyToClipboard(defaultCaption, "caption")}
              data-testid="btn-copy-caption"
            >
              {copiedField === "caption" ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Copy Caption
            </Button>
            {copiedField === "caption" && (
              <p className="text-xs text-green-400 text-center">Caption copied! Paste into your post.</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-700">
          {onCreateAnother && (
            <Button
              className="flex-1"
              onClick={onCreateAnother}
              data-testid="btn-create-another"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Another
            </Button>
          )}

          {onViewLibrary && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={onViewLibrary}
              data-testid="btn-view-library"
            >
              View Library
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
