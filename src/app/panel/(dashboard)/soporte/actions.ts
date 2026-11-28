"use server";

import { requireMembership } from "@/lib/auth";
import { query } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type TicketState = { error: string; success: string };

// El "bot filtro" del documento maestro: antes de mandar el reporte, se le
// pide al cliente que elija una categoría rápida para que quede
// pre-clasificado (esto es lo que en Fase 4 va a leer Claude para ubicar
// el error más rápido en el repositorio del cliente).
export async function createTicket(_prev: TicketState, formData: FormData): Promise<TicketState> {
  const membership = await requireMembership();

  const category = String(formData.get("category") || "");
  const description = String(formData.get("description") || "").trim();

  if (!description) return { error: "Contanos qué está pasando.", success: "" };

  try {
    await query(
      "insert into support_tickets (tenant_id, created_by, category, description) values ($1, $2, $3, $4)",
      [membership.tenant.id, membership.userId, category, description],
    );
  } catch {
    return { error: "No se pudo enviar el reporte. Probá de nuevo.", success: "" };
  }

  revalidatePath("/panel/soporte");
  return { error: "", success: "Listo, le llegó el aviso a VONN." };
}
