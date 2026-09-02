"use client";

import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Percent } from "lucide-react";

const settingsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  currency: z.string().default("Rs."),
  openingHours: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  isTaxEnabled: z.boolean().default(false),
});

type SettingsForm = z.infer<typeof settingsSchema>;

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  currency: string;
  openingHours: string | null;
  logoUrl: string | null;
  taxRate: number;
  isTaxEnabled: boolean;
}

interface Props {
  restaurant: Restaurant;
}

export default function SettingsClient({ restaurant }: Props) {
  const { toast } = useToast();
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsForm>,
    defaultValues: {
      name: restaurant.name,
      description: restaurant.description ?? "",
      address: restaurant.address ?? "",
      phone: restaurant.phone ?? "",
      currency: restaurant.currency,
      openingHours: restaurant.openingHours ?? "",
      logoUrl: restaurant.logoUrl ?? "",
      taxRate: restaurant.taxRate ?? 0,
      isTaxEnabled: restaurant.isTaxEnabled ?? false,
    },
  });

  const isTaxEnabled = watch("isTaxEnabled");

  const onSubmit = async (data: SettingsForm) => {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, logoUrl: data.logoUrl || null }),
    });
    if (res.ok) {
      toast({ title: "Settings saved!", variant: "success" });
    } else {
      toast({ title: "Error saving settings", variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Restaurant Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Restaurant Name *</Label>
              <Input placeholder="My Restaurant" {...register("name")} />
              {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Description</Label>
              <Textarea placeholder="Tell customers about your restaurant" rows={3} {...register("description")} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+977 980-000-0000" {...register("phone")} />
            </div>
            <div className="space-y-1.5">
              <Label>Currency Symbol</Label>
              <Input placeholder="Rs." {...register("currency")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Address</Label>
              <Input placeholder="Thamel, Kathmandu" {...register("address")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Opening Hours</Label>
              <Input placeholder="Mon–Sun: 10:00 AM – 10:00 PM" {...register("openingHours")} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Logo URL</Label>
              <Input type="url" placeholder="https://example.com/logo.png" {...register("logoUrl")} />
            </div>

            {/* Tax Settings */}
            <div className="col-span-2 pt-3 border-t">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-3">
                <Percent className="w-4 h-4 text-orange-500" /> Tax Settings
              </h3>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Enable Tax on Bills</p>
                  <p className="text-xs text-gray-400 mt-0.5">Tax is added to every order total</p>
                </div>
                <Switch
                  checked={isTaxEnabled}
                  onCheckedChange={(val) => setValue("isTaxEnabled", val)}
                />
              </div>
              {isTaxEnabled && (
                <div className="space-y-1.5">
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    placeholder="13"
                    {...register("taxRate")}
                    className="max-w-xs"
                  />
                  <p className="text-xs text-gray-400">e.g. 13 for 13% VAT. Will appear on cart and bill pages.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-gray-400 mb-3">
              Restaurant slug (used in QR URLs):{" "}
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{restaurant.slug}</code>
            </p>
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-1" /> Save Settings</>
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
