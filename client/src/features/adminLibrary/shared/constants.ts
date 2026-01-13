import type { CustomDesign } from "@shared/schema";

export const TEMPLATE_CATEGORIES = [
  { value: "religious", label: "Religious" },
  { value: "business", label: "Business" },
  { value: "sports", label: "Sports" },
  { value: "entertainment", label: "Entertainment" },
  { value: "holiday", label: "Holiday" },
  { value: "custom", label: "Custom" },
] as const;

export const SEASONS = [
  { value: "none", label: "No Season" },
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
] as const;

export const EVENTS = [
  { value: "none", label: "No Event" },
  { value: "christmas", label: "Christmas" },
  { value: "easter", label: "Easter" },
  { value: "thanksgiving", label: "Thanksgiving" },
  { value: "valentines", label: "Valentine's Day" },
  { value: "mothers-day", label: "Mother's Day" },
  { value: "fathers-day", label: "Father's Day" },
  { value: "independence-day", label: "Independence Day" },
  { value: "new-year", label: "New Year" },
  { value: "halloween", label: "Halloween" },
  { value: "graduation", label: "Graduation" },
  { value: "birthday", label: "Birthday" },
  { value: "wedding", label: "Wedding" },
  { value: "anniversary", label: "Anniversary" },
] as const;

export function getDesignImageUrl(design: CustomDesign): string | null {
  if (design.backgroundImageUrl) return design.backgroundImageUrl;
  const placementImages = design.placementImages as Record<string, string> | null;
  if (placementImages) {
    const firstKey = Object.keys(placementImages).find(k => !k.endsWith('-white'));
    if (firstKey) return placementImages[firstKey];
    const anyKey = Object.keys(placementImages)[0];
    if (anyKey) return placementImages[anyKey];
  }
  return null;
}
