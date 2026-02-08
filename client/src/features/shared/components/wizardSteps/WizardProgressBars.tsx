import {
  type SimpleWizardStep,
  type WizardStep,
  SIMPLE_WIZARD_STEPS,
  QR_BASIC_STEPS,
  QR_PLUS_STEPS,
  QR_PLAY_STEPS,
  QR_COMPOSE_STEPS,
  WIZARD_STEPS,
  isQRBasicStep,
  isQRPlusStep,
  isQRPlayStep,
  isQRComposeStep,
} from "./wizardTypes";

export function SimpleWizardProgressBar({ 
  currentStep 
}: { 
  currentStep: SimpleWizardStep; 
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
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">
          Step {currentIndex + 1} of {steps.length}: {steps[currentIndex]?.label}
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
  completedSteps 
}: { 
  currentStep: WizardStep; 
  onStepClick: (step: WizardStep) => void;
  completedSteps: Set<WizardStep>;
}) {
  const currentIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
  const progress = (currentIndex / WIZARD_STEPS.length) * 100;
  
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">
          Step {currentIndex + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[currentIndex]?.label}
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
