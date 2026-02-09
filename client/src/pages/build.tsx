import { OwnerWizard } from "@/features/owner/OwnerWizard";

export default function BuildPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-lg mx-auto px-4 py-6">
        <OwnerWizard />
      </div>
    </div>
  );
}
