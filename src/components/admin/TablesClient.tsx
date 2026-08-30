"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { QrCode, Plus, Trash2, Loader2 } from "lucide-react";

interface Table {
  id: string;
  tableNumber: number;
  qrToken: string;
  isActive: boolean;
  _count?: {
    tableSessions: number;
  };
}

interface Props {
  tables: Table[];
  restaurantSlug: string;
  restaurantId: string;
}

export default function TablesClient({ tables, restaurantSlug, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) {
      toast({ title: "Error", variant: "destructive", description: "Table number is required" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: parseInt(tableNumber) }),
      });

      if (res.status === 409) {
        toast({ title: "Error", variant: "destructive", description: "Table number already exists" });
      } else if (res.ok) {
        toast({ title: "Table created!", variant: "success" });
        setTableNumber("");
        setIsOpen(false);
        startTransition(() => router.refresh());
      } else {
        toast({ title: "Error", variant: "destructive", description: "Failed to create table" });
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive", description: "Something went wrong" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!confirm("Are you sure you want to delete this table?")) return;

    try {
      const res = await fetch(`/api/admin/tables/${tableId}`, { method: "DELETE" });
      if (res.ok) {
        toast({ title: "Table deleted", variant: "success" });
        startTransition(() => router.refresh());
      } else {
        toast({ title: "Error", variant: "destructive", description: "Failed to delete table" });
      }
    } catch (error) {
      toast({ title: "Error", variant: "destructive", description: "Something went wrong" });
    }
  };

  const generateQRUrl = (tableId: string, qrToken: string) => {
    return `${window.location.origin}/r/${restaurantSlug}/t/${qrToken}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!", variant: "success" });
  };

  if (tables.length === 0 && !isOpen) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center">
          <p className="text-gray-500 text-lg font-medium">No tables yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Create your first table to get started with QR code ordering.
          </p>
          <Button
            onClick={() => setIsOpen(true)}
            className="mt-4 bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Table
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {isOpen && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Table</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTable} className="space-y-4">
              <div>
                <Label htmlFor="tableNumber">Table Number</Label>
                <Input
                  id="tableNumber"
                  type="number"
                  min="1"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g., 1"
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting} className="bg-orange-500 hover:bg-orange-600">
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <Card key={table.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">Table {table.tableNumber}</CardTitle>
                  {table._count?.tableSessions ? (
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      {table._count.tableSessions} active
                    </Badge>
                  ) : (
                    <Badge className="mt-2 variant:outline">Inactive</Badge>
                  )}
                </div>
                {table.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTable(table.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
              <div className="bg-gray-50 p-3 rounded space-y-2">
                <p className="text-xs text-gray-600 font-medium">QR Code URL</p>
                <p className="text-xs text-gray-900 break-all font-mono">{generateQRUrl(table.id, table.qrToken)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(generateQRUrl(table.id, table.qrToken))}
                  className="w-full"
                >
                  Copy URL
                </Button>
              </div>

              <Link href={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generateQRUrl(table.id, table.qrToken))}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full" size="sm">
                  <QrCode className="w-4 h-4 mr-2" />
                  View QR Code
                </Button>
              </Link>

              {table._count?.tableSessions ? (
                <Link href={`/admin/tables/${table.id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    Manage Session
                  </Button>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {tables.length > 0 && !isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Table
        </Button>
      )}
    </div>
  );
}
