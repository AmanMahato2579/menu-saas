"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
  onClose: (id: string) => void;
}

function ToastItem({ id, title, description, variant = "default", onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => onClose(id), 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 shadow-lg max-w-sm w-full",
        variant === "destructive" && "border-red-200 bg-red-50 text-red-900",
        variant === "success" && "border-green-200 bg-green-50 text-green-900",
        variant === "default" && "border-gray-200 bg-white text-gray-900"
      )}
    >
      <div className="flex-1">
        {title && <p className="font-semibold text-sm">{title}</p>}
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
      <button onClick={() => onClose(id)} className="opacity-50 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContextValue {
  toast: (props: Omit<ToastProps, "id" | "onClose">) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const toast = React.useCallback((props: Omit<ToastProps, "id" | "onClose">) => {
    const id = Math.random().toString(36).substring(2);
    setToasts((prev) => [...prev, { ...props, id, onClose: () => {} }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
