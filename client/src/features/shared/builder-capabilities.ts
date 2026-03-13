import type { QRType } from "./components/wizardSteps/wizardTypes";

export interface BuilderCapabilities {
  id: string;
  label: string;
  allowedQrTypes: QRType[];
  allowTextCustomization: boolean;
  allowFontSlider: boolean;
  allowOffsets: boolean;
  allowMultiplePlacements: boolean;
  allowBackgroundUpload: boolean;
  allowVideoUpload: boolean;
  allowCompose: boolean;
  allowLandingPageEditor: boolean;
  allowQuickPublish: boolean;
  showTutorial: boolean;
  showEarnings: boolean;
  showCost: boolean;
  requiresAuth: boolean;
  checkoutFlow: "member-publish" | "owner-checkout" | "external-embed";
}

export const SUPER_SIMPLE_CAPABILITIES: BuilderCapabilities = {
  id: "super-simple",
  label: "First Product Builder",
  allowedQrTypes: ["qr-basic", "qr-plus", "qr-canvas", "qr-play", "qr-compose"],
  allowTextCustomization: true,
  allowFontSlider: false,
  allowOffsets: false,
  allowMultiplePlacements: true,
  allowBackgroundUpload: true,
  allowVideoUpload: true,
  allowCompose: true,
  allowLandingPageEditor: false,
  allowQuickPublish: false,
  showTutorial: true,
  showEarnings: true,
  showCost: false,
  requiresAuth: false,
  checkoutFlow: "member-publish",
};

export const SIMPLE_CAPABILITIES: BuilderCapabilities = {
  id: "simple",
  label: "Quick Create",
  allowedQrTypes: ["qr-basic", "qr-plus", "qr-canvas", "qr-play", "qr-compose"],
  allowTextCustomization: true,
  allowFontSlider: true,
  allowOffsets: true,
  allowMultiplePlacements: true,
  allowBackgroundUpload: true,
  allowVideoUpload: true,
  allowCompose: true,
  allowLandingPageEditor: false,
  allowQuickPublish: false,
  showTutorial: false,
  showEarnings: true,
  showCost: false,
  requiresAuth: true,
  checkoutFlow: "member-publish",
};

export const ADVANCED_CAPABILITIES: BuilderCapabilities = {
  id: "advanced",
  label: "Advanced Builder",
  allowedQrTypes: ["qr-basic", "qr-plus", "qr-canvas", "qr-play", "qr-compose"],
  allowTextCustomization: true,
  allowFontSlider: true,
  allowOffsets: true,
  allowMultiplePlacements: true,
  allowBackgroundUpload: true,
  allowVideoUpload: true,
  allowCompose: true,
  allowLandingPageEditor: true,
  allowQuickPublish: false,
  showTutorial: false,
  showEarnings: true,
  showCost: false,
  requiresAuth: true,
  checkoutFlow: "member-publish",
};

export const STUDIO_CAPABILITIES: BuilderCapabilities = {
  id: "studio",
  label: "Studio Mode",
  allowedQrTypes: ["qr-basic", "qr-plus", "qr-canvas", "qr-play", "qr-compose"],
  allowTextCustomization: true,
  allowFontSlider: true,
  allowOffsets: true,
  allowMultiplePlacements: true,
  allowBackgroundUpload: true,
  allowVideoUpload: true,
  allowCompose: true,
  allowLandingPageEditor: true,
  allowQuickPublish: true,
  showTutorial: false,
  showEarnings: true,
  showCost: false,
  requiresAuth: true,
  checkoutFlow: "member-publish",
};

export const OWNER_CAPABILITIES: BuilderCapabilities = {
  id: "owner",
  label: "Build Your Product",
  allowedQrTypes: ["qr-basic", "qr-plus", "qr-canvas", "qr-play", "qr-compose"],
  allowTextCustomization: true,
  allowFontSlider: true,
  allowOffsets: true,
  allowMultiplePlacements: true,
  allowBackgroundUpload: false,
  allowVideoUpload: false,
  allowCompose: false,
  allowLandingPageEditor: false,
  allowQuickPublish: false,
  showTutorial: false,
  showEarnings: false,
  showCost: true,
  requiresAuth: false,
  checkoutFlow: "owner-checkout",
};

export const EXTERNAL_CAPABILITIES: BuilderCapabilities = {
  id: "external",
  label: "Quick Builder",
  allowedQrTypes: ["qr-basic", "qr-plus"],
  allowTextCustomization: true,
  allowFontSlider: false,
  allowOffsets: false,
  allowMultiplePlacements: false,
  allowBackgroundUpload: false,
  allowVideoUpload: false,
  allowCompose: false,
  allowLandingPageEditor: false,
  allowQuickPublish: true,
  showTutorial: false,
  showEarnings: false,
  showCost: true,
  requiresAuth: false,
  checkoutFlow: "external-embed",
};

export const CAPABILITY_PRESETS: Record<string, BuilderCapabilities> = {
  "super-simple": SUPER_SIMPLE_CAPABILITIES,
  "simple": SIMPLE_CAPABILITIES,
  "advanced": ADVANCED_CAPABILITIES,
  "studio": STUDIO_CAPABILITIES,
  "owner": OWNER_CAPABILITIES,
  "external": EXTERNAL_CAPABILITIES,
};
