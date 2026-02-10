import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Share2, Image, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { notifyParent, type ChannelItem } from "./SiteContext";

interface ShareKitPanelProps {
  item: ChannelItem;
  onClose: () => void;
}

export function ShareKitPanel({ item, onClose }: ShareKitPanelProps) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}${item.shareUrl}`;
  const caption = item.shareCaption || `Check out ${item.title}!\n\n${shareUrl}`;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      toast({ title: "Copied!", description: `${field} copied to clipboard` });
      notifyParent('share_copied', { url: shareUrl, field });
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  return (
    <Card className="overflow-hidden" data-testid="share-kit-panel">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Share Kit</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-close-share">
            Close
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Share Link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 text-sm bg-muted rounded-md px-3 py-2 border"
                data-testid="input-share-url"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(shareUrl, 'Link')}
                data-testid="button-copy-link"
              >
                {copiedField === 'Link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Share Caption</label>
            <div className="flex gap-2">
              <textarea
                readOnly
                value={caption}
                rows={3}
                className="flex-1 text-sm bg-muted rounded-md px-3 py-2 border resize-none"
                data-testid="input-share-caption"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(caption, 'Caption')}
                data-testid="button-copy-caption"
              >
                {copiedField === 'Caption' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {item.shareImageSquareUrl && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Share Image</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  <img src={item.shareImageSquareUrl} alt="Share" className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(item.shareImageSquareUrl!, 'Image URL')}
                    data-testid="button-copy-image-url"
                  >
                    <Image className="w-3 h-3 mr-1" />
                    {copiedField === 'Image URL' ? 'Copied!' : 'Copy Image URL'}
                  </Button>
                  <p className="text-xs text-muted-foreground">Right-click to save, or copy URL</p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Copy these to post on your social media, newsletter, or anywhere else.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
