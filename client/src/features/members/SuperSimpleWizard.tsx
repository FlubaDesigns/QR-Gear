import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ChevronLeft, Sparkles, X, ArrowRight } from "lucide-react";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductPickerStep, ProductCongratsStep, ColorPickerStep, SizePickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { TypePickerStep } from "@/features/shared/components/wizardSteps/TypeAndSurfaceSteps";
import { BlackboardPanel, DismissBlackboardsButton } from "@/features/shared/components/wizardSteps/BlackboardExplainer";
import { type SimpleWizardStep, calculateSizeEarningsBonuses } from "@/features/shared/components/wizardSteps";
import { useWizardContext } from './WizardContext';

const ALL_STEPS: SimpleWizardStep[] = ['channel', 'product', 'product-congrats', 'color', 'size', 'type'];

const DOT_STEPS: SimpleWizardStep[] = ['channel', 'product', 'color', 'size', 'type'];

export function SuperSimpleWizard() {
  const {
    simpleStep, setSimpleStep,
    selectedChannel, setSelectedChannel,
    selectedProductType,
    selectedColor, setSelectedColor,
    selectedShirtSize, setSelectedShirtSize,
    qrType, setQrType,
    runningEarnings,
    user,
    setWizardTier,
    setViewMode,
    isCreatingChannel, setIsCreatingChannel,
    newChannelName, setNewChannelName,
    handleProductSelect,
    pricingSettings,
    selectedPlacements,
  } = useWizardContext();

  if (!user) {
    return (
      <div className="space-y-4">
        <Card className="bg-slate-800/50 border-slate-700 min-h-[300px] flex flex-col">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <p className="text-sm text-emerald-400 font-medium flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Super Simple
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('index')}
              className="text-white/50 hover:text-white"
              aria-label="Close"
              data-testid="super-simple-close-unauth"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-6 pt-2 text-white/80">
            <p className="text-lg font-semibold text-white mb-2">
              Sign in required
            </p>
            <p className="text-sm text-white/70 mb-4">
              Super Simple needs your account so we can load your channels and save your setup.
            </p>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              onClick={() => setViewMode('index')}
              data-testid="super-simple-back-to-home"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentIdx = ALL_STEPS.indexOf(simpleStep);

  return (
    <div className="space-y-4">
      <Card className="bg-slate-800/50 border-slate-700 min-h-[500px] flex flex-col">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (simpleStep === 'channel') {
                  setViewMode('index');
                } else if (currentIdx > 0) {
                  setSimpleStep(ALL_STEPS[currentIdx - 1]);
                }
              }}
              className="text-white/70 hover:text-white"
              data-testid="super-simple-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <p className="text-sm text-emerald-400 font-medium flex items-center gap-1">
              <Sparkles className="w-4 h-4" />
              Super Simple
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setViewMode('index'); }}
            className="text-white/50 hover:text-white"
            data-testid="super-simple-close"
          >
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <div className="flex justify-center gap-1.5 px-4 pb-3">
          {DOT_STEPS.map((dotStep) => {
            const dotIdx = ALL_STEPS.indexOf(dotStep);
            return (
              <div
                key={dotStep}
                className={`h-2 rounded-full transition-all ${
                  currentIdx >= dotIdx ? 'bg-emerald-400 w-8' : 'bg-slate-600 w-4'
                }`}
                data-testid={`dot-${dotStep}`}
              />
            );
          })}
        </div>

        <CardContent className="flex-1 p-6 pt-2">
          <BlackboardPanel step={simpleStep} userId={user.id} />

          {simpleStep === 'channel' && (
            <ChannelStep
              selectedChannel={selectedChannel}
              onSelect={setSelectedChannel}
              memberId={user.id}
              isCreatingChannel={isCreatingChannel}
              setIsCreatingChannel={setIsCreatingChannel}
              newChannelName={newChannelName}
              setNewChannelName={setNewChannelName}
            />
          )}
          {simpleStep === 'product' && (
            <ProductPickerStep
              selectedProduct={selectedProductType}
              onSelect={handleProductSelect}
            />
          )}
          {simpleStep === 'product-congrats' && selectedProductType && (
            <ProductCongratsStep
              productName={selectedProductType.title}
              earnings={selectedProductType.memberEarnings || 0}
            />
          )}
          {simpleStep === 'color' && (
            <ColorPickerStep
              selectedColor={selectedColor}
              onSelect={setSelectedColor}
            />
          )}
          {simpleStep === 'size' && (() => {
            const sizeEarningsBonuses = calculateSizeEarningsBonuses(
              pricingSettings?.sizeUpcharges,
              pricingSettings?.memberProfitShare || 0.25
            );
            return (
              <SizePickerStep
                selectedSize={selectedShirtSize}
                selectedColor={selectedColor}
                baseEarnings={runningEarnings}
                sizeEarningsBonuses={sizeEarningsBonuses}
                selectedPlacements={selectedPlacements}
                onSelect={setSelectedShirtSize}
              />
            );
          })()}
          {simpleStep === 'type' && (
            <TypePickerStep
              selectedType={qrType}
              onSelect={setQrType}
            />
          )}

          <div className="flex justify-center mt-4">
            <DismissBlackboardsButton userId={user.id} />
          </div>
        </CardContent>

        <div className="p-4 pt-0">
          <Button
            onClick={() => {
              if (simpleStep === 'type' && qrType) {
                setWizardTier('simple');
              } else if (currentIdx < ALL_STEPS.length - 1) {
                setSimpleStep(ALL_STEPS[currentIdx + 1]);
              }
            }}
            disabled={(() => {
              switch (simpleStep) {
                case 'channel': return !selectedChannel;
                case 'product': return !selectedProductType;
                case 'product-congrats': return false;
                case 'color': return !selectedColor;
                case 'size': return !selectedShirtSize;
                case 'type': return !qrType;
                default: return true;
              }
            })()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-6 text-lg font-semibold"
            data-testid="super-simple-next"
          >
            {simpleStep === 'type' ? (
              <>Continue to Details <ArrowRight className="w-5 h-5 ml-2" /></>
            ) : simpleStep === 'product-congrats' ? (
              <>Nice! Pick a Color <ArrowRight className="w-5 h-5 ml-2" /></>
            ) : (
              <>Next <ArrowRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
