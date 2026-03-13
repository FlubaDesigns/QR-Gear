import { AdvancedWizardProductSteps } from './AdvancedWizardProductSteps';
import { AdvancedWizardMediaSteps } from './AdvancedWizardMediaSteps';

export function AdvancedWizardStepContent({
  sharePacketId,
  getShareKitData,
  onCreateAnother,
  onBackToDashboard,
}: {
  sharePacketId: string;
  getShareKitData: () => any;
  onCreateAnother: () => void;
  onBackToDashboard: () => void;
}) {
  return (
    <>
      <AdvancedWizardProductSteps />
      <AdvancedWizardMediaSteps />
    </>
  );
}
