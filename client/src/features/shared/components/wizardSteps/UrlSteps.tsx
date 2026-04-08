import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LANDING_TEXT_COLORS = ['#ffffff', '#000000', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const LANDING_TEXT_SIZES = [
  { id: 'sm', label: 'S', value: '14px' },
  { id: 'md', label: 'M', value: '18px' },
  { id: 'lg', label: 'L', value: '24px' },
  { id: 'xl', label: 'XL', value: '32px' }
];
const LANDING_TEXT_FONTS = [
  { id: 'sans', label: 'Clean', family: 'Arial' },
  { id: 'serif', label: 'Classic', family: 'Georgia' },
  { id: 'mono', label: 'Tech', family: 'Courier New' },
  { id: 'display', label: 'Bold', family: 'Impact' }
];

function LandingPagePhoneMockup({
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
}: {
  background: string;
  title: string;
  description: string;
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
  return (
    <div className="flex justify-center py-2">
      <div className="relative w-44 h-72 rounded-3xl border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
        <div className="w-full h-full relative">
          {background ? (
            <img 
              src={background} 
              alt="Landing page background" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
              <span className="text-slate-500 text-xs">No background selected</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div 
            className="absolute w-full px-2 text-center"
            style={{ bottom: `${titleVertical}%`, left: `${(titleHorizontal - 50) * 0.2}%` }}
          >
            <h3 
              className="font-bold truncate drop-shadow-lg"
              style={{ color: titleColor, fontSize: titleSize, fontFamily: titleFont }}
            >
              {title || 'Your Title Here'}
            </h3>
          </div>
          <div 
            className="absolute w-full px-2 text-center"
            style={{ bottom: `${descVertical}%`, left: `${(descHorizontal - 50) * 0.2}%` }}
          >
            <p 
              className="line-clamp-2 drop-shadow-lg"
              style={{ color: descColor, fontSize: descSize, fontFamily: descFont }}
            >
              {description || 'Add a description...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UrlTitleStep({
  title,
  onTitleChange,
  background,
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
  onTitleVerticalChange,
  onTitleHorizontalChange,
  onTitleColorChange,
  onTitleSizeChange,
  onTitleFontChange,
}: {
  title: string;
  onTitleChange: (title: string) => void;
  background: string;
  description: string;
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
  onTitleVerticalChange: (v: number) => void;
  onTitleHorizontalChange: (v: number) => void;
  onTitleColorChange: (c: string) => void;
  onTitleSizeChange: (s: string) => void;
  onTitleFontChange: (f: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Title Your Landing Page</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
      </div>
      
      <LandingPagePhoneMockup
        background={background}
        title={title}
        description={description}
        titleVertical={titleVertical}
        titleHorizontal={titleHorizontal}
        titleColor={titleColor}
        titleSize={titleSize}
        titleFont={titleFont}
        descVertical={descVertical}
        descHorizontal={descHorizontal}
        descColor={descColor}
        descSize={descSize}
        descFont={descFont}
      />
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-white text-sm font-medium">Title</Label>
              <span className="text-xs text-slate-500 italic">Tap to customize</span>
            </div>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Give your creation a name..."
              className="bg-slate-700 border-slate-600 text-white mt-1"
              data-testid="input-url-title"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {LANDING_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onTitleColorChange(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    titleColor === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`btn-title-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {LANDING_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onTitleSizeChange(size.value)}
                  className={`h-5 px-2 text-xs ${titleSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-title-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {LANDING_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onTitleFontChange(font.family)}
                  style={{ fontFamily: font.family }}
                  className={`h-5 px-2 text-xs ${titleFont === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-title-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">
                Vertical: {titleVertical}%
              </Label>
              <input
                type="range"
                min="0"
                max="90"
                value={titleVertical}
                onChange={(e) => onTitleVerticalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-title-vertical"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">
                Horizontal: {titleHorizontal}%
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={titleHorizontal}
                onChange={(e) => onTitleHorizontalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-title-horizontal"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UrlDescriptionStep({
  title,
  description,
  onDescriptionChange,
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
  descFont,
  onDescVerticalChange,
  onDescHorizontalChange,
  onDescColorChange,
  onDescSizeChange,
  onDescFontChange,
}: {
  title: string;
  description: string;
  onDescriptionChange: (description: string) => void;
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
  onDescVerticalChange: (v: number) => void;
  onDescHorizontalChange: (v: number) => void;
  onDescColorChange: (c: string) => void;
  onDescSizeChange: (s: string) => void;
  onDescFontChange: (f: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Add a Description</h2>
        <p className="text-slate-400 text-sm">Describe what people will see on the landing page</p>
      </div>
      
      <LandingPagePhoneMockup
        background={background}
        title={title}
        description={description}
        titleVertical={titleVertical}
        titleHorizontal={titleHorizontal}
        titleColor={titleColor}
        titleSize={titleSize}
        titleFont={titleFont}
        descVertical={descVertical}
        descHorizontal={descHorizontal}
        descColor={descColor}
        descSize={descSize}
        descFont={descFont}
      />
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-white text-sm font-medium">Description</Label>
              <span className="text-xs text-slate-500 italic">Tap to customize</span>
            </div>
            <Input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What is this about?"
              className="bg-slate-700 border-slate-600 text-white mt-1"
              data-testid="input-url-description"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {LANDING_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onDescColorChange(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    descColor === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`btn-desc-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {LANDING_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onDescSizeChange(size.value)}
                  className={`h-5 px-2 text-xs ${descSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-desc-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {LANDING_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onDescFontChange(font.family)}
                  style={{ fontFamily: font.family }}
                  className={`h-5 px-2 text-xs ${descFont === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-desc-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">
                Vertical: {descVertical}%
              </Label>
              <input
                type="range"
                min="0"
                max="90"
                value={descVertical}
                onChange={(e) => onDescVerticalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-desc-vertical"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">
                Horizontal: {descHorizontal}%
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={descHorizontal}
                onChange={(e) => onDescHorizontalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-desc-horizontal"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UrlCreationStep({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
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
  descFont,
  onTitleVerticalChange,
  onTitleHorizontalChange,
  onTitleColorChange,
  onTitleSizeChange,
  onTitleFontChange,
  onDescVerticalChange,
  onDescHorizontalChange,
  onDescColorChange,
  onDescSizeChange,
  onDescFontChange
}: {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
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
  onTitleVerticalChange: (v: number) => void;
  onTitleHorizontalChange: (v: number) => void;
  onTitleColorChange: (c: string) => void;
  onTitleSizeChange: (s: string) => void;
  onTitleFontChange: (f: string) => void;
  onDescVerticalChange: (v: number) => void;
  onDescHorizontalChange: (v: number) => void;
  onDescColorChange: (c: string) => void;
  onDescSizeChange: (s: string) => void;
  onDescFontChange: (f: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold text-white mb-1">Create Your Landing Page</h2>
        <p className="text-slate-400 text-sm">This is what people see when they scan your QR code</p>
      </div>
      
      <div className="flex justify-center py-2">
        <div className="relative w-44 h-72 rounded-3xl border-4 border-slate-700 bg-black overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
          
          <div className="w-full h-full relative">
            {background ? (
              <img 
                src={background} 
                alt="Landing page background" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-b from-slate-700 to-slate-900 flex items-center justify-center">
                <span className="text-slate-500 text-xs">No background selected</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
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
                {title || 'Your Title Here'}
              </h3>
            </div>
            
            <div 
              className="absolute w-full px-2 text-center"
              style={{ 
                bottom: `${descVertical}%`,
                left: `${(descHorizontal - 50) * 0.2}%`
              }}
            >
              <p 
                className="line-clamp-2 drop-shadow-lg"
                style={{ 
                  color: descColor,
                  fontSize: descSize,
                  fontFamily: descFont
                }}
              >
                {description || 'Add a description...'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-4 max-w-md mx-auto">
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-white text-sm font-medium">Title</Label>
              <span className="text-xs text-slate-500 italic">Tap to customize</span>
            </div>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Give your creation a name..."
              className="bg-slate-700 border-slate-600 text-white mt-1"
              data-testid="input-url-title"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {LANDING_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onTitleColorChange(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    titleColor === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`btn-title-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {LANDING_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onTitleSizeChange(size.value)}
                  className={`h-5 px-2 text-xs ${titleSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-title-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {LANDING_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onTitleFontChange(font.family)}
                  style={{ fontFamily: font.family }}
                  className={`h-5 px-2 text-xs ${titleFont === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-title-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">
                Vertical: {titleVertical}%
              </Label>
              <input
                type="range"
                min="0"
                max="90"
                value={titleVertical}
                onChange={(e) => onTitleVerticalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-title-vertical"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">
                Horizontal: {titleHorizontal}%
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={titleHorizontal}
                onChange={(e) => onTitleHorizontalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-title-horizontal"
              />
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-white text-sm font-medium">Description</Label>
              <span className="text-xs text-slate-500 italic">Tap to customize</span>
            </div>
            <Input
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              placeholder="What is this about?"
              className="bg-slate-700 border-slate-600 text-white mt-1"
              data-testid="input-url-description"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Color:</span>
              {LANDING_TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => onDescColorChange(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    descColor === color ? 'border-white scale-110' : 'border-slate-600'
                  }`}
                  style={{ backgroundColor: color }}
                  data-testid={`btn-desc-color-${color}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Size:</span>
              {LANDING_TEXT_SIZES.map((size) => (
                <Button
                  key={size.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onDescSizeChange(size.value)}
                  className={`h-5 px-2 text-xs ${descSize === size.value ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-desc-size-${size.id}`}
                >
                  {size.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Font:</span>
              {LANDING_TEXT_FONTS.map((font) => (
                <Button
                  key={font.id}
                  size="sm"
                  variant="outline"
                  onClick={() => onDescFontChange(font.family)}
                  style={{ fontFamily: font.family }}
                  className={`h-5 px-2 text-xs ${descFont === font.family ? 'border-orange-500 text-orange-400 font-semibold' : ''}`}
                  data-testid={`btn-desc-font-${font.id}`}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-slate-400 text-xs">
                Vertical: {descVertical}%
              </Label>
              <input
                type="range"
                min="0"
                max="90"
                value={descVertical}
                onChange={(e) => onDescVerticalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-desc-vertical"
              />
            </div>
            <div>
              <Label className="text-slate-400 text-xs">
                Horizontal: {descHorizontal}%
              </Label>
              <input
                type="range"
                min="0"
                max="100"
                value={descHorizontal}
                onChange={(e) => onDescHorizontalChange(Number(e.target.value))}
                className="w-full touch-slider"
                style={{ touchAction: 'none' }}
                data-testid="slider-desc-horizontal"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
