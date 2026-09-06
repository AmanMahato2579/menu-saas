// Lightweight EN / NEP ("Nepali") UI language helper.
//
// Scope: only FIXED admin UI strings (buttons, headings, status labels,
// notification templates) are translated. Menu content, forms, and restaurant
// data stay in the language they were authored in. This module is pure JS and
// imports nothing from the server so it is safe to use from client components.

export type Language = "EN" | "NEP";

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: "EN", label: "English"},
  { value: "NEP", label: "नेपाली"},
];

export function isNepali(lang?: string | null): boolean {
  return lang === "NEP";
}

/** Returns the Nepali translation when the restaurant UI language is NEP. */
export function t(lang: string | null | undefined, en: string, nep?: string): string {
  return isNepali(lang) && nep ? nep : en;
}

const STATUS_LABELS: Record<string, { en: string; nep: string }> = {
  PENDING: { en: "Pending", nep: "पेन्डिङ" },
  ACCEPTED: { en: "Accepted", nep: "स्वीकृत" },
  PREPARING: { en: "Preparing", nep: "तयारीमा" },
  READY: { en: "Ready", nep: "तयार" },
  COMPLETED: { en: "Completed", nep: "सम्पन्न" },
  REJECTED: { en: "Rejected", nep: "अस्वीकृत" },
};

export function orderStatusLabel(status: string, lang?: string | null): string {
  const entry = STATUS_LABELS[status];
  if (!entry) return status;
  return isNepali(lang) ? entry.nep : entry.en;
}

export const NEXT_ACTION_LABELS: Record<string, { en: string; nep: string }> = {
  PENDING: { en: "Accept", nep: "स्वीकार गर्नुहोस्" },
  ACCEPTED: { en: "Mark Preparing", nep: "तयारीमा चिन्ह लगाउनुहोस्" },
  PREPARING: { en: "Mark Ready", nep: "तयार चिन्ह लगाउनुहोस्" },
  READY: { en: "Mark Completed ✓", nep: "सम्पन्न चिन्ह लगाउनुहोस् ✓" },
};

export function nextActionLabel(status: string, lang?: string | null): string {
  const entry = NEXT_ACTION_LABELS[status];
  return entry ? (isNepali(lang) ? entry.nep : entry.en) : status;
}

// ─── Notification message templates (created language-aware) ────────────────

export interface OrderNotificationParams {
  orderNumber: number;
  tableNumber?: number | null;
  itemSummary: string;
}

export function newOrderTitle(lang?: string | null, orderNumber = 0): string {
  return t(lang, `New order #${orderNumber}`, `नयाँ अर्डर #${orderNumber}`);
}

export function newOrderMessage(lang?: string | null, p?: OrderNotificationParams): string {
  const body = p?.itemSummary ?? "";
  const prefix = p?.tableNumber
    ? t(lang, `Table ${p.tableNumber} — `, `टेबल ${p.tableNumber} — `)
    : "";
  return `${prefix}${body}`;
}

export function newTableSessionTitle(lang?: string | null): string {
  return t(lang, "Guest arrived — service needed", "पाहुना आइपुगे — सेवा चाहिन्छ");
}

export function newTableSessionMessage(lang?: string | null, customerName?: string | null, tableNumber?: number | null): string {
  const who = customerName?.trim()
    ? `${customerName.trim()} ${t(lang, "is", "छन्")}`
    : t(lang, "A guest is", "एक पाहुना");
  if (isNepali(lang)) {
    return `टेबल ${tableNumber ?? ""} मा ${customerName?.trim() ?? "पाहुना"} पर्खिरहेका छन्। कृपया स्वागत गर्नुहोस्।`;
  }
  return `${who} waiting at Table ${tableNumber ?? "?"}. Please greet them.`;
}

export function assistanceTitle(lang?: string | null): string {
  return t(lang, "Assistance requested", "सहायता अनुरोध");
}

export function assistanceMessage(lang?: string | null, customerName?: string | null, tableNumber?: number | null): string {
  if (isNepali(lang)) {
    return `टेबल ${tableNumber ?? ""} का ${customerName?.trim() ?? "पाहुनाले"} सहायता मागिरहेका छन्।`;
  }
  return `${customerName || "Guest"} needs help at Table ${tableNumber ?? "?"}.`;
}

export function orderRejectedTitle(lang?: string | null, orderNumber = 0): string {
  return t(lang, `Order #${orderNumber} rejected`, `अर्डर #${orderNumber} अस्वीकृत भयो`);
}

export function orderRejectedMessage(
  lang?: string | null,
  tableNumber?: number | null,
  itemSummary?: string
): string {
  const items = itemSummary ?? "";
  if (isNepali(lang)) {
    const loc = tableNumber
      ? `टेबल ${tableNumber} — `
      : "";
    return `${loc}${items}. कृपया यो अर्डर किन अस्वीकृत भयो भनेर पाहुनालाई बताउनुहोस्।`;
  }
  const loc = tableNumber ? `Table ${tableNumber} — ` : "";
  return `${loc}${items}. Please inform the customer why this order was rejected.`;
}