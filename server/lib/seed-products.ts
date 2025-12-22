import { storage } from "../storage";
import type { InsertProduct } from "@shared/schema";

const sampleProducts: InsertProduct[] = [
  {
    id: "prod-tshirt-bella",
    printifyId: "12",
    name: "Unisex Jersey T-Shirt",
    description: "Soft, premium quality Bella+Canvas unisex tee. Perfect for custom QR code designs.",
    category: "apparel",
    basePrice: "24.99",
    imageUrl: "/assets/generated_images/Product_mockup_white_tee_de332d78.png",
    manufacturer: "Bella+Canvas",
    madeInUSA: true,
    availablePlacements: ["front-chest", "front-pocket", "back", "left-shoulder", "right-shoulder"],
    availableSizes: ["XS", "S", "M", "L", "XL", "2XL", "3XL"],
    availableColors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
      { name: "Heather Gray", hex: "#9CA3AF" },
      { name: "Red", hex: "#DC2626" },
    ],
    metadata: { blueprintId: 12, type: "t-shirt" },
  },
  {
    id: "prod-tshirt-gildan",
    printifyId: "6",
    name: "Heavy Cotton T-Shirt",
    description: "Classic Gildan heavy cotton tee. Durable and affordable.",
    category: "apparel",
    basePrice: "19.99",
    imageUrl: "/assets/generated_images/Product_mockup_white_tee_de332d78.png",
    manufacturer: "Gildan",
    madeInUSA: true,
    availablePlacements: ["front-chest", "front-pocket", "back", "left-shoulder", "right-shoulder"],
    availableSizes: ["S", "M", "L", "XL", "2XL", "3XL"],
    availableColors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
      { name: "Sport Gray", hex: "#6B7280" },
    ],
    metadata: { blueprintId: 6, type: "t-shirt" },
  },
  {
    id: "prod-hat-trucker",
    printifyId: "1128",
    name: "Trucker Cap",
    description: "Classic OTTO Cap trucker style with mesh back. Great for QR code branding.",
    category: "headwear",
    basePrice: "22.99",
    imageUrl: "/assets/generated_images/Phone_scanning_QR_cap_37352447.png",
    manufacturer: "OTTO Cap",
    madeInUSA: true,
    availablePlacements: ["front-center", "side-left", "side-right", "back"],
    availableSizes: ["One Size"],
    availableColors: [
      { name: "Black/White", hex: "#000000" },
      { name: "Navy/White", hex: "#000080" },
      { name: "Red/White", hex: "#DC2626" },
      { name: "Charcoal/White", hex: "#374151" },
    ],
    metadata: { blueprintId: 1128, type: "hat" },
  },
  {
    id: "prod-hat-dad",
    printifyId: "1221",
    name: "Dad Hat with Leather Patch",
    description: "ValuCap dad hat with premium leather patch. Perfect for QR code designs.",
    category: "headwear",
    basePrice: "26.99",
    imageUrl: "/assets/generated_images/Phone_scanning_QR_cap_37352447.png",
    manufacturer: "ValuCap",
    madeInUSA: true,
    availablePlacements: ["front-center"],
    availableSizes: ["One Size"],
    availableColors: [
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
      { name: "Khaki", hex: "#C2B280" },
      { name: "Brown", hex: "#8B4513" },
    ],
    metadata: { blueprintId: 1221, type: "hat" },
  },
  {
    id: "prod-mug-11oz",
    printifyId: "68",
    name: "Ceramic Mug 11oz",
    description: "Classic ceramic mug, perfect for showcasing your QR code with every sip.",
    category: "drinkware",
    basePrice: "14.99",
    imageUrl: "/assets/generated_images/Coffee_mug_QR_code_ff2b9a12.png",
    manufacturer: "Generic",
    madeInUSA: true,
    availablePlacements: ["wrap-around", "front-center"],
    availableSizes: ["11oz"],
    availableColors: [
      { name: "White", hex: "#FFFFFF" },
    ],
    metadata: { blueprintId: 68, type: "mug" },
  },
  {
    id: "prod-mug-15oz",
    printifyId: "425",
    name: "Ceramic Mug 15oz",
    description: "Large ceramic mug for the coffee lover. More space for your QR design.",
    category: "drinkware",
    basePrice: "17.99",
    imageUrl: "/assets/generated_images/Coffee_mug_QR_code_ff2b9a12.png",
    manufacturer: "Generic",
    madeInUSA: true,
    availablePlacements: ["wrap-around", "front-center"],
    availableSizes: ["15oz"],
    availableColors: [
      { name: "White", hex: "#FFFFFF" },
    ],
    metadata: { blueprintId: 425, type: "mug" },
  },
  {
    id: "prod-tote-canvas",
    printifyId: "467",
    name: "Canvas Tote Bag",
    description: "Eco-friendly canvas tote. Great leave-behind for trade shows and events.",
    category: "bags",
    basePrice: "18.99",
    imageUrl: "/assets/generated_images/Gym_bag_QR_mockup_9450e53d.png",
    manufacturer: "Generic",
    madeInUSA: true,
    availablePlacements: ["front-center", "back"],
    availableSizes: ["One Size"],
    availableColors: [
      { name: "Natural", hex: "#F5F5DC" },
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
    ],
    metadata: { blueprintId: 467, type: "bag" },
  },
  {
    id: "prod-bag-drawstring",
    printifyId: "414",
    name: "Drawstring Bag",
    description: "Lightweight drawstring bag. Perfect for giveaways and promotions.",
    category: "bags",
    basePrice: "15.99",
    imageUrl: "/assets/generated_images/Gym_bag_QR_mockup_9450e53d.png",
    manufacturer: "Generic",
    madeInUSA: true,
    availablePlacements: ["front-center"],
    availableSizes: ["One Size"],
    availableColors: [
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Navy", hex: "#000080" },
      { name: "Red", hex: "#DC2626" },
    ],
    metadata: { blueprintId: 414, type: "bag" },
  },
];

export async function seedProducts() {
  console.log("Seeding products with Printify catalog...");
  
  for (const product of sampleProducts) {
    try {
      const existing = await storage.getProduct(product.id);
      if (!existing) {
        await storage.createProduct(product);
        console.log(`Created product: ${product.name}`);
      } else {
        console.log(`Product already exists: ${product.name}`);
      }
    } catch (error) {
      console.error(`Error seeding product ${product.name}:`, error);
    }
  }
  
  console.log("Product seeding complete!");
}
