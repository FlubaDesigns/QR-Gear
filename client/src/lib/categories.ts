import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { db } from "./firebase";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryInput {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

const COLLECTION_NAME = "categories";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function getCategories(): Promise<Category[]> {
  const categoriesRef = collection(db, COLLECTION_NAME);
  const q = query(categoriesRef, orderBy("sortOrder", "asc"));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((docSnap: QueryDocumentSnapshot<DocumentData>) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      slug: data.slug,
      description: data.description || "",
      icon: data.icon || "Tag",
      sortOrder: data.sortOrder || 0,
      isActive: data.isActive !== false,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  });
}

export async function getActiveCategories(): Promise<Category[]> {
  const categories = await getCategories();
  return categories.filter(cat => cat.isActive);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name,
    slug: data.slug,
    description: data.description || "",
    icon: data.icon || "Tag",
    sortOrder: data.sortOrder || 0,
    isActive: data.isActive !== false,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

export async function createCategory(input: CategoryInput): Promise<string> {
  const categoriesRef = collection(db, COLLECTION_NAME);
  
  const categories = await getCategories();
  const maxOrder = categories.length > 0 
    ? Math.max(...categories.map(c => c.sortOrder)) 
    : 0;

  const docRef = await addDoc(categoriesRef, {
    name: input.name,
    slug: input.slug || generateSlug(input.name),
    description: input.description || "",
    icon: input.icon || "Tag",
    sortOrder: input.sortOrder ?? maxOrder + 1,
    isActive: input.isActive !== false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  
  return docRef.id;
}

export async function updateCategory(id: string, input: Partial<CategoryInput>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  
  const updateData: { [key: string]: string | number | boolean | Timestamp } = {
    updatedAt: Timestamp.now(),
  };
  
  if (input.name !== undefined) updateData.name = input.name;
  if (input.slug !== undefined) updateData.slug = input.slug;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.icon !== undefined) updateData.icon = input.icon;
  if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) updateData.isActive = input.isActive;
  
  if (input.name && !input.slug) {
    updateData.slug = generateSlug(input.name);
  }
  
  await updateDoc(docRef, updateData);
}

export async function deleteCategory(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

export async function seedDefaultCategories(): Promise<void> {
  const existing = await getCategories();
  if (existing.length > 0) return;

  const defaultCategories: CategoryInput[] = [
    { name: "Religious", icon: "Church", description: "Faith-based and spiritual items" },
    { name: "Political", icon: "Flag", description: "Political and patriotic merchandise" },
    { name: "Sports", icon: "Trophy", description: "Sports team and athletic gear" },
    { name: "Business", icon: "Briefcase", description: "Professional and corporate items" },
    { name: "Entertainment", icon: "Music", description: "Music, movies, and pop culture" },
    { name: "Custom", icon: "Palette", description: "Fully customizable designs" },
  ];

  for (const cat of defaultCategories) {
    await createCategory(cat);
  }
}
