import { auth } from "@/lib/auth";
import { setOrderItemStatus, serveOrderItem, setOrderItemQuantity } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("status"),
    status: z.enum(["NEW", "PREPARING", "SERVED", "CANCELLED"]),
    reason: z.string().trim().optional(),
  }),
  z.object({ action: z.literal("serve") }),
  z.object({ action: z.literal("quantity"), quantity: z.number().int().positive() }),
]);

type ApiError = Error & { code?: string };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const session = await auth();
  const restaurantId = (session?.user as { restaurantId?: string | null })?.restaurantId;
  if (!restaurantId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    let result;
    if (parsed.data.action === "status") {
      result = await setOrderItemStatus(itemId, restaurantId, parsed.data.status, parsed.data.reason);
    } else if (parsed.data.action === "serve") {
      result = await serveOrderItem(itemId, restaurantId);
    } else {
      result = await setOrderItemQuantity(itemId, restaurantId, parsed.data.quantity);
    }
    return NextResponse.json(result);
  } catch (err) {
    const e = err as ApiError;
    if (e.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ error: e.message ?? "Operation failed" }, { status: 400 });
  }
}

// Item deletion is intentionally not exposed: removing food goes through the
// status lifecycle (CANCEL) so an audit trail is preserved in the bill.
export async function DELETE(_req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Safer to refuse hard-delete of order items — use CANCEL instead.
  return NextResponse.json({ error: "Use Cancel instead of delete" }, { status: 405 });
}