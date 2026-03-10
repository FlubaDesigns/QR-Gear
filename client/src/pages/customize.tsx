import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon, 
  Upload, 
  Sparkles,
  Check,
  ShoppingCart,
  RotateCcw,
  Type,
  Palette
} from 'lucide-react';

type CustomizerStep = 'start' | 'background' | 'text' | 'preview' | 'buy';

type TextSize = 'small' | 'medium' | 'large';
type TextPosition = 'top' | 'middle' | 'bottom';

const TEXT_COLORS = [
  { id: 'white', hex: '#FFFFFF', name: 'White' },
  { id: 'black', hex: '#000000', name: 'Black' },
  { id: 'gold', hex: '#FFD700', name: 'Gold' },
  { id: 'red', hex: '#EF4444', name: 'Red' },
  { id: 'blue', hex: '#3B82F6', name: 'Blue' },
  { id: 'green', hex: '#22C55E', name: 'Green' },
  { id: 'purple', hex: '#A855F7', name: 'Purple' },
];

const SAMPLE_BACKGROUNDS = [
  { id: '1', url: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=400', name: 'Gradient Blue' },
  { id: '2', url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=400', name: 'Abstract' },
  { id: '3', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400', name: 'Colorful' },
  { id: '4', url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400', name: 'Ocean' },
  { id: '5', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400', name: 'Mountains' },
  { id: '6', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400', name: 'Dark Gradient' },
];

export default function Customize() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<CustomizerStep>('start');
  
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [title, setTitle] = useState('');
  const [textSize, setTextSize] = useState<TextSize>('medium');
  const [textColor, setTextColor] = useState('white');
  const [textPosition, setTextPosition] = useState<TextPosition>('bottom');
  
  const getTextSizeClass = () => {
    switch (textSize) {
      case 'small': return 'text-sm';
      case 'medium': return 'text-lg';
      case 'large': return 'text-2xl';
    }
  };
  
  const getTextPositionClass = () => {
    switch (textPosition) {
      case 'top': return 'items-start pt-8';
      case 'middle': return 'items-center';
      case 'bottom': return 'items-end pb-8';
    }
  };
  
  const selectedColor = TEXT_COLORS.find(c => c.id === textColor);
  
  const handleNext = () => {
    const steps: CustomizerStep[] = ['start', 'background', 'text', 'preview', 'buy'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };
  
  const handleBack = () => {
    const steps: CustomizerStep[] = ['start', 'background', 'text', 'preview', 'buy'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };
  
  const handleBuy = () => {
    alert('Added to cart! (Checkout integration coming soon)');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* ALWAYS-ON PREVIEW - Left/Top side */}
          <div className="lg:w-1/2 flex justify-center">
            <div className="sticky top-6">
              <p className="text-center text-slate-400 text-sm mb-3">Your Preview</p>
              <div 
                className="relative w-[280px] h-[500px] rounded-[2.5rem] border-4 border-slate-600 bg-slate-800 shadow-2xl overflow-hidden"
                style={{ 
                  boxShadow: '0 0 0 2px rgba(100,116,139,0.3), 0 25px 50px -12px rgba(0,0,0,0.5)' 
                }}
              >
                {/* Phone notch */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-6 bg-slate-900 rounded-full z-10" />
                
                {/* Screen content */}
                <div className="w-full h-full bg-slate-900 overflow-hidden">
                  {backgroundUrl ? (
                    <div className="relative w-full h-full">
                      <img 
                        src={backgroundUrl} 
                        alt="Your design" 
                        className="w-full h-full object-cover"
                      />
                      {/* Text overlay */}
                      {title && (
                        <div className={`absolute inset-0 flex flex-col justify-center px-6 ${getTextPositionClass()}`}>
                          <p 
                            className={`font-bold text-center drop-shadow-lg ${getTextSizeClass()}`}
                            style={{ color: selectedColor?.hex || '#FFFFFF' }}
                          >
                            {title}
                          </p>
                        </div>
                      )}
                      {/* QR code indicator */}
                      <div className="absolute bottom-4 right-4 w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-200 to-slate-300 rounded grid grid-cols-3 grid-rows-3 gap-0.5 p-1">
                          {[...Array(9)].map((_, i) => (
                            <div key={i} className={`${Math.random() > 0.5 ? 'bg-slate-800' : 'bg-white'}`} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                      <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
                      <p className="text-sm">Pick a design to see it here</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Product context */}
              <div className="mt-4 text-center">
                <p className="text-slate-400 text-sm">This design will appear on your</p>
                <p className="text-white font-semibold">Custom QR Product</p>
                <p className="text-green-400 text-xs mt-1">QR code included</p>
              </div>
            </div>
          </div>
          
          {/* CONTROLS - Right/Bottom side */}
          <div className="lg:w-1/2">
            <Card className="bg-slate-800/80 border-slate-700 backdrop-blur">
              <CardContent className="p-6">
                
                {/* STEP: START */}
                {step === 'start' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h1 className="text-2xl font-bold text-white mb-2">Make It Yours</h1>
                      <p className="text-slate-400">Choose how you'd like to start</p>
                    </div>
                    
                    <div className="grid gap-4">
                      <button
                        onClick={() => setStep('background')}
                        className="group p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl hover:border-blue-400/60 transition-all text-left"
                        data-testid="card-start-design"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Sparkles className="w-7 h-7 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-semibold text-lg">Start with a design</p>
                            <p className="text-slate-400 text-sm">Pick from our curated backgrounds</p>
                          </div>
                        </div>
                      </button>
                      
                      <button
                        onClick={() => setStep('background')}
                        className="group p-6 bg-gradient-to-br from-green-600/20 to-teal-600/20 border border-green-500/30 rounded-xl hover:border-green-400/60 transition-all text-left"
                        data-testid="card-upload-photo"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <Upload className="w-7 h-7 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-semibold text-lg">Upload a photo</p>
                            <p className="text-slate-400 text-sm">Use your own image</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* STEP: BACKGROUND */}
                {step === 'background' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-white mb-2">Pick a Background</h2>
                      <p className="text-slate-400 text-sm">Tap any design to preview it</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {SAMPLE_BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => setBackgroundUrl(bg.url)}
                          className={`aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all ${
                            backgroundUrl === bg.url 
                              ? 'border-blue-500 ring-2 ring-blue-500/50' 
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                          data-testid={`bg-option-${bg.id}`}
                        >
                          <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    
                    {backgroundUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBackgroundUrl('')}
                        className="w-full"
                        data-testid="button-reset-background"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                      </Button>
                    )}
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                        data-testid="button-back"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                      <Button
                        onClick={handleNext}
                        disabled={!backgroundUrl}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        data-testid="button-next"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* STEP: TEXT */}
                {step === 'text' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-white mb-2">Add Your Text</h2>
                      <p className="text-slate-400 text-sm">Optional - make it personal</p>
                    </div>
                    
                    {/* Title input */}
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300 flex items-center gap-2">
                        <Type className="w-4 h-4" />
                        Your message
                      </label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Enter your text..."
                        className="bg-slate-700/50 border-slate-600 text-white"
                        data-testid="input-title"
                      />
                    </div>
                    
                    {title && (
                      <>
                        {/* Size buttons */}
                        <div className="space-y-2">
                          <label className="text-sm text-slate-300">Size</label>
                          <div className="flex gap-2">
                            {(['small', 'medium', 'large'] as TextSize[]).map((size) => (
                              <Button
                                key={size}
                                variant={textSize === size ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTextSize(size)}
                                className={textSize === size ? 'bg-blue-600' : ''}
                                data-testid={`button-size-${size}`}
                              >
                                {size.charAt(0).toUpperCase() + size.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Color presets */}
                        <div className="space-y-2">
                          <label className="text-sm text-slate-300 flex items-center gap-2">
                            <Palette className="w-4 h-4" />
                            Color
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {TEXT_COLORS.map((color) => (
                              <button
                                key={color.id}
                                onClick={() => setTextColor(color.id)}
                                className={`w-10 h-10 rounded-full border-2 transition-all ${
                                  textColor === color.id 
                                    ? 'border-blue-500 ring-2 ring-blue-500/50 scale-110' 
                                    : 'border-slate-600 hover:border-slate-500'
                                }`}
                                style={{ backgroundColor: color.hex }}
                                title={color.name}
                                data-testid={`button-color-${color.id}`}
                              />
                            ))}
                          </div>
                        </div>
                        
                        {/* Position zones */}
                        <div className="space-y-2">
                          <label className="text-sm text-slate-300">Position</label>
                          <div className="flex gap-2">
                            {(['top', 'middle', 'bottom'] as TextPosition[]).map((pos) => (
                              <Button
                                key={pos}
                                variant={textPosition === pos ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTextPosition(pos)}
                                className={textPosition === pos ? 'bg-blue-600' : ''}
                                data-testid={`button-position-${pos}`}
                              >
                                {pos.charAt(0).toUpperCase() + pos.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                        data-testid="button-back"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                      <Button
                        onClick={handleNext}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        data-testid="button-next"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* STEP: PREVIEW / CONFIRMATION */}
                {step === 'preview' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-white mb-2">This is what it will look like</h2>
                      <p className="text-slate-400 text-sm">You can change this later</p>
                    </div>
                    
                    <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-white">Background selected</span>
                      </div>
                      {title && (
                        <div className="flex items-center gap-3">
                          <Check className="w-5 h-5 text-green-400" />
                          <span className="text-white">Text: "{title}"</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-400" />
                        <span className="text-white">QR code included</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={handleBack}
                        className="flex-1"
                        data-testid="button-change"
                      >
                        Change something
                      </Button>
                      <Button
                        onClick={handleNext}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        data-testid="button-looks-good"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Looks good
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* STEP: BUY */}
                {step === 'buy' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-white mb-2">Ready to order?</h2>
                      <p className="text-slate-400 text-sm">Your custom design is ready</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 border border-green-500/30 rounded-xl p-6 text-center">
                      <p className="text-3xl font-bold text-white mb-2">$24.99</p>
                      <p className="text-slate-400 text-sm">Free shipping on orders over $50</p>
                    </div>
                    
                    <Button
                      onClick={handleBuy}
                      size="lg"
                      className="w-full bg-green-600 hover:bg-green-700 text-lg h-14"
                      data-testid="button-buy"
                    >
                      <ShoppingCart className="w-5 h-5 mr-2" />
                      Buy this item
                    </Button>
                    
                    <Button
                      variant="ghost"
                      onClick={() => setStep('start')}
                      className="w-full"
                      data-testid="button-start-over"
                    >
                      Start over with a new design
                    </Button>
                  </div>
                )}
                
              </CardContent>
            </Card>
          </div>
          
        </div>
      </div>
    </div>
  );
}
