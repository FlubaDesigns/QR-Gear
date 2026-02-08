import { useWizardContext } from './WizardContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Layers, Library, X } from "lucide-react";
import { WizardProgressBar } from "@/features/shared/components/wizardSteps/WizardProgressBars";
import { ChannelStep } from "@/features/shared/components/wizardSteps/ChannelStep";
import { ProductPickerStep } from "@/features/shared/components/wizardSteps/ProductSteps";
import { PlacementPicker, type PlacementConfig } from "@/features/shared/components/PlacementPicker";
import type { PlacementOption } from "@/features/shared/components/wizardSteps";
import { HeaderFooterEditor } from "@/features/shared/components/HeaderFooterEditor";
import { BackgroundLibraryPicker } from "@/features/shared/components/BackgroundLibraryPicker";
import { LandingPageEditor } from "@/features/shared/components/LandingPageEditor";
import { PreviewStep, PublishStep } from "@/features/shared/components/wizardSteps/PreviewAndPublishSteps";

export function AdvancedWizard() {
  const {
    currentStep, handleStepClick, completedSteps, selectedChannel, setSelectedChannel,
    user, isCreatingChannel, setIsCreatingChannel, newChannelName, setNewChannelName,
    selectedProductType, handleProductSelect, selectedProduct, selectedPlacements, setSelectedPlacements,
    placementConfigs, setPlacementConfigs, headerStyle, setHeaderStyle, footerStyle, setFooterStyle,
    urlGraphic, setUrlGraphic, originalUrlGraphic, setOriginalUrlGraphic, showBackgroundLibrary, setShowBackgroundLibrary,
    landingPage, setLandingPage, qrType, isPublishing, handleBack, handleNext, canProceed, handlePublish
  } = useWizardContext();

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-400" />
          Advanced Wizard
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <WizardProgressBar 
          currentStep={currentStep}
          onStepClick={handleStepClick}
          completedSteps={completedSteps}
        />

        <div className="min-h-[400px]">
          {currentStep === 'channel' && (
            <ChannelStep 
              selectedChannel={selectedChannel}
              onSelect={setSelectedChannel}
              memberId={user?.id || ''}
              isCreatingChannel={isCreatingChannel}
              setIsCreatingChannel={setIsCreatingChannel}
              newChannelName={newChannelName}
              setNewChannelName={setNewChannelName}
            />
          )}
          {currentStep === 'product' && (
            <ProductPickerStep 
              selectedProduct={selectedProductType}
              onSelect={handleProductSelect}
            />
          )}
          {currentStep === 'placement' && selectedProduct && (
            <PlacementPicker
              placements={selectedProduct.placements || []}
              selectedPlacements={selectedPlacements}
              placementConfigs={placementConfigs}
              onToggle={(id) => {
                const placementId = id as PlacementOption;
                setSelectedPlacements(prev => 
                  prev.includes(placementId) ? prev.filter(p => p !== placementId) : [...prev, placementId]
                );
                if (!placementConfigs[id]) {
                  setPlacementConfigs(prev => ({ ...prev, [id]: { type: 'qr', size: 'medium' } }));
                }
              }}
              onTypeChange={(id, type) => {
                setPlacementConfigs(prev => ({ ...prev, [id]: { ...prev[id], type } }));
              }}
              onSizeChange={(id, size) => {
                setPlacementConfigs(prev => ({ ...prev, [id]: { ...prev[id], size } }));
              }}
              showTypeToggle={true}
              productTitle={selectedProduct.name}
            />
          )}
          {currentStep === 'header-footer' && (
            <HeaderFooterEditor
              headerStyle={headerStyle}
              onHeaderChange={(updates) => setHeaderStyle(prev => ({ ...prev, ...updates }))}
              footerStyle={footerStyle}
              onFooterChange={(updates) => setFooterStyle(prev => ({ ...prev, ...updates }))}
            />
          )}
          {currentStep === 'background' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-white mb-2">Background Image</h2>
                <p className="text-slate-400">Choose from the library or upload your own</p>
              </div>
              
              <Button
                variant="outline"
                size="lg"
                className="w-full h-16 text-lg"
                onClick={() => setShowBackgroundLibrary(true)}
                data-testid="button-open-background-library"
              >
                <Library className="w-5 h-5 mr-2" />
                Open Background Library
              </Button>
              
              {urlGraphic && (
                <div className="relative">
                  <div className="aspect-[9/16] max-w-[200px] mx-auto rounded-lg overflow-hidden border-2 border-primary">
                    <img 
                      src={urlGraphic} 
                      alt="Selected background" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-2 right-2"
                    onClick={() => setUrlGraphic('')}
                    data-testid="button-clear-background"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <p className="text-center text-sm text-slate-400 mt-2">Background selected</p>
                </div>
              )}
              
              {showBackgroundLibrary && user?.id && (
                <BackgroundLibraryPicker
                  memberId={user.id}
                  selectedUrl={urlGraphic}
                  onSelect={(croppedUrl, originalUrl) => {
                    setUrlGraphic(croppedUrl);
                    setOriginalUrlGraphic(originalUrl);
                    setShowBackgroundLibrary(false);
                  }}
                  onClose={() => setShowBackgroundLibrary(false)}
                  assetType="background"
                />
              )}
            </div>
          )}
          {currentStep === 'landing-page' && (
            <LandingPageEditor
              value={landingPage}
              onChange={setLandingPage}
            />
          )}
          {currentStep === 'preview' && (
            <PreviewStep 
              product={selectedProduct}
              qrType={qrType}
              headerStyle={headerStyle}
              footerStyle={footerStyle}
              background={urlGraphic}
            />
          )}
          {currentStep === 'publish' && (
            <PublishStep 
              isPublishing={isPublishing}
              onPublish={handlePublish}
              selectedChannel={selectedChannel}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-between mt-8 pt-6 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 'channel'}
            className="flex-1 min-w-[100px] sm:flex-none"
            data-testid="button-back"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          
          {currentStep !== 'publish' && (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className={`flex-1 min-w-[100px] sm:flex-none transition-all duration-300 ${
                canProceed() 
                  ? "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/40" 
                  : "bg-slate-600"
              }`}
              style={canProceed() ? { animation: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite" } : undefined}
              data-testid="button-next"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
