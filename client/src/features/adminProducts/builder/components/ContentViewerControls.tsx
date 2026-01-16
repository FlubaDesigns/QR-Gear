import { Image, Video, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ContentData } from "../types";

interface ContentViewerControlsProps {
  content: ContentData;
  onContentChange: (content: Partial<ContentData>) => void;
}

export function ContentViewerControls({
  content,
  onContentChange,
}: ContentViewerControlsProps) {
  return (
    <div className="space-y-3 p-3 border rounded-lg bg-background">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs font-medium w-full mb-1">Media Type</Label>
        <Button
          size="sm"
          variant={content.backgroundType === "image" ? "default" : "outline"}
          onClick={() => onContentChange({ backgroundType: "image" })}
          data-testid="button-media-image"
        >
          <Image className="h-3.5 w-3.5 mr-1" />
          Image
        </Button>
        <Button
          size="sm"
          variant={content.backgroundType === "video" ? "default" : "outline"}
          onClick={() => onContentChange({ backgroundType: "video" })}
          data-testid="button-media-video"
        >
          <Video className="h-3.5 w-3.5 mr-1" />
          Video
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs font-medium w-full mb-1">Text Position</Label>
        <Button
          size="sm"
          variant={content.overlayPosition === "top" ? "default" : "outline"}
          onClick={() => onContentChange({ overlayPosition: "top" })}
          data-testid="button-position-top"
        >
          <AlignVerticalJustifyStart className="h-3.5 w-3.5 mr-1" />
          Top
        </Button>
        <Button
          size="sm"
          variant={content.overlayPosition === "center" ? "default" : "outline"}
          onClick={() => onContentChange({ overlayPosition: "center" })}
          data-testid="button-position-center"
        >
          <AlignVerticalJustifyCenter className="h-3.5 w-3.5 mr-1" />
          Center
        </Button>
        <Button
          size="sm"
          variant={content.overlayPosition === "bottom" ? "default" : "outline"}
          onClick={() => onContentChange({ overlayPosition: "bottom" })}
          data-testid="button-position-bottom"
        >
          <AlignVerticalJustifyEnd className="h-3.5 w-3.5 mr-1" />
          Bottom
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="overlay-color" className="text-xs font-medium flex items-center gap-1">
            <Palette className="h-3.5 w-3.5" />
            Text Color
          </Label>
          <Input
            id="overlay-color"
            type="color"
            value={content.overlayColor}
            onChange={(e) => onContentChange({ overlayColor: e.target.value })}
            className="w-10 h-8 p-0.5 cursor-pointer"
            data-testid="input-overlay-color"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="overlay-font" className="text-xs font-medium">Font</Label>
          <input
            type="text"
            inputMode="text"
            id="overlay-font"
            list="font-options"
            value={content.overlayFontFamily}
            onChange={(e) => onContentChange({ overlayFontFamily: e.target.value })}
            className="h-8 px-2 text-xs border rounded-md bg-background min-w-[100px]"
            placeholder="Type or speak font..."
            data-testid="input-overlay-font"
          />
          <datalist id="font-options">
            <option value="Arial" />
            <option value="Georgia" />
            <option value="Times New Roman" />
            <option value="Verdana" />
            <option value="Impact" />
          </datalist>
        </div>
      </div>
    </div>
  );
}
