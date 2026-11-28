"use server";

import { query } from "@/lib/db";
import { isDbConfigured } from "@/lib/config";
import { getTenantBySlug } from "@/lib/queries";
import { resolveTenantSlug } from "@/lib/tenant/resolve";

export type ContactFormState = { ok: boolean; message: string };

// Acción pública: no hay sesión. El tenant se resuelve en el servidor por
// host; no se admite tenantId como argumento ni como campo de formulario.
export async function sendContactMessage(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const message = String(formData.get("message") || "").trim();
  if (!name || !message) {
    return { ok: false, message: "Completá al menos tu nombre y el mensaje." };
  }
  if (!isDbConfigured()) {
    return { ok: false, message: "Este es un sitio de demostración: todavía no está conectado a una base de datos real." };
  }
  const failure = { ok: false, message: "No se pudo enviar el mensaje. Probá de nuevo en un momento." };
  try {
    const tenant = await getTenantBySlug(await resolveTenantSlug());
    if (!tenant) return failure;
    await query(
      "insert into contact_messages (tenant_id, name, phone, email, message) values ($1, $2, $3, $4, $5)",
      [tenant.id, name, phone || null, email || null, message],
    );
  } catch {
    return failure;
  }
  return { ok: true, message: "¡Gracias! Tu mensaje fue enviado." };
}
