"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/i18n";
import {
  QrCode,
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle,
} from "lucide-react";

interface Table {
  id: string;
  tableNumber: number;
  qrToken: string;
  isActive: boolean;
  _count: { tableSessions: number };
  tableSessions: { id: string; customerName: string | null; applyTax: boolean; applyServiceCharge: boolean }[];
}

interface Props {
  tables: Table[];
  restaurantSlug: string;
  restaurantName: string;
  language?: string;
}

const getAppUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

// ─── QR poster helpers ─────────────────────────────────────────────────────────

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  maxWidth = 760
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (ctx.measureText(text).width > maxWidth) {
    let size = parseInt(font.match(/(\d+)px/)?.[1] ?? "40", 10);
    let fitted = text;
    while (size > 12 && ctx.measureText(fitted).width > maxWidth) {
      size -= 2;
      ctx.font = font.replace(/(\d+)px/, `${size}px`);
      fitted = text.length > 3 ? `${text.slice(0, -2)}…` : fitted;
    }
    text = fitted;
    ctx.font = font.replace(/(\d+)px/, `${size}px`);
  }
  ctx.fillText(text, x, y);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
  color: string
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
}

async function generateQrPoster(qrUrl: string, tableNumber: number, restaurantName: string) {
  const W = 1000;
  const H = 1400;

  // High-res QR code (pure black on a white card for maximum contrast/scannability).
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    margin: 2,
    width: 640,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Dark background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0f19");
  bg.addColorStop(0.5, "#101726");
  bg.addColorStop(1, "#0b0f19");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow behind the QR card
  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 480);
  glow.addColorStop(0, "rgba(255, 107, 53, 0.18)");
  glow.addColorStop(1, "rgba(255, 107, 53, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Top accent line
  ctx.fillStyle = "#ff6b35";
  ctx.fillRect(0, 0, W, 12);

  // Brand header
  drawCenteredText(ctx, restaurantName, W / 2, 130, "800 58px Inter, sans-serif", "#ffffff", 820);
  drawCenteredText(ctx, "DIGITAL MENU — ORDER FROM YOUR TABLE", W / 2, 205, "600 26px Inter, sans-serif", "#8b93a7", 760);

  // White QR card (keeps a proper quiet zone around the code)
  const cardX = 100;
  const cardY = 260;
  const cardW = W - 200;
  const cardH = 760;

  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 12;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // QR image inside the white card
  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise((resolve, reject) => {
    qrImg.onload = resolve;
    qrImg.onerror = reject;
  });
  const qrSize = 560;
  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = cardY + 84;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Table label inside the card (below the QR, inside quiet margin)
  drawCenteredText(ctx, `TABLE ${tableNumber}`, W / 2, cardY + cardH - 52, "800 40px Inter, sans-serif", "#0b0f19");

  // Bottom section
  wrapText(
    ctx,
    "Scan with your phone camera to view the menu & place your order",
    W / 2,
    H - 220,
    680,
    40,
    "500 26px Inter, sans-serif",
    "#c6cbd8"
  );

  // Footer divider + brand
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(250, H - 150, W - 500, 1);
  drawCenteredText(ctx, "Powered by MenuQR", W / 2, H - 92, "600 24px Inter, sans-serif", "#6c7488");

  return canvas;
}

export default function TablesClient({ tables, restaurantSlug, restaurantName, language = "EN" }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const lang = language;
  const [newTableNumber, setNewTableNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const getQRUrl = (token: string) =>
    `${getAppUrl()}/r/${restaurantSlug}/t/${token}`;

  const addTable = async () => {
    const num = parseInt(newTableNumber);
    if (isNaN(num) || num < 1) {
      toast({ title: t(lang, "Enter a valid table number", "मान्य टेबल नम्बर प्रविष्ट गर्नुहोस्"), variant: "destructive" });
      return;
    }
    setAdding(true);
    const res = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tableNumber: num }),
    });
    setAdding(false);
    if (res.ok) {
      toast({ title: `${t(lang, "Table", "टेबल")} ${num} ${t(lang, "added", "थपियो")}`, variant: "success" });
      setNewTableNumber("");
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: t(lang, "Error", "त्रुटि"), variant: "destructive", description: err.error });
    }
  };

  const deleteTable = async (id: string, num: number) => {
    if (!confirm(t(lang, `Delete Table ${num}? This will close all active sessions.`, `टेबल ${num} मेट्ने हो? यसले सबै चालू सेसनहरू बन्द गर्नेछ।`))) return;
    setDeletingId(id);
    await fetch(`/api/admin/tables/${id}`, { method: "DELETE" });
    setDeletingId(null);
    toast({ title: `${t(lang, "Table", "टेबल")} ${num} ${t(lang, "deleted", "मेटियो")}`, variant: "success" });
    startTransition(() => router.refresh());
  };

  const closeSession = async (tableId: string) => {
    await fetch(`/api/admin/tables/${tableId}/close-session`, { method: "POST" });
    toast({ title: t(lang, "Table session closed", "टेबल सेसन बन्द भयो"), variant: "success" });
    startTransition(() => router.refresh());
  };
  const toggleCharge = async (tableId: string, key: "applyTax" | "applyServiceCharge", value: boolean) => {
    await fetch(`/api/admin/tables/${tableId}/session-charges`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: value }) });
    startTransition(() => router.refresh());
  };

  const downloadQR = async (table: Table) => {
    if (downloadingId === table.id) return;
    setDownloadingId(table.id);
    try {
      const qrUrl = getQRUrl(table.qrToken);
      const poster = await generateQrPoster(qrUrl, table.tableNumber, restaurantName);
      if (!poster) throw new Error("Could not render QR poster");
      const link = document.createElement("a");
      link.download = `table-${table.tableNumber}-qr.png`;
      link.href = poster.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("[QR Poster Error]:", err);
      toast({ title: t(lang, "Error", "त्रुटि"), variant: "destructive", description: t(lang, "Could not generate QR poster.", "QR पोस्टर बनाउन सकिएन।") });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add table */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">{t(lang, "Add New Table", "नयाँ टेबल थप्नुहोस्")}</p>
          <div className="flex gap-3 max-w-xs">
            <Input
              type="number"
              placeholder={t(lang, "Table number", "टेबल नम्बर")}
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTable()}
              min="1"
            />
            <Button
              onClick={addTable}
              disabled={adding}
              className="bg-orange-500 hover:bg-orange-600 text-white shrink-0"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> {t(lang, "Add", "थप्नुहोस्")}</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tables grid */}
      {tables.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-gray-400">
            <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">{t(lang, "No tables yet", "अहिलेसम्म कुनै टेबल छैन")}</p>
            <p className="text-sm mt-1">{t(lang, "Add your first table above", "माथि आफ्नो पहिलो टेबल थप्नुहोस्")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((table) => {
            const qrUrl = getQRUrl(table.qrToken);
            const hasActiveSession = table._count.tableSessions > 0;
            const activeSession = table.tableSessions[0];

            return (
              <Card key={table.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-xl">{t(lang, "Table", "टेबल")} {table.tableNumber}</p>
                      <Badge variant={table.isActive ? "success" : "secondary"} className="mt-1">
                        {table.isActive ? t(lang, "Active", "सक्रिय") : t(lang, "Inactive", "निष्क्रिय")}
                      </Badge>
                    </div>
                    {hasActiveSession && (
                      <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 rounded-full px-2 py-1">
                        <CheckCircle className="w-3 h-3" />
                        {t(lang, "Occupied", "भरिएको")}
                      </div>
                    )}
                  </div>

                  {/* QR Code */}
                  <div
                    id={`qr-container-${table.id}`}
                    className="flex justify-center p-4 bg-white rounded-2xl border-2 border-gray-200 shadow-sm"
                  >
                    <QRCodeSVG
                      id={`qr-svg-${table.id}`}
                      value={qrUrl}
                      size={200}
                      level="L"
                      bgColor="#FFFFFF"
                      fgColor="#000000"
                      marginSize={2}
                      title={`${t(lang, "Scan to open menu — Table", "स्क्यान गर्नुहोस् — टेबल")} ${table.tableNumber}`}
                    />
                  </div>

                  {/* URL preview */}
                  <p className="text-xs text-gray-400 truncate text-center" title={qrUrl}>
                    {qrUrl}
                  </p>

                  {/* Actions */}
                  {activeSession && <div className="text-xs rounded-lg bg-gray-50 p-2 space-y-1"><p className="font-medium">{t(lang, "Final bill charges", "अन्तिम बिल शुल्कहरू")}</p><label className="flex gap-2"><input type="checkbox" checked={activeSession.applyTax} onChange={(e) => toggleCharge(table.id, "applyTax", e.target.checked)} /> {t(lang, "VAT / tax", "भ्याट / कर")}</label><label className="flex gap-2"><input type="checkbox" checked={activeSession.applyServiceCharge} onChange={(e) => toggleCharge(table.id, "applyServiceCharge", e.target.checked)} /> {t(lang, "Service charge", "सेवा शुल्क")}</label></div>}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                      onClick={() => downloadQR(table)}
                      disabled={downloadingId === table.id}
                    >
                      {downloadingId === table.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      {t(lang, "Download", "डाउनलोड")}
                    </Button>
                    {hasActiveSession && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-blue-600 border-blue-200"
                        onClick={() => closeSession(table.id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        {t(lang, "New Session", "नयाँ सेसन")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => deleteTable(table.id, table.tableNumber)}
                      disabled={deletingId === table.id}
                    >
                      {deletingId === table.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><Trash2 className="w-3 h-3 mr-1" />{t(lang, "Delete", "मेट्नुहोस्")}</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
