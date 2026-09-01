import { OrderStatus, UserRole, TableSessionStatus } from "@prisma/client";

export type { OrderStatus, UserRole, TableSessionStatus };

// Cart item stored in localStorage/state
export interface CartItem {
  menuItemId: string;
  variantId?: string;
  variantName?: string;
  menuItemName: string;
  price: number;
  quantity: number;
  isSpicy: boolean;
  note: string;
}

// Public restaurant data for customer pages
export interface PublicRestaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  currency: string;
  openingHours: string | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  menuItems: PublicMenuItem[];
}

export interface PublicMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string; // Decimal serialized as string
  imageUrl: string | null;
  isAvailable: boolean;
  hasSpicyOption: boolean;
  hasNoteOption: boolean;
  displayOrder: number;
  categoryId: string;
}

export interface PublicOffer {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface PublicTable {
  id: string;
  tableNumber: number;
  isActive: boolean;
}

// Order creation payload from frontend
export interface CreateOrderPayload {
  items: {
    menuItemId: string;
    variantId?: string;
    quantity: number;
    isSpicy: boolean;
    note: string;
  }[];
  customerToken: string;
}

// Admin session user type
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId: string | null;
  restaurantSlug: string | null;
  restaurantName: string | null;
}
