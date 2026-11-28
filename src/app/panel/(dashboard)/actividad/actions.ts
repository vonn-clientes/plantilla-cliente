"use server";

import { requireMembership } from "@/lib/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Booking, Order } from "@/lib/types";

export async function updateBookingStatus(bookingId: string, status: Booking["status"]) {
  const membership = await requireMembership();
  await query(
    "update bookings set status = $1 where id = $2 and tenant_id = $3",
    [status, bookingId, membership.tenant.id],
  );
  revalidatePath("/panel/actividad");
}

export async function updateOrderStatus(orderId: string, status: Order["status"]) {
  const membership = await requireMembership();
  await query(
    "update orders set status = $1 where id = $2 and tenant_id = $3",
    [status, orderId, membership.tenant.id],
  );
  revalidatePath("/panel/actividad");
}
