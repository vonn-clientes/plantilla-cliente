import "server-only";
import { queryOne } from "@/lib/db";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";
import type { TenantMember, Tenant } from "@/lib/types";

export type Membership = {
  userId: string;
  email: string;
  tenant: Tenant;
  role: TenantMember["role"];
};

// El tenant privado se descubre por el usuario de la sesión, nunca por
// un id enviado desde el formulario. Esta consulta inicia el aislamiento.
export async function requireMembership(): Promise<Membership> {
  const user = await readSession();
  if (!user) redirect("/panel/login");

  const membership = await queryOne<{ role: TenantMember["role"]; tenant: Tenant }>(
    `select m.role, row_to_json(t) as tenant
     from tenant_members m join tenants t on t.id = m.tenant_id
     where m.user_id = $1 and m.status = 'activo' and t.status = 'activo'
     order by m.created_at, m.id limit 1`,
    [user.id],
  );
  if (!membership) redirect("/panel/sin-acceso");
  return { userId: user.id, email: user.email, tenant: membership.tenant, role: membership.role };
}
