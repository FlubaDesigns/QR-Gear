import { Settings, Type, Plus, Trash2 } from "lucide-react";

export default function TestSettings() {
  return (
    <div className="page-wrap">
      <div className="container mobile-compact mobile-compact-stack">
        <div className="glass-card">
          <h1 className="glass-title text-lg flex items-center gap-2 mb-4" data-testid="text-page-title">
            <Settings className="h-5 w-5 text-blue-400" />
            Test Settings
          </h1>
        </div>

        <div className="glass-card">
          <h2 className="glass-title text-base flex items-center gap-2 mb-3">
            <Type className="h-5 w-5 text-blue-400" />
            Font Management
          </h2>
          <p className="text-base text-blue-200 mb-4">
            Manage the fonts available in the product builder text editor.
          </p>
          
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-4">
            <p className="text-base text-amber-200 font-medium">
              TODO: Implement font management
            </p>
            <ul className="mt-2 text-base text-amber-200/80 space-y-1 list-disc list-inside">
              <li>Add new fonts to the font picker list</li>
              <li>Remove fonts from the font picker list</li>
              <li>Reorder fonts (most used at top)</li>
              <li>Preview fonts before adding</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <button className="qr-btn qr-btn--primary qr-btn--touch qr-btn--full qr-btn--xl opacity-50 cursor-not-allowed" disabled data-testid="button-add-font">
              <Plus className="h-5 w-5" />
              Add Font
            </button>
            <button className="qr-btn qr-btn--outline qr-btn--touch qr-btn--full qr-btn--xl opacity-50 cursor-not-allowed" disabled data-testid="button-delete-font">
              <Trash2 className="h-5 w-5" />
              Delete Font
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
