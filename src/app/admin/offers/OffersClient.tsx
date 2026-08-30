"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { Pencil, Trash2, Plus, Loader2, X, Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";

const offerSchema = z.object({
  title: z.string().min(1, "Title required").max(100),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
});

type OfferForm = z.infer<typeof offerSchema>;

interface Offer {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  offers: Offer[];
  restaurantId: string;
}

export default function OffersClient({ offers, restaurantId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } =
    useForm<OfferForm>({ resolver: zodResolver(offerSchema) as unknown as Resolver<OfferForm>, defaultValues: { isActive: true } });

  const isActive = watch("isActive");

  const startEdit = (offer: Offer) => {
    setEditingId(offer.id);
    setShowForm(true);
    reset({
      title: offer.title,
      description: offer.description ?? "",
      imageUrl: offer.imageUrl ?? "",
      startDate: offer.startDate ? offer.startDate.split("T")[0] : "",
      endDate: offer.endDate ? offer.endDate.split("T")[0] : "",
      isActive: offer.isActive,
    });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    reset({ isActive: true });
  };

  const onSubmit = async (data: OfferForm) => {
    const url = editingId ? `/api/admin/offers/${editingId}` : "/api/admin/offers";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        imageUrl: data.imageUrl || null,
      }),
    });
    if (res.ok) {
      toast({ title: editingId ? "Offer updated" : "Offer created", variant: "success" });
      cancelForm();
      startTransition(() => router.refresh());
    } else {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const deleteOffer = async (id: string) => {
    if (!confirm("Delete this offer?")) return;
    await fetch(`/api/admin/offers/${id}`, { method: "DELETE" });
    toast({ title: "Offer deleted", variant: "success" });
    startTransition(() => router.refresh());
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        {offers.length === 0 && !showForm && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center text-gray-400">
              <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-gray-500">No offers yet</p>
              <p className="text-sm mt-1">Create a special promotion for your customers</p>
            </CardContent>
          </Card>
        )}
        {offers.map((offer) => (
          <Card key={offer.id} className="hover:shadow-md transition-shadow">
            <CardContent className="flex items-start gap-4 py-4 px-5">
              {offer.imageUrl && (
                <img src={offer.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{offer.title}</p>
                  <Badge variant={offer.isActive ? "success" : "secondary"}>
                    {offer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {offer.description && <p className="text-sm text-gray-500 mt-0.5">{offer.description}</p>}
                {(offer.startDate || offer.endDate) && (
                  <p className="text-xs text-gray-400 mt-1">
                    {offer.startDate ? formatDate(offer.startDate) : "Start"} →{" "}
                    {offer.endDate ? formatDate(offer.endDate) : "Ongoing"}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(offer)} className="p-2 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deleteOffer(offer.id)} className="p-2 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!showForm && (
          <Button
            onClick={() => setShowForm(true)}
            variant="outline"
            className="w-full border-dashed border-2 h-12 text-gray-500 hover:border-orange-400 hover:text-orange-500"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Offer
          </Button>
        )}
      </div>

      {showForm && (
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{editingId ? "Edit Offer" : "New Offer"}</CardTitle>
                <button onClick={cancelForm} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input placeholder="Weekend Momo Special" {...register("title")} />
                  {errors.title && <p className="text-red-500 text-xs">{errors.title.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea placeholder="20% off every Saturday and Sunday" rows={3} {...register("description")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Image URL (optional)</Label>
                  <Input type="url" placeholder="https://..." {...register("imageUrl")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Start Date</Label>
                    <Input type="date" {...register("startDate")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Date</Label>
                    <Input type="date" {...register("endDate")} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={isActive} onCheckedChange={(v) => setValue("isActive", v)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelForm}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
