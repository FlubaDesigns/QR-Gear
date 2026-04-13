import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";

const GUEST_CART_KEY = "qrgear_guest_cart";

export interface GuestCartItem {
  id: string;
  productId: string;
  quantity: number;
  price: string;
  customization: Record<string, unknown>;
  addedAt: string;
}

interface CartContextValue {
  items: GuestCartItem[];
  addItem: (item: Omit<GuestCartItem, "id" | "addedAt">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
}

function getLineKey(item: Pick<GuestCartItem, "productId" | "customization">): string {
  const color = (item.customization?.productColor as string) ?? "";
  const size = (item.customization?.productSize as string) ?? "";
  return `${item.productId}::${color}::${size}`;
}

function readStorage(): GuestCartItem[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function writeStorage(items: GuestCartItem[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {}
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<GuestCartItem[]>(() => readStorage());
  const writingRef = useRef(false);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== GUEST_CART_KEY || writingRef.current) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : [];
        if (Array.isArray(parsed)) setItems(parsed);
      } catch {}
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const persist = useCallback((updated: GuestCartItem[]) => {
    writingRef.current = true;
    writeStorage(updated);
    requestAnimationFrame(() => { writingRef.current = false; });
  }, []);

  const addItem = useCallback((incoming: Omit<GuestCartItem, "id" | "addedAt">) => {
    const key = getLineKey(incoming);
    setItems(prev => {
      const idx = prev.findIndex(item => getLineKey(item) === key);
      let updated: GuestCartItem[];
      if (idx >= 0) {
        updated = prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + incoming.quantity } : item
        );
      } else {
        const full: GuestCartItem = {
          ...incoming,
          id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          addedAt: new Date().toISOString(),
        };
        updated = [...prev, full];
      }
      persist(updated);
      return updated;
    });
  }, [persist]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems(prev => {
      const updated = quantity <= 0
        ? prev.filter(item => item.id !== id)
        : prev.map(item => item.id === id ? { ...item, quantity } : item);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const clearCart = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(GUEST_CART_KEY); } catch {}
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export async function mergeGuestCartOnLogin(
  guestItems: GuestCartItem[],
  addToServerCart: (item: Omit<GuestCartItem, "id" | "addedAt">) => Promise<void>
): Promise<{ merged: number; failed: number }> {
  let merged = 0;
  let failed = 0;
  for (const item of guestItems) {
    try {
      await addToServerCart({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        customization: item.customization,
      });
      merged++;
    } catch {
      failed++;
    }
  }
  return { merged, failed };
}
