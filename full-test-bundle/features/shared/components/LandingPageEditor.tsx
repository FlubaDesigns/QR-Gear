import { Link2, Type, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface LandingPageConfig {
  url: string;
  title: string;
  description: string;
}

export interface LandingPageEditorProps {
  value: LandingPageConfig;
  onChange: (config: LandingPageConfig) => void;
  title?: string;
  subtitle?: string;
}

export const defaultLandingPage: LandingPageConfig = {
  url: '',
  title: '',
  description: '',
};

export function LandingPageEditor({
  value,
  onChange,
  title = "Landing Page",
  subtitle = "Where should the QR code take people?",
}: LandingPageEditorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400">{subtitle}</p>
      </div>

      <Card className="bg-slate-800/50 border-slate-600">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-blue-400" />
              <Label className="text-white">Destination URL</Label>
            </div>
            <Input
              type="url"
              placeholder="https://example.com"
              value={value.url}
              onChange={(e) => onChange({ ...value, url: e.target.value })}
              className="bg-slate-700/50 border-slate-600 text-white"
              data-testid="input-landing-url"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-blue-400" />
              <Label className="text-white">Page Title</Label>
            </div>
            <Input
              type="text"
              placeholder="My awesome product"
              value={value.title}
              onChange={(e) => onChange({ ...value, title: e.target.value })}
              className="bg-slate-700/50 border-slate-600 text-white"
              data-testid="input-landing-title"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              <Label className="text-white">Description</Label>
            </div>
            <Textarea
              placeholder="Tell people what they'll find..."
              value={value.description}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              className="bg-slate-700/50 border-slate-600 text-white resize-none"
              rows={3}
              data-testid="input-landing-description"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
