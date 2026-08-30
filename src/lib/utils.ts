import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatCurrency(amount: number | string | null, currency = "Rs."): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return `${currency} ${num.toFixed(2).replace(/\.00$/, "")}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getOrderStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ACCEPTED: "bg-blue-100 text-blue-800 border-blue-200",
    PREPARING: "bg-orange-100 text-orange-800 border-orange-200",
    READY: "bg-green-100 text-green-800 border-green-200",
    COMPLETED: "bg-gray-100 text-gray-800 border-gray-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[status] ?? "bg-gray-100 text-gray-800 border-gray-200";
}

export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Pending",
    ACCEPTED: "Accepted",
    PREPARING: "Preparing",
    READY: "Ready",
    COMPLETED: "Completed",
    REJECTED: "Rejected",
  };
  return labels[status] ?? status;
}

export function generateCustomerToken(): string {
  return `ct_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
