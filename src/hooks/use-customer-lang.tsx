"use client";

import { useEffect, useState } from "react";

// Customer-chosen language is stored per restaurant so each guest can read the
// menu in their own language — independent of the owner's admin setting. The
// owner-selected restaurant.language is only the DEFAULT.

const PREFIX = "menuqr_customer_lang_";

export function customerLangKey(restaurantId: string): string {
  return `${PREFIX}${restaurantId}`;
}

function normalize(lang?: string | null): string {
  return lang === "NEP" ? "NEP" : "EN";
}

/**
 * Returns the effective customer UI language (defaults to the restaurant's
 * configured language) plus a setter that persists the guest's own choice.
 */
export function useCustomerLanguage(restaurantId: string, defaultLang?: string | null) {
  const [lang, setLangState] = useState<string>(() => normalize(defaultLang));

  useEffect(() => {
    // Deferred to satisfy React Compiler (no sync setState inside an effect).
    const id = setTimeout(() => {
      try {
        const saved = localStorage.getItem(customerLangKey(restaurantId));
        if (saved === "NEP" || saved === "EN") {
          setLangState(saved);
        }
      } catch {
        // localStorage unavailable — keep default
      }
    }, 0);
    return () => clearTimeout(id);
  }, [restaurantId, defaultLang]);

  const setLang = (next: string) => {
    const value = normalize(next);
    setLangState(value);
    try {
      localStorage.setItem(customerLangKey(restaurantId), value);
    } catch {
      // ignore
    }
  };

  return [lang, setLang] as const;
}

export interface LanguageToggleProps {
  lang: string;
  onChange: (lang: string) => void;
  /** Dark backgrounds (hero) vs. light backgrounds (white headers). */
  variant?: "dark" | "light";
}

/** Small EN / नेपाली switch used in the customer pages. */
export function LanguageToggle({ lang, onChange, variant = "dark" }: LanguageToggleProps) {
  const dark = variant === "dark";
  return (
    <div className={`inline-flex items-center rounded-full p-0.5 text-xs font-semibold border ${dark ? "border-white/30 bg-white/20" : "border-gray-200 bg-gray-100"}`}>
      <button
        onClick={() => onChange("EN")}
        className={`px-2.5 py-1 rounded-full transition-colors ${lang === "EN" ? (dark ? "bg-white text-gray-900" : "bg-gray-900 text-white") : dark ? "text-white hover:bg-white/20" : "text-gray-500 hover:bg-white"}`}
      >
        EN
      </button>
      <button
        onClick={() => onChange("NEP")}
        className={`px-2.5 py-1 rounded-full transition-colors ${lang === "NEP" ? (dark ? "bg-white text-gray-900" : "bg-gray-900 text-white") : dark ? "text-white hover:bg-white/20" : "text-gray-500 hover:bg-white"}`}
      >
        ने
      </button>
    </div>
  );
}