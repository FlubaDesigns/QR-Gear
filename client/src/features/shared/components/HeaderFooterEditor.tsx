import { Type } from "lucide-react";
import { TextStyleEditor, type TextStyleConfig, defaultTextStyle } from "./TextStyleEditor";
import { GraphicPreviewView } from "./skins/GraphicPreviewView";
import { Card, CardContent } from "@/components/ui/card";

export interface HeaderFooterEditorProps {
  headerStyle: TextStyleConfig;
  onHeaderChange: (updates: Partial<TextStyleConfig>) => void;
  footerStyle: TextStyleConfig;
  onFooterChange: (updates: Partial<TextStyleConfig>) => void;
  backgroundColor?: string;
  backgroundImage?: string;
  title?: string;
  subtitle?: string;
}

export function HeaderFooterEditor({
  headerStyle,
  onHeaderChange,
  footerStyle,
  onFooterChange,
  backgroundColor = '#1a1a2e',
  backgroundImage,
  title = "Header & Footer",
  subtitle = "Add text above and below your QR code",
}: HeaderFooterEditorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400">{subtitle}</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-600">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Type className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Header Text</span>
          </div>
          <TextStyleEditor
            style={headerStyle}
            onChange={onHeaderChange}
            label="Header Text"
            sublabel="Appears above your design"
            maxLength={40}
            testIdPrefix="header"
          />
        </CardContent>
      </Card>

      <div className="flex flex-col items-center py-4">
        <p className="text-xs text-slate-400 mb-3">Live Preview</p>
        <GraphicPreviewView
          backgroundColor={backgroundColor}
          backgroundImage={backgroundImage}
          headerStyle={headerStyle}
          footerStyle={footerStyle}
          showQRCode={true}
          aspectRatio="square"
        />
        <p className="text-xs text-slate-500 mt-3 text-center">
          This shows where your text will appear on the product graphic
        </p>
      </div>

      <Card className="bg-slate-800/50 border-slate-600">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Type className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Footer Text</span>
          </div>
          <TextStyleEditor
            style={footerStyle}
            onChange={onFooterChange}
            label="Footer Text"
            sublabel="Appears below your design"
            maxLength={40}
            testIdPrefix="footer"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { defaultTextStyle };
export type { TextStyleConfig };
