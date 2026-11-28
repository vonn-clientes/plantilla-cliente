"use server";

import { requireMembership } from "@/lib/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function markMessageRead(messageId: string) {
  const membership = await requireMembership();
  await query(
    "update contact_messages set is_read = $1 where id = $2 and tenant_id = $3",
    [true, messageId, membership.tenant.id],
  );
  revalidatePath("/panel/mensajes");
}
