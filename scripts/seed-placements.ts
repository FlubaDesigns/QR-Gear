import { db } from "../server/db";
import { canonicalPlacements, podProviders, providerPlacementMappings } from "../shared/schema";

/**
 * Seed script for the provider-agnostic placement system
 * Run with: npx tsx scripts/seed-placements.ts
 */

const CANONICAL_PLACEMENTS = [
  // Apparel - Front placements
  {
    id: "FRONT_CHEST",
    label: "Front Chest",
    description: "Upper chest area, typically logo or small design placement",
    category: "apparel",
    previewX: "0.5",
    previewY: "0.32",
    previewScale: "0.22",
    sortOrder: 1,
  },
  {
    id: "FRONT_CENTER",
    label: "Front Center",
    description: "Full front center, large design placement",
    category: "apparel",
    previewX: "0.5",
    previewY: "0.45",
    previewScale: "0.35",
    sortOrder: 2,
  },
  {
    id: "FRONT_POCKET",
    label: "Front Pocket",
    description: "Left chest pocket area",
    category: "apparel",
    previewX: "0.35",
    previewY: "0.35",
    previewScale: "0.12",
    sortOrder: 3,
  },
  // Apparel - Back placements
  {
    id: "BACK_FULL",
    label: "Full Back",
    description: "Full back area, large design placement",
    category: "apparel",
    previewX: "0.5",
    previewY: "0.45",
    previewScale: "0.4",
    sortOrder: 10,
  },
  {
    id: "BACK_UPPER",
    label: "Upper Back",
    description: "Upper back/neck area, typically name or number",
    category: "apparel",
    previewX: "0.5",
    previewY: "0.25",
    previewScale: "0.25",
    sortOrder: 11,
  },
  // Apparel - Sleeve placements
  {
    id: "LEFT_SLEEVE",
    label: "Left Sleeve",
    description: "Left sleeve, small design or logo",
    category: "apparel",
    previewX: "0.15",
    previewY: "0.35",
    previewScale: "0.1",
    sortOrder: 20,
  },
  {
    id: "RIGHT_SLEEVE",
    label: "Right Sleeve",
    description: "Right sleeve, small design or logo",
    category: "apparel",
    previewX: "0.85",
    previewY: "0.35",
    previewScale: "0.1",
    sortOrder: 21,
  },
  // Headwear placements
  {
    id: "HAT_FRONT",
    label: "Hat Front",
    description: "Front panel of cap/hat",
    category: "headwear",
    previewX: "0.5",
    previewY: "0.4",
    previewScale: "0.4",
    sortOrder: 30,
  },
  {
    id: "HAT_BACK",
    label: "Hat Back",
    description: "Back panel or strap area",
    category: "headwear",
    previewX: "0.5",
    previewY: "0.5",
    previewScale: "0.25",
    sortOrder: 31,
  },
  // Hoodie-specific placements
  {
    id: "HOOD_FRONT",
    label: "Hood Front",
    description: "Front of hood when down",
    category: "apparel",
    previewX: "0.5",
    previewY: "0.15",
    previewScale: "0.15",
    sortOrder: 40,
  },
  {
    id: "HOOD_BACK",
    label: "Hood Back",
    description: "Back of hood when up",
    category: "apparel",
    previewX: "0.5",
    previewY: "0.12",
    previewScale: "0.18",
    sortOrder: 41,
  },
  // Drinkware placements
  {
    id: "MUG_WRAP",
    label: "Mug Wrap",
    description: "Full wrap around mug",
    category: "drinkware",
    previewX: "0.5",
    previewY: "0.5",
    previewScale: "0.6",
    sortOrder: 50,
  },
  {
    id: "MUG_FRONT",
    label: "Mug Front",
    description: "Front face of mug",
    category: "drinkware",
    previewX: "0.5",
    previewY: "0.5",
    previewScale: "0.35",
    sortOrder: 51,
  },
  // Bag placements
  {
    id: "BAG_FRONT",
    label: "Bag Front",
    description: "Front panel of tote/bag",
    category: "bags",
    previewX: "0.5",
    previewY: "0.5",
    previewScale: "0.5",
    sortOrder: 60,
  },
  // Phone case placements
  {
    id: "CASE_BACK",
    label: "Case Back",
    description: "Back of phone case",
    category: "accessories",
    previewX: "0.5",
    previewY: "0.5",
    previewScale: "0.7",
    sortOrder: 70,
  },
];

const POD_PROVIDERS = [
  {
    id: "printify",
    name: "Printify",
    websiteUrl: "https://printify.com",
    apiBaseUrl: "https://api.printify.com/v1",
    supportsWhiteLabel: true,
    supportsRush: false,
    averageShipDays: 5,
    isActive: true,
    healthStatus: "healthy",
  },
  {
    id: "printful",
    name: "Printful",
    websiteUrl: "https://www.printful.com",
    apiBaseUrl: "https://api.printful.com",
    supportsWhiteLabel: true,
    supportsRush: true,
    averageShipDays: 4,
    isActive: false,
    healthStatus: "unknown",
  },
  {
    id: "gooten",
    name: "Gooten",
    websiteUrl: "https://www.gooten.com",
    apiBaseUrl: "https://api.gooten.com",
    supportsWhiteLabel: true,
    supportsRush: false,
    averageShipDays: 6,
    isActive: false,
    healthStatus: "unknown",
  },
  {
    id: "spod",
    name: "SPOD",
    websiteUrl: "https://www.spod.com",
    apiBaseUrl: "https://api.spod.com",
    supportsWhiteLabel: false,
    supportsRush: true,
    averageShipDays: 3,
    isActive: false,
    healthStatus: "unknown",
  },
];

// Printify placement mappings - maps their placement keys to our canonical IDs
const PRINTIFY_PLACEMENT_MAPPINGS = [
  { canonicalPlacementId: "FRONT_CHEST", providerPlacementKey: "front" },
  { canonicalPlacementId: "FRONT_CENTER", providerPlacementKey: "front" },
  { canonicalPlacementId: "FRONT_POCKET", providerPlacementKey: "front_pocket" },
  { canonicalPlacementId: "BACK_FULL", providerPlacementKey: "back" },
  { canonicalPlacementId: "BACK_UPPER", providerPlacementKey: "back" },
  { canonicalPlacementId: "LEFT_SLEEVE", providerPlacementKey: "left_sleeve" },
  { canonicalPlacementId: "RIGHT_SLEEVE", providerPlacementKey: "right_sleeve" },
  { canonicalPlacementId: "HAT_FRONT", providerPlacementKey: "front" },
  { canonicalPlacementId: "HAT_BACK", providerPlacementKey: "back" },
  { canonicalPlacementId: "HOOD_FRONT", providerPlacementKey: "hood_front" },
  { canonicalPlacementId: "HOOD_BACK", providerPlacementKey: "hood_back" },
  { canonicalPlacementId: "MUG_WRAP", providerPlacementKey: "wrap" },
  { canonicalPlacementId: "MUG_FRONT", providerPlacementKey: "front" },
  { canonicalPlacementId: "BAG_FRONT", providerPlacementKey: "front" },
  { canonicalPlacementId: "CASE_BACK", providerPlacementKey: "back" },
];

async function seedPlacements() {
  console.log("🌱 Seeding canonical placements...");
  
  for (const placement of CANONICAL_PLACEMENTS) {
    await db
      .insert(canonicalPlacements)
      .values(placement)
      .onConflictDoUpdate({
        target: canonicalPlacements.id,
        set: {
          label: placement.label,
          description: placement.description,
          category: placement.category,
          previewX: placement.previewX,
          previewY: placement.previewY,
          previewScale: placement.previewScale,
          sortOrder: placement.sortOrder,
        },
      });
    console.log(`  ✓ ${placement.id}: ${placement.label}`);
  }
  
  console.log(`\n🏭 Seeding POD providers...`);
  
  for (const provider of POD_PROVIDERS) {
    await db
      .insert(podProviders)
      .values(provider)
      .onConflictDoUpdate({
        target: podProviders.id,
        set: {
          name: provider.name,
          websiteUrl: provider.websiteUrl,
          apiBaseUrl: provider.apiBaseUrl,
          supportsWhiteLabel: provider.supportsWhiteLabel,
          supportsRush: provider.supportsRush,
          averageShipDays: provider.averageShipDays,
          isActive: provider.isActive,
        },
      });
    console.log(`  ✓ ${provider.id}: ${provider.name} (${provider.isActive ? "active" : "inactive"})`);
  }
  
  console.log(`\n🔗 Seeding Printify placement mappings...`);
  
  for (const mapping of PRINTIFY_PLACEMENT_MAPPINGS) {
    await db
      .insert(providerPlacementMappings)
      .values({
        podProviderId: "printify",
        canonicalPlacementId: mapping.canonicalPlacementId,
        providerPlacementKey: mapping.providerPlacementKey,
      })
      .onConflictDoNothing();
    console.log(`  ✓ ${mapping.canonicalPlacementId} → printify:${mapping.providerPlacementKey}`);
  }
  
  console.log("\n✅ Placement seeding complete!");
}

seedPlacements()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
