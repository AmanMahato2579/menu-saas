// Brand palettes a restaurant can pick from (Restaurant.brandColor).
// The actual visual mapping lives in globals.css ([data-brand="…"] blocks);
// this module only drives the picker UI + server validation. Pure TS so it is
// safe to import from both client and server code.
export interface BrandPalette {
  key: string;
  label: string;
  /** Primary accent (500 shade) shown in the picker swatch. */
  primary: string;
  /** 50 → 950 scale used for the swatch preview strip. */
  scale: string[];
}

export const BRAND_PALETTES: BrandPalette[] = [
  { key: "orange", label: "Orange", primary: "#f97316", scale: ["#fff7ed", "#ffedd5", "#fed7aa", "#fdba74", "#fb923c", "#f97316", "#ea580c", "#c2410c", "#9a3412", "#7c2d12", "#431407"] },
  { key: "amber", label: "Amber", primary: "#f59e0b", scale: ["#fffbeb", "#fef3c7", "#fde68a", "#fcd34d", "#fbbf24", "#f59e0b", "#d97706", "#b45309", "#92400e", "#78350f", "#451a03"] },
  { key: "red", label: "Red", primary: "#ef4444", scale: ["#fef2f2", "#fee2e2", "#fecaca", "#fca5a5", "#f87171", "#ef4444", "#dc2626", "#b91c1c", "#991b1b", "#7f1d1d", "#450a0a"] },
  { key: "rose", label: "Rose", primary: "#f43f5e", scale: ["#fff1f2", "#ffe4e6", "#fecdd3", "#fda4af", "#fb7185", "#f43f5e", "#e11d48", "#be123c", "#9f1239", "#881337", "#4c0519"] },
  { key: "pink", label: "Pink", primary: "#ec4899", scale: ["#fdf2f8", "#fce7f3", "#fbcfe8", "#f9a8d4", "#f472b6", "#ec4899", "#db2777", "#be185d", "#9d174d", "#831843", "#500724"] },
  { key: "purple", label: "Purple", primary: "#a855f7", scale: ["#faf5ff", "#f3e8ff", "#e9d5ff", "#d8b4fe", "#c084fc", "#a855f7", "#9333ea", "#7e22ce", "#6b21a8", "#581c87", "#3b0764"] },
  { key: "violet", label: "Violet", primary: "#8b5cf6", scale: ["#f5f3ff", "#ede9fe", "#ddd6fe", "#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6", "#4c1d95", "#2e1065"] },
  { key: "indigo", label: "Indigo", primary: "#6366f1", scale: ["#eef2ff", "#e0e7ff", "#c7d2fe", "#a5b4fc", "#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81", "#1e1b4b"] },
  { key: "blue", label: "Blue", primary: "#3b82f6", scale: ["#eff6ff", "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#172554"] },
  { key: "sky", label: "Sky", primary: "#0ea5e9", scale: ["#f0f9ff", "#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0ea5e9", "#0284c7", "#0369a1", "#075985", "#0c4a6e", "#082f49"] },
  { key: "teal", label: "Teal", primary: "#14b8a6", scale: ["#f0fdfa", "#ccfbf1", "#99f6e4", "#5eead4", "#2dd4bf", "#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a", "#042f2e"] },
  { key: "emerald", label: "Emerald", primary: "#10b981", scale: ["#ecfdf5", "#d1fae5", "#a7f3d0", "#6ee7b7", "#34d399", "#10b981", "#059669", "#047857", "#065f46", "#064e3b", "#022c22"] },
  { key: "green", label: "Green", primary: "#22c55e", scale: ["#f0fdf4", "#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a", "#15803d", "#166534", "#14532d", "#052e16"] },
];

export const BRAND_COLOR_KEYS = new Set(BRAND_PALETTES.map((p) => p.key));

/** Falls back to "orange" for unknown / missing values so invalid data never breaks the UI. */
export function validBrandColor(color?: string | null): string {
  return color && BRAND_COLOR_KEYS.has(color) ? color : "orange";
}