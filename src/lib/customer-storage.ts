import type { CartItem } from "@/types";

export const CART_KEY = (sessionId: string) => `cart_${sessionId}`;
export const CUSTOMER_TOKEN_KEY = "menuqr_customer_token";

/**
 * Shared customer-side storage helpers. The menu page writes the cart while
 * the cart page reads it — both MUST use the same storage engine and keys or
 * items silently disappear between pages. All storage is localStorage so the
 * cart survives refreshes and tab switches for the whole dining session.
 */
export function getOrCreateCustomerToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  if (!token) {
    token = `ct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
  }
  return token;
}

export function loadCart(sessionId: string): CartItem[] {
  if (typeof window === "undefined") return [];
  const saved = localStorage.getItem(CART_KEY(sessionId));
  if (saved) {
    try {
      return JSON.parse(saved) as CartItem[];
    } catch {
      // corrupt data — fall through to empty cart
    }
  }
  return [];
}

export function saveCart(sessionId: string, cart: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CART_KEY(sessionId), JSON.stringify(cart));
}