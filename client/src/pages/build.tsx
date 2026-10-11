import { OwnerWizard } from "@/features/owner/OwnerWizard";
import { PageSkeleton } from "@/components/PageSkeleton";
import BreadcrumbTrail from "@/components/BreadcrumbTrail";

export default function BuildPage() {
  return (
    <PageSkeleton>
      <div className="row py-4">
        <BreadcrumbTrail />
        <OwnerWizard />
      </div>
    </PageSkeleton>
  );
}
