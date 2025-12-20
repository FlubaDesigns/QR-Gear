import { useState, useEffect, useCallback } from "react";

interface GuestCartItem {
  id: string;
  productId: string;
  quantity: number;
  price: string;
  customization: Record<string, unknown>;
  addedAt: string;
}

const GUEST_CART_KEY = "qrgear_guest_cart";

export function useGuestCart() {
  const [guestItems, setGuestItems] = useState<GuestCartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(GUEST_CART_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setGuestItems(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load guest cart:", e);
    }
  }, []);

  const saveToStorage = useCallback((items: GuestCartItem[]) => {
    try {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save guest cart:", e);
    }
  }, []);

  const addItem = useCallback((item: Omit<GuestCartItem, "id" | "addedAt">) => {
    const newItem: GuestCartItem = {
      ...item,
      id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date().toISOString(),
    };
    setGuestItems((prev) => {
      const updated = [...prev, newItem];
      saveToStorage(updated);
      return updated;
    });
    return newItem;
  }, [saveToStorage]);

  const removeItem = useCallback((id: string) => {
    setGuestItems((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setGuestItems((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, quantity } : item
      );
      saveToStorage(updated);
      return updated;
    });
  }, [saveToStorage]);

  const clearCart = useCallback(() => {
    setGuestItems([]);
    try {
      localStorage.removeItem(GUEST_CART_KEY);
    } catch (e) {
      console.error("Failed to clear guest cart:", e);
    }
  }, []);

  const getItems = useCallback((): GuestCartItem[] => {
    return guestItems;
  }, [guestItems]);

  const hasItems = guestItems.length > 0;
  const itemCount = guestItems.length;

  return {
    guestItems,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getItems,
    hasItems,
    itemCount,
  };
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
    } catch (e) {
      console.error("Failed to merge cart item:", e);
      failed++;
    }
  }

  if (merged > 0) {
    try {
      localStorage.removeItem(GUEST_CART_KEY);
    } catch (e) {
      console.error("Failed to clear guest cart after merge:", e);
    }
  }

  return { merged, failed };
}

export type { GuestCartItem };
