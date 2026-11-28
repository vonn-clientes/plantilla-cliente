"use server";

import { requireMembership } from "@/lib/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addCatalogItem(formData: FormData) {
  const membership = await requireMembership();

  const priceRaw = String(formData.get("price") || "").replace(",", ".");
  const durationRaw = String(formData.get("duration_minutes") || "");

  await query(
    `insert into catalog_items (tenant_id, name, description, price, duration_minutes, category)
     values ($1, $2, $3, $4, $5, $6)`,
    [membership.tenant.id, String(formData.get("name") || ""),
     String(formData.get("description") || "") || null, priceRaw ? Number(priceRaw) : null,
     durationRaw ? Number(durationRaw) : null, String(formData.get("category") || "") || null],
  );

  revalidatePath("/panel/catalogo");
  revalidatePath("/");
}

export async function toggleCatalogItem(itemId: string, active: boolean) {
  const membership = await requireMembership();

  await query(
    "update catalog_items set active = $1 where id = $2 and tenant_id = $3",
    [active, itemId, membership.tenant.id],
  );

  revalidatePath("/panel/catalogo");
  revalidatePath("/");
}

export async function deleteCatalogItem(itemId: string) {
  const membership = await requireMembership();

  await query("delete from catalog_items where id = $1 and tenant_id = $2", [itemId, membership.tenant.id]);

  revalidatePath("/panel/catalogo");
  revalidatePath("/");
}

export async function updateCatalogItem(itemId: string, formData: FormData) {
  const membership = await requireMembership();

  const priceRaw = String(formData.get("price") || "").replace(",", ".");
  const durationRaw = String(formData.get("duration_minutes") || "");

  await query(
    `update catalog_items set name = $1, description = $2, price = $3,
     duration_minutes = $4, category = $5 where id = $6 and tenant_id = $7`,
    [String(formData.get("name") || ""), String(formData.get("description") || "") || null,
     priceRaw ? Number(priceRaw) : null, durationRaw ? Number(durationRaw) : null,
     String(formData.get("category") || "") || null, itemId, membership.tenant.id],
  );

  revalidatePath("/panel/catalogo");
  revalidatePath("/");
}
