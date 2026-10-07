import type { ProductCategory } from "./schema";

export const PRODUCT_TAG_COLLECTION = "productCategories";
export const DEFAULT_PRODUCT_TAGS = [
        { name: "Spring", slug: "spring", taxonomyType: "season", icon: "Flower2", sortOrder: 1 },
        { name: "Summer", slug: "summer", taxonomyType: "season", icon: "Sun", sortOrder: 2 },
        { name: "Fall", slug: "fall", taxonomyType: "season", icon: "Leaf", sortOrder: 3 },
        { name: "Winter", slug: "winter", taxonomyType: "season", icon: "Snowflake", sortOrder: 4 },
        { name: "Christmas", slug: "christmas", taxonomyType: "holiday", icon: "Gift", sortOrder: 1 },
        { name: "Easter", slug: "easter", taxonomyType: "holiday", icon: "Egg", sortOrder: 2 },
        { name: "Valentine's Day", slug: "valentines", taxonomyType: "holiday", icon: "Heart", sortOrder: 3 },
        { name: "Halloween", slug: "halloween", taxonomyType: "holiday", icon: "Ghost", sortOrder: 4 },
        { name: "Thanksgiving", slug: "thanksgiving", taxonomyType: "holiday", icon: "Utensils", sortOrder: 5 },
        { name: "Fourth of July", slug: "july-4th", taxonomyType: "holiday", icon: "Flag", sortOrder: 6 },
        { name: "Mother's Day", slug: "mothers-day", taxonomyType: "holiday", icon: "Heart", sortOrder: 7 },
        { name: "Father's Day", slug: "fathers-day", taxonomyType: "holiday", icon: "Trophy", sortOrder: 8 },
        { name: "Birthday", slug: "birthday", taxonomyType: "occasion", icon: "Cake", sortOrder: 1 },
        { name: "Anniversary", slug: "anniversary", taxonomyType: "occasion", icon: "HeartHandshake", sortOrder: 2 },
        { name: "Graduation", slug: "graduation", taxonomyType: "occasion", icon: "GraduationCap", sortOrder: 3 },
        { name: "Wedding", slug: "wedding", taxonomyType: "occasion", icon: "Gem", sortOrder: 4 },
        { name: "Baby Shower", slug: "baby-shower", taxonomyType: "occasion", icon: "Baby", sortOrder: 5 },
        { name: "Religious", slug: "religious", taxonomyType: "other", icon: "Church", sortOrder: 1 },
        { name: "Sports", slug: "sports", taxonomyType: "other", icon: "Trophy", sortOrder: 2 },
        { name: "Business", slug: "business", taxonomyType: "other", icon: "Briefcase", sortOrder: 3 },
        { name: "Patriotic", slug: "patriotic", taxonomyType: "other", icon: "Flag", sortOrder: 4 },
      ];

export type ProductTag = Pick<ProductCategory, "id" | "name" | "slug" | "taxonomyType" | "isActive">;

export function parseProductTags(value: unknown): ProductTag[] {
  if (!Array.isArray(value) || value.some(tag => !tag || typeof tag.id !== "string" || typeof tag.name !== "string" || typeof tag.slug !== "string" || (tag.taxonomyType != null && typeof tag.taxonomyType !== "string") || (tag.isActive != null && typeof tag.isActive !== "boolean"))) {
    throw new Error("The tags response is invalid. Please retry.");
  }
  return value.map(tag => ({ ...tag, taxonomyType: tag.taxonomyType || "other", isActive: tag.isActive !== false }));
}
