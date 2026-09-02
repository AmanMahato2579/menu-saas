"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  QrCode,
  Plus,
  Trash2,
  Download,
  Printer,
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
}

interface Props {
  tables: Table[];
  restaurantSlug: string;
  restaurantId: string;
}

const getAppUrl = () => {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

export default function TablesClient({ tables, restaurantSlug, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [newTableNumber, setNewTableNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const getQRUrl = (token: string) =>
    `${getAppUrl()}/r/${restaurantSlug}/t/${token}`;

  const addTable = async () => {
    const num = parseInt(newTableNumber);
    if (isNaN(num) || num < 1) {
      toast({ title: "Enter a valid table number", variant: "destructive" });
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
      toast({ title: `Table ${num} added`, variant: "success" });
      setNewTableNumber("");
      startTransition(() => router.refresh());
    } else {
      const err = await res.json();
      toast({ title: "Error", variant: "destructive", description: err.error });
    }
  };

  const deleteTable = async (id: string, num: number) => {
    if (!confirm(`Delete Table ${num}? This will close all active sessions.`)) return;
    setDeletingId(id);
    await fetch(`/api/admin/tables/${id}`, { method: "DELETE" });
    setDeletingId(null);
    toast({ title: `Table ${num} deleted`, variant: "success" });
    startTransition(() => router.refresh());
  };

  const closeSession = async (tableId: string) => {
    await fetch(`/api/admin/tables/${tableId}/close-session`, { method: "POST" });
    toast({ title: "Table session closed", variant: "success" });
    startTransition(() => router.refresh());
  };

  const downloadQR = (table: Table) => {
    const svg = document.getElementById(`qr-svg-${table.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    const url = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 500);
      ctx.drawImage(img, 50, 80, 300, 300);
      ctx.fillStyle = "#111827";
      ctx.font = "bold 22px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Table " + table.tableNumber, 200, 50);
      ctx.font = "16px Inter, sans-serif";
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Scan to view menu & order", 200, 430);
      const link = document.createElement("a");
      link.download = `table-${table.tableNumber}-qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = url;
  };

  return (
    <div className="space-y-6">
      {/* Add table */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium text-gray-700 mb-3">Add New Table</p>
          <div className="flex gap-3 max-w-xs">
            <Input
              type="number"
              placeholder="Table number"
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
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tables grid */}
      {tables.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-gray-400">
            <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No tables yet</p>
            <p className="text-sm mt-1">Add your first table above</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.map((table) => {
            const qrUrl = getQRUrl(table.qrToken);
            const hasActiveSession = table._count.tableSessions > 0;

            return (
              <Card key={table.id} className="hover:shadow-md transition-shadow overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-gray-900 text-xl">Table {table.tableNumber}</p>
                      <Badge variant={table.isActive ? "success" : "secondary"} className="mt-1">
                        {table.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {hasActiveSession && (
                      <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 rounded-full px-2 py-1">
                        <CheckCircle className="w-3 h-3" />
                        Occupied
                      </div>
                    )}
                  </div>

                  {/* QR Code */}
                  <div
                    id={`qr-container-${table.id}`}
                    className="flex justify-center p-3 bg-white rounded-lg border"
                  >
                    <QRCodeSVG
                      id={`qr-svg-${table.id}`}
                      value={qrUrl}
                      size={140}
                      level="M"
                      includeMargin
                    />
                  </div>

                  {/* URL preview */}
                  <p className="text-xs text-gray-400 truncate text-center" title={qrUrl}>
                    {qrUrl}
                  </p>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                      onClick={() => downloadQR(table)}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download
                    </Button>
                    {hasActiveSession && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-blue-600 border-blue-200"
                        onClick={() => closeSession(table.id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        New Session
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
                        <><Trash2 className="w-3 h-3 mr-1" />Delete</>
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
