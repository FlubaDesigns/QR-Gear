import {
  type SimpleWizardStep,
  type WizardStep,
  type PlacementOption,
  SIMPLE_WIZARD_STEPS,
  QR_BASIC_STEPS,
  QR_PLUS_STEPS,
  QR_PLAY_STEPS,
  QR_COMPOSE_STEPS,
  WIZARD_STEPS,
  PLACEMENT_OPTIONS,
  isQRBasicStep,
  isQRPlusStep,
  isQRPlayStep,
  isQRComposeStep,
} from "./wizardTypes";

export function SimpleWizardProgressBar({ 
  currentStep,
  currentPlacement
}: { 
  currentStep: SimpleWizardStep; 
  currentPlacement?: PlacementOption;
}) {
  const steps = isQRBasicStep(currentStep) 
    ? QR_BASIC_STEPS 
    : isQRPlusStep(currentStep) 
      ? QR_PLUS_STEPS 
      : isQRPlayStep(currentStep)
        ? QR_PLAY_STEPS
        : isQRComposeStep(currentStep)
          ? QR_COMPOSE_STEPS
          : SIMPLE_WIZARD_STEPS;
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((currentIndex + 1) / steps.length) * 100;
  const stepLabel = steps[currentIndex]?.label;
  const placementLabel = currentPlacement ? PLACEMENT_OPTIONS.find(p => p.id === currentPlacement)?.label : undefined;
  const showPlacement = currentStep === 'placement-config' && placementLabel;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white flex items-center gap-2 flex-wrap">
          Step {currentIndex + 1} of {steps.length}: {stepLabel}
          {showPlacement && (
            <span className="inline-flex items-center bg-amber-500/15 border border-amber-500/30 rounded px-2 py-0.5 text-amber-300 font-bold text-xs">
              {placementLabel}
            </span>
          )}
        </span>
        <span className="text-sm text-slate-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function WizardProgressBar({ 
  currentStep, 
  completedSteps,
  currentPlacement
}: { 
  currentStep: WizardStep; 
  onStepClick: (step: WizardStep) => void;
  completedSteps: Set<WizardStep>;
  currentPlacement?: PlacementOption;
}) {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
  const progress = (currentIndex / WIZARD_STEPS.length) * 100;
  const stepLabel = WIZARD_STEPS[currentIndex]?.label;
  const placementLabel = currentPlacement ? PLACEMENT_OPTIONS.find(p => p.id === currentPlacement)?.label : undefined;
  const showPlacement = currentStep === 'placement' && placementLabel;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white flex items-center gap-2 flex-wrap">
          Step {currentIndex + 1} of {WIZARD_STEPS.length}: {stepLabel}
          {showPlacement && (
            <span className="inline-flex items-center bg-amber-500/15 border border-amber-500/30 rounded px-2 py-0.5 text-amber-300 font-bold text-xs">
              {placementLabel}
            </span>
          )}
        </span>
        <span className="text-sm text-slate-400">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
