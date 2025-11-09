import { storage } from "../storage";
import type { InsertProduct } from "@shared/schema";

const sampleProducts: InsertProduct[] = [
  {
    id: "prod-tshirt-white",
    printifyId: null,
    name: "Premium T-Shirt",
    description: "100% cotton, comfortable fit",
    category: "apparel",
    basePrice: "24.99",
    imageUrl: "/assets/generated_images/Product_mockup_white_tee_de332d78.png",
    manufacturer: "American Apparel",
    madeInUSA: true,
    availablePlacements: ["front-chest", "front-pocket", "back", "left-shoulder", "right-shoulder"],
    availableColors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
      { name: "Gray", hex: "#808080" },
    ],
    metadata: {},
  },
  {
    id: "prod-hat-black",
    printifyId: null,
    name: "Baseball Cap",
    description: "Adjustable, one size fits most",
    category: "headwear",
    basePrice: "19.99",
    imageUrl: "/assets/generated_images/Phone_scanning_QR_cap_37352447.png",
    manufacturer: "Yupoong",
    madeInUSA: false,
    availablePlacements: ["front-center", "side-left", "side-right", "back"],
    availableColors: [
      { name: "Black", hex: "#000000" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Red", hex: "#FF0000" },
      { name: "Navy", hex: "#000080" },
    ],
    metadata: {},
  },
  {
    id: "prod-bag-gym",
    printifyId: null,
    name: "Gym Duffel Bag",
    description: "Spacious and durable",
    category: "bags",
    basePrice: "39.99",
    imageUrl: "/assets/generated_images/Gym_bag_QR_mockup_9450e53d.png",
    manufacturer: "Liberty Bags",
    madeInUSA: true,
    availablePlacements: ["front-center", "side-left", "side-right"],
    availableColors: [
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
      { name: "Red", hex: "#FF0000" },
    ],
    metadata: {},
  },
  {
    id: "prod-hoodie-gray",
    printifyId: null,
    name: "Classic Hoodie",
    description: "Warm and comfortable pullover",
    category: "apparel",
    basePrice: "44.99",
    imageUrl: "/assets/generated_images/Product_mockup_white_tee_de332d78.png",
    manufacturer: "Independent Trading Co.",
    madeInUSA: true,
    availablePlacements: ["front-chest", "back", "left-sleeve", "right-sleeve"],
    availableColors: [
      { name: "Gray", hex: "#808080" },
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#000080" },
    ],
    metadata: {},
  },
  {
    id: "prod-tote-canvas",
    printifyId: null,
    name: "Canvas Tote Bag",
    description: "Eco-friendly and stylish",
    category: "bags",
    basePrice: "16.99",
    imageUrl: "/assets/generated_images/Gym_bag_QR_mockup_9450e53d.png",
    manufacturer: "Econscious",
    madeInUSA: true,
    availablePlacements: ["front-center", "back"],
    availableColors: [
      { name: "Natural", hex: "#F5F5DC" },
      { name: "Black", hex: "#000000" },
    ],
    metadata: {},
  },
];

export async function seedProducts() {
  console.log("Seeding products...");
  
  for (const product of sampleProducts) {
    try {
      const existing = await storage.getProduct(product.id);
      if (!existing) {
        await storage.createProduct(product);
        console.log(`Created product: ${product.name}`);
      }
    } catch (error) {
      console.error(`Error seeding product ${product.name}:`, error);
    }
  }
  
  console.log("Product seeding complete!");
}
