import SEO from "@/components/SEO";
import { OwnerWizard } from "@/features/owner/OwnerWizard";

export default function BuildPage() {
  return (
    <>
      <SEO title="Create Your QR Gear" description="Choose your product and personalize your QR design with the QR Gear builder." />
      <div className="row py-4">

        <OwnerWizard />
      </div>
    </>
  );
}
